import type { ContenderState, ContenderRole, GauntletCheckId, GauntletResult } from "@/lib/types";

/* ─── Check definitions ─────────────────────────────────────────────────── */
const CHECKS: { id: GauntletCheckId; label: string }[] = [
  { id: "build",               label: "Build"              },
  { id: "existing-tests",      label: "Existing Tests"     },
  { id: "acceptance-tests",    label: "Acceptance Tests"   },
  { id: "typescript-strict",   label: "TypeScript Strict"  },
  { id: "no-new-deps",         label: "No New Dependencies"},
  { id: "api-compatibility",   label: "API Compatibility"  },
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
function ResultCell({ result }: { result: GauntletResult }) {
  if (result === "pass") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontFamily: "var(--font-geist-mono, monospace)",
          fontSize: 11,
          fontWeight: 700,
          color: "var(--s-done)",
          letterSpacing: "0.04em",
        }}
      >
        ✓ pass
      </span>
    );
  }
  if (result === "fail") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontFamily: "var(--font-geist-mono, monospace)",
          fontSize: 11,
          fontWeight: 700,
          color: "var(--s-failed)",
          letterSpacing: "0.04em",
        }}
      >
        ✕ fail
      </span>
    );
  }
  return (
    <span
      style={{
        fontFamily: "var(--font-geist-mono, monospace)",
        fontSize: 11,
        color: "var(--text-disabled)",
        letterSpacing: "0.04em",
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
              padding: "12px 16px",
              borderBottom: "1px solid var(--border-default)",
              background: "var(--bg-raised)",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
            >
              <rect x="1" y="3" width="12" height="8" rx="2"
                stroke="var(--accent)" strokeWidth="1.2" fill="none" />
              <line x1="4" y1="3" x2="4" y2="11" stroke="var(--accent)" strokeWidth="1.2" />
              <line x1="7" y1="3" x2="7" y2="11" stroke="var(--accent)" strokeWidth="1.2" />
              <line x1="10" y1="3" x2="10" y2="11" stroke="var(--accent)" strokeWidth="1.2" />
              <line x1="1" y1="7" x2="13" y2="7" stroke="var(--accent)" strokeWidth="1.2" />
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
              }}
            >
              All checks must pass to survive
            </span>
          </div>

          {/* ── Column headers: check label + one col per contender ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `180px repeat(${contenders.length}, 1fr)`,
              borderBottom: "1px solid var(--border-default)",
              background: "var(--bg-surface)",
            }}
          >
            {/* Empty corner */}
            <div style={{ padding: "10px 16px" }} />

            {/* Contender column headers */}
            {contenders.map((c) => {
              const isElim = c.status === "eliminated" || c.status === "failed";
              const color = ROLE_COLOR[c.id];
              return (
                <div
                  key={c.id}
                  style={{
                    padding: "10px 16px",
                    borderLeft: "1px solid var(--border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    opacity: isElim ? 0.5 : 1,
                  }}
                >
                  <span style={{ fontSize: 12, color: isElim ? "var(--text-muted)" : color }}>
                    {ROLE_ICON[c.id]}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: isElim ? "var(--text-muted)" : color,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {c.label}
                  </span>
                  {isElim && (
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 9,
                        fontFamily: "var(--font-geist-mono, monospace)",
                        color: "var(--s-failed)",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}
                    >
                      elim.
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
                gridTemplateColumns: `180px repeat(${contenders.length}, 1fr)`,
                borderBottom:
                  ci < CHECKS.length - 1 ? "1px solid var(--border-subtle)" : "none",
              }}
            >
              {/* Check label */}
              <div
                style={{
                  padding: "11px 16px",
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {check.label}
              </div>

              {/* Per-contender result */}
              {contenders.map((c) => {
                const result = c.gauntlet[check.id];
                const isFailedRow = result === "fail";
                return (
                  <div
                    key={c.id}
                    style={{
                      padding: "11px 16px",
                      borderLeft: "1px solid var(--border-subtle)",
                      display: "flex",
                      alignItems: "center",
                      background: isFailedRow
                        ? "rgba(239,68,68,0.05)"
                        : "transparent",
                    }}
                  >
                    <ResultCell result={result} />
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
