/**
 * In-memory battle store for Code Coliseum.
 *
 * Stores live and completed battle state in memory.
 * Acceptable for the hackathon MVP — no persistence layer required.
 *
 * The store is a module-level Map, which survives across API route
 * invocations within a single Next.js server process.
 *
 * NOTE: In Next.js App Router, route handlers run in the same Node.js
 * process in dev mode. In production (`next start`) the module is
 * loaded once per worker process. For this MVP, in-memory is fine.
 */

import type { Battle } from "./types";

// ─── Store ─────────────────────────────────────────────────────────────────

const store = new Map<string, Battle>();

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Persist (or replace) a battle in the store.
 * Mutations to the returned Battle object are reflected in the store
 * because we store the reference directly.
 */
export function putBattle(battle: Battle): void {
  store.set(battle.battleId, battle);
}

/**
 * Retrieve a battle by ID. Returns undefined if not found.
 */
export function getBattle(battleId: string): Battle | undefined {
  return store.get(battleId);
}

/**
 * Return all stored battles, most recently created first.
 */
export function listBattles(): Battle[] {
  return Array.from(store.values()).sort(
    (a, b) =>
      Date.parse(b.createdAt) - Date.parse(a.createdAt)
  );
}

/**
 * Remove a battle from the store (called after worktree cleanup).
 */
export function removeBattle(battleId: string): void {
  store.delete(battleId);
}
