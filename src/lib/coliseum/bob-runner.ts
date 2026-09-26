/**
 * Bob Shell runner for Code Coliseum.
 *
 * Launches IBM Bob non-interactively against a contender worktree and parses
 * the stream-json output incrementally.
 *
 * Bob CLI shape:
 *   bob run
 *     --workspace <worktreePath>
 *     --mode agent
 *     --format stream-json
 *     --max-cost 0.30
 *     --max-turns 8
 *     --disable-subagents
 *     --trust
 *     <prompt>
 *
 * Resolution: Bob is resolved from PATH in a Windows-safe way using
 * `where.exe` on Windows and `which` on other platforms.
 * No absolute machine paths are hardcoded.
 *
 * Credentials: the child process inherits the parent's environment.
 * No API keys are placed in source code.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import type { Battle, ContenderBattleState, BobEvent } from "./types";
import { buildPrompt } from "./prompts";
import { collectGitEvidence } from "./git-evidence";

const execFile = promisify(execFileCb);

// ─── Bob binary resolution ─────────────────────────────────────────────────

/**
 * Resolve the `bob` executable from PATH.
 *
 * On Windows we call `where.exe bob.cmd` then `where.exe bob`; on Unix
 * we call `which bob`. Falls back to the bare name if resolution fails so
 * the error from spawn is descriptive.
 */
async function resolveBobBinary(): Promise<string> {
  if (process.platform === "win32") {
    for (const candidate of ["bob.cmd", "bob"]) {
      try {
        const { stdout } = await execFile("where.exe", [candidate]);
        const first = stdout.trim().split(/\r?\n/)[0]?.trim();
        if (first && existsSync(/*turbopackIgnore: true*/ first)) return first;
      } catch {
        // not found via this candidate — try next
      }
    }
    // Last resort: try common npm global paths
    const npmGlobalBin = path.join(
      path.dirname(process.execPath),
      "bob.cmd"
    );
    if (existsSync(/*turbopackIgnore: true*/ npmGlobalBin)) return npmGlobalBin;
    return "bob.cmd";
  }

  try {
    const { stdout } = await execFile("which", ["bob"]);
    const resolved = stdout.trim();
    if (resolved && existsSync(/*turbopackIgnore: true*/ resolved)) return resolved;
  } catch {
    // which failed — fall through
  }
  return "bob";
}

// ─── Stream-JSON line parser ───────────────────────────────────────────────

interface ParsedBobLine {
  type: "event" | "raw";
  event?: Omit<BobEvent, "contenderId">;
  raw?: string;
}

function parseBobLine(line: string): ParsedBobLine {
  const trimmed = line.trim();
  if (!trimmed) return { type: "raw", raw: line };

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const type =
      typeof parsed.type === "string" ? parsed.type : "unknown";

    // Extract tool name for tool_use / tool_result events
    let toolName: string | undefined;
    if (type === "tool_use" && typeof parsed.name === "string") {
      toolName = parsed.name;
    } else if (
      type === "tool_result" &&
      typeof parsed.tool_use_id === "string"
    ) {
      toolName = parsed.tool_use_id;
    }

    const event: Omit<BobEvent, "contenderId"> = {
      type,
      timestamp: new Date().toISOString(),
      toolName,
      content: parsed,
      rawLine: trimmed,
    };

    return { type: "event", event };
  } catch {
    // Not valid JSON — retain as a raw log line
    return { type: "raw", raw: trimmed };
  }
}

// ─── Bob result status extraction ─────────────────────────────────────────

function extractBobResultStatus(events: BobEvent[]): string | undefined {
  // Bob emits a result event at the end: { type: "result", subtype: "success"|"error_max_turns"|... }
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i];
    if (ev.type === "result") {
      const content = ev.content as Record<string, unknown> | undefined;
      if (content && typeof content.subtype === "string") {
        return content.subtype;
      }
    }
  }
  return undefined;
}

function extractSessionCost(events: BobEvent[]): number | undefined {
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i];
    if (ev.type === "result") {
      const content = ev.content as Record<string, unknown> | undefined;
      if (content && typeof content.cost_usd === "number") {
        return content.cost_usd;
      }
    }
  }
  return undefined;
}

// ─── Single contender runner ───────────────────────────────────────────────

export interface RunContenderResult {
  exitCode: number;
  bobResultStatus?: string;
  sessionCost?: number;
  events: BobEvent[];
  rawLogs: string[];
}

/**
 * Run Bob against a single contender worktree.
 *
 * Returns a Promise that resolves when the Bob process exits (regardless of
 * exit code). Never throws — failures are encoded in the result.
 */
