# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Forge - AI-powered platform that captures expert knowledge through interviews and generates interactive tools. Yarn workspaces monorepo.

## Quick Start

```bash
docker compose up -d          # PostgreSQL on :5435
./stack db:migrate             # Run migrations
./stack api                    # API on :3071 (bun)
./stack web                    # Frontend on :3070 (vite)
```

Or `./stack start` for all services. `./stack help` for all commands.

## Architecture

| Workspace | Stack | Purpose |
|-----------|-------|---------|
| `apps/api` | **Bun** + Hono | REST API + SSE streaming |
| `apps/web` | React + Vite + Tailwind | Frontend SPA (react-router-dom) |
| `packages/db` | Drizzle + PostgreSQL 16 | Schema, migrations, seeds |
| `packages/shared` | TypeScript | Shared types (types-only, no runtime) |

**Runtime split:** API runs on Bun (`bun run --cwd apps/api`). Frontend uses yarn/vite (`yarn workspace @forge/web dev`). Migrations run on Bun (`bun run --cwd packages/db`).

**Vite proxy:** `/api` requests on :3070 proxy to :3071, so frontend code uses relative `/api` paths.

## Ports

- **Frontend:** 3070
- **API:** 3071
- **PostgreSQL:** 5435

## Key Commands

```bash
./stack typecheck              # TypeScript checks (both apps)
./stack db:migrate             # Run migrations
./stack db:generate            # Generate migration from schema changes
./stack db:reset               # Drop and recreate database
./stack db:psql                # Open psql shell
yarn workspace @forge/web typecheck   # Web-only typecheck
yarn workspace @forge/db seed         # Seed interview fixtures
yarn workspace @forge/db seed:clean   # Clean seed (drops existing)
```

## Environment

Copy `.env.example` to `.env`. The API symlinks to root `.env` (`apps/api/.env -> ../../.env`).

- `DATABASE_URL` - PostgreSQL connection string
- `ANTHROPIC_API_KEY` - Claude API key
- `ELEVENLABS_API_KEY` - Voice interview agents

## Pipeline

1. **Create Forge** - expert name, domain, target audience
2. **Plan Interview** - Opus generates structured interview (sections, questions, extraction priorities)
3. **Interview** - SSE streaming conductor + validator + extractor (text chat or ElevenLabs voice)
4. **Documents** - upload supporting text/URLs for additional knowledge
5. **Generate Tool** - plan phase (Opus) then parallel component generation (Sonnet) via SSE
6. **Interactive Tool** - component toolkit with completion tracking, inline editing, expert chat

## API Routes

All routes mount under `/api/forges`. Key endpoints:

- `POST /api/forges` - create forge
- `POST /api/forges/:id/plan-interview` - generate interview config
- `GET /api/forges/:id/interview` - get full interview state
- `POST /api/forges/:id/interview/message` - send message (SSE stream)
- `POST /api/forges/:id/voice-agent` - create ElevenLabs voice agent
- `POST /api/forges/:id/documents` - add document
- `POST /api/forges/:id/generate-tool-stream` - generate tool (SSE stream)
- `GET /api/forges/:id/tool` - get tool config
- `POST /api/forges/:id/tool/ask` - ask expert (5-layer context)

## Frontend Routes

- `/` - Home (forge list)
- `/forge/new` - Create forge
- `/forge/:forgeId/interview` - Interview (text + voice)
- `/forge/:forgeId/documents` - Document upload
- `/forge/:forgeId/tool` - Interactive tool view

## Component Types

decision_tree, checklist, step_by_step, calculator, info_card, question_flow, score_card, comparison_table, context_panel, risk_assessment, task_board

## Code Patterns

- **Page -> Hook -> Component**: pages orchestrate, hooks manage state/network, components render props only
- **SSE Streaming**: interview messages and tool generation both use Server-Sent Events with `data:` JSON lines
- **Inline Editing**: `EditableText` (contentEditable) + `EditableList` (add/remove) wrappers
- **Completion Tracking**: localStorage-persisted per forge
- **Expert Context**: 5-layer cascading system (domain, expert knowledge, tool, user situation, question)
- **LLM helpers**: `apps/api/src/lib/llm.ts` provides `generateJSON`, `streamText`, `generateText` with system prompt caching and truncated JSON repair

## Interaction Registry (Voice/Chat Agent Integration)

The AI voice/chat agent discovers interactive capabilities dynamically via a registry system. **When adding new components, pages, or forms, always register their interactions.**

### Component Interactions (static registry)

`packages/shared/src/componentInteractions.ts` — shared between client and API server.

Each component type registers a `ComponentDescriptor` with:
- `summarize(config)` — contextual update string for voice mode
- `promptSummary(config)` — prompt-ready summary for session setup
- `actions[]` — available AI actions with parameter descriptions

To add a new component type:
1. Add a descriptor entry in `COMPONENT_INTERACTIONS` (shared package)
2. Add a handler + response in `apps/web/src/lib/componentInteractions.ts` (client-side `ACTION_HANDLERS` and `ACTION_RESPONSES`)
3. No changes needed to ChatSidebar or tools.ts — they read from the registry automatically

### Page/Form Interactions (runtime registry)

`apps/web/src/lib/InteractionContext.tsx` — React context provider.
`apps/web/src/lib/pageInteractions.ts` — page-level descriptors.

