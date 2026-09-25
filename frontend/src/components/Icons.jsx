export function Logo() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6c98ff" />
          <stop offset="1" stopColor="#9377ff" />
        </linearGradient>
      </defs>
      <rect x="18" y="6" width="28" height="52" rx="8" fill="none" stroke="url(#logoGrad)" strokeWidth="4.5" />
      <path d="M26 30l5 5 8-10" fill="none" stroke="url(#logoGrad)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckCircle() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="8.2" />
      <path d="M6.3 10.3l2.5 2.5 4.9-5.4" />
    </svg>
  );
}
