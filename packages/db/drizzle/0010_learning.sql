CREATE TABLE IF NOT EXISTS "learners" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "display_name" text,
  "preferences" jsonb,
  "context" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_learners_workspace" ON "learners" USING btree ("workspace_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "paths" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "learner_id" uuid NOT NULL REFERENCES "learners"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "goal" text NOT NULL,
  "daily_minutes" smallint NOT NULL,
  "focus_areas" jsonb,
  "sequence" jsonb,
  "status" text DEFAULT 'active' NOT NULL,
  "estimated_days" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_paths_learner" ON "paths" USING btree ("learner_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "path_units" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "path_id" uuid NOT NULL REFERENCES "paths"("id") ON DELETE CASCADE,
  "order_index" integer NOT NULL,
  "kind" text NOT NULL,
  "content" jsonb,
  "source_unit_ids" jsonb,
  "status" text DEFAULT 'pending' NOT NULL,
  "generated_at" timestamp with time zone,
  "completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pu_path" ON "path_units" USING btree ("path_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pu_path_order" ON "path_units" USING btree ("path_id", "order_index");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "path_unit_id" uuid NOT NULL REFERENCES "path_units"("id") ON DELETE CASCADE,
  "learner_id" uuid NOT NULL REFERENCES "learners"("id") ON DELETE CASCADE,
  "answer" jsonb,
  "correct" text,
  "latency_ms" integer,
  "ease" real,
  "due_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_attempts_learner" ON "attempts" USING btree ("learner_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_attempts_due" ON "attempts" USING btree ("learner_id", "due_at");
