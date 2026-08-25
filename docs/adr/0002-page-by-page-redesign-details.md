# ADR 0002 — Route-line motif, read-only vehicle list, and consolidated nav

- **Status:** Accepted
- **Date:** 2026-08-24

## Context

The detailed page-by-page redesign (spec v2.0) introduced the signature
"route-line" motif everywhere a literal route exists, restructured the primary
navigation, and added a Vehicle List page. Three implementation decisions were
not fully pinned by the spec and needed to be settled.

## Decision

### 1. Route-line motif is a CSS component, not an inline SVG

`components/route-line.tsx` renders the dot + gradient line + dot motif with
plain flex rows and the `route-line` / `route-line-dashed` / `route-line-skeleton`
CSS utilities. This avoids per-instance SVG `linearGradient` ids, so the motif
can be reused freely across server and client components (Ride Detail, Feed,
Requests, Chat header) without id collisions or hydration mismatches. It appears
wherever a literal route or connection exists and is intentionally absent on
vehicle, auth, and notifications pages.

### 2. Vehicle List is read-only (no edit/delete)

The spec's Vehicle List page asked for edit/delete icon actions, but the
existing `/api/vehicles` route exposes only POST (create) and the redesign was
scoped to "no API changes." Rendering dead action buttons would ship
non-functional UI, so the page is a read-only grid with a "Add Vehicle" CTA and
an empty state. Edit/delete can be added later when API endpoints exist.

### 3. Primary nav is consolidated to Dashboard / Rides / Vehicles / Messages

The spec (Section 6) prescribes those four primary links. The ride-seeking and
offer flows remain reachable through in-app CTAs (Dashboard "Offer a Ride" /
"Find a Ride", Ride Detail request entry points, Vehicle List "Add Vehicle",
request and notification deep-links) rather than cluttering the top-level nav.

## Consequences

- Consistent motif across all route surfaces with zero SVG-id collisions.
- Vehicle List deliberately omits edit/delete until the API grows.
- Users navigate the four hubs; secondary destinations stay one click away.
