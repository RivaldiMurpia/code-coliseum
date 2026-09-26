/**
 * POST /api/battles/[battleId]/apply
 *
 * Apply the selected contender's implementation to the main working tree.
 *
 * Validation:
 * - battle must exist
 * - selectedContenderId must exist
 * - selected contender must belong to this battle
 * - selected contender must have gauntlet.status === "SURVIVED"
 * - main working tree must be clean before applying
 * - main HEAD must equal battle.baseCommit
 *
 * Applies:
 * - tracked modified files
 * - tracked deleted files
 * - new untracked files created by Bob
 *
 * Does NOT copy:
 * - node_modules
 * - .next
 * - .git
 * - build/cache files
 *
 * Does NOT commit — the developer controls the final commit.
 */

import { execFile } from "node:child_process";
import { existsSync, copyFileSync, mkdirSync, rmSync, statSync, readdirSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { getBattle } from "@/lib/coliseum/battle-store";
import type { ApiError } from "@/lib/coliseum/types";

const execFileAsync = promisify(execFile);

const WINDOWS_GIT_CANDIDATES = [
  "C:\\Program Files\\Git\\cmd\\git.exe",
  "C:\\Program Files (x86)\\Git\\cmd\\git.exe",
];

function resolveGitBinary(): string {
  if (process.platform === "win32") {
    for (const candidate of WINDOWS_GIT_CANDIDATES) {
      if (existsSync(candidate)) return candidate;
    }
  }
  return "git";
}

const GIT_BIN = resolveGitBinary();

function isExcluded(filePath: string): boolean {
  const normalized = filePath.replaceAll("\\", "/").replace(/^\.\//, "");
  return (
    normalized.startsWith("node_modules/") ||
    normalized.startsWith(".next/") ||
    normalized.startsWith(".git/")
  );
}

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(GIT_BIN, args, {
    cwd,
    windowsHide: true,
    maxBuffer: 2 * 1024 * 1024,
  });
  return stdout;
}

async function isWorkingTreeClean(cwd: string): Promise<boolean> {
  const { stdout } = await execFileAsync(GIT_BIN, ["status", "--porcelain"], {
    cwd,
    windowsHide: true,
    maxBuffer: 2 * 1024 * 1024,
  });
  return stdout.trim() === "";
}

async function resolveHead(cwd: string): Promise<string> {
  const { stdout } = await execFileAsync(GIT_BIN, ["rev-parse", "HEAD"], {
    cwd,
    windowsHide: true,
    maxBuffer: 2 * 1024 * 1024,
  });
  return stdout.trim();
}

async function getRepoRoot(): Promise<string> {
  const cwd = process.cwd();
  if (existsSync(path.join(cwd, "next.config.ts")) || existsSync(path.join(cwd, "next.config.js"))) {
    return cwd;
  }
  try {
    const fileUrl = new URL(import.meta.url);
    const filePath = decodeURIComponent(
      fileUrl.pathname.replace(/^\/([A-Za-z]:)/, "$1")
    ).replace(/\//g, path.sep);
    return path.resolve(path.dirname(filePath), "..", "..", "..");
  } catch {
    return cwd;
  }
}

async function getChangedFiles(worktreePath: string, baseCommit: string): Promise<string[]> {
  // Get all changed files relative to baseCommit
  // This includes: modified, deleted, and untracked files
  const trackedOutput = await git(worktreePath, [
    "diff",
    "--name-only",
    "-z",
    baseCommit,
    "--",
  ]);

  const trackedFiles = trackedOutput
    .split("\0")
    .map((f) => f.replace(/^\.\//, ""))
    .filter(Boolean)
    .filter((f) => !isExcluded(f));

  const untrackedOutput = await git(worktreePath, [
    "ls-files",
    "--others",
    "--exclude-standard",
    "-z",
  ]);

  const untrackedFiles = untrackedOutput
    .split("\0")
    .map((f) => f.replace(/^\.\//, ""))
    .filter(Boolean)
    .filter((f) => !isExcluded(f));

  return Array.from(new Set([...trackedFiles, ...untrackedFiles]));
}

async function copyFileOrDir(src: string, dest: string): Promise<void> {
  const stat = statSync(src);
  if (stat.isFile()) {
    mkdirSync(path.dirname(dest), { recursive: true });
    copyFileSync(src, dest);
  } else if (stat.isDirectory()) {
    mkdirSync(dest, { recursive: true });
    for (const entry of readdirSync(src)) {
      await copyFileOrDir(path.join(src, entry), path.join(dest, entry));
    }
  }
}

async function removePath(repoRoot: string, relPath: string): Promise<void> {
  const fullPath = path.resolve(repoRoot, relPath);
  if (existsSync(fullPath)) {
    const stat = statSync(fullPath);
    if (stat.isFile()) {
      rmSync(fullPath);
    } else if (stat.isDirectory()) {
      rmSync(fullPath, { recursive: true });
    }
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ battleId: string }> }
) {
  const { battleId } = await params;

  if (!battleId || !/^[0-9a-f-]{8,36}$/i.test(battleId)) {
    return Response.json(
      { error: "Invalid battleId" } satisfies ApiError,
      { status: 400 }
    );
  }

  const battle = getBattle(battleId);
  if (!battle) {
    return Response.json(
      { error: "Battle not found" } satisfies ApiError,
      { status: 404 }
    );
  }

  // Must have a selected contender
  if (!battle.selectedContenderId) {
    return Response.json(
      { error: "No contender selected for this battle" } satisfies ApiError,
      { status: 400 }
    );
  }

  const selectedContender = battle.contenders.find(
    (c) => c.id === battle.selectedContenderId
  );
  if (!selectedContender) {
    return Response.json(
      { error: "Selected contender does not belong to this battle" } satisfies ApiError,
      { status: 400 }
    );
  }

  // Must have survived the Gauntlet
  if (selectedContender.gauntlet?.status !== "SURVIVED") {
    return Response.json(
      { error: "Only contenders that survived the Gauntlet can be applied" } satisfies ApiError,
      { status: 400 }
    );
  }

  const repoRoot = await getRepoRoot();

  // Main working tree must be clean
  const clean = await isWorkingTreeClean(repoRoot);
  if (!clean) {
    return Response.json(
      { error: "Main working tree has uncommitted changes. Commit or stash them before applying." } satisfies ApiError,
      { status: 409 }
    );
  }

  // Main HEAD must equal battle.baseCommit
  const currentHead = await resolveHead(repoRoot);
  if (currentHead !== battle.baseCommit) {
    return Response.json(
      { error: "Main branch changed since this battle started. Start a new battle before applying." } satisfies ApiError,
      { status: 409 }
    );
  }

  const worktreePath = selectedContender.worktreePath;

  // Get all files changed in the contender worktree relative to baseCommit
  const changedFiles = await getChangedFiles(worktreePath, battle.baseCommit);

  const appliedFiles: string[] = [];

  for (const relPath of changedFiles) {
    const srcPath = path.resolve(worktreePath, relPath);
    const destPath = path.resolve(repoRoot, relPath);

    // Safety: ensure src is within the worktree
    const resolvedSrc = path.resolve(srcPath);
    const resolvedWorktree = path.resolve(worktreePath);
    if (!resolvedSrc.startsWith(resolvedWorktree + path.sep) && resolvedSrc !== resolvedWorktree) {
      console.warn(`Skipping file outside worktree: ${relPath}`);
      continue;
    }

    // Safety: ensure dest is within the repo
    const resolvedDest = path.resolve(destPath);
    const resolvedRepo = path.resolve(repoRoot);
    if (!resolvedDest.startsWith(resolvedRepo + path.sep) && resolvedDest !== resolvedRepo) {
      console.warn(`Skipping file outside repo: ${relPath}`);
      continue;
    }

    if (existsSync(srcPath)) {
      // File exists in contender worktree - copy it
      await copyFileOrDir(srcPath, destPath);
      appliedFiles.push(relPath);
    } else {
      // File was deleted in contender worktree - remove it from main
      await removePath(repoRoot, relPath);
      appliedFiles.push(relPath);
    }
  }

  return Response.json({
    battleId,
    contenderId: selectedContender.id,
    applied: true,
    filesChanged: appliedFiles.length,
    files: appliedFiles,
  });
}