import { useState } from 'react'

const LOGO_URL =
  'https://waterfrontsolutionsmi.com/wp-content/uploads/2023/12/west-michigan-deck-and-stair-builders.png'

// Brand mark. Tries the real logo; falls back to a clean wordmark so the demo
// never shows a broken image (drop the real asset in later).
export default function Logo({ className = '', dark = false }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
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
          <div className="text-sm font-extrabold tracking-wide">WATERFRONT</div>
          <div className="text-[10px] font-semibold tracking-[0.2em] opacity-80">SOLUTIONS</div>
        </div>
      </div>
    )
  }
  return (
    <img
      src={LOGO_URL}
      alt="Waterfront Solutions"
      className={`object-contain ${className}`}
      onError={() => setFailed(true)}
    />
  )
}
