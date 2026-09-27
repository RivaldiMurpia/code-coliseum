/**
 * Gauntlet — deterministic post-execution checks for Code Coliseum.
 *
 * Runs four mandatory checks against each COMPLETED contender worktree:
 *
 *   1. Dependency Integrity  — package.json / package-lock.json unchanged (Git)
 *   2. Type Safety           — npx next typegen && npx tsc --noEmit
 *   3. Production Build      — npm run build
 *   4. Acceptance Test       — GET /api/health must return HTTP 200 + {status:"ok"}
 *
 * ALL four must PASS for a contender to SURVIVE.
 * Any single FAIL → ELIMINATED.
 *
 * Metrics (filesChanged, linesAdded, linesDeleted) are collected as evidence
 * and never drive elimination.
 *
 * Safety guarantees:
 *   - All child processes have finite timeouts.
 *   - The acceptance-test Next.js server is always killed after the check.
 *   - Port allocation uses a random high port with a collision-avoidance loop.
 *   - An error in one contender's Gauntlet never throws to the caller;
 *     failures are captured in the result.
 */

import { spawn } from "node:child_process";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import * as net from "node:net";
import * as http from "node:http";
import type {
  ContenderBattleState,
  GauntletResult,
  GauntletCheck,
  GauntletCheckStatus,
} from "./types";
import { collectMetrics } from "./metrics";

// Re-export for callers that only import from gauntlet.ts
export type { GauntletResult, GauntletCheck, GauntletCheckStatus };

const execFile = promisify(execFileCb);

// ─── Check IDs ────────────────────────────────────────────────────────────

const CHECK_DEP_INTEGRITY = "dep-integrity";
const CHECK_TYPE_SAFETY   = "type-safety";
const CHECK_BUILD         = "build";
const CHECK_ACCEPTANCE    = "acceptance";

// ─── Git binary resolution ─────────────────────────────────────────────────

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
  const result = await execFile(GIT_BIN, args, { cwd, timeout: 30_000 });
  return result.stdout.toString().trim();
}

// ─── Spawn helper (timeout + stdout/stderr capture) ───────────────────────

interface SpawnResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Spawn a command and capture output.
 * On Windows, routes through cmd.exe /C for .cmd shim compatibility.
 * Times out after `timeoutMs` ms.
 */
function spawnCapture(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
  env: NodeJS.ProcessEnv = process.env
): Promise<SpawnResult> {
  return new Promise<SpawnResult>((resolve) => {
    let child: ReturnType<typeof spawn>;

    if (process.platform === "win32") {
      const comspec = process.env.ComSpec ?? "cmd.exe";
      child = spawn(
        /*turbopackIgnore: true*/ comspec,
        ["/D", "/S", "/C", cmd, ...args],
        { cwd, env, shell: false, stdio: ["ignore", "pipe", "pipe"] }
      );
    } else {
      child = spawn(cmd, args, {
        cwd, env, shell: false, stdio: ["ignore", "pipe", "pipe"],
      });
    }

    const stdoutBufs: Buffer[] = [];
    const stderrBufs: Buffer[] = [];

    child.stdout?.on("data", (c: Buffer) => stdoutBufs.push(c));
    child.stderr?.on("data", (c: Buffer) => stderrBufs.push(c));

    child.on("error", () => {
      // process error event fires before close — handled in close handler
    });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timer);
      // Truncate captured output to avoid storing enormous logs
      const stdout = truncate(Buffer.concat(stdoutBufs).toString("utf8"), 4096);
      const stderr = truncate(Buffer.concat(stderrBufs).toString("utf8"), 4096);
      resolve({ exitCode: code ?? -1, stdout, stderr });
    });
  });
}

function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s.trim();
  return s.slice(s.length - maxLen).trim() + " …[truncated]";
}

// ─── Check 1: Dependency Integrity ────────────────────────────────────────

/**
 * Verify that package.json and package-lock.json are byte-for-byte identical
 * to the base commit. Uses `git diff --name-only HEAD -- <files>`.
 *
 * This detects modifications to tracked files. Untracked package manifests
 * (which would be very unusual) are also caught via `git status --porcelain`.
 */
async function checkDepIntegrity(
  worktreePath: string
): Promise<GauntletCheck> {
  const start = Date.now();
  const id = CHECK_DEP_INTEGRITY;
  const name = "Dependency Integrity";

  try {
    // Check for modifications to tracked manifests
    const diff = await git(worktreePath, [
      "diff", "--name-only", "HEAD", "--",
      "package.json", "package-lock.json",
    ]);

    // Check for untracked manifests (corner case)
    const status = await git(worktreePath, [
      "status", "--porcelain", "--",
      "package.json", "package-lock.json",
    ]);

    const changed = [diff.trim(), status.trim()].filter(Boolean).join("\n").trim();

    if (changed !== "") {
      return {
        id, name, status: "FAIL",
        durationMs: Date.now() - start,
        detail: `Manifest files modified:\n${changed}`,
      };
    }

    return { id, name, status: "PASS", durationMs: Date.now() - start };
  } catch (err) {
    return {
      id, name, status: "FAIL",
      durationMs: Date.now() - start,
      detail: `Integrity check error: ${String(err)}`,
    };
  }
}

