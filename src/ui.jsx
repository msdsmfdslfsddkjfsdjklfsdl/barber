// ui.jsx — shared primitives used across both surfaces

// Tiny inline icons (24px stroke, currentColor)
function Icon({ name, size = 18, stroke = 1.6, style }) {
  const s = { width: size, height: size, display: 'inline-block', flexShrink: 0, ...style };
  const props = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round',
    style: s,
  };
  switch (name) {
    case 'chevron-right': return <svg {...props}><polyline points="9 18 15 12 9 6"/></svg>;
    case 'chevron-left':  return <svg {...props}><polyline points="15 18 9 12 15 6"/></svg>;
    case 'arrow-right':   return <svg {...props}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>;
    case 'check':         return <svg {...props}><polyline points="20 6 9 17 4 12"/></svg>;
    case 'clock':         return <svg {...props}><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/></svg>;
    case 'pin':           return <svg {...props}><path d="M12 22s7-7.5 7-13a7 7 0 1 0-14 0c0 5.5 7 13 7 13z"/><circle cx="12" cy="9" r="2.5"/></svg>;
    case 'phone':         return <svg {...props}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.84.57 2.8.7A2 2 0 0 1 22 16.92z"/></svg>;
    case 'user':          return <svg {...props}><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>;
    case 'star':          return <svg {...props} fill="currentColor" stroke="none"><polygon points="12 2 15.1 8.6 22 9.7 17 14.6 18.2 21.5 12 18.3 5.8 21.5 7 14.6 2 9.7 8.9 8.6 12 2"/></svg>;
    case 'dot':           return <svg {...props} fill="currentColor" stroke="none"><circle cx="12" cy="12" r="4"/></svg>;
    case 'play':          return <svg {...props} fill="currentColor" stroke="none"><polygon points="6 4 20 12 6 20 6 4"/></svg>;
    case 'pause':         return <svg {...props} fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>;
    case 'skip':          return <svg {...props}><polygon points="5 4 15 12 5 20 5 4" fill="currentColor" stroke="none"/><line x1="19" y1="5" x2="19" y2="19"/></svg>;
    case 'plus':          return <svg {...props}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
    case 'more':          return <svg {...props}><circle cx="5"  cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/></svg>;
    case 'lock':          return <svg {...props}><rect x="5" y="11" width="14" height="10" rx="1.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>;
    case 'bolt':          return <svg {...props} fill="currentColor" stroke="none"><polygon points="13 2 4 14 11 14 10 22 20 10 13 10 13 2"/></svg>;
    case 'whats':         return <svg {...props}><path d="M3 21l1.7-5A8.5 8.5 0 1 1 8 19.3L3 21z"/><path d="M8 11c.5 2.5 2.5 4.5 5 5l1.5-1.3c.3-.3.7-.4 1-.2l2 .7c.4.1.5.5.4.9-.5 1.4-1.9 2.4-3.4 2.4-4.4 0-8-3.6-8-8 0-1.5 1-2.9 2.4-3.4.4-.1.8 0 .9.4l.7 2c.1.3 0 .7-.2 1L8 11z"/></svg>;
    case 'settings':      return <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>;
    case 'camera':        return <svg {...props}><path d="M3 7h4l2-3h6l2 3h4v12H3z"/><circle cx="12" cy="13" r="4"/></svg>;
    case 'trash':         return <svg {...props}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>;
    case 'edit':          return <svg {...props}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>;
    case 'home':          return <svg {...props}><path d="M3 12L12 3l9 9"/><path d="M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10"/></svg>;
    case 'list':          return <svg {...props}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>;
    case 'chart':         return <svg {...props}><line x1="3" y1="20" x2="21" y2="20"/><rect x="6" y="12" width="3" height="8"/><rect x="11" y="7" width="3" height="13"/><rect x="16" y="14" width="3" height="6"/></svg>;
    default: return null;
  }
}

