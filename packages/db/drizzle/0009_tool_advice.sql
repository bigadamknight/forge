CREATE TABLE IF NOT EXISTS "tool_advice" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "question" text NOT NULL,
  "user_context" jsonb,
  "sections" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tool_advice_workspace" ON "tool_advice" USING btree ("workspace_id");
