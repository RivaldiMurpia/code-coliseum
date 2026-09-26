export type ContenderRole = "minimalist" | "sprinter" | "architect";

export type ContenderStatus =
  | "idle"
  | "thinking"
  | "coding"
  | "testing"
  | "survived"
  | "eliminated"
  | "failed";

// ─── Gauntlet ─────────────────────────────────────────────────────────────

export type GauntletCheckId =
  | "build"
  | "existing-tests"
  | "acceptance-tests"
  | "typescript-strict"
  | "no-new-deps"
  | "api-compatibility";

export type GauntletResult = "pass" | "fail" | "pending";

export interface GauntletMatrix {
  build:              GauntletResult;
  "existing-tests":   GauntletResult;
  "acceptance-tests": GauntletResult;
  "typescript-strict": GauntletResult;
  "no-new-deps":      GauntletResult;
  "api-compatibility": GauntletResult;
}

// ─── Benchmarks ───────────────────────────────────────────────────────────

export interface BenchmarkResult {
  /** Short label shown in the table, e.g. "p95 latency" */
  label: string;
  /** Formatted string for display, e.g. "4.2 ms" */
  value: string;
  /** Raw number used to determine best/worst */
  raw: number;
  /** true = lower is better */
  lowerIsBetter: boolean;
}

// ─── Contender ────────────────────────────────────────────────────────────

export interface TestResult {
  name: string;
  passed: boolean;
  durationMs: number;
}

export interface ContenderState {
  id: ContenderRole;
  label: string;
  tagline: string;
  status: ContenderStatus;
  /** Terminal human-readable summary shown after battle completes */
  finalAction: string;
  /** Number of acceptance tests passed out of total */
  testsPassed: number;
  testsTotal: number;
  filesChanged: number;
  linesChanged: number;
  /** How long the AI agent took to produce the implementation (ms) */
  agentTimeMs: number;
  /** Deterministic benchmark results for the implementation itself */
  benchmarks: BenchmarkResult[];
  /** Per-check gauntlet results */
  gauntlet: GauntletMatrix;
  testResults: TestResult[];
  /** Reason displayed when eliminated */
  eliminationReason: string | null;
}

// ─── Distinctions (evidence-backed, no aggregate score) ───────────────────

export interface Distinction {
  /** Short label, e.g. "Fastest Runtime" */
  label: string;
  /** Which contender earned it */
  contenderId: ContenderRole;
  /** One-sentence evidence, e.g. "p95 latency 3.1 ms vs 4.2 ms" */
  evidence: string;
}

// ─── Battle ───────────────────────────────────────────────────────────────

export interface BattleState {
  phase: "idle" | "running" | "complete";
  featureRequest: string;
  contenders: ContenderState[];
  /** Evidence-backed distinctions; no aggregate winner */
  distinctions: Distinction[];
}
