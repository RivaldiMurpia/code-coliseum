/**
 * Git evidence collection for Code Coliseum.
 *
 * After Bob completes, collect basic Git evidence from the contender
 * worktree. No judging — only raw facts.
 *
 * Collected:
 *   - git status --porcelain
 *   - list of changed files (parsed from porcelain)
 *   - git diff --stat
 */

import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import type { GitEvidence } from "./types";

const execFile = promisify(execFileCb);

// Re-use the same Git binary resolution strategy as git.ts
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

async function git(
  cwd: string,
  args: string[]
): Promise<string> {
  try {
    const result = await execFile(GIT_BIN, args, { cwd });
    return result.stdout.toString().trim();
  } catch (err: unknown) {
    const e = err as { stderr?: Buffer | string; message?: string };
    const stderr = e.stderr?.toString().trim() ?? "";
    const message = e.message ?? "unknown error";
    throw new Error(`git ${args[0]} failed: ${stderr || message}`);
  }
}

/**
 * Parse `git status --porcelain` output into a list of changed file paths.
 *
 * Each line is "XY path" or "XY old -> new" for renames.
 * We extract all referenced paths.
 */
function parseChangedFiles(porcelain: string): string[] {
  const files: string[] = [];
  for (const line of porcelain.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Format: "XY <path>" or "XY <old path> -> <new path>"
    const rest = line.slice(3); // strip the 2-char status + space
    if (rest.includes(" -> ")) {
      // Rename: "old -> new"
      const [, newPath] = rest.split(" -> ");
      files.push(newPath.trim());
    } else {
      files.push(rest.trim());
    }
  }
  return files;
}

/**
 * Collect git evidence from a worktree directory.
 * Never throws — errors are captured in the GitEvidence.error field.
 */
export async function collectGitEvidence(
  worktreePath: string
): Promise<GitEvidence> {
  try {
    const statusPorcelain = await git(worktreePath, [
      "status",
      "--porcelain",
    ]);
    const filesChanged = parseChangedFiles(statusPorcelain);
    const diffStat = await git(worktreePath, [
      "diff",
      "--stat",
      "HEAD",
    ]);

    return { statusPorcelain, filesChanged, diffStat };
  } catch (err) {
    return {
      statusPorcelain: "",
      filesChanged: [],
      diffStat: "",
      error: String(err),
    };
  }
}
