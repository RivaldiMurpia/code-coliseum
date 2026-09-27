"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ArenaHeader, { type BadgePhase } from "@/components/ArenaHeader";
import BattleForm from "@/components/BattleForm";
import ContenderGrid from "@/components/ContenderGrid";
import GauntletPanel from "@/components/GauntletPanel";
import type {
  BattleState,
  ContenderRole,
  ContenderState,
  Distinction,
} from "@/lib/types";

const DEFAULT_FEATURE =
  "Add a GET /api/health endpoint that returns JSON with status set to ok. Do not add dependencies.";

const META: Record<ContenderRole, { label: string; tagline: string }> = {
  minimalist: { label: "Minimalist", tagline: "Smallest correct diff" },
  sprinter: { label: "Sprinter", tagline: "Optimized for runtime performance" },
  architect: { label: "Architect", tagline: "Maintainability & clean structure" },
};

const ROLE_COLOR: Record<ContenderRole, string> = {
  minimalist: "var(--c-minimalist)",
  sprinter: "var(--c-sprinter)",
  architect: "var(--c-architect)",
};

const FINAL_CONTENDERS: ContenderState[] = [
  {
    id: "minimalist",
    label: "Minimalist",
    tagline: META.minimalist.tagline,
    status: "survived",
    currentAction: "All Gauntlet checks passed",
    filesChanged: 1,
    linesChanged: 6,
    agentTimeMs: 18400,
    gauntlet: {
      "dep-integrity": "pass",
      "type-safety": "pass",
      build: "pass",
      acceptance: "pass",
    },
    acceptancePassed: true,
    eliminationReason: null,
  },
  {
    id: "sprinter",
    label: "Sprinter",
    tagline: META.sprinter.tagline,
    status: "survived",
    currentAction: "All Gauntlet checks passed",
    filesChanged: 1,
    linesChanged: 9,
    agentTimeMs: 15100,
    gauntlet: {
      "dep-integrity": "pass",
      "type-safety": "pass",
      build: "pass",
      acceptance: "pass",
    },
    acceptancePassed: true,
    eliminationReason: null,
  },
  {
    id: "architect",
    label: "Architect",
    tagline: META.architect.tagline,
    status: "survived",
    currentAction: "All Gauntlet checks passed",
    filesChanged: 2,
    linesChanged: 18,
    agentTimeMs: 22600,
    gauntlet: {
      "dep-integrity": "pass",
      "type-safety": "pass",
      build: "pass",
      acceptance: "pass",
    },
    acceptancePassed: true,
    eliminationReason: null,
  },
];

const DISTINCTIONS: Distinction[] = [
  {
    label: "Smallest Diff",
    contenderId: "minimalist",
    evidence: "6 lines changed vs 9 (Sprinter) and 18 (Architect)",
  },
  {
    label: "Fastest Agent",
    contenderId: "sprinter",
    evidence: "15.1s execution time vs 18.4s and 22.6s",
  },
];

const DIFFS: Record<ContenderRole, string> = {
  minimalist: `diff --git a/src/app/api/health/route.ts b/src/app/api/health/route.ts
new file mode 100644
--- /dev/null
+++ b/src/app/api/health/route.ts
@@ -0,0 +1,6 @@
+import { NextResponse } from "next/server";
+
+export function GET() {
+  return NextResponse.json({ status: "ok" });
+}
`,
  sprinter: `diff --git a/src/app/api/health/route.ts b/src/app/api/health/route.ts
new file mode 100644
--- /dev/null
+++ b/src/app/api/health/route.ts
@@ -0,0 +1,9 @@
+import { NextResponse } from "next/server";
+
+const body = { status: "ok" } as const;
+
+export function GET() {
+  return NextResponse.json(body, {
+    headers: { "Cache-Control": "no-store" },
+  });
+}
`,
  architect: `diff --git a/src/app/api/health/route.ts b/src/app/api/health/route.ts
new file mode 100644
--- /dev/null
+++ b/src/app/api/health/route.ts
@@ -0,0 +1,10 @@
+import { NextResponse } from "next/server";
+
+type HealthResponse = { status: "ok" };
+
+function healthPayload(): HealthResponse {
+  return { status: "ok" };
+}
+
+export function GET() {
+  return NextResponse.json(healthPayload());
+}
`,
};

