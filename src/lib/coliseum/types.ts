/**
 * Backend types for the Code Coliseum battle engine.
 * These are separate from the frontend UI types in src/lib/types.ts.
 */

export type ContenderId = "minimalist" | "sprinter" | "architect";

export interface ContenderDef {
  id: ContenderId;
  name: string;
}

/** Immutable definitions for the three contenders. */
export const CONTENDERS: ContenderDef[] = [
  { id: "minimalist", name: "Minimalist" },
  { id: "sprinter",   name: "Sprinter"   },
  { id: "architect",  name: "Architect"  },
] as const;

// ─── Per-contender status ──────────────────────────────────────────────────

/**
 * Full lifecycle of a contender in a battle:
 *
 * CREATED → PROVISIONING → READY → RUNNING → COMPLETED
 *                        ↘ PROVISIONING_FAILED
 *                                          ↘ FAILED
 */
export type ContenderBattleStatus =
  | "CREATED"
  | "PROVISIONING"
  | "READY"
  | "PROVISIONING_FAILED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED";

// ─── Bob parsed events ─────────────────────────────────────────────────────

export interface BobEvent {
  contenderId: ContenderId;
  type: string;
  timestamp: string;
  /** Tool name when type is tool_use or tool_result */
  toolName?: string;
  /** Parsed content when useful */
  content?: unknown;
  /** The original raw line for debugging */
  rawLine?: string;
}

// ─── Gauntlet ─────────────────────────────────────────────────────────────

export type GauntletCheckStatus = "PASS" | "FAIL";
export type GauntletStatus = "SURVIVED" | "ELIMINATED";

export interface GauntletCheck {
  id: string;
  name: string;
  status: GauntletCheckStatus;
  durationMs?: number;
  detail?: string;
}

export interface GauntletMetrics {
  filesChanged: number;
  linesAdded: number;
  linesDeleted: number;
}

export interface GauntletResult {
  status: GauntletStatus;
  checks: GauntletCheck[];
  metrics: GauntletMetrics;
}

// ─── Git evidence ──────────────────────────────────────────────────────────

export interface GitEvidence {
  /** Output of git status --porcelain */
  statusPorcelain: string;
  /** List of changed file paths */
  filesChanged: string[];
  /** Output of git diff --stat */
  diffStat: string;
  /** Error message if evidence collection failed */
  error?: string;
}

// ─── Per-contender execution state ────────────────────────────────────────

export interface ContenderBattleState {
  id: ContenderId;
  name: string;
  branch: string;
  worktreePath: string;
  status: ContenderBattleStatus;

  // Provisioning
  provisioningError?: string;

  // Execution timing
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;

  // Bob result
  exitCode?: number;
  bobResultStatus?: string;
  sessionCost?: number;

  // Parsed events from Bob stdout
  events: BobEvent[];

  // Raw log lines that failed JSON parse
  rawLogs: string[];

  // Git evidence collected after Bob completes
  gitEvidence?: GitEvidence;

  // Gauntlet result collected after Bob completes (COMPLETED contenders only)
  gauntlet?: GauntletResult;
}

// ─── Battle ────────────────────────────────────────────────────────────────

export type BattleStatus =
  | "CREATED"
  | "PROVISIONING"
  | "READY"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED";

export interface Battle {
  battleId: string;
  featureRequest: string;
  baseCommit: string;
  status: BattleStatus;
  contenders: ContenderBattleState[];
  /** Survivor the developer selected for a future merge. */
  selectedContenderId?: ContenderId;
  /** ISO timestamp when the battle was created */
  createdAt: string;
  /** ISO timestamp when the last run started */
  startedAt?: string;
  /** ISO timestamp when all contenders finished */
  completedAt?: string;
}

// ─── API shapes ────────────────────────────────────────────────────────────

export interface CreateBattleRequest {
  featureRequest: string;
}

// Use a type alias instead of an empty interface extension
export type CreateBattleResponse = Battle;

export interface ApiError {
  error: string;
  detail?: string;
}
