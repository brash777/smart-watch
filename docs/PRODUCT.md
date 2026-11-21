# Snapia — Product Specification

> **Take the photo. The AI does the rest.**

Snapia is an AI instant-photo app built for the Smart Wash project. People take quick photos ("snaps"), Instagram-style, and save them in Spaces. Each Space has a mode, and depending on the mode the AI turns the snaps into useful work: study material, work reports or social content.

This document is the source of truth for product behavior and vocabulary. **Read it before starting any task.** The names in the [glossary](#2-glossary) are used exactly as written in the code: models, types, files, API resources and components. Engineering rules live in [CLAUDE.md](../CLAUDE.md).

## Contents

1. [Vision](#1-vision)
2. [Glossary](#2-glossary)
3. [Space modes](#3-space-modes)
4. [Main flow](#4-main-flow)
5. [Shared Spaces](#5-shared-spaces)
6. [Social layer](#6-social-layer)
7. [AI rules](#7-ai-rules)
8. [Academic integrity](#8-academic-integrity)
9. [Privacy and permissions](#9-privacy-and-permissions)
10. [App roles and admin panel](#10-app-roles-and-admin-panel)
11. [Out of scope](#11-out-of-scope)
12. [Technical stack](#12-technical-stack)

---

## 1. Vision

**Take the photo. The AI does the rest.**

People already photograph what matters: the whiteboard at the end of a lecture, a finished installation on site, a new product on the counter. Those photos get lost in the camera roll and rarely become finished work. Snapia closes that gap. Capturing stays as quick as posting a story, and the AI does the slow part (reading, describing, organizing and writing) while the person reviews and decides.

### Who it is for

| Audience                   | What they capture                          | What they get                                                                        | Main mode |
| -------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------ | --------- |
| University students        | Whiteboards, slides, notebooks, book pages | Notes, summaries, flashcards, quizzes, assignment guides and a chat with their notes | STUDY     |
| Interns and technicians    | Tasks, progress, installations             | Daily and progress reports with a timeline and photo evidence                        | WORK      |
| Work teams                 | The same, from several people              | One shared report built from everyone's snaps                                        | WORK      |
| Creators and entrepreneurs | Products, events, projects                 | Photo feedback, captions, hashtags, alt text, posts and a public portfolio           | CONTENT   |

### Product principles

1. **Capture first.** Taking and saving a snap takes seconds. AI work never blocks capture: it runs in the background.
2. **The AI suggests, the person decides.** Every AI output is an editable draft. Nothing is published or shared without an explicit action by its author.
3. **Grounded in the snaps.** The AI works only with what the snaps and their notes contain, and it cites the snaps it used. It does not make content up.
4. **Private by default.** A snap stays inside its Space unless its author decides otherwise.
5. **Mobile first and familiar.** The main experience is a phone-sized PWA with social-app patterns people already know: short-lived Moments, a feed, double tap to like.

---

## 2. Glossary

These names are used exactly as written in code (Prisma models, TypeScript types, API resources, components). Do not introduce synonyms: in code a Space is never a "folder" or an "album", and a Moment is never a "story". Only the user-facing Spanish text may translate them (for example "Espacio", "Instante").

### Entities

- **User**: a registered person with a unique `username`. Has a global role: `USER` or `ADMIN`.
- **Space**: a collection of snaps. It has a `mode` (`STUDY`, `WORK` or `CONTENT`), a name, a description, a color, a visibility (`PRIVATE`, `MEMBERS` or `PUBLIC`) and metadata that depends on the mode:
  - STUDY: `subject`, `professor`, `semester`
  - WORK: `project`, `client`, `siteLabel`
  - CONTENT: `niche`
- **SpaceMember**: a user inside a Space, with a role: `OWNER`, `EDITOR` (uploads snaps and creates documents) or `VIEWER` (can only view).
- **SpaceInvite**: a code to join a Space. It sets the role it grants, an expiration date and a maximum number of uses.
- **Snap**: a photo uploaded to a Space, with an optional note, tags and the date it was taken.
- **SnapInsight**: the AI analysis of one snap. Its content depends on the Space mode (see [Space modes](#3-space-modes)).
- **Document**: what the AI builds from several snaps with the **Compose** action. It is edited in Markdown and exported to PDF, Word or Markdown. Types by mode:
  - STUDY: `STUDY_NOTES`, `STUDY_SUMMARY`, `ASSIGNMENT_GUIDE`
  - WORK: `WORK_DAILY_REPORT`, `WORK_PROGRESS_REPORT`
  - CONTENT: `CONTENT_POST`, `CONTENT_CAROUSEL`
- **FlashcardDeck**: a set of flashcards generated from snaps or from STUDY documents.
- **Quiz**: a set of questions with their answers, generated from snaps or from STUDY documents.
- **AskMessage**: a message in the "Ask your Space" chat. Answers use only what the Space's snaps contain, and they cite those snaps.
- **Moment**: a snap shared for a limited time (24 hours by default) with the author's followers, the members of a Space, or the public.
- **Post**: a permanent publication in the feed and in the user's portfolio, with one or several snaps, a caption and hashtags. Its visibility is `PUBLIC` or `FOLLOWERS`.
- **AiRun**: the record of one AI call: task, model, tokens, estimated cost, duration and error (if any).

### Supporting entities

- **RefreshToken**: a long-lived session of a User. Only a hash of the token is stored, and it can be revoked.
- **Follow**: a User following another User.
- **DocumentSource**: a snap used by a Document, with its position. The document cites its N-th source as `[Snap N]`.
- **Flashcard**: one question and answer of a FlashcardDeck, optionally linked to the snap it comes from.
- **QuizQuestion**: one multiple-choice question of a Quiz, with its correct option and an explanation.
- **QuizAttempt**: one try of a User at a Quiz, with the chosen answers and the score.
- **MomentView**: a User who saw a Moment.
- **PostMedia**: a snap shown in a Post, with its alt text and position.
- **Like**: a User liking a Post.
- **Comment**: a User's comment on a Post. ADMINs can hide it.

### Other terms

- **Compose**: the action that turns several selected snaps into a Document.
- **Mode**: the Space property (`STUDY`, `WORK`, `CONTENT`) that decides what the AI does with its snaps.
- **Feed**: the Posts of the people a user follows.
- **Explore**: browsing public Posts by hashtag.
- **Portfolio**: a user's public profile page with their Posts.
- **AppSetting**: a configurable product rule stored in the database (for example the default Moment duration or the AI output language). It is seeded on setup and ADMINs can edit it.

### Enumerated values

| Concept                  | Values                                                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Global role (User)       | `USER`, `ADMIN`                                                                                                                     |
| Space mode               | `STUDY`, `WORK`, `CONTENT`                                                                                                          |
| Space visibility         | `PRIVATE`, `MEMBERS`, `PUBLIC`                                                                                                      |
| Space role (SpaceMember) | `OWNER`, `EDITOR`, `VIEWER`                                                                                                         |
| Snap analysis status     | `PENDING`, `PROCESSING`, `DONE`, `FAILED`                                                                                           |
| Document type            | `STUDY_NOTES`, `STUDY_SUMMARY`, `ASSIGNMENT_GUIDE`, `WORK_DAILY_REPORT`, `WORK_PROGRESS_REPORT`, `CONTENT_POST`, `CONTENT_CAROUSEL` |
| Document status          | `DRAFT`, `FINAL`                                                                                                                    |
| AiRun task               | `SNAP_ANALYSIS`, `COMPOSE_DOCUMENT`, `STUDY_FLASHCARDS`, `STUDY_QUIZ`, `ASK_SPACE`, `POST_DRAFT`                                    |
| AiRun status             | `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`                                                                                      |
| AskMessage role          | `USER`, `ASSISTANT`                                                                                                                 |
| Moment audience          | `FOLLOWERS`, `SPACE_MEMBERS`, `PUBLIC`                                                                                              |
| Post visibility          | `PUBLIC`, `FOLLOWERS`                                                                                                               |
| AppSetting value type    | `NUMBER`, `STRING`, `BOOLEAN`, `STRING_LIST`                                                                                        |

---

## 3. Space modes

Every Space has exactly one mode, chosen when the Space is created. The mode decides the Space metadata, what each SnapInsight contains, which Document types Compose offers and which extra tools appear. The exact fields of each AI output are defined by the output schemas in `packages/shared`.

### 3.1 STUDY (university)

- **Typical snaps:** whiteboards, slides, notebook pages, book pages.
- **Metadata:** `subject`, `professor`, `semester`.
- **SnapInsight:** the text the AI reads in the photo, plus the main topic and the key concepts it finds.
- **Compose:**
  - `STUDY_NOTES`: complete, organized notes.
  - `STUDY_SUMMARY`: a short summary.
  - `ASSIGNMENT_GUIDE`: a guide for a university assignment. It is not the assignment itself (see [Academic integrity](#8-academic-integrity)).
- **Study tools:** FlashcardDeck and Quiz (from snaps or STUDY documents) and the Ask chat ("ask your notes").

### 3.2 WORK (work evidence)

- **Typical snaps:** tasks, progress, installations.
- **Metadata:** `project`, `client`, `siteLabel`.
- **SnapInsight:** a factual description of what the photo shows: the work done, its state and any visible issue.
- **Compose:**
  - `WORK_DAILY_REPORT`: what was done during one day.
  - `WORK_PROGRESS_REPORT`: the progress over a period.
  - Both include a timeline ordered by the date each snap was taken and use the snaps as evidence.

### 3.3 CONTENT (portfolio)

- **Typical snaps:** products, events, projects.
- **Metadata:** `niche`.
- **SnapInsight:** a quality score for the photo with what could be improved, plus a suggested caption, hashtags and alt text.
- **Compose:**
  - `CONTENT_POST`: one post.
  - `CONTENT_CAROUSEL`: several snaps in order, published as one post.
- **Publishing:** the result is published as a Post. A user's Posts make up their public portfolio.

---

## 4. Main flow

1. **Take a snap** with the in-app camera or pick a photo from the device. Optionally add a note and tags.
2. **Choose a Space.**
3. **Automatic analysis.** The snap is saved right away and the AI analyzes it in the background, attaching a SnapInsight. The person can keep taking snaps meanwhile. Each snap shows whether its analysis is pending, ready or failed, and a failed analysis can be retried.
4. **Select several snaps** from the Space. In a shared Space they can come from any member.
5. **Compose.** Choose a Document type allowed by the Space mode. The AI builds the Document from the selected snaps, their notes and their insights, and cites the snaps it used.
6. **Review and edit** the Document in Markdown.
7. **Export or publish.** Export to PDF, Word or Markdown or, in a CONTENT Space, publish the result as a Post.

---

## 5. Shared Spaces

A Space can be shared so that several people add snaps to it.

1. To share a Space, its OWNER sets the visibility to `MEMBERS` (or `PUBLIC`) and generates a SpaceInvite: a code that grants a role (`EDITOR` or `VIEWER`), expires on a date and accepts a maximum number of uses.
2. A registered user who enters a valid code joins the Space as a SpaceMember with that role.
3. EDITORs upload snaps. Every member sees the Space according to their role.
4. Compose can use the snaps of all members. The Document keeps track of which snaps it used.
5. The OWNER can revoke invites, change roles and remove members. Any member can leave the Space.

> **Example.** In a STUDY Space for a class, each classmate photographs a different part of the whiteboard. One of them selects all those snaps and runs Compose with `STUDY_NOTES`, and the AI builds the complete notes of the class from everyone's photos.

---

## 6. Social layer

- **Follow:** users can follow other users.
- **Moments:** a Moment shares one snap for a limited time, 24 hours by default (an AppSetting). The author picks the audience: their followers, the members of one of their Spaces, or everyone. When it expires, nobody sees it anymore.
- **Posts:** a Post is permanent. It has one or several snaps, a caption, hashtags and a visibility:
  - `PUBLIC` (default): anyone can see it; it appears in the author's followers' feeds, in the author's portfolio and in Explore.
  - `FOLLOWERS`: only the author's followers can see it, in their feeds and on the author's profile.
- **Likes and comments** on Posts.
- **Feed:** the Posts of the people the user follows, newest first.
- **Explore:** discover public Posts by hashtag.
- **Portfolio:** each user's public page with their Posts.
- **Moderation:** ADMINs can hide or delete Posts and comments (see [App roles and admin panel](#10-app-roles-and-admin-panel)).

Only the author of a snap can publish it as a Post or a Moment.

---

## 7. AI rules

1. **The AI suggests, the person reviews.** Every AI output (insights, documents, flashcards, quizzes, captions) is a draft that the person can review and edit. Nothing is published, shared or sent automatically.
2. **Only the snaps' content.** The AI works with the snaps' images, notes, tags and dates and with the insights derived from them. Ask answers use only that content, cite the snaps they rely on and say so when the answer is not in the snaps.
3. **No personal data.** Emails, phone numbers and other users' data (names, usernames, profiles) are never sent to the AI. Emails and phone numbers are removed from any text before it is sent. When a request must tell authors apart, it uses neutral labels.
4. **Every call is recorded.** Each call creates an AiRun with the task, model, tokens, estimated cost, duration and error (if any). ADMINs see this usage in the admin panel.
5. **Configured, not coded.** The AI provider, the model and the limits are configured in `.env`. Product rules such as the AI output language and the token prices used for cost estimates are AppSettings. None of them is written in the code.
6. **Versioned prompts.** Prompts live in versioned files in the repository. Changing a prompt creates a new version, and every AI result records which version produced it.
7. **Light images.** Photos are resized before they are sent to the AI. Their EXIF metadata was already removed at upload.

---

## 8. Academic integrity

`ASSIGNMENT_GUIDE` helps a student prepare a university assignment. **It is not a finished assignment ready to hand in.** It contains:

- a **proposed outline** for the assignment;
- the **key ideas for each section**, taken from the snaps;
- **questions to go deeper** into each part;
- **information gaps**: what the snaps do not cover and the student still has to research;
- **sources**: the snaps used.

Every guide shows a visible notice, in the app and in every export, saying that the student must write the assignment in their own words. The AI never writes the final text of the assignment, such as complete paragraphs or a full essay ready to submit.

---

## 9. Privacy and permissions

### Photos

EXIF metadata, including the GPS location, is removed from every photo at upload, before the photo is stored.

### Space visibility

Spaces are `PRIVATE` by default.

| Visibility | Who can see the Space and its snaps                           |
| ---------- | ------------------------------------------------------------- |
| `PRIVATE`  | Only its OWNER                                                |
| `MEMBERS`  | Its members, according to their role                          |
| `PUBLIC`   | Anyone, read-only. Members contribute according to their role |

### Snaps outside their Space

A snap is visible only to the people who can see its Space. Anyone else can see it only if its author publishes it as a Post or a Moment. Only the author of a snap can publish it.

### Space roles

| Action                                                                | OWNER | EDITOR | VIEWER |
| --------------------------------------------------------------------- | :---: | :----: | :----: |
| See the Space, its snaps, insights, documents, flashcards and quizzes |   ✓   |   ✓    |   ✓    |
| Upload snaps                                                          |   ✓   |   ✓    |   —    |
| Compose documents, generate flashcards and quizzes, use Ask           |   ✓   |   ✓    |   —    |
| Edit or delete their own snaps and documents                          |   ✓   |   ✓    |   —    |
| Edit or delete any snap or document in the Space                      |   ✓   |   —    |   —    |
| Edit the Space, manage invites and members, delete the Space          |   ✓   |   —    |   —    |

### Admins and private content

The ADMIN role manages the app. It does not give access to the content of Spaces the admin is not a member of.

---

## 10. App roles and admin panel

- **USER**: the role of everyone who signs up.
- **ADMIN**: everything a USER can do, plus the admin panel:
  - **Users:** list, search and manage users.
  - **Settings:** view and edit AppSettings.
  - **AI usage:** AiRun data (calls, tokens, estimated cost and errors) by task, model, user and period.
  - **Moderation:** review, hide or delete Posts and comments.

The first ADMIN is created by the database seed, with credentials taken from `.env`.

---

## 11. Out of scope

Not planned for now:

- Native mobile apps (Snapia is a PWA).
- Payments and subscriptions.
- Push notifications.

---

## 12. Technical stack

Monorepo with npm workspaces:

| Package           | Stack                                                                                                |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| `apps/api`        | Node 22, Express, TypeScript, Prisma, PostgreSQL, MinIO/S3 for photo storage, Claude API with vision |
| `apps/web`        | React, Vite, TypeScript, Tailwind CSS, PWA                                                           |
| `packages/shared` | Zod schemas and TypeScript types shared by the API and the web app                                   |
