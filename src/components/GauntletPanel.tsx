import type { ContenderState, ContenderRole, GauntletCheckId, GauntletResult } from "@/lib/types";

/* ─── Real check definitions (match gauntlet.ts IDs) ────────────────────── */
const CHECKS: { id: GauntletCheckId; label: string }[] = [
  { id: "dep-integrity", label: "Dependency Integrity" },
  { id: "type-safety",   label: "Type Safety"          },
  { id: "build",         label: "Production Build"     },
  { id: "acceptance",    label: "Acceptance Test"      },
];

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

/* ─── Cell ──────────────────────────────────────────────────────────────── */
function ResultCell({ result, isEliminated }: { result: GauntletResult; isEliminated?: boolean }) {
  if (result === "pass") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          fontFamily: "var(--font-geist-mono, monospace)",
          fontSize: 12,
          fontWeight: 700,
          color: "var(--s-done)",
          letterSpacing: "0.04em",
          padding: "3px 8px",
          borderRadius: 6,
          background: isEliminated ? "rgba(34,197,94,0.1)" : "rgba(34,197,94,0.12)",
          border: "1px solid rgba(34,197,94,0.25)",
        }}
      >
        <span style={{ fontSize: 10 }}>✓</span>
        <span>PASS</span>
      </span>
    );
  }
  if (result === "fail") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          fontFamily: "var(--font-geist-mono, monospace)",
          fontSize: 12,
          fontWeight: 700,
          color: "var(--s-failed)",
          letterSpacing: "0.04em",
          padding: "3px 8px",
          borderRadius: 6,
          background: "rgba(239,68,68,0.12)",
          border: "1px solid rgba(239,68,68,0.3)",
        }}
      >
        <span style={{ fontSize: 10 }}>✕</span>
        <span>FAIL</span>
      </span>
    );
  }
  return (
    <span
      style={{
        fontFamily: "var(--font-geist-mono, monospace)",
        fontSize: 12,
        color: "var(--text-disabled)",
        letterSpacing: "0.04em",
        padding: "3px 8px",
        borderRadius: 6,
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      —
    </span>
  );
}

/* ─── GauntletPanel ─────────────────────────────────────────────────────── */
interface GauntletPanelProps {
  contenders: ContenderState[];
}

export default function GauntletPanel({ contenders }: GauntletPanelProps) {
  const hasContenders = contenders.length > 0;

  if (!hasContenders) {
    return (
      <section style={{ padding: "0 24px 32px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-lg)",
              padding: "40px 24px",
              textAlign: "center",
            }}
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 48 48"
              fill="none"
              aria-hidden="true"
              style={{ color: "var(--text-disabled)", marginBottom: 12 }}
            >
              <rect x="6" y="14" width="36" height="24" rx="4"
                stroke="currentColor" strokeWidth="1.5" fill="none" />
              <line x1="15" y1="14" x2="15" y2="38" stroke="currentColor" strokeWidth="1.5" />
              <line x1="24" y1="14" x2="24" y2="38" stroke="currentColor" strokeWidth="1.5" />
              <line x1="33" y1="14" x2="33" y2="38" stroke="currentColor" strokeWidth="1.5" />
              <line x1="6" y1="26" x2="42" y2="26" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <div
              style={{
                fontFamily: "var(--font-geist-mono, monospace)",
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--text-secondary)",
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              Gauntlet
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              No contenders yet. Start a battle to see Gauntlet results.
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section style={{ padding: "0 24px 32px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
          }}
        >
          {/* ── Panel header ── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 18px",
              borderBottom: "1px solid var(--border-default)",
              background: "var(--bg-raised)",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
              style={{ color: "var(--accent)" }}
            >
              <rect x="1" y="3" width="14" height="10" rx="2"
                stroke="currentColor" strokeWidth="1.2" fill="none" />
              <line x1="4.5" y1="3" x2="4.5" y2="13" stroke="currentColor" strokeWidth="1.2" />
              <line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" strokeWidth="1.2" />
              <line x1="11.5" y1="3" x2="11.5" y2="13" stroke="currentColor" strokeWidth="1.2" />
              <line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            <span
              style={{
                fontFamily: "var(--font-geist-mono, monospace)",
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--text-secondary)",
                fontWeight: 600,
              }}
            >
              Gauntlet
            </span>
            <span
              style={{
                marginLeft: "auto",
                fontSize: 10,
                fontFamily: "var(--font-geist-mono, monospace)",
                color: "var(--text-muted)",
                letterSpacing: "0.04em",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ color: "var(--s-done)" }}>✓ PASS</span>
              <span style={{ color: "var(--text-disabled)" }}>|</span>
              <span style={{ color: "var(--s-failed)" }}>✕ FAIL</span>
              <span style={{ color: "var(--text-disabled)" }}>|</span>
              <span>All checks must pass to survive</span>
            </span>
          </div>

          {/* ── Column headers: check label + one col per contender ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `200px repeat(${contenders.length}, 1fr)`,
              borderBottom: "1px solid var(--border-default)",
              background: "var(--bg-surface)",
            }}
          >
            {/* Empty corner */}
            <div style={{ padding: "12px 18px" }} />

            {/* Contender column headers */}
            {contenders.map((c) => {
              const isElim = c.status === "eliminated" || c.status === "failed";
              const isSurvived = c.status === "survived";
              const color = ROLE_COLOR[c.id];
              return (
                <div
                  key={c.id}
                  style={{
                    padding: "12px 18px",
                    borderLeft: "1px solid var(--border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    opacity: isElim ? 0.6 : 1,
                    background: isSurvived ? `${color}08` : "transparent",
                  }}
                >
                  <span style={{ fontSize: 14, color: isElim ? "var(--text-muted)" : color }}>
                    {ROLE_ICON[c.id]}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: isElim ? "var(--text-muted)" : color,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {c.label}
                  </span>
                  {isSurvived && (
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 9,
                        fontFamily: "var(--font-geist-mono, monospace)",
                        color: "var(--s-done)",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        padding: "1px 6px",
                        borderRadius: 3,
                        background: "rgba(34,197,94,0.12)",
                        border: "1px solid rgba(34,197,94,0.25)",
                      }}
                    >
                      SURVIVED
                    </span>
                  )}
                  {isElim && (
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 9,
                        fontFamily: "var(--font-geist-mono, monospace)",
                        color: "var(--s-failed)",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        padding: "1px 6px",
                        borderRadius: 3,
                        background: "rgba(239,68,68,0.12)",
                        border: "1px solid rgba(239,68,68,0.25)",
                      }}
                    >
                      ELIMINATED
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Rows ── */}
          {CHECKS.map((check, ci) => (
            <div
              key={check.id}
              style={{
                display: "grid",
                gridTemplateColumns: `200px repeat(${contenders.length}, 1fr)`,
                borderBottom:
                  ci < CHECKS.length - 1 ? "1px solid var(--border-subtle)" : "none",
                background: ci % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
              }}
            >
              {/* Check label */}
              <div
                style={{
                  padding: "14px 18px",
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  display: "flex",
                  alignItems: "center",
                  fontWeight: 500,
                }}
              >
                {check.label}
              </div>

              {/* Per-contender result */}
              {contenders.map((c) => {
                const result = c.gauntlet[check.id];
                const isFailedRow = result === "fail";
                const isPassedRow = result === "pass";
                const isElim = c.status === "eliminated" || c.status === "failed";
                return (
                  <div
                    key={c.id}
                    style={{
                      padding: "12px 18px",
                      borderLeft: "1px solid var(--border-subtle)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: isFailedRow
                        ? "rgba(239,68,68,0.08)"
                        : isPassedRow
                        ? "rgba(34,197,94,0.05)"
                        : "transparent",
                    }}
                  >
                    <ResultCell result={result} isEliminated={isElim} />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
