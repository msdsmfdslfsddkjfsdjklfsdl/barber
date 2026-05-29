// barber-app.jsx — glanceable dashboard for the barber's mobile app.
// Shows the current client, today's stats, the queue list, and the
// big workflow actions (Start / Finish / Skip / Pause). New: walk-in compose
// sheet, per-row call action, and a collapsible "Terminés" history.

// Safe service label — handles both { fr, ar } object form (booked) and
// plain string form (walk-ins added via the in-app sheet).
function serviceLabel(item, lang) {
  if (!item || !item.service) return '';
  return typeof item.service === 'object' ? item.service[lang] : item.service;
}

function BarberApp({ lang = 'fr', setLang, density = 'sparse', barberId = 'sofiane',
                    liveBookings = [], barberOverrides = {}, onUpdateProfile }) {
  const t = I18N[lang];
  const baseQueue = QUEUE_BY_DENSITY[density];
  const completed = COMPLETED_BY_DENSITY[density];
  const barber = resolveBarber(barberId, barberOverrides) || BARBERS[1];

  // UI state
  const [walkIns, setWalkIns] = React.useState([]);
  const [walkInOpen, setWalkInOpen] = React.useState(false);
  const [completedOpen, setCompletedOpen] = React.useState(false);
  const [confirmFinishOpen, setConfirmFinishOpen] = React.useState(false);
  const [confirmSkipOpen, setConfirmSkipOpen] = React.useState(false);
  const [toast, setToast] = React.useState(null);   // { id, msg }
  const toastTimerRef = React.useRef(null);
  const showToast = React.useCallback((msg) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ id: Date.now(), msg });
    toastTimerRef.current = setTimeout(() => setToast(null), 2600);
  }, []);

  // Per-row state changes — stores edits the barber makes on individual
  // queue rows: { [rowId]: { kind: 'noshow' | 'cancelled' | 'rescheduled', newTime?: '11:00' } }
  const [rowEdits, setRowEdits] = React.useState({});
  const editFor = (id) => rowEdits[id];
  const setEdit = (id, edit) => setRowEdits(prev => ({ ...prev, [id]: edit }));
  const clearEdit = (id) => setRowEdits(prev => {
    const { [id]: _, ...rest } = prev; return rest;
  });

  // VIP toggle + customer notes — keyed by row id, persist for the session.
  const [vipIds, setVipIds] = React.useState(new Set([2]));    // Yacine M. (id 2) starts flagged as a régulier
  const toggleVip = (id) => setVipIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const [notes, setNotes] = React.useState({ 4: 'Coupe dégradé court, pas de cire' });
  const setNote = (id, text) => setNotes(prev => ({ ...prev, [id]: text }));

  // Which row is currently expanded with its inline action drawer
  const [openRowId, setOpenRowId] = React.useState(null);
  const toggleRow = (id) => setOpenRowId(prev => prev === id ? null : id);

  // Workflow state — wires up Terminer, Passer, Pause
  const [pauseMode, setPauseMode] = React.useState(null);    // null | { kind, label, durationMin?, endsAt? }
  const [pausePanelOpen, setPausePanelOpen] = React.useState(false);
  const [sessionEnded, setSessionEnded] = React.useState(false);    // 'Terminer' hides the in-session card
  const [extraCompleted, setExtraCompleted] = React.useState([]);    // sessions finished in-app this run
  const [pauseExpired, setPauseExpired] = React.useState(false);    // alarm state
  const [overrideInSession, setOverrideInSession] = React.useState(null);    // when barber taps Start on a waiting client
  const [startedIds, setStartedIds] = React.useState(new Set());    // IDs that have been moved to in-session

  // ── Live ticker — only runs when something needs second-by-second updates
  const [now, setNow] = React.useState(() => Date.now());
  const needsTick = true;   // in-session timer + pause countdown both update every second
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [needsTick]);

  // ── Synthetic "session started at" so the in-session timer actually counts up.
  // Baseline = item.startedMinAgo minutes before component mount.
  const sessionStartRef = React.useRef(null);

  // Bookings forwarded from the customer flow for this barber
  const myLive = liveBookings.filter(b => b.barberId === barberId);
  const latestLiveCode = myLive.length ? myLive[myLive.length - 1].code : null;

  const inSessionRaw = baseQueue.find(q => q.status === 'in_session');
  const inSession = sessionEnded ? overrideInSession : (overrideInSession || inSessionRaw);
  const waiting = baseQueue.filter(q => q.status === 'waiting' && !startedIds.has(q.id));
  // Filter out cancelled rows entirely; no-shows + rescheduled stay visible but styled.
  const visibleWaiting = waiting.filter(w => editFor(w.id)?.kind !== 'cancelled');
  const nextUp = visibleWaiting[0];

  // Totals — reflect local edits (finished sessions, no-shows, cancellations)
  const allCompleted = [...completed, ...extraCompleted];
  const doneRevenue = allCompleted.reduce((s, c) => s + c.price, 0);
  const clientsDone = allCompleted.length;
  const cancelledCount = Object.values(rowEdits).filter(e => e.kind === 'cancelled').length;
  const totalClientsToday = allCompleted.length + visibleWaiting.length + (inSession ? 1 : 0)
                          + myLive.length + walkIns.length;

  const queueIsEmpty = !inSession && visibleWaiting.length === 0 && myLive.length === 0 && walkIns.length === 0;

  // Dock handlers — actually do something now
  const requestFinish = () => {
    if (!inSession) return;
    setConfirmFinishOpen(true);    // Show the confirm prompt instead of finishing right away
  };
  const onFinish = () => {
    if (!inSession) return;
    const serviceName = serviceLabel(inSession, lang);
    setExtraCompleted(prev => [...prev, {
      name: inSession.name, service: serviceName, price: inSession.price,
    }]);
    setSessionEnded(true);
    setOverrideInSession(null);    // clear the override so next-up shows
    setConfirmFinishOpen(false);
    showToast(t.toastFinished(inSession.price, t.dzd));
  };
  const onStartNext = (item) => {
    if (!item) return;
    setStartedIds(prev => { const next = new Set(prev); next.add(item.id); return next; });
    setOverrideInSession({ ...item, status: 'in_session', startedMinAgo: 0 });
    setSessionEnded(false);
    if (sessionStartRef.current) {
      sessionStartRef.itemKey = null;    // force timer reset
      sessionStartRef.current = null;
    }
  };
  const onSkip = () => {
    if (inSession || nextUp) setConfirmSkipOpen(true);    // Always confirm first
  };
  // What's actually being skipped + who takes their place
  const skipTarget   = inSession || nextUp;
  const skipReplacer = inSession ? nextUp : visibleWaiting[1];
  const performSkip = () => {
    const targetName = (inSession || nextUp).name;
    if (inSession) {
      setSessionEnded(true);          // current session abandoned (no revenue)
      showToast(t.toastSkipped(targetName));
    } else if (nextUp) {
      setEdit(nextUp.id, { kind: 'noshow' });   // next-up didn’t show
      showToast(t.toastNoShow(targetName));
    }
    setConfirmSkipOpen(false);
  };
  const onPauseToggle = () => {
    if (pauseMode) {
      setPauseMode(null);
      setPauseExpired(false);
      return;
    }
    setPausePanelOpen(o => !o);
  };
  const startPause = (mode) => {
    const withEnd = mode.durationMin
      ? { ...mode, endsAt: Date.now() + mode.durationMin * 60 * 1000 }
      : mode;
    setPauseMode(withEnd);
    setPauseExpired(false);
    setPausePanelOpen(false);
  };

  // Watch the countdown — fire the alarm when it hits zero.
  React.useEffect(() => {
    if (!pauseMode || !pauseMode.endsAt || pauseExpired) return;
    if (now >= pauseMode.endsAt) {
      setPauseExpired(true);
      playAlarm();
    }
  }, [now, pauseMode, pauseExpired]);

  const addWalkIn = ({ name, service }) => {
    setWalkIns(prev => [...prev, {
      id: 'walk-' + (prev.length + 1),
      name, service,
      price: 800, time: 'walk',
      addedAt: Date.now(),
    }]);
    setWalkInOpen(false);
    showToast(t.toastWalkInAdded(name));
  };

  // Tab navigation — 'home' | 'queue' | 'revenue' | 'settings'
  const [activeTab, setActiveTab] = React.useState('home');

  return (
    <div style={{
      fontFamily: t.fontFamily, direction: t.dir, background: TOKENS.paper,
      color: TOKENS.ink, height: '100%', display: 'flex', flexDirection: 'column',
      overflow: 'hidden', position: 'relative',
    }}>
      {/* ── Header (shown on Home + Queue tabs; tab views render their own headers) ─ */}
      {(activeTab === 'home' || activeTab === 'queue') && (
        <div style={{
          padding: '56px 20px 14px', flexShrink: 0, background: TOKENS.surface,
          borderBottom: `1px solid ${TOKENS.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar initials={barber.initials} tint={barber.tint} text={barber.text}
                      size={44} photo={barber.photo} />
              <div>
                <div style={{ fontSize: 11, color: TOKENS.muted, fontWeight: 500,
                              textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {activeTab === 'home' ? (t.dir === 'rtl' ? 'الرئيسية' : 'Accueil')
                                        : (t.dir === 'rtl' ? 'القائمة' : 'File d\'attente')}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 1,
                              letterSpacing: '-0.015em' }}>
                  {barber.name[lang]}
                </div>
              </div>
            </div>
            {/* Availability quick toggle — visible always */}
            <AvailabilityPill t={t}
              value={barber.acceptingBookings !== false}
              onToggle={() => onUpdateProfile && onUpdateProfile(barberId,
                { acceptingBookings: !(barber.acceptingBookings !== false) })} />
          </div>

          {activeTab === 'home' && <DayProgressBar t={t} now={now} />}
        </div>
      )}

      {/* ── Tab content ──────────────────────────────────────────────── */}
      <div key={activeTab} style={{ flex: 1, overflow: 'auto',
                       animation: 'fc-tab-in 240ms cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
        {activeTab === 'home' && (
          <HomeTab t={t} lang={lang} barber={barber} barberId={barberId}
            now={now} doneRevenue={doneRevenue} clientsDone={clientsDone}
            totalClientsToday={totalClientsToday}
            inSession={inSession} nextUp={nextUp} sessionStartRef={sessionStartRef}
            pauseMode={pauseMode} pauseExpired={pauseExpired}
            setPauseMode={setPauseMode} setPauseExpired={setPauseExpired}
            onUpdateProfile={onUpdateProfile} myLive={myLive}
            requestFinish={requestFinish} onSkip={onSkip} onPauseToggle={onPauseToggle}
            onStartNext={onStartNext}
            queueIsEmpty={queueIsEmpty}
            onJumpToQueue={() => setActiveTab('queue')}
            onJumpToRevenue={() => setActiveTab('revenue')}
            onAddWalkIn={() => setWalkInOpen(true)}
            visibleWaiting={visibleWaiting} />
        )}
        {activeTab === 'queue' && (
          <QueueTab t={t} lang={lang} now={now}
            visibleWaiting={visibleWaiting} myLive={myLive} walkIns={walkIns}
            latestLiveCode={latestLiveCode} allCompleted={allCompleted}
            completedOpen={completedOpen} setCompletedOpen={setCompletedOpen}
            openRowId={openRowId} toggleRow={toggleRow}
            editFor={editFor} setEdit={setEdit} clearEdit={clearEdit}
            vipIds={vipIds} toggleVip={toggleVip}
            notes={notes} setNote={setNote}
            showToast={showToast} />
        )}
        {activeTab === 'revenue' && (
          <RevenueTab t={t} lang={lang}
            todayAmount={doneRevenue} todayClients={allCompleted.length} />
        )}
        {activeTab === 'settings' && (
          <SettingsTab t={t} lang={lang} setLang={setLang}
            barber={barber} barberId={barberId} onUpdateProfile={onUpdateProfile} />
        )}
      </div>

      {/* Pause options panel — slides up over the dock when Pause is tapped */}
      {pausePanelOpen && !pauseMode && (
        <PausePanel t={t} onClose={() => setPausePanelOpen(false)} onPick={startPause} />
      )}

      {/* ── Bottom tab bar ──────────────────────────────────────────── */}
      <TabBar t={t} active={activeTab} onChange={setActiveTab} />

      {/* Toast — floats at the top of the app for ~2.6s after each action */}
      {toast && <ToastNotice key={toast.id} t={t} msg={toast.msg} />}

      {/* Walk-in compose sheet */}
      {walkInOpen && (
        <WalkInSheet t={t} onClose={() => setWalkInOpen(false)} onAdd={addWalkIn} />
      )}

      {/* Confirm-finish prompt */}
      {confirmFinishOpen && inSession && (
        <ConfirmFinishSheet t={t} lang={lang} item={inSession}
                            onClose={() => setConfirmFinishOpen(false)}
                            onConfirm={onFinish} />
      )}

      {/* Confirm-skip prompt */}
      {confirmSkipOpen && skipTarget && (
        <ConfirmSkipSheet t={t} lang={lang} item={skipTarget} replacer={skipReplacer}
                          onClose={() => setConfirmSkipOpen(false)}
                          onConfirm={performSkip} />
      )}

      <style>{`
        @keyframes fc-tab-in {
          from { transform: translateY(6px); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Tab bar
// ────────────────────────────────────────────────────────────────────────
function TabBar({ t, active, onChange }) {
  const items = [
    { id: 'home',     icon: 'home',     label: t.dir === 'rtl' ? 'الرئيسية' : 'Accueil' },
    { id: 'queue',    icon: 'list',     label: t.dir === 'rtl' ? 'القائمة'  : 'File' },
    { id: 'revenue',  icon: 'chart',    label: t.dir === 'rtl' ? 'الدخل'    : 'Revenus' },
    { id: 'settings', icon: 'settings', label: t.dir === 'rtl' ? 'الإعدادات': 'Réglages' },
  ];
  return (
    <div style={{
      flexShrink: 0, background: TOKENS.surface,
      borderTop: `1px solid ${TOKENS.border}`,
      padding: '8px 8px 22px',
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4,
    }}>
      {items.map(it => {
        const on = active === it.id;
        return (
          <button key={it.id} onClick={() => onChange(it.id)} style={{
            appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
            background: 'transparent', border: 'none',
            padding: '8px 4px', borderRadius: 12,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            color: on ? TOKENS.accent : TOKENS.muted,
          }}>
            <Icon name={it.icon} size={22} stroke={on ? 2.2 : 1.8} />
            <span style={{ fontSize: 11, fontWeight: on ? 600 : 500 }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Tab views
// ────────────────────────────────────────────────────────────────────────
function HomeTab({ t, lang, barber, barberId, now, doneRevenue, clientsDone, totalClientsToday,
                   inSession, nextUp, sessionStartRef, pauseMode, pauseExpired,
                   setPauseMode, setPauseExpired, onUpdateProfile, myLive,
                   requestFinish, onSkip, onPauseToggle, onStartNext, queueIsEmpty,
                   onJumpToQueue, onJumpToRevenue, onAddWalkIn, visibleWaiting = [] }) {
  return (
    <div style={{ padding: '24px 20px 24px' }}>
      {/* Critical banners only */}
      {pauseMode && (
        <PauseBanner t={t} mode={pauseMode} now={now} expired={pauseExpired}
                     onResume={() => { setPauseMode(null); setPauseExpired(false); }} />
      )}
      {barber.acceptingBookings === false && !pauseMode && (
        <BookingsClosedBanner t={t}
          onReopen={() => onUpdateProfile && onUpdateProfile(barberId, { acceptingBookings: true })} />
      )}

      {/* A booking just arrived from the customer flow — announce it on Home */}
      {myLive.length > 0 && (
        <LiveBookingsBanner t={t} count={myLive.length} latest={myLive[myLive.length - 1]} />
      )}

      {/* ── Hero: current customer + circular timer ───────────────── */}
      {inSession && (
        <>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: TOKENS.accent, fontWeight: 600,
                          marginBottom: 8, letterSpacing: '-0.005em' }}>
              {t.dir === 'rtl' ? 'الزبون الحالي' : 'Client actuel'}
            </div>
            <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.025em',
                         margin: 0, color: TOKENS.ink }}>
              {inSession.name}
            </h1>
            <div style={{ fontSize: 14, color: TOKENS.muted, marginTop: 6 }}>
              {serviceLabel(inSession, lang)}
            </div>
          </div>
          <CircularTimer item={inSession} now={now} sessionStartRef={sessionStartRef} t={t} />

          {/* Two action buttons: Call (secondary) + Finish (primary) */}
          <div style={{ display: 'flex', gap: 10, marginTop: 24, marginBottom: 28 }}>
            <button onClick={onSkip} style={{
              appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
              flex: 1, height: 56, borderRadius: 14, paddingInline: 14,
              background: TOKENS.surface, color: TOKENS.ink,
              borderWidth: 1, borderStyle: 'solid', borderColor: TOKENS.border,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontSize: 14, fontWeight: 600,
            }}>
              <Icon name="skip" size={16} />
              <span>{t.skip}</span>
            </button>
            <button onClick={requestFinish} style={{
              appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
              flex: 1.4, height: 56, borderRadius: 14, paddingInline: 14,
              background: TOKENS.accent, color: '#fff', border: 'none',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontSize: 15, fontWeight: 700,
            }}>
              <Icon name="check" size={16} stroke={2.4} />
              <span>{t.dir === 'rtl' ? 'إنهاء الزبون' : 'Terminer'}</span>
            </button>
          </div>
        </>
      )}

      {/* ── Next customer ─────────────────────────────────────────── */}
      {nextUp && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: TOKENS.muted, fontWeight: 600,
                        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
                        textAlign: t.dir === 'rtl' ? 'end' : 'start' }}>
            {t.nextUp}
          </div>
          <div style={{ background: TOKENS.surface, borderRadius: 16,
                        padding: '14px 16px',
                        display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%',
                          background: TOKENS.accentSoft, color: TOKENS.accent,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 18, fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
              {inSession ? 2 : 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{nextUp.name}</div>
              <div style={{ fontSize: 13, color: TOKENS.muted, marginTop: 3 }}>
                {serviceLabel(nextUp, lang)}
              </div>
              {nextUp.walkIn && (
                <span style={{ display: 'inline-block', marginTop: 6,
                               fontSize: 10, fontWeight: 600,
                               padding: '3px 8px', borderRadius: 6,
                               background: TOKENS.surfaceAlt, color: TOKENS.muted,
                               letterSpacing: '0.04em' }}>WALK-IN</span>
              )}
            </div>
            <button onClick={() => onStartNext && onStartNext(nextUp)} style={{
              appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
              height: 44, paddingInline: 16, borderRadius: 12,
              background: TOKENS.accent, color: '#fff', border: 'none',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 14, fontWeight: 700, flexShrink: 0,
            }}>
              <Icon name="play" size={12} />
              <span>{t.start}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Small queue preview ─────────────────────────────────── */}
      {visibleWaiting.length > 1 && (
        <div style={{ marginBottom: 20 }}>
          <button onClick={onJumpToQueue} style={{
            appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
            width: '100%', background: 'transparent', border: 'none', padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 10,
          }}>
            <span style={{ fontSize: 12, color: TOKENS.muted, fontWeight: 600,
                           textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t.dir === 'rtl' ? 'قائمة الانتظار' : 'File d\'attente'}
            </span>
            <span style={{ fontSize: 13, color: TOKENS.muted, fontWeight: 500 }}>
              {visibleWaiting.length - 1}
            </span>
          </button>
          <div style={{ background: TOKENS.surface, borderRadius: 16, overflow: 'hidden' }}>
            {visibleWaiting.slice(1, 4).map((it, i, arr) => (
              <button key={it.id} onClick={onJumpToQueue} style={{
                appearance: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'start',
                width: '100%', background: 'transparent', border: 'none',
                padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 14,
                color: TOKENS.ink,
                borderBottom: i < arr.length - 1 ? `1px solid ${TOKENS.borderSoft}` : 'none',
              }}>
                <span style={{ width: 32, height: 32, borderRadius: '50%',
                               background: TOKENS.surfaceAlt, color: TOKENS.muted,
                               display: 'flex', alignItems: 'center', justifyContent: 'center',
                               fontSize: 13, fontWeight: 600,
                               fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                  {inSession ? i + 3 : i + 2}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{it.name}</div>
                  <div style={{ fontSize: 12, color: TOKENS.muted, marginTop: 2 }}>
                    {serviceLabel(it, lang)}
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600,
                               color: it.walkIn ? TOKENS.muted : TOKENS.accent,
                               letterSpacing: '0.04em' }}>
                  {it.walkIn ? 'WALK-IN'
                             : (t.dir === 'rtl' ? 'حجز مسبق' : 'Réservé')}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Large "+ Add walk-in" CTA ───────────────────────────── */}
      <button onClick={onAddWalkIn} style={{
        appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
        width: '100%', height: 60, borderRadius: 16,
        background: TOKENS.accent, color: '#fff', border: 'none',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        fontSize: 15, fontWeight: 700,
      }}>
        <span>{t.dir === 'rtl' ? 'إضافة زبون بدون حجز' : 'Ajouter un walk-in'}</span>
        <Icon name="plus" size={16} stroke={2.4} />
      </button>

      {queueIsEmpty && !inSession && (
        <EmptyState t={t} doneRevenue={doneRevenue} doneCount={clientsDone} />
      )}
    </div>
  );
}

// Circular session timer — counts UP from 00:00 from the moment the
// customer is seated. Resets cleanly when a new customer takes the chair.
function CircularTimer({ item, now, sessionStartRef, t }) {
  if (sessionStartRef.itemKey !== item.id) {
    sessionStartRef.itemKey = item.id;
    // Honor the client's head start (startedMinAgo) so an in-progress session
    // shows real elapsed time instead of 00:00; freshly started clients pass 0.
    sessionStartRef.current = Date.now() - (item.startedMinAgo || 0) * 60 * 1000;
  }
  const elapsedSec = Math.floor((now - sessionStartRef.current) / 1000);
  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
  const ss = String(elapsedSec % 60).padStart(2, '0');

  // Time when the session was started (HHhMM)
  const startD = new Date(sessionStartRef.current);
  const startLabel = `${String(startD.getHours()).padStart(2, '0')}h${String(startD.getMinutes()).padStart(2, '0')}`;

  // Decorative ring — slowly fills over 30 min for visual rhythm, never "overflows"
  const visualPct = Math.min(1, elapsedSec / (30 * 60));

  const size = 220, stroke = 8, r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - visualPct);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 0' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
             style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r}
                  stroke={TOKENS.surface} strokeWidth={stroke} fill="none" />
          <circle cx={size/2} cy={size/2} r={r}
                  stroke={TOKENS.accent}
                  strokeWidth={stroke} fill="none"
                  strokeLinecap="round"
                  strokeDasharray={circ}
                  strokeDashoffset={offset}
                  style={{ transition: 'stroke-dashoffset 800ms linear' }} />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ fontSize: 12, color: TOKENS.muted, fontWeight: 500, marginBottom: 4 }}>
            {t.dir === 'rtl' ? 'مدّة الجلسة' : 'Durée de la session'}
          </div>
          <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: '-0.04em',
                        fontVariantNumeric: 'tabular-nums', color: TOKENS.ink }}>
            {mm}:{ss}
          </div>
          <div style={{ fontSize: 12, color: TOKENS.muted, fontWeight: 500, marginTop: 4 }}>
            {t.dir === 'rtl' ? 'بدأ على' : 'Commencé à'} {startLabel}
          </div>
        </div>
      </div>
    </div>
  );
}

function QueueTab({ t, lang, now, visibleWaiting, myLive, walkIns, latestLiveCode,
                    allCompleted, completedOpen, setCompletedOpen,
                    openRowId, toggleRow, editFor, setEdit, clearEdit,
                    vipIds, toggleVip, notes, setNote, showToast }) {
  const total = visibleWaiting.length + myLive.length + walkIns.length;
  return (
    <div style={{ padding: '16px 18px 24px' }}>
      <SectionLabel t={t} text={t.upcoming} count={total} />
      {total === 0 ? (
        <EmptyState t={t} />
      ) : (
        <div style={{ borderWidth: 1, borderStyle: 'solid', borderColor: TOKENS.border,
                      borderRadius: 14, overflow: 'hidden', background: TOKENS.surface }}>
          {visibleWaiting.map((it, i) => (
            <QueueRow key={it.id} item={it} t={t} lang={lang} now={now}
                      edit={editFor(it.id)}
                      vip={vipIds.has(it.id)} note={notes[it.id]}
                      open={openRowId === it.id}
                      onToggle={() => toggleRow(it.id)}
                      onToggleVip={() => toggleVip(it.id)}
                      onSetNote={(text) => setNote(it.id, text)}
                      onReschedule={(newTime) => {
                        setEdit(it.id, { kind: 'rescheduled', newTime });
                        showToast(t.toastRescheduled(it.name, newTime.replace(':', 'h')));
                      }}
                      onNoShow={() => {
                        setEdit(it.id, { kind: 'noshow' });
                        showToast(t.toastNoShow(it.name));
                      }}
                      onCancel={() => {
                        setEdit(it.id, { kind: 'cancelled' });
                        showToast(t.toastCancelled(it.name));
                      }}
                      onUndo={() => { clearEdit(it.id); showToast(t.toastUndone); }}
                      last={i === visibleWaiting.length - 1 && myLive.length === 0 && walkIns.length === 0} index={i + 1} />
          ))}
          {myLive.map((b, i) => (
            <LiveBookingRow key={b.code} item={b} t={t} lang={lang}
                            index={visibleWaiting.length + i + 1}
                            isLatest={b.code === latestLiveCode}
                            last={i === myLive.length - 1 && walkIns.length === 0} />
          ))}
          {walkIns.map((w, i) => (
            <WalkInRow key={w.id} item={w} t={t} lang={lang}
                       index={visibleWaiting.length + myLive.length + i + 1}
                       last={i === walkIns.length - 1} />
          ))}
        </div>
      )}

      {allCompleted.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <button onClick={() => setCompletedOpen(o => !o)} style={{
            appearance: 'none', width: '100%', cursor: 'pointer', fontFamily: 'inherit',
            padding: '10px 4px', background: 'transparent', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            color: TOKENS.inkSoft, fontSize: 13, fontWeight: 500,
          }}>
            <span>{t.completedToday(allCompleted.length)}</span>
            <span style={{ transform: completedOpen ? 'rotate(180deg)' : 'rotate(0)',
                           transition: 'transform 160ms ease',
                           display: 'flex', alignItems: 'center', color: TOKENS.muted }}>
              <Icon name="chevron-right" size={14} style={{ transform: 'rotate(90deg)' }} />
            </span>
          </button>
          {completedOpen && (
            <div style={{ borderWidth: 1, borderStyle: 'solid', borderColor: TOKENS.border,
                          borderRadius: 12, overflow: 'hidden', background: TOKENS.surface }}>
              {allCompleted.map((c, i) => (
                <CompletedRow key={i} item={c} t={t} last={i === allCompleted.length - 1} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RevenueTab({ t, lang, todayAmount, todayClients }) {
  return <RevenueScreen embedded t={t} lang={lang}
                        todayAmount={todayAmount} todayClients={todayClients} />;
}

function SettingsTab({ t, lang, setLang, barber, barberId, onUpdateProfile }) {
  return <SettingsSheet embedded t={t} lang={lang} setLang={setLang}
                         barber={barber} barberId={barberId}
                         onUpdateProfile={onUpdateProfile} />;
}

// ────────────────────────────────────────────────────────────────────────
// Subviews
// ────────────────────────────────────────────────────────────────────────
function SectionLabel({ t, text, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                  marginBottom: 12 }}>
      <span style={{ fontSize: 14, color: TOKENS.ink, fontWeight: 600,
                     letterSpacing: '-0.005em' }}>{text}</span>
      {typeof count === 'number' && count > 0 && (
        <span style={{ fontSize: 13, color: TOKENS.muted, fontWeight: 500 }}>
          {count}
        </span>
      )}
    </div>
  );
}

function InSessionCard({ t, lang, item, now, sessionStartRef, nextUp }) {
  // Reset the synthetic start when the in-session customer changes
  if (sessionStartRef.itemKey !== item.id) {
    sessionStartRef.itemKey = item.id;
    sessionStartRef.current = Date.now() - (item.startedMinAgo || 0) * 60 * 1000;
  }
  const elapsedSec = Math.floor((now - sessionStartRef.current) / 1000);
  const expectedSec = 30 * 60;
  const isOver = elapsedSec > expectedSec;
  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
  const ss = String(elapsedSec % 60).padStart(2, '0');
  const pct = Math.min(100, (elapsedSec / expectedSec) * 100);

  // Estimated finish: based on the booked time (so the demo stays believable
  // even though the live timer uses wall-clock); booked time + 30 min.
  const [bh, bm] = item.time.split(':').map(Number);
  const finishTotalMin = bh * 60 + bm + 30;
  const finishLabel = `${String(Math.floor(finishTotalMin / 60)).padStart(2, '0')}h${String(finishTotalMin % 60).padStart(2, '0')}`;

  return (
    <div style={{
      borderRadius: 18, background: TOKENS.surfaceAlt, color: TOKENS.ink,
      padding: '18px 18px 16px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 14 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
                       height: 24, padding: '0 10px', borderRadius: 999,
                       background: 'rgba(255,255,255,0.12)',
                       fontSize: 12, fontWeight: 500 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#5DE39A',
                         animation: 'fc-pulse 1.8s ease-in-out infinite' }} />
          {t.inSessionLabel}
        </span>
        {/* Live elapsed timer + estimated finish time */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
                      gap: 2 }}>
          <span style={{ fontFamily: "'Geist Mono', ui-monospace, monospace",
                         fontSize: 24, fontWeight: 600,
                         letterSpacing: '-0.01em', lineHeight: 1,
                         color: isOver ? '#FF6B5C' : '#fff',
                         fontVariantNumeric: 'tabular-nums' }}>
            {mm}:{ss}
            {isOver && <span style={{ marginInlineStart: 6, fontSize: 11, fontWeight: 500,
                                      opacity: 0.85 }}>{t.overTime}</span>}
          </span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
            {t.estimatedFinish} {finishLabel}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <Avatar initials={item.name.split(' ').map(s => s[0]).join('')}
                tint="rgba(255,255,255,0.12)" text="#fff" size={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.005em' }}>
            {item.name}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 3 }}>
            {item.time} · {serviceLabel(item, lang)}
          </div>
        </div>
        <div style={{ textAlign: t.dir === 'rtl' ? 'left' : 'right',
                      fontSize: 17, fontWeight: 600 }}>
          {item.price} <span style={{ fontSize: 11, opacity: 0.6 }}>{t.dzd}</span>
        </div>
      </div>

      {/* elapsed bar */}
      <div style={{ height: 4, background: 'rgba(255,255,255,0.10)', borderRadius: 999,
                    overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%',
                      background: isOver ? '#FF6B5C' : '#5DE39A',
                      borderRadius: 999, transition: 'width 800ms linear' }} />
      </div>

      {/* Next customer preview — quick glance at who's after */}
      {nextUp && (
        <div style={{ marginTop: 14, paddingTop: 12,
                      borderTop: '1px solid rgba(255,255,255,0.08)',
                      display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 500,
                         textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
            {t.suivantOn}
          </span>
          <span style={{ flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 500,
                         whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {nextUp.name}
          </span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)',
                         fontVariantNumeric: 'tabular-nums' }}>
            {nextUp.time.replace(':', 'h')}
          </span>
        </div>
      )}
    </div>
  );
}

function NextUpCard({ t, lang, item }) {
  return (
    <div style={{
      border: `1px solid ${TOKENS.border}`, borderRadius: 14, background: TOKENS.surface,
      padding: '14px 14px', display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%',
                    background: TOKENS.surfaceAlt, color: TOKENS.ink,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 600, fontSize: 17, letterSpacing: '-0.02em' }}>
        2
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{item.name}</span>
          {item.walkIn && <Tag t={t} kind="walkin">{t.walkIn}</Tag>}
        </div>
        <div style={{ fontSize: 13, color: TOKENS.inkSoft, marginTop: 3 }}>
          {item.time} · {serviceLabel(item, lang)} · {item.price} {t.dzd}
        </div>
      </div>
      <button style={{
        height: 44, padding: '0 16px', borderRadius: 12,
        background: TOKENS.accent, color: '#fff', border: 'none',
        fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 6,
      }}>
        <Icon name="play" size={12} />
        {t.start}
      </button>
    </div>
  );
}

function QueueRow({ item, t, lang, last, index, edit, open, onToggle, vip, note, now,
                    onReschedule, onNoShow, onCancel, onUndo, onToggleVip, onSetNote }) {
  const isNoShow      = edit?.kind === 'noshow';
  const isRescheduled = edit?.kind === 'rescheduled';
  const hasEdit       = !!edit;

  // Late detection — true when the scheduled time has already passed
  const [h, m] = item.time.split(':').map(Number);
  const nowDate = now ? new Date(now) : new Date();
  const scheduledMs = new Date(nowDate); scheduledMs.setHours(h, m, 0, 0);
  const lateMin = !hasEdit ? Math.floor((nowDate.getTime() - scheduledMs.getTime()) / 60000) : 0;
  const isLate = lateMin > 0 && lateMin < 180;   // late but not yesterday

  const addMin = (delta) => {
    const total = h * 60 + m + delta;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  };

  const [rescheduleOpen, setRescheduleOpen] = React.useState(false);
  const [noteOpen, setNoteOpen]             = React.useState(false);
  const [noteDraft, setNoteDraft]           = React.useState(note || '');
  // Reset disclosures when the row collapses
  React.useEffect(() => {
    if (!open) { setRescheduleOpen(false); setNoteOpen(false); }
    setNoteDraft(note || '');
  }, [open, note]);

  return (
    <div style={{
      borderBottom: last ? 'none' : `1px solid ${TOKENS.borderSoft}`,
      background: open ? TOKENS.surfaceAlt : 'transparent',
      transition: 'background 120ms ease',
      animation: 'fc-row-in 280ms cubic-bezier(0.2, 0.8, 0.2, 1)',
      position: 'relative',
    }}>
      {/* Subtle amber accent stripe when late */}
      {isLate && !hasEdit && (
        <span style={{ position: 'absolute', insetInlineStart: 0, top: 8, bottom: 8,
                       width: 2, borderRadius: 2, background: TOKENS.amber }} />
      )}

      {/* Main row — tap to expand */}
      <button onClick={onToggle} style={{
        appearance: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'start',
        width: '100%', border: 'none', background: 'transparent',
        display: 'flex', alignItems: 'center', gap: 14, padding: '16px 16px',
        color: TOKENS.ink, opacity: isNoShow ? 0.55 : 1,
      }}>
        <span style={{ fontSize: 15, color: TOKENS.muted, width: 22, fontWeight: 500,
                       fontVariantNumeric: 'tabular-nums' }}>
          {String(index).padStart(2, '0')}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {vip && (
              <Icon name="star" size={14} style={{ color: '#E0A93B', flexShrink: 0 }} />
            )}
            <span style={{ fontSize: 16, fontWeight: 600,
                           textDecoration: isNoShow ? 'line-through' : 'none' }}>
              {item.name}
            </span>
            {item.walkIn      && <Tag kind="walkin">{t.walkIn}</Tag>}
            {isNoShow         && <Tag kind="warn">{t.noShowLabel}</Tag>}
            {isRescheduled    && <Tag kind="info">→ {edit.newTime}</Tag>}
            {isLate && !hasEdit && (
              <span style={{ fontSize: 11, color: TOKENS.amber, fontWeight: 600 }}>
                {t.lateBy(lateMin)}
              </span>
            )}
          </div>
          {note && !open && (
            <div style={{ fontSize: 12, color: TOKENS.inkSoft, marginTop: 4,
                          display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="edit" size={11} style={{ color: TOKENS.muted, flexShrink: 0 }} />
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {note}
              </span>
            </div>
          )}
        </div>
        <span style={{ fontSize: 15, color: TOKENS.muted, fontWeight: 500,
                       fontVariantNumeric: 'tabular-nums',
                       textDecoration: isRescheduled ? 'line-through' : 'none' }}>
          {item.time.replace(':', 'h')}
        </span>
      </button>

      {/* Inline action drawer — only when this row is open */}
      {open && (
        <div style={{ padding: '0 16px 16px',
                      display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Customer detail line (only visible when expanded) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingInlineStart: 36,
                        fontSize: 13, color: TOKENS.inkSoft, marginTop: -4 }}>
            <span>{serviceLabel(item, lang)}</span>
            <span style={{ color: TOKENS.faint }}>·</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{item.phone}</span>
          </div>

          {hasEdit ? (
            <RowActionBtn icon="check" label={t.undo} onClick={onUndo} full />
          ) : rescheduleOpen ? (
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => onReschedule(addMin(30))} style={chipStyle()}>
                  <span>+30 {t.min}</span>
                </button>
                <button onClick={() => onReschedule(addMin(60))} style={chipStyle()}>
                  <span>+1 {t.h}</span>
                </button>
                <button onClick={() => onReschedule(addMin(120))} style={chipStyle()}>
                  <span>+2 {t.h}</span>
                </button>
              </div>
              <RowActionBtn icon="chevron-left" label={t.confirmSkipKeep}
                            onClick={() => setRescheduleOpen(false)} full />
            </>
          ) : noteOpen ? (
            <>
              <input value={noteDraft} onChange={e => setNoteDraft(e.target.value)}
                     placeholder={t.notePlaceholder} autoFocus style={{
                width: '100%', height: 48, borderRadius: 12, paddingInline: 14,
                border: `1px solid ${TOKENS.border}`, background: TOKENS.surface,
                fontFamily: 'inherit', fontSize: 14, color: TOKENS.ink, outline: 'none',
                direction: t.dir,
              }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <RowActionBtn icon="chevron-left" label={t.confirmSkipKeep}
                              onClick={() => setNoteOpen(false)} />
                <button onClick={() => { onSetNote(noteDraft.trim()); setNoteOpen(false); }} style={{
                  appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  flex: 1, height: 48, borderRadius: 12,
                  background: TOKENS.accent, color: TOKENS.paper, border: 'none',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  fontSize: 13, fontWeight: 700,
                }}>
                  <Icon name="check" size={14} stroke={2.4} />
                  {t.saveNote}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Quick toggles: VIP + Note */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={onToggleVip} style={{
                  ...chipStyle(),
                  background: vip ? '#F6EBD2' : TOKENS.surface,
                  color: vip ? '#7A5B1F' : TOKENS.ink,
                  borderColor: vip ? '#E0A93B66' : TOKENS.border,
                  gap: 6,
                }}>
                  <Icon name="star" size={13} style={{ color: vip ? '#E0A93B' : TOKENS.muted }} />
                  <span>{vip ? t.unmarkVip : t.markVip}</span>
                </button>
                <button onClick={() => setNoteOpen(true)} style={{
                  ...chipStyle(),
                  background: note ? TOKENS.accentSoft : TOKENS.surface,
                  color: note ? TOKENS.accentDeep : TOKENS.ink,
                  borderColor: note ? `${TOKENS.accent}33` : TOKENS.border,
                  gap: 6,
                }}>
                  <Icon name="edit" size={13} />
                  <span>{note ? (t.dir === 'rtl' ? 'تعديل الملاحظة' : 'Modifier la note') : t.addNote}</span>
                </button>
              </div>

              {/* 2×2 action grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <RowActionBtn icon="phone" label={t.callCustomer} onClick={() => { window.location.href = 'tel:+213555010101'; }} />
                <RowActionBtn icon="clock" label={t.rescheduleAction}
                              onClick={() => setRescheduleOpen(true)} />
                <RowActionBtn icon="skip"  label={t.markNoShow}        onClick={onNoShow} kind="warn" />
                <RowActionBtn icon="more"  label={t.cancelBookingAction} onClick={onCancel} kind="danger" />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function chipStyle() {
  return {
    appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
    flex: 1, height: 48, borderRadius: 12,
    background: TOKENS.surface, color: TOKENS.ink,
    borderWidth: 1, borderStyle: 'solid', borderColor: TOKENS.border,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, fontWeight: 500,
  };
}

function RowActionBtn({ icon, label, onClick, kind = 'default', full }) {
  const colors = {
    default: { bg: TOKENS.surface, fg: TOKENS.ink,    border: TOKENS.border },
    warn:    { bg: TOKENS.surface, fg: TOKENS.amber,  border: TOKENS.border },
    danger:  { bg: TOKENS.surface, fg: TOKENS.red,    border: TOKENS.border },
  };
  const c = colors[kind] || colors.default;
  return (
    <button onClick={onClick} style={{
      appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
      width: full ? '100%' : 'auto', height: 48, borderRadius: 12, paddingInline: 12,
      background: c.bg, color: c.fg, border: `1px solid ${c.border}`,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      fontSize: 13, fontWeight: 500,
    }}>
      <Icon name={icon} size={15} />
      <span>{label}</span>
    </button>
  );
}

function LiveBookingRow({ item, t, lang, last, index, isLatest }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
      borderBottom: last ? 'none' : `1px solid ${TOKENS.borderSoft}`,
      background: isLatest ? `${TOKENS.accent}0A` : 'transparent',
      position: 'relative',
    }}>
      {/* leading accent stripe for fresh entries */}
      <span style={{ position: 'absolute', insetInlineStart: 0, top: 8, bottom: 8,
                     width: 2, borderRadius: 2, background: TOKENS.accent }} />
      <span style={{ fontSize: 13, color: TOKENS.faint, width: 22, fontWeight: 500 }}>
        {String(index).padStart(2, '0')}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 500 }}>{item.name}</span>
          <Tag t={t} kind="new">{t.newTag}</Tag>
        </div>
        <div style={{ fontSize: 12, color: TOKENS.muted, marginTop: 3,
                      display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{item.time}</span>
          <span style={{ color: TOKENS.faint }}>·</span>
          <span>{serviceLabel(item, lang)}</span>
          <span style={{ color: TOKENS.faint }}>·</span>
          <span style={{ fontFamily: "'Geist Mono', ui-monospace, monospace" }}>{item.code}</span>
        </div>
      </div>
      <CallButton t={t} />
    </div>
  );
}

function WalkInRow({ item, t, lang, last, index }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
      borderBottom: last ? 'none' : `1px solid ${TOKENS.borderSoft}`,
    }}>
      <span style={{ fontSize: 13, color: TOKENS.faint, width: 22, fontWeight: 500 }}>
        {String(index).padStart(2, '0')}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 500 }}>{item.name}</span>
          <Tag t={t} kind="walkin">{t.walkIn}</Tag>
        </div>
        <div style={{ fontSize: 12, color: TOKENS.muted, marginTop: 3 }}>
          {item.service} · {item.price} {t.dzd}
        </div>
      </div>
    </div>
  );
}

function CompletedRow({ item, t, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
      borderBottom: last ? 'none' : `1px solid ${TOKENS.borderSoft}`,
    }}>
      <span style={{ width: 22, height: 22, borderRadius: '50%', background: TOKENS.accentSoft,
                     display: 'flex', alignItems: 'center', justifyContent: 'center',
                     color: TOKENS.accent, flexShrink: 0 }}>
        <Icon name="check" size={12} stroke={2.4} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: TOKENS.inkSoft }}>{item.name}</div>
        <div style={{ fontSize: 12, color: TOKENS.muted, marginTop: 2 }}>{item.service}</div>
      </div>
      <span style={{ fontSize: 13, color: TOKENS.muted }}>
        {item.price} {t.dzd}
      </span>
    </div>
  );
}

function CallButton({ t }) {
  return (
    <button onClick={() => { window.location.href = 'tel:+213555010101'; }}
            aria-label={t.callCustomer} style={{
      appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
      width: 36, height: 36, borderRadius: 10,
      background: TOKENS.surface, color: TOKENS.ink,
      border: `1px solid ${TOKENS.border}`,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }} title={t.callCustomer}>
      <Icon name="phone" size={15} />
    </button>
  );
}

function Tag({ children, kind = 'walkin' }) {
  const styles = {
    walkin: { bg: TOKENS.amberSoft, fg: TOKENS.amber },
    new:    { bg: TOKENS.accentSoft, fg: TOKENS.accentDeep },
    warn:   { bg: TOKENS.redSoft, fg: TOKENS.red },
    info:   { bg: '#E6EEF6', fg: '#1E40AF' },
  };
  const s = styles[kind] || styles.walkin;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', height: 18,
                   padding: '0 7px', borderRadius: 4, background: s.bg, color: s.fg,
                   fontSize: 10, fontWeight: 600, letterSpacing: '0.04em',
                   textTransform: 'uppercase' }}>
      {children}
    </span>
  );
}

function DockButton({ icon, label, onClick, variant = 'secondary', disabled, prominent }) {
  const map = {
    primary:   { bg: TOKENS.accent,  fg: TOKENS.paper, border: 'none' },
    accent:    { bg: TOKENS.accent,  fg: TOKENS.paper, border: 'none' },
    secondary: { bg: TOKENS.surface, fg: TOKENS.ink,   border: `1px solid ${TOKENS.border}` },
  };
  const c = map[variant];
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled} style={{
      appearance: 'none', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
      height: prominent ? 68 : 64, borderRadius: 16, padding: '0 8px',
      background: c.bg, color: c.fg, border: c.border,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 4,
      opacity: disabled ? 0.4 : 1,
      transition: 'opacity 120ms ease',
    }}>
      <Icon name={icon} size={prominent ? 22 : 20} />
      <span style={{ fontSize: prominent ? 13 : 12, fontWeight: prominent ? 600 : 500 }}>{label}</span>
    </button>
  );
}

function EmptyState({ t, doneRevenue = 0, doneCount = 0 }) {
  const celebrate = doneCount > 0;
  return (
    <div style={{ padding: '40px 20px', textAlign: 'center' }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%',
                    background: celebrate ? TOKENS.accentSoft : TOKENS.surfaceAlt,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: celebrate ? TOKENS.accent : TOKENS.muted, margin: '0 auto 16px' }}>
        <Icon name="check" size={32} stroke={2.4} />
      </div>
      <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.01em' }}>
        {celebrate ? t.dayDoneTitle : t.emptyQueueTitle}
      </div>
      <div style={{ fontSize: 14, color: TOKENS.inkSoft, marginTop: 8, lineHeight: 1.45,
                    maxWidth: 280, marginInline: 'auto' }}>
        {celebrate ? t.dayDoneSub(doneCount, doneRevenue, t.dzd) : t.emptyQueueSub}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Live-booking banner
// ────────────────────────────────────────────────────────────────────────
function LiveBookingsBanner({ t, count, latest }) {
  return (
    <div style={{
      marginBottom: 14, padding: '12px 14px',
      borderRadius: 12, border: `1px solid ${TOKENS.accent}33`,
      background: TOKENS.accentSoft, color: TOKENS.accentDeep,
      display: 'flex', alignItems: 'center', gap: 12,
      animation: 'fc-pulse-in 320ms ease-out',
    }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%',
                    background: TOKENS.accent, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0 }}>
        <Icon name="plus" size={14} stroke={2.2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>
          {typeof t.newBookingBanner === 'function' ? t.newBookingBanner(count) : t.newBookingBanner}
        </div>
        <div style={{ fontSize: 12, color: TOKENS.accentDeep, opacity: 0.8, marginTop: 2,
                      display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{latest.time}</span>
          <span style={{ opacity: 0.6 }}>·</span>
          <span>{latest.name}</span>
          <span style={{ opacity: 0.6 }}>·</span>
          <span style={{ fontFamily: "'Geist Mono', ui-monospace, monospace" }}>{latest.code}</span>
        </div>
      </div>
      <div style={{ fontSize: 11, color: TOKENS.accentDeep, opacity: 0.6 }}>
        {t.justNow}
      </div>
      <style>{`@keyframes fc-pulse-in {
        0% { transform: translateY(-6px); opacity: 0; }
        100% { transform: translateY(0); opacity: 1; }
      }`}</style>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Walk-in compose sheet
// ────────────────────────────────────────────────────────────────────────
function WalkInSheet({ t, onClose, onAdd }) {
  const [name, setName] = React.useState('');
  const [service, setService] = React.useState(t.dir === 'rtl' ? 'فيد' : 'Fade');
  const services = t.dir === 'rtl'
    ? ['فيد', 'قصة + لحية', 'قصة كلاسيكية', 'لحية', 'قصة طفل']
    : ['Fade', 'Coupe + barbe', 'Coupe classique', 'Barbe', 'Coupe enfant'];
  const canAdd = name.trim().length >= 2;

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      background: 'rgba(0,0,0,0.4)',
      animation: 'fc-fade-in 180ms ease-out',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: TOKENS.surface, padding: '20px 22px 22px',
        borderRadius: '20px 20px 0 0',
        animation: 'fc-slide-up 260ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        direction: t.dir,
      }}>
        {/* Grabber */}
        <div style={{ width: 36, height: 4, borderRadius: 999, background: TOKENS.border,
                      margin: '0 auto 16px' }} />

        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.015em' }}>
          {t.walkInTitle}
        </h2>
        <div style={{ fontSize: 14, color: TOKENS.inkSoft, marginTop: 6, marginBottom: 20 }}>
          {t.walkInSub}
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t.walkInNamePh}</div>
          <input value={name} onChange={e => setName(e.target.value)}
                 placeholder={t.namePlaceholder} autoFocus
                 style={{
                   width: '100%', height: 56, borderRadius: 12, paddingInline: 16,
                   border: `1px solid ${TOKENS.border}`, background: TOKENS.surface,
                   fontFamily: 'inherit', fontSize: 16, fontWeight: 500, color: TOKENS.ink,
                   outline: 'none', direction: t.dir,
                 }} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t.walkInServicePh}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {services.map(s => (
              <button key={s} onClick={() => setService(s)} style={{
                appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
                height: 40, paddingInline: 14, borderRadius: 999,
                background: service === s ? TOKENS.ink : TOKENS.surface,
                color: service === s ? '#fff' : TOKENS.ink,
                border: `1px solid ${service === s ? TOKENS.ink : TOKENS.border}`,
                fontSize: 13, fontWeight: 500,
              }}>{s}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
            flex: 1, height: 56, borderRadius: 14,
            background: TOKENS.surface, color: TOKENS.ink,
            border: `1px solid ${TOKENS.border}`,
            fontSize: 15, fontWeight: 500,
          }}>{t.walkInCancel}</button>
          <button onClick={() => canAdd && onAdd({ name: name.trim(), service })}
                  disabled={!canAdd} style={{
            appearance: 'none', cursor: canAdd ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
            flex: 1.4, height: 56, borderRadius: 14,
            background: TOKENS.accent, color: '#fff', border: 'none',
            fontSize: 15, fontWeight: 600, opacity: canAdd ? 1 : 0.4,
          }}>{t.walkInAdd}</button>
        </div>
      </div>
      <style>{`
        @keyframes fc-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fc-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Pause flow — banner shown while paused; panel slides up to pick a duration.
// ────────────────────────────────────────────────────────────────────────
function PauseBanner({ t, mode, now, expired, onResume }) {
  const isOffline = mode.kind === 'offline';
  // When the alarm fires, banner becomes red and pulsing.
  const useExpired = expired && !isOffline;
  const bg = useExpired ? TOKENS.redSoft : (isOffline ? TOKENS.redSoft : TOKENS.amberSoft);
  const accent = useExpired ? TOKENS.red : (isOffline ? TOKENS.red : TOKENS.amber);

  // Countdown
  let countdownLabel = null;
  if (mode.endsAt && !useExpired) {
    const remainingMs = Math.max(0, mode.endsAt - now);
    const total = Math.floor(remainingMs / 1000);
    const mm = String(Math.floor(total / 60)).padStart(2, '0');
    const ss = String(total % 60).padStart(2, '0');
    countdownLabel = `${mm}:${ss}`;
  }

  return (
    <div style={{
      marginBottom: 14, padding: '14px 16px',
      borderRadius: 14, border: `1px solid ${accent}40`,
      background: bg, color: accent,
      display: 'flex', alignItems: 'center', gap: 12,
      animation: useExpired ? 'fc-flash 1.2s ease-in-out infinite' : 'none',
    }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%',
                    background: accent, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0 }}>
        <Icon name={isOffline ? 'lock' : (useExpired ? 'bolt' : 'pause')} size={15} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          {useExpired ? t.pauseEndedTitle
                      : (isOffline ? t.pauseOffline : `${t.pauseShortBanner} ${countdownLabel}`)}
        </div>
        <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
          {useExpired ? t.pauseEndedSub
                      : (isOffline ? t.pauseOfflineBanner : t.queuePausedBanner)}
        </div>
      </div>
      <button onClick={onResume} style={{
        appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
        height: 36, paddingInline: 14, borderRadius: 10,
        background: accent, color: '#fff', border: 'none',
        fontSize: 13, fontWeight: 600, flexShrink: 0,
      }}>{useExpired ? t.resumeNow : t.resume}</button>
      <style>{`
        @keyframes fc-flash {
          0%, 100% { box-shadow: 0 0 0 0 ${accent}00; }
          50%      { box-shadow: 0 0 0 6px ${accent}22; }
        }
      `}</style>
    </div>
  );
}

function PausePanel({ t, onClose, onPick }) {
  const options = [
    { kind: 'short',   durationMin: 15, label: t.pause15, sub: t.dir === 'rtl' ? 'فقط' : 'courte' },
    { kind: 'short',   durationMin: 30, label: t.pause30, sub: t.dir === 'rtl' ? 'فقط' : 'courte' },
    { kind: 'long',    durationMin: 60, label: t.pause60, sub: t.dir === 'rtl' ? 'فقط' : 'pause' },
    { kind: 'offline',                  label: t.pauseOffline, sub: t.pauseOfflineSub },
  ];
  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 90,
      background: 'rgba(0,0,0,0.35)',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      animation: 'fc-fade-in 160ms ease-out',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: TOKENS.surface,
        borderRadius: '20px 20px 0 0',
        padding: '16px 18px 22px',
        animation: 'fc-slide-up 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 999, background: TOKENS.border,
                      margin: '0 auto 14px' }} />
        <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 14 }}>
          {t.pausePanelTitle}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {options.map((o, i) => {
            const isOff = o.kind === 'offline';
            return (
              <button key={i} onClick={() => onPick(o)} style={{
                appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
                width: '100%', height: 56, borderRadius: 12, paddingInline: 16,
                background: TOKENS.surface, color: isOff ? TOKENS.red : TOKENS.ink,
                border: `1px solid ${TOKENS.border}`,
                display: 'flex', alignItems: 'center', gap: 14,
                textAlign: 'start',
              }}>
                <Icon name={isOff ? 'lock' : 'pause'} size={16}
                      style={{ color: isOff ? TOKENS.red : TOKENS.muted }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{o.label}</div>
                  <div style={{ fontSize: 12, color: TOKENS.muted, marginTop: 2 }}>{o.sub}</div>
                </div>
                <Icon name={t.dir === 'rtl' ? 'chevron-left' : 'chevron-right'} size={14}
                      style={{ color: TOKENS.muted }} />
              </button>
            );
          })}
          <button onClick={onClose} style={{
            appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
            width: '100%', height: 48, borderRadius: 12, marginTop: 4,
            background: 'transparent', color: TOKENS.ink, border: 'none',
            fontSize: 14, fontWeight: 500,
          }}>{t.pauseCancel}</button>
        </div>
      </div>
      <style>{`
        @keyframes fc-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fc-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
}

Object.assign(window, { BarberApp });

// ────────────────────────────────────────────────────────────────────────
// AvailabilityPill — quick on/off toggle in the header. Single-tap to
// pause receiving bookings without going into Settings.
// ────────────────────────────────────────────────────────────────────────
function AvailabilityPill({ t, value, onToggle }) {
  return (
    <button onClick={onToggle} role="switch" aria-checked={value} style={{
      appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
      height: 38, paddingInline: 10, borderRadius: 12,
      background: value ? TOKENS.accentSoft : TOKENS.surface,
      color: value ? TOKENS.accent : TOKENS.muted,
      borderWidth: 1, borderStyle: 'solid',
      borderColor: value ? `${TOKENS.accent}55` : TOKENS.border,
      display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%',
                     background: value ? TOKENS.green : TOKENS.faint,
                     animation: value ? 'fc-pulse 1.8s ease-in-out infinite' : 'none' }} />
      <span>{value ? (t.dir === 'rtl' ? 'متاح' : 'Disponible')
                   : (t.dir === 'rtl' ? 'غير متاح' : 'Indisponible')}</span>
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────
// AnimatedNumber — counts up smoothly when the value changes.
// ────────────────────────────────────────────────────────────────────────
function AnimatedNumber({ value, style }) {
  const [display, setDisplay] = React.useState(value);
  const fromRef = React.useRef(value);
  const startRef = React.useRef(null);
  const target = value;
  React.useEffect(() => {
    if (display === target) return;
    fromRef.current = display;
    startRef.current = performance.now();
    let raf;
    const duration = 600;
    const ease = (x) => 1 - Math.pow(1 - x, 3);
    const tick = (now) => {
      const elapsed = now - startRef.current;
      const tProgress = Math.min(1, elapsed / duration);
      const v = fromRef.current + (target - fromRef.current) * ease(tProgress);
      setDisplay(Math.round(v));
      if (tProgress < 1) raf = requestAnimationFrame(tick);
      else setDisplay(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return <span style={style}>{display.toLocaleString('fr-FR')}</span>;
}

// ────────────────────────────────────────────────────────────────────────
// DayProgressBar — slim 10h → 19h indicator with a live "now" marker.
// ────────────────────────────────────────────────────────────────────────
function DayProgressBar({ t, now }) {
  const startH = 10, endH = 19;
  const d = now ? new Date(now) : new Date();
  // Pretend the demo time follows the same 09:55 baseline used in PickTime so
  // the marker visibly sits inside the day.
  const fakeHours = 10 + (d.getMinutes() / 60);
  const pct = Math.max(0, Math.min(100, ((fakeHours - startH) / (endH - startH)) * 100));
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                    marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: TOKENS.muted, fontWeight: 500 }}>
          {t.dayProgressLabel}
        </span>
        <span style={{ fontSize: 11, color: TOKENS.muted,
                       fontVariantNumeric: 'tabular-nums' }}>
          {startH}h · {endH}h
        </span>
      </div>
      <div style={{ height: 3, background: TOKENS.borderSoft, borderRadius: 999,
                    position: 'relative', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: TOKENS.accent,
                      borderRadius: 999, transition: 'width 800ms ease' }} />
        <div style={{ position: 'absolute', insetInlineStart: `calc(${pct}% - 5px)`,
                      top: -3.5, width: 10, height: 10, borderRadius: '50%',
                      background: TOKENS.accent,
                      boxShadow: '0 0 0 3px ' + TOKENS.surface }} />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Toast — floating notice that fades in at the top and auto-dismisses.
// Keyed remount triggers the entry animation on every showToast call.
// ────────────────────────────────────────────────────────────────────────
function ToastNotice({ t, msg }) {
  return (
    <div style={{
      position: 'absolute', top: 56, left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 200, pointerEvents: 'none',
      animation: 'fc-toast 2.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
      direction: t.dir,
    }}>
      <div style={{
        background: TOKENS.surfaceAlt, color: TOKENS.ink,
        paddingInline: 18, height: 44, borderRadius: 999,
        display: 'inline-flex', alignItems: 'center', gap: 10,
        boxShadow: '0 8px 30px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.06)',
        fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#5DE39A' }} />
        {msg}
      </div>
      <style>{`
        @keyframes fc-toast {
          0%   { transform: translate(-50%, -16px); opacity: 0; }
          10%  { transform: translate(-50%, 0); opacity: 1; }
          85%  { transform: translate(-50%, 0); opacity: 1; }
          100% { transform: translate(-50%, -12px); opacity: 0; }
        }
        @keyframes fc-row-in {
          from { transform: translateY(-4px); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// BookingsToggle — single big switch row used in Settings to stop or
// resume new reservations. Persists via barberOverrides.acceptingBookings.
// ────────────────────────────────────────────────────────────────────────
function BookingsToggle({ t, value, onChange }) {
  return (
    <div style={{
      padding: '16px 18px', borderRadius: 14, background: TOKENS.surface,
      border: `1px solid ${TOKENS.border}`,
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%',
                    background: value ? TOKENS.accentSoft : TOKENS.redSoft,
                    color: value ? TOKENS.accent : TOKENS.red,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0 }}>
        <Icon name={value ? 'check' : 'lock'} size={16} stroke={2.2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{t.acceptingBookings}</div>
        <div style={{ fontSize: 12, color: TOKENS.muted, marginTop: 3, lineHeight: 1.4 }}>
          {t.acceptingBookingsSub}
        </div>
      </div>
      <Switch checked={value} onChange={onChange} />
    </div>
  );
}

// Simple iOS-style switch
function Switch({ checked, onChange }) {
  return (
    <button onClick={() => onChange(!checked)} role="switch" aria-checked={checked} style={{
      appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
      width: 52, height: 32, borderRadius: 999, padding: 2,
      background: checked ? TOKENS.accent : TOKENS.border,
      border: 'none', position: 'relative',
      transition: 'background 180ms ease', flexShrink: 0,
    }}>
      <span style={{
        position: 'absolute', top: 2, left: 2,
        width: 28, height: 28, borderRadius: '50%', background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        transform: `translateX(${checked ? 20 : 0}px)`,
        transition: 'transform 180ms ease',
      }} />
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────
// BookingsClosedBanner — shown in the barber app body whenever the barber
// has flipped off "Accept bookings" from Settings.
// ────────────────────────────────────────────────────────────────────────
function BookingsClosedBanner({ t, onReopen }) {
  return (
    <div style={{
      marginBottom: 14, padding: '14px 16px',
      borderRadius: 14, border: `1px solid ${TOKENS.red}40`,
      background: TOKENS.redSoft, color: TOKENS.red,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%',
                    background: TOKENS.red, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0 }}>
        <Icon name="lock" size={14} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{t.bookingsClosedBanner}</div>
        <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>{t.bookingsClosedSub}</div>
      </div>
      <button onClick={onReopen} style={{
        appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
        height: 36, paddingInline: 14, borderRadius: 10,
        background: TOKENS.red, color: '#fff', border: 'none',
        fontSize: 13, fontWeight: 600, flexShrink: 0,
      }}>{t.resume}</button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Confirm-skip prompt — shown when the barber taps "Passer".
// Shows who is being skipped and (when applicable) who takes their place.
// ────────────────────────────────────────────────────────────────────────
function ConfirmSkipSheet({ t, lang, item, replacer, onClose, onConfirm }) {
  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 110,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      animation: 'fc-fade-in 160ms ease-out',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: TOKENS.surface, padding: '16px 22px 22px',
        borderRadius: '20px 20px 0 0', direction: t.dir,
        animation: 'fc-slide-up 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 999, background: TOKENS.border,
                      margin: '0 auto 18px' }} />

        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.015em' }}>
          {t.confirmSkipTitle}
        </h2>
        <div style={{ fontSize: 14, color: TOKENS.inkSoft, marginTop: 8, lineHeight: 1.5 }}>
          {replacer
            ? t.confirmSkipReplaces(item.name, replacer.name)
            : t.confirmSkipNoNext(item.name)}
        </div>

        {/* Two-card layout: who's being skipped → who takes their place */}
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Skipped customer (struck through, amber) */}
          <div style={{ padding: '14px 16px', borderRadius: 14,
                        background: TOKENS.amberSoft, border: `1px solid ${TOKENS.amber}33`,
                        display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: TOKENS.amber,
                          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0 }}>
              <Icon name="skip" size={14} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: TOKENS.amber,
                            textDecoration: 'line-through' }}>{item.name}</div>
              <div style={{ fontSize: 12, color: TOKENS.amber, opacity: 0.85, marginTop: 2 }}>
                {item.time} · {serviceLabel(item, lang)}
              </div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 600, color: TOKENS.amber,
                           letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {t.skip}
            </span>
          </div>

          {/* Arrow */}
          {replacer && (
            <div style={{ display: 'flex', justifyContent: 'center', color: TOKENS.muted }}>
              <Icon name="arrow-right" size={16}
                    style={{ transform: t.dir === 'rtl' ? 'rotate(-90deg)' : 'rotate(90deg)' }} />
            </div>
          )}

          {/* Replacing customer (green) */}
          {replacer && (
            <div style={{ padding: '14px 16px', borderRadius: 14,
                          background: TOKENS.accentSoft, border: `1px solid ${TOKENS.accent}33`,
                          display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: TOKENS.accent,
                            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0 }}>
                <Icon name="play" size={12} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: TOKENS.accentDeep }}>
                  {replacer.name}
                </div>
                <div style={{ fontSize: 12, color: TOKENS.accentDeep, opacity: 0.85, marginTop: 2 }}>
                  {replacer.time} · {serviceLabel(replacer, lang)}
                </div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: TOKENS.accentDeep,
                             letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {t.nextUp}
              </span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{
            appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
            flex: 1, height: 56, borderRadius: 14,
            background: TOKENS.surface, color: TOKENS.ink,
            border: `1px solid ${TOKENS.border}`,
            fontSize: 15, fontWeight: 500,
          }}>{t.confirmSkipKeep}</button>
          <button onClick={onConfirm} style={{
            appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
            flex: 1.3, height: 56, borderRadius: 14,
            background: TOKENS.amber, color: '#fff', border: 'none',
            fontSize: 15, fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Icon name="skip" size={14} />
            {t.confirmSkipYes}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes fc-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fc-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
}
function ConfirmFinishSheet({ t, lang, item, onClose, onConfirm }) {
  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 110,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      animation: 'fc-fade-in 160ms ease-out',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: TOKENS.surface, padding: '16px 22px 22px',
        borderRadius: '20px 20px 0 0', direction: t.dir,
        animation: 'fc-slide-up 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 999, background: TOKENS.border,
                      margin: '0 auto 18px' }} />

        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.015em' }}>
          {t.confirmFinishTitle}
        </h2>
        <div style={{ fontSize: 14, color: TOKENS.inkSoft, marginTop: 8, lineHeight: 1.5 }}>
          {t.confirmFinishSub(item.name, item.price, t.dzd)}
        </div>

        {/* Customer summary card */}
        <div style={{ marginTop: 18, padding: '14px 16px', borderRadius: 14,
                      background: TOKENS.surfaceAlt,
                      display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar initials={item.name.split(' ').map(s => s[0]).join('')}
                  tint={TOKENS.surface} text={TOKENS.ink} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{item.name}</div>
            <div style={{ fontSize: 12, color: TOKENS.muted, marginTop: 2 }}>
              {item.time} · {serviceLabel(item, lang)}
            </div>
          </div>
          <div style={{ fontSize: 17, fontWeight: 600,
                        color: TOKENS.accent, fontVariantNumeric: 'tabular-nums' }}>
            +{item.price.toLocaleString('fr-FR')}
            <span style={{ fontSize: 11, color: TOKENS.accent, opacity: 0.8,
                           fontWeight: 500, marginInlineStart: 4 }}>{t.dzd}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{
            appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
            flex: 1, height: 56, borderRadius: 14,
            background: TOKENS.surface, color: TOKENS.ink,
            border: `1px solid ${TOKENS.border}`,
            fontSize: 15, fontWeight: 500,
          }}>{t.confirmFinishKeep}</button>
          <button onClick={onConfirm} style={{
            appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
            flex: 1.3, height: 56, borderRadius: 14,
            background: TOKENS.accent, color: '#fff', border: 'none',
            fontSize: 15, fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Icon name="check" size={16} stroke={2.4} />
            {t.confirmFinishYes}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes fc-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fc-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Settings — full-screen sheet with Profile, Language, Revenue sections.
// Edits flow up via onUpdateProfile so the customer booking site reflects them.
// ────────────────────────────────────────────────────────────────────────
function SettingsSheet({ t, lang, setLang, barber, barberId, onClose, onUpdateProfile, embedded }) {
  const [name, setName] = React.useState(barber.name[lang]);
  const [specialty, setSpecialty] = React.useState(barber.specialty[lang]);
  const fileInputRef = React.useRef(null);

  const handlePhotoPick = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => onUpdateProfile && onUpdateProfile(barberId, { photo: reader.result });
    reader.readAsDataURL(f);
  };

  const saveProfile = () => {
    onUpdateProfile && onUpdateProfile(barberId, {
      name: name.trim(),
      specialty: specialty.trim(),
    });
    onClose && onClose();   // Settings tab renders this embedded with no onClose
  };

  // Revenue moved to its own screen — settings keeps only profile + language.

  return (
    <div style={{
      ...(embedded
        ? { position: 'static', height: '100%', background: TOKENS.paper, direction: t.dir,
            display: 'flex', flexDirection: 'column' }
        : { position: 'absolute', inset: 0, zIndex: 200,
            background: TOKENS.paper, direction: t.dir,
            display: 'flex', flexDirection: 'column',
            animation: 'fc-sheet-up 280ms cubic-bezier(0.2, 0.8, 0.2, 1)' }),
    }}>
      {/* Header — only when full-screen */}
      {!embedded && (
      <div style={{ padding: '54px 18px 14px', background: TOKENS.surface,
                    borderBottom: `1px solid ${TOKENS.border}`, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.015em' }}>{t.settingsTitle}</div>
        <button onClick={onClose} style={{
          appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
          height: 36, paddingInline: 14, borderRadius: 10,
          background: 'transparent', color: TOKENS.ink,
          border: `1px solid ${TOKENS.border}`,
          fontSize: 13, fontWeight: 500,
        }}>{t.settingsClose}</button>
      </div>
      )}

      <div style={{ flex: 1, overflow: 'auto', padding: embedded ? '56px 18px 32px' : '18px 18px 32px' }}>
        {embedded && (
          <h1 style={{ margin: '0 0 22px', fontSize: 30, fontWeight: 700,
                       letterSpacing: '-0.02em' }}>
            {t.settingsTitle}
          </h1>
        )}
        {/* ── Profile ────────────────────────────────────────────────── */}
        <SettingsSection label={t.sectionProfile}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <Avatar initials={barber.initials} tint={barber.tint} text={barber.text}
                    size={72} photo={barber.photo} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={() => fileInputRef.current?.click()} style={{
                appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
                height: 40, paddingInline: 14, borderRadius: 10,
                background: TOKENS.accent, color: TOKENS.paper, border: 'none',
                fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8,
                width: 'fit-content',
              }}>
                <Icon name="camera" size={15} />
                {t.changePhoto}
              </button>
              {barber.photo && (
                <button onClick={() => onUpdateProfile && onUpdateProfile(barberId, { photo: null })} style={{
                  appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  height: 32, paddingInline: 10, borderRadius: 8,
                  background: 'transparent', color: TOKENS.red, border: 'none',
                  fontSize: 12, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6,
                  width: 'fit-content',
                }}>
                  <Icon name="trash" size={12} />
                  {t.removePhoto}
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoPick}
                     style={{ display: 'none' }} />
            </div>
          </div>

          <SettingsField label={t.yourName}>
            <input value={name} onChange={e => setName(e.target.value)} style={settingsInput(t)} />
          </SettingsField>
          <SettingsField label={t.yourSpecialty}>
            <input value={specialty} onChange={e => setSpecialty(e.target.value)} style={settingsInput(t)} />
          </SettingsField>
          <button onClick={saveProfile} style={{
            appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
            width: '100%', height: 52, borderRadius: 12, marginTop: 6,
            background: TOKENS.accent, color: '#fff', border: 'none',
            fontSize: 15, fontWeight: 600,
          }}>{t.save}</button>
        </SettingsSection>

        {/* ── Language ───────────────────────────────────────────────── */}
        <SettingsSection label={t.sectionLanguage}>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { code: 'fr', label: 'Français' },
              { code: 'ar', label: 'العربية' },
            ].map(opt => (
              <button key={opt.code} onClick={() => setLang && setLang(opt.code)} style={{
                appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
                flex: 1, height: 56, borderRadius: 12,
                background: lang === opt.code ? TOKENS.ink : TOKENS.surface,
                color: lang === opt.code ? '#fff' : TOKENS.ink,
                border: `1px solid ${lang === opt.code ? TOKENS.ink : TOKENS.border}`,
                fontSize: 15, fontWeight: 500,
              }}>{opt.label}</button>
            ))}
          </div>
        </SettingsSection>

        {/* ── Bookings availability ─────────────────────────────────── */}
        <SettingsSection label={t.dir === 'rtl' ? 'الحجوزات' : 'Réservations'}>
          <BookingsToggle t={t}
            value={barber.acceptingBookings !== false}
            onChange={(v) => onUpdateProfile && onUpdateProfile(barberId, { acceptingBookings: v })} />
        </SettingsSection>

        {/* Revenue lives on its own screen — accessible from the stats row in the header. */}
      </div>

      <style>{`
        @keyframes fc-sheet-up {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function SettingsSection({ label, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 12, color: TOKENS.muted, fontWeight: 600, marginBottom: 12,
                    textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </div>
  );
}

function SettingsField({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: TOKENS.ink, marginBottom: 6, fontWeight: 500 }}>{label}</div>
      {children}
    </div>
  );
}

function settingsInput(t) {
  return {
    width: '100%', height: 52, borderRadius: 12, paddingInline: 14,
    border: `1px solid ${TOKENS.border}`, background: TOKENS.surface,
    fontFamily: 'inherit', fontSize: 15, color: TOKENS.ink, outline: 'none',
    direction: t.dir,
  };
}

function RevenueRow({ t, label, amount, clients, accent }) {
  return (
    <div style={{
      padding: '14px 16px', borderRadius: 14,
      background: accent ? TOKENS.accentSoft : TOKENS.surface,
      border: `1px solid ${accent ? `${TOKENS.accent}33` : TOKENS.border}`,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: accent ? TOKENS.accentDeep : TOKENS.muted, fontWeight: 500 }}>
          {label}
        </div>
        <div style={{ fontSize: 11, color: accent ? TOKENS.accentDeep : TOKENS.muted,
                      opacity: 0.7, marginTop: 2 }}>
          {clients} {t.revenueClients}
        </div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em',
                    color: accent ? TOKENS.accentDeep : TOKENS.ink,
                    fontVariantNumeric: 'tabular-nums' }}>
        {amount.toLocaleString('fr-FR')}
        <span style={{ fontSize: 12, fontWeight: 500, marginInlineStart: 4,
                       color: accent ? TOKENS.accentDeep : TOKENS.muted, opacity: 0.8 }}>
          {t.dzd}
        </span>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Revenue screen — full-screen detail with bar chart + period tabs.
// ────────────────────────────────────────────────────────────────────────
function RevenueScreen({ t, lang, onClose, todayAmount, todayClients, embedded }) {
  const [tab, setTab] = React.useState('week');  // 'day' | 'week' | 'month'

  // 7 days of revenue ending today: the six prior days are seeded, today is live.
  // Today is the rightmost bar — BarChart highlights the last index.
  const HISTORY_7D = [6800, 5400, 9100, 11200, 7600, 8200, todayAmount];
  const HISTORY_CLIENTS_7D = [9, 7, 12, 15, 10, 11, todayClients];

  // 30-day daily history for month view
  const HISTORY_30D = (() => {
    const arr = [];
    for (let i = 0; i < 30; i++) {
      const base = 6500 + Math.sin(i * 0.6) * 2500 + (i % 7 === 5 ? 3000 : 0);
      arr.push(Math.round(base));
    }
    // Last 7 = real week
    HISTORY_7D.forEach((v, i) => { arr[arr.length - 7 + i] = v; });
    return arr;
  })();

  // Hourly history for day view (10h-19h)
  const HISTORY_HOURLY = [0, 800, 1100, 1500, 0, 0, 800, 0, 0, 0];

  const totals = {
    day:   HISTORY_HOURLY.reduce((a, b) => a + b, 0) || todayAmount,
    week:  HISTORY_7D.reduce((a, b) => a + b, 0),
    month: HISTORY_30D.reduce((a, b) => a + b, 0),
  };
  const prevTotals = {
    day:   8100,
    week:  totals.week - 4200,
    month: totals.month - 12400,
  };

  const data    = tab === 'day' ? HISTORY_HOURLY : tab === 'week' ? HISTORY_7D : HISTORY_30D;
  const labels  = tab === 'day'
                  ? ['10', '11', '12', '13', '14', '15', '16', '17', '18', '19']
                  : tab === 'week'
                    ? t.weekdaysShort
                    : Array.from({ length: 30 }, (_, i) => i + 1);

  const total = totals[tab];
  const prev  = prevTotals[tab];
  const delta = ((total - prev) / Math.max(1, prev)) * 100;
  const isUp  = delta >= 0;

  const clientsCount  = tab === 'day' ? todayClients
                      : tab === 'week' ? HISTORY_CLIENTS_7D.reduce((a, b) => a + b, 0)
                      : 116;
  const avgPerCut     = clientsCount ? Math.round(total / clientsCount) : 0;
  const hoursWorked   = tab === 'day' ? '6h' : tab === 'week' ? '42h' : '168h';

  const compareLabel  = tab === 'day' ? t.vsYesterday : tab === 'week' ? t.vsLastWeek : t.vsLastMonth;

  // Service breakdown (synthesized — share of revenue per category)
  const breakdownByService = [
    { label: lang === 'ar' ? 'قصة للرجال'                : 'Coupe adulte',                 pct: 0.42, color: TOKENS.accent  },
    { label: lang === 'ar' ? 'قصة + لحية'                : 'Coupe + barbe',                pct: 0.28, color: '#A86E00'      },
    { label: lang === 'ar' ? 'بروشينغ'                   : 'Brushing',                     pct: 0.12, color: '#3D2F66'      },
    { label: lang === 'ar' ? 'بروتين + قصة + بروشينغ'    : 'Protéine + coupe + brushing',  pct: 0.10, color: TOKENS.ink     },
    { label: lang === 'ar' ? 'قصة طفل'                   : 'Coupe enfant',                 pct: 0.05, color: '#1F5A3F'      },
    { label: lang === 'ar' ? 'لحية'                      : 'Barbe',                        pct: 0.03, color: '#6A3825'      },
  ];

  return (
    <div style={{
      ...(embedded
        ? { position: 'static', height: '100%', background: TOKENS.paper, direction: t.dir,
            display: 'flex', flexDirection: 'column' }
        : { position: 'absolute', inset: 0, zIndex: 200,
            background: TOKENS.paper, direction: t.dir,
            display: 'flex', flexDirection: 'column',
            animation: 'fc-sheet-up 280ms cubic-bezier(0.2, 0.8, 0.2, 1)' }),
    }}>
      {/* Header — clears iOS status bar (only when overlay; tab embed uses its own padding) */}
      {!embedded && (
      <div style={{ padding: '54px 18px 14px', background: TOKENS.surface,
                    borderBottom: `1px solid ${TOKENS.border}`, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={onClose} style={{
          appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
          height: 36, paddingInline: 12, borderRadius: 10,
          background: 'transparent', color: TOKENS.ink,
          border: `1px solid ${TOKENS.border}`,
          fontSize: 13, fontWeight: 500,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <Icon name={t.dir === 'rtl' ? 'chevron-right' : 'chevron-left'} size={16} />
          <span>{t.back}</span>
        </button>
        <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}>{t.revenueScreenTitle}</div>
        <span style={{ width: 36 }} />
      </div>
      )}

      <div style={{ flex: 1, overflow: 'auto', padding: embedded ? '56px 18px 24px' : '20px 18px 32px' }}>
        {embedded && (
          <h1 style={{ margin: '0 0 22px', fontSize: 30, fontWeight: 700,
                       letterSpacing: '-0.02em' }}>
            {t.revenueScreenTitle}
          </h1>
        )}
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, padding: 4, borderRadius: 12,
                      background: TOKENS.surfaceAlt, marginBottom: 22 }}>
          {[
            { id: 'day',   label: t.tabDay },
            { id: 'week',  label: t.tabWeek },
            { id: 'month', label: t.tabMonth },
          ].map(o => (
            <button key={o.id} onClick={() => setTab(o.id)} style={{
              appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
              flex: 1, height: 38, borderRadius: 9,
              background: tab === o.id ? TOKENS.surface : 'transparent',
              color: tab === o.id ? TOKENS.ink : TOKENS.muted,
              border: 'none', fontSize: 14, fontWeight: 500,
              boxShadow: tab === o.id ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              transition: 'background 120ms ease, color 120ms ease',
            }}>{o.label}</button>
          ))}
        </div>

        {/* Hero: total + delta */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 13, color: TOKENS.muted, fontWeight: 500, marginBottom: 6 }}>
            {tab === 'day' ? t.revenueToday : tab === 'week' ? t.revenueWeek : t.revenueMonth}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.025em',
                           fontVariantNumeric: 'tabular-nums' }}>
              {total.toLocaleString('fr-FR')}
            </span>
            <span style={{ fontSize: 16, fontWeight: 500, color: TOKENS.muted }}>{t.dzd}</span>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8,
                        fontSize: 13, color: isUp ? TOKENS.accent : TOKENS.red, fontWeight: 600 }}>
            <span>{isUp ? '↑' : '↓'} {Math.abs(delta).toFixed(0)}%</span>
            <span style={{ color: TOKENS.muted, fontWeight: 500 }}>{compareLabel}</span>
          </div>
        </div>

        {/* Bar chart */}
        <BarChart data={data} labels={labels} t={t} dense={tab === 'month'} />

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 24 }}>
          <StatCard label={t.clientsToday} value={clientsCount} />
          <StatCard label={t.avgPerCut} value={`${avgPerCut.toLocaleString('fr-FR')}`} unit={t.dzd} />
          <StatCard label={t.hoursWorked} value={hoursWorked} />
        </div>

        {/* Service breakdown */}
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 12, color: TOKENS.muted, fontWeight: 600, marginBottom: 12,
                        textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t.breakdownByService}
          </div>
          <div style={{ border: `1px solid ${TOKENS.border}`, borderRadius: 14,
                        overflow: 'hidden', background: TOKENS.surface }}>
            {breakdownByService.map((s, i) => (
              <div key={i} style={{
                padding: '12px 14px',
                borderBottom: i < breakdownByService.length - 1 ? `1px solid ${TOKENS.borderSoft}` : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{s.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6,
                                fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>
                      {Math.round(total * s.pct).toLocaleString('fr-FR')}
                    </span>
                    <span style={{ fontSize: 11, color: TOKENS.muted }}>{t.dzd}</span>
                  </div>
                </div>
                <div style={{ height: 3, background: TOKENS.surfaceAlt, borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${s.pct * 100}%`, height: '100%', background: s.color, borderRadius: 999 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fc-sheet-up {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function BarChart({ data, labels, t, dense }) {
  const max = Math.max(1, ...data);
  // Find today's index — last entry for week/month, current hour for day
  const todayIdx = data.length - 1;
  return (
    <div style={{ padding: '18px 14px 12px', borderRadius: 16,
                  background: TOKENS.surface, border: `1px solid ${TOKENS.border}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: dense ? 2 : 6, height: 140,
                    paddingInline: 4 }}>
        {data.map((v, i) => {
          const h = v > 0 ? Math.max(4, (v / max) * 130) : 4;
          const isToday = i === todayIdx;
          const isEmpty = v === 0;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column',
                                  alignItems: 'center', gap: 6 }}>
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column',
                            justifyContent: 'flex-end', height: 130 }}>
                <div style={{
                  height: h,
                  background: isToday ? TOKENS.accent : isEmpty ? TOKENS.borderSoft : TOKENS.ink,
                  opacity: isEmpty ? 0.5 : 1,
                  borderRadius: dense ? 2 : 4,
                  transition: 'height 320ms ease',
                }} />
              </div>
            </div>
          );
        })}
      </div>
      {/* Labels row — every bar for short series, every 5th for month */}
      <div style={{ display: 'flex', gap: dense ? 2 : 6, marginTop: 10, paddingInline: 4 }}>
        {labels.map((l, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 11,
                                color: i === data.length - 1 ? TOKENS.accent : TOKENS.muted,
                                fontWeight: i === data.length - 1 ? 600 : 500,
                                visibility: dense && i % 5 !== 0 && i !== labels.length - 1 ? 'hidden' : 'visible' }}>
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, unit }) {
  return (
    <div style={{ padding: '14px 14px', borderRadius: 14,
                  background: TOKENS.surface, border: `1px solid ${TOKENS.border}` }}>
      <div style={{ fontSize: 11, color: TOKENS.muted, fontWeight: 500, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em',
                       fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        {unit && <span style={{ fontSize: 11, color: TOKENS.muted, fontWeight: 500 }}>{unit}</span>}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Alarm — short 3-beep tone generated via Web Audio API so we don't need
// an audio asset. Played when a timed pause hits zero.
// ────────────────────────────────────────────────────────────────────────
function playAlarm() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const beep = (when, freq = 880) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain).connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + when);
      gain.gain.linearRampToValueAtTime(0.28, ctx.currentTime + when + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + 0.32);
      osc.start(ctx.currentTime + when);
      osc.stop(ctx.currentTime + when + 0.34);
    };
    beep(0,    880);
    beep(0.4,  880);
    beep(0.8, 1100);
  } catch (_) { /* swallow — audio may be blocked before any user interaction */ }
}
