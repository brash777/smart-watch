---
name: ai-vision-task
description: Add or change an AI task in Snapia (snap analysis per mode, compose documents, flashcards, quizzes, ask-a-space chat). Use when working in apps/api/src/modules/ai or on any prompt or LLM call.
---

# AI vision tasks

Snapia's AI tasks are: analyze a snap (one prompt per Space mode), compose a Document (one prompt per Document type), generate flashcards, generate a quiz and answer Ask messages. They all go through the same pipeline, so a new task means a new output schema, prompt, fixture and tests, never a new way of calling the model.

First read the "AI rules", "Academic integrity" and "Privacy and permissions" sections of `docs/PRODUCT.md`.

## 1. Architecture

```text
service (snaps, documents, study, ask)
  └── AI task: builds the input, loads the prompt, validates the output, logs the AiRun
        └── AiProvider (interface)
              ├── AnthropicAiProvider → Claude API (production)
              └── MockAiProvider      → fixtures (tests and local development)
```

- Services never call the SDK. They call AI tasks, and tasks call the `AiProvider` interface.
- The provider is chosen with the `AI_PROVIDER` environment variable, read through `config`.
- Only `AnthropicAiProvider` imports the Anthropic SDK, and inside it you use the SDK's own types (messages, tools, responses) instead of redefining them.
- Validation, the retry and AiRun logging live in the task pipeline, outside the providers, so the mock and the real provider run exactly the same code.

Suggested layout:

```text
apps/api/src/modules/ai/
├── ai-provider.ts              # AiProvider interface + factory (reads config)
├── providers/
│   ├── anthropic-ai-provider.ts
│   └── mock-ai-provider.ts
├── prompts/                    # versioned prompt templates
├── fixtures/                   # MockAiProvider outputs, one per task variant
├── tasks/                      # one file per task: snap-analysis.ts, compose-document.ts, …
└── ai-run.repository.ts        # AiRun persistence
```

## 2. Prompts

- Path: `apps/api/src/modules/ai/prompts/<task>[.<mode or type>].v<N>.md`, all in kebab-case. For example:
  - `snap-analysis.study.v1.md`, `snap-analysis.work.v1.md`, `snap-analysis.content.v1.md`
  - `compose-document.study-notes.v1.md`, `compose-document.assignment-guide.v1.md`, `compose-document.work-daily-report.v1.md`
  - `generate-flashcards.v1.md`, `generate-quiz.v1.md`, `ask-space.v1.md`
- Placeholders look `{{like_this}}` (snake_case). The loader fails when a placeholder gets no value, so a prompt never goes out with blanks.
- Prompts do not hardcode settings: the output language comes in as a placeholder filled from the AppSetting `ai_output_language`.
- **Changing a prompt means a new file with the next version** (`v2`, `v3`, …). Never edit a prompt version that is already committed. Old versions stay in the repository so old results can be explained.
- The loader uses the highest version of each prompt. Every result stores the `promptVersion` that produced it, and so does its AiRun.

## 3. Output: JSON validated with Zod

1. Every task has a Zod **output schema** in `packages/shared` (the SnapInsight content of each mode, a Document draft, a FlashcardDeck draft, …). The web app uses the same types.
2. The model answers through **tool use**: the request defines one tool (e.g. `save_snap_insight`) whose `input_schema` is generated from the Zod output schema, with `strict: true`.
   - `strict: true` needs `additionalProperties: false` and `required` on every object. Strict mode does not support some JSON Schema keywords (`minLength`/`maxLength`, `minimum`/`maximum`, `multipleOf`, recursive schemas, complex array constraints): leave them out of the schema you send. Zod still enforces them when you validate.
   - Use `tool_choice: { type: "auto" }` and tell the model in the prompt to answer only by calling that tool. **Do not force the tool** with `tool_choice` `{ type: "tool" }` or `{ type: "any" }`: Claude Opus 5.5, Sonnet 5.5 and Fable 5.1/5.2 reject it with a 400. Because `auto` does not guarantee a call, the pipeline checks for one.
3. Read the response in this order:
   1. Check `stop_reason`. `refusal`: record it in the AiRun and fail with a clear error, without retrying the same input. `max_tokens`: the output is incomplete, so record it and fail (raise the configured max tokens if it happens often).
   2. Find the `tool_use` block by its `type`. The content can also hold `thinking` and `text` blocks, so never assume `content[0]`.
   3. Validate its `input` with the Zod output schema.
4. **Retry once.** If there is no tool call or validation fails, send one more request: the same messages, then the assistant turn exactly as received (thinking blocks included), then a `tool_result` for that tool call with `is_error: true` and a readable summary of the Zod issues. If there was no tool call at all, add a user message asking for the tool call instead. The correction texts are prompts too (`retry-invalid-output`, `retry-missing-tool-call`). If the second answer is still invalid, throw an `AppError` such as `AI_INVALID_OUTPUT`. Both calls are AiRuns. All of this already lives in `ai-runner.ts`: a task only calls `runner.run()`.
5. Long texts (notes, summaries, reports, guides) are **Markdown inside a JSON field** (e.g. `markdown`). They cite snaps as `[Snap N]`, where `N` is the 1-based position of the snap in the list sent to the model. The task maps each `N` back to the snap id and stores the sources.

