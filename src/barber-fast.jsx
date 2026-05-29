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
    tabNow: 'File', tabDone: 'Terminés', tabMore: 'Réglages', language: 'Langue',
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
    tabNow: 'القائمة', tabDone: 'المنتهية', tabMore: 'الإعدادات', language: 'اللغة',
    paidToast: (a) => `تم التحصيل · ${a}`, addedToast: 'أُضيف إلى القائمة', noShowToast: 'تمّ وضع علامة غائب',
    none: 'لا يوجد زبائن منتهون بعد.',
  },
};

// Frosted-glass surface (translucent + backdrop blur) for the panels.
const GLASS = {
  background: 'rgba(255, 248, 240, 0.05)',
  backdropFilter: 'blur(14px) saturate(1.2)',
  WebkitBackdropFilter: 'blur(14px) saturate(1.2)',
  border: '1px solid rgba(255, 240, 220, 0.10)',
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
    background: `radial-gradient(620px 420px at 18% 0%, rgba(224,168,91,0.10), transparent 60%),
                 radial-gradient(560px 460px at 100% 26%, rgba(200,137,59,0.08), transparent 62%), ${TOKENS.paper}`,
    color: TOKENS.ink, direction: dir, fontFamily: t.fontFamily,
    overflow: 'hidden',
  };
  const startSide = dir === 'rtl' ? 'right' : 'left';

  return (
    <div style={shell} className="fast-shell">
      {/* ── Compact header: identity + glanceable today total ─────────────── */}
      <div style={{ flexShrink: 0, padding: '14px 16px 12px',
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: 'rgba(255, 248, 240, 0.04)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
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
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '16px 16px 8px' }}>
        {tab === 'now' && (
          <>
            {/* CURRENT CLIENT — the focus, with the single most important action */}
            <div key={current ? 'chair-' + current.client.id : 'chair-empty'} className="fast-chair"
                 style={{ animation: 'fast-chair-in 280ms cubic-bezier(0.2,0.8,0.2,1)' }}>
            {current ? (
              <div style={{ ...GLASS, borderRadius: 20, padding: 18, marginBottom: 16, boxShadow: TOKENS.shadowSm }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: TOKENS.accent }}>{L.inChair}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600,
                                 color: over ? TOKENS.amber : TOKENS.muted, fontVariantNumeric: 'tabular-nums' }}>
                    <Icon name="clock" size={14} /> {mmss} <span style={{ fontWeight: 400 }}>· {over ? (lang === 'ar' ? 'تأخّر' : 'dépassé') : L.running}</span>
                  </span>
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>{current.client.name}</div>
                <div style={{ fontSize: 15, color: TOKENS.muted, marginTop: 2 }}>
                  {serviceLabel(current.client, lang)} · <span style={{ color: TOKENS.inkSoft, fontWeight: 600 }}>{fmt(current.client.price)}</span>
                </div>

                <button onClick={() => setPayOpen(true)} style={bigBtn(TOKENS.accent, '#06210F')}>
                  <Icon name="check" size={22} stroke={2.6} />
                  <span>{L.finish} · {fmt(current.client.price)}</span>
                </button>
                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <button onClick={() => { window.location.href = 'tel:+213555010101'; }} style={smallBtn()}>
                    <Icon name="phone" size={18} /> <span>{L.call}</span>
                  </button>
                  <button onClick={() => { setCurrent(null); showToast(`${L.skip} · ${current.client.name}`); }} style={smallBtn()}>
                    <Icon name="skip" size={18} /> <span>{L.skip}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 16 }}>
                {waiting[0] ? (
                  <button onClick={() => startClient(waiting[0])} style={bigBtn(TOKENS.accent, '#06210F', true)}>
                    <Icon name="play" size={22} />
                    <span>{L.startNext} · {waiting[0].name}</span>
                  </button>
                ) : (
                  <div style={{ ...GLASS, borderRadius: 20, padding: '26px 18px', textAlign: 'center', color: TOKENS.muted }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: TOKENS.inkSoft }}>{L.chairFree}</div>
                    <div style={{ fontSize: 14, marginTop: 6 }}>{L.empty}</div>
                  </div>
                )}
              </div>
            )}
            </div>

            {/* QUEUE — large, tappable rows; each can be started in one tap */}
            {waiting.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '4px 4px 10px' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: TOKENS.muted }}>{L.queue}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: TOKENS.inkSoft }}>{waiting.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {waiting.map((c, i) => (
                    <FastRow key={c.id} c={c} i={i} lang={lang} L={L} fmt={fmt}
                             onStart={() => startClient(c)} onNoShow={() => noShow(c)} startSide={startSide} />
                  ))}
                </div>
              </>
            )}
          </>
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
                    background: 'rgba(255, 248, 240, 0.04)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', paddingBottom: 6 }}>
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
        .fast-shell .fast-row:hover { transform: translateY(-1px); box-shadow: 0 14px 28px -12px rgba(0,0,0,0.6); }
        @media (prefers-reduced-motion: reduce) {
          .fast-shell button:active { transform: none; }
          .fast-shell .fast-chair, .fast-shell .fast-row { animation: none !important; }
        }
      `}</style>
    </div>
  );

  // styled-button helpers (kept inside for token access)
  function bigBtn(bg, fg, dashed, outline) {
    const isAccent = bg === TOKENS.accent && !outline;
    return {
      width: '100%', minHeight: 64, borderRadius: 16, cursor: 'pointer', fontFamily: 'inherit',
      background: outline ? 'transparent'
        : (isAccent ? `linear-gradient(180deg, ${TOKENS.accentBright}, ${TOKENS.accent})` : bg),
      color: fg,
      border: outline ? `2px dashed ${TOKENS.border}` : 'none',
      boxShadow: isAccent ? TOKENS.glow : 'none',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em', marginTop: 16, padding: '0 18px',
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

// One large queue row — name + service + one-tap "Start", with no-show tucked away.
function FastRow({ c, i, lang, L, fmt, onStart, onNoShow, startSide }) {
  return (
    <div className="fast-row" style={{ ...GLASS, borderRadius: 16, padding: '12px 12px 12px 14px',
                  display: 'flex', alignItems: 'center', gap: 12, minHeight: 72, boxShadow: TOKENS.shadowSm,
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
    <div style={{ position: 'absolute', top: 70, left: '50%', transform: 'translateX(-50%)', zIndex: 200,
                  background: TOKENS.ink, color: TOKENS.paper, padding: '12px 18px', borderRadius: 999,
                  fontSize: 15, fontWeight: 700, boxShadow: '0 16px 36px -10px rgba(0,0,0,0.5)',
                  whiteSpace: 'nowrap', animation: 'fast-fade 200ms ease-out' }}>{msg}</div>
  );
}

// shared sheet chrome
function overlay() {
  return { position: 'absolute', inset: 0, zIndex: 150, background: 'rgba(0,0,0,0.5)',
           backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
           display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', animation: 'fast-fade 160ms ease-out' };
}
function sheet(dir) {
  return { background: 'rgba(37, 31, 23, 0.80)', backdropFilter: 'blur(22px) saturate(1.2)', WebkitBackdropFilter: 'blur(22px) saturate(1.2)',
           borderRadius: '22px 22px 0 0', padding: '14px 18px 24px',
           direction: dir, animation: 'fast-up 240ms cubic-bezier(0.2,0.8,0.2,1)',
           borderTop: `1px solid rgba(255, 240, 220, 0.12)`, boxShadow: TOKENS.shadowLg };
}
function grabber() {
  return { width: 40, height: 4, borderRadius: 999, background: TOKENS.border, margin: '0 auto 16px' };
}

Object.assign(window, { BarberFast });
