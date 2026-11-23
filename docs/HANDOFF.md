# Snapia: handoff for the next agent

Read this file, then [CLAUDE.md](../CLAUDE.md), [docs/PRODUCT.md](PRODUCT.md) and [docs/api.md](api.md) before you change anything. They are the source of truth; this file says where the work stands on 2026-11-23 and what is left.

## 1. What Snapia is

An AI instant-photo app for a university project ("Smart Wash"). People take quick photos ("snaps") and save them in Spaces. Each Space has a mode, and the AI turns the snaps into work:

| Mode    | AI output per snap (SnapInsight)                       | Compose types (Documents)                    | Extra tools                |
| ------- | ------------------------------------------------------ | -------------------------------------------- | -------------------------- |
| STUDY   | Extracted text (Markdown), topics, key concepts        | STUDY_NOTES, STUDY_SUMMARY, ASSIGNMENT_GUIDE | Flashcards, quiz, Ask chat |
| WORK    | Activity, progress, issues with severity, safety notes | WORK_DAILY_REPORT, WORK_PROGRESS_REPORT      | Ask chat                   |
| CONTENT | Quality score 0-100, tips, caption, hashtags, alt text | CONTENT_POST, CONTENT_CAROUSEL               | Ask chat, Posts            |

A social layer sits on top: Moments (24 h), Posts, feed, likes, comments, Explore by hashtag, public profiles. A Wear OS companion app shows the same data on a watch.

The demo the user must be able to give, from a phone: take photos of a class, see the AI analysis, generate notes and a quiz, publish a post, and another account likes it. Then show the watch.

## 2. Rules you must follow

They are all in CLAUDE.md and `.claude/skills/*/SKILL.md` (read the skills as reference documents: `snapia-conventions`, `api-module`, `ai-vision-task`, `prisma-change`, `react-feature`, `git-commit`). The ones that are easiest to break:

- **Glossary names exactly** (`Space`, `Snap`, `SnapInsight`, `Moment`, …). No synonyms in code. Spanish only in UI text.
- **English** for code, comments, commits and docs. **Spanish** for every user-facing string, and only in `apps/web/src/i18n/locales/es.json` (web) or `apps/wear/app/src/main/res/values/strings.xml` (watch). Keys are typed: a missing key fails the typecheck.
- **No hardcoded values**: no URLs, ports, credentials, app name, model names, limits, thresholds or durations in code. They live in `.env` (validated with Zod in `apps/api/src/config/env.ts` and `apps/web/src/config/env.ts`, documented in `.env.example`), in the `AppSetting` table (seeded from `apps/api/prisma/seed-data/app-settings.json`, editable in `/admin`), or in prompt files. The web reads AppSettings and upload limits through `GET /api/app-config`. UI feedback must not depend on a timer constant (that is why the Moment viewer advances on tap and "Copiado" stays until the text changes).
- **API layers**: routes → controller → service → repository; only repositories use Prisma; every input validated with Zod; errors are `AppError(code, message, status, details)`; responses `{ data, meta }` / `{ error: { code, message, details } }`. Every Space route checks membership and role (`requireSpaceRole`).
- **Web**: one HTTP client (`apps/web/src/lib/http.ts`, with refresh-and-retry once on 401 and `apiUpload` with progress); TanStack Query hooks per feature; design tokens only (`apps/web/src/styles/tokens.css`, Tailwind 4 `@theme` with the default palette, radii and fonts turned off, so `bg-gray-*`, `rounded`, `font-mono` do not exist); the look of each mode comes from `apps/web/src/config/modes.ts`.
- **AI**: services call tasks, tasks call the `AiProvider` interface; output validated with Zod and retried once; every call is an `AiRun`; no emails, phone numbers or other users' data are sent to the AI; prompts are versioned files (`prompts/<task>.v<N>.md`), never edited after commit.
- **Git**: Conventional Commits in English, small and atomic. Never add `Co-Authored-By` or "Generated with" lines, never use `--no-verify`, never change `git config user.*`, never force-push or rewrite pushed history. `git config core.hooksPath .githooks` must be set. Push to `origin main` after each finished block.
- **Dependencies**: pick versions released at least 14 days ago. Do not bump the pinned ones blindly: Prisma `~7.10.1` (npm's `latest` for `prisma` is an 8.0 RC), TypeScript `~6.0` (typescript-eslint needs < 6.1), pdfkit `~0.20.2`, Chainguard MinIO images in `docker-compose.yml`.
- **Local machine**: another project of the user may listen on `[::1]:5173`. Never kill processes you did not start.

## 3. Repository map

```text
apps/api      Express 5 + Prisma 7 + PostgreSQL + MinIO/S3 + Claude (AiProvider: anthropic | mock)
  src/modules/<feature>/   routes, controller, service, repository, schemas, tests
  src/modules/ai/          provider, runner, queue, prompts/*.md, fixtures/*.json (mock answers), tasks/
  prisma/                  schema, migrations, seed + seed-data/*.json
apps/web      React 19 + Vite 8 + react-router 8 + TanStack Query 5 + Tailwind 4 + i18next, PWA
  src/features/<feature>/  pages, components, hooks, api.ts
  src/components/          shared UI (Button, Markdown, Avatar, ModeTile, states…)
apps/wear     Wear OS app: Kotlin, Compose for Wear OS (material3 1.7.0), AGP 9.4.1, Gradle 9.8.2 wrapper
  app/src/main/java/com/smartwash/snapia/wear/  MainActivity.kt (screens), SnapiaApi.kt (HTTP + JSON)
packages/shared  Zod schemas and types used by api and web (never duplicate them)
docs          PRODUCT.md (rules, glossary), api.md (every endpoint), HANDOFF.md (this file)
.github/workflows/ci.yml   npm ci, typecheck, build
```

## 4. Run it

```bash
cp .env.example .env        # once; the user's .env already exists, never commit it
npm install
npm run db:up               # PostgreSQL + MinIO (Docker)
npm run db:migrate && npm run db:seed
npm run dev:api             # http://localhost:4000/api/health
npm run dev:web -- --host   # prints a Network URL for a phone on the same Wi-Fi
```

- The web calls the API through the Vite proxy (`VITE_API_URL=/api`), so the phone only needs the web URL.
- Checks: `npm run lint`, `npm run typecheck`, `npm test` (the API tests need `db:up`; they use `TEST_DATABASE_URL`, never `DATABASE_URL`), `npm run build`, `npm run format:check`.
- The seeded ADMIN (credentials in `.env`, `SEED_ADMIN_*`) opens `/admin`.
- **Watch**: start a Wear OS emulator (Android Studio → Device Manager; the user has "Wear OS Large Round", API 37, arm64). Then:

  ```bash
  export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
  export ANDROID_HOME="$HOME/Library/Android/sdk"
  cd apps/wear && ./gradlew assembleDebug
  ADB="$ANDROID_HOME/platform-tools/adb"
  $ADB reverse tcp:4000 tcp:4000 && $ADB reverse tcp:9000 tcp:9000   # API and MinIO as localhost
  $ADB install -r app/build/outputs/apk/debug/app-debug.apk
  $ADB shell am start -n com.smartwash.snapia.wear/.MainActivity
  ```

  The API URL of the watch is `snapia.apiUrl` in `apps/wear/gradle.properties`. Or open `apps/wear` in Android Studio and press Run.

## 5. What is done

Delivered as parts 0-14 plus a final part; each line is one pushed commit (newest last).

- **Foundation and API** (parts 0-8): auth with rotating refresh cookie, users and avatars, follows, admin users; Spaces with modes and metadata, members, invite codes and join; snap upload (content check, EXIF/GPS stripped, WebP + thumbnail, signed URLs); background AI analysis queue per mode, insight read/edit/reanalyze, analysis status for polling; Compose of Documents with `[Snap N]` citations, PDF/Markdown export, ASSIGNMENT_GUIDE integrity notice; flashcards, quizzes scored by the API, Ask chat with citations; Moments, Posts, feed, Explore, trending, likes, comments, one `canViewSnap` rule for every photo URL. About 310 API tests in 39 files.
- **Web base** (part 9, `38c39b0`, `e10fce5`): Vite app, auth with in-memory access token, bottom navigation, design tokens, PWA. 4 login tests.
- `1ff6d96` **Spaces, camera and viewer**: list and create by mode (`GET /api/app-config` added for the palette and upload limits), Space tabs (Snaps grid with analysis badges, Documents, Study for STUDY, Ask, Members with invite codes shared by WhatsApp/link and `/join/:code`), camera page (`capture="environment"`, multiple, browser downscale to `IMAGE_MAX_SIDE_PX`, upload progress), polling every `analysis_poll_interval_ms`, full-screen swipe viewer with the insight per mode, reanalyze, share as Moment, delete.
- `4ba925a` **Compose and study**: multi-select of analyzed snaps → "Crear con IA" (type of the mode, instructions required for ASSIGNMENT_GUIDE) → Markdown editor with preview, integrity notice, PDF/MD download; flashcards that flip and scored quiz; Ask chat with cited snaps.
- `ab54ce0` **Social**: Moments bar and viewer (progress bars, tap to advance), feed with like by double tap and comments, create Post from snaps with the AI draft, Explore by hashtag, profiles (`/u/:username` without a session too, follow button, posts grid).
- `fa90a5b` **Admin**: `/admin` with cards (users, snaps by mode, documents, estimated AI cost), activate/deactivate users, edit every AppSetting (`GET/PATCH /api/admin/settings`, `GET /api/admin/stats`).
- `d30b176` CI, `87f973c` README, tag `v1.0.0`.
- `e973b6d`, `485c7ee` **Wear OS app**: sign in, Spaces, snaps with analysis (Markdown/LaTeX shown as plain text), flashcards, quiz, feed with like by double tap.

## 6. What was verified, and what was not

Verified:

- Lint, typecheck, Prettier and build green at every commit; API tests green when the API changed (only `app-config` got new tests in the final part).
- A scripted headless-Chrome run at phone size (390×844) through the LAN URL, with `AI_PROVIDER=mock`: create a STUDY Space → upload a photo → analysis DONE → viewer shows the extracted text → Compose STUDY_NOTES → quiz graded → Post with AI draft → a second account sees it in the feed and likes it by double tap → public profile. The browser ran on the Mac, so photo URLs on `localhost` worked.
- Admin endpoints with curl (stats, settings list, invalid value → `400 INVALID_SETTING_VALUE`).
- On the Wear OS emulator: sign in, Spaces, snap photo, analysis, flashcards (flip), quiz questions, feed.

Not verified:

- **The real AI.** `.env` has `AI_PROVIDER=mock` and no `ANTHROPIC_API_KEY`, so every analysis is the same fixture (a STUDY snap always "reads" the chain rule). `AnthropicAiProvider` is only covered by tests with a mocked SDK.
- A real phone (see 7.2), the GitHub Actions run, the watch's double-tap like and quiz score screen, and the last watch changes (plain text, plural, quiz scroll) on screen.

## 7. Known problems

1. **Mock AI.** Real analysis needs `AI_PROVIDER=anthropic` and the user's `ANTHROPIC_API_KEY` in `.env` (costs a few cents per photo). The user decides; never ask them to paste the key into a chat. After switching, run the full flow and read the outputs of each prompt in Spanish (`ai_output_language=es`).
2. **Photos do not load on a real phone.** `docker-compose.yml` binds MinIO to `127.0.0.1:9000`, and `S3_ENDPOINT=http://localhost:9000` makes every signed URL point at `localhost`, which on the phone is the phone. Fix for local demos, with the user's approval: let MinIO listen on the LAN (a variable for the bind address in `docker-compose.yml`, defaulting to `127.0.0.1`) and set `S3_ENDPOINT` to the Mac's LAN IP. Then the watch also gets LAN URLs: allow that host in `apps/wear/app/src/main/res/xml/network_security_config.xml` (or a debug-only cleartext base config).
3. **Taken date lost on scaled uploads.** The browser re-encodes photos bigger than `IMAGE_MAX_SIDE_PX` (`apps/web/src/features/capture/lib/compress-photo.ts`), which drops EXIF, so `takenAt` becomes the upload time. WORK timelines need the real date. Fix: read `DateTimeOriginal` (+ `OffsetTimeOriginal`) from the original JPEG and write a minimal EXIF segment into the new JPEG, or send it in a new upload field.
4. **Typing on the watch is hard.** The user found the watch app hard to use and to explain. Proposal waiting for the user's answer: "Conectar reloj" in the web profile shows a 6-digit code (new API endpoints: create a short-lived pairing code for the signed-in user; exchange it for a session on the watch), and a watch home with two big buttons: "Repasar" (flashcards/quiz of the latest STUDY Space) and "Lo último" (latest analyzed snap). Also: the watch keeps the access token only in memory (expires after `JWT_ACCESS_TTL`), so it must sign in again.
5. **Bundle size.** The main web chunk is about 860 kB (Vite warns). Only the snap viewer is lazy; make the other routes lazy too.
6. Small: after logging out from `/profile`, the next login goes back to `/profile`; unused i18n keys (`home.intro`, `explore.intro`, `capture.intro`).

## 8. What is missing (prioritized)

Each item needs its tests (section 9) and its docs (`docs/api.md` for endpoints, README when it changes how to run something).

**P0: before the next demo**

- Decide and apply 7.1 (real AI) and 7.2 (photos on the phone) with the user; then run the manual checklist of section 9 on a real phone and on the watch.
- Web test for creating a Space (required by part 10 and still missing): mode choice with its fields, validation without calling the API, the exact body sent, navigation to the new Space.
- Tests for `/api/admin/settings` and `/api/admin/stats`: 401, 403 for a USER, list, valid update, invalid value, unknown key, numbers in stats.
- Check that the GitHub Actions run of `main` is green.

**P1: product gaps (the API exists, the UI does not)**

- Edit a snap's AI analysis (`PATCH /api/snaps/:id/insight`, per-mode form with the shared `updateSnapInsightBodySchemas`), and a snap's note and tags (`PATCH /api/snaps/:id`); tags in the camera form.
- Space settings: edit name, description, color, metadata and visibility, archive and unarchive.
- Members: change role, remove member, leave Space (respect `LAST_OWNER`).
- Documents: delete; Posts: delete; comments: delete (own, or on own post).
- Profile: edit name, bio and university, upload avatar; followers/following lists; user search.
- Admin: change a user's role (`PATCH /api/admin/users/:id/role`).
- Watch: the simplification of 7.4 if the user approves it.

**P2: missing in the API too (PRODUCT.md, "App roles and admin panel")**

- Moderation: ADMINs hide and delete Posts and comments (the `hiddenAt` columns exist; there are no endpoints).
- AI usage panel: AiRuns by task, model, user and period (today `/api/admin/stats` only has totals).
- Fix 7.3 (taken date) and 7.5 (lazy routes).
- CI: add lint and tests, with a PostgreSQL service for the API tests.

## 9. Testing: leave everything tested

Every change ends with: `npm run lint`, `npm run typecheck`, `npm test` (with `npm run db:up`), `npm run build`, `npm run format:check`; for the watch, `./gradlew assembleDebug`.

- **API**: Supertest against the real Express app and the test database (`apps/api/test/factories.ts`: `createDatabaseTestContext`, `createUser`, `signIn`, `createSpace`, `addMember`, `bearer`, `paletteColor`). Each endpoint covers 2xx, 400, 401, 403 and 404. AI only through `MockAiProvider` and its fixtures; never call the real API in tests.
- **Web**: Vitest + Testing Library. `src/test/render-app.tsx` renders the whole app at a path; `src/test/fake-api.ts` replaces `fetch` route by route and records calls (uploads use `XMLHttpRequest`: stub it for camera tests). Test behavior through roles and the Spanish texts of `es.json`, like `login-page.test.tsx`.
- **Watch**: no automated tests yet. Pure functions (`plain()` and the JSON mapping in `SnapiaApi.kt`) can get JVM unit tests (`app/src/test`, JUnit).
- **Manual end-to-end checklist** (real phone on the same Wi-Fi, plus the watch emulator), with two accounts A and B where B follows A:
  1. A creates a STUDY Space and a WORK or CONTENT Space; the form shows the fields of each mode.
  2. A takes 2 photos with the phone camera; the progress bar moves; the grid shows them analyzing, then analyzed without reloading.
  3. The viewer swipes between photos and shows the analysis of the mode; reanalyze, share as Moment and delete work.
  4. Select snaps → "Crear con IA" → STUDY_NOTES; edit, preview, save, download PDF and Markdown (open both). ASSIGNMENT_GUIDE refuses empty instructions and shows the notice.
  5. Study tab: flashcards flip; the quiz gives a score and explanations. Ask: an answer with cited snaps.
  6. A invites B as EDITOR (WhatsApp link and copy link); B joins with `/join/:code` and uploads to the Space.
  7. A creates a Post from snaps with the AI draft; B sees it, likes it by double tap and comments; A's Moment appears in B's bar.
  8. Explore by hashtag; `/u/<A>` opens in a private window without a session.
  9. ADMIN: `/admin` cards change after the steps above; deactivating B signs B out; a changed AppSetting applies.
  10. Watch: sign in, open the STUDY Space, read the analysis, flashcards, quiz to the score, like a post in the feed.

## 10. Decisions that belong to the user

- Real AI (API key and cost).
- Exposing MinIO on the local network for the phone demo.
- The watch redesign (pairing code, two-button home).
- Anything that changes PRODUCT.md (native apps beyond the watch companion are out of scope).

## 11. Definition of done

Lint, typecheck, tests and build green; new behavior covered by tests; texts in Spanish in the locale files; no hardcoded values; docs updated; small Conventional Commits pushed to `origin main`; the manual checklist of section 9 passes on a real phone and on the watch.
