/**
 * Dependency provisioner for Code Coliseum.
 *
 * Runs `npm ci` in each contender worktree before Bob is launched.
 * Uses execFile with argument arrays — never shell string concatenation.
 *
 * Status transitions per contender:
 *   CREATED → PROVISIONING → READY
 *                          ↘ PROVISIONING_FAILED
 *
 * Provisioning is intentionally sequential for reliability.
 */

import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Battle, ContenderBattleState } from "./types";

const execFile = promisify(execFileCb);

// ─── npm binary resolution ─────────────────────────────────────────────────
//
// We use `npx` to run npm@11.13.0 so the exact npm version is guaranteed
// regardless of the global npm version. On Windows, `npx` lives next to `npm`
// in the Node.js install directory, so we resolve from the same directory as
// the current Node executable.

const WINDOWS_NPX_CANDIDATES = [
  // Node was installed into Program Files
  path.join(
    path.dirname(process.execPath),
    "npx.cmd"
  ),
  "C:\\Program Files\\nodejs\\npx.cmd",
  "C:\\Program Files (x86)\\nodejs\\npx.cmd",
];

function resolveNpxBinary(): string {
  if (process.platform === "win32") {
    for (const candidate of WINDOWS_NPX_CANDIDATES) {
      if (existsSync(/*turbopackIgnore: true*/ candidate)) return candidate;
    }
    // Fallback: hope it is on PATH
    return "npx.cmd";
  }
  return "npx";
}

const NPX_BIN = resolveNpxBinary();

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

  try {
    await execFile(
      NPX_BIN,
      [
        "--yes",
        "npm@11.13.0",
        "ci",
        "--prefer-offline",
        "--no-audit",
        "--no-fund",
      ],
      {
        cwd: worktreePath,
        // Inherit environment so registry credentials / proxy settings flow through
        env: process.env,
        // Allow up to 5 minutes for a cold npm ci
        timeout: 5 * 60 * 1000,
      }
    );
    return { success: true };
  } catch (err: unknown) {
    const e = err as {
      stdout?: Buffer | string;
      stderr?: Buffer | string;
      message?: string;
      code?: string | number;
    };
    const stderr = e.stderr?.toString().trim() ?? "";
    const stdout = e.stdout?.toString().trim() ?? "";
    const message = e.message ?? "unknown error";
    const detail = stderr || stdout || message;
    return {
      success: false,
      error: `npm ci failed (code ${e.code ?? "?"}): ${detail}`,
    };
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Provisions all contenders in a battle sequentially.
 *
 * Mutates `battle.contenders[*].status` in-place and returns the updated
 * contender list. Contenders that fail provisioning are marked
 * PROVISIONING_FAILED — the caller should only launch Bob for READY ones.
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