// Reusable mobile-browser top chrome (URL pill)
function BrowserChrome({ url, t }) {
  return (
    <div style={{
      height: 36, background: '#EFEEEA', borderBottom: `1px solid ${TOKENS.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      flexShrink: 0, paddingInline: 12,
    }}>
      <div style={{
        height: 22, padding: '0 10px', borderRadius: 999, background: '#FFFFFF',
        border: `1px solid ${TOKENS.border}`,
        display: 'flex', alignItems: 'center', gap: 6,
        fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: 11, color: TOKENS.muted,
        maxWidth: 280,
      }}>
        <Icon name="lock" size={11} stroke={2} style={{ color: TOKENS.muted }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</span>
      </div>
    </div>
  );
}

// Avatar bubble — supports either initials/tint OR a real photo URL.
function Avatar({ initials, tint, text, size = 44, photo }) {
  if (photo) {
    return (
      <img src={photo} alt={initials || 'avatar'} style={{
        width: size, height: size, borderRadius: '50%', objectFit: 'cover',
        flexShrink: 0, background: tint,
      }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: tint, color: text,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Geist', system-ui, sans-serif", fontWeight: 600, fontSize: size * 0.4,
      letterSpacing: '-0.01em', flexShrink: 0,
    }}>{initials}</div>
  );
}

// Status dot with label
function StatusDot({ color, label, mono = false }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
                   fontSize: 12, color: TOKENS.muted, lineHeight: 1,
                   fontFamily: mono ? "'Geist Mono', ui-monospace, monospace" : undefined }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {label}
    </span>
  );
}

// Primary CTA button
function Button({ children, onClick, variant = 'primary', size = 'lg', disabled, style, leftIcon, rightIcon }) {
  const base = {
    appearance: 'none', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit', fontWeight: 500, letterSpacing: '-0.005em',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    transition: 'transform 80ms ease, background 120ms ease, border-color 120ms ease',
    opacity: disabled ? 0.4 : 1,
  };
  const sizes = {
    xl: { height: 68, padding: '0 24px', fontSize: 18, borderRadius: 16, width: '100%' },
    lg: { height: 60, padding: '0 22px', fontSize: 17, borderRadius: 14, width: '100%' },
    md: { height: 48, padding: '0 18px', fontSize: 15, borderRadius: 12 },
    sm: { height: 36, padding: '0 14px', fontSize: 14, borderRadius: 10 },
  };
  const variants = {
    primary:   { background: TOKENS.ink,     color: TOKENS.paper, fontWeight: 600, boxShadow: TOKENS.shadowSm },
    accent:    { background: `linear-gradient(180deg, ${TOKENS.accentBright}, ${TOKENS.accent})`, color: '#06210F', fontWeight: 700, boxShadow: TOKENS.glow },
    secondary: { background: TOKENS.surface, color: TOKENS.ink, border: `1px solid ${TOKENS.border}`, fontWeight: 500 },
    ghost:     { background: 'transparent',  color: TOKENS.ink, fontWeight: 500 },
    danger:    { background: TOKENS.redSoft, color: TOKENS.red, fontWeight: 500 },
  };
  return (
    <button onClick={disabled ? undefined : onClick}
      style={{ ...base, ...sizes[size], ...variants[variant], ...style }}
      onMouseDown={e => !disabled && (e.currentTarget.style.transform = 'translateY(1px)')}
      onMouseUp={e => (e.currentTarget.style.transform = '')}
      onMouseLeave={e => (e.currentTarget.style.transform = '')}>
      {leftIcon && <Icon name={leftIcon} size={16} />}
      {children}
      {rightIcon && <Icon name={rightIcon} size={16} />}
    </button>
  );
}

// Section heading inside a screen
function ScreenHeading({ kicker, title, subtitle, size = 'lg' }) {
  const titleSize = size === 'xl' ? 32 : 28;
  return (
    <div style={{ marginBottom: 24 }}>
      {kicker && <div style={{ fontSize: 13, fontWeight: 600, color: TOKENS.accent,
                               marginBottom: 8, letterSpacing: '-0.005em' }}>{kicker}</div>}
      <h1 style={{ margin: 0, fontSize: titleSize, fontWeight: 600, lineHeight: 1.12,
                   letterSpacing: '-0.02em', color: TOKENS.ink, textWrap: 'balance' }}>
        {title}
      </h1>
      {subtitle && <div style={{ marginTop: 10, fontSize: 16, color: TOKENS.inkSoft,
                                 lineHeight: 1.5, textWrap: 'pretty' }}>{subtitle}</div>}
    </div>
  );
}

// Friendly step indicator — dots + plain text (no "01" mono jargon).
function StepDots({ t, current, total }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
      <div style={{ display: 'flex', gap: 5 }}>
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} style={{
            width: i === current ? 22 : 8, height: 8, borderRadius: 999,
            background: i <= current ? TOKENS.ink : TOKENS.border,
            transition: 'width 200ms ease',
          }} />
        ))}
      </div>
      <div style={{ fontSize: 13, color: TOKENS.inkSoft, fontWeight: 500 }}>
        {t.stepOf(current + 1, total)}
      </div>
    </div>
  );
}

Object.assign(window, { Icon, BrowserChrome, Avatar, StatusDot, Button, ScreenHeading, StepDots });
