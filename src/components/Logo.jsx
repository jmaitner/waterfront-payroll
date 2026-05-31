// Neutral product mark — wave icon + wordmark. No customer branding, so the
// app is white-label and ready to drop into any company's portal.
export default function Logo({ className = '', dark = false }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden>
        <path
          d="M2 17c2 0 2-1.5 4-1.5S10 17 12 17s2-1.5 4-1.5S18 17 20 17"
          stroke={dark ? '#0A2540' : '#7FB8E6'}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M2 13c2 0 2-1.5 4-1.5S10 13 12 13s2-1.5 4-1.5S18 13 20 13"
          stroke={dark ? '#13456E' : '#fff'}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <div className={`leading-tight ${dark ? 'text-navy' : 'text-white'}`}>
        <div className="text-sm font-extrabold tracking-wide">CREW</div>
        <div className="text-[10px] font-semibold tracking-[0.2em] opacity-80">TIME CLOCK</div>
      </div>
    </div>
  )
}
