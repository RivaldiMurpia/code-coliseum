import type { ContenderState, ContenderRole } from "@/lib/types";

/* ─── Colour mapping ────────────────────────────────────────────────────── */
const ROLE_COLOR: Record<ContenderRole, string> = {
  minimalist: "var(--c-minimalist)",
  sprinter:   "var(--c-sprinter)",
  architect:  "var(--c-architect)",
};

const ROLE_ICON: Record<ContenderRole, string> = {
  minimalist: "◈",
  sprinter:   "◆",
  architect:  "◉",
};

const STATUS_LABEL: Record<ContenderState["status"], string> = {
  idle:       "Idle",
  thinking:   "Thinking",
  coding:     "Coding",
  testing:    "Testing",
  survived:   "Survived",
  eliminated: "Eliminated",
  failed:     "Failed",
};

const STATUS_COLOR: Record<ContenderState["status"], string> = {
  idle:       "var(--s-idle)",
  thinking:   "var(--s-running)",
  coding:     "var(--s-running)",
  testing:    "var(--s-running)",
  survived:   "var(--s-done)",
  eliminated: "var(--s-failed)",
  failed:     "var(--s-failed)",
};

/* ─── Tiny helpers ──────────────────────────────────────────────────────── */
function Metric({
  label,
  value,
  dim = false,
}: {
  label: string;
  value: string | number;
  dim?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span
        style={{
          fontSize: 10,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 15,
          fontWeight: 600,
          fontFamily: "var(--font-geist-mono, monospace)",
          color: dim ? "var(--text-muted)" : "var(--text-primary)",
          lineHeight: 1,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function TestBar({ passed, total }: { passed: number; total: number }) {
  const allPass = passed === total;
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0;
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 5,
        }}
      >
        <span
          style={{
            fontSize: 10,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          Acceptance Tests
        </span>
        <span
          style={{
            fontSize: 11,
            fontFamily: "var(--font-geist-mono, monospace)",
            color: allPass ? "var(--s-done)" : "var(--s-failed)",
            fontWeight: 600,
          }}
        >
          {passed}/{total}
        </span>
      </div>
      <div
        style={{
          height: 3,
          borderRadius: 2,
          background: "var(--border-subtle)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            borderRadius: 2,
            background: allPass ? "var(--s-done)" : "var(--s-failed)",
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}

/* ─── ContenderCard ─────────────────────────────────────────────────────── */
interface ContenderCardProps {
  contender: ContenderState;
}

export default function ContenderCard({ contender }: ContenderCardProps) {
  const color = ROLE_COLOR[contender.id];
  const icon = ROLE_ICON[contender.id];
  const statusLabel = STATUS_LABEL[contender.status];
  const statusColor = STATUS_COLOR[contender.status];
  const isEliminated = contender.status === "eliminated" || contender.status === "failed";
  const isSurvived = contender.status === "survived";
  const agentSec = (contender.agentTimeMs / 1000).toFixed(1);

  return (
    <article
      style={{
        position: "relative",
        background: isEliminated ? "var(--bg-surface)" : "var(--bg-card)",
        border: isEliminated
          ? "1px solid var(--s-failed)30"
          : isSurvived
          ? `1px solid ${color}60`
          : "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        overflow: "hidden",
        opacity: isEliminated ? 0.72 : 1,
        transition: "opacity 0.2s",
      }}
    >
      {/* Top accent line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: isEliminated ? "var(--s-failed)" : color,
          opacity: isEliminated ? 0.5 : 1,
        }}
      />

      {/* Eliminated overlay stripe */}
      {isEliminated && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "repeating-linear-gradient(-45deg, transparent, transparent 18px, rgba(239,68,68,0.025) 18px, rgba(239,68,68,0.025) 20px)",
            pointerEvents: "none",
            borderRadius: "var(--radius-lg)",
          }}
        />
      )}

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span
          style={{
            fontSize: 20,
            color: isEliminated ? "var(--text-muted)" : color,
            lineHeight: 1,
            marginTop: 1,
            flexShrink: 0,
          }}
        >
          {icon}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <h2
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: isEliminated ? "var(--text-secondary)" : "var(--text-primary)",
                margin: 0,
                letterSpacing: "-0.01em",
              }}
            >
              {contender.label}
            </h2>

            {/* Status badge */}
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 7px",
                borderRadius: 10,
                background: `${statusColor}18`,
                border: `1px solid ${statusColor}40`,
                fontSize: 10,
                fontFamily: "var(--font-geist-mono, monospace)",
                color: statusColor,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              {isEliminated ? "✕ " : isSurvived ? "✓ " : ""}
              {statusLabel}
            </span>
          </div>

          <p
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              margin: "3px 0 0",
            }}
          >
            {contender.tagline}
          </p>
        </div>
      </div>

      {/* ── Elimination reason ── */}
      {isEliminated && contender.eliminationReason && (
        <div
          style={{
            padding: "9px 11px",
            borderRadius: "var(--radius-sm)",
            background: "rgba(239,68,68,0.07)",
            border: "1px solid rgba(239,68,68,0.22)",
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: "var(--s-failed)",
              flexShrink: 0,
              marginTop: 1,
              fontWeight: 700,
            }}
          >
            ✕
          </span>
          <span
            style={{
              fontSize: 11,
              color: "var(--s-failed)",
              lineHeight: 1.5,
              fontFamily: "var(--font-geist-mono, monospace)",
            }}
          >
            {contender.eliminationReason}
          </span>
        </div>
      )}

      {/* ── Final action (when survived or eliminated, non-running) ── */}
      {(isSurvived || isEliminated) && (
        <div
          style={{
            padding: "8px 10px",
            borderRadius: "var(--radius-sm)",
            background: "var(--bg-raised)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <span
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--text-muted)",
              display: "block",
              marginBottom: 3,
            }}
          >
            Outcome
          </span>
          <span
            style={{
              fontSize: 12,
              color: isSurvived ? "var(--text-secondary)" : "var(--s-failed)",
              fontFamily: "var(--font-geist-mono, monospace)",
              display: "block",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {contender.finalAction || "—"}
          </span>
        </div>
      )}

      {/* ── Acceptance test bar ── */}
      <TestBar passed={contender.testsPassed} total={contender.testsTotal} />

      {/* ── Metrics grid ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12,
          paddingTop: 4,
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <Metric label="Files Δ"    value={contender.filesChanged}   dim={isEliminated} />
        <Metric label="Lines Δ"    value={contender.linesChanged}   dim={isEliminated} />
        <Metric label="Agent Time" value={`${agentSec}s`}           dim={isEliminated} />
      </div>

      {/* ── Benchmarks (survived only) ── */}
      {!isEliminated && contender.benchmarks.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 12 }}>
          <span
            style={{
              fontSize: 10,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              display: "block",
              marginBottom: 8,
            }}
          >
            Implementation Benchmarks
          </span>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
            }}
          >
            {contender.benchmarks.map((b) => (
              <div
                key={b.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.06em",
                    color: "var(--text-muted)",
                    textTransform: "lowercase",
                  }}
                >
                  {b.label}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: "var(--font-geist-mono, monospace)",
                    color: "var(--text-primary)",
                    lineHeight: 1,
                  }}
                >
                  {b.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
