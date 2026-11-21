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

| Status | Code                | When                                                                                                                |
| ------ | ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR`  | The params, query or body do not match the endpoint schema. `details` lists the issues (`path`, `message`, `code`). |
| 400    | `INVALID_JSON`      | The request body is not valid JSON.                                                                                 |
| 404    | `ROUTE_NOT_FOUND`   | No endpoint matches the method and path.                                                                            |
| 413    | `PAYLOAD_TOO_LARGE` | The JSON body is bigger than `JSON_BODY_LIMIT`.                                                                     |
| 429    | `RATE_LIMITED`      | The client sent more than `RATE_LIMIT_MAX` requests in `RATE_LIMIT_WINDOW_MS`.                                      |
| 500    | `INTERNAL_ERROR`    | Unexpected error. `details` is always `null` in production.                                                         |

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
