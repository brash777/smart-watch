# Snapia API

Every endpoint lives under the `/api` path and speaks JSON.

## Conventions

- **Success:** `{ "data": …, "meta": … }`. `meta` only appears when there is something to report, such as pagination.
- **Error:** `{ "error": { "code": "…", "message": "…", "details": … } }`.
  - `code` is a stable UPPER_SNAKE_CASE identifier; the web app maps it to Spanish text.
  - `message` is English and meant for developers.
  - `details` is `null` unless the error has more information (for example validation issues).
- **Request id:** every response has an `X-Request-Id` header. A valid UUID sent by the client in that header is reused; otherwise the API creates one. Logs include the same id.
- **Pagination:** lists accept `?limit=<n>&cursor=<id>` and answer `{ "data": [ … ], "meta": { "nextCursor": "…" } }`. `limit` defaults to `PAGINATION_DEFAULT_LIMIT` and cannot exceed `PAGINATION_MAX_LIMIT` (400 otherwise). Send `nextCursor` as `cursor` to get the next page; it is `null` on the last page.

## Common errors

| Status | Code                | When                                                                                                                                                                                                                         |
| ------ | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR`  | The params, query or body do not match the endpoint schema. `details` lists the issues (`path`, `message`, `code`).                                                                                                          |
| 400    | `INVALID_JSON`      | The request body is not valid JSON.                                                                                                                                                                                          |
| 401    | `UNAUTHENTICATED`   | The route needs a session and the `Authorization: Bearer <access token>` header is missing or invalid, or the token expired, or the account was deactivated. The client should call `POST /api/auth/refresh` once and retry. |
| 403    | `FORBIDDEN`         | The signed-in user does not have the role the route requires (for example `ADMIN`).                                                                                                                                          |
| 404    | `ROUTE_NOT_FOUND`   | No endpoint matches the method and path.                                                                                                                                                                                     |
| 413    | `PAYLOAD_TOO_LARGE` | The JSON body is bigger than `JSON_BODY_LIMIT`.                                                                                                                                                                              |
| 429    | `RATE_LIMITED`      | The client sent more than `RATE_LIMIT_MAX` requests in `RATE_LIMIT_WINDOW_MS`.                                                                                                                                               |
| 500    | `INTERNAL_ERROR`    | Unexpected error. `details` is always `null` in production.                                                                                                                                                                  |

## Health

### `GET /api/health`

Liveness check. Public: no authentication.

**Response 200**

```json
{
  "data": {
    "status": "ok",
    "appName": "Snapia",
    "uptime": 42,
    "version": "0.1.0"
  }
}
```

| Field     | Meaning                                |
| --------- | -------------------------------------- |
| `status`  | Always `ok` when the API answers.      |
| `appName` | Value of `APP_NAME`.                   |
| `uptime`  | Seconds since the API process started. |
| `version` | Version in `apps/api/package.json`.    |

## Auth

A session has two tokens:

- **Access token:** a short JWT (`JWT_ACCESS_TTL`, signed with `JWT_ACCESS_SECRET`) returned in the JSON body. Send it as `Authorization: Bearer <token>`.
- **Refresh token:** a JWT (`JWT_REFRESH_TTL`, signed with `JWT_REFRESH_SECRET`) in the `refresh_token` cookie: `HttpOnly`, `SameSite=Lax`, `Secure` in production, and only sent to `/api/auth`. The database stores only its SHA-256 hash. Browsers must call the API with credentials (`fetch(..., { credentials: 'include' })`).

`register` and `login` share a stricter rate limit: `AUTH_RATE_LIMIT_MAX` requests per client in `RATE_LIMIT_WINDOW_MS`.

**Session response** (`register`, `login`, `refresh`):

```json
{
  "data": {
    "accessToken": "eyJ…",
    "tokenType": "Bearer",
    "expiresIn": 900,
    "user": {
      "id": "0196…",
      "name": "Ana Demo",
      "username": "ana.demo",
      "email": "ana.demo@example.com",
      "role": "USER",
      "bio": null,
      "university": null,
      "avatarUrl": null,
      "createdAt": "2026-11-21T18:00:00.000Z"
    }
  }
}
```

`expiresIn` is the lifetime of the access token in seconds.

### `POST /api/auth/register`

Creates a `USER` account and signs it in. Public.

| Body field | Rules                                                                                                                                               |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`     | Required.                                                                                                                                           |
| `username` | 3–30 characters: lowercase letters, digits, dots and underscores; no dot at the start or end, no two dots in a row; `me` and `search` are reserved. |
| `email`    | A valid email address.                                                                                                                              |
| `password` | At least 8 characters with a letter and a digit (at most 72 bytes).                                                                                 |

