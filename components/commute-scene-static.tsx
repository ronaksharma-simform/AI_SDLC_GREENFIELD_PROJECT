/**
 * Static illustrated fallback for the CoRide hero.
 *
 * Shown when the user prefers reduced motion (and during SSR / while the
 * Three.js scene is being lazy-loaded). Renders a low-poly car driving along a
 * gradient-lit road as a lightweight inline SVG — the same scene the WebGL
 * build draws, just frozen.
 */
export function CommuteSceneStatic({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1200 520"
      preserveAspectRatio="xMidYMid slice"
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="cs-sky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
          <stop offset="55%" stopColor="#8b5cf6" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#fb7185" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id="cs-glow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fb7185" />
          <stop offset="100%" stopColor="#f472b6" />
        </linearGradient>
        <linearGradient id="cs-road" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e1b4b" />
          <stop offset="100%" stopColor="#312e81" />
        </linearGradient>
        <linearGradient id="cs-car-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#fb7185" />
        </linearGradient>
      </defs>

      {/* Sky */}
      <rect width="1200" height="520" fill="url(#cs-sky)" />

      {/* Sun / glow */}
      <circle cx="960" cy="120" r="120" fill="url(#cs-glow)" opacity="0.5" />
      <circle cx="960" cy="120" r="64" fill="#fda4af" opacity="0.85" />

      {/* Distant rolling hills */}
      <path d="M0 380 Q 150 300 320 360 T 640 350 T 960 360 T 1200 330 L 1200 520 L 0 520 Z" fill="#4f46e5" opacity="0.25" />
      <path d="M0 420 Q 220 360 420 410 T 820 400 T 1200 410 L 1200 520 L 0 520 Z" fill="#4338ca" opacity="0.3" />

      {/* Road */}
      <polygon points="330,520 520,300 680,300 870,520" fill="url(#cs-road)" />

      {/* Road edge lines */}
      <line x1="360" y1="520" x2="536" y2="300" stroke="#e0e7ff" strokeOpacity="0.6" strokeWidth="3" />
      <line x1="840" y1="520" x2="664" y2="300" stroke="#e0e7ff" strokeOpacity="0.6" strokeWidth="3" />

      {/* Lane dashes */}
      <g stroke="#c7d2fe" strokeOpacity="0.7" strokeWidth="4" strokeLinecap="round">
        <line className="route-dash" x1="600" y1="300" x2="600" y2="348" />
        <line x1="602" y1="392" x2="602" y2="440" />
        <line x1="604" y1="486" x2="604" y2="520" />
      </g>

      {/* Low-poly car */}
      <g transform="translate(600 428)">
        {/* Shadow */}
        <ellipse cx="0" cy="34" rx="64" ry="10" fill="#1e1b4b" opacity="0.5" />
        {/* Wheels */}
        <circle cx="-38" cy="26" r="13" fill="#111827" />
        <circle cx="38" cy="26" r="13" fill="#111827" />
        {/* Body */}
        <polygon points="-58,10 -54,-14 -34,-26 34,-26 54,-14 58,10" fill="url(#cs-car-body)" />
        {/* Cabin */}
        <polygon points="-28,-26 -16,-46 22,-46 34,-26" fill="#312e81" />
        {/* Windows */}
        <polygon points="-22,-27 -14,-41 2,-41 6,-27" fill="#e0e7ff" opacity="0.9" />
        <polygon points="12,-27 16,-41 24,-41 28,-27" fill="#e0e7ff" opacity="0.9" />
        {/* Headlight */}
        <circle cx="-56" cy="-4" r="3.5" fill="#fef3c7" />
        <circle cx="56" cy="-4" r="3.5" fill="#fda4af" />
      </g>

      {/* Trees */}
      <g>
        <g transform="translate(120 380)">
          <rect x="-4" y="0" width="8" height="22" rx="2" fill="#312e81" />
          <polygon points="0,-44 -26,0 26,0" fill="#4f46e5" opacity="0.8" />
        </g>
        <g transform="translate(160 400)">
          <rect x="-3" y="0" width="6" height="16" rx="2" fill="#312e81" />
          <polygon points="0,-32 -20,0 20,0" fill="#4338ca" opacity="0.8" />
        </g>
        <g transform="translate(1030 380)">
          <rect x="-4" y="0" width="8" height="22" rx="2" fill="#312e81" />
          <polygon points="0,-44 -26,0 26,0" fill="#4f46e5" opacity="0.8" />
        </g>
        <g transform="translate(1080 402)">
          <rect x="-3" y="0" width="6" height="16" rx="2" fill="#312e81" />
          <polygon points="0,-32 -20,0 20,0" fill="#4338ca" opacity="0.8" />
        </g>
      </g>
    </svg>
  );
}
