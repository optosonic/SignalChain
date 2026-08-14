/** Master-bus FX slot IDs — mirrors PHOTONE / rumori fxOrder. */
export const FX_SLOT = {
  compressor: 'compressor',
  distortion: 'distortion',
  delay: 'delay',
  reverb: 'reverb',
  eq: 'eq',
  limiter: 'limiter',
};

export const FX_SLOT_LIST = [
  FX_SLOT.compressor,
  FX_SLOT.distortion,
  FX_SLOT.delay,
  FX_SLOT.reverb,
  FX_SLOT.eq,
  FX_SLOT.limiter,
];

export const DEFAULT_FX_ORDER = [...FX_SLOT_LIST];

export const FX_SLOT_META = {
  [FX_SLOT.compressor]: { label: 'CMP', color: '#e7a55a' },
  [FX_SLOT.distortion]: { label: 'DST', color: '#e0633a' },
  [FX_SLOT.delay]: { label: 'DEL', color: '#d4a84a' },
  [FX_SLOT.reverb]: { label: 'REV', color: '#e8c87a' },
  [FX_SLOT.eq]: { label: 'EQ', color: '#fbbf24' },
  [FX_SLOT.limiter]: { label: 'LIM', color: '#e76b5a' },
};

/** Normalize user order: dedupe, fill missing slots. */
export function normalizeFxOrder(order) {
  const seen = new Set();
  const cleaned = [];
  for (const slot of order ?? []) {
    if (!FX_SLOT_META[slot] || seen.has(slot)) continue;
    seen.add(slot);
    cleaned.push(slot);
  }
  for (const slot of FX_SLOT_LIST) {
    if (!seen.has(slot)) cleaned.push(slot);
  }
  return cleaned;
}

export function swapFxOrder(order, from, to) {
  const next = normalizeFxOrder(order);
  if (from < 0 || to < 0 || from >= next.length || to >= next.length || from === to) {
    return next;
  }
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
