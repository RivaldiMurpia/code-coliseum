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

// ─── Per-contender state ───────────────────────────────────────────────────

export type ContenderBattleStatus = "READY" | "FAILED";

export interface ContenderBattleState {
  id: ContenderId;
  name: string;
  branch: string;
  worktreePath: string;
  status: ContenderBattleStatus;
}

// ─── Battle ────────────────────────────────────────────────────────────────

export type BattleStatus = "READY" | "FAILED";

export interface Battle {
  battleId: string;
  featureRequest: string;
  baseCommit: string;
  status: BattleStatus;
  contenders: ContenderBattleState[];
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
