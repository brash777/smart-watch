# Snapia API

Every endpoint lives under the `/api` path and speaks JSON.

## Conventions

- **Success:** `{ "data": …, "meta": … }`. `meta` only appears when there is something to report, such as pagination.
- **Error:** `{ "error": { "code": "…", "message": "…", "details": … } }`.
  - `code` is a stable UPPER_SNAKE_CASE identifier; the web app maps it to Spanish text.
  - `message` is English and meant for developers.
  - `details` is `null` unless the error has more information (for example validation issues).
- **Request id:** every response has an `X-Request-Id` header. A valid UUID sent by the client in that header is reused; otherwise the API creates one. Logs include the same id.

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
