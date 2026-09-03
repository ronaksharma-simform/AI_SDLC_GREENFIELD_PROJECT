# ADR 0001: NextAuth Credentials provider with JWT sessions

- Status: Accepted
- Date: 2026-02-14 (task: Login and logout via NextAuth Credentials with JWT session)

## Context

CoRide authenticates employees with an organization email and password. Users
are stored in the Prisma `User` table (`id`, `name`, `email`, `passwordHash`,
`organization`, `role`, timestamps); registration is implemented by
`POST /api/auth/register` (bcrypt-hashed passwords, role defaulting to
`MEMBER`). We need login/logout backed by NextAuth and a way for server code to
know who the caller is and what role they hold.

## Decision

- Use **NextAuth v4** with a single **Credentials** provider exposed through the
  catch-all route `app/api/auth/[...nextauth]/route.ts`.
- Use **JWT session strategy** (`session.strategy = 'jwt'`) — required for the
  Credentials provider, and it keeps session validation off the database.
- The **`jwt` and `session` callbacks carry `user.id` and `user.role`**: the
  `jwt` callback copies them from the signed-in user onto the token, and the
  `session` callback copies them from the token onto `session.user`. Type
  augmentation lives in `types/next-auth.d.ts`. This lets `getServerSession`
  consumers authorize by role without an extra DB query per request.
- `authorize` validates input with `loginSchema`, looks the user up by email
  through the shared `prisma` singleton, and compares the password with
  `bcrypt.compare`. **Unknown email, wrong password, and malformed input all
  return `null`**, so the client always shows the single message "Invalid email
  or password" and sign-in failures cannot be used to enumerate accounts.
- The **login page** (`app/login/page.tsx`) is a client component that calls
  `signIn('credentials', { redirect: false, ... })` from `next-auth/react` and
  only surfaces the generic failure message. Logout is a small client component
  (`components/sign-out-button.tsx`) that calls `signOut`.

### Why no `@next-auth/prisma-adapter` in this configuration

NextAuth's database adapter layer exists to persist OAuth accounts/sessions and
to translate NextAuth's generic user shape to a provider's schema. With the
Credentials provider plus JWT sessions the adapter is never invoked at runtime:
identity comes from `authorize` and the signed JWT. CoRide's `User` table is
deliberately custom (`passwordHash`, `role`, `organization`) and the schema has
no `Account`/`Session`/`VerificationToken` models, so wiring an adapter would
add a dependency that is both unused and incompatible with the existing schema.

Instead, `authorize` queries `prisma.user` directly — Prisma remains the single
source of truth for credentials. If an OAuth provider is ever added, introduce
`@next-auth/prisma-adapter` together with the extra models and a migration at
that point.

## Consequences

- No session rows in the database; logouts are purely client-side cookie
  clearing and therefore immediate.
- Role changes take effect only after the user signs in again (the JWT carries
  a snapshot). A future "refresh token from DB" policy can be layered into the
  `jwt` callback if role revocation latency becomes a concern.
- Any protected route/page uses `getServerSession(authOptions)` and the typed
  `session.user.id` / `session.user.role` fields.
