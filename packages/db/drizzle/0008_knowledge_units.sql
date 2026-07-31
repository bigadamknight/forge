-- Knowledge units: curated, workspace-scoped knowledge layer promoted from extractions
CREATE TABLE IF NOT EXISTS "knowledge_units" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "extraction_id" uuid REFERENCES "extractions"("id") ON DELETE SET NULL,
  "document_id" uuid REFERENCES "documents"("id") ON DELETE SET NULL,
  "type" text NOT NULL,
  "content" text NOT NULL,
  "structured" jsonb,
  "confidence" real,
  "tags" jsonb,
  "status" text DEFAULT 'proposed' NOT NULL,
  "superseded_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ku_workspace" ON "knowledge_units" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ku_status" ON "knowledge_units" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ku_type" ON "knowledge_units" USING btree ("type");
--> statement-breakpoint
-- One unit per source extraction (promotion job idempotency)
CREATE UNIQUE INDEX IF NOT EXISTS "idx_ku_extraction_unique" ON "knowledge_units" ("extraction_id") WHERE "extraction_id" IS NOT NULL;
--> statement-breakpoint
-- Embedding column + search indexes, mirroring 0003_pgvector.sql
ALTER TABLE "knowledge_units" ADD COLUMN "embedding" vector(1536);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_ku_embedding ON knowledge_units
  USING hnsw (embedding vector_cosine_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_ku_content_trgm ON knowledge_units
  USING gin (content gin_trgm_ops);
--> statement-breakpoint
-- Backfill: grandfather existing extractions in as approved units, copying embeddings
INSERT INTO "knowledge_units" ("workspace_id", "extraction_id", "type", "content", "structured", "confidence", "tags", "status", "embedding", "created_at")
SELECT f."workspace_id", e."id", e."type", e."content", e."structured", e."confidence", e."tags", 'approved', e."embedding", e."created_at"
FROM "extractions" e
JOIN "forges" f ON f."id" = e."forge_id"
WHERE f."workspace_id" IS NOT NULL
ON CONFLICT DO NOTHING;
