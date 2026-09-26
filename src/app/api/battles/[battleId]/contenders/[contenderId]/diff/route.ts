import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { lstat, open } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { getBattle } from "@/lib/coliseum/battle-store";

const execFileAsync = promisify(execFile);

const WINDOWS_GIT_CANDIDATES = [
  "C:\\Program Files\\Git\\cmd\\git.exe",
  "C:\\Program Files (x86)\\Git\\cmd\\git.exe",
];
const TRUNCATION_NOTICE = "\n\n... diff truncated by Code Coliseum ...\n";
const MAX_PATCH_BYTES = 500 * 1024;
const MAX_PATCH_CONTENT_BYTES =
  MAX_PATCH_BYTES - Buffer.byteLength(TRUNCATION_NOTICE);

function resolveGitBinary(): string {
  if (process.platform === "win32") {
    for (const candidate of WINDOWS_GIT_CANDIDATES) {
      if (existsSync(/*turbopackIgnore: true*/ candidate)) return candidate;
    }
  }

  return "git";
}

const GIT_BIN = resolveGitBinary();

function isExcluded(filePath: string): boolean {
  const normalized = filePath
    .replaceAll("\\", "/")
    .replace(/^\.\//, "");

  return (
    normalized.startsWith("node_modules/") ||
    normalized.startsWith(".next/") ||
    normalized.startsWith(".git/")
  );
}

function parseGitPaths(output: string): string[] {
  return output
    .split("\0")
    .map((file) => file.replace(/^\.\//, ""))
    .filter(Boolean)
    .filter((file) => !isExcluded(file));
}

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(GIT_BIN, args, {
    cwd,
    windowsHide: true,
    maxBuffer: 2 * 1024 * 1024,
  });

  return stdout;
}

async function gitPatch(cwd: string): Promise<{ patch: string; truncated: boolean }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      GIT_BIN,
      ["diff", "--no-ext-diff", "--no-textconv", "--no-color", "HEAD", "--"],
      { cwd, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }
    );
    const chunks: Buffer[] = [];
    let size = 0;
    let truncated = false;
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      if (truncated) return;

      const remaining = MAX_PATCH_CONTENT_BYTES - size;
      if (chunk.length > remaining) {
        chunks.push(chunk.subarray(0, Math.max(remaining, 0)));
        size += Math.max(remaining, 0);
        truncated = true;
        child.kill();
        return;
      }

      chunks.push(chunk);
      size += chunk.length;
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (truncated) {
        resolve({ patch: Buffer.concat(chunks).toString(), truncated: true });
        return;
      }
      if (code === 0) {
        resolve({ patch: Buffer.concat(chunks).toString(), truncated: false });
        return;
      }
      reject(new Error(`git diff failed: ${stderr.trim() || `exit ${code}`}`));
    });
  });
}

function makeNewFilePatch(relativePath: string, content: string): string {
  const normalizedPath = relativePath.replaceAll("\\", "/");

  // Avoid dumping binary data into the browser.
  if (content.includes("\0")) {
    return [
      `diff --git a/${normalizedPath} b/${normalizedPath}`,
      "new file mode 100644",
      `Binary file ${normalizedPath} added`,
      "",
    ].join("\n");
  }

  const hasTrailingNewline = content.endsWith("\n");
  const lines = content.length === 0
    ? []
    : content.replace(/\n$/, "").split("\n");
  const patchLines = [
    `diff --git a/${normalizedPath} b/${normalizedPath}`,
    "new file mode 100644",
    "--- /dev/null",
    `+++ b/${normalizedPath}`,
  ];

  if (lines.length > 0) {
    patchLines.push(`@@ -0,0 +1,${lines.length} @@`);
    patchLines.push(...lines.map((line) => `+${line}`));
    if (!hasTrailingNewline) patchLines.push("\\ No newline at end of file");
  }

  patchLines.push("");
  return patchLines.join("\n");
}

async function readPatchFile(
  filePath: string,
  maxBytes: number
): Promise<{ content: string; truncated: boolean }> {
  const file = await open(filePath, "r");
  try {
    const buffer = Buffer.alloc(maxBytes + 1);
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    return {
      content: buffer.subarray(0, Math.min(bytesRead, maxBytes)).toString(),
      truncated: bytesRead > maxBytes,
    };
  } finally {
    await file.close();
  }
}

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{
      battleId: string;
      contenderId: string;
    }>;
  }
) {
  const { battleId, contenderId } = await params;

  if (!/^[0-9a-f-]{8,36}$/i.test(battleId)) {
    return Response.json(
      { error: "Invalid battleId" },
      { status: 400 }
    );
  }

  const battle = getBattle(battleId);

  if (!battle) {
    return Response.json(
      { error: "Battle not found" },
      { status: 404 }
    );
  }

  const contender = battle.contenders.find(
    (item) => item.id === contenderId
  );

  if (!contender) {
    return Response.json(
      { error: "Contender not found" },
      { status: 404 }
    );
  }

  try {
    const worktreePath = contender.worktreePath;
    const tracked = await gitPatch(worktreePath);
    const trackedNames = parseGitPaths(
      await git(worktreePath, [
        "diff",
        "--no-ext-diff",
        "--no-textconv",
        "--name-only",
        "-z",
        "HEAD",
        "--",
      ])
    );

    // Real untracked files, not collapsed directories from `git status`.
    const untrackedNames = parseGitPaths(
      await git(worktreePath, [
        "ls-files",
        "--others",
        "--exclude-standard",
        "-z",
      ])
    );
    const rootPath = path.resolve(worktreePath);
    const includedUntrackedNames: string[] = [];
    let patch = tracked.patch;
    let truncated = tracked.truncated;

    for (const relativePath of untrackedNames) {
      const absolutePath = path.resolve(worktreePath, relativePath);

      // Extra containment guard. Never follow symlinks outside this worktree.
      if (
        absolutePath === rootPath ||
        !absolutePath.startsWith(rootPath + path.sep)
      ) {
        continue;
      }

      const fileStat = await lstat(absolutePath);

      if (!fileStat.isFile()) {
        continue;
      }

      includedUntrackedNames.push(relativePath);
      if (truncated) continue;

      const separator = patch ? "\n" : "";
      const remaining =
        MAX_PATCH_CONTENT_BYTES - Buffer.byteLength(patch + separator);
      const header = makeNewFilePatch(relativePath, "");

      if (Buffer.byteLength(header) > remaining) {
        truncated = true;
        continue;
      }

      const file = await readPatchFile(
        absolutePath,
        Math.max(0, remaining - Buffer.byteLength(header))
      );
      const newFilePatch = makeNewFilePatch(relativePath, file.content);
      if (file.truncated || Buffer.byteLength(newFilePatch) > remaining) {
        truncated = true;
        continue;
      }

      patch += separator + newFilePatch;
    }

    if (truncated) patch += TRUNCATION_NOTICE;

    const allFiles = Array.from(
      new Set([...trackedNames, ...includedUntrackedNames])
    );

    return Response.json({
      battleId,
      contenderId,
      filesChanged: allFiles.length,
      files: allFiles,
      patch,
      truncated,
    });
  } catch (error) {
    console.error("[diff] Failed to collect contender diff", error);

    return Response.json(
      {
        error: "Failed to collect contender diff",
      },
      { status: 500 }
    );
  }
}