---
name: api-module
description: Create or change a backend feature module in apps/api (routes, controller, service, repository, Zod schemas, authorization, tests). Use when adding or modifying an API endpoint.
---

# API feature module

Every backend feature is a module with four layers (routes → controller → service → repository) plus its Zod schemas and its tests. Each layer has one job. Do not skip layers and do not mix their jobs.

## 1. Module layout

```text
apps/api/src/modules/<feature>/
├── <feature>.routes.ts       # Express router: paths and middleware chain
├── <feature>.controller.ts   # HTTP only: read the validated request, call the service, send the response
├── <feature>.service.ts      # business rules, throws AppError
├── <feature>.repository.ts   # the only file that uses Prisma
├── <feature>.schemas.ts      # Zod schemas for params, query and body
└── <feature>.test.ts         # Supertest tests
```

`<feature>` is kebab-case and usually the plural resource: `spaces`, `snaps`, `space-invites`, `posts`.

## 2. Step by step

### Step 1: define the endpoint

1. Read the feature's rules in `docs/PRODUCT.md`: glossary, Space roles, privacy.
2. Decide the method, the path, who may call it and the minimum Space role (`VIEWER` < `EDITOR` < `OWNER`).
3. Paths are lowercase, plural and kebab-case, nested under the Space when the resource belongs to one: `GET /spaces/:spaceId/snaps`, `POST /spaces/:spaceId/invites`.

### Step 2: schemas (`<feature>.schemas.ts`)

- One Zod schema per endpoint, describing its `params`, `query` and `body`.
- Shapes the web app also uses (request bodies, response DTOs, enums) are defined in `packages/shared` and imported here. Never duplicate them.
- Export the inferred types with `z.infer` (e.g. `CreateInviteInput`).
- Validate ids as UUIDs.
- Validate shape and types in the schema. Configurable limits (page size, maximum invite uses, file size) come from `config` or AppSetting and are never number literals in a schema: check them in the service, or build the schema from `config`.

### Step 3: repository (`<feature>.repository.ts`)

- The only file of the module that imports the Prisma client.
- Small functions with clear names: `findSpaceById`, `listSnapsBySpace`, `createInvite`.
- `select` only the fields you need, and never return secrets such as password hashes or tokens.
- No business rules, no HTTP, no `AppError`: return data, or `null` when nothing is found.

### Step 4: service (`<feature>.service.ts`)

- Business rules live here: "only the author can publish a snap", "an invite cannot be used after it expires", limits.
- Expected failures throw `AppError(code, message, status)`, e.g. `new AppError('SNAP_NOT_FOUND', 'Snap not found', 404)`.
- `code` is UPPER_SNAKE_CASE and stable: the web app maps it to Spanish text. `message` is English, for developers.
- Limits and thresholds come from `config` (environment) or from AppSetting (the settings service). No magic numbers.
- No `req`/`res` and no Prisma: call repositories.

### Step 5: controller (`<feature>.controller.ts`)

- HTTP only: take the validated input from the request, call the service, send the response.
- Success responses are `{ data, meta }`. `meta` is only there when it carries something, such as pagination.
- Do not catch errors to format them: let them reach the central error middleware.

```ts
export async function createInvite(req: Request, res: Response): Promise<void> {
  const invite = await spaceInvitesService.createInvite(req.spaceAccess, req.body);
  res.status(201).json({ data: invite });
}
```

### Step 6: routes (`<feature>.routes.ts`)

Middleware order: `authenticate` → `requireRole(...roles)` (global roles, e.g. ADMIN routes) → `requireSpaceRole(minRole)` (routes that touch a Space) → `validate(schema)` → controller.

```ts
export const spaceInvitesRouter = Router();

spaceInvitesRouter.post(
  '/spaces/:spaceId/invites',
  authenticate,
  requireSpaceRole('OWNER'),
  validate(createInviteSchema),
  spaceInvitesController.createInvite,
);
```

- `authenticate`: 401 without a valid session.
- `requireRole(...roles)`: 403 when the user's global role is not in the list.
- `requireSpaceRole(minRole)`: loads the Space and the caller's membership and attaches them to the request as `req.spaceAccess` (read it with `requireSpaceAccess(req)`). Put `optionalAuth` before it on read routes of `PUBLIC` Spaces, `authenticate` everywhere else.
  - **404** `SPACE_NOT_FOUND` when the Space does not exist or the `spaceId` is malformed.
  - **401** `UNAUTHENTICATED` without a session when the Space is not `PUBLIC`.
  - **403** `FORBIDDEN` when the caller is not a member of a non-`PUBLIC` Space, or their role is below `minRole`.
  - In a `PUBLIC` Space, non-members get read-only (`VIEWER`) access.
- `validate(schema)`: parses `params`, `query` and `body`. Invalid input gets a 400 whose `error.details` lists the issues. Controllers and services only use validated values.

### Step 7: pagination for lists

Use cursor pagination:

- Query: `?cursor=<id>&limit=<n>`. The default and the maximum `limit` come from `config`; a larger value fails validation (400).
- Order by a stable key: `createdAt` descending, then `id` descending.
- Fetch `limit + 1` rows to know whether there is a next page.
- Response: `{ data: [...], meta: { nextCursor } }`, with `nextCursor: null` on the last page.

### Step 8: register and document

1. Mount the router in `apps/api/src/app.ts`.
2. Document the endpoint in `docs/api.md`: method and path, authentication and minimum role, params, query and body, a response example and the possible error codes.

### Step 9: tests (`<feature>.test.ts`)

Use Supertest against the Express app: no real network and no real AI (`MockAiProvider`). Every endpoint covers at least:

| Case                                                                   | Expected                                  |
| ---------------------------------------------------------------------- | ----------------------------------------- |
| Happy path                                                             | 200 or 201 and the `{ data, meta }` shape |
| Invalid input                                                          | 400 with `error.code` and `error.details` |
| No session                                                             | 401                                       |
| Not allowed (not a member, role too low, not the author, not an ADMIN) | 403                                       |
| Not found (missing or malformed id)                                    | 404                                       |

```ts
describe('POST /spaces/:spaceId/invites', () => {
  it('creates an invite for the OWNER', async () => {
    /* … */
  });
  it('returns 400 when the body is invalid', async () => {
    /* … */
  });
  it('returns 401 without a session', async () => {
    /* … */
  });
  it('returns 403 for an EDITOR', async () => {
    /* … */
  });
  it('returns 404 when the Space does not exist', async () => {
    /* … */
  });
});
```

Each test creates the data it needs (users, Spaces, memberships) and does not depend on other tests.

## 3. Response shapes

```json
{ "data": { "id": "…" }, "meta": { "nextCursor": null } }
```

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "details": [{ "path": "body.maxUses", "message": "Expected number" }]
  }
}
```

## 4. Checklist

- [ ] Four layers, each doing only its job; Prisma only in the repository.
- [ ] Every input validated with Zod; shared shapes in `packages/shared`.
- [ ] `authenticate`, plus `requireSpaceRole` or `requireRole`, on every protected route.
- [ ] No magic numbers: limits from `config` or AppSetting.
- [ ] Responses follow `{ data, meta }` and `{ error: { code, message, details } }`.
- [ ] Router mounted in `app.ts`; endpoint documented in `docs/api.md`.
- [ ] Tests for 2xx, 400, 401, 403 and 404 pass.
