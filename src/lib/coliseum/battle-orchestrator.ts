/**
 * Battle Orchestrator v0 — Git isolation only.
 *
 * Creates three isolated git worktrees from the same base commit,
 * one per contender. Bob agent execution is NOT wired here yet.
 */

import path from "node:path";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import {
  isWorkingTreeClean,
  resolveHead,
  createBranch,
  deleteBranch,
  addWorktree,
  removeWorktree,
  pruneWorktrees,
} from "./git";
import { CONTENDERS } from "./types";
import type { Battle, ContenderBattleState } from "./types";

// ─── Path resolution ───────────────────────────────────────────────────────

/**
 * The main repository root.
 *
 * Next.js server components always run with process.cwd() set to the project
 * root (the directory containing package.json / next.config.ts). This is
 * guaranteed by Next.js for both `next dev` and `next start`.
 *
 * We verify the assumption by checking that next.config.ts exists there.
 * If not, we fall back to resolving from import.meta.url (ESM build).
 */
function getRepoRoot(): string {
  const cwd = process.cwd();
  // Sanity check: next.config.ts lives at the repo root
  if (existsSync(path.join(/*turbopackIgnore: true*/ cwd, "next.config.ts")) || existsSync(path.join(/*turbopackIgnore: true*/ cwd, "next.config.js"))) {
    return cwd;
  }
  // Fallback: derive from this file's URL (ESM)
  try {
    const fileUrl = new URL(import.meta.url);
    const filePath = decodeURIComponent(
      fileUrl.pathname
        // On Windows, pathname starts with /D:/... — strip leading slash
        .replace(/^\/([A-Za-z]:)/, "$1")
    ).replace(/\//g, path.sep);
    return path.resolve(path.dirname(filePath), "..", "..", "..");
  } catch {
    // Last resort: cwd as-is
    return cwd;
  }
}

/**
 * All worktrees are placed OUTSIDE the main repository, in a sibling
 * directory `.code-coliseum-worktrees/` next to the repo root.
 */
function getWorktreesRoot(repoRoot: string): string {
  return path.resolve(repoRoot, "..", ".code-coliseum-worktrees");
}

// ─── Branch / path helpers ─────────────────────────────────────────────────

function branchName(battleId: string, contenderId: string): string {
  return `coliseum/${battleId}/${contenderId}`;
}

function worktreePath(
  worktreesRoot: string,
  battleId: string,
  contenderId: string
): string {
  return path.join(worktreesRoot, battleId, contenderId);
}

/** Guard: only operate on branches we created. */
function assertColiseumBranch(branch: string): void {
  if (!branch.startsWith("coliseum/")) {
    throw new Error(`Refusing to delete non-coliseum branch: ${branch}`);
  }
}

/** Guard: only operate on paths inside our worktrees root. */
function assertColiseumWorktreePath(
  worktreesRoot: string,
  targetPath: string
): void {
  const resolved = path.resolve(targetPath);
  const root = path.resolve(worktreesRoot);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error(
      `Refusing to remove path outside worktrees root: ${targetPath}`
    );
  }
}

// ─── Create ────────────────────────────────────────────────────────────────

export async function createBattle(featureRequest: string): Promise<Battle> {
  const repoRoot = getRepoRoot();
  const worktreesRoot = getWorktreesRoot(repoRoot);

  // 1. Verify working tree is clean
  const clean = await isWorkingTreeClean(repoRoot);
  if (!clean) {
    throw new WorkingTreeDirtyError(
      "Working tree has uncommitted changes. Commit or stash them before starting a battle."
    );
  }

  // 2. Capture the base commit
  const baseCommit = await resolveHead(repoRoot);

  // 3. Generate battle ID
  const battleId = randomUUID().slice(0, 8); // short but unique enough for a session

  // 4. Create contenders sequentially — track which ones are created
  //    so we can roll back on partial failure.
  const createdContenders: ContenderBattleState[] = [];

  try {
    for (const def of CONTENDERS) {
      const branch = branchName(battleId, def.id);
      const wPath = worktreePath(worktreesRoot, battleId, def.id);

      // Create branch at base commit
      await createBranch(repoRoot, branch, baseCommit);

      // Add worktree (this also checks out the branch)
      try {
        await addWorktree(repoRoot, wPath, branch);
      } catch (err) {
        // Branch was created but worktree failed — delete the branch
        // before re-throwing so the cleanup loop below handles the rest
        await deleteBranch(repoRoot, branch).catch(() => {
          // best-effort; ignore secondary failure
        });
        throw err;
      }

      createdContenders.push({
        id: def.id,
        name: def.name,
        branch,
        worktreePath: wPath,
        status: "CREATED",
        events: [],
        rawLogs: [],
      });
    }
  } catch (err) {
    // Partial-failure rollback: remove any worktrees + branches already created
    await rollback(repoRoot, worktreesRoot, createdContenders);
    throw err;
  }

  return {
    battleId,
    featureRequest,
    baseCommit,
    status: "CREATED",
    createdAt: new Date().toISOString(),
    contenders: createdContenders,
  };
}

// ─── Delete ────────────────────────────────────────────────────────────────

/**
 * Removes all worktrees and branches for a battle.
 * Only operates on `coliseum/<battleId>/...` branches and paths
 * inside `.code-coliseum-worktrees/`.
 */
export async function deleteBattle(battleId: string): Promise<void> {
  const repoRoot = getRepoRoot();
  const worktreesRoot = getWorktreesRoot(repoRoot);

  const errors: string[] = [];

  for (const def of CONTENDERS) {
    const branch = branchName(battleId, def.id);
    const wPath = worktreePath(worktreesRoot, battleId, def.id);

    assertColiseumBranch(branch);
    assertColiseumWorktreePath(worktreesRoot, wPath);

    // Remove worktree (best-effort; may already be gone)
    try {
      await removeWorktree(repoRoot, wPath);
    } catch (err) {
      errors.push(`worktree ${def.id}: ${String(err)}`);
    }

    // Delete branch (best-effort)
    try {
      await deleteBranch(repoRoot, branch);
    } catch (err) {
      errors.push(`branch ${def.id}: ${String(err)}`);
    }
  }

  // Clean up stale worktree references
  try {
    await pruneWorktrees(repoRoot);
  } catch {
    // non-fatal
  }

  if (errors.length > 0) {
    throw new Error(`Cleanup completed with errors:\n${errors.join("\n")}`);
  }
}

// ─── Rollback helper ───────────────────────────────────────────────────────

async function rollback(
  repoRoot: string,
  worktreesRoot: string,
  created: ContenderBattleState[]
): Promise<void> {
  for (const c of created) {
    assertColiseumBranch(c.branch);
    assertColiseumWorktreePath(worktreesRoot, c.worktreePath);

    await removeWorktree(repoRoot, c.worktreePath).catch(() => {});
    await deleteBranch(repoRoot, c.branch).catch(() => {});
  }
  await pruneWorktrees(repoRoot).catch(() => {});
}

// ─── Custom errors ─────────────────────────────────────────────────────────

export class WorkingTreeDirtyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkingTreeDirtyError";
  }
}
