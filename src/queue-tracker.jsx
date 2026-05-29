// queue-tracker.jsx — live position page. State driven by the `position` prop:
//   'three' = 3 people before you (default)
//   'one'   = you're up next
//   'done'  = session complete
function QueueTracker({ lang = 'fr', position = 'three', embeddedBarber, service, timeKey, code, customerName, onBack, onRestart }) {
  const t = I18N[lang];
  const barber = embeddedBarber || BARBERS.find(b => b.id === 'sofiane');
  const showCode = code || 'FC-2641';

  const state = (() => {
    if (position === 'done') return { kind: 'done',  before: 0, eta: 0,  startedMinAgo: 22 };
    if (position === 'one')  return { kind: 'next',  before: 0, eta: 4,  inSessionLabel: true };
    return                     { kind: 'wait',  before: 3, eta: 28 };
  })();

  const surface = {
    fontFamily: t.fontFamily, direction: t.dir, background: TOKENS.surface,
    color: TOKENS.ink, height: '100%', display: 'flex', flexDirection: 'column',
  };

  return (
    <div style={surface}>
      {onBack && (
        <div style={{ padding: '18px 22px 6px', flexShrink: 0,
                      display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={{
            appearance: 'none', border: `1px solid ${TOKENS.border}`,
            background: TOKENS.surface, cursor: 'pointer',
            height: 44, paddingInline: 14, borderRadius: 12,
            display: 'flex', alignItems: 'center', gap: 6,
            color: TOKENS.ink, padding: 0, flexShrink: 0,
            fontFamily: 'inherit', fontSize: 14, fontWeight: 500,
          }}>
            <Icon name={t.dir === 'rtl' ? 'chevron-right' : 'chevron-left'} size={20} />
            <span style={{ paddingInlineEnd: 10 }}>{t.back}</span>
          </button>
        </div>
      )}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 22px 24px' }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div style={{ fontSize: 12, color: TOKENS.muted, fontWeight: 500 }}>
            {t.yourNumber} <span style={{ color: TOKENS.ink, fontWeight: 600 }}>{showCode}</span>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
                        height: 22, padding: '0 10px', borderRadius: 999,
                        background: state.kind === 'done' ? TOKENS.surfaceAlt : TOKENS.accentSoft,
                        color: state.kind === 'done' ? TOKENS.muted : TOKENS.accent,
                        fontSize: 11, fontWeight: 500 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%',
                           background: state.kind === 'done' ? TOKENS.muted : TOKENS.accent,
                           animation: state.kind === 'done' ? '' : 'pulse 1.8s ease-in-out infinite',
                           boxShadow: state.kind === 'done' ? 'none' :
                             `0 0 0 0 ${TOKENS.accent}40` }} />
            {state.kind === 'done' ? t.doneStateTitle : t.livePill}
          </div>
        </div>

        {/* hero — position number + label */}
        {state.kind === 'wait' && <WaitHero t={t} before={state.before} eta={state.eta} />}
        {state.kind === 'next' && <NextHero t={t} eta={state.eta} />}
        {state.kind === 'done' && <DoneHero t={t} />}

        {/* Your barber card */}
        <div style={{ marginTop: 24, marginBottom: 16 }}>
          <div style={{ fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: 10,
                        letterSpacing: '0.1em', textTransform: 'uppercase',
                        color: TOKENS.muted, marginBottom: 8 }}>{t.barberStatus}</div>
          <div style={{ border: `1px solid ${TOKENS.border}`, borderRadius: 14,
                        padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar initials={barber.initials} tint={barber.tint} text={barber.text} size={44} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{barber.name[lang]}</div>
              <div style={{ fontSize: 12, color: TOKENS.muted, marginTop: 2 }}>
                {service ? `${service.name[lang]} · ${service.price} ${t.dzd}`
                         : `${barber.specialty[lang]}`}
              </div>
            </div>
            <button aria-label={t.dir === 'rtl' ? 'الاتصال بالحلاق' : 'Appeler le coiffeur'}
                    style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${TOKENS.border}`,
                             background: TOKENS.surface, cursor: 'pointer', display: 'flex',
                             alignItems: 'center', justifyContent: 'center', color: TOKENS.ink }}>
              <Icon name="phone" size={15} />
            </button>
          </div>
        </div>

        {/* Live queue list (dotted, anonymized) */}
        {state.kind !== 'done' && (
          <QueueList t={t} before={state.before} />
        )}

        {/* footer actions */}
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {state.kind === 'done' && <Button variant="accent" leftIcon="star">{t.rateVisit}</Button>}
          {state.kind !== 'done' &&
            <Button variant="secondary" size="md" style={{ color: TOKENS.red, borderColor: TOKENS.border }}>
              {t.cancelBooking}
            </Button>}
          {onRestart && state.kind === 'done' && (
            <Button variant="ghost" size="md" onClick={onRestart}>{t.bookAgain}</Button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 ${TOKENS.accent}55; }
          50%      { box-shadow: 0 0 0 6px ${TOKENS.accent}00; }
        }
      `}</style>
    </div>
  );
}

function WaitHero({ t, before, eta }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: TOKENS.muted, marginBottom: 6 }}>{t.queuePos}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <span style={{ fontFamily: "'Geist Mono', ui-monospace, monospace",
                       fontSize: 72, fontWeight: 500, lineHeight: 1, letterSpacing: '-0.04em' }}>
          {before + 1}
        </span>
        <span style={{ fontSize: 18, color: TOKENS.muted, fontWeight: 400 }}>
          / {before + 2}
        </span>
      </div>
      <div style={{ fontSize: 14, color: TOKENS.inkSoft, marginBottom: 18 }}>
        {t.peopleBefore(before)}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Pill icon="clock" label={t.estWait} value={`~${eta} ${t.min}`} />
      </div>
    </div>
  );
}

