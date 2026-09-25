import { storageLabel } from './format.js';

/**
 * Presentation of technical specs. Rows are used by the product page and the comparison table.
 *  value(phone)        -> primitive (null = unknown, never "0")
 *  format(v, phone, t) -> display string
 *  better              -> 'higher' | 'lower' | undefined (used to mark the best value when comparing)
 */
const yn = (v, t) => (v === true ? t('common.yes') : v === false ? t('common.no') : null);
const s = (p) => p.specs ?? {};
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export const SPEC_ROWS = [
  { key: 'chipset', group: 'performance', value: (p) => s(p).chipset?.name ?? null, format: (v) => v },
  { key: 'chipsetCores', group: 'performance', value: (p) => s(p).chipset?.cores ?? null, format: (v) => v },
  { key: 'chipsetTier', group: 'performance', value: (p) => s(p).chipset?.performanceTier ?? null, format: (v, _p, t) => t(`adv.tier.${v}`) },
  { key: 'cpuScore', group: 'performance', value: (p) => num(s(p).chipset?.cpuScore), format: (v) => `${v}/100`, better: 'higher' },
  { key: 'gpu', group: 'performance', value: (p) => s(p).chipset?.gpu ?? null, format: (v) => v },
  { key: 'gpuScore', group: 'performance', value: (p) => num(s(p).chipset?.gpuScore), format: (v) => `${v}/100`, better: 'higher' },
  { key: 'ram', group: 'performance', value: (p) => p.ram ?? null, format: (v) => `${v} GB`, better: 'higher' },
  { key: 'storage', group: 'performance', value: (p) => p.storage ?? null, format: (v) => storageLabel(v), better: 'higher' },

  { key: 'displaySize', group: 'display', value: (p) => num(s(p).display?.sizeInch), format: (v) => `${v}″` },
  {
    key: 'resolution', group: 'display',
    value: (p) => { const r = s(p).display?.resolution; return r?.width && r?.height ? r.width * r.height : null; },
    format: (_v, p) => { const r = s(p).display.resolution; return `${r.width}×${r.height}`; },
    better: 'higher',
  },
  { key: 'refresh', group: 'display', value: (p) => num(s(p).display?.refreshRateHz), format: (v) => `${v} Hz`, better: 'higher' },
  { key: 'panel', group: 'display', value: (p) => s(p).display?.panel ?? null, format: (v) => v },
  { key: 'brightness', group: 'display', value: (p) => num(s(p).display?.peakBrightnessNits), format: (v) => `${v} nits`, better: 'higher' },

  { key: 'mainCamera', group: 'camera', value: (p) => num(s(p).cameras?.main?.mp), format: (v, p) => `${v} MP${s(p).cameras.main.ois ? ' · OIS' : ''}` },
  {
    key: 'ultrawide', group: 'camera',
    value: (p) => (s(p).cameras?.ultrawide ? (s(p).cameras.ultrawide.present ? s(p).cameras.ultrawide.mp ?? 'yes' : 'none') : null),
    format: (v, _p, t) => (v === 'none' ? t('common.none') : v === 'yes' ? t('common.yes') : `${v} MP`),
  },
  {
    key: 'telephoto', group: 'camera',
    value: (p) => (s(p).cameras?.telephoto ? (s(p).cameras.telephoto.present ? s(p).cameras.telephoto.opticalZoom ?? 'yes' : 'none') : null),
    format: (v, p, t) => (v === 'none' ? t('common.none') : v === 'yes' ? t('common.yes') : `${s(p).cameras.telephoto.mp ?? '?'} MP · ${v}×`),
  },
  { key: 'frontCamera', group: 'camera', value: (p) => num(s(p).cameras?.front?.mp), format: (v) => `${v} MP` },
  { key: 'videoMax', group: 'camera', value: (p) => s(p).video?.maxResolution ?? null, format: (v, p) => `${v}${s(p).video.max4kFps ? ` · 4K ${s(p).video.max4kFps} fps` : ''}` },

  { key: 'battery', group: 'battery', value: (p) => num(s(p).battery?.capacityMah), format: (v) => `${v} mAh`, better: 'higher' },
  { key: 'wired', group: 'battery', value: (p) => num(s(p).battery?.wiredW), format: (v) => `${v} W`, better: 'higher' },
  { key: 'wireless', group: 'battery', value: (p) => num(s(p).battery?.wirelessW), format: (v, _p, t) => (v > 0 ? `${v} W` : t('common.no')), better: 'higher' },

  { key: 'fiveG', group: 'connectivity', value: (p) => s(p).connectivity?.fiveG ?? null, format: (v, _p, t) => yn(v, t) },
  { key: 'wifi', group: 'connectivity', value: (p) => s(p).connectivity?.wifi ?? null, format: (v) => v },
  { key: 'bluetooth', group: 'connectivity', value: (p) => num(s(p).connectivity?.bluetooth), format: (v) => `${v}` },
  { key: 'nfc', group: 'connectivity', value: (p) => s(p).connectivity?.nfc ?? null, format: (v, _p, t) => yn(v, t) },
  { key: 'esim', group: 'connectivity', value: (p) => s(p).connectivity?.esim ?? null, format: (v, _p, t) => yn(v, t) },
  { key: 'usb', group: 'connectivity', value: (p) => s(p).connectivity?.usb ?? null, format: (v) => v },

  { key: 'weight', group: 'body', value: (p) => num(s(p).body?.weightG), format: (v) => `${v} g`, better: 'lower' },
  { key: 'thickness', group: 'body', value: (p) => num(s(p).body?.thicknessMm), format: (v) => `${v} mm`, better: 'lower' },
  { key: 'ip', group: 'body', value: (p) => s(p).body?.ipRating ?? null, format: (v, _p, t) => (v === 'none' ? t('common.none') : v) },
  { key: 'glass', group: 'body', value: (p) => s(p).body?.glass ?? null, format: (v) => v },
  { key: 'frame', group: 'body', value: (p) => s(p).body?.frame ?? null, format: (v) => v },

  { key: 'os', group: 'software', value: (p) => s(p).software?.os ?? null, format: (v) => v },
  { key: 'osUpdates', group: 'software', value: (p) => num(s(p).software?.osUpdateYears), format: (v, _p, t) => t('spec.years', { n: v }), better: 'higher' },
  { key: 'securityUpdates', group: 'software', value: (p) => num(s(p).software?.securityUpdateYears), format: (v, _p, t) => t('spec.years', { n: v }), better: 'higher' },
];

export const SPEC_GROUPS = ['performance', 'display', 'camera', 'battery', 'connectivity', 'body', 'software'];

/** { text, value } for one phone/row. `text === null` means "unknown" (rendered as an em dash). */
export function specCell(row, phone, t) {
  const value = row.value(phone);
  if (value === null || value === undefined) return { text: null, value: null };
  return { text: row.format(value, phone, t), value };
}

/**
 * Which columns hold the best value in a row? Only numeric rows with a `better` rule qualify,
 * at least two phones need data, and a row where everything is equal has no "best".
 */
export function bestIndexes(values, better) {
  if (!better) return [];
  const known = values.map((v, i) => [v, i]).filter(([v]) => typeof v === 'number');
  if (known.length < 2) return [];
  const target = better === 'higher' ? Math.max(...known.map(([v]) => v)) : Math.min(...known.map(([v]) => v));
  if (known.every(([v]) => v === target)) return [];
  return known.filter(([v]) => v === target).map(([, i]) => i);
}