Pages register dynamically via `useRegisterInteraction()`:
```ts
import { useRegisterInteraction } from '../lib/InteractionContext'
import { MY_PAGE } from '../lib/pageInteractions'

// In your page component:
const { updateState } = useRegisterInteraction('page:my-page', MY_PAGE, initialState)

// When state changes:
useEffect(() => { updateState({ ...newState }) }, [deps])
```

To add interaction awareness to a new page or form:
1. Define an `InteractionDescriptor` in `pageInteractions.ts` (scope: 'page' | 'form')
2. Call `useRegisterInteraction()` in the page component
3. Call `updateState()` when relevant state changes
4. ChatSidebar reads from the context automatically via `useInteractionContext()`

### Key files
- `packages/shared/src/componentInteractions.ts` — component descriptors, prompt builders, tool rules
- `apps/web/src/lib/componentInteractions.ts` — client-side tool handlers for ElevenLabs voice
- `apps/web/src/lib/InteractionContext.tsx` — React context provider, `useRegisterInteraction` hook
- `apps/web/src/lib/pageInteractions.ts` — page/form descriptors
- `apps/web/src/components/toolkit/ChatSidebar.tsx` — consumes both registries

## AI Models

- **Opus 4.6**: interview planning, tool planning, expert answers, conductor
- **Sonnet 4.5**: component generation (parallel, with system prompt caching)
- Temperature: 0.2 (generation), 0.4 (conversation)

## Database

PostgreSQL 16 via Docker. Schema at `packages/db/src/schema.ts`. Tables: `workspaces`, `forges`, `interview_sections`, `interview_questions`, `messages`, `extractions`, `knowledge_units`, `documents`, `tool_advice`, `tool_sessions`. All use UUID primary keys with cascade deletes.

- `knowledge_units` is the curated, workspace-scoped knowledge layer: extractions are promoted into it (status `proposed`) when an interview round completes (`promoteExtractionsToUnits` in `services/knowledge-base.ts`), with embeddings and workspace-scoped hybrid search (`searchUnitsHybrid` in `lib/embeddings.ts`). `loadExpertKnowledge` reads from it, falling back to raw extractions.
- `tool_advice` persists `/tool/advice` output (question, userContext, generated sections); `GET /:workspaceId/tool/advice` lists saved advice.

## Learning Platform (Phase 1 — see docs/learning-platform-brief.md)

Paced learner paths generated from the knowledge layer. Tables: `learners`, `paths`, `path_units`, `attempts`.

- API under `/api/learn` (`routes/learn.ts`): `GET /:workspaceId/focus-areas`, `POST /:workspaceId/onboard` (SSE: plan/unit/complete), `GET /path/:pathId`, `POST /path/:pathId/next` (serves the next units strictly by position, generating any pending in the horizon; instant when buffered), `PATCH /path/:pathId/levers` (time-only → instant re-pace; goal/focus → planner re-run with diff-preserve: completed units and attempts always survive), `POST /unit/:id/attempt` (records SM-2-lite ease/dueAt via `services/spaced-repetition.ts`), `POST /unit/:id/complete`.
- Checkpoints are resolved at serve time (`resolveCheckpoint`): the learner's weakest/stalest completed exercises (wrong first, then due), re-served with a Haiku paraphrase as a `checkpoint_review` unit.
- Frontend routes: `/learn/:workspaceId` (PathPage: node trail, pace, "Adjust path" lever editor), `/learn/:workspaceId/onboard` (three levers + preferences), `/learn/:workspaceId/session` (LessonCard, ExerciseMC, ExerciseClickFill, ExerciseOrderSteps, CheckpointReview). Learner identity in localStorage `learn-${workspaceId}`.
- Unit generation is lazy (3-unit buffer ahead of the learner); provenance via `path_units.source_unit_ids` → `knowledge_units`. Unit kinds: lesson_card, exercise_mc, exercise_fill, exercise_order, checkpoint.

## AI Services (apps/api/src/services/)

- `interview-planner.ts` - generates interview config from expert intro
- `conductor.ts` - manages interview flow, decides follow-ups vs advances
- `validator.ts` - validates answer quality against question goals
- `extractor.ts` - extracts structured knowledge from answers
- `tool-generator.ts` - plan + parallel component generation + operations board
- `interview-progress.ts` - shared advancement/completion engine used by BOTH text (`routes/interviews.ts`) and voice (`routes/voice.ts`) paths — voice keeps its extraction-count gate but advancement mechanics and round completion are unified
- `knowledge-base.ts` - promotes extractions to `knowledge_units` on round completion (idempotent)
- `expert-context.ts` - shared 5-layer expert context (`buildExpertContext`) used by tool/ask, tool/advice, and unit generation
- `path-planner.ts` - learning-path skeleton (Opus, schema-validated, knowledge-unit provenance, caps in code)
- `unit-generator.ts` - per-unit content generation (lesson_card / exercise_mc / exercise_fill, cached Sonnet)

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **forge** (838 symbols, 1817 relationships, 63 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/forge/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/forge/context` | Codebase overview, check index freshness |
| `gitnexus://repo/forge/clusters` | All functional areas |
| `gitnexus://repo/forge/processes` | All execution flows |
| `gitnexus://repo/forge/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