## 4. Configuration

Nothing about the model is written in code:

| Setting                                                                              | Source                 |
| ------------------------------------------------------------------------------------ | ---------------------- |
| Provider (`AI_PROVIDER`), model, max output tokens, effort, request timeout, retries | `config` (environment) |
| Image size: maximum long edge, output format and quality                             | `config`               |
| Context limits: maximum snaps per request, maximum characters of notes and insights  | `config`               |
| Output language (`ai_output_language`)                                               | AppSetting             |
| Token prices per model, for cost estimates                                           | AppSetting             |

- **Do not send `temperature`, `top_p` or `top_k`.** Current Claude models only accept their default sampling, and API version `2026-10-21` rejects these fields on every model with a 400. Use **effort** (`output_config.effort`: `low`, `medium`, `high`, `xhigh`, `max`) to trade quality against cost and latency. It can be set per task: snap analysis may run at a lower effort than Compose.
- Keep the system prompt and the tool definition identical between calls of the same task (no timestamps or ids in them) so prompt caching can apply.

## 5. Input and privacy

- Send only what the task needs: the images, the snaps' notes, tags and dates, existing insights, Space metadata that helps the task (subject, semester, niche, …) and, for Ask, the question.
- **Never** send emails, phone numbers or other users' data (names, usernames, profiles). Remove emails and phone numbers from every text before sending it, with one shared helper. When a task must tell authors apart (e.g. a team WORK report), use neutral labels such as "Member A" and "Member B".
- **Resize images before sending them:** scale each photo down to the configured maximum long edge, re-encode it (JPEG or WebP) and send it as a base64 `image` content block placed before the text. Image tokens grow with pixel area, so the size is a cost lever; text-heavy STUDY snaps may need more resolution than CONTENT photos. EXIF metadata was already removed at upload.
- Snap analysis runs in the background: an upload request never waits for the AI.

## 6. AiRun: record every call

Every call to the provider creates an `AiRun`: successes, invalid outputs, refusals, timeouts, network errors and every retry. Record:

- the task, the prompt version, the provider and the model;
- input and output tokens, plus cache read and cache write tokens when prompt caching applies;
- the estimated cost: tokens multiplied by the model's prices from AppSetting;
- the latency in milliseconds;
- the error code and message when the call failed;
- the user id and Space id, for the admin usage panel. These ids are stored, never sent to the AI.

Write the AiRun in a step that also runs when the call throws, so failures are never lost.

## 7. MockAiProvider, fixtures and tests

- `MockAiProvider` returns fixtures from `apps/api/src/modules/ai/fixtures/` (one per task variant, named after its prompt, e.g. `snap-analysis.study.json`) with plausible fake token usage. It never calls the network.
- It records every request it receives so tests can assert on them, and it can be told to return an invalid output, no tool call or a refusal to exercise the error paths.
- Tests and local development use `AI_PROVIDER=mock`. Tests never call the real API.
- Every new task comes with:
  - fixtures for each variant, each one tested against its Zod output schema;
  - tests for: a valid output; an invalid output followed by a valid retry; two invalid outputs ending in `AI_INVALID_OUTPUT`; one AiRun per call with tokens and cost; no email or phone number in the requests the provider receives.

## 8. Adding a new task, step by step

1. Write the output schema in `packages/shared` and export its type.
2. Write the prompt `prompts/<task>[.<variant>].v1.md` with its `{{placeholders}}`.
3. Add the fixtures for `MockAiProvider`.
4. Implement the task in `tasks/<task>.ts`: build the input without personal data, resize the images, load the prompt, call the provider with the tool definition, validate, retry once, record the AiRun and return typed data.
5. Call the task from the service that needs it, never from a controller.
6. Add new settings to `config` and `.env.example`, or to the AppSetting seed data.
7. Write the tests from section 7. Run lint, typecheck and tests.

## 9. Checklist

- [ ] No SDK import outside `AnthropicAiProvider`; services call tasks, tasks call `AiProvider`.
- [ ] Prompt in a versioned file; `promptVersion` stored with the result and in the AiRun.
- [ ] Output schema in `packages/shared`; tool `input_schema` generated from it with `strict: true`; `tool_choice` set to `auto`.
- [ ] `stop_reason` checked; output validated; exactly one retry that sends the error back.
- [ ] No `temperature`, `top_p` or `top_k`; model, tokens, effort, timeout, retries, image size and context limits from `config`; language and prices from AppSetting.
- [ ] No emails, phone numbers or other users' data in requests; images resized.
- [ ] An AiRun for every call, including failures and retries.
- [ ] Fixtures and tests added.
