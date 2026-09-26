export type ContenderRole = "minimalist" | "sprinter" | "architect";

export type ContenderStatus =
  | "idle"
  | "waiting"
  | "preparing"
  | "ready"
  | "implementing"
  | "entering-gauntlet"
  | "survived"
  | "eliminated"
  | "failed";

// ─── Gauntlet ─────────────────────────────────────────────────────────────

/**
 * Real checks run by the backend gauntlet.
 * Keep in sync with src/lib/coliseum/gauntlet.ts check IDs.
 */
export type GauntletCheckId =
  | "dep-integrity"
  | "type-safety"
  | "build"
  | "acceptance";

export type GauntletResult = "pass" | "fail" | "pending";

export interface GauntletMatrix {
  "dep-integrity": GauntletResult;
  "type-safety":   GauntletResult;
  "build":         GauntletResult;
  "acceptance":    GauntletResult;
}

// ─── Contender ────────────────────────────────────────────────────────────

export interface ContenderState {
  id: ContenderRole;
  label: string;
  tagline: string;
  status: ContenderStatus;
  /** Current action shown while running, or outcome summary after */
  currentAction: string;
  filesChanged: number;
  linesChanged: number;
  /** How long the AI agent took to produce the implementation (ms). -1 = not yet available */
  agentTimeMs: number;
  /** Per-check gauntlet results */
  gauntlet: GauntletMatrix;
  /** Acceptance test: true = passed the acceptance-test gauntlet check */
  acceptancePassed: boolean | null;
  /** Reason displayed when eliminated */
  eliminationReason: string | null;
}

// ─── Distinctions (evidence-backed, no aggregate score) ───────────────────

export interface Distinction {
  /** Short label, e.g. "Smallest Diff" */
  label: string;
  /** Which contender earned it */
  contenderId: ContenderRole;
  /** One-sentence evidence */
  evidence: string;
}

// ─── Battle ───────────────────────────────────────────────────────────────

export interface BattleState {
  phase: "idle" | "running" | "complete";
  featureRequest: string;
  contenders: ContenderState[];
  /** Evidence-backed distinctions; no aggregate winner */
  distinctions: Distinction[];
  /** Error message to show in the UI */
  error?: string;
}
