# ADR 0004 — Identity hiding & tiered disclosure (Privacy & Trust)

- **Status:** Accepted (direction) — implementation plan pending; source of requirements is the "Next Feature Research: Privacy & Usability" document.
- **Date:** 2026-08-25

## Context

CoRide markets itself as a platform where "every shared journey starts with a
known, verified face", yet today:

- `GET /api/rides/feed` and the ride-detail API return `provider.email` to any
  authenticated user, and the UI renders `provider.name ?? provider.email` as
  the public display name (`components/ride-feed.tsx`,
  `app/rides/feed/[id]/page.tsx`).
- `name` is optional and never editable, so email is the fallback identity
  everywhere. There is no profile/settings page, no avatar, no privacy control.
- No anonymous browsing exists; the feed is fully login-gated.
- `POST /api/auth/register` accepts an optional `role` from the client, a latent
  privilege-escalation risk.

The product ask was to "explore identity hiding from any anonymous user" and to
add features that make the app easier to use.

## Decision

Adopt a **tiered-disclosure privacy model** that separates public identity from
private identity and ties disclosure to the trust relationship with a ride.

1. **New public identity fields on `User`:** a unique public `handle` and an
   optional `avatarUrl`. Never display an email in any public (non-self,
   non-participant) surface.
2. **Tiers:**
   - Anonymous visitor: route/time/seats/vehicle only — no name, no email, no
     handle (unless the user opted to publish it).
   - Authenticated, unrelated user: adds the provider's public handle and
     optional avatar; vehicle details; still no email, no full name.
   - Accepted seeker / provider pairing: full display name + in-app messaging +
     (when In Progress) live location.
   - Self: full profile on a new `/profile` page.
3. **Account controls (`/profile` + `/api/me`):** edit name, set/change handle,
   upload avatar, privacy toggle ("show name to accepted riders only" default,
   or to anyone on CoRide), change password, delete account.
4. **Anonymous browsing (optional, product gate):** a public read-only feed with
   redaction; "Request to join" remains login-gated. At minimum, redact
   identity for all non-accepted users regardless of browsing mode.
5. **Security fix:** remove client-supplied `role` from `registerSchema` and the
   register route; role assignment is server-side only.
6. **Trust signal (recommended):** a post-trip 5-star rating/review so reputation
   replaces identity as the stranger-trust mechanism. Can be split into a
   follow-up slice.
7. **In-app-only contact is preserved.** No phone numbers exist in the schema.
   Phone-number masking (temporary proxy numbers via a CPaaS like Plivo/8x8/
   Exotel) is a **future extension**, not part of this slice.

## Consequences

- Eliminates the live email-leak: no authenticated stranger can see another
  user's email via the feed or ride detail.
- Marketing trust claims gain a real mechanism (public handle + optional rating)
  instead of exposing more identity.
- Requires a migration (`handle`, `avatarUrl`, privacy flag) plus deterministic
  handle backfill for existing users (with collision handling).
- Profile/account self-service is a net-new surface with new API routes and tests.
- Password reset / email verification require an outbound email provider (not in
  the current stack) — recorded as an explicit dependency, not silently skipped.
- Follows the industry pattern (Uber, Gojek, Grab) of first-name/handle display,
  in-app-only contact, and data minimisation (GDPR / DPDP-aligned).