`username` and `email` are trimmed and lowercased. **201** with the session and the refresh cookie. Errors: `400 VALIDATION_ERROR`, `409 EMAIL_TAKEN`, `409 USERNAME_TAKEN`, `429 RATE_LIMITED`.

### `POST /api/auth/login`

Body: `{ "identifier": "<email or username>", "password": "…" }`. Public.

**200** with the session and the refresh cookie. Errors: `400 VALIDATION_ERROR`, `401 INVALID_CREDENTIALS` (same answer for an unknown account and a wrong password), `403 ACCOUNT_DISABLED`, `429 RATE_LIMITED`.

### `POST /api/auth/refresh`

No body: it reads the `refresh_token` cookie. Rotates the token: the one used is revoked, and the response has a new session and a new cookie.

Errors: `401 INVALID_REFRESH_TOKEN` when the cookie is missing, invalid, expired or revoked, or the account is deactivated; the cookie is cleared. Reusing a revoked token also ends every session of that user, because the token may have been stolen. A web client must not send two refresh requests at the same time.

### `POST /api/auth/logout`

No body. Revokes the refresh token of the cookie (if any) and clears the cookie. Always **204**.

### `GET /api/auth/me`

Requires a session. **200** with the signed-in user (the `user` object of the session response). The API reloads the user on every authenticated request, so a deactivation or a role change applies immediately. Errors: `401 UNAUTHENTICATED`.

## Users

A **user summary** (search, followers, following) is `{ "id", "name", "username", "avatarUrl" }`. Public views of a user never include the email, the password hash or the role. `avatarUrl` stays `null` until profile photos exist.

### `GET /api/users/:username`

Public profile. Public, with an optional session (`Authorization` header) for `isFollowedByMe`. The username is case-insensitive.

```json
{
  "data": {
    "id": "0196…",
    "name": "Leo Demo",
    "username": "leo.demo",
    "avatarUrl": null,
    "bio": "Técnico de instalaciones.",
    "counts": { "posts": 3, "followers": 10, "following": 4 },
    "isFollowedByMe": false
  }
}
```

`counts.posts` leaves out Posts hidden by moderation; follower counts only include active users. `isFollowedByMe` is `false` for anonymous visitors and on your own profile. Errors: `404 USER_NOT_FOUND` (also for deactivated users).

### `PATCH /api/users/me`

Requires a session. Body with at least one of `name`, `bio` and `university`; an empty `bio` or `university` clears it. **200** with the signed-in user (same shape as `GET /api/auth/me`). Errors: `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`.

### `GET /api/users/search?q=<text>`

Public. Active users whose username or name contains `q` (case-insensitive), sorted by username, paginated. **200** with a page of user summaries. Errors: `400 VALIDATION_ERROR` (missing `q`, invalid `limit` or `cursor`).

## Admin: users

Every route requires a session with the `ADMIN` role: `401 UNAUTHENTICATED` without a session, `403 FORBIDDEN` for other roles. An **admin user** is a user summary plus `email`, `role`, `isActive` and `createdAt`.

### `GET /api/admin/users`

Every user, newest first, paginated. Optional filters: `q` (username, name or email contains), `role` (`USER` or `ADMIN`) and `isActive` (`true` or `false`).

### `PATCH /api/admin/users/:id/status`

Body: `{ "isActive": false }` or `{ "isActive": true }`. Deactivating an account ends all of its sessions at once: it cannot sign in, refresh or use its access token. **200** with the admin user.

### `PATCH /api/admin/users/:id/role`

Body: `{ "role": "ADMIN" }` or `{ "role": "USER" }`. The new role applies to the user's next request. **200** with the admin user.

Errors of both: `400 VALIDATION_ERROR`, `400 CANNOT_MODIFY_YOURSELF` (ADMINs cannot change their own role or status), `404 USER_NOT_FOUND`.

## Follows

### `POST /api/users/:username/follow` and `DELETE /api/users/:username/follow`

Require a session. Follow or unfollow a user. Both are idempotent: repeating them changes nothing and gives the same answer.

```json
{ "data": { "username": "leo.demo", "isFollowedByMe": true, "followersCount": 11 } }
```

Errors: `400 CANNOT_FOLLOW_YOURSELF`, `401 UNAUTHENTICATED`, `404 USER_NOT_FOUND` (unknown or deactivated user).

### `GET /api/users/:username/followers` and `GET /api/users/:username/following`

Public. The users who follow `:username`, or whom `:username` follows, newest follow first, paginated. Deactivated users are left out. **200** with a page of user summaries. Errors: `404 USER_NOT_FOUND`.

## Spaces

### Access to a Space

Every route under `/api/spaces/:spaceId` checks the caller's access before anything else:

