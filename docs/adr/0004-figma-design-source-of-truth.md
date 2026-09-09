# ADR 0004 — Figma as design source; implementation + ADRs as in-repo source of truth

- **Status:** Accepted
- **Date:** 2026-08-24

## Context

The CoRide UI is a visual implementation of a Figma design. A shareable Figma
file URL is not stored anywhere in this repository or in the project documents
list; the only durable records of the design are (a) the code itself
(`app/globals.css` design tokens, `tailwind.config.ts`, page and component
implementations) and (b) the design records that encode the visual decisions
(ADR 0001 — "Commute Gradient" design system, ADR 0002 — page-by-page redesign
details, ADR 0003 — trip-tracking additions).

Any future agent asked to "summarise the Figma", audit visual parity, or
re-derive the design will not find a link to fetch and must instead reconstruct
the design intent from these in-repo sources.

## Decision

- The **implementation is the source of truth** for design details in this
  workspace. `app/globals.css` (HSL token definitions for both themes) is the
  single token source; `tailwind.config.ts` maps tokens to Tailwind utilities;
  page/component code documents layout, copy, and behaviour per screen.
- Design summaries and parity checks reconstruct the Figma from the code and
  the ADRs, and state that the Figma link itself was not available rather than
  pretending the file was opened.
- If a Figma link or export is later added to the project, this ADR should be
  updated to point at it and any reconstructed notes should be reconciled
  against the real file.

## Consequences

- Design intent stays discoverable and reviewable inside the repo.
- A future agent can produce faithful summaries and spot-check visual
  consistency without external access.
- There is a known risk that non-visual Figma metadata (exact spacing grids,
  unused frames, spec-only notes) is lost; reconstructed summaries note where
  detail is inferred from implementation rather than the original file.
