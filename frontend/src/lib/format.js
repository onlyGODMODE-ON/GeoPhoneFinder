export const storageLabel = (gb) =>
  gb === null || gb === undefined ? null : gb >= 1024 && gb % 1024 === 0 ? `${gb / 1024} TB` : `${gb} GB`;

/** "8 GB / 256 GB" style label; RAM omitted when unknown. */
export const memoryLabel = (ram, storage) => [ram ? `${ram} GB` : null, storageLabel(storage)].filter(Boolean).join(' / ');

/** Stable 0–359 hue derived from a string (used for the generated phone illustration). */
export function hueFor(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % 360;
}

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