function waitingContenders(status: ContenderState["status"], action: string): ContenderState[] {
  const ids: ContenderRole[] = ["minimalist", "sprinter", "architect"];
  return ids.map((id) => ({
    id,
    label: META[id].label,
    tagline: META[id].tagline,
    status,
    currentAction: action,
    filesChanged: 0,
    linesChanged: 0,
    agentTimeMs: -1,
    gauntlet: {
      "dep-integrity": "pending",
      "type-safety": "pending",
      build: "pending",
      acceptance: "pending",
    },
    acceptancePassed: null,
    eliminationReason: null,
  }));
}

function runningContenders(): ContenderState[] {
  const actions: Record<ContenderRole, string> = {
    minimalist: "Writing the smallest correct route…",
    sprinter: "Optimizing the request path…",
    architect: "Structuring a maintainable implementation…",
  };
  return waitingContenders("implementing", "").map((c) => ({
    ...c,
    currentAction: actions[c.id],
  }));
}

function judgingContenders(): ContenderState[] {
  return FINAL_CONTENDERS.map((c) => ({
    ...c,
    status: "entering-gauntlet",
    currentAction: "Running deterministic Gauntlet checks…",
    gauntlet: {
      "dep-integrity": "pass",
      "type-safety": "pass",
      build: "pass",
      acceptance: "pending",
    },
    acceptancePassed: null,
  }));
}

