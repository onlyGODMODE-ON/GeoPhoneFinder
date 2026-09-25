import { CAMERA_LEVELS } from '../state/criteria.js';
import { storageLabel } from './format.js';

/** Human-readable labels for the optional requirements (used by the review step and the results summary). */
export function requirementLabels(r = {}, t) {
  const out = [];
  if (r.minRam != null) out.push(t('reqChip.minRam', { n: r.minRam }));
  if (r.minStorage != null) out.push(t('reqChip.minStorage', { n: storageLabel(r.minStorage) }));
  if (r.vendors?.length) out.push(t('reqChip.vendors', { v: r.vendors.join(', ') }));
  if (r.minChipsetTier) out.push(t('reqChip.minChipsetTier', { v: t(`adv.tier.${r.minChipsetTier}`) }));
  if (r.minCameraScore != null) {
    const level = CAMERA_LEVELS.find((l) => l.score === r.minCameraScore);
    out.push(t('reqChip.minCameraScore', { level: level ? t(`adv.level.${level.key}`) : r.minCameraScore }));
  }
  if (r.telephoto) out.push(t('adv.telephoto'));
  if (r.ois) out.push(t('adv.ois'));
  if (r.minRefresh != null) out.push(t('reqChip.minRefresh', { n: r.minRefresh }));
  if (r.oled) out.push(t('adv.oled'));
  if (r.minBattery != null) out.push(t('reqChip.minBattery', { n: r.minBattery }));
  for (const f of ['fiveG', 'nfc', 'esim', 'wireless', 'waterResistant']) if (r[f]) out.push(t(`adv.${f}`));
  return out;
}
