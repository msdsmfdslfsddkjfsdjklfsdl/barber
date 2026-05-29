// helpers.jsx — tiny helpers the barber app needs, kept local so the app folder
// is fully standalone (no dependency on the booking-site code).

// Safe service label — handles a { fr, ar } object OR a plain string.
function serviceLabel(item, lang) {
  if (!item || !item.service) return '';
  return typeof item.service === 'object' ? item.service[lang] : item.service;
}

// Merge BARBERS[id] with any saved profile overrides.
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
    acceptingBookings: o.acceptingBookings !== false,
  };
}

Object.assign(window, { serviceLabel, resolveBarber });
