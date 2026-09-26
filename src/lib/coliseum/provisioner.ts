/**
 * Dependency provisioner for Code Coliseum.
 *
 * Runs `npm install --no-save` in each contender worktree, then restores
 * both manifest files via `git restore` and verifies they are unmodified.
 *
 * Status transitions per contender:
 *   CREATED → PROVISIONING → READY
 *                          ↘ PROVISIONING_FAILED
 *
 * Provisioning is intentionally sequential for reliability.
 *
 * Windows note: `spawn EINVAL` is produced when an .cmd script is passed to
 * spawn() without `shell: true`.  On Windows we therefore route the fixed,
 * trusted provisioning command through cmd.exe /C.  No user-provided value
 * is ever interpolated into the shell string.
 */

import { execFile as execFileCb, spawn } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import type { Battle, ContenderBattleState } from "./types";

const execFile = promisify(execFileCb);

// ─── Git binary resolution (for manifest restore / verify) ─────────────────

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
    const result = await execFile(GIT_BIN, args, { cwd, env: process.env });
    return result.stdout.toString().trim();
  } catch (err: unknown) {
    const e = err as { stderr?: Buffer | string; message?: string };
    const stderr = e.stderr?.toString().trim() ?? "";
    const message = e.message ?? "unknown error";
    throw new Error(`git ${args[0]} failed: ${stderr || message}`);
  }
}

// ─── npm install runner ────────────────────────────────────────────────────
//
// The provisioning command is a FIXED TRUSTED CONSTANT.
// No user-provided text is ever interpolated into it.
//
// On Windows, .cmd scripts require either shell:true or explicit cmd.exe /C
// invocation to be launched correctly.  We use cmd.exe /C with a fixed
// argument string built from trusted constant parts only.
//
// On non-Windows, execFile with an argument array is used directly.

/** Fixed npm install arguments — trusted constants only. */
const NPM_INSTALL_ARGS = [
  "--yes",
  "npm@11.13.0",
  "install",
  "--prefer-offline",
  "--no-audit",
  "--no-fund",
  "--no-save",
] as const;

interface RunResult {
  stdout: string;
  stderr: string;
}

/**
 * Run the provisioning command in `cwd`.
 *
 * On Windows: cmd.exe /C "npx --yes npm@11.13.0 install ..."
 * On other platforms: execFile("npx", [...]) with argument array.
 *
 * The command string and argument list are composed from FIXED TRUSTED
 * CONSTANTS only — no user input is ever included.
 */
async function runNpmInstall(cwd: string): Promise<RunResult> {
  if (process.platform === "win32") {
    // Build a fixed shell command from trusted constant parts.
    // npx.cmd is a Windows batch wrapper for npx; cmd.exe /C handles it.
    const shellCmd =
      "npx " + NPM_INSTALL_ARGS.join(" ");

    return new Promise<RunResult>((resolve, reject) => {
      const comspec = process.env.ComSpec ?? "cmd.exe";
      const child = spawn(
        /*turbopackIgnore: true*/ comspec,
        ["/C", shellCmd],
        {
          cwd,
          env: process.env,
          shell: false,   // We are already going through cmd.exe explicitly
          stdio: ["ignore", "pipe", "pipe"],
        }
      );

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      child.stdout?.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
      child.stderr?.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

      child.on("error", (err) => reject(err));

      child.on("close", (code) => {
        const stdout = Buffer.concat(stdoutChunks).toString().trim();
        const stderr = Buffer.concat(stderrChunks).toString().trim();
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(
            Object.assign(
              new Error(
                `npm install exited with code ${code ?? "?"}: ${stderr || stdout || "(no output)"}`
              ),
              { stdout, stderr, code }
            )
          );
        }
      });

      // Allow up to 5 minutes for a cold install
      setTimeout(() => {
        child.kill();
        reject(new Error("npm install timed out after 5 minutes"));
      }, 5 * 60 * 1000);
    });
  }

  // Non-Windows: execFile with argument array — no shell involved.
  const result = await execFile(
    "npx",
    [...NPM_INSTALL_ARGS],
    {
      cwd,
      env: process.env,
      timeout: 5 * 60 * 1000,
    }
  );
  return {
    stdout: result.stdout.toString().trim(),
    stderr: result.stderr.toString().trim(),
  };
}

// ─── Provisioning ──────────────────────────────────────────────────────────

interface ProvisionResult {
  success: boolean;
  error?: string;
}

async function provisionContender(
  contender: ContenderBattleState
): Promise<ProvisionResult> {
  const { worktreePath } = contender;

  // Verify the worktree actually exists before trying to provision
  if (!existsSync(/*turbopackIgnore: true*/ worktreePath)) {
    return {
      success: false,
      error: `Worktree directory does not exist: ${worktreePath}`,
    };
  }

  // ── Step 1: npm install ──────────────────────────────────────────────────

  try {
    await runNpmInstall(worktreePath);
  } catch (err: unknown) {
    const e = err as {
      stdout?: string;
      stderr?: string;
      message?: string;
      code?: string | number;
    };
    const detail =
      e.stderr?.trim() || e.stdout?.trim() || e.message || "unknown error";
    return {
      success: false,
      error: `npm install failed (code ${e.code ?? "?"}): ${detail}`,
    };
  }

  // ── Step 2: restore manifests from Git ──────────────────────────────────
  // npm install --no-save should not touch package.json / package-lock.json,
  // but we restore them defensively to guarantee a clean state.

  try {
    await git(worktreePath, [
      "restore",
      "--",
      "package.json",
      "package-lock.json",
    ]);
  } catch (err) {
    return {
      success: false,
      error: `Failed to restore manifests: ${String(err)}`,
    };
  }

  // ── Step 3: verify manifests are unmodified ──────────────────────────────

  let porcelain: string;
  try {
    porcelain = await git(worktreePath, [
      "status",
      "--porcelain",
      "--",
      "package.json",
      "package-lock.json",
    ]);
  } catch (err) {
    return {
      success: false,
      error: `Failed to verify manifests: ${String(err)}`,
    };
  }

  if (porcelain !== "") {
    return {
      success: false,
      error: `Manifest files modified after provisioning:\n${porcelain}`,
    };
  }

  return { success: true };
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Provisions all contenders in a battle sequentially.
 *
 * Mutates `battle.contenders[*].status` in-place.
 * Contenders that fail provisioning are marked PROVISIONING_FAILED —
 * the caller should only launch Bob for READY ones.
 */
export async function provisionBattle(battle: Battle): Promise<void> {
  for (const contender of battle.contenders) {
    contender.status = "PROVISIONING";

    const result = await provisionContender(contender);

    if (result.success) {
      contender.status = "READY";
    } else {
      contender.status = "PROVISIONING_FAILED";
      contender.provisioningError = result.error;
      console.error(
        `[provisioner] ${contender.id} provisioning failed: ${result.error}`
      );
    }
  }
}
