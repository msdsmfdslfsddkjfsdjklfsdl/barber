// barber-fast.jsx — REDESIGN: a fast, low-clutter barber command screen built
// for rush hours. One screen runs the chair: who's in it, one tap to finish +
// charge, one tap to start the next, one tap to add a walk-in. Reuses the
// shared data layer (TOKENS, SERVICES, QUEUE_BY_DENSITY…), serviceLabel,
// resolveBarber and the ui primitives (Icon, Avatar, Button).

// Redesign-only copy (kept local so the component is self-contained).
const FAST_STR = {
  fr: {
    inChair: 'En chaise', chairFree: 'Chaise libre', finish: 'Terminer · Encaisser',
    call: 'Appeler', skip: 'Passer', startNext: 'Démarrer le prochain', start: 'Démarrer',
    queue: 'File d’attente', empty: 'File vide — soufflez un peu ☕', waiting: 'en attente',
    add: 'Ajouter un client', addToQueue: 'Ajouter à la file', walkIn: 'Walk-in',
    name: 'Nom (optionnel)', service: 'Service', cashIn: 'Encaisser',
    noShow: 'Absent', today: "Aujourd’hui", clients: 'clients', doneToday: 'Terminés',
    revenue: 'Recette', available: 'Disponible', busy: 'Occupé', running: 'en cours',
    tabNow: 'Journée', tabDone: 'Terminés', tabMore: 'Réglages', language: 'Langue', daySchedule: 'Programme du jour',
    paidToast: (a) => `Encaissé · ${a}`, addedToast: 'Ajouté à la file', noShowToast: 'Marqué absent',
    none: 'Aucun client terminé pour l’instant.',
  },
  ar: {
    inChair: 'في الكرسي', chairFree: 'الكرسي فارغ', finish: 'إنهاء · تحصيل',
    call: 'اتصال', skip: 'تخطّي', startNext: 'ابدأ التالي', start: 'ابدأ',
    queue: 'قائمة الانتظار', empty: 'القائمة فارغة — استرِح قليلاً ☕', waiting: 'بالانتظار',
    add: 'إضافة زبون', addToQueue: 'أضف إلى القائمة', walkIn: 'بدون موعد',
    name: 'الاسم (اختياري)', service: 'الخدمة', cashIn: 'تحصيل',
    noShow: 'غائب', today: 'اليوم', clients: 'زبائن', doneToday: 'المنتهية',
    revenue: 'المداخيل', available: 'متاح', busy: 'مشغول', running: 'جارٍ',
    tabNow: 'اليوم', tabDone: 'المنتهية', tabMore: 'الإعدادات', language: 'اللغة', daySchedule: 'برنامج اليوم',
    paidToast: (a) => `تم التحصيل · ${a}`, addedToast: 'أُضيف إلى القائمة', noShowToast: 'تمّ وضع علامة غائب',
    none: 'لا يوجد زبائن منتهون بعد.',
  },
};

// Flat panel — minimal style: solid surface + a thin hairline border, no glass,
// no shadow, no gradient.
const PANEL = {
  background: TOKENS.surface,
  border: `1px solid ${TOKENS.borderSoft}`,
};

