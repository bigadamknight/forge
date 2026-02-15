CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
ALTER TABLE "extractions" ADD COLUMN "embedding" vector(1536);
--> statement-breakpoint
CREATE INDEX idx_extractions_embedding ON extractions
  USING hnsw (embedding vector_cosine_ops);
--> statement-breakpoint
CREATE INDEX idx_extractions_content_trgm ON extractions
  USING gin (content gin_trgm_ops);
--> statement-breakpoint
CREATE TABLE embedding_cache (
  content_hash TEXT PRIMARY KEY,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