// ─── Check 2: Type Safety ──────────────────────────────────────────────────

/**
 * Run `npx next typegen` then `npx tsc --noEmit` in the contender worktree.
 *
 * typegen generates type-safe route params (Next.js 15+).
 * tsc --noEmit validates the full TypeScript project.
 *
 * Both steps are run sequentially as one logical check.
 * Timeout: 3 minutes total (typegen is fast; tsc can be slow on cold runs).
 */
async function checkTypeSafety(worktreePath: string): Promise<GauntletCheck> {
  const start = Date.now();
  const id = CHECK_TYPE_SAFETY;
  const name = "Type Safety";

  // Step 1: next typegen (generates .next/types)
  const typegenResult = await spawnCapture(
    "npx", ["next", "typegen"],
    worktreePath,
    60_000 // 1 minute
  );

  if (typegenResult.exitCode !== 0) {
    return {
      id, name, status: "FAIL",
      durationMs: Date.now() - start,
      detail: `next typegen failed (exit ${typegenResult.exitCode}):\n${typegenResult.stderr || typegenResult.stdout}`,
    };
  }

  // Step 2: tsc --noEmit
  const tscResult = await spawnCapture(
    "npx", ["tsc", "--noEmit"],
    worktreePath,
    120_000 // 2 minutes
  );

  if (tscResult.exitCode !== 0) {
    return {
      id, name, status: "FAIL",
      durationMs: Date.now() - start,
      detail: `tsc --noEmit failed (exit ${tscResult.exitCode}):\n${tscResult.stderr || tscResult.stdout}`,
    };
  }

  return { id, name, status: "PASS", durationMs: Date.now() - start };
}

// ─── Check 3: Production Build ─────────────────────────────────────────────

/**
 * Run `npm run build` in the contender worktree.
 * A non-zero exit code eliminates the contender.
 * Timeout: 5 minutes.
 */
async function checkProductionBuild(
  worktreePath: string
): Promise<GauntletCheck> {
  const start = Date.now();
  const id = CHECK_BUILD;
  const name = "Production Build";

  const result = await spawnCapture(
    "npm", ["run", "build"],
    worktreePath,
    5 * 60_000,
    { ...process.env, NODE_ENV: "production" as const }
  );

  if (result.exitCode !== 0) {
    return {
      id, name, status: "FAIL",
      durationMs: Date.now() - start,
      detail: `npm run build failed (exit ${result.exitCode}):\n${result.stderr || result.stdout}`,
    };
  }

  return { id, name, status: "PASS", durationMs: Date.now() - start };
}

// ─── Check 4: Acceptance Test ─────────────────────────────────────────────

/**
 * Spin up a temporary Next.js server on a free local port, wait for it to be
 * ready, then issue POST /api/analyze-text requests and verify:
 *   1. Valid input: POST /api/analyze-text with {text: "Bob builds better code. Bob builds fast."}
 *      - HTTP status 200
 *      - JSON body: {wordCount: 7, uniqueWordCount: 5, topWords: [{word:"bob",count:2},{word:"builds",count:2},{word:"better",count:1}]}
 *   2. Invalid input: POST /api/analyze-text with {}
 *      - HTTP status 400
 *
 * The server is always killed afterward (finally block).
 * Timeout: 3 minutes total (server startup + requests).
 *
 * Port selection: random high port (49152-65535) with a bound-check retry to
 * avoid collisions between concurrently-running contenders.
 */