- members act with their role: `VIEWER` < `EDITOR` < `OWNER`;
- in a `PUBLIC` Space, anyone (even without a session) may read, as a `VIEWER`;
- `404 SPACE_NOT_FOUND`: the Space does not exist or the id is malformed;
- `401 UNAUTHENTICATED`: no session and the Space is not `PUBLIC`;
- `403 FORBIDDEN`: not a member of a `PRIVATE` or `MEMBERS` Space, or a role below the one the route needs.

A **Space** in responses:

```json
{
  "id": "0196…",
  "name": "Cálculo II",
  "description": "Apuntes de las clases.",
  "mode": "STUDY",
  "color": "#4F46E5",
  "visibility": "PRIVATE",
  "metadata": { "subject": "Cálculo II", "professor": "Prof. Demo" },
  "coverSnapId": null,
  "archivedAt": null,
  "createdAt": "2026-11-21T18:00:00.000Z",
  "owner": { "id": "0196…", "name": "Ana Demo", "username": "ana.demo", "avatarUrl": null },
  "counts": { "snaps": 0, "members": 1 },
  "myRole": "OWNER"
}
```

`myRole` is `null` when you see a `PUBLIC` Space without being a member. `metadata` depends on the mode: `subject`, `professor`, `semester` (STUDY); `project`, `client`, `siteLabel` (WORK); `niche` (CONTENT). Every field is optional and fields of another mode are rejected.

### `POST /api/spaces`

Requires a session. Body: `name`, `mode` (`STUDY`, `WORK` or `CONTENT`), `color` (one of the `space_color_palette` setting), optional `description`, `visibility` (`PRIVATE` when omitted) and `metadata`. The creator becomes an `OWNER` member. **201** with the Space. Errors: `400 VALIDATION_ERROR`, `400 COLOR_NOT_IN_PALETTE` (`details.palette` lists the allowed colors).

### `GET /api/spaces`

Requires a session. The Spaces you own or joined, newest first, paginated. Filters: `mode`, and `archived=true` to list only archived Spaces (they are left out otherwise).

### `GET /api/spaces/:spaceId`

`VIEWER` (or anyone, for a `PUBLIC` Space). **200** with the Space.

### `PATCH /api/spaces/:spaceId`

`OWNER`. Body with any of `name`, `description`, `color`, `visibility` and `metadata`; the mode never changes and `metadata` is validated against it. Errors: `400 VALIDATION_ERROR`, `400 COLOR_NOT_IN_PALETTE`, `409 SPACE_HAS_MEMBERS` (a Space only becomes `PRIVATE` when its members are all OWNERs).

### `POST /api/spaces/:spaceId/archive` and `POST /api/spaces/:spaceId/unarchive`

`OWNER`. Archives or restores the Space (idempotent). An archived Space accepts no new snaps, invites or members. **200** with the Space.

## Space members

A **member** is `{ "user": <user summary>, "role": "EDITOR", "joinedAt": "…" }`. A Space always keeps at least one `OWNER`; when the user recorded as the Space's owner stops being an OWNER, the OWNER who joined first takes over.

### `GET /api/spaces/:spaceId/members`

`VIEWER` (or anyone, for a `PUBLIC` Space). Active members, OWNERs first, then by join date, paginated.

### `PATCH /api/spaces/:spaceId/members/:userId`

`OWNER`. Body: `{ "role": "OWNER" | "EDITOR" | "VIEWER" }`. **200** with the member. Errors: `404 MEMBER_NOT_FOUND`, `409 LAST_OWNER`, `409 SPACE_IS_PRIVATE` (a `PRIVATE` Space only has OWNERs).

### `DELETE /api/spaces/:spaceId/members/:userId`

`OWNER`. Removes the member; their snaps stay in the Space. **204**. Errors: `404 MEMBER_NOT_FOUND`, `409 LAST_OWNER`.

### `POST /api/spaces/:spaceId/leave`

Any member. **204**. Errors: `409 LAST_OWNER`, `409 NOT_A_MEMBER` (for example a visitor of a `PUBLIC` Space).

## Space invites

An **invite** as its OWNERs see it:

```json
{
  "id": "0196…",
  "code": "K7QM2XPA",
  "role": "EDITOR",
  "expiresAt": "2026-11-28T18:00:00.000Z",
  "maxUses": 30,
  "uses": 1,
  "revokedAt": null,
  "createdAt": "2026-11-21T18:00:00.000Z",
  "status": "ACTIVE"
}
```

`status` is `ACTIVE`, `EXPIRED`, `REVOKED` or `USED_UP`. Codes have `invite_code_length` characters drawn from a secure random source, without the confusing `I`, `L`, `O`, `0` and `1`.

### `POST /api/spaces/:spaceId/invites`

