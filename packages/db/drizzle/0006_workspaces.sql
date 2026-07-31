-- Step 1: Create workspaces table
CREATE TABLE IF NOT EXISTS "workspaces" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "tool_config" jsonb,
  "knowledge_base" jsonb,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_workspaces_created" ON "workspaces" USING btree ("created_at");

--> statement-breakpoint
-- Step 2: Add workspace_id columns (nullable initially)
ALTER TABLE "forges" ADD COLUMN "workspace_id" uuid;
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "workspace_id" uuid;
--> statement-breakpoint
ALTER TABLE "tool_sessions" ADD COLUMN "workspace_id" uuid;

--> statement-breakpoint
-- Step 3: Data migration - create workspace for each existing forge
INSERT INTO "workspaces" ("id", "title", "tool_config", "knowledge_base", "created_at", "updated_at")
SELECT "id", "title", "tool_config", "knowledge_base", "created_at", "updated_at" FROM "forges"
ON CONFLICT DO NOTHING;

--> statement-breakpoint
-- Step 4: Link existing data
UPDATE "forges" SET "workspace_id" = "id" WHERE "workspace_id" IS NULL;
--> statement-breakpoint
UPDATE "documents" SET "workspace_id" = "forge_id" WHERE "workspace_id" IS NULL;
--> statement-breakpoint
UPDATE "tool_sessions" SET "workspace_id" = "forge_id" WHERE "workspace_id" IS NULL;

--> statement-breakpoint
-- Step 5: Make workspace_id NOT NULL and add FKs
ALTER TABLE "forges" ALTER COLUMN "workspace_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "forges" ADD CONSTRAINT "forges_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_forges_workspace" ON "forges" USING btree ("workspace_id");

--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "workspace_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "tool_sessions" ALTER COLUMN "workspace_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "tool_sessions" ADD CONSTRAINT "tool_sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
-- Step 6: Drop old columns and indexes
ALTER TABLE "forges" DROP COLUMN "tool_config";
--> statement-breakpoint
ALTER TABLE "forges" DROP COLUMN "knowledge_base";
--> statement-breakpoint
DROP INDEX IF EXISTS "idx_documents_forge";
--> statement-breakpoint
ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "documents_forge_id_forges_id_fk";
--> statement-breakpoint
ALTER TABLE "documents" DROP COLUMN "forge_id";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_documents_workspace" ON "documents" USING btree ("workspace_id");

--> statement-breakpoint
DROP INDEX IF EXISTS "idx_tool_sessions_forge";
--> statement-breakpoint
ALTER TABLE "tool_sessions" DROP CONSTRAINT IF EXISTS "tool_sessions_forge_id_forges_id_fk";
--> statement-breakpoint
ALTER TABLE "tool_sessions" DROP COLUMN "forge_id";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tool_sessions_workspace" ON "tool_sessions" USING btree ("workspace_id");