async function checkAcceptanceTest(
  worktreePath: string,
): Promise<GauntletCheck> {
  const start = Date.now();
  const id = CHECK_ACCEPTANCE;
  const name = "Acceptance Test: POST /api/analyze-text";

  let port: number;
  try {
    port = await findFreePort();
  } catch (err) {
    return {
      id, name, status: "FAIL",
      durationMs: Date.now() - start,
      detail: `Could not find a free port: ${String(err)}`,
    };
  }

  // Launch `next start` (serves the production build built in check 3)
  let child: ReturnType<typeof spawn> | null = null;

  try {
    child = spawnNextServer(worktreePath, port);

    // Wait until the server is responding on the port, with timeout
    const serverReady = await waitForPort(port, 60_000);
    if (!serverReady) {
      return {
        id, name, status: "FAIL",
        durationMs: Date.now() - start,
        detail: `Next.js server on port ${port} did not become ready within 60s`,
      };
    }

    // Test 1: Valid input
    const validResult = await httpPostJson(
      `http://localhost:${port}/api/analyze-text`,
      { text: "Bob builds better code. Bob builds fast." },
      15_000
    );

    if (!validResult.ok || validResult.statusCode !== 200) {
      return {
        id, name, status: "FAIL",
        durationMs: Date.now() - start,
        detail: `Valid POST /api/analyze-text returned HTTP ${validResult.statusCode} (expected 200)`,
      };
    }

    const expectedValid = {
      wordCount: 7,
      uniqueWordCount: 5,
      topWords: [
        { word: "bob", count: 2 },
        { word: "builds", count: 2 },
        { word: "better", count: 1 },
      ],
    };

    if (!deepEqual(validResult.body, expectedValid)) {
      return {
        id, name, status: "FAIL",
        durationMs: Date.now() - start,
        detail: `Valid POST /api/analyze-text body mismatch.\nExpected: ${JSON.stringify(expectedValid)}\nGot: ${JSON.stringify(validResult.body)}`,
      };
    }

    // Test 2: Invalid input (empty object)
    const invalidResult = await httpPostJson(
      `http://localhost:${port}/api/analyze-text`,
      {},
      15_000
    );

    if (invalidResult.statusCode !== 400) {
      return {
        id, name, status: "FAIL",
        durationMs: Date.now() - start,
        detail: `Invalid POST /api/analyze-text returned HTTP ${invalidResult.statusCode} (expected 400)`,
      };
    }

    return { id, name, status: "PASS", durationMs: Date.now() - start };
  } catch (err) {
    return {
      id, name, status: "FAIL",
      durationMs: Date.now() - start,
      detail: `Acceptance test error: ${String(err)}`,
    };
  } finally {
    // Always kill the server — never leave it running
    if (child) {
      try {
        child.kill("SIGKILL");
      } catch {
        // best-effort
      }
    }
  }
}

// ─── Port utilities ────────────────────────────────────────────────────────

/** Probe a random high port to check if it is free. */
function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

/** Find a free port in the ephemeral range, retrying up to 10 times. */
async function findFreePort(): Promise<number> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const port = 49152 + Math.floor(Math.random() * 16383);
    if (await isPortFree(port)) return port;
  }
  throw new Error("Failed to find a free port after 10 attempts");
}

/** Spawn `next start` on the specified port in the worktree. */
function spawnNextServer(
  worktreePath: string,
  port: number
): ReturnType<typeof spawn> {
  const portStr = String(port);
  const env = { ...process.env, NODE_ENV: "production" as const };

  if (process.platform === "win32") {
    const comspec = process.env.ComSpec ?? "cmd.exe";
    return spawn(
      /*turbopackIgnore: true*/ comspec,
      ["/D", "/S", "/C", "npm", "run", "start", "--", "--port", portStr],
      { cwd: worktreePath, env, shell: false, stdio: "ignore" }
    );
  }

  return spawn(
    "npm", ["run", "start", "--", "--port", portStr],
    { cwd: worktreePath, env, shell: false, stdio: "ignore" }
  );
}

/**
 * Poll `localhost:<port>` until TCP accepts a connection, or `timeoutMs` elapses.
 * Returns true if server became ready.
 */
function waitForPort(port: number, timeoutMs: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const deadline = Date.now() + timeoutMs;

    function attempt() {
      if (Date.now() >= deadline) {
        resolve(false);
        return;
      }

      const sock = net.createConnection({ port, host: "127.0.0.1" });
      sock.once("connect", () => {
        sock.destroy();
        resolve(true);
      });
      sock.once("error", () => {
        sock.destroy();
        setTimeout(attempt, 300);
      });
    }

    attempt();
  });
}

// ─── HTTP helper ──────────────────────────────────────────────────────────

interface HttpResult {
  ok: boolean;
  statusCode: number;
  body: unknown;
}

/**
 * Minimal HTTP POST with JSON body using Node's built-in `http` module.
 * No external dependencies.
 */
