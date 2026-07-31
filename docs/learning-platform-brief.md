# Design Brief: Forge → Paced Learning Platform

*2026-07-31. Status: proposal, not yet scheduled.*

## Context & thesis

Forge's capture side is strong and defensible: intro conversation → ExpertProfile → planned interview → conductor/validator/extractor loop → typed, confidence-scored, provenance-linked extractions. Its delivery side is weak: a single static tool page with localStorage-only learner state.

[Wondering.app](https://wondering.app) ("Duolingo for Anything") validates the delivery format we lack — bite-sized lesson cards, three exercise types (Multiple Choice, Click & Fill, Order Steps), a Start→Goal node-trail path with milestone and review nodes, a three-lever customizer (goal / time budget / focus areas) with live pace recalculation, standing "how I learn" preferences, and explicit "refine with feedback → master and retain" ending stages. But Wondering's supply is the model's generic knowledge: no provenance, no tacit expertise, generic distractors.

**Thesis: keep Forge's capture pipeline as the content substrate and rebuild delivery as a Wondering-style paced path.** The expert's actual warnings, mistakes, and examples become lesson feedback and exercise distractors — content no generic generator can match. This is the helppeople.help shape: expert knowledge in, personalized micro-curriculum out.

Every exercise format is mechanically derivable from existing extraction types:

| Wondering element | Forge source |
|---|---|
| Order Steps exercise | `procedure.structured.steps` |
| Click & Fill blanks | `fact` / `definition` / `metric` extractions |
| MC distractors | expert's `commonMistakes` + `warning` extractions (the moat — the expert literally told us what people get wrong) |
| Focus-area chips | extraction tags + interview section titles |
| Path spine | the existing `curriculum` component schema |
| Learner levers | learner-side mirror of `DEPTH_PRESETS` + the `user` context layer |

---

# Section A — Data Model & Persistence

## A1. The knowledge layer: kill the jsonb column, promote a table

`workspaces.knowledge_base` (schema.ts:30) is a typed jsonb column that nothing writes. Two options:

**Option 1 — write the jsonb.** A post-interview assembly step folds extractions into the `KnowledgeBase` shape (facts/procedures/decisionRules/…). Cheap, but it strips provenance (no forgeId/questionId per item), can't carry custom extraction types (the shape hard-codes eight arrays), duplicates data that then drifts from `extractions`, and can't be queried/embedded per-item.

**Option 2 (recommended) — `knowledge_units` table.** The extractions table is already 90% of the canonical layer: typed, tagged, confidence-scored, embedded (pgvector index from `0003_pgvector.sql`), with forge/section/question provenance and round tracking. What it lacks is *curation state* and *workspace scope* (it's keyed by forge, and `loadExpertKnowledge` has to fan out per forge). Promote rather than duplicate:

```ts
export const knowledgeUnits = pgTable("knowledge_units", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  extractionId: uuid("extraction_id")
    .references(() => extractions.id, { onDelete: "set null" }), // provenance chain: extraction → question → section → forge
  documentId: uuid("document_id")
    .references(() => documents.id, { onDelete: "set null" }),   // units can also come from docs
  type: text("type").notNull(),               // standard or workspace custom type
  content: text("content").notNull(),          // curated wording (starts as extraction.content)
  structured: jsonb("structured"),
  confidence: real("confidence"),
  tags: jsonb("tags").$type<string[]>(),
  status: text("status", { enum: ["proposed", "approved", "superseded", "rejected"] })
    .default("proposed").notNull(),
  supersededBy: uuid("superseded_by"),          // self-ref, later rounds refine earlier units
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("idx_ku_workspace").on(t.workspaceId),
  index("idx_ku_status").on(t.status),
  index("idx_ku_type").on(t.type),
])
```

- **Ingest**: after each interview round completes (`completeRound`) and on document upload, a promotion job copies new extractions → `knowledge_units` (status `proposed`). The existing ToolUpdateReview UI pattern becomes the curation surface (approve/reject/edit → `approved`).
- **Embedding**: raw-SQL migration adds `embedding vector` + ivfflat/trgm indexes mirroring `0003_pgvector.sql`; hybrid search moves from per-forge to workspace scope, replacing the per-forge fan-out in `tools.ts:loadExpertKnowledge`.
- `workspaces.knowledge_base` jsonb: drop it in the same migration (it has never been written; nothing reads a value from it).
- Extractions table stays untouched as the raw interview record; units reference it for provenance. Voice and text interview paths both feed it unchanged.

## A2. Learner-side tables

Four new tables, all workspace-scoped, mirroring Wondering's levers.

```ts
export const learners = pgTable("learners", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  displayName: text("display_name"),
  // standing "how I learn" free-text instructions (Wondering's persistent prefs)
  preferences: jsonb("preferences").$type<{
    instructions: string[]          // "explain with analogies from my job as X"
    tone?: string
  }>(),
  // learner-situation intake (replaces tool_sessions.userContext)
  context: jsonb("context"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("idx_learners_workspace").on(t.workspaceId)])

export const paths = pgTable("paths", {
  id: uuid("id").primaryKey().defaultRandom(),
  learnerId: uuid("learner_id").notNull()
    .references(() => learners.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id").notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  goal: text("goal", { enum: ["basics", "deep", "practical"] }).notNull(),
  dailyMinutes: smallint("daily_minutes").notNull(),      // 5 | 15 | 30
  focusAreas: jsonb("focus_areas").$type<string[]>(),      // tag/section slugs from knowledge units
  // computed sequence: ordered unit ids + milestone markers; regenerated when levers change
  sequence: jsonb("sequence").$type<PathSequence>(),
  status: text("status", { enum: ["active", "completed", "archived"] })
    .default("active").notNull(),
  estimatedDays: integer("estimated_days"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("idx_paths_learner").on(t.learnerId)])

export const pathUnits = pgTable("path_units", {
  id: uuid("id").primaryKey().defaultRandom(),
  pathId: uuid("path_id").notNull()
    .references(() => paths.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull(),
  kind: text("kind", {
    enum: ["lesson_card", "exercise_mc", "exercise_fill", "exercise_order",
           "diagram", "checkpoint", "review"],
  }).notNull(),
  // generated content; null until lazily generated (structure-then-fill: skeleton first, bodies on demand)
  content: jsonb("content"),
  // provenance: which knowledge units this was generated from
  sourceUnitIds: jsonb("source_unit_ids").$type<string[]>(),
  status: text("status", { enum: ["pending", "generated", "completed", "skipped"] })
    .default("pending").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (t) => [
  index("idx_pu_path").on(t.pathId),
  index("idx_pu_path_order").on(t.pathId, t.orderIndex),
])

export const attempts = pgTable("attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  pathUnitId: uuid("path_unit_id").notNull()
    .references(() => pathUnits.id, { onDelete: "cascade" }),
  learnerId: uuid("learner_id").notNull()
    .references(() => learners.id, { onDelete: "cascade" }),
  answer: jsonb("answer"),                 // chosen option / fills / ordering
  correct: text("correct", { enum: ["yes", "no", "partial"] }),
  latencyMs: integer("latency_ms"),
  // spaced repetition state, SM-2-lite: per source knowledge unit
  ease: real("ease"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("idx_attempts_learner").on(t.learnerId),
  index("idx_attempts_due").on(t.learnerId, t.dueAt),
])
```

Design notes:

- **`sequence` jsonb on paths** rather than deriving order purely from `path_units.orderIndex`: the customizer levers regenerate the plan cheaply (skeleton-only LLM call) without churning generated unit rows; `path_units` rows are created from the sequence as the learner approaches them. Review/checkpoint nodes (Wondering's hollow nodes) are sequence entries whose units are synthesized from due `attempts`, not pre-generated.
- **Provenance convention (used throughout this brief):** `path_units.sourceUnitIds` references `knowledge_units`, which chain back to `extractions` → question → section → forge. The path planner and unit generators cite knowledge-unit ids; raw extraction ids never leave the capture layer.
- **Exercises are mechanically derivable**: `exercise_order` from `procedure.structured.steps`; `exercise_fill` from facts/definitions/metrics; `exercise_mc` distractors from the expert's `commonMistakes`/warnings. `sourceUnitIds` makes every exercise traceable to approved expert knowledge — the anti-hallucination guarantee.
- **No auth table yet**: `learners` is anonymous-cookie keyed for now (same posture as today's shareable tool links); an `authUserId` column is a later additive migration.

## A3. Migrating client-side state server-side

Current state lives in localStorage across ~12 files (Quiz answers, Checklist checkedIds, Curriculum content cache `curriculum-${componentId}`, completion tracking in useToolDashboard/useToolUser, task board state) and in the effectively-unused `tool_sessions` table (declared, never written by the API).

- `tool_sessions` → **retire**; `learners.context` absorbs `userContext`, `attempts` + `pathUnits.status` absorb `toolState`/`result`.
- Curriculum localStorage cache → `pathUnits.content` (generated-once, stored server-side; fixes the regenerate-on-every-device problem).
- Quiz answers / completion → `attempts` rows; the existing tool page keeps working during transition by dual-writing (localStorage + POST) behind one hook.
- Streamed advice (`/tool/advice`, currently dropped) → persist as a `pathUnits` row of kind `lesson_card` with `sourceUnitIds` from the retrieval set.

## A4. Migrations & ordering

Following the repo's pattern (generated SQL via `./stack db:generate`, hand-written SQL for pgvector work as in `0003`):

1. `0008_knowledge_units.sql` — create `knowledge_units` (generated) + raw SQL for `embedding vector(1536)`, ivfflat + trgm indexes. Backfill: `INSERT … SELECT` from extractions joined through forges → workspaceId, status `approved` for existing workspaces (grandfather in; new rounds arrive as `proposed`). Copy embeddings where present.
2. `0009_learning.sql` — `learners`, `paths`, `path_units`, `attempts` (pure generated Drizzle migration; no backfill — no server-side learner state exists today).
3. `0010_drop_dead_columns.sql` — drop `workspaces.knowledge_base`; drop `tool_sessions` once the dual-write period ends (keep it one release if any prod data exists; dev DB shows none).

Order matters only in that 1 must precede 2 (path generation reads `knowledge_units`), and 3 is deliberately last and separable.

---

# Section B — Generation Pipeline

The pipeline turns an expert's curated knowledge units plus a learner's three levers into a paced path of small learning units. It deliberately reuses the two patterns already proven in this codebase: **structure-then-fill** (Opus plans a skeleton, Sonnet fills pieces in parallel with a cached system prompt — `interview-planner.ts` skeleton/questions split, `tool-generator.ts` plan/component split) and **SSE event streaming** (`generate-tool-stream` in `tools.ts`).

## B1. Path planner (structure phase)

**Inputs**

| Input | Source |
|---|---|
| Learner levers | `goal: "basics" \| "deep" \| "practical"`, `timeBudget: 5 \| 15 \| 30` (min/day), `focusAreas: string[]` — from the learner record (Section A) |
| Standing preferences | Learner's free-text "how I learn" instructions (passed through verbatim to every generation call, like the profile context in `interview-planner.ts`) |
| Knowledge corpus | All `approved` knowledge units for the workspace, grouped via `buildKnowledgeSummary()` (`tool-generator.ts:216`) — same typed summary the tool planner consumes |
| Expert framing | `expertName`, `domain`, `targetAudience`, `uniqueApproach`, `commonMistakes` from the ExpertProfile |
| Focus vocabulary | Candidate focus areas are **derived, not invented**: distinct knowledge-unit `tags` plus section titles, so the customizer only offers areas the corpus can actually teach |

**Output — `PathSkeleton`** (schema-validated, see B4):

```ts
interface PathSkeleton {
  title: string
  estimatedWeeks: number            // computed from unit count ÷ timeBudget, LLM sanity-checked
  milestones: Array<{
    title: string                   // "Deconstruct 'form follows function'"
    goal: string                    // what the learner can DO after this milestone
    focusArea?: string              // which lever selection it serves
    units: Array<{
      kind: "lesson" | "exercise_mc" | "exercise_fill" | "exercise_order" | "checkpoint"
      focus: string                 // specific knowledge this unit covers
      sourceUnitIds: string[]       // provenance — planner must cite knowledge units, not invent
    }>
  }>
}
```

**Call shape** (matching `llm.ts` conventions): Opus (default `MODEL`), `effort: "high"`, `temperature 0.5`, `maxTokens 4096`, `schema: PATH_SKELETON_SCHEMA`. One call. Hard caps applied in code after the call, exactly like the section-count truncation in `generateInterviewSkeleton` (`interview-planner.ts:138`):

- `basics`: 3–4 milestones; `deep`: 5–7; `practical`: 4–5 weighted toward exercise/checkpoint units.
- Units per milestone bounded by time budget: 5 min/day ≈ 2 units/session → cap milestone size so a milestone ≈ one week at the learner's pace.
- Every milestone ends with a `checkpoint` unit; the final milestone is always "Refine with feedback" + "Master and retain" (the Wondering ending discipline, enforced structurally, not by prompt hope).

**Prompt rules worth writing down now**

- "Every unit's `sourceUnitIds` must reference knowledge units listed above. If the corpus doesn't support a milestone, omit the milestone — do not fill gaps with general knowledge." This is the provenance guarantee that differentiates the product from Wondering.
- Focus-area selections reorder and expand matching milestones ("Prioritizing: X, Y" — mirrored back to the learner in the UI).

## B2. Unit generators (fill phase)

Each unit is one Sonnet call: `model: SONNET`, `temperature 0.2`, `cacheSystem: true` with the knowledge summary + learner preferences in the **system prompt** so parallel calls share the cache — identical to `generateComponent` (`tool-generator.ts:285`). Each generator receives only its unit spec (`kind`, `focus`, resolved source knowledge units) in the user prompt, plus a running list of already-generated unit summaries for dedup (the same trick `extractor.ts` uses with `existingExtractions`).

Mapping from extraction/knowledge-unit types to path-unit kinds — this is mechanical, which is the point:

| Unit kind | Primary knowledge sources | Generator notes |
|---|---|---|
| **Lesson card** | any; `example`, `definition`, `fact`, `context` | Variants: `comparison` (two-column contrast — feed pairs of decision_rules or before/after examples), `table` (metrics/definitions), `quote` (the expert's own phrasing from unit content — keep their voice), `narrative` (≤120 words, one concept). One concept per card, enforced by schema (single `concept` field). |
| **Multiple Choice** | `decision_rule`, `warning`, `commonMistakes` (profile) | Correct answer from the knowledge unit; **distractors sourced from the expert's stated commonMistakes and warnings**. This is the moat: a generic model invents implausible wrong answers, but the expert has literally told us what people get wrong — those misconceptions are the highest-value distractors and they're already sitting in the profile and `warning` units. Each option carries an `explanation` (reuse the quiz component's per-option explanation convention from `types.ts` QuizConfig). |
| **Click & Fill** | `fact`, `definition`, `metric` | Take the unit sentence, blank 2–3 load-bearing terms, word bank = blanked terms + 1–2 near-miss terms from sibling units. Cheapest unit to generate; the planner should lean on it for `basics` goal. |
| **Order Steps** | `procedure` (uses `structured.steps` when present, else content) | Steps come verbatim-ish from `procedure.steps`; generator's only creative job is trimming each step to a draggable one-liner and writing the check feedback. |
| **Checkpoint / review** | attempts table (Section A) | Not LLM-generated at path time. A checkpoint is resolved at *serve* time: pick the learner's weakest recent units (lowest attempt scores, oldest successes) and re-serve their exercises with light Haiku paraphrasing (`model: HAIKU`, `maxTokens 512`) so repeats don't feel copy-pasted. Spaced-repetition scheduling is code, not model. |
| **Diagram** *(phase 3)* | `procedure`, comparisons | Optional image-gen pass per lesson card. Explicitly out of scope for v1 — everything above works with text + existing component rendering. |

## B3. Streaming, laziness, and regeneration

**Path generation SSE** mirrors `generate-tool-stream` (`tools.ts:218-292`) exactly:

```
{ type: "plan", skeleton }            // after B1 — UI renders the node-trail immediately
{ type: "unit", milestoneIndex, unitIndex, config }   // as each fill completes
{ type: "complete" } | { type: "error", message }
```

**Lazy-ahead-of-learner, not eager.** Do **not** generate the whole path's units up front:

- Eagerly generate only milestone 1 (so "Start Learning" is instant after planning).
- Thereafter maintain a buffer of ~3 units ahead of the learner's position; a unit completion triggers background fill of the next un-generated unit. `Curriculum.tsx` already proves the lazy pattern (module bodies generated on expand via `askExpert`, cached under `curriculum-${componentId}`) — this is the same idea moved server-side, with units persisted to the DB instead of localStorage so they survive devices and enable attempt tracking.
- Cost/scale rationale: a deep path is 30–50 units; most learners won't finish; generating on a 3-unit horizon means abandonment costs ~3 wasted Sonnet calls instead of ~40.

**Regeneration on lever change.** Levers changing (goal/time/focus) re-runs the **planner only**. Diff the new skeleton against existing units by `sourceUnitIds` + `kind`: matching units are re-linked, not re-generated; completed units are never discarded (attempt history must survive); only genuinely new units enter the lazy queue. Time-budget-only changes shouldn't touch content at all — just re-chunk sessions.

## B4. Guardrails

1. **Schema-validated structured output everywhere.** Every planner/generator call passes a JSON Schema via `output_config.format: json_schema` — already the pattern for `PLAN_SCHEMA` and `OPERATIONS_BOARD_SCHEMA` in `tool-generator.ts:147-212`. No unvalidated LLM JSON reaches the DB (the current `apply-updates` route violates this; the new pipeline must not).
2. **Provenance is non-optional.** Every path-unit row stores `sourceUnitIds[]` referencing `knowledge_units`. Serve-time UI can show "from [expert]'s interview, [section]"; it also makes stale-unit invalidation possible when a follow-up interview supersedes a knowledge unit (`supersededBy`).
3. **Dedup across units.** Planner-level: the outline/anti-overlap rules from `generateToolPlan` ("each component must cover DISTINCT knowledge") carry over verbatim to milestones. Fill-level: pass prior unit one-line summaries into each generation call, as the extractor does.
4. **Corpus-bounded content.** Generators are instructed to use only supplied knowledge units + documents; a cheap post-check flags units whose content shares no n-grams/terms with their cited sources for human (or Haiku) review rather than silently shipping hallucinated lessons.
5. **Caps in code, not prompts.** Milestone/unit counts, option counts (MC: exactly 4), blank counts (fill: 2–3), step counts (order: 3–6) are truncated/rejected in code after generation, following the existing `slice(0, max)` convention.

**Model bill of materials:** 1 Opus call per path (plan/re-plan), 1 Sonnet call per unit (cached system prompt), Haiku for checkpoint paraphrase and post-checks. Effort: `high` on the planner, default on fills — consistent with how `llm.ts` gates `effort` to Opus models anyway (`applyEffort`).

---

# Section C — Learner Experience & Phasing

## C1. Learner-facing UX

### Onboarding (one screen, three levers + standing preferences)

The learner's first touch with a published path. Reuses the intake pattern proven by `question_flow`, but persisted server-side against a `learners` record rather than thrown into a one-off prompt.

1. **Goal** — `basics | deep | practical`. Maps to path density: which knowledge types are included (basics = facts/definitions/warnings; deep = everything; practical = procedures/decision_rules/examples first).
2. **Time budget** — `5 | 15 | 30+` min/day. Determines units-per-session and drives the pace estimate ("~3 weeks at your pace").
3. **Focus areas** — multi-select of subtopics, derived from interview section titles (already in `interview_sections`) and knowledge-unit tag clusters. Selected areas are weighted forward in path ordering; the path preview re-renders live as selections change.

Plus a free-text **"how I learn" preference** ("explain with football analogies", "always give me a TLDR first") — stored on the learner record and injected into every lesson-generation prompt as a standing instruction. This is the learner-side mirror of the expert's `ExpertProfile`: cheap to capture, compounding in value.

### Path view (the new home screen)

A Start→Goal node trail replacing the current flat tool page as the primary surface:

- **Milestone nodes** (filled): lesson units — one concept card + one exercise, generated from 1–3 related knowledge units.
- **Checkpoint nodes** (hollow): review units — spaced-repetition exercises drawn from previously seen knowledge the learner got wrong or hasn't practiced recently. Phase 1 renders them; Phase 2 makes them adaptive.
- **Stage banners**: the path terminates in explicit "Refine with feedback" and "Master and retain" stages (mixed review + scenario quiz drawn from the expert's `example` and `decision_rule` knowledge).
- **Pace estimate**: recomputed from remaining units × time budget whenever the learner changes levers or completes a session. Server-computed, returned with the path payload.

### Daily session flow

Session = `ceil(timeBudget / ~3 min)` units. Each unit:

1. **Lesson card** — one concept, bite-sized. Comparison/table/quote layouts reuse the existing `Custom` component variants (`text | list | highlight | quote | stats | timeline`), which already cover Wondering's card vocabulary almost exactly.
2. **Exercise** — one of MC / Click & Fill / Order Steps, generated from the same knowledge the card taught.
3. **Feedback** — immediate, using the expert's actual explanation (the knowledge unit's `content` + the interview quote it came from where available). Provenance is the differentiator: "Sarah says…" beats a generic explanation.

Attempts are recorded (`attempts` table, Section A) — correctness feeds checkpoint selection and the mastery stage.

### Frontend architecture (Page → Hook → Component)

New routes in `apps/web/src/App.tsx` alongside the existing seven:

| Route | Page | Hook | Key components |
|---|---|---|---|
| `/learn/:workspaceId` | `PathPage` | `usePath` | `PathTrail`, `PaceEstimate`, `StageBanner` |
| `/learn/:workspaceId/onboard` | `LearnerOnboardingPage` | `useLearnerProfile` | `GoalPicker`, `TimePicker`, `FocusPicker`, `PreferenceInput` |
| `/learn/:workspaceId/session` | `SessionPage` | `useSession` | `LessonCard`, `ExerciseMC`, `ExerciseClickFill`, `ExerciseOrderSteps`, `FeedbackPanel` |

All networking in the hooks; exercise components take config + `onAnswer` props only, mirroring how `Quiz.tsx`/`Curriculum.tsx` are structured today. Register each page with `useRegisterInteraction()` so the chat/voice companion stays aware of learner position (the registry in `lib/InteractionContext.tsx` already supports this — add descriptors to `pageInteractions.ts`).

## C2. What survives from the current tool page

**Graduates into the learning platform:**

- **`curriculum`** → becomes the path spine. Its `modules[].learningObjectives/prerequisites/estimatedTime` schema is already the right shape; module content generation moves server-side (today `Curriculum.tsx` generates via `askExpert()` and caches in localStorage — that cache moves to the DB as path units).
- **`quiz`** → decomposes into exercise units. Its `knowledge_check`/`scenario` modes and per-option `explanation` fields map directly onto MC exercises and the mastery stage.
- **`question_flow`** → becomes the onboarding intake pattern (levers + preferences), persisted rather than prompt-only.

**Stays as reference material**, attached to path nodes as "toolkit" links: `calculator`, `checklist`, `decision_tree`, `step_by_step`, `info_card`, `task_board`. A milestone about budgeting deep-links to the relevant calculator; the operations board becomes the post-path "you're operating now" surface. The tool page itself remains at `/tool/:workspaceId` for experts/creators and as the reference library.

**Ask-the-expert becomes a path-wide companion.** `ChatSidebar` (text + ElevenLabs voice) rides along on every learner screen, answering with the 5-layer context. Precondition: the 5-layer prompt is currently inline template text duplicated between `/tool/ask` and `/tool/advice` in `apps/api/src/routes/tools.ts` — extract it into a single `buildExpertContext()` service that the ask, advice, voice-session, and new lesson-generation endpoints all share. Layer 4 (user situation) is fed from the learner profile + path position instead of ad-hoc `userContext`.

## C3. Phasing

### Gating debt (do first — small, unblocks everything)

1. **Materialize the knowledge base**: build the `knowledge_units` table per Section A (which also drops the never-written `workspaces.knowledge_base` column). The path generator needs one authoritative, curated source.
2. **Unify interview engines**: the voice path (extraction-count advancement, never completes) must converge with the text path (validator-gated, emits `interview_complete`) — otherwise voice-captured knowledge feeds paths from interviews stuck in limbo.
3. **Persist advice**: `/tool/advice` output is stream-only today; lesson content must be persisted units, so build persistence as the norm now.
4. **Validate `apply-updates`**: LLM-generated component configs go into `toolConfig.layout` unchecked; add schema validation before path units depend on config integrity.

### Phase 1 — Walkable path (core loop)

- Learner tables (`learners`, `paths`, `path_units`, `attempts`), knowledge-base materialization.
- Path generation from existing knowledge using the proven structure-then-fill pattern (Opus plans the path skeleton, Sonnet fills units in parallel with cached system prompt — same shape as `tool-generator.ts`).
- Onboarding page (three levers, no free-text prefs yet), path view with static pace estimate, session flow with **MC + Click & Fill** exercises (cheapest to derive: facts/definitions/metrics → blanks; common-mistakes/decision-rules → distractors).
- **Success criteria**: a learner can onboard, walk a generated path end-to-end from a real interview, answer exercises with expert-sourced feedback, and resume where they left off on another device. Zero localStorage-only state.

### Phase 2 — Adaptive & sticky

- **Order Steps** exercise (from `procedure.steps`), drag-to-reorder.
- Spaced repetition: checkpoint nodes select from wrong/stale attempts; "master and retain" stage generated from attempt history.
- Pace recalculation on lever changes and session completion; standing "how I learn" preferences injected into unit generation.
- Chat/voice companion wired to learner position via the interaction registry.
- **Success criteria**: checkpoint content demonstrably reflects the learner's mistakes; changing time budget visibly re-plans the path; week-2 return rate measurable (needs basic event logging).

### Phase 3 — Polish & habit loop

- Generated diagrams per lesson (image gen from unit content).
- PWA/iOS wrapper with the standard update banner (`vite-plugin-pwa` + `UpdateBanner` per house rules) so deploys don't strand cached bundles.
- Streaks, session reminders, completion celebration; expert-facing analytics (which knowledge units confuse learners → follow-up interview suggestions, closing the loop back into Forge's capture side).
- **Success criteria**: daily-return habit metrics live; expert can see "learners struggle with X" and launch a follow-up interview on it from the workspace.