// Smoothly counts a number up to its new value (skips when reduce-motion is on).
function useCountUp(value, ms = 480) {
  const [shown, setShown] = React.useState(value);
  const prev = React.useRef(value);
  React.useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const from = prev.current, to = value;
    if (reduce || from === to) { prev.current = to; setShown(to); return; }
    const start = performance.now(); let raf;
    const tick = (n) => {
      const p = Math.min(1, (n - start) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(from + (to - from) * e));
      if (p < 1) raf = requestAnimationFrame(tick); else prev.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

function BarberFast({ lang = 'fr', setLang, density = 'busy', barberId = 'sofiane',
                     liveBookings = [], barberOverrides = {}, onUpdateProfile }) {
  const t = I18N[lang];
  const L = FAST_STR[lang];
  const dir = t.dir;
  const barber = resolveBarber(barberId, barberOverrides) || BARBERS[1];
  const baseQueue = QUEUE_BY_DENSITY[density];
  const baseDone = COMPLETED_BY_DENSITY[density];
  const fmt = (n) => `${Number(n).toLocaleString('fr-FR')} ${t.dzd}`;

  // ── State ────────────────────────────────────────────────────────────────
  const baseInSession = baseQueue.find(q => q.status === 'in_session') || null;
  const [current, setCurrent] = React.useState(() => baseInSession
    ? { client: baseInSession, startedAt: Date.now() - (baseInSession.startedMinAgo || 0) * 60000 }
    : null);
  const [removed, setRemoved] = React.useState(() => new Set());
  const [walkIns, setWalkIns] = React.useState([]);
  const [doneExtra, setDoneExtra] = React.useState([]);
  const [tab, setTab] = React.useState('now');
  const [payOpen, setPayOpen] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [toast, setToast] = React.useState(null);
  const toastRef = React.useRef(null);
  const showToast = (msg) => {
    if (toastRef.current) clearTimeout(toastRef.current);
    setToast({ id: Date.now(), msg });
    toastRef.current = setTimeout(() => setToast(null), 2400);
  };

  // Live "in chair" clock
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  // ── Derived queue (bookings + walk-ins, minus started / no-shows) ─────────
  const liveClients = liveBookings.filter(b => b.barberId === barberId).map(b => ({
    id: b.code, name: b.name, time: b.time, service: b.service, price: b.price, booked: true,
  }));
  const waiting = [...baseQueue.filter(q => q.status === 'waiting'), ...liveClients, ...walkIns]
    .filter(c => !removed.has(c.id) && !(current && current.client.id === c.id));

  const doneList = [...baseDone, ...doneExtra];
  const revenue = doneList.reduce((s, c) => s + (c.price || 0), 0);
  const revShown = useCountUp(revenue);

  // ── Actions ───────────────────────────────────────────────────────────────
  const buzz = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };
  const startClient = (c) => { buzz(10); setCurrent({ client: c, startedAt: Date.now() }); setRemoved(p => new Set(p).add(c.id)); };
  const noShow = (c) => { setRemoved(p => new Set(p).add(c.id)); showToast(`${L.noShowToast} · ${c.name}`); };
  const confirmPay = (total, method) => {
    buzz(18);
    if (current) setDoneExtra(p => [...p, { name: current.client.name, service: current.client.service, price: total, method }]);
    setPayOpen(false); setCurrent(null); showToast(L.paidToast(fmt(total)));
  };
  const addClient = (name, serviceId) => {
    buzz(10);
    const svc = SERVICES.find(s => s.id === serviceId) || SERVICES[0];
    const c = { id: 'w' + Date.now(), name: (name || '').trim() || L.walkIn, service: svc.name, price: svc.price, walkIn: true };
    setWalkIns(p => [...p, c]); setAddOpen(false); showToast(`${L.addedToast} · ${c.name}`);
  };

  const elapsed = current ? Math.max(0, Math.floor((now - current.startedAt) / 1000)) : 0;
  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
  const EXPECTED = 30 * 60;                       // typical cut; over this the timer goes amber
  const over = !!current && elapsed > EXPECTED;

  const shell = {
    height: '100%', display: 'flex', flexDirection: 'column', position: 'relative',
    background: TOKENS.paper,
    color: TOKENS.ink, direction: dir, fontFamily: t.fontFamily,
    overflow: 'hidden',
  };
  const startSide = dir === 'rtl' ? 'right' : 'left';

  return (
    <div style={shell} className="fast-shell">
      {/* ── Compact header: identity + glanceable today total ─────────────── */}
      <div style={{ flexShrink: 0, padding: '18px 18px 16px',
                    display: 'flex', alignItems: 'center', gap: 12,
                    borderBottom: `1px solid ${TOKENS.borderSoft}` }}>
        <Avatar initials={barber.initials} tint={barber.tint} text={barber.text} photo={barber.photo} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {barber.name[lang]}
          </div>
          <StatusDot color={TOKENS.green} label={L.available} />
        </div>
        <div style={{ textAlign: dir === 'rtl' ? 'left' : 'right', lineHeight: 1.1 }}>
          <div style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmt(revShown)}</div>
          <div style={{ fontSize: 12, color: TOKENS.muted, marginTop: 2 }}>{doneList.length} {L.clients} · {L.today}</div>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '20px 18px 10px' }}>
        {tab === 'now' && (
          <div className="fast-chair" style={{ animation: 'fast-chair-in 280ms cubic-bezier(0.2,0.8,0.2,1)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                          color: TOKENS.muted, margin: '0 0 14px 4px' }}>{L.daySchedule}</div>
            {(() => {
              const doneTimes = ['08:30', '09:00', '09:25', '09:50', '08:00', '08:15', '07:45'];
              const doneAgenda = doneList.map((c, i) => ({
                name: c.name, service: c.service, price: c.price,
                time: c.time || doneTimes[i] || '09:00', kind: 'done',
              })).sort((a, b) => a.time.localeCompare(b.time));
              const nowAgenda = current ? [{
                name: current.client.name, service: current.client.service,
                price: current.client.price, time: current.client.time || '—', kind: 'now',
              }] : [];
              const upAgenda = waiting.map(c => ({
                name: c.name, service: c.service, price: c.price,
                time: c.time || '—', kind: 'up', ref: c,
              }));
              const agenda = [...doneAgenda, ...nowAgenda, ...upAgenda];
              if (agenda.length === 0) {
                return (
                  <div style={{ ...PANEL, borderRadius: 16, padding: '28px 18px', textAlign: 'center', color: TOKENS.muted }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: TOKENS.inkSoft }}>{L.chairFree}</div>
                    <div style={{ fontSize: 14, marginTop: 6 }}>{L.empty}</div>
                  </div>
                );
              }
              return agenda.map((it, i) => (
                <TimelineRow key={i} it={it} last={i === agenda.length - 1}
                             lang={lang} L={L} fmt={fmt} mmss={mmss} over={over}
                             onFinish={() => setPayOpen(true)}
                             onCall={() => { window.location.href = 'tel:+213555010101'; }}
                             onSkip={() => { setCurrent(null); showToast(`${L.skip} · ${it.name}`); }}
                             onStart={() => it.ref && startClient(it.ref)}
                             onNoShow={() => it.ref && noShow(it.ref)} />
              ));
            })()}
          </div>
        )}

        {tab === 'done' && <FastDone L={L} lang={lang} list={doneList} fmt={fmt} revenue={revenue} />}
        {tab === 'more' && <FastMore L={L} t={t} lang={lang} setLang={setLang} barber={barber} />}
      </div>

      {/* ── Always-visible primary action: add a client in one tap ──────────── */}
      {tab === 'now' && (
        <div style={{ flexShrink: 0, padding: '8px 16px 12px' }}>
          <button onClick={() => setAddOpen(true)} style={bigBtn(TOKENS.surface, TOKENS.ink, false, true)}>
            <Icon name="plus" size={22} stroke={2.4} /> <span>{L.add}</span>
          </button>
        </div>
      )}

      {/* ── Bottom tab bar (3 large targets) ────────────────────────────────── */}
      <div style={{ flexShrink: 0, display: 'flex', borderTop: `1px solid ${TOKENS.borderSoft}`,
                    background: TOKENS.paper, paddingBottom: 6 }}>
        {[['now', 'list', L.tabNow], ['done', 'check', L.tabDone], ['more', 'settings', L.tabMore]].map(([id, icon, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, appearance: 'none', border: 'none', background: 'transparent', cursor: 'pointer',
            fontFamily: 'inherit', padding: '10px 0 8px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 4, color: tab === id ? TOKENS.accent : TOKENS.muted,
          }}>
            <Icon name={icon} size={22} stroke={2} />
            <span style={{ fontSize: 12, fontWeight: tab === id ? 700 : 500 }}>{label}</span>
          </button>
        ))}
      </div>

      {toast && <FastToast key={toast.id} msg={toast.msg} />}
      {payOpen && current && <FastPaySheet L={L} t={t} fmt={fmt} client={current.client} onClose={() => setPayOpen(false)} onPay={confirmPay} />}
      {addOpen && <FastAddSheet L={L} t={t} lang={lang} fmt={fmt} onClose={() => setAddOpen(false)} onAdd={addClient} />}

      <style>{`
        @keyframes fast-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes fast-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fast-chair-in { from { opacity: 0; transform: translateY(12px) scale(0.99); } to { opacity: 1; transform: none; } }
        @keyframes fast-row-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .fast-shell button { transition: transform 90ms ease; -webkit-tap-highlight-color: transparent; }
        .fast-shell button:active { transform: scale(0.965); }
        .fast-shell .fast-row { transition: transform 130ms ease, box-shadow 130ms ease; }
        .fast-shell .fast-row:hover { background: #251F17; }
        @media (prefers-reduced-motion: reduce) {
          .fast-shell button:active { transform: none; }
          .fast-shell .fast-chair, .fast-shell .fast-row { animation: none !important; }
        }
      `}</style>
    </div>
  );

  // styled-button helpers (kept inside for token access)
  function bigBtn(bg, fg, dashed, outline) {
    return {
      width: '100%', minHeight: 60, borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit',
      background: outline ? 'transparent' : bg, color: fg,
      border: outline ? `1px solid ${TOKENS.border}` : 'none',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em', marginTop: 16, padding: '0 18px',
    };
  }
  function smallBtn() {
    return {
      flex: 1, minHeight: 52, borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit',
      background: TOKENS.surface, color: TOKENS.ink, border: `1px solid ${TOKENS.border}`,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      fontSize: 15, fontWeight: 600,
    };
  }
}

