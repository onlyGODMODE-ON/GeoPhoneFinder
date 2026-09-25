/** Accessible two-handle range: two native range inputs layered on one track. */
export default function RangeSlider({ min, max, step = 50, low, high, onChange, lowLabel, highLabel, format }) {
  const span = max - min || 1;
  const lo = Math.min(Math.max(low, min), max);
  const hi = Math.min(Math.max(high, min), max);
  const pct = (v) => ((v - min) / span) * 100;
  // when both handles sit at the far end, keep the low handle reachable
  const lowOnTop = lo >= max - span * 0.1;

  return (
    <div className="range">
      <div className="range__values">
        <div className="range__value"><small>{lowLabel}</small><strong className="num">{format(lo)}</strong></div>
        <div className="range__value"><small>{highLabel}</small><strong className="num">{format(hi)}</strong></div>
      </div>
      <div className="range__box">
        <div className="range__track"><div className="range__fill" style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }} /></div>
        <input
          className="range__input" type="range" min={min} max={max} step={step} value={lo}
          aria-label={lowLabel} aria-valuetext={format(lo)} style={{ zIndex: lowOnTop ? 4 : 3 }}
          onChange={(e) => onChange(Math.min(Number(e.target.value), hi), hi)}
        />
        <input
          className="range__input" type="range" min={min} max={max} step={step} value={hi}
          aria-label={highLabel} aria-valuetext={format(hi)} style={{ zIndex: 3 }}
          onChange={(e) => onChange(lo, Math.max(Number(e.target.value), lo))}
        />
      </div>
      <div className="range__bounds" aria-hidden="true"><span className="num">{format(min)}</span><span className="num">{format(max)}</span></div>
    </div>
  );
}
