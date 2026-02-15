# Forge

**Expert knowledge, forged into tools for everyone.**

Forge captures what experts know through natural conversation and transforms it into interactive tools anyone can use. No forms. No manuals. Just speak.

Built for the [Claude Code Hackathon](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/claude-code-hackathon) - *Break the Barriers* problem statement.

## How It Works

1. **Speak Your Knowledge** - An AI interviewer conducts a structured conversation, asking the right questions to draw out what you know. Voice or text.
2. **Knowledge Extraction** - As you talk, Opus extracts structured knowledge in real-time: facts, processes, decisions, pitfalls.
3. **Interactive Tool** - Your knowledge becomes a living tool: decision trees, checklists, calculators, quizzes. Share a link and anyone benefits.

## Seven Opus Roles

Opus 4.6 isn't just the model - it's the architect. Seven distinct roles orchestrate the pipeline:

| Role | What It Does |
|------|-------------|
| **Interview Planner** | Designs structured interview sections with extraction priorities based on domain analysis |
| **Conductor** | Manages conversation flow in real-time, deciding when to probe deeper vs advance |
| **Knowledge Extractor** | Pulls structured facts, processes, and decisions from natural conversation |
| **Tool Architect** | Selects the right component types and designs tool layout from extracted knowledge |
| **Expert Channel** | Answers user questions by channelling expert knowledge through 5-layer cascading context |
| **Tool Refiner** | Understands conversational edit requests and updates component configs in real-time |
| **Knowledge Integrator** | Analyzes follow-up interviews and proposes updates to existing tools |

## Component Types

- **Decision Trees** - Branching logic with recommendations
- **Checklists** - Requirements and readiness validation
- **Step-by-Step Guides** - Sequential procedures with tips
- **Calculators** - Quantitative assessments with formulas
- **Question Flows** - Intake questionnaires with AI advice
- **Quizzes** - Knowledge checks and scenario testing
- **Score Cards** - Multi-criteria evaluation
- **Comparison Tables** - Side-by-side analysis
- **Info Cards** - Key reference information
- **Risk Assessments** - Risk identification and mitigation
- **Context Panels** - Situational guidance

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, TypeScript, Tailwind CSS, Vite |
| Backend | Bun, Hono, Server-Sent Events |
| Database | PostgreSQL 16, Drizzle ORM, pgvector |
| AI Models | Claude Opus 4.6, Claude Sonnet 4.5 |
| Voice | ElevenLabs Conversational AI |
| Testing | Playwright (31 E2E tests) |

## Quick Start

```bash
# Prerequisites: Docker, Bun, Node.js 20+

# Clone and install
git clone https://github.com/bigadamknight/forge.git
cd forge
yarn install

# Start PostgreSQL
docker compose up -d

# Configure environment
cp .env.example .env
# Add your ANTHROPIC_API_KEY and ELEVENLABS_API_KEY

# Run migrations and seed data
./stack db:migrate
yarn workspace @forge/db seed

# Start the app
./stack start
# Frontend: http://localhost:3070
# API: http://localhost:3071
```

## Project Structure

```
apps/
  api/          Bun + Hono REST API with SSE streaming
  web/          React SPA (Vite + Tailwind)
packages/
  db/           Drizzle schema, migrations, seeds
  shared/       Shared TypeScript types
  mcp/          MCP server for forge knowledge
e2e/            Playwright E2E tests
```

## Development

```bash
./stack api          # API server on :3071
./stack web          # Frontend on :3070
./stack typecheck    # TypeScript checks
./stack db:migrate   # Run migrations
./stack db:psql      # Database shell

# E2E tests (requires running app)
yarn test:e2e
```

## Built By

Adam Knight - [@bigadamknight](https://github.com/bigadamknight)

Built entirely with Claude Code (Opus 4.6).