// Timeline / agenda row — the day as a vertical schedule. Done is dimmed, the
// active appointment expands with its controls, upcoming gets a one-tap start.
function TimelineRow({ it, last, lang, L, fmt, mmss, over, onFinish, onCall, onSkip, onStart, onNoShow }) {
  const isNow = it.kind === 'now';
  const isDone = it.kind === 'done';
  const timeColor = isNow ? TOKENS.accent : isDone ? TOKENS.faint : TOKENS.muted;
  const card = {
    flex: 1, minWidth: 0, marginBottom: 14, borderRadius: 14,
    background: isNow ? TOKENS.surfaceAlt : TOKENS.surface,
    border: isNow ? `2px solid ${TOKENS.accent}` : `1px solid ${TOKENS.borderSoft}`,
    padding: isNow ? 16 : '12px 14px', opacity: isDone ? 0.55 : 1,
  };
  const outlineBtn = { flex: 1, minHeight: 48, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
    background: 'transparent', color: TOKENS.ink, border: `1px solid ${TOKENS.border}`,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 15, fontWeight: 600 };
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
      <div style={{ width: 44, flexShrink: 0, textAlign: 'end', paddingTop: 13, fontSize: 14,
                    fontWeight: isNow ? 800 : 600, color: timeColor, fontVariantNumeric: 'tabular-nums' }}>{it.time}</div>
      <div style={{ width: 16, flexShrink: 0, position: 'relative', display: 'flex', justifyContent: 'center' }}>
        <span style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)',
                       top: 0, bottom: last ? 'auto' : -14, height: last ? 20 : undefined,
                       width: 2, background: TOKENS.borderSoft }} />
        <span style={{ position: 'absolute', top: 12, width: isNow ? 12 : 9, height: isNow ? 12 : 9, borderRadius: '50%',
                       background: isNow ? TOKENS.accent : (isDone ? TOKENS.faint : TOKENS.surface),
                       border: isNow ? `3px solid ${TOKENS.accentSoft}` : `2px solid ${isDone ? TOKENS.faint : TOKENS.border}` }} />
      </div>
      <div style={card}>
        {isNow ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: TOKENS.accent }}>{L.inChair}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600,
                             color: over ? TOKENS.amber : TOKENS.muted, fontVariantNumeric: 'tabular-nums' }}>
                <Icon name="clock" size={14} /> {mmss}
              </span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em' }}>{it.name}</div>
            <div style={{ fontSize: 14, color: TOKENS.muted, marginTop: 1 }}>
              {serviceLabel(it, lang)} · <span style={{ color: TOKENS.inkSoft, fontWeight: 600 }}>{fmt(it.price)}</span>
            </div>
            <button onClick={onFinish} style={{ width: '100%', minHeight: 54, marginTop: 14, borderRadius: 12,
                     cursor: 'pointer', fontFamily: 'inherit', background: TOKENS.accent, color: '#06210F', border: 'none',
                     display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 16, fontWeight: 800 }}>
              <Icon name="check" size={20} stroke={2.6} /> {L.finish} · {fmt(it.price)}
            </button>
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button onClick={onCall} style={outlineBtn}><Icon name="phone" size={16} /> {L.call}</button>
              <button onClick={onSkip} style={outlineBtn}><Icon name="skip" size={16} /> {L.skip}</button>
            </div>
          </>
        ) : isDone ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="check" size={16} stroke={2.4} style={{ color: TOKENS.accent, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</div>
              <div style={{ fontSize: 12, color: TOKENS.muted }}>{serviceLabel(it, lang)}</div>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: TOKENS.accent, fontVariantNumeric: 'tabular-nums' }}>{fmt(it.price)}</span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</div>
              <div style={{ fontSize: 13, color: TOKENS.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {serviceLabel(it, lang)} · {fmt(it.price)}
              </div>
            </div>
            <button aria-label={L.noShow} onClick={onNoShow} style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                     cursor: 'pointer', fontFamily: 'inherit', background: 'transparent', color: TOKENS.muted,
                     border: `1px solid ${TOKENS.border}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="more" size={20} />
            </button>
            <button onClick={onStart} style={{ minHeight: 44, paddingInline: 16, borderRadius: 12, flexShrink: 0,
                     cursor: 'pointer', fontFamily: 'inherit', background: TOKENS.accent, color: '#06210F', border: 'none',
                     display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 15, fontWeight: 800 }}>
              <Icon name="play" size={15} /> {L.start}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// One large queue row — name + service + one-tap "Start", with no-show tucked away.
function FastRow({ c, i, lang, L, fmt, onStart, onNoShow, startSide }) {
  return (
    <div className="fast-row" style={{ ...PANEL, borderRadius: 14, padding: '12px 12px 12px 14px',
                  display: 'flex', alignItems: 'center', gap: 12, minHeight: 72,
                  animation: 'fast-row-in 260ms ease both', animationDelay: `${Math.min(i, 6) * 35}ms` }}>
      <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                    background: TOKENS.surfaceAlt, color: TOKENS.muted, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontVariantNumeric: 'tabular-nums', fontSize: 15 }}>{i + 1}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {c.name}
          {c.walkIn && <span style={tag(TOKENS.amberSoft, TOKENS.amber)}>{L.walkIn}</span>}
          {c.booked && <span style={tag(TOKENS.accentSoft, TOKENS.accent)}>web</span>}
        </div>
        <div style={{ fontSize: 13, color: TOKENS.muted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {serviceLabel(c, lang)} · {fmt(c.price)}{c.time ? ` · ${c.time}` : ''}
        </div>
      </div>
      <button aria-label={L.noShow} onClick={onNoShow} style={{
        width: 44, height: 44, borderRadius: 12, flexShrink: 0, cursor: 'pointer', fontFamily: 'inherit',
        background: 'transparent', color: TOKENS.muted, border: `1px solid ${TOKENS.border}`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}><Icon name="more" size={20} /></button>
      <button onClick={onStart} style={{
        minHeight: 44, paddingInline: 18, borderRadius: 12, flexShrink: 0, cursor: 'pointer', fontFamily: 'inherit',
        background: TOKENS.accent, color: '#06210F', border: 'none',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 15, fontWeight: 800,
      }}><Icon name="play" size={15} /> {L.start}</button>
    </div>
  );
}

function tag(bg, fg) {
  return {
    marginInlineStart: 8, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
    background: bg, color: fg, letterSpacing: '0.04em', textTransform: 'uppercase', verticalAlign: 'middle',
  };
}

// Fast checkout: amount + a single big "cash" button — cash only, no tip.
function FastPaySheet({ L, t, fmt, client, onClose, onPay }) {
  const total = client.price;
  return (
    <div onClick={onClose} style={overlay()}>
      <div onClick={e => e.stopPropagation()} style={sheet(t.dir)}>
        <div style={grabber()} />
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 14, color: TOKENS.muted }}>{client.name}</div>
          <div style={{ fontSize: 46, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{fmt(total)}</div>
        </div>
        <button onClick={() => onPay(total, 'cash')} style={{
          width: '100%', minHeight: 66, borderRadius: 16, cursor: 'pointer', fontFamily: 'inherit',
          background: TOKENS.accent, color: '#06210F', border: 'none',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 19, fontWeight: 800,
        }}><Icon name="check" size={24} stroke={2.6} /> {L.cashIn}</button>
      </div>
    </div>
  );
}

// Fast walk-in: optional name + tap a service chip + one big "add".
function FastAddSheet({ L, t, lang, fmt, onClose, onAdd }) {
  const [name, setName] = React.useState('');
  const [serviceId, setServiceId] = React.useState('coupe_adulte');
  return (
    <div onClick={onClose} style={overlay()}>
      <div onClick={e => e.stopPropagation()} style={sheet(t.dir)}>
        <div style={grabber()} />
        <h2 style={{ margin: '0 0 14px', fontSize: 22, fontWeight: 700 }}>{L.add}</h2>
        <input value={name} onChange={e => setName(e.target.value)} placeholder={L.name} style={{
          width: '100%', minHeight: 56, borderRadius: 14, padding: '0 16px', boxSizing: 'border-box',
          border: `1px solid ${TOKENS.border}`, background: TOKENS.surface, color: TOKENS.ink,
          fontFamily: 'inherit', fontSize: 18, outline: 'none', direction: t.dir, marginBottom: 16,
        }} />
        <div style={{ fontSize: 13, color: TOKENS.muted, fontWeight: 600, margin: '0 2px 8px' }}>{L.service}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {SERVICES.map(s => {
            const sel = s.id === serviceId;
            return (
              <button key={s.id} onClick={() => setServiceId(s.id)} style={{
                minHeight: 48, paddingInline: 14, borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
                background: sel ? TOKENS.accentSoft : TOKENS.surface, color: sel ? TOKENS.accent : TOKENS.ink,
                border: `1.5px solid ${sel ? TOKENS.accent : TOKENS.border}`, fontSize: 15, fontWeight: 600,
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}>
                {s.name[lang]} <span style={{ color: sel ? TOKENS.accent : TOKENS.muted, fontWeight: 700 }}>{s.price}</span>
              </button>
            );
          })}
        </div>
        <button onClick={() => onAdd(name, serviceId)} style={{
          width: '100%', minHeight: 60, borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', marginTop: 20,
          background: TOKENS.accent, color: '#06210F', border: 'none',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 17, fontWeight: 800,
        }}><Icon name="plus" size={20} stroke={2.4} /> {L.addToQueue}</button>
      </div>
    </div>
  );
}

function FastDone({ L, lang, list, fmt, revenue }) {
  const shown = useCountUp(revenue);
  return (
    <div>
      <div style={{ background: TOKENS.surfaceAlt, borderRadius: 18, padding: 18, marginBottom: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: TOKENS.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>{L.revenue} · {L.today}</div>
        <div style={{ fontSize: 40, fontWeight: 800, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{fmt(shown)}</div>
        <div style={{ fontSize: 14, color: TOKENS.muted, marginTop: 2 }}>{list.length} {L.clients}</div>
      </div>
      {list.length === 0 ? (
        <div style={{ color: TOKENS.muted, fontSize: 15, textAlign: 'center', padding: 20 }}>{L.none}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.slice().reverse().map((c, i) => (
            <div key={i} style={{ background: TOKENS.surface, borderRadius: 14, padding: '14px 16px',
                                  display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: TOKENS.greenSoft, color: TOKENS.green,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="check" size={16} stroke={2.4} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{c.name}</div>
                <div style={{ fontSize: 13, color: TOKENS.muted, marginTop: 1 }}>{serviceLabel(c, lang)}</div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: TOKENS.green, fontVariantNumeric: 'tabular-nums' }}>{fmt(c.price)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FastMore({ L, t, lang, setLang, barber }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: TOKENS.muted, fontWeight: 700, margin: '4px 2px 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{L.language}</div>
      <div style={{ display: 'flex', gap: 10 }}>
        {[['fr', 'FR'], ['ar', 'AR']].map(([v, label]) => (
          <button key={v} onClick={() => setLang && setLang(v)} style={{
            flex: 1, minHeight: 56, borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', fontSize: 17, fontWeight: 700,
            background: lang === v ? TOKENS.accentSoft : TOKENS.surface, color: lang === v ? TOKENS.accent : TOKENS.ink,
            border: `1.5px solid ${lang === v ? TOKENS.accent : TOKENS.border}`,
          }}>{label}</button>
        ))}
      </div>
      <div style={{ marginTop: 20, background: TOKENS.surface, borderRadius: 16, padding: 16,
                    display: 'flex', alignItems: 'center', gap: 14 }}>
        <Avatar initials={barber.initials} tint={barber.tint} text={barber.text} photo={barber.photo} size={48} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{barber.name[lang]}</div>
          <div style={{ fontSize: 13, color: TOKENS.muted, marginTop: 2 }}>{barber.specialty[lang]}</div>
        </div>
      </div>
    </div>
  );
}

function FastToast({ msg }) {
  return (
    <div role="status" aria-live="polite" style={{ position: 'absolute', top: 70, left: '50%', transform: 'translateX(-50%)', zIndex: 200,
                  background: TOKENS.ink, color: TOKENS.paper, padding: '12px 18px', borderRadius: 999,
                  fontSize: 15, fontWeight: 700, boxShadow: '0 16px 36px -10px rgba(0,0,0,0.5)',
                  whiteSpace: 'nowrap', animation: 'fast-fade 200ms ease-out' }}>{msg}</div>
  );
}

// shared sheet chrome
function overlay() {
  return { position: 'absolute', inset: 0, zIndex: 150, background: 'rgba(0,0,0,0.55)',
           display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', animation: 'fast-fade 160ms ease-out' };
}
function sheet(dir) {
  return { background: TOKENS.surfaceAlt,
           borderRadius: '22px 22px 0 0', padding: '14px 18px 24px',
           direction: dir, animation: 'fast-up 240ms cubic-bezier(0.2,0.8,0.2,1)',
           borderTop: `1px solid ${TOKENS.border}`, boxShadow: TOKENS.shadowLg };
}
function grabber() {
  return { width: 40, height: 4, borderRadius: 999, background: TOKENS.border, margin: '0 auto 16px' };
}

Object.assign(window, { BarberFast });
