/**
 * Git metrics for Code Coliseum Gauntlet.
 *
 * Collects lines added/deleted and file count for a contender worktree,
 * correctly accounting for BOTH tracked (modified) and untracked (new) files.
 *
 * Problem: `git diff --stat HEAD` only covers tracked changes.
 * Untracked files (e.g. src/app/api/health/route.ts) are invisible to it.
 *
 * Solution:
 *   1. Use `git diff --numstat HEAD` for tracked changes.
 *   2. Use `git status --porcelain` to find untracked files (lines starting
 *      with "?? "), then count their lines via `git diff --numstat /dev/null`
 *      (or wc-style) to include them in the total.
 *   3. Exclude node_modules, .next, and generated cache/build artifacts.
 *
 * No commits are created. Only read operations against the worktree.
 */

import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const execFile = promisify(execFileCb);

// ─── Git binary resolution ──────────────────────────────────────────────────

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
  return "git";
}

const GIT_BIN = resolveGitBinary();

async function git(cwd: string, args: string[]): Promise<string> {
  try {
    const result = await execFile(GIT_BIN, args, { cwd, timeout: 30_000 });
    return result.stdout.toString();
  } catch (err: unknown) {
    const e = err as { stderr?: Buffer | string; message?: string };
    const stderr = e.stderr?.toString().trim() ?? "";
    const message = e.message ?? "unknown error";
    throw new Error(`git ${args[0]} failed: ${stderr || message}`);
  }
}

// ─── Exclude patterns ──────────────────────────────────────────────────────

const EXCLUDE_PATH_PREFIXES = [
  "node_modules/",
  ".next/",
  ".git/",
];

function isExcluded(filePath: string): boolean {
  // Normalise to forward slashes for consistent prefix matching
  const normalised = filePath.replace(/\\/g, "/").replace(/^\.\//, "");
  return EXCLUDE_PATH_PREFIXES.some((prefix) => normalised.startsWith(prefix));
}

// ─── Public types ──────────────────────────────────────────────────────────

export interface GauntletMetrics {
  filesChanged: number;
  linesAdded: number;
  linesDeleted: number;
}

// ─── Collect metrics ──────────────────────────────────────────────────────

/**
 * Collect lines-added / lines-deleted / files-changed for a contender
 * worktree relative to the base commit (HEAD of that branch at start).
 *
 * Handles both tracked modifications and untracked new files.
 * Never throws — returns zeros on error.
 */
export async function collectMetrics(
  worktreePath: string
): Promise<GauntletMetrics> {
  let filesChanged = 0;
  let linesAdded = 0;
  let linesDeleted = 0;

  try {
    // ── 1. Tracked changes via git diff --numstat HEAD ──────────────────────
    const numstat = await git(worktreePath, ["diff", "--numstat", "HEAD"]);
    for (const line of numstat.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      // Format: "<added>\t<deleted>\t<path>"
      // Binary files use "-\t-\t<path>" — skip them
      const parts = trimmed.split("\t");
      if (parts.length < 3) continue;
      const [added, deleted, filePath] = parts;
      if (added === "-" || deleted === "-") continue; // binary
      if (isExcluded(filePath)) continue;
      linesAdded += parseInt(added, 10) || 0;
      linesDeleted += parseInt(deleted, 10) || 0;
      filesChanged += 1;
    }

    // ── 2. Untracked files via git status --porcelain ──────────────────────
    const status = await git(worktreePath, ["status", "--porcelain"]);
    for (const line of status.split("\n")) {
      if (!line.startsWith("?? ")) continue;
      const filePath = line.slice(3).trim();
      if (isExcluded(filePath)) continue;

      // Count lines in the untracked file by reading it directly.
      // This avoids needing /dev/null (unavailable on Windows) and is simpler.
      try {
        const absPath = path.join(worktreePath, filePath);
        const content = readFileSync(/*turbopackIgnore: true*/ absPath, "utf8");
        const lineCount = content.split("\n").length;
        linesAdded += lineCount;
        filesChanged += 1;
      } catch {
        // File may have been deleted between status and read — skip it
      }
    }
  } catch {
    // Any git failure: return zeros rather than crashing the Gauntlet
  }

  return { filesChanged, linesAdded, linesDeleted };
}
