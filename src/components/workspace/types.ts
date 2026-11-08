import type { ClientMission, ClientTask } from "@/engine/client-view";

export type { ClientMission, ClientTask };

export interface TaskProgress {
  solved: boolean;
  attempts: number;
  hintsUsed: number;
  solutionRevealed: boolean;
  hints: string[];
  solution: string | null;
  explanation: string | null;
  canRevealSolution: boolean;
}

export type Submission =
  | { kind: "flag"; value: string }
  | { kind: "text"; value: string }
  | { kind: "choice"; selected: string[] }
  | { kind: "evidence_select"; rows: string[] }
  | { kind: "ordering"; order: string[] };

export interface SubmitResult {
  correct: boolean;
  alreadySolved: boolean;
  message: string;
  xpAwarded: number;
  achievements: string[];
  explanation: string | null;
}

export interface EvidenceFile {
  id: string;
  name: string;
  format: "csv" | "log" | "json" | "txt";
  content: string;
}