`OWNER`. Body: `role` (`EDITOR` or `VIEWER`), optional `expiresInHours` and `maxUses` (the `invite_default_ttl_hours` and `invite_default_max_uses` settings otherwise). A `PRIVATE` Space becomes `MEMBERS`. **201** with the invite. Errors: `400 VALIDATION_ERROR`, `409 SPACE_ARCHIVED`.

### `GET /api/spaces/:spaceId/invites`

`OWNER`. Every invite of the Space, newest first, with its status.

### `DELETE /api/spaces/:spaceId/invites/:inviteId`

`OWNER`. Revokes the invite (idempotent). **204**. Errors: `404 INVITE_NOT_FOUND`.

### `POST /api/spaces/join`

Requires a session; limited like login (`AUTH_RATE_LIMIT_MAX`). Body: `{ "code": "K7QM-2XPA" }` (case, spaces and dashes are ignored). The use is spent atomically, so two people can never take the last one.

```json
{
  "data": {
    "space": { "id": "0196…", "myRole": "EDITOR" },
    "role": "EDITOR",
    "alreadyMember": false
  }
}
```

(`space` is the full Space.) A member who enters a code again gets `alreadyMember: true`, keeps their role and spends no use. Errors: `404 INVITE_NOT_FOUND`, `410 INVITE_REVOKED`, `410 INVITE_EXPIRED`, `410 INVITE_USED_UP`, `409 SPACE_ARCHIVED`, `409 SPACE_IS_PRIVATE`.

## Snaps

A **snap** in responses:

```json
{
  "id": "0196…",
  "spaceId": "0196…",
  "author": { "id": "0196…", "name": "Leo Demo", "username": "leo.demo", "avatarUrl": null },
  "note": "Clase 3",
  "tags": ["pizarra", "examen"],
  "takenAt": "2024-05-01T10:30:00.000Z",
  "width": 1536,
  "height": 2048,
  "sizeBytes": 183402,
  "mimeType": "image/webp",
  "analysisStatus": "PENDING",
  "thumbnailUrl": "https://…signed…",
  "createdAt": "2026-11-21T18:00:00.000Z"
}
```

`thumbnailUrl` (and `imageUrl` in `GET /api/snaps/:id`) are signed URLs valid for `SIGNED_URL_TTL_SECONDS`; ask the API again for fresh ones. Tags are lowercased and never repeated.

### `POST /api/spaces/:spaceId/snaps`

`EDITOR` or `OWNER`. A `multipart/form-data` request:

| Field   | Content                                                                                                     |
| ------- | ----------------------------------------------------------------------------------------------------------- |
| `files` | One or more photos (at most `UPLOAD_MAX_FILES`, each at most `UPLOAD_MAX_MB`, types `UPLOAD_ALLOWED_MIME`). |
| `note`  | Optional text for every photo of the upload.                                                                |
| `tags`  | Optional: comma-separated (`pizarra, examen`) or the field repeated.                                        |

Each photo is checked by its real content, rotated according to its EXIF orientation and stripped of every metadata block (EXIF with GPS, XMP, IPTC, ICC); it is stored as WebP of at most `IMAGE_MAX_SIDE_PX`, with a `THUMBNAIL_SIDE_PX` thumbnail, under `spaces/<spaceId>/snaps/<uuid>.webp` and `…-thumb.webp`. `takenAt` comes from the EXIF date taken, or is the upload time. If one photo fails, nothing is stored. Every new snap is `PENDING` and emits the internal `snap.created` event (the AI analysis listens to it).

**201** with the list of snaps. Errors: `400 NO_FILES`, `400 TOO_MANY_FILES`, `413 FILE_TOO_LARGE`, `415 UNSUPPORTED_MEDIA_TYPE` (declared type not allowed), `415 UNSUPPORTED_IMAGE` (the content is not an allowed image), `409 SNAP_LIMIT_REACHED` (`max_snaps_per_space` setting), `409 SPACE_ARCHIVED`.

### `GET /api/spaces/:spaceId/snaps`

`VIEWER` (or anyone, for a `PUBLIC` Space). Most recently taken first, paginated. Filters: `tag`, `authorId`, `from` and `to` (dates, on `takenAt`) and `analysisStatus` (`PENDING`, `PROCESSING`, `DONE`, `FAILED`).

### `GET /api/snaps/:id`

Anyone who can see the snap's Space. **200** with the snap plus `imageUrl`. Errors: `404 SNAP_NOT_FOUND`, `401`, `403`.

### `PATCH /api/snaps/:id`

The author (while `EDITOR` or `OWNER` of the Space) or an `OWNER`. Body with `note` (empty to clear it) and/or `tags` (an array). **200** with the snap.

### `DELETE /api/snaps/:id`

Same permission as `PATCH`. Deletes the snap and its files from storage. **204**.
