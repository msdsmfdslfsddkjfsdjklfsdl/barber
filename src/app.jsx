// app.jsx — main composition: design canvas with three artboards + Tweaks panel.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "lang": "fr",
  "queueState": "three",
  "density": "sparse"
}/*EDITMODE-END*/;

// Mobile-webview wrapper — hoisted out of App so re-renders don't re-mount
// the customer flow (which would wipe its step/selection state when a new
// booking confirms and bubbles up).
function PhoneFrame({ children, width = 380, height = 800 }) {
  return (
    <div style={{
      width, height, borderRadius: 22, overflow: 'hidden',
      background: TOKENS.surface,
      boxShadow: '0 30px 60px -20px rgba(20,18,12,0.18), 0 0 0 1px rgba(20,18,12,0.06)',
    }}>
      {children}
    </div>
  );
}

// Persist a slice of state to localStorage so customer bookings and barber
// profile edits survive a page refresh — the prototype has no backend, but it
// should still feel like one.
function usePersistedState(key, initial) {
  const [val, setVal] = React.useState(() => {
    try { const raw = window.localStorage.getItem(key); return raw != null ? JSON.parse(raw) : initial; }
    catch (e) { return initial; }
  });
  React.useEffect(() => {
    try { window.localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* quota / private mode */ }
  }, [key, val]);
  return [val, setVal];
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Shared state — customer flow confirmations land here and propagate
  // straight into the barber's app panel (no SMS, no backend, just lift-state).
  const [liveBookings, setLiveBookings] = usePersistedState('fc.liveBookings', []);
  const [activeBarberId, setActiveBarberId] = usePersistedState('fc.activeBarberId', 'sofiane');

  // Barber profile overrides set in Settings: { [barberId]: { name?, specialty?, photo? } }
  // Both the booking site AND the barber app read through these, so a
  // change in Settings is reflected on the customer's booking page too.
  const [barberOverrides, setBarberOverrides] = usePersistedState('fc.barberOverrides', {});
  const updateBarberProfile = (barberId, patch) => {
    setBarberOverrides(prev => ({ ...prev, [barberId]: { ...prev[barberId], ...patch } }));
  };

  const handleBookingConfirmed = React.useCallback((booking) => {
    setLiveBookings(prev => {
      if (prev.some(b => b.code === booking.code)) return prev; // idempotent
      return [...prev, booking];
    });
    setActiveBarberId(booking.barberId);
  }, []);

  const clearLiveBookings = () => setLiveBookings([]);
  const handleBookingCancelled = React.useCallback((code) => {
    setLiveBookings(prev => prev.filter(b => b.code !== code));
  }, []);

  return (
    <>
      <DesignCanvas background={TOKENS.paper}>
        {/* ── Section 1: Client web booking flow ───────────────────────── */}
        <DCSection id="booking" title="Customer · Web booking flow"
                   subtitle="Mobile webview · barberdz.com/fade-city · 3 steps from open to confirmation.">
          <DCArtboard id="flow" label="Booking flow · interactive" width={380} height={800}>
            <PhoneFrame>
              <CustomerFlow lang={t.lang} density={t.density}
                            barberOverrides={barberOverrides}
                            onConfirm={handleBookingConfirmed}
                          onCancelBooking={handleBookingCancelled} />
            </PhoneFrame>
          </DCArtboard>
        </DCSection>

        {/* ── Section 2: Live queue tracker ─────────────────────────────── */}
        <DCSection id="queue" title="Customer · Live queue tracker"
                   subtitle="State controlled by the “Queue position” tweak — flip between #3, you’re next, done.">
          <DCArtboard id="tracker" label="Queue tracker" width={380} height={800}>
            <PhoneFrame>
              <QueueTracker lang={t.lang} position={t.queueState} />
            </PhoneFrame>
          </DCArtboard>
        </DCSection>

        {/* ── Section 3: Barber mobile app ──────────────────────────────── */}
        <DCSection id="barber" title="Barber · Mobile app — Fast mode"
                   subtitle="Redesigned for rush hours: the chair, the queue, finish-and-charge, and walk-ins on one screen. Bookings from the customer flow land here instantly.">
          <DCArtboard id="dashboard" label="Fast mode · run the chair in one tap" width={402} height={874}>
            <IOSDevice width={402} height={874}>
              <BarberFast lang={t.lang}
                         setLang={(v) => setTweak('lang', v)}
                         density={t.density}
                         barberId={activeBarberId}
                         liveBookings={liveBookings}
                         barberOverrides={barberOverrides}
                         onUpdateProfile={updateBarberProfile} />
            </IOSDevice>
          </DCArtboard>
        </DCSection>
      </DesignCanvas>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Langue / اللغة" />
        <TweakRadio label="Interface" value={t.lang}
                    options={[{ value: 'fr', label: 'FR' }, { value: 'ar', label: 'AR' }]}
                    onChange={v => setTweak('lang', v)} />

        <TweakSection label="Queue position" />
        <TweakSelect label="Customer view" value={t.queueState}
                     options={[
                       { value: 'three', label: '3 people before you' },
                       { value: 'one',   label: 'You\'re up next · قريب' },
                       { value: 'done',  label: 'Session complete' },
                     ]}
                     onChange={v => setTweak('queueState', v)} />

        <TweakSection label="Booking density" />
        <TweakRadio label="Today" value={t.density}
                    options={[{ value: 'sparse', label: 'Sparse' }, { value: 'busy', label: 'Busy' }]}
                    onChange={v => setTweak('density', v)} />

        <TweakSection label="Live demo" />
        <TweakButton label={`Clear live bookings (${liveBookings.length})`}
                     onClick={clearLiveBookings} />
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