function DemoResults({ contenders }: { contenders: ContenderState[] }) {
  const [selected, setSelected] = useState<ContenderRole | null>(null);
  const [applied, setApplied] = useState(false);
  const [diffFor, setDiffFor] = useState<ContenderRole | null>(null);

  const selectedContender = contenders.find((c) => c.id === selected) ?? null;

  return (
    <section style={{ padding: "0 24px 48px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          <span
            style={{
              fontFamily: "var(--font-geist-mono, monospace)",
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            Analysis
          </span>
          <div style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12,
            marginBottom: 20,
          }}
        >
          {DISTINCTIONS.map((d) => (
            <div
              key={d.label}
              style={{
                padding: "14px 16px",
                borderRadius: "var(--radius-md)",
                border: `1px solid ${ROLE_COLOR[d.contenderId]}30`,
                background: `${ROLE_COLOR[d.contenderId]}0d`,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: ROLE_COLOR[d.contenderId],
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {d.label} → {d.contenderId}
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-secondary)" }}>
                {d.evidence}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "180px repeat(3, 1fr)",
              background: "var(--bg-raised)",
              borderBottom: "1px solid var(--border-default)",
            }}
          >
            <Cell muted>Metric</Cell>
            {contenders.map((c) => (
              <Cell key={c.id} color={ROLE_COLOR[c.id]}>
                {c.label} · SURVIVED
              </Cell>
            ))}
          </div>
          <MetricRow label="Files Changed" contenders={contenders} value={(c) => String(c.filesChanged)} />
          <MetricRow label="Lines Changed" contenders={contenders} value={(c) => String(c.linesChanged)} />
          <MetricRow
            label="Agent Time"
            contenders={contenders}
            value={(c) => `${(c.agentTimeMs / 1000).toFixed(1)}s`}
          />
        </div>

        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-lg)",
            padding: "16px 20px",
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              fontFamily: "var(--font-geist-mono, monospace)",
              marginBottom: 12,
            }}
          >
            Developer Actions
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {contenders.map((c) => {
              const isSelected = selected === c.id;
              return (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                    padding: "10px",
                    borderRadius: "var(--radius-sm)",
                    border: isSelected
                      ? `1px solid ${ROLE_COLOR[c.id]}40`
                      : "1px solid var(--border-subtle)",
                    background: isSelected ? `${ROLE_COLOR[c.id]}0d` : "var(--bg-surface)",
                  }}
                >
                  <div style={{ minWidth: 150, fontWeight: 700, fontSize: 12 }}>
                    <span style={{ color: ROLE_COLOR[c.id], marginRight: 8 }}>◆</span>
                    {c.label}
                    {isSelected && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 9,
                          color: ROLE_COLOR[c.id],
                          fontFamily: "var(--font-geist-mono, monospace)",
                        }}
                      >
                        SELECTED
                      </span>
                    )}
                  </div>

                  <button type="button" onClick={() => setDiffFor(c.id)} style={secondaryButtonStyle}>
                    Inspect Diff
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(c.id);
                      setApplied(false);
                    }}
                    style={{
                      ...secondaryButtonStyle,
                      border: `1px solid ${ROLE_COLOR[c.id]}60`,
                      color: ROLE_COLOR[c.id],
                    }}
                  >
                    {isSelected ? "✓ Selected" : "Choose Candidate"}
                  </button>
                  {isSelected && (
                    <button
                      type="button"
                      disabled={applied}
                      onClick={() => setApplied(true)}
                      style={{
                        ...primaryButtonStyle,
                        background: applied ? "var(--s-done)" : ROLE_COLOR[c.id],
                        opacity: applied ? 0.75 : 1,
                      }}
                    >
                      {applied ? "✓ Applied" : "Apply Candidate"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {selectedContender && (
            <div
              style={{
                marginTop: 14,
                padding: "12px 14px",
                borderRadius: "var(--radius-sm)",
                border: applied
                  ? "1px solid rgba(34,197,94,0.3)"
                  : "1px solid var(--border-subtle)",
                background: applied ? "rgba(34,197,94,0.08)" : "var(--bg-surface)",
                fontFamily: "var(--font-geist-mono, monospace)",
                fontSize: 11,
                color: applied ? "var(--s-done)" : "var(--text-secondary)",
              }}
            >
              {applied
                ? `✓ ${selectedContender.label} applied in demo mode · ${selectedContender.filesChanged} file(s)`
                : `${selectedContender.label} selected for merge · all Gauntlet checks passed`}
            </div>
          )}
        </div>
      </div>

      {diffFor && (
        <div
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDiffFor(null);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "rgba(0,0,0,0.68)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            style={{
              width: "min(1000px, 100%)",
              maxHeight: "calc(100vh - 48px)",
              overflow: "hidden",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border-default)",
              background: "var(--bg-card)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid var(--border-default)",
                display: "flex",
                alignItems: "center",
              }}
            >
              <strong>{META[diffFor].label} · Representative Git Diff</strong>
              <button
                type="button"
                onClick={() => setDiffFor(null)}
                style={{ ...secondaryButtonStyle, marginLeft: "auto" }}
              >
                Close
              </button>
            </div>
            <pre
              style={{
                margin: 0,
                padding: 20,
                overflow: "auto",
                background: "var(--bg-base)",
                color: "var(--text-secondary)",
                fontSize: 12,
                lineHeight: 1.55,
                fontFamily: "var(--font-geist-mono, monospace)",
              }}
            >
              {DIFFS[diffFor]}
            </pre>
          </div>
        </div>
      )}
    </section>
  );
}

function Cell({
  children,
  muted,
  color,
}: {
  children: React.ReactNode;
  muted?: boolean;
  color?: string;
}) {
  return (
    <div
      style={{
        padding: "11px 16px",
        borderLeft: muted ? "none" : "1px solid var(--border-subtle)",
        fontSize: 11,
        fontFamily: "var(--font-geist-mono, monospace)",
        color: muted ? "var(--text-muted)" : color ?? "var(--text-secondary)",
      }}
    >
      {children}
    </div>
  );
}

function MetricRow({
  label,
  contenders,
  value,
}: {
  label: string;
  contenders: ContenderState[];
  value: (c: ContenderState) => string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "180px repeat(3, 1fr)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <Cell>{label}</Cell>
      {contenders.map((c) => (
        <Cell key={c.id}>{value(c)}</Cell>
      ))}
    </div>
  );
}

const secondaryButtonStyle: React.CSSProperties = {
  height: 34,
  padding: "0 14px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border-default)",
  background: "var(--bg-raised)",
  color: "var(--text-secondary)",
  fontFamily: "var(--font-geist-mono, monospace)",
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
};

