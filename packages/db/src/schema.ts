import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  smallint,
  real,
  jsonb,
  index,
} from "drizzle-orm/pg-core"
import type {
  InterviewConfig,
  ToolConfig,
  KnowledgeBase,
  ValidationResult,
  SectionSummary,
  InterviewDepth,
  LearnerGoal,
  LearnerPreferences,
  PathSequence,
  PathUnitKind,
} from "@forge/shared"

// ============ Workspaces ============

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description"),
    toolConfig: jsonb("tool_config").$type<ToolConfig>(),
    knowledgeBase: jsonb("knowledge_base").$type<KnowledgeBase>(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_workspaces_created").on(table.createdAt)]
)

// ============ Forges (Interviews) ============

export const forges = pgTable(
  "forges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    expertName: text("expert_name"),
    expertBio: text("expert_bio"),
    domain: text("domain"),
    targetAudience: text("target_audience"),
    status: text("status", {
      enum: ["draft", "planning", "interviewing", "processing", "generating", "complete", "archived"],
    })
      .default("draft")
      .notNull(),
    interviewConfig: jsonb("interview_config").$type<InterviewConfig>(),
    depth: text("depth").$type<InterviewDepth>().default("standard").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_forges_status").on(table.status),
    index("idx_forges_workspace").on(table.workspaceId),
  ]
)

// ============ Interview Sections ============

export const interviewSections = pgTable(
  "interview_sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    forgeId: uuid("forge_id")
      .notNull()
      .references(() => forges.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    goal: text("goal"),
    orderIndex: integer("order_index").notNull(),
    summary: jsonb("summary").$type<SectionSummary>(),
    round: smallint("round").default(1).notNull(),
    status: text("status", {
      enum: ["pending", "active", "completed", "skipped"],
    })
      .default("pending")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [index("idx_sections_forge").on(table.forgeId)]
)

// ============ Interview Questions ============

export const interviewQuestions = pgTable(
  "interview_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => interviewSections.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    goal: text("goal"),
    orderIndex: integer("order_index").notNull(),
    validationResult: jsonb("validation_result").$type<ValidationResult>(),
    status: text("status", {
      enum: ["pending", "active", "answered", "skipped"],
    })
      .default("pending")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
  },
  (table) => [index("idx_questions_section").on(table.sectionId)]
)

// ============ Messages ============

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => interviewQuestions.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_messages_question").on(table.questionId)]
)

// ============ Extractions ============

export const extractions = pgTable(
  "extractions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    forgeId: uuid("forge_id")
      .notNull()
      .references(() => forges.id, { onDelete: "cascade" }),
    sectionId: uuid("section_id").references(() => interviewSections.id, {
      onDelete: "set null",
    }),
    questionId: uuid("question_id").references(() => interviewQuestions.id, {
      onDelete: "set null",
    }),
    type: text("type").notNull(),
    content: text("content").notNull(),
    structured: jsonb("structured"),
    confidence: real("confidence").default(0.8),
    tags: jsonb("tags").$type<string[]>(),
    round: smallint("round").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_extractions_forge").on(table.forgeId),
    index("idx_extractions_type").on(table.type),
  ]
)

// ============ Knowledge Units (curated workspace knowledge layer) ============

export const knowledgeUnits = pgTable(
  "knowledge_units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    // provenance chain: extraction → question → section → forge
    extractionId: uuid("extraction_id").references(() => extractions.id, {
      onDelete: "set null",
    }),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    type: text("type").notNull(),
    content: text("content").notNull(),
    structured: jsonb("structured"),
    confidence: real("confidence"),
    tags: jsonb("tags").$type<string[]>(),
    status: text("status", {
      enum: ["proposed", "approved", "superseded", "rejected"],
    })
      .default("proposed")
      .notNull(),
    supersededBy: uuid("superseded_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_ku_workspace").on(table.workspaceId),
    index("idx_ku_status").on(table.status),
    index("idx_ku_type").on(table.type),
  ]
)

// ============ Documents ============

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["text", "url"] }).notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    extractedContent: text("extracted_content"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_documents_workspace").on(table.workspaceId)]
)

// ============ Tool Advice (persisted personalized advice) ============

export const toolAdvice = pgTable(
  "tool_advice",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    userContext: jsonb("user_context"),
    sections: jsonb("sections").$type<Array<{ title: string; description: string; content: string }>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_tool_advice_workspace").on(table.workspaceId)]
)

// ============ Learning Platform ============

export const learners = pgTable(
  "learners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    displayName: text("display_name"),
    preferences: jsonb("preferences").$type<LearnerPreferences>(),
    context: jsonb("context"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_learners_workspace").on(table.workspaceId)]
)

export const paths = pgTable(
  "paths",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    goal: text("goal").$type<LearnerGoal>().notNull(),
    dailyMinutes: smallint("daily_minutes").notNull(),
    focusAreas: jsonb("focus_areas").$type<string[]>(),
    sequence: jsonb("sequence").$type<PathSequence>(),
    status: text("status", { enum: ["active", "completed", "archived"] })
      .default("active")
      .notNull(),
    estimatedDays: integer("estimated_days"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_paths_learner").on(table.learnerId)]
)

export const pathUnits = pgTable(
  "path_units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pathId: uuid("path_id")
      .notNull()
      .references(() => paths.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),
    kind: text("kind").$type<PathUnitKind>().notNull(),
    content: jsonb("content"),
    sourceUnitIds: jsonb("source_unit_ids").$type<string[]>(),
    status: text("status", { enum: ["pending", "generated", "completed", "skipped"] })
      .default("pending")
      .notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_pu_path").on(table.pathId),
    index("idx_pu_path_order").on(table.pathId, table.orderIndex),
  ]
)

export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pathUnitId: uuid("path_unit_id")
      .notNull()
      .references(() => pathUnits.id, { onDelete: "cascade" }),
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    answer: jsonb("answer"),
    correct: text("correct", { enum: ["yes", "no", "partial"] }),
    latencyMs: integer("latency_ms"),
    ease: real("ease"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_attempts_learner").on(table.learnerId),
    index("idx_attempts_due").on(table.learnerId, table.dueAt),
  ]
)

// ============ Tool Sessions ============

export const toolSessions = pgTable(
  "tool_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userContext: jsonb("user_context"),
    toolState: jsonb("tool_state"),
    result: jsonb("result"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_tool_sessions_workspace").on(table.workspaceId)]
)
