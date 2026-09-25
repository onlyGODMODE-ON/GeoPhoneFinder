/**
 * Optional technical requirements ("minimums") a knowledgeable user may set. Shared by the
 * recommendation engine and the search page so both behave identically.
 *
 * Rule: if a requirement is set and the phone's value for it is UNKNOWN, the phone does not match —
 * we never assume a missing spec satisfies what the user asked for.
 */
export const CHIPSET_TIERS = ['entry', 'mid', 'upper-mid', 'flagship'];

const NUMERIC = {
  minRam: [1, 64],
  minStorage: [8, 8192],
  minBattery: [1000, 20000],
  minRefresh: [30, 500],
  minCameraScore: [0, 100],
};
const FLAGS = ['telephoto', 'ois', 'oled', 'fiveG', 'nfc', 'esim', 'wireless', 'waterResistant'];

export const REQUIREMENT_LIMITS = NUMERIC;
export const REQUIREMENT_FLAGS = FLAGS;

/** IP67 / IP68 / IP69 (and IPX7/IPX8): protected against immersion. IP5x/IP6x-only ratings do not count. */
export function isWaterResistant(ip) {
  const m = /^ip[0-9x]([0-9])/i.exec(String(ip ?? ''));
  return Boolean(m && Number(m[1]) >= 7);
}

export function matchesRequirements(phone, r = {}) {
  if (r.minRam != null && !((phone.ram ?? -1) >= r.minRam)) return false;
  if (r.minStorage != null && !((phone.storage ?? -1) >= r.minStorage)) return false;
  if (r.minBattery != null && !((phone.battery?.capacityMah ?? -1) >= r.minBattery)) return false;
  if (r.minRefresh != null && !((phone.display?.refreshRateHz ?? -1) >= r.minRefresh)) return false;
  if (r.minCameraScore != null && !((phone.scores?.camera ?? -1) >= r.minCameraScore)) return false;

  if (r.vendors?.length) {
    const vendor = (phone.chipset?.vendor ?? '').toLowerCase();
    if (!vendor || !r.vendors.some((v) => v.toLowerCase() === vendor)) return false;
  }
  if (r.minChipsetTier) {
    const have = CHIPSET_TIERS.indexOf(phone.chipset?.performanceTier);
    if (have < CHIPSET_TIERS.indexOf(r.minChipsetTier)) return false; // unknown tier => -1 => no match
  }

  if (r.telephoto && phone.cameras?.telephoto?.present !== true) return false;
  if (r.ois && phone.cameras?.main?.ois !== true) return false;
  if (r.oled && !/oled/i.test(phone.display?.panel ?? '')) return false;
  if (r.fiveG && phone.connectivity?.fiveG !== true) return false;
  if (r.nfc && phone.connectivity?.nfc !== true) return false;
  if (r.esim && phone.connectivity?.esim !== true) return false;
  if (r.wireless && !((phone.battery?.wirelessW ?? 0) > 0)) return false;
  if (r.waterResistant && !isWaterResistant(phone.body?.ipRating)) return false;
  return true;
}

/**
 * Validates raw requirements from a request. Returns { value, errors }. Only known keys survive,
 * "empty" values (null / '' / false / []) are dropped so an untouched form means "no requirement".
 */
export function normalizeRequirements(raw) {
  const errors = [];
  const value = {};
  if (raw === undefined || raw === null) return { value, errors };
  if (typeof raw !== 'object' || Array.isArray(raw)) return { value, errors: ['requirements must be an object'] };

  for (const [key, [lo, hi]] of Object.entries(NUMERIC)) {
    const v = raw[key];
    if (v === undefined || v === null || v === '') continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n < lo || n > hi) errors.push(`${key} must be a number between ${lo} and ${hi}`);
    else value[key] = n;
  }
  for (const key of FLAGS) if (raw[key] === true) value[key] = true;

  if (raw.vendors !== undefined && raw.vendors !== null) {
    if (!Array.isArray(raw.vendors)) errors.push('vendors must be an array');
    else {
      const vendors = [...new Set(raw.vendors.map((v) => String(v).trim()).filter(Boolean))];
      if (vendors.length) value.vendors = vendors;
    }
  }
  if (raw.minChipsetTier !== undefined && raw.minChipsetTier !== null && raw.minChipsetTier !== '') {
    if (!CHIPSET_TIERS.includes(raw.minChipsetTier)) errors.push(`minChipsetTier must be one of ${CHIPSET_TIERS.join(', ')}`);
    else value.minChipsetTier = raw.minChipsetTier;
  }
  return { value, errors };
}