export async function runContender(
  contender: ContenderBattleState,
  featureRequest: string,
  bobBin: string
): Promise<RunContenderResult> {
  const prompt = buildPrompt(contender.id, featureRequest);

  const args = [
    "run",
    "--workspace", contender.worktreePath,
    "--mode", "agent",
    "--format", "stream-json",
    "--max-cost", "0.30",
    "--max-turns", "8",
    "--disable-subagents",
    "--trust",
    prompt,
  ];

  const events: BobEvent[] = [];
  const rawLogs: string[] = [];

  return new Promise<RunContenderResult>((resolve) => {
    let proc: ReturnType<typeof spawn>;

    try {
      proc = spawn(bobBin, args, {
        // Inherit full environment so API keys / proxy settings flow through
        env: process.env,
        // No shell — argument array is passed directly to the OS
        shell: false,
        // stdout/stderr as text streams
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (spawnErr) {
      // spawn itself failed (e.g., binary not found)
      rawLogs.push(`[spawn error] ${String(spawnErr)}`);
      resolve({ exitCode: -1, events, rawLogs });
      return;
    }

    // ── stdout: incremental newline-delimited JSON parsing ──────────────────

    let stdoutBuffer = "";

    proc.stdout?.on("data", (chunk: Buffer) => {
      stdoutBuffer += chunk.toString("utf8");
      const lines = stdoutBuffer.split("\n");
      // Keep the last (potentially incomplete) line in the buffer
      stdoutBuffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        const parsed = parseBobLine(line);
        if (parsed.type === "event" && parsed.event) {
          events.push({ contenderId: contender.id, ...parsed.event });
        } else if (parsed.raw !== undefined) {
          rawLogs.push(parsed.raw);
        }
      }
    });

    // ── stderr: retain for debugging ────────────────────────────────────────

    proc.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (trimmed) rawLogs.push(`[stderr] ${trimmed}`);
      }
    });

    // ── process exit ────────────────────────────────────────────────────────

    proc.on("close", (code) => {
      // Flush any remaining buffer content
      if (stdoutBuffer.trim()) {
        const parsed = parseBobLine(stdoutBuffer);
        if (parsed.type === "event" && parsed.event) {
          events.push({ contenderId: contender.id, ...parsed.event });
        } else if (parsed.raw !== undefined) {
          rawLogs.push(parsed.raw);
        }
      }

      resolve({
        exitCode: code ?? -1,
        bobResultStatus: extractBobResultStatus(events),
        sessionCost: extractSessionCost(events),
        events,
        rawLogs,
      });
    });

    proc.on("error", (err) => {
      rawLogs.push(`[process error] ${err.message}`);
      // close event will still fire
    });
  });
}

// ─── Parallel battle runner ────────────────────────────────────────────────

/**
 * Run all READY contenders concurrently.
 *
 * Mutates `battle` in-place — updates each contender's status, timing,
 * events, rawLogs, exitCode, bobResultStatus, and sessionCost.
 * A failure in one contender never terminates the others.
 */
export async function runBattle(battle: Battle): Promise<void> {
  const bobBin = await resolveBobBinary();

  battle.status = "RUNNING";
  battle.startedAt = new Date().toISOString();

  const readyContenders = battle.contenders.filter(
    (c) => c.status === "READY"
  );

  if (readyContenders.length === 0) {
    battle.status = "FAILED";
    return;
  }

  // Launch all ready contenders concurrently
  const runs = readyContenders.map((contender) => {
    contender.status = "RUNNING";
    contender.startedAt = new Date().toISOString();

    return runContender(contender, battle.featureRequest, bobBin).then(
      async (result) => {
        contender.completedAt = new Date().toISOString();
        contender.durationMs =
          Date.parse(contender.completedAt) -
          Date.parse(contender.startedAt!);
        contender.exitCode = result.exitCode;
        contender.bobResultStatus = result.bobResultStatus;
        contender.sessionCost = result.sessionCost;
        contender.events.push(...result.events);
        contender.rawLogs.push(...result.rawLogs);

        const succeeded =
          result.exitCode === 0 ||
          result.bobResultStatus === "success";

        contender.status = succeeded ? "COMPLETED" : "FAILED";

        // Collect git evidence regardless of Bob exit status
        try {
          contender.gitEvidence = await collectGitEvidence(
            contender.worktreePath
          );
        } catch (evidenceErr) {
          contender.gitEvidence = {
            statusPorcelain: "",
            filesChanged: [],
            diffStat: "",
            error: String(evidenceErr),
          };
        }
      }
    );
  });

  // Wait for all — failures in one must not abort others
  await Promise.allSettled(runs);

  battle.completedAt = new Date().toISOString();

  const allDone = battle.contenders.every(
    (c) =>
      c.status === "COMPLETED" ||
      c.status === "FAILED" ||
      c.status === "PROVISIONING_FAILED"
  );

  if (allDone) {
    const anyCompleted = battle.contenders.some(
      (c) => c.status === "COMPLETED"
    );
    battle.status = anyCompleted ? "COMPLETED" : "FAILED";
  } else {
    battle.status = "FAILED";
  }
}
