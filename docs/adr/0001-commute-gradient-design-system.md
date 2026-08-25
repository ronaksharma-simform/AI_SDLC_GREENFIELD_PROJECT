# ADR 0001 — "Commute Gradient" design system and Three.js hero

- **Status:** Accepted
- **Date:** 2026-08-24

## Context

CoRide needed a bold visual identity and an interactive landing experience
without touching any existing functionality, forms, or data. The redesign was
scoped to the presentation and interaction layer only.

Two signature choices had to be made:

1. A unified colour system across the whole app (previously a generic
   zinc/indigo shadcn palette).
2. A hero background that reinforces the ride-sharing theme (a car on a road)
   rather than generic decoration, while staying lightweight and accessible.

## Decision

### 1. Indigo → coral "Commute Gradient" token system

- The palette remains fully token-driven: `app/globals.css` defines HSL custom
  properties consumed by `tailwind.config.ts` (standard shadcn/ui setup).
- The brand gradient is exposed as `--brand-from` (indigo, hue ~245) and
  `--brand-to` (coral, hue ~15), with both light and dark variants.
- Gradient utilities live in `app/globals.css`:
  - `text-gradient-brand` / `text-gradient-brand-animated` — gradient headline
    text with an optional animated background-position sweep.
  - `bg-gradient-brand` / `bg-gradient-brand-soft` / `bg-gradient-brand-shine` —
    gradient surfaces, soft washes, and glossy button fill.
- `coral` was added as a first-class Tailwind colour.
- The Three.js scene reads the same CSS tokens at runtime so its lights and fog
  match the active theme automatically.

### 2. Three.js low-poly commute scene (landing hero only)

- `components/commute-scene.tsx` (client) renders a static illustrated SVG
  frame (`commute-scene-static.tsx`) during SSR/first paint and as the
  `prefers-reduced-motion` fallback. When motion is allowed, it lazily imports
  `lib/commute-scene.ts`, which builds a low-poly car driving along a
  gradient-lit road.
- Constraints honoured:
  - **Lightweight:** box/cylinder geometry only, no textures, pixel ratio
    capped at `min(devicePixelRatio, 2)`, render loop pauses when the tab is
    hidden, all GPU resources disposed on unmount.
  - **No click interception:** the scene container is `absolute`, `z-0`,
    `pointer-events-none`; interactive hero content sits at `z-10`.
  - **Hero-only:** the scene is mounted only in the landing hero section; other
    pages use the token system alone.
  - **Reduced motion:** `prefers-reduced-motion: reduce` keeps the static SVG
    frame and disables decorative CSS animations globally.

### 3. Interaction layer

- shadcn/ui primitives gained micro-interactions: gradient default button with
  hover lift + glow + active scale, card hover lift with brand-tinted border,
  input/select/textarea hover + focus ring colour, gradient badge variant.
- Header/footer use the gradient accent; landing hero and dashboard use
  gradient heroes with the route-line motif.

## Consequences

- Visual identity is consistent and theme-aware, controlled from a single token
  file.
- The `three` dependency is only fetched by browsers that want motion, keeping
  the initial JS payload for the landing page essentially unchanged (~117 kB
  first load).
- No API, database, auth, or form behaviour changed; the full test suite
  (268 tests) passes and `next build` succeeds.
- Future theming work should extend the token file rather than hardcoding
  colours, so the gradient system stays the single source of truth.
