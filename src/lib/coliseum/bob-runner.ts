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
 *
 * The contender prompt is written to Bob's stdin (not passed as a CLI
 * argument) so that user-provided text never touches the shell command line.
 *
 * Resolution: Bob is resolved from PATH in a Windows-safe way using
 * `where.exe` on Windows and `which` on other platforms.
 * No absolute machine paths are hardcoded.
 *
 * Credentials: the child process inherits the parent's environment.
 * No API keys are placed in source code.
 *
 * Windows note: .cmd shims cannot be spawned with shell:false.
 * On win32 we route through cmd.exe /C with ONLY fixed trusted CLI flags.
 * The prompt (which contains user-provided text) is passed via stdin —
 * it is never interpolated into the shell command string.
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
 * On Windows, `where.exe bob` may return both the extensionless Unix-style
 * shim and the `bob.cmd` batch wrapper on separate lines.  Only `bob.cmd`
 * can be launched reliably via cmd.exe /C; the extensionless shim produces
 * EINVAL.  We therefore scan all `where.exe` output lines and prefer the
 * first `.cmd` entry.  If none is found we fall back to a well-known npm
 * global location, then to the bare "bob.cmd" name.
 *
 * On Unix we call `which bob` and fall back to "bob".
 */
async function resolveBobBinary(): Promise<string> {
  if (process.platform === "win32") {
    try {
      const { stdout } = await execFile("where.exe", ["bob"]);
      const lines = stdout
        .trim()
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      // Prefer the .cmd shim — it is the correct Windows entry point
      const cmdLine = lines.find((l) => l.toLowerCase().endsWith(".cmd"));
      const chosen = cmdLine ?? lines[0];
      if (chosen && existsSync(/*turbopackIgnore: true*/ chosen)) return chosen;
    } catch {
      // where.exe failed — fall through to defaults
    }
    // Fallback: npm global bin next to the Node executable
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
 *
 * Security: the contender prompt (which contains user-provided feature
 * request text) is written to Bob's stdin.  It is never included in the
 * shell command string or argument vector passed to cmd.exe.
 */
export async function runContender(
  contender: ContenderBattleState,
  featureRequest: string,
  bobBin: string
): Promise<RunContenderResult> {
  const prompt = buildPrompt(contender.id, featureRequest);

  // Fixed, trusted CLI flags only — no user text here.
  const bobFixedArgs = [
    "run",
    "--workspace", contender.worktreePath,
    "--mode", "agent",
    "--format", "stream-json",
    "--max-cost", "0.30",
    "--max-turns", "8",
    "--disable-subagents",
    "--trust",
  ];

  const events: BobEvent[] = [];
  const rawLogs: string[] = [];

  return new Promise<RunContenderResult>((resolve) => {
    let proc: ReturnType<typeof spawn>;

    try {
      if (process.platform === "win32") {
        // On Windows, .cmd shims cannot be spawned with shell:false (EINVAL).
        // Route through cmd.exe /C with ONLY the fixed trusted flag string.
        // The prompt is sent via stdin — never via the command line.
        const comspec = process.env.ComSpec ?? "cmd.exe";
        // Build the shell command from fixed constant parts only.
        // bobBin is the resolved .cmd path (trusted, not user input).
        // Quote every argument so paths containing spaces (e.g. the worktree
        // path passed to --workspace) are not split by cmd.exe.
        const shellCmd = [`"${bobBin}"`, ...bobFixedArgs.map((a) => `"${a}"`)].join(" ");
        proc = spawn(
          /*turbopackIgnore: true*/ comspec,
          ["/C", shellCmd],
          {
            env: process.env,
            shell: false,
            stdio: ["pipe", "pipe", "pipe"],
          }
        );
      } else {
        proc = spawn(bobBin, bobFixedArgs, {
          env: process.env,
          shell: false,
          stdio: ["pipe", "pipe", "pipe"],
        });
      }
    } catch (spawnErr) {
      // spawn itself failed (e.g., binary not found)
      rawLogs.push(`[spawn error] ${String(spawnErr)}`);
      resolve({ exitCode: -1, events, rawLogs });
      return;
    }

    // Write the prompt to stdin, then close it so Bob knows input is done.
    // This is the ONLY place user-provided text enters the child process —
    // through the stdin pipe, never through the shell command line.
    try {
      proc.stdin?.write(prompt, "utf8");
      proc.stdin?.end();
    } catch (stdinErr) {
      rawLogs.push(`[stdin error] ${String(stdinErr)}`);
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