const primaryButtonStyle: React.CSSProperties = {
  height: 34,
  padding: "0 14px",
  borderRadius: "var(--radius-sm)",
  border: "none",
  color: "#fff",
  fontFamily: "var(--font-geist-mono, monospace)",
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
};

export default function DemoPage() {
  const [featureRequest, setFeatureRequest] = useState(DEFAULT_FEATURE);
  const [battle, setBattle] = useState<BattleState>({
    phase: "idle",
    featureRequest: DEFAULT_FEATURE,
    contenders: [],
    distinctions: [],
  });
  const [badgePhase, setBadgePhase] = useState<BadgePhase>("ready");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    for (const timer of timers.current) clearTimeout(timer);
    timers.current = [];
  };

  useEffect(() => clearTimers, []);

  const isComplete = battle.phase === "complete";

  const demoLabel = useMemo(
    () => (isComplete ? "Representative hosted results" : "No local runtime required"),
    [isComplete]
  );

  function schedule(delay: number, fn: () => void) {
    timers.current.push(setTimeout(fn, delay));
  }

  function startDemo() {
    if (!featureRequest.trim() || battle.phase === "running") return;
    clearTimers();

    const request = featureRequest.trim();
    setBadgePhase("preparing");
    setBattle({
      phase: "running",
      featureRequest: request,
      contenders: waitingContenders("preparing", "Provisioning isolated worktree…"),
      distinctions: [],
    });

    schedule(700, () => {
      setBadgePhase("running");
      setBattle({
        phase: "running",
        featureRequest: request,
        contenders: runningContenders(),
        distinctions: [],
      });
    });

    schedule(2200, () => {
      setBadgePhase("judging");
      setBattle({
        phase: "running",
        featureRequest: request,
        contenders: judgingContenders(),
        distinctions: [],
      });
    });

    schedule(3400, () => {
      setBadgePhase("complete");
      setBattle({
        phase: "complete",
        featureRequest: request,
        contenders: FINAL_CONTENDERS,
        distinctions: DISTINCTIONS,
      });
    });
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
      <ArenaHeader phase={badgePhase} />

      <div
        style={{
          borderBottom: "1px solid rgba(59,130,246,0.28)",
          background: "rgba(59,130,246,0.08)",
          padding: "10px 24px",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
            fontSize: 11,
            color: "var(--text-secondary)",
            fontFamily: "var(--font-geist-mono, monospace)",
          }}
        >
          <span
            style={{
              color: "var(--accent)",
              fontWeight: 800,
              letterSpacing: "0.08em",
            }}
          >
            HOSTED DEMO MODE
          </span>
          <span>·</span>
          <span>
            Simulated battle playback with representative evidence. Full IBM Bob Shell execution runs locally and is shown in the submission video.
          </span>
          <span style={{ marginLeft: "auto", color: "var(--text-muted)" }}>{demoLabel}</span>
        </div>
      </div>

      <main style={{ flex: 1 }}>
        <BattleForm
          value={featureRequest}
          phase={battle.phase}
          onChange={setFeatureRequest}
          onStart={startDemo}
        />

        {(battle.phase === "running" || battle.phase === "complete") && (
          <>
            <ContenderGrid contenders={battle.contenders} />
            <GauntletPanel contenders={battle.contenders} />
          </>
        )}

        {battle.phase === "complete" && <DemoResults contenders={battle.contenders} />}

        {battle.phase === "idle" && (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: 13,
              fontFamily: "var(--font-geist-mono, monospace)",
            }}
          >
            Click Start Battle to play the hosted demo.
          </div>
        )}
      </main>

      <footer
        style={{
          borderTop: "1px solid var(--border-subtle)",
          padding: "16px 24px",
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          fontSize: 11,
          fontFamily: "var(--font-geist-mono, monospace)",
          color: "var(--text-muted)",
        }}
      >
        <span>Code Coliseum · Hosted Demo</span>
        <span>AI proposes · Evidence proves · Developer decides</span>
      </footer>
    </div>
  );
}
