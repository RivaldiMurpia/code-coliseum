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
  idle:              "Idle",
  waiting:           "Waiting",
  preparing:         "Preparing workspace",
  ready:             "Ready",
  implementing:      "Implementing",
  "entering-gauntlet": "Entering Gauntlet",
  survived:          "Survived",
  eliminated:        "Eliminated",
  failed:            "Failed",
};

const STATUS_COLOR: Record<ContenderState["status"], string> = {
  idle:              "var(--s-idle)",
  waiting:           "var(--s-idle)",
  preparing:         "var(--s-running)",
  ready:             "var(--s-running)",
  implementing:      "var(--s-running)",
  "entering-gauntlet": "var(--s-running)",
  survived:          "var(--s-done)",
  eliminated:        "var(--s-failed)",
  failed:            "var(--s-failed)",
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

/* ─── ContenderCard ─────────────────────────────────────────────────────── */
interface ContenderCardProps {
  contender: ContenderState;
}

export default function ContenderCard({ contender }: ContenderCardProps) {
  const color = ROLE_COLOR[contender.id];
  const icon = ROLE_ICON[contender.id];
  const statusLabel = STATUS_LABEL[contender.status];
  const statusColor = STATUS_COLOR[contender.status];
  const isEliminated =
    contender.status === "eliminated" || contender.status === "failed";
  const isSurvived = contender.status === "survived";
  const isRunning =
    contender.status === "implementing" ||
    contender.status === "entering-gauntlet";

  const agentSec =
    contender.agentTimeMs > 0
      ? `${(contender.agentTimeMs / 1000).toFixed(1)}s`
      : "—";

  const filesDisplay =
    contender.filesChanged > 0 ? String(contender.filesChanged) : "—";
  const linesDisplay =
    contender.linesChanged > 0 ? String(contender.linesChanged) : "—";

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
                color: isEliminated
                  ? "var(--text-secondary)"
                  : "var(--text-primary)",
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

      {/* ── Current action / outcome ── */}
      {contender.currentAction && (
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
            {isRunning ? "Current Action" : "Outcome"}
          </span>
          <span
            style={{
              fontSize: 12,
              color: isSurvived
                ? "var(--text-secondary)"
                : isEliminated
                ? "var(--s-failed)"
                : "var(--text-secondary)",
              fontFamily: "var(--font-geist-mono, monospace)",
              display: "block",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {contender.currentAction}
          </span>
        </div>
      )}

      {/* ── Acceptance indicator ── */}
      {contender.acceptancePassed !== null && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontSize: 11,
              fontFamily: "var(--font-geist-mono, monospace)",
              color: contender.acceptancePassed
                ? "var(--s-done)"
                : "var(--s-failed)",
              fontWeight: 700,
            }}
          >
            {contender.acceptancePassed ? "✓" : "✕"}
          </span>
          <span
            style={{
              fontSize: 11,
              color: contender.acceptancePassed
                ? "var(--s-done)"
                : "var(--s-failed)",
            }}
          >
            Acceptance Test
          </span>
        </div>
      )}

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
        <Metric label="Files Δ"    value={filesDisplay}  dim={isEliminated} />
        <Metric label="Lines Δ"    value={linesDisplay}  dim={isEliminated} />
        <Metric label="Agent Time" value={agentSec}      dim={isEliminated} />
      </div>
    </article>
  );
}
