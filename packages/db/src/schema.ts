import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
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
  ExtractionType,
  EXTRACTION_TYPES,
  InterviewDepth,
} from "@forge/shared"

// ============ Forges ============

export const forges = pgTable(
  "forges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    expertName: text("expert_name").notNull(),
    expertBio: text("expert_bio"),
    domain: text("domain").notNull(),
    targetAudience: text("target_audience"),
    status: text("status", {
      enum: ["draft", "planning", "interviewing", "processing", "generating", "complete", "archived"],
    })
      .default("draft")
      .notNull(),
    interviewConfig: jsonb("interview_config").$type<InterviewConfig>(),
    toolConfig: jsonb("tool_config").$type<ToolConfig>(),
    knowledgeBase: jsonb("knowledge_base").$type<KnowledgeBase>(),
    depth: text("depth").$type<InterviewDepth>().default("standard").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [index("idx_forges_status").on(table.status)]
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
    type: text("type", {
      enum: [
        "fact",
        "procedure",
        "decision_rule",
        "warning",
        "tip",
        "metric",
        "definition",
        "example",
        "context",
      ],
    }).notNull(),
    content: text("content").notNull(),
    structured: jsonb("structured"),
    confidence: real("confidence").default(0.8),
    tags: jsonb("tags").$type<string[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_extractions_forge").on(table.forgeId),
    index("idx_extractions_type").on(table.type),
  ]
)

// ============ Documents ============

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    forgeId: uuid("forge_id")
      .notNull()
      .references(() => forges.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["text", "url"] }).notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    extractedContent: text("extracted_content"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_documents_forge").on(table.forgeId)]
)

// ============ Tool Sessions ============

export const toolSessions = pgTable(
  "tool_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    forgeId: uuid("forge_id")
      .notNull()
      .references(() => forges.id, { onDelete: "cascade" }),
    userContext: jsonb("user_context"),
    toolState: jsonb("tool_state"),
    result: jsonb("result"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_tool_sessions_forge").on(table.forgeId)]
)
