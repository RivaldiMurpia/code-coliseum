"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ArenaHeader, { type BadgePhase } from "@/components/ArenaHeader";
import BattleForm from "@/components/BattleForm";
import ContenderGrid from "@/components/ContenderGrid";
import GauntletPanel from "@/components/GauntletPanel";
import ResultsPanel from "@/components/ResultsPanel";
import type { BattleState, ContenderState, ContenderRole, Distinction } from "@/lib/types";
import type { Battle, ContenderBattleState, BobEvent } from "@/lib/coliseum/types";

// ─── Static identity for each contender role ─────────────────────────────────

const CONTENDER_META: Record<ContenderRole, { label: string; tagline: string }> = {
  minimalist: { label: "Minimalist", tagline: "Smallest correct diff"            },
  sprinter:   { label: "Sprinter",   tagline: "Optimized for runtime performance" },
  architect:  { label: "Architect",  tagline: "Maintainability & clean structure" },
};

// ─── Status mapping ───────────────────────────────────────────────────────────

function mapContenderStatus(
  c: ContenderBattleState
): ContenderState["status"] {
  if (c.gauntlet) {
    return c.gauntlet.status === "SURVIVED" ? "survived" : "eliminated";
  }
  switch (c.status) {
    case "CREATED":              return "waiting";
    case "PROVISIONING":         return "preparing";
    case "PROVISIONING_FAILED":  return "failed";
    case "READY":                return "ready";
    case "RUNNING":              return "implementing";
    case "COMPLETED":            return "entering-gauntlet";
    case "FAILED":               return "failed";
    default:                     return "waiting";
  }
}

// ─── Current-action interpretation ───────────────────────────────────────────

function interpretLatestEvent(events: BobEvent[]): string {
  if (events.length === 0) return "Implementing feature...";
  const last = events[events.length - 1];
  switch (last.type) {
    case "tool_use": {
      const name = last.toolName ?? "tool";
      if (name === "Bash" || name === "execute_bash" || name === "bash") {
        return "Running command";
      }
      if (name === "Write" || name === "write_file") {
        return "Writing file";
      }
      if (name === "Read" || name === "read_file") {
        return "Reading file";
      }
      return `Using ${name}`;
    }
    case "tool_result":
    case "result":
      return "Implementation complete";
    case "message": {
      // Show a short safe snippet of content
      const raw = last.content;
      if (typeof raw === "string" && raw.trim().length > 0) {
        return raw.trim().slice(0, 80) + (raw.trim().length > 80 ? "…" : "");
      }
      if (typeof raw === "object" && raw !== null) {
        const text =
          (raw as Record<string, unknown>).text ??
          (raw as Record<string, unknown>).content;
        if (typeof text === "string" && text.trim().length > 0) {
          return text.trim().slice(0, 80) + (text.trim().length > 80 ? "…" : "");
        }
      }
      return "Implementing feature...";
    }
    default:
      return "Implementing feature...";
  }
}

// ─── Map a backend contender → UI ContenderState ─────────────────────────────

function mapContender(c: ContenderBattleState): ContenderState {
  const meta = CONTENDER_META[c.id as ContenderRole] ?? {
    label: c.name,
    tagline: "",
  };
  const uiStatus = mapContenderStatus(c);
  const isRunning = uiStatus === "implementing";
  const isDone =
    uiStatus === "survived" ||
    uiStatus === "eliminated" ||
    uiStatus === "failed" ||
    uiStatus === "entering-gauntlet";

  // Current action
  let currentAction = "";
  if (isRunning) {
    currentAction = interpretLatestEvent(c.events);
  } else if (uiStatus === "entering-gauntlet") {
    currentAction = "Running Gauntlet checks…";
  } else if (uiStatus === "survived") {
    currentAction = "All Gauntlet checks passed";
  } else if (uiStatus === "eliminated") {
    const failedChecks = c.gauntlet?.checks
      .filter((ch) => ch.status === "FAIL")
      .map((ch) => ch.name)
      .join(", ");
    currentAction = failedChecks ? `Failed: ${failedChecks}` : "Gauntlet failed";
  } else if (uiStatus === "failed") {
    currentAction = c.provisioningError ?? "Execution failed";
  } else if (isDone) {
    currentAction = "";
  }

  // Gauntlet matrix
  const pendingMatrix: ContenderState["gauntlet"] = {
    "dep-integrity": "pending",
    "type-safety":   "pending",
    "build":         "pending",
    "acceptance":    "pending",
  };
  let gauntlet: ContenderState["gauntlet"] = pendingMatrix;
  if (c.gauntlet) {
    const matrix: ContenderState["gauntlet"] = { ...pendingMatrix };
    for (const check of c.gauntlet.checks) {
      const id = check.id as keyof ContenderState["gauntlet"];
      if (id in matrix) {
        matrix[id] = check.status === "PASS" ? "pass" : "fail";
      }
    }
    gauntlet = matrix;
  }

  // Metrics
  const filesChanged = c.gauntlet?.metrics?.filesChanged ?? 0;
  const linesChanged =
    (c.gauntlet?.metrics?.linesAdded ?? 0) +
    (c.gauntlet?.metrics?.linesDeleted ?? 0);
  const agentTimeMs = c.durationMs ?? -1;

  // Acceptance check
  let acceptancePassed: boolean | null = null;
  if (c.gauntlet) {
    const check = c.gauntlet.checks.find((ch) => ch.id === "acceptance");
    if (check) {
      acceptancePassed = check.status === "PASS";
    }
  }

  // Elimination reason from failing checks
  let eliminationReason: string | null = null;
  if (uiStatus === "eliminated" && c.gauntlet) {
    const failed = c.gauntlet.checks
      .filter((ch) => ch.status === "FAIL")
      .map((ch) => ch.name);
    if (failed.length > 0) {
      eliminationReason = `Failed check${failed.length > 1 ? "s" : ""}: ${failed.join(", ")}`;
    }
  } else if (uiStatus === "failed") {
    eliminationReason = c.provisioningError ?? null;
  }

  return {
    id: c.id as ContenderRole,
    label: meta.label,
    tagline: meta.tagline,
    status: uiStatus,
    currentAction,
    filesChanged,
    linesChanged,
    agentTimeMs,
    gauntlet,
    acceptancePassed,
    eliminationReason,
  };
}

