CREATE TABLE "extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"forge_id" uuid NOT NULL,
	"section_id" uuid,
	"question_id" uuid,
	"type" text NOT NULL,
	"content" text NOT NULL,
	"structured" jsonb,
	"confidence" real DEFAULT 0.8,
	"tags" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"expert_name" text NOT NULL,
	"expert_bio" text,
	"domain" text NOT NULL,
	"target_audience" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"interview_config" jsonb,
	"tool_config" jsonb,
	"knowledge_base" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "interview_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" uuid NOT NULL,
	"text" text NOT NULL,
	"goal" text,
	"order_index" integer NOT NULL,
	"validation_result" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answered_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "interview_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"forge_id" uuid NOT NULL,
	"title" text NOT NULL,
	"goal" text,
	"order_index" integer NOT NULL,
	"summary" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"forge_id" uuid NOT NULL,
	"user_context" jsonb,
	"tool_state" jsonb,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "extractions" ADD CONSTRAINT "extractions_forge_id_forges_id_fk" FOREIGN KEY ("forge_id") REFERENCES "public"."forges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extractions" ADD CONSTRAINT "extractions_section_id_interview_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."interview_sections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extractions" ADD CONSTRAINT "extractions_question_id_interview_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."interview_questions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_questions" ADD CONSTRAINT "interview_questions_section_id_interview_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."interview_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_sections" ADD CONSTRAINT "interview_sections_forge_id_forges_id_fk" FOREIGN KEY ("forge_id") REFERENCES "public"."forges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_question_id_interview_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."interview_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_sessions" ADD CONSTRAINT "tool_sessions_forge_id_forges_id_fk" FOREIGN KEY ("forge_id") REFERENCES "public"."forges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_extractions_forge" ON "extractions" USING btree ("forge_id");--> statement-breakpoint
CREATE INDEX "idx_extractions_type" ON "extractions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_forges_status" ON "forges" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_questions_section" ON "interview_questions" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "idx_sections_forge" ON "interview_sections" USING btree ("forge_id");--> statement-breakpoint
CREATE INDEX "idx_messages_question" ON "messages" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "idx_tool_sessions_forge" ON "tool_sessions" USING btree ("forge_id");