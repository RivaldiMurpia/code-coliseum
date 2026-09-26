/**
 * Low-level git helpers for Code Coliseum.
 *
 * All commands use execFile with argument arrays — never shell string
 * concatenation — so branch names and paths cannot inject shell commands.
 */

import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";

const execFile = promisify(execFileCb);

// ─── Git binary resolution ─────────────────────────────────────────────────
//
// When Next.js is launched via Start-Process on Windows it may inherit a
// minimal PATH that doesn't include Git. We probe well-known locations so
// the backend works regardless of how the dev server was started.

const WINDOWS_GIT_CANDIDATES = [
  "C:\\Program Files\\Git\\cmd\\git.exe",
  "C:\\Program Files (x86)\\Git\\cmd\\git.exe",
];

function resolveGitBinary(): string {
  if (process.platform === "win32") {
    for (const candidate of WINDOWS_GIT_CANDIDATES) {
      if (existsSync(/*turbopackIgnore: true*/ candidate)) return candidate;
    }
  }
  // On non-Windows, or if not found above, fall back to PATH lookup.
  return "git";
}

const GIT_BIN = resolveGitBinary();

// ─── Internal helper ───────────────────────────────────────────────────────

interface ExecResult {
  stdout: string;
  stderr: string;
}

/**
 * Run a git sub-command in `cwd`.
 * Throws a descriptive error on non-zero exit.
 */
async function git(cwd: string, args: string[]): Promise<ExecResult> {
  try {
    const result = await execFile(GIT_BIN, args, { cwd });
    return {
      stdout: result.stdout.toString().trim(),
      stderr: result.stderr.toString().trim(),
    };
  } catch (err: unknown) {
    const e = err as { stdout?: Buffer | string; stderr?: Buffer | string; message?: string };
    const stderr = e.stderr?.toString().trim() ?? "";
    const message = e.message ?? "unknown error";
    throw new Error(
      `git ${args[0]} failed: ${stderr || message}`
    );
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Returns `true` when the working tree is clean (no uncommitted changes).
 * Uses `--porcelain` so the output is machine-readable and stable.
 */
export async function isWorkingTreeClean(repoRoot: string): Promise<boolean> {
  const { stdout } = await git(repoRoot, ["status", "--porcelain"]);
  return stdout === "";
}

/**
 * Returns the full SHA of the current HEAD commit.
 */
export async function resolveHead(repoRoot: string): Promise<string> {
  const { stdout } = await git(repoRoot, ["rev-parse", "HEAD"]);
  return stdout;
}

/**
 * Creates a new branch at `commitSha` without checking it out.
 */
export async function createBranch(
  repoRoot: string,
  branchName: string,
  commitSha: string
): Promise<void> {
  await git(repoRoot, ["branch", branchName, commitSha]);
}

/**
 * Deletes a local branch.
 * Uses `-D` (force-delete) since worktree branches are not merged into main.
 */
export async function deleteBranch(
  repoRoot: string,
  branchName: string
): Promise<void> {
  await git(repoRoot, ["branch", "-D", branchName]);
}

/**
 * Adds a new worktree at `worktreePath` checked out to `branchName`.
 * The branch must already exist.
 */
export async function addWorktree(
  repoRoot: string,
  worktreePath: string,
  branchName: string
): Promise<void> {
  await git(repoRoot, ["worktree", "add", worktreePath, branchName]);
}

/**
 * Removes a worktree and its directory.
 * `--force` handles the case where the worktree directory is already gone.
 */
export async function removeWorktree(
  repoRoot: string,
  worktreePath: string
): Promise<void> {
  await git(repoRoot, ["worktree", "remove", "--force", worktreePath]);
}

/**
 * Prunes stale worktree administrative files.
 */
export async function pruneWorktrees(repoRoot: string): Promise<void> {
  await git(repoRoot, ["worktree", "prune"]);
}