// ─── Compute distinctions from final state ────────────────────────────────────

function computeDistinctions(contenders: ContenderState[]): Distinction[] {
  const distinctions: Distinction[] = [];

  // Smallest Diff: contender with fewest changed lines among all with gauntlet data
  const withMetrics = contenders.filter(
    (c) =>
      (c.status === "survived" || c.status === "eliminated") &&
      c.linesChanged > 0
  );
  if (withMetrics.length >= 2) {
    const minLines = Math.min(...withMetrics.map((c) => c.linesChanged));
    const smallest = withMetrics.find((c) => c.linesChanged === minLines);
    if (smallest) {
      const others = withMetrics
        .filter((c) => c.id !== smallest.id)
        .map((c) => `${c.linesChanged} (${c.label})`)
        .join(", ");
      distinctions.push({
        label: "Smallest Diff",
        contenderId: smallest.id,
        evidence: `${minLines} lines changed vs ${others}`,
      });
    }
  }

  return distinctions;
}

// ─── Polling stop condition ────────────────────────────────────────────────────

function isBattleSettled(battle: Battle): boolean {
  // Battle must have finished executing
  if (battle.status !== "COMPLETED" && battle.status !== "FAILED") return false;
  if (battle.status === "FAILED") return true;

  // All COMPLETED contenders must have a gauntlet result
  const completed = battle.contenders.filter((c) => c.status === "COMPLETED");
  return completed.every((c) => c.gauntlet != null);
}

// ─── Map full Battle → BattleState ───────────────────────────────────────────

function mapBattle(battle: Battle, featureRequest: string): BattleState {
  const contenders = battle.contenders.map(mapContender);
  const isSettled = isBattleSettled(battle);
  const distinctions = isSettled ? computeDistinctions(contenders) : [];

  return {
    phase: isSettled ? "complete" : "running",
    featureRequest,
    contenders,
    distinctions,
  };
}

// ─── Blank running state (shown immediately after start) ─────────────────────

function makeInitialRunningState(featureRequest: string): BattleState {
  const ROLES: ContenderRole[] = ["minimalist", "sprinter", "architect"];
  return {
    phase: "running",
    featureRequest,
    contenders: ROLES.map((id) => ({
      id,
      label: CONTENDER_META[id].label,
      tagline: CONTENDER_META[id].tagline,
      status: "waiting",
      currentAction: "Waiting to start…",
      filesChanged: 0,
      linesChanged: 0,
      agentTimeMs: -1,
      gauntlet: {
        "dep-integrity": "pending",
        "type-safety":   "pending",
        "build":         "pending",
        "acceptance":    "pending",
      },
      acceptancePassed: null,
      eliminationReason: null,
    })),
    distinctions: [],
  };
}

// ─── Derive badge phase from BattleState ─────────────────────────────────────

function deriveBadgePhase(battle: BattleState): BadgePhase {
  if (battle.phase === "idle") {
    return battle.error ? "failed" : "ready";
  }
  if (battle.phase === "complete") {
    // A FAILED backend battle lands here with all contenders having failed status
    const allFailed =
      battle.contenders.length > 0 &&
      battle.contenders.every((c) => c.status === "failed");
    return allFailed ? "failed" : "complete";
  }
  // phase === "running"
  const terminalStatuses = new Set<ContenderState["status"]>([
    "survived",
    "eliminated",
    "failed",
    "entering-gauntlet",
  ]);
  const allTerminal =
    battle.contenders.length > 0 &&
    battle.contenders.every((c) => terminalStatuses.has(c.status));
  if (allTerminal) return "judging";

  const provisioningStatuses = new Set<ContenderState["status"]>([
    "waiting",
    "preparing",
    "ready",
  ]);
  const anyProvisioning = battle.contenders.some((c) =>
    provisioningStatuses.has(c.status)
  );
  if (anyProvisioning) return "preparing";

  return "running";
}

