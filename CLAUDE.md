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

## AI Models

- **Opus 4.6**: interview planning, tool planning, expert answers, conductor
- **Sonnet 4.5**: component generation (parallel, with system prompt caching)
- Temperature: 0.2 (generation), 0.4 (conversation)

## Database

PostgreSQL 16 via Docker. Schema at `packages/db/src/schema.ts`. 7 tables: `forges`, `interview_sections`, `interview_questions`, `messages`, `extractions`, `documents`, `tool_sessions`. All use UUID primary keys with cascade deletes from forges.

## AI Services (apps/api/src/services/)

- `interview-planner.ts` - generates interview config from expert intro
- `conductor.ts` - manages interview flow, decides follow-ups vs advances
- `validator.ts` - validates answer quality against question goals
- `extractor.ts` - extracts structured knowledge from answers
- `tool-generator.ts` - plan + parallel component generation + operations board
