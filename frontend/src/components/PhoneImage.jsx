import { useId, useState } from 'react';
import { colorFromName, hsl, isLight } from '../lib/color.js';

const familyOf = (brand = '') => {
  const b = brand.toLowerCase();
  return ['apple', 'samsung', 'google', 'xiaomi', 'nothing'].includes(b) ? b : 'generic';
};

function Lens({ cx, cy, r, ring }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#0a0c12" stroke={ring} strokeWidth="1.2" />
      <circle cx={cx} cy={cy} r={r * 0.55} fill="#161b2a" />
      <circle cx={cx - r * 0.25} cy={cy - r * 0.25} r={r * 0.2} fill="rgba(255,255,255,0.55)" />
    </g>
  );
}

/** Rear camera layout drawn per brand family, so different makers look different. */
function BackCameras({ family, glass, ring }) {
  switch (family) {
    case 'apple':
      return (
        <>
          <rect x="11" y="10" width="38" height="38" rx="11" fill={glass} stroke={ring} />
          <Lens cx="23" cy="22" r="7" ring={ring} />
          <Lens cx="37" cy="36" r="7" ring={ring} />
          <circle cx="39" cy="19" r="2.6" fill="rgba(255,240,200,0.75)" />
          <circle cx="42" cy="92" r="6.5" fill="rgba(255,255,255,0.2)" />
        </>
      );
    case 'samsung':
      return (
        <>
          <Lens cx="22" cy="22" r="7" ring={ring} />
          <Lens cx="22" cy="40" r="7" ring={ring} />
          <Lens cx="22" cy="58" r="7" ring={ring} />
          <circle cx="36" cy="24" r="2.4" fill="rgba(255,240,200,0.7)" />
          <circle cx="36" cy="36" r="1.8" fill="rgba(255,255,255,0.35)" />
        </>
      );
    case 'google':
      return (
        <>
          <rect x="4" y="27" width="76" height="26" fill={glass} />
          <Lens cx="29" cy="40" r="8.5" ring={ring} />
          <Lens cx="49" cy="40" r="8.5" ring={ring} />
          <circle cx="65" cy="40" r="3" fill="rgba(255,240,200,0.7)" />
        </>
      );
    case 'xiaomi':
      return (
        <>
          <rect x="10" y="10" width="46" height="46" rx="15" fill={glass} stroke={ring} />
          <circle cx="33" cy="33" r="19.5" fill="none" stroke={ring} />
          <Lens cx="24" cy="24" r="6.5" ring={ring} />
          <Lens cx="42" cy="24" r="6.5" ring={ring} />
          <Lens cx="33" cy="42" r="6.5" ring={ring} />
        </>
      );
    case 'nothing':
      return (
        <>
          <rect x="11" y="11" width="36" height="18" rx="9" fill={glass} stroke={ring} />
          <Lens cx="21" cy="20" r="5" ring={ring} />
          <Lens cx="36" cy="20" r="5" ring={ring} />
          <circle cx="42" cy="92" r="22" fill="none" stroke={ring} />
          <circle cx="42" cy="92" r="12" fill="none" stroke={ring} />
          <path d="M16 126h52M16 134h34" stroke={ring} strokeWidth="1.4" strokeLinecap="round" />
        </>
      );
    default:
      return (
        <>
          <rect x="11" y="11" width="32" height="32" rx="10" fill={glass} stroke={ring} />
          <Lens cx="21" cy="21" r="6" ring={ring} />
          <Lens cx="32" cy="32" r="6" ring={ring} />
        </>
      );
  }
}

/**
 * Product image.
 *  - `src` (the store's own photo of the listing) is used when present; if it fails to load we fall
 *    back to the illustration instead of showing a broken image.
 *  - Otherwise a per-brand illustration is drawn, tinted with the colour the store sells
 *    (`color`, e.g. "Sky Blue"), in `view` = 'back' | 'front'.
 */
export default function PhoneImage({ phone, src, color, view = 'back', label }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [broken, setBroken] = useState(false);
  const url = src ?? phone.imageUrl;

  if (url && !broken) {
    return (
      <img
        className="phone-photo" src={url} alt={label ?? ''} loading="lazy" decoding="async"
        referrerPolicy="no-referrer" onError={() => setBroken(true)}
      />
    );
  }

  const family = familyOf(phone.brand);
  const c = colorFromName(color, `${phone.brand}${phone.model}`);
  const light = isLight(c);
  const radius = family === 'apple' ? 13 : family === 'google' ? 17 : 15;
  const glass = light ? 'rgba(30,34,44,0.78)' : 'rgba(6,8,12,0.68)';
  const ring = light ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.34)';
  const side = hsl(c, -16);

  return (
    <svg className="phone-illustration" viewBox="0 0 84 160" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'} focusable="false">
      <defs>
        <linearGradient id={`${uid}b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={hsl(c, 11)} />
          <stop offset="1" stopColor={hsl(c, -13)} />
        </linearGradient>
        <linearGradient id={`${uid}s`} x1="0" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor={hsl(c, 8)} stopOpacity="0.95" />
          <stop offset="1" stopColor={hsl([(c[0] + 40) % 360, c[1], c[2]], -24)} />
        </linearGradient>
        <linearGradient id={`${uid}g`} x1="0" y1="0" x2="1" y2="0.6">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="2" y="42" width="2" height="14" rx="1" fill={side} />
      <rect x="80" y="52" width="2" height="24" rx="1" fill={side} />
      {view === 'front' ? (
        <>
          <rect x="4" y="3" width="76" height="154" rx={radius} fill="#0b0d13" stroke={side} />
          <rect x="7" y="6" width="70" height="148" rx={radius - 3} fill={`url(#${uid}s)`} />
          {family === 'apple' ? <rect x="32" y="11" width="20" height="6" rx="3" fill="#000" /> : <circle cx="42" cy="13" r="2.6" fill="#000" />}
          <rect x="20" y="46" width="44" height="9" rx="4.5" fill="rgba(255,255,255,0.88)" />
          <rect x="26" y="60" width="32" height="4" rx="2" fill="rgba(255,255,255,0.5)" />
          <rect x="14" y="108" width="56" height="12" rx="6" fill="rgba(255,255,255,0.16)" />
          <rect x="14" y="124" width="56" height="12" rx="6" fill="rgba(255,255,255,0.1)" />
        </>
      ) : (
        <>
          <rect x="4" y="3" width="76" height="154" rx={radius} fill={`url(#${uid}b)`} />
          <BackCameras family={family} glass={glass} ring={ring} />
        </>
      )}
      <rect x="4" y="3" width="76" height="154" rx={radius} fill={`url(#${uid}g)`} />
      <rect x="4.6" y="3.6" width="74.8" height="152.8" rx={radius - 0.5} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1" />
    </svg>
  );
}