// ─── Idle initial state ───────────────────────────────────────────────────────

const IDLE_STATE: BattleState = {
  phase: "idle",
  featureRequest: "",
  contenders: [],
  distinctions: [],
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [battle, setBattle] = useState<BattleState>(IDLE_STATE);
  const [activeBattleId, setActiveBattleId] = useState<string | null>(null);
  const [featureRequest, setFeatureRequest] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Stop polling ────────────────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // ── Cleanup on unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // ── Poll loop ────────────────────────────────────────────────────────────────
  const startPolling = useCallback(
    (battleId: string, fr: string) => {
      stopPolling();

      const poll = async () => {
        try {
          const res = await fetch(`/api/battles/${battleId}`);
          if (!res.ok) {
            setBattle((prev) => ({
              ...prev,
              error: `Polling error: ${res.status} ${res.statusText}`,
            }));
            return;
          }
          const data: Battle = await res.json();

          if (isBattleSettled(data)) {
            stopPolling();
            setActiveBattleId(null);
          }

          setBattle(mapBattle(data, fr));
        } catch (err) {
          setBattle((prev) => ({
            ...prev,
            error: `Network error: ${err instanceof Error ? err.message : String(err)}`,
          }));
        }
      };

      // Poll immediately, then every second
      void poll();
      pollRef.current = setInterval(() => void poll(), 1000);
    },
    [stopPolling]
  );

  // ── Start battle ─────────────────────────────────────────────────────────────
  async function handleStart() {
    if (activeBattleId || battle.phase === "running") return;
    if (!featureRequest.trim()) return;

    // Clear any previous error, show loading state
    setBattle(makeInitialRunningState(featureRequest));

    try {
      // 1. Create battle
      const createRes = await fetch("/api/battles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featureRequest: featureRequest.trim() }),
      });

      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        const msg =
          createRes.status === 409
            ? `Cannot start: ${(err as { error?: string }).error ?? "Working tree is dirty"}`
            : (err as { error?: string }).error ?? `HTTP ${createRes.status}`;
        setBattle({
          phase: "idle",
          featureRequest,
          contenders: [],
          distinctions: [],
          error: msg,
        });
        return;
      }

      const created: Battle = await createRes.json();
      const { battleId } = created;

      // 2. Kick off the run (fire-and-forget from server, 202 response)
      const runRes = await fetch(`/api/battles/${battleId}/run`, {
        method: "POST",
      });

      if (!runRes.ok) {
        const err = await runRes.json().catch(() => ({}));
        setBattle({
          phase: "idle",
          featureRequest,
          contenders: [],
          distinctions: [],
          error:
            (err as { error?: string }).error ?? `Run failed: HTTP ${runRes.status}`,
        });
        return;
      }

      // 3. Store battleId and start polling
      setActiveBattleId(battleId);
      startPolling(battleId, featureRequest.trim());
    } catch (err) {
      setBattle({
        phase: "idle",
        featureRequest,
        contenders: [],
        distinctions: [],
        error: `Failed to start battle: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-base)",
      }}
    >
      <ArenaHeader phase={deriveBadgePhase(battle)} />

      <main style={{ flex: 1 }}>
        <BattleForm
          value={featureRequest}
          phase={battle.phase}
          onChange={setFeatureRequest}
          onStart={() => void handleStart()}
        />

        {/* Error banner */}
        {battle.error && (
          <div
            style={{
              maxWidth: 1200,
              margin: "0 auto",
              padding: "0 24px",
            }}
          >
            <div
              style={{
                marginTop: 16,
                padding: "12px 16px",
                borderRadius: "var(--radius-md)",
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "var(--s-failed)",
                fontSize: 13,
                fontFamily: "var(--font-geist-mono, monospace)",
              }}
            >
              ✕ {battle.error}
            </div>
          </div>
        )}

        {(battle.phase === "running" || battle.phase === "complete") && (
          <>
            <ContenderGrid contenders={battle.contenders} />
            <GauntletPanel contenders={battle.contenders} />
          </>
        )}

        {battle.phase === "complete" && (
          <ResultsPanel
            contenders={battle.contenders}
            distinctions={battle.distinctions}
          />
        )}

        {battle.phase === "idle" && !battle.error && (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: 13,
              fontFamily: "var(--font-geist-mono, monospace)",
              letterSpacing: "0.04em",
            }}
          >
            Enter a feature request above and start the battle.
          </div>
        )}
      </main>

      <footer
        style={{
          borderTop: "1px solid var(--border-subtle)",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            fontFamily: "var(--font-geist-mono, monospace)",
            letterSpacing: "0.04em",
          }}
        >
          Code Coliseum · MVP
        </span>
        <span
          style={{
            fontSize: 11,
            color: "var(--text-disabled)",
            fontFamily: "var(--font-geist-mono, monospace)",
          }}
        >
          {activeBattleId ? `Battle ${activeBattleId} · polling` : ""}
        </span>
      </footer>
    </div>
  );
}
