# BetterDoc Security And Access

Last updated: 2026-02-14

## Current Security Model
- Authentication: WorkOS AuthKit SSO.
- Session middleware: `authkitMiddleware()` in `src/start.ts`.
- Authorization: team membership + team role checks in Convex function handlers.
- Visibility boundary: posts/comments are only visible to members of the assigned team.

## WorkOS Configuration
### Public client env
- `VITE_WORKOS_CLIENT_ID`
- `VITE_WORKOS_REDIRECT_URI`

### Server env
- `WORKOS_API_KEY`
- `WORKOS_CLIENT_ID`
- `WORKOS_REDIRECT_URI`
- `WORKOS_COOKIE_PASSWORD`
- Optional cookie controls:
  - `WORKOS_COOKIE_NAME`
  - `WORKOS_COOKIE_MAX_AGE`
  - `WORKOS_COOKIE_DOMAIN`
  - `WORKOS_COOKIE_SAME_SITE`

## Auth Flow
1. User opens `/login`.
2. App redirects to WorkOS sign-in.
3. WorkOS redirects to `/api/auth/callback`.
4. AuthKit stores encrypted session cookie.
5. Protected routes (`/dashboard`, `/posts/$postId`, `/teams`, `/profile`) verify `context.auth()`.
6. `/logout` clears session and signs out through WorkOS.

## Team Role Model (V2)
Roles:
- `admin`
- `teamleader`
- `senior`
- `mid`
- `junior`

Permission summary:
- Any team member (`admin/teamleader/senior/mid/junior`):
  - read team posts/comments
  - create posts/comments
- Post edit:
  - post creator only
- Post archive/unarchive:
  - post creator OR `teamleader` OR `admin`
- Team management:
  - invites/role assignment/member removal by `teamleader` and `admin`
  - `teamleader` cannot assign or manage `admin`
- Comment edit:
  - comment author only
- Comment delete:
  - comment author OR `teamleader` OR `admin`

## Enforcement Locations
- Shared guards:
  - `convex/auth.ts`
- Team/domain handlers:
  - `convex/teams.ts`
  - `convex/posts.ts`
  - `convex/comments.ts`
- Frontend hides actions opportunistically, but server-side Convex checks are authoritative.

## File Upload Security
- Upload URL issuance: `files.generateUploadUrl`.
- Attachment validation: `files.attachUploadedFile`.
- MIME allowlist:
  - `image/jpeg`
  - `image/png`
  - `image/webp`
- File size limit: `10MB` per file.
- Count limits:
  - Post images: max 6
  - Comment images: max 4

## Environment Validation
Implemented in `src/config/env.shared.ts` and run by `bun run env:validate`.

Key checks include:
- `VITE_APP_ENV` must be `dev|staging|prod`
- HTTPS redirect URIs required in staging/prod
- `WORKOS_COOKIE_PASSWORD` minimum length
- `WORKOS_CLIENT_ID` and `WORKOS_REDIRECT_URI` must match their `VITE_` counterparts

## Notes
- Legacy RBAC/audit/watchlist/component-explorer access model was removed as part of the V2 redesign.
- No Azure pipeline trust or scanner ingestion permissions are part of current app security boundaries.
