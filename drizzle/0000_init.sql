CREATE TABLE "achievements" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "breach_dossiers" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"title" text NOT NULL,
	"mission_id" text,
	"data" jsonb NOT NULL,
	"fact_check_status" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "challenge_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"location" text NOT NULL,
	"website" text NOT NULL,
	"data" jsonb NOT NULL,
	"review_status" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hint_reveals" (
	"user_id" uuid NOT NULL,
	"mission_id" text NOT NULL,
	"task_id" text NOT NULL,
	"hint_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hint_reveals_user_id_mission_id_task_id_hint_index_pk" PRIMARY KEY("user_id","mission_id","task_id","hint_index")
);
--> statement-breakpoint
CREATE TABLE "lab_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"mission_id" text NOT NULL,
	"kind" text DEFAULT 'simulated_terminal' NOT NULL,
	"state" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone DEFAULT now() + interval '30 days' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mentor_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"mission_id" text,
	"transcript" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mission_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"mission_id" text NOT NULL,
	"version" integer NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "mission_completions" (
	"user_id" uuid NOT NULL,
	"mission_id" text NOT NULL,
	"version" integer NOT NULL,
	"xp_awarded" integer NOT NULL,
	"independent" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mission_completions_user_id_mission_id_pk" PRIMARY KEY("user_id","mission_id")
);
--> statement-breakpoint
CREATE TABLE "mission_evidence" (
	"mission_id" text NOT NULL,
	"version" integer NOT NULL,
	"evidence_id" text NOT NULL,
	"name" text NOT NULL,
	"format" text NOT NULL,
	"size_bytes" integer NOT NULL,
	CONSTRAINT "mission_evidence_mission_id_version_evidence_id_pk" PRIMARY KEY("mission_id","version","evidence_id")
);
--> statement-breakpoint
CREATE TABLE "mission_objectives" (
	"mission_id" text NOT NULL,
	"version" integer NOT NULL,
	"task_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"xp" integer NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "mission_objectives_mission_id_version_task_id_pk" PRIMARY KEY("mission_id","version","task_id")
);
--> statement-breakpoint
CREATE TABLE "mission_versions" (
	"mission_id" text NOT NULL,
	"version" integer NOT NULL,
	"definition" jsonb NOT NULL,
	"checksum" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mission_versions_mission_id_version_pk" PRIMARY KEY("mission_id","version")
);
--> statement-breakpoint
CREATE TABLE "missions" (
	"id" text PRIMARY KEY NOT NULL,
	"current_version" integer NOT NULL,
	"category_id" text NOT NULL,
	"path" text NOT NULL,
	"difficulty" text NOT NULL,
	"level" integer NOT NULL,
	"title" text NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"dossier_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"skill_id" text NOT NULL,
	"score" real NOT NULL,
	"level" text NOT NULL,
	"trigger" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dossier_id" text,
	"mission_id" text,
	"title" text NOT NULL,
	"publisher" text NOT NULL,
	"url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"mission_id" text NOT NULL,
	"version" integer NOT NULL,
	"task_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"correct" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_progress" (
	"user_id" uuid NOT NULL,
	"mission_id" text NOT NULL,
	"task_id" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"hints_used" integer DEFAULT 0 NOT NULL,
	"solution_revealed" boolean DEFAULT false NOT NULL,
	"solved_at" timestamp with time zone,
	CONSTRAINT "task_progress_user_id_mission_id_task_id_pk" PRIMARY KEY("user_id","mission_id","task_id")
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"user_id" uuid NOT NULL,
	"achievement_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_achievements_user_id_achievement_id_pk" PRIMARY KEY("user_id","achievement_id")
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"current_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "xp_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"source_key" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hint_reveals" ADD CONSTRAINT "hint_reveals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_sessions" ADD CONSTRAINT "lab_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentor_sessions" ADD CONSTRAINT "mentor_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_attempts" ADD CONSTRAINT "mission_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_attempts" ADD CONSTRAINT "mission_attempts_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_completions" ADD CONSTRAINT "mission_completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_versions" ADD CONSTRAINT "mission_versions_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "missions" ADD CONSTRAINT "missions_category_id_challenge_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."challenge_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_assessments" ADD CONSTRAINT "skill_assessments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_assessments" ADD CONSTRAINT "skill_assessments_skill_id_skill_definitions_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skill_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_references" ADD CONSTRAINT "source_references_dossier_id_breach_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."breach_dossiers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_progress" ADD CONSTRAINT "task_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievement_id_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_transactions" ADD CONSTRAINT "xp_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lab_user_mission_kind_uq" ON "lab_sessions" USING btree ("user_id","mission_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "attempt_user_mission_uq" ON "mission_attempts" USING btree ("user_id","mission_id");--> statement-breakpoint
CREATE INDEX "attempt_user_idx" ON "mission_attempts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "skill_assess_user_idx" ON "skill_assessments" USING btree ("user_id","skill_id");--> statement-breakpoint
CREATE INDEX "source_refs_dossier_idx" ON "source_references" USING btree ("dossier_id");--> statement-breakpoint
CREATE INDEX "submissions_user_mission_idx" ON "submissions" USING btree ("user_id","mission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "xp_user_source_uq" ON "xp_transactions" USING btree ("user_id","source_key");--> statement-breakpoint
CREATE INDEX "xp_user_idx" ON "xp_transactions" USING btree ("user_id");