enlace video:https://drive.google.com/file/d/1Ikjeg8nQIdTWR4TtK0KKChIbpjMHKvGj/view?usp=sharing
https://drive.google.com/file/d/1efT7-cyISNaFGBReMfiVfPi844sbPMbb/view?usp=sharing
Abra la aplicación web en WEB_BASE_URL http://localhost:5173 


# Snapia

**Take the photo. The AI does the rest.** A Smart Wash project.

Snapia is an AI instant-photo PWA. People take quick photos ("snaps") and save them in Spaces. The AI analyzes every snap in the background and turns a selection of snaps into finished work, according to the mode of the Space. A social layer sits on top: Moments, Posts, a feed, likes, comments, Explore and public profiles.

## The three modes

| Mode        | For                         | What the AI does with the snaps                                                                                                              |
| ----------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **STUDY**   | Students                    | Reads whiteboards and slides; writes notes, summaries and assignment guides; makes flashcards, quizzes and an Ask chat that cites the snaps. |
| **WORK**    | Interns, technicians, teams | Describes the work, its progress and visible issues; writes daily and progress reports with photo evidence.                                  |
| **CONTENT** | Creators                    | Scores the photo, suggests improvements, a caption, hashtags and alt text; drafts posts and carousels.                                       |

The rules of the product are in [docs/PRODUCT.md](docs/PRODUCT.md), the API in [docs/api.md](docs/api.md) and the engineering rules in [CLAUDE.md](CLAUDE.md).

## Run it

Requirements: Node.js 22 (`nvm use`), npm and Docker.

```bash
cp .env.example .env   # local configuration; never commit .env
npm install            # installs every workspace and enables the git hooks
npm run db:up          # PostgreSQL and MinIO
npm run db:migrate     # database migrations
npm run db:seed        # AppSettings, the first ADMIN and (optionally) demo data
npm run dev            # API and web app in watch mode
```

Open the web app at `WEB_BASE_URL` (http://localhost:5173 by default). To try it from a phone on the same Wi-Fi, run `npm run dev:web -- --host` and open the Network URL that Vite prints: the web app reaches the API through the Vite proxy. The admin panel is at `/admin` for the seeded ADMIN.

| Script                                            | What it does                                       |
| ------------------------------------------------- | -------------------------------------------------- |
| `npm run dev`                                     | API and web app in parallel                        |
| `npm run build`                                   | Builds every workspace                             |
| `npm run lint` / `npm run typecheck` / `npm test` | ESLint, TypeScript and Vitest (tests need `db:up`) |
| `npm run db:migrate` / `db:seed` / `db:studio`    | Prisma commands for the API database               |

CI (`.github/workflows/ci.yml`) installs, typechecks and builds every push and pull request.

## Watch (Wear OS)

`apps/wear` is a Wear OS app (Kotlin, Compose for Wear OS) on the same API: sign in, Spaces, snaps with their AI analysis, flashcards, quizzes and the feed with like by double tap.

1. In Android Studio, create a **Wear OS Large Round** virtual device (Device Manager) and start it.
2. Open the `apps/wear` folder in Android Studio and wait for the Gradle sync.
3. With the API running (`npm run dev:api`), let the emulator reach this computer: `adb reverse tcp:4000 tcp:4000` and `adb reverse tcp:9000 tcp:9000` (photos in MinIO).
4. Run the `app` configuration on the watch. The API URL is `snapia.apiUrl` in `apps/wear/gradle.properties`.

## Environment variables

Every variable is documented in [.env.example](.env.example) and validated with Zod at startup; nothing is hardcoded. The main groups:

| Group          | Variables                                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------- |
| App and HTTP   | `APP_NAME`, `API_PORT`, `API_BASE_URL`, `WEB_BASE_URL`, `CORS_ORIGINS`                                           |
| Database       | `DATABASE_URL`, `TEST_DATABASE_URL`                                                                              |
| Auth           | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`                                   |
| Storage        | `STORAGE_DRIVER`, `S3_*`, `SIGNED_URL_TTL_SECONDS`                                                               |
| Uploads        | `UPLOAD_MAX_MB`, `UPLOAD_MAX_FILES`, `UPLOAD_ALLOWED_MIME`, `IMAGE_MAX_SIDE_PX`                                  |
| AI             | `AI_PROVIDER` (`mock` or `anthropic`), `ANTHROPIC_API_KEY`, `AI_MODEL`, `AI_EFFORT`, `AI_*`                      |
| Web app (Vite) | `VITE_APP_NAME`, `VITE_API_URL`, `VITE_API_PROXY_TARGET`, `VITE_WHATSAPP_SHARE_URL`, `VITE_UPLOAD_IMAGE_QUALITY` |
| Seed           | `SEED_ADMIN_*`, `SEED_DEMO_DATA`                                                                                 |

Product rules that an ADMIN can change without a deploy (Moment duration, invite defaults, AI output language, token prices…) are AppSettings, editable in `/admin`.

## Stack

- `apps/api`: Node 22, Express, TypeScript, Prisma, PostgreSQL, MinIO/S3, Claude API with vision
- `apps/web`: React, Vite, TypeScript, Tailwind CSS, TanStack Query, i18next, PWA
- `packages/shared`: Zod schemas and types used by both
