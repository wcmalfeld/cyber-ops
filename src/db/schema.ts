/**
 * Relational schema (PRD §14.3). Progression is append-friendly: XP is a ledger of
 * transactions with a per-user unique source key, so it can be reconstructed and
 * cannot be farmed by resubmitting.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// ── identity ───────────────────────────────────────────────────────────────

/**
 * Guests (`isGuest`) have no email or password: they play under a session cookie only
 * and can later claim the same row as a full account, keeping all progress.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  isGuest: boolean("is_guest").notNull().default(false),
  createdAt: createdAt(),
}, (t) => [check("users_credentials_unless_guest", sql`${t.isGuest} OR (${t.email} IS NOT NULL AND ${t.passwordHash} IS NOT NULL)`)]);

export const userProfiles = pgTable("user_profiles", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  currentPath: text("current_path"),
  createdAt: createdAt(),
});

/** Opaque server-side sessions. Only the SHA-256 of the cookie token is stored. */
export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// ── content ────────────────────────────────────────────────────────────────

export const skillDefinitions = pgTable("skill_definitions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
});

export const challengeCategories = pgTable("challenge_categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
});

export const missions = pgTable("missions", {
  id: text("id").primaryKey(),
  currentVersion: integer("current_version").notNull(),
  categoryId: text("category_id").notNull().references(() => challengeCategories.id),
  path: text("path").notNull(),
  difficulty: text("difficulty").notNull(),
  level: integer("level").notNull(),
  title: text("title").notNull(),
  published: boolean("published").notNull().default(true),
  dossierId: text("dossier_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Immutable, versioned mission definitions — the engine's source of truth at runtime. */
export const missionVersions = pgTable(
  "mission_versions",
  {
    missionId: text("mission_id").notNull().references(() => missions.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    definition: jsonb("definition").notNull(),
    checksum: text("checksum").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.missionId, t.version] })],
);

/** Denormalized index of a version's objectives (flags, answers live only in the definition). */
export const missionObjectives = pgTable(
  "mission_objectives",
  {
    missionId: text("mission_id").notNull(),
    version: integer("version").notNull(),
    taskId: text("task_id").notNull(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    xp: integer("xp").notNull(),
    position: integer("position").notNull(),
  },
  (t) => [primaryKey({ columns: [t.missionId, t.version, t.taskId] })],
);

export const missionEvidence = pgTable(
  "mission_evidence",
  {
    missionId: text("mission_id").notNull(),
    version: integer("version").notNull(),
    evidenceId: text("evidence_id").notNull(),
    name: text("name").notNull(),
    format: text("format").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
  },
  (t) => [primaryKey({ columns: [t.missionId, t.version, t.evidenceId] })],
);

export const companyProfiles = pgTable("company_profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  website: text("website").notNull(),
  data: jsonb("data").notNull(),
  reviewStatus: text("review_status").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const breachDossiers = pgTable("breach_dossiers", {
  id: text("id").primaryKey(),
  number: text("number").notNull(),
  title: text("title").notNull(),
  missionId: text("mission_id"),
  data: jsonb("data").notNull(),
  factCheckStatus: text("fact_check_status").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sourceReferences = pgTable(
  "source_references",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dossierId: text("dossier_id").references(() => breachDossiers.id, { onDelete: "cascade" }),
    missionId: text("mission_id"),
    title: text("title").notNull(),
    publisher: text("publisher").notNull(),
    url: text("url").notNull(),
  },
  (t) => [index("source_refs_dossier_idx").on(t.dossierId)],
);

export const achievements = pgTable("achievements", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
});

// ── user progression ───────────────────────────────────────────────────────

export const missionAttempts = pgTable(
  "mission_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    missionId: text("mission_id").notNull().references(() => missions.id),
    version: integer("version").notNull(),
    status: text("status").notNull().default("in_progress"), // in_progress | completed
    startedAt: createdAt(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("attempt_user_mission_uq").on(t.userId, t.missionId), index("attempt_user_idx").on(t.userId)],
);

export const taskProgress = pgTable(
  "task_progress",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    missionId: text("mission_id").notNull(),
    taskId: text("task_id").notNull(),
    attempts: integer("attempts").notNull().default(0), // incorrect submissions
    hintsUsed: integer("hints_used").notNull().default(0),
    solutionRevealed: boolean("solution_revealed").notNull().default(false),
    solvedAt: timestamp("solved_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.missionId, t.taskId] })],
);

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    missionId: text("mission_id").notNull(),
    version: integer("version").notNull(),
    taskId: text("task_id").notNull(),
    payload: jsonb("payload").notNull(),
    correct: boolean("correct").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("submissions_user_mission_idx").on(t.userId, t.missionId)],
);

export const hintReveals = pgTable(
  "hint_reveals",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    missionId: text("mission_id").notNull(),
    taskId: text("task_id").notNull(),
    hintIndex: integer("hint_index").notNull(), // 0–3 hints, 4 = full solution
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.missionId, t.taskId, t.hintIndex] })],
);

export const xpTransactions = pgTable(
  "xp_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    sourceKey: text("source_key").notNull(), // e.g. task:<mission>:<task>, mission:<mission>
    reason: text("reason").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("xp_user_source_uq").on(t.userId, t.sourceKey), index("xp_user_idx").on(t.userId)],
);

export const missionCompletions = pgTable(
  "mission_completions",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    missionId: text("mission_id").notNull(),
    version: integer("version").notNull(),
    xpAwarded: integer("xp_awarded").notNull(),
    independent: boolean("independent").notNull(),
    completedAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.missionId] })],
);

export const userAchievements = pgTable(
  "user_achievements",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    achievementId: text("achievement_id").notNull().references(() => achievements.id),
    earnedAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.achievementId] })],
);

/** Snapshots of computed mastery, written at mission completion for history. */
export const skillAssessments = pgTable(
  "skill_assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    skillId: text("skill_id").notNull().references(() => skillDefinitions.id),
    score: real("score").notNull(),
    level: text("level").notNull(),
    trigger: text("trigger").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("skill_assess_user_idx").on(t.userId, t.skillId)],
);

/** Simulated-terminal state per user per mission (Phase 3 adds container-backed kinds). */
export const labSessions = pgTable(
  "lab_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    missionId: text("mission_id").notNull(),
    kind: text("kind").notNull().default("simulated_terminal"),
    state: jsonb("state").notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true })
      .notNull()
      .default(sql`now() + interval '30 days'`),
  },
  (t) => [uniqueIndex("lab_user_mission_kind_uq").on(t.userId, t.missionId, t.kind)],
);

/** Planned for Phase 4 (AI mentor). Defined now so the data model is complete. */
export const mentorSessions = pgTable("mentor_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  missionId: text("mission_id"),
  transcript: jsonb("transcript").notNull().default(sql`'[]'::jsonb`),
  createdAt: createdAt(),
});