function httpPostJson(
  url: string,
  body: unknown,
  timeoutMs: number
): Promise<HttpResult> {
  return new Promise<HttpResult>((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(body);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
      timeout: timeoutMs,
    };

    const req = http.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        let responseBody: unknown;
        try {
          responseBody = JSON.parse(raw);
        } catch {
          responseBody = raw;
        }
        resolve({
          ok: res.statusCode === 200,
          statusCode: res.statusCode ?? 0,
          body: responseBody,
        });
      });
      res.on("error", reject);
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`HTTP POST ${url} timed out after ${timeoutMs}ms`));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Deep equality check for JSON-serializable values.
 * Handles objects, arrays, and primitives.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;

  const arrA = Array.isArray(a);
  const arrB = Array.isArray(b);
  if (arrA !== arrB) return false;

  if (arrA) {
    const aArr = a as unknown[];
    const bArr = b as unknown[];
    if (aArr.length !== bArr.length) return false;
    return aArr.every((v, i) => deepEqual(v, bArr[i]));
  }

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const keysA = Object.keys(aObj);
  const keysB = Object.keys(bObj);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) => deepEqual(aObj[k], bObj[k]));
}

// ─── Main Gauntlet runner ─────────────────────────────────────────────────

/**
 * Run the full Gauntlet for a single contender.
 *
 * Checks run sequentially (dep-integrity → type-safety → build → acceptance).
 * Short-circuits on mandatory FAIL: once a fatal check fails, remaining checks
 * are still reported but marked FAIL with a "skipped" detail, to keep the
 * result shape consistent and informative.
 *
 * Never throws — all errors are captured in the result.
 */
export async function runGauntlet(
  contender: ContenderBattleState
): Promise<GauntletResult> {
  const checks: GauntletCheck[] = [];
  let eliminated = false;

  // Helper to record a skipped check (when a prior mandatory check failed)
  function skipped(id: string, name: string): GauntletCheck {
    return { id, name, status: "FAIL", detail: "Skipped: prior mandatory check failed" };
  }

  // ── Check 1: Dependency Integrity ────────────────────────────────────────
  const depCheck = await checkDepIntegrity(contender.worktreePath);
  checks.push(depCheck);
  if (depCheck.status === "FAIL") eliminated = true;

  // ── Check 2: Type Safety ─────────────────────────────────────────────────
  if (eliminated) {
    checks.push(skipped(CHECK_TYPE_SAFETY, "Type Safety"));
  } else {
    const tsCheck = await checkTypeSafety(contender.worktreePath);
    checks.push(tsCheck);
    if (tsCheck.status === "FAIL") eliminated = true;
  }

  // ── Check 3: Production Build ────────────────────────────────────────────
  if (eliminated) {
    checks.push(skipped(CHECK_BUILD, "Production Build"));
  } else {
    const buildCheck = await checkProductionBuild(contender.worktreePath);
    checks.push(buildCheck);
    if (buildCheck.status === "FAIL") eliminated = true;
  }

  // ── Check 4: Acceptance Test ─────────────────────────────────────────────
  if (eliminated) {
    checks.push(skipped(CHECK_ACCEPTANCE, "Acceptance Test: GET /api/health"));
  } else {
    const acceptCheck = await checkAcceptanceTest(contender.worktreePath);
    checks.push(acceptCheck);
    if (acceptCheck.status === "FAIL") eliminated = true;
  }

  // ── Metrics (evidence only — never eliminates) ───────────────────────────
  const metrics = await collectMetrics(contender.worktreePath);

  return {
    status: eliminated ? "ELIMINATED" : "SURVIVED",
    checks,
    metrics,
  };
}

/**
 * Run the Gauntlet for all contenders whose Bob execution status is COMPLETED.
 *
 * - FAILED contenders are marked ELIMINATED without running any checks.
 * - Checks for each contender run sequentially for reliability.
 * - One contender's failure never crashes another contender's Gauntlet.
 * - Results are returned as a Map keyed by contender ID.
 */
export async function runBattleGauntlet(
  contenders: ContenderBattleState[]
): Promise<Map<string, GauntletResult>> {
  const results = new Map<string, GauntletResult>();

  for (const contender of contenders) {
    if (contender.status === "COMPLETED") {
      try {
        const result = await runGauntlet(contender);
        results.set(contender.id, result);
      } catch (err) {
        // Defensive: runGauntlet should never throw, but just in case
        results.set(contender.id, {
          status: "ELIMINATED",
          checks: [
            {
              id: "gauntlet-error",
              name: "Gauntlet Error",
              status: "FAIL",
              detail: `Unexpected Gauntlet failure: ${String(err)}`,
            },
          ],
          metrics: { filesChanged: 0, linesAdded: 0, linesDeleted: 0 },
        });
      }
    } else {
      // FAILED / PROVISIONING_FAILED / etc. → ELIMINATED without checks
      results.set(contender.id, {
        status: "ELIMINATED",
        checks: [
          {
            id: "bob-execution",
            name: "Bob Execution",
            status: "FAIL",
            detail: `Contender execution status was '${contender.status}' — Gauntlet not attempted`,
          },
        ],
        metrics: { filesChanged: 0, linesAdded: 0, linesDeleted: 0 },
      });
    }
  }

  return results;
}