function NextHero({ t, eta }) {
  return (
    <div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 12,
                    padding: '4px 10px', height: 24, borderRadius: 999,
                    background: TOKENS.amberSoft, color: TOKENS.amber,
                    fontSize: 11, fontWeight: 500, letterSpacing: '0.02em' }}>
        <Icon name="bolt" size={11} />
        <span>{t.youreNext} · <span style={{
          fontFamily: t.dir === 'rtl' ? 'inherit' : "'IBM Plex Sans Arabic', serif",
          fontWeight: 600 }}>{t.soonAr}</span></span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <span style={{ fontFamily: "'Geist Mono', ui-monospace, monospace",
                       fontSize: 72, fontWeight: 500, lineHeight: 1, letterSpacing: '-0.04em' }}>1</span>
        <span style={{ fontSize: 18, color: TOKENS.muted, fontWeight: 400 }}>/ 2</span>
      </div>
      <div style={{ fontSize: 14, color: TOKENS.inkSoft, marginBottom: 18, lineHeight: 1.45 }}>
        {t.nextSubtitle}
      </div>
      <Pill icon="clock" label={t.estWait} value={`~${eta} ${t.min}`} accent />
    </div>
  );
}

function DoneHero({ t }) {
  return (
    <div>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: TOKENS.accentSoft,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: TOKENS.accent, marginBottom: 14 }}>
        <Icon name="check" size={26} stroke={2.4} />
      </div>
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em' }}>
        {t.doneStateTitle}
      </h1>
      <div style={{ marginTop: 6, fontSize: 14, color: TOKENS.muted, lineHeight: 1.5 }}>
        {t.doneStateSub}
      </div>
    </div>
  );
}

function Pill({ icon, label, value, accent }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '8px 12px', borderRadius: 10,
      border: `1px solid ${accent ? TOKENS.accent : TOKENS.border}`,
      background: accent ? TOKENS.accentSoft : TOKENS.surface,
      color: accent ? TOKENS.accentDeep : TOKENS.ink,
    }}>
      <Icon name={icon} size={14} />
      <div>
        <div style={{ fontSize: 10, fontFamily: "'Geist Mono', ui-monospace, monospace",
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                      color: accent ? TOKENS.accentDeep : TOKENS.muted, opacity: 0.9 }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "'Geist Mono', ui-monospace, monospace",
                      marginTop: 1 }}>{value}</div>
      </div>
    </div>
  );
}

function QueueList({ t, before }) {
  // Build positions: # of "before" entries, then YOU, then a couple after.
  const after = 1;
  const rows = [];
  for (let i = 0; i < before; i++) rows.push({ kind: 'them', n: i + 1 });
  rows.push({ kind: 'you', n: before + 1 });
  for (let i = 0; i < after; i++) rows.push({ kind: 'them', n: before + 2 + i });

  return (
    <div>
      <div style={{ fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: 10,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: TOKENS.muted, marginBottom: 8 }}>
        {t.queueTitle}
      </div>
      <div style={{ border: `1px solid ${TOKENS.border}`, borderRadius: 12, overflow: 'hidden' }}>
        {rows.map((r, i) => {
          const isYou = r.kind === 'you';
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px',
              background: isYou ? TOKENS.surfaceAlt : TOKENS.surface,
              borderBottom: i < rows.length - 1 ? `1px solid ${TOKENS.borderSoft}` : 'none',
            }}>
              <span style={{ fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: 13,
                             color: isYou ? TOKENS.ink : TOKENS.muted, width: 24,
                             fontWeight: isYou ? 600 : 400 }}>
                {String(r.n).padStart(2, '0')}
              </span>
              <span style={{ flex: 1, fontSize: 13,
                             color: isYou ? TOKENS.ink : TOKENS.muted,
                             fontWeight: isYou ? 600 : 400 }}>
                {isYou ? (t.dir === 'rtl' ? 'أنت' : 'Vous') : '— — —'}
              </span>
              {isYou && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
                               fontSize: 11, color: TOKENS.accent }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: TOKENS.accent }} />
                  {t.dir === 'rtl' ? 'هنا' : 'ici'}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { QueueTracker });
