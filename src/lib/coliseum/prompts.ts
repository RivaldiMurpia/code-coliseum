/**
 * Contender prompts for Code Coliseum.
 *
 * Every contender receives the same feature request plus a strategy-specific
 * preamble. The feature request text is never executed as a shell command —
 * it is purely data passed to Bob's --prompt argument.
 */

import type { ContenderId } from "./types";

// ─── Common rules (injected into every prompt) ────────────────────────────

const COMMON_RULES = `\
RULES (apply to all contenders):
- Work only inside the provided workspace.
- Implement the requested feature correctly.
- Do not add dependencies.
- Do not modify package.json or package-lock.json.
- Preserve existing behavior unless required by the feature.
- Do not commit changes.
- Do not start a long-running development server.
- Prefer deterministic validation commands.
- Stop when the implementation is complete and verified.`;

// ─── Per-contender strategy ────────────────────────────────────────────────

const STRATEGIES: Record<ContenderId, string> = {
  minimalist: `\
STRATEGY: Minimalist
Optimize for the smallest correct diff.
Touch as few files and lines as possible.
Prefer simple existing patterns.
Avoid abstraction unless necessary.`,

  sprinter: `\
STRATEGY: Sprinter
Optimize the resulting implementation for runtime performance.
Correctness remains mandatory.
Avoid unnecessary allocations or expensive work.
A larger diff is acceptable when performance benefits justify it.`,

  architect: `\
STRATEGY: Architect
Optimize for maintainability and clarity.
Prefer clean separation of responsibilities, readable code, and testable structure.
Avoid unnecessary complexity.`,
};

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Build the full prompt string for a contender.
 *
 * The feature request is treated as plain text data — not executed.
 */
export function buildPrompt(
  contenderId: ContenderId,
  featureRequest: string
): string {
  const strategy = STRATEGIES[contenderId];
  return `${strategy}\n\n${COMMON_RULES}\n\nFEATURE REQUEST:\n${featureRequest}`;
}
