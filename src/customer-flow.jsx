// customer-flow.jsx — full booking flow inside one mobile artboard.
// Steps: 0 Salon landing → 1 Pick barber → 2 Pick time → 3 Details → 4 Confirmed.

// Helper: merge BARBERS[id] with any user overrides set in Settings.
function resolveBarber(id, overrides) {
  const base = BARBERS.find(b => b.id === id);
  if (!base) return null;
  const o = overrides && overrides[id];
  if (!o) return { ...base, acceptingBookings: true };
  return {
    ...base,
    name: o.name ? { fr: o.name, ar: o.name } : base.name,
    specialty: o.specialty ? { fr: o.specialty, ar: o.specialty } : base.specialty,
    photo: o.photo || null,
    acceptingBookings: o.acceptingBookings !== false,    // default true
  };
}

Object.assign(window, { resolveBarber });

function CustomerFlow({ lang = 'fr', density = 'sparse', barberOverrides = {}, onConfirm }) {
  const t = I18N[lang];
  const [step, setStep] = React.useState(0);
  const [barberId, setBarberId] = React.useState(null);
  const [dayIdx, setDayIdx] = React.useState(0);       // 0 today, 1 tomorrow
  const [timeKey, setTimeKey] = React.useState(null);
  const [serviceIds, setServiceIds] = React.useState(['coupe_adulte']);
  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [bookingCode, setBookingCode] = React.useState(null);
  const barber = barberId ? resolveBarber(barberId, barberOverrides) : null;
  // Selected services (add-ons) collapse into one combined "service" that flows
  // through every downstream surface: the summaries, the booking object, the
  // barber's queue row, and the live tracker.
  const pickedServices = serviceIds.map(id => SERVICES.find(s => s.id === id)).filter(Boolean);
  const toggleService = (id) => setServiceIds(prev =>
    prev.includes(id)
      ? (prev.length > 1 ? prev.filter(x => x !== id) : prev)   // always keep at least one
      : [...prev, id]
  );
  const service = {
    name: {
      fr: pickedServices.map(s => s.name.fr).join(' + '),
      ar: pickedServices.map(s => s.name.ar).join(' + '),
    },
    price: pickedServices.reduce((sum, s) => sum + s.price, 0),
    duration: pickedServices.reduce((sum, s) => sum + s.duration, 0),
    count: pickedServices.length,
  };
  const bookedSlots = BOOKED_BY_DENSITY[density];

  // Reset down-stream selections when language changes (avoids stale state)
  React.useEffect(() => { /* no-op, keep state across lang flip */ }, [lang]);

  const surface = {
    fontFamily: t.fontFamily, direction: t.dir, background: TOKENS.surface,
    color: TOKENS.ink, height: '100%', display: 'flex', flexDirection: 'column',
    fontFeatureSettings: '"ss01" on, "cv11" on',
  };

  return (
    <div style={surface}>
      <div key={step} style={{
        flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
        animation: 'fc-step-in 280ms cubic-bezier(0.2, 0.8, 0.2, 1)',
      }}>
        {step === 0 && <SalonLanding t={t} onBook={() => setStep(1)} />}
        {step === 1 && <PickBarber t={t} lang={lang} value={barberId}
                                   barberOverrides={barberOverrides}
                                   onPick={(id) => { setBarberId(id); setStep(2); }}
                                   onBack={() => setStep(0)} />}
        {step === 2 && barber && <PickTime t={t} lang={lang} barber={barber}
                                   serviceIds={serviceIds} onToggleService={toggleService}
                                   dayIdx={dayIdx} onDay={setDayIdx}
                                   value={timeKey} bookedSlots={bookedSlots}
                                   onPick={(k) => { setTimeKey(k); setStep(3); }}
                                   onBack={() => setStep(1)} />}
        {step === 3 && barber && <DetailsStep t={t} barber={barber} lang={lang}
                                   service={service}
                                   timeKey={timeKey} dayIdx={dayIdx}
                                   name={name} phone={phone}
                                   setName={setName} setPhone={setPhone}
                                   onConfirm={() => {
                                     const code = 'FC-' + Math.floor(2000 + Math.random() * 7999);
                                     if (onConfirm) onConfirm({
                                       barberId: barber.id,
                                       name: (name || '').trim() || (t.dir === 'rtl' ? 'الزبون' : 'Client'),
                                       time: timeKey, dayIdx,
                                       service: service.name, price: service.price,
                                       serviceIds,
                                       code,
                                     });
                                     setBookingCode(code);
                                     setStep(4);
                                   }}
                                   onBack={() => setStep(2)} />}
        {step === 4 && barber && <ConfirmedStep t={t} barber={barber} lang={lang}
                                   service={service}
                                   timeKey={timeKey} dayIdx={dayIdx}
                                   name={name} code={bookingCode}
                                   onViewQueue={() => setStep(5)}
                                   onRestart={() => { setStep(0); setBarberId(null); setTimeKey(null); setName(''); setPhone(''); setBookingCode(null); setServiceIds(['coupe_adulte']); }} />}
        {step === 5 && barber && <QueueTracker lang={lang} position="three"
                                   embeddedBarber={barber} service={service}
                                   timeKey={timeKey} code={bookingCode} customerName={name}
                                   onBack={() => setStep(4)}
                                   onRestart={() => { setStep(0); setBarberId(null); setTimeKey(null); setName(''); setPhone(''); setBookingCode(null); setServiceIds(['coupe_adulte']); }} />}
      </div>
      <style>{`
        @keyframes fc-step-in {
          from { transform: translateY(8px); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
        @keyframes fc-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(93,227,154,0.55); }
          50%      { box-shadow: 0 0 0 5px rgba(93,227,154,0); }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STEP 0 — Salon landing (intentionally minimal — name, address, status, CTA)
// ─────────────────────────────────────────────────────────────
function SalonLanding({ t, onBook }) {
  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Hero "image" placeholder — striped, gives the shop a sense of presence */}
      <div style={{
        height: 220, position: 'relative', flexShrink: 0,
        background: `repeating-linear-gradient(135deg, #1a1a18 0 12px, #131312 12px 24px)`,
      }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end',
                      padding: 22, color: '#fff' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em' }}>
              {t.salonName}
            </h1>
            <div style={{ marginTop: 6, fontSize: 14, opacity: 0.78 }}>{t.salonTag}</div>
          </div>
        </div>
        {/* Open-now pill */}
        <div style={{ position: 'absolute', top: 18, [t.dir === 'rtl' ? 'left' : 'right']: 18,
                      height: 26, padding: '0 12px', borderRadius: 999,
                      background: 'rgba(255,255,255,0.16)', backdropFilter: 'blur(8px)',
                      display: 'inline-flex', alignItems: 'center', gap: 7,
                      color: '#fff', fontSize: 12, fontWeight: 500 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#5DE39A',
                         boxShadow: '0 0 0 3px rgba(93,227,154,0.25)' }} />
          {t.openNow}
        </div>
      </div>

      <div style={{ padding: '24px 22px 22px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: TOKENS.inkSoft, fontSize: 14,
                      marginBottom: 18 }}>
          <Icon name="pin" size={14} />
          <span>{t.salonAddr}</span>
        </div>

        <div style={{ flex: 1 }} />
        <Button variant="accent" size="xl" onClick={onBook} rightIcon="arrow-right">{t.bookCta}</Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STEP 1 — Pick barber (HERO MOMENT)
// ─────────────────────────────────────────────────────────────
function PickBarber({ t, lang, value, barberOverrides = {}, onPick, onBack }) {
  const lk = lang;
  return (
    <FlowShell t={t} onBack={onBack} stepIndex={0}>
      <ScreenHeading title={t.pickBarberTitle} subtitle={t.pickBarberSub} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {BARBERS.map(rawBarber => {
          const barber = resolveBarber(rawBarber.id, barberOverrides);
          return (
            <BarberCard key={barber.id} barber={barber} lang={lk} t={t}
                        selected={value === barber.id} onClick={() => onPick(barber.id)} />
          );
        })}
      </div>
    </FlowShell>
  );
}

function BarberCard({ barber, lang, t, selected, onClick }) {
  const isOffline = barber.acceptingBookings === false;

  const meta = (() => {
    if (isOffline)                return { dot: TOKENS.muted, label: t.bookingsClosedShort, sub: '' };
    if (barber.state === 'free')  return { dot: '#34A853',     label: t.freeNowFriendly,
                                           sub: `${barber.price} ${t.dzd}` };
    if (barber.state === 'queue') return { dot: '#34A853',     label: t.waitTextShort(barber.etaMin),
                                           sub: `${barber.queueLen} ${t.inQueue} · ${barber.price} ${t.dzd}` };
    if (barber.state === 'busy')  return { dot: TOKENS.amber,  label: t.inSessionWait(barber.etaMin, barber.queueLen),
                                           sub: `${barber.price} ${t.dzd}` };
    if (barber.state === 'break') return { dot: TOKENS.muted,  label: t.onBreak,
                                           sub: `${t.breakBack(barber.breakReturn)}` };
    return { dot: TOKENS.muted, label: '', sub: '' };
  })();

  return (
    <button onClick={isOffline ? undefined : onClick} disabled={isOffline} style={{
      appearance: 'none', textAlign: 'start', width: '100%',
      cursor: isOffline ? 'not-allowed' : 'pointer',
      background: selected ? TOKENS.surfaceAlt : TOKENS.surface,
      border: `1px solid ${selected ? TOKENS.ink : TOKENS.border}`,
      borderRadius: 16, padding: '18px 18px',
      display: 'flex', alignItems: 'center', gap: 16,
      fontFamily: 'inherit', color: TOKENS.ink, minHeight: 96,
      opacity: isOffline ? 0.55 : 1,
      transition: 'border-color 120ms ease, background 120ms ease',
    }}
    onMouseEnter={e => !isOffline && !selected && (e.currentTarget.style.borderColor = TOKENS.faint)}
    onMouseLeave={e => !isOffline && !selected && (e.currentTarget.style.borderColor = TOKENS.border)}>
      <Avatar initials={barber.initials} tint={barber.tint} text={barber.text} size={64} photo={barber.photo} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.01em' }}>
          {barber.name[lang]}
        </div>
        <div style={{ fontSize: 14, color: TOKENS.inkSoft, marginTop: 4 }}>
          {barber.specialty[lang]}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: meta.dot, flexShrink: 0 }} />
          <span style={{ fontSize: 14, color: TOKENS.ink, fontWeight: 500 }}>{meta.label}</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center',
                    color: TOKENS.faint }}>
        {!isOffline && <Icon name={t.dir === 'rtl' ? 'chevron-left' : 'chevron-right'} size={22} />}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// STEP 2 — Pick time
// ─────────────────────────────────────────────────────────────
function PickTime({ t, lang, barber, serviceIds, onToggleService, dayIdx, onDay, value, bookedSlots, onPick, onBack }) {
  // Pretend it's 09:55 right now so relative-time labels feel real.
  const NOW = { h: 9, m: 55 };
  const minsUntil = (slot) => {
    const [h, m] = slot.split(':').map(Number);
    return (h - NOW.h) * 60 + (m - NOW.m) + (dayIdx === 1 ? 24 * 60 : 0);
  };
  const relLabel = (slot) => {
    const mins = minsUntil(slot);
    if (mins < 0) return null;
    if (mins === 0) return t.dir === 'rtl' ? 'الآن' : 'maintenant';
    if (mins < 60) return t.inMin(mins);
    const h = Math.floor(mins / 60); const m = mins % 60;
    return t.inHourMin(h, m);
  };

  const available = TIME_SLOTS.filter(s => !bookedSlots.includes(s) && (dayIdx === 1 || minsUntil(s) >= 0));
  const soonest = available[0];

  const [showAll, setShowAll] = React.useState(false);
  const visibleSlots = showAll ? available.slice(1) : available.slice(1, 7);
  const hiddenCount = available.length - 1 - visibleSlots.length;

  return (
    <FlowShell t={t} onBack={onBack} stepIndex={1}>
      <ScreenHeading title={t.pickTimeTitle} subtitle={t.pickTimeSub} />

      {/* Selected barber pill — minimal, just identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                    border: `1px solid ${TOKENS.border}`, borderRadius: 14, marginBottom: 18,
                    background: TOKENS.surfaceAlt }}>
        <Avatar initials={barber.initials} tint={barber.tint} text={barber.text} size={36} />
        <div style={{ flex: 1, fontSize: 14 }}>
          <div style={{ fontWeight: 600, color: TOKENS.ink }}>{barber.name[lang]}</div>
          <div style={{ fontSize: 12, color: TOKENS.inkSoft, marginTop: 2 }}>{barber.specialty[lang]}</div>
        </div>
      </div>

      {/* Service picker */}
      <ServicePicker t={t} lang={lang} value={serviceIds} onToggle={onToggleService} />

      {/* Day tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, marginTop: 22 }}>
        {[t.today, t.tomorrow].map((label, i) => (
          <button key={label} onClick={() => onDay(i)} style={{
            appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
            flex: 1, height: 52, borderRadius: 14,
            background: dayIdx === i ? TOKENS.ink : TOKENS.surface,
            color: dayIdx === i ? '#fff' : TOKENS.ink,
            border: `1px solid ${dayIdx === i ? TOKENS.ink : TOKENS.border}`,
            fontSize: 15, fontWeight: 500,
          }}>{label}</button>
        ))}
      </div>

      {/* Hero soonest card */}
      {soonest && dayIdx === 0 && (
        <button onClick={() => onPick(soonest)} style={{
          width: '100%', textAlign: 'start',
          appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
          padding: '20px 22px', borderRadius: 16, marginBottom: 18,
          background: TOKENS.accent, color: '#fff', border: 'none',
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,0.18)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="bolt" size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, opacity: 0.9, fontWeight: 500 }}>{t.soonestTitle}</div>
            <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.01em', marginTop: 4 }}>
              {soonest.replace(':', 'h')}
              <span style={{ fontSize: 16, opacity: 0.85, fontWeight: 400, marginInlineStart: 10 }}>
                {relLabel(soonest)}
              </span>
            </div>
          </div>
          <Icon name={t.dir === 'rtl' ? 'chevron-left' : 'chevron-right'} size={22} />
        </button>
      )}

      {/* Grid of other slots */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {visibleSlots.map(s => {
          const isSel = value === s;
          const rel = relLabel(s);
          return (
            <button key={s} onClick={() => onPick(s)} style={{
              appearance: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'start',
              padding: '14px 16px', borderRadius: 14, minHeight: 76,
              background: isSel ? TOKENS.ink : TOKENS.surface,
              color: isSel ? '#fff' : TOKENS.ink,
              border: `1px solid ${isSel ? TOKENS.ink : TOKENS.border}`,
              display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3,
            }}
              onMouseEnter={e => !isSel && (e.currentTarget.style.borderColor = TOKENS.faint)}
              onMouseLeave={e => !isSel && (e.currentTarget.style.borderColor = TOKENS.border)}>
              <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>
                {s.replace(':', 'h')}
              </div>
              {rel && (
                <div style={{ fontSize: 13, color: isSel ? 'rgba(255,255,255,0.75)' : TOKENS.inkSoft }}>
                  {rel}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {hiddenCount > 0 && !showAll && (
        <button onClick={() => setShowAll(true)} style={{
          appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
          marginTop: 16, width: '100%', height: 52, borderRadius: 14,
          background: 'transparent', color: TOKENS.ink, fontSize: 15, fontWeight: 500,
          border: `1px solid ${TOKENS.border}`,
        }}>
          {t.seeMoreTimes} ({hiddenCount})
        </button>
      )}
    </FlowShell>
  );
}

// Collapsible service picker — default collapsed showing the current
// selection; tap to expand to the full salon menu.
// Multi-select service picker (add-ons): the collapsed header shows the running
// total + combined label; expand to toggle individual prestations on/off.
function ServicePicker({ t, lang, value, onToggle }) {
  const [open, setOpen] = React.useState(false);
  const picked = SERVICES.filter(s => value.includes(s.id));
  const total = picked.reduce((sum, s) => sum + s.price, 0);
  const duration = picked.reduce((sum, s) => sum + s.duration, 0);
  const summary = picked.map(s => s.name[lang]).join(' + ') || (t.dir === 'rtl' ? 'اختر خدمة' : 'Choisir une prestation');

  return (
    <div>
      <div style={{ fontSize: 12, color: TOKENS.muted, fontWeight: 500, marginBottom: 8 }}>
        {t.servicePickerLabel}
      </div>
      <div style={{ border: `1px solid ${TOKENS.border}`, borderRadius: 14,
                    overflow: 'hidden', background: TOKENS.surface }}>
        {/* Header (always visible) */}
        <button onClick={() => setOpen(o => !o)} style={{
          appearance: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'start',
          width: '100%', background: 'transparent', border: 'none',
          padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
          color: TOKENS.ink,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 600, whiteSpace: 'nowrap',
                          overflow: 'hidden', textOverflow: 'ellipsis' }}>{summary}</div>
            <div style={{ fontSize: 12, color: TOKENS.inkSoft, marginTop: 2 }}>
              {picked.length > 1 ? `${picked.length} ${t.dir === 'rtl' ? 'خدمات' : 'prestations'} · ` : ''}
              {duration} {t.min} · {t.dir === 'rtl' ? 'أضف أو عدّل' : 'ajouter / modifier'}
            </div>
          </div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            {total} <span style={{ fontSize: 11, color: TOKENS.muted, fontWeight: 500 }}>{t.dzd}</span>
          </div>
          <span style={{ display: 'flex', alignItems: 'center', color: TOKENS.muted,
                         transform: open ? 'rotate(180deg)' : 'rotate(0)',
                         transition: 'transform 160ms ease' }}>
            <Icon name="chevron-right" size={16} style={{ transform: 'rotate(90deg)' }} />
          </span>
        </button>

        {/* Expanded list — checkboxes, multi-select */}
        {open && (
          <div style={{ borderTop: `1px solid ${TOKENS.borderSoft}` }}>
            {SERVICES.map((s, i) => {
              const isSel = value.includes(s.id);
              return (
                <button key={s.id} onClick={() => onToggle(s.id)} style={{
                  appearance: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'start',
                  width: '100%', background: isSel ? TOKENS.surfaceAlt : 'transparent', border: 'none',
                  padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
                  color: TOKENS.ink,
                  borderBottom: i < SERVICES.length - 1 ? `1px solid ${TOKENS.borderSoft}` : 'none',
                }}>
                  <span style={{ width: 20, height: 20, borderRadius: 6,
                                 border: `1.5px solid ${isSel ? TOKENS.accent : TOKENS.faint}`,
                                 background: isSel ? TOKENS.accent : 'transparent',
                                 display: 'flex', alignItems: 'center', justifyContent: 'center',
                                 flexShrink: 0, color: '#fff' }}>
                    {isSel && <Icon name="check" size={13} stroke={3} />}
                  </span>
                  <span style={{ flex: 1, fontSize: 15, fontWeight: isSel ? 600 : 500 }}>
                    {s.name[lang]}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>
                    {s.price} <span style={{ fontSize: 11, color: TOKENS.muted, fontWeight: 500 }}>{t.dzd}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// TimeSection was the old morning/afternoon/evening grid — replaced by
// PickTime's hero + 2-col friendly grid above.

// ─────────────────────────────────────────────────────────────
// STEP 3 — Details
// ─────────────────────────────────────────────────────────────
function DetailsStep({ t, barber, lang, service, timeKey, dayIdx, name, phone, setName, setPhone, onConfirm, onBack }) {
  const canSubmit = name.trim().length >= 2 && phone.replace(/\D/g, '').length >= 8;
  return (
    <FlowShell t={t} onBack={onBack} stepIndex={2}
               footer={<Button variant="accent" size="xl" onClick={onConfirm} disabled={!canSubmit}>{t.confirm}</Button>}>
      <ScreenHeading title={t.detailsTitle} subtitle={t.detailsSub} />

      <SummaryCard t={t} barber={barber} lang={lang} service={service} timeKey={timeKey} dayIdx={dayIdx} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18 }}>
        <Field label={t.fullName} icon="user">
          <input value={name} onChange={e => setName(e.target.value)} placeholder={t.namePlaceholder}
                 style={inputStyle(t)} />
        </Field>
        <Field label={t.phone} icon="phone" prefix="+213">
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder={t.phonePlaceholder}
                 inputMode="tel" style={{ ...inputStyle(t), paddingInlineStart: 80 }} />
        </Field>
        <div style={{ fontSize: 12, color: TOKENS.muted, lineHeight: 1.5,
                      display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <Icon name="lock" size={13} style={{ marginTop: 2, color: TOKENS.faint }} />
          <span>{t.privacy}</span>
        </div>
      </div>
    </FlowShell>
  );
}

function inputStyle(t) {
  return {
    width: '100%', height: 64, borderRadius: 14, paddingInline: 18,
    border: `1px solid ${TOKENS.border}`, background: TOKENS.surface,
    fontFamily: 'inherit', fontSize: 19, fontWeight: 500, color: TOKENS.ink, outline: 'none',
    direction: t.dir,
  };
}

function Field({ label, children, icon, prefix }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 15, color: TOKENS.ink, marginBottom: 10,
                    fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon && <Icon name={icon} size={16} />}
        {label}
      </div>
      <div style={{ position: 'relative' }}>
        {children}
        {prefix && (
          <div style={{ position: 'absolute', insetInlineStart: 16, top: 0, bottom: 0,
                        display: 'flex', alignItems: 'center',
                        fontSize: 17, fontWeight: 600, color: TOKENS.ink,
                        borderInlineEnd: `1px solid ${TOKENS.border}`,
                        paddingInlineEnd: 12 }}>
            {prefix}
          </div>
        )}
      </div>
    </label>
  );
}

function SummaryCard({ t, barber, lang, service, timeKey, dayIdx }) {
  return (
    <div style={{ border: `1px solid ${TOKENS.border}`, borderRadius: 12, overflow: 'hidden' }}>
      <Row label={t.yourBarber}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Avatar initials={barber.initials} tint={barber.tint} text={barber.text} size={22} />
          <span>{barber.name[lang]}</span>
        </span>
      </Row>
      <Row label={t.stepTime}>
        <span>{dayIdx === 0 ? t.today : t.tomorrow} · {(timeKey || '').replace(':', 'h')}</span>
      </Row>
      <Row label={t.servicePickerLabel} last>
        <span>{service.name[lang]} · <span style={{ color: TOKENS.inkSoft }}>{service.price} {t.dzd}</span></span>
      </Row>
    </div>
  );
}

function Row({ label, children, last }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px', fontSize: 13,
                  borderBottom: last ? 'none' : `1px solid ${TOKENS.borderSoft}` }}>
      <span style={{ color: TOKENS.muted }}>{label}</span>
      <span style={{ color: TOKENS.ink, fontWeight: 500 }}>{children}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STEP 4 — Confirmed
// ─────────────────────────────────────────────────────────────
function ConfirmedStep({ t, barber, lang, service, timeKey, dayIdx, name, code, onViewQueue, onRestart }) {
  const friendlyTime = (timeKey || '').replace(':', 'h');
  return (
    <FlowShell t={t} hideBack hideSteps
               footer={
                 <Button variant="accent" size="xl" onClick={onViewQueue} rightIcon="arrow-right">{t.viewQueue}</Button>
               }>
      {/* Centered hero — check + headline + plain sentence */}
      <div style={{ paddingTop: 12, paddingBottom: 24,
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: TOKENS.accentSoft,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: TOKENS.accent, marginBottom: 20 }}>
          <Icon name="check" size={34} stroke={2.6} />
        </div>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          {t.doneTitle}
        </h1>
        <div style={{ marginTop: 12, fontSize: 17, color: TOKENS.inkSoft, lineHeight: 1.45,
                      maxWidth: 300 }}>
          {t.waitsAt(barber.name[lang].split(' ')[0], friendlyTime)}
        </div>
      </div>

      {/* Single summary card — barber + time + price + a small "show this screen" hint */}
      <div style={{ border: `1px solid ${TOKENS.border}`, borderRadius: 16, background: TOKENS.surface,
                    overflow: 'hidden' }}>
        <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar initials={barber.initials} tint={barber.tint} text={barber.text} size={48} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{barber.name[lang]}</div>
            <div style={{ fontSize: 13, color: TOKENS.inkSoft, marginTop: 3 }}>
              {service.name[lang]} · {dayIdx === 0 ? t.today : t.tomorrow} · {friendlyTime}
            </div>
          </div>
          <div style={{ textAlign: t.dir === 'rtl' ? 'left' : 'right', fontSize: 16, fontWeight: 600 }}>
            {service.price} <span style={{ fontSize: 11, color: TOKENS.muted, fontWeight: 500 }}>{t.dzd}</span>
          </div>
        </div>
        <div style={{ borderTop: `1px solid ${TOKENS.borderSoft}`,
                      padding: '12px 18px', fontSize: 13, color: TOKENS.inkSoft,
                      display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="user" size={14} style={{ color: TOKENS.muted, flexShrink: 0 }} />
          <span>{t.showThisScreen}</span>
        </div>
      </div>

      {/* Small reassurance line — booking number, no card chrome */}
      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    fontSize: 12, color: TOKENS.muted }}>
        <span>{t.yourNumber}</span>
        <span style={{ color: TOKENS.ink, fontWeight: 600,
                       fontFamily: "'Geist Mono', ui-monospace, monospace" }}>{code}</span>
      </div>
    </FlowShell>
  );
}

// ─────────────────────────────────────────────────────────────
// Shell: header (back + step indicator) + scrollable body + footer
// ─────────────────────────────────────────────────────────────
function FlowShell({ t, onBack, stepIndex, hideBack, hideSteps, footer, children }) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '18px 22px 14px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 12, flexShrink: 0, background: TOKENS.surface,
                    minHeight: hideSteps && hideBack ? 0 : undefined }}>
        {!hideBack ? (
          <button onClick={onBack} style={{ appearance: 'none', border: `1px solid ${TOKENS.border}`,
                  background: TOKENS.surface,
                  cursor: 'pointer', height: 44, paddingInline: 14, borderRadius: 12, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', color: TOKENS.ink, padding: 0,
                  flexShrink: 0, gap: 6, fontFamily: 'inherit', fontSize: 14, fontWeight: 500 }}>
            <Icon name={t.dir === 'rtl' ? 'chevron-right' : 'chevron-left'} size={20} />
            <span style={{ paddingInlineEnd: 10 }}>{t.back}</span>
          </button>
        ) : <span style={{ width: 80, height: 44 }} />}
        {!hideSteps && <StepDots t={t} current={stepIndex} total={3} />}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '10px 22px 16px' }}>
        {children}
      </div>
      {footer && (
        <div style={{ padding: '14px 22px 22px',
                      background: TOKENS.surface, flexShrink: 0 }}>
          {footer}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { CustomerFlow });
