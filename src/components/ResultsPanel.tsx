import type {
  ContenderState,
  ContenderRole,
  Distinction,
  BenchmarkResult,
} from "@/lib/types";

/* ─── Shared colour maps ────────────────────────────────────────────────── */
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

/* ─── Comparison rows ───────────────────────────────────────────────────── */
interface CompareRow {
  label: string;
  values: (c: ContenderState) => { display: string; raw: number };
  lowerIsBetter?: boolean;
  /** if true, only survivors appear in this row's best-highlight */
  survivorsOnly?: boolean;
}

function agentTimeSec(c: ContenderState) {
  return { display: `${(c.agentTimeMs / 1000).toFixed(1)}s`, raw: c.agentTimeMs };
}

const COMPARISON_ROWS: CompareRow[] = [
  {
    label: "Acceptance Tests",
    values: (c) => ({ display: `${c.testsPassed}/${c.testsTotal}`, raw: c.testsPassed }),
  },
  {
    label: "Files Changed",
    values: (c) => ({ display: String(c.filesChanged), raw: c.filesChanged }),
    lowerIsBetter: true,
  },
  {
    label: "Lines Changed",
    values: (c) => ({ display: String(c.linesChanged), raw: c.linesChanged }),
    lowerIsBetter: true,
  },
  {
    label: "Agent Time",
    values: agentTimeSec,
    lowerIsBetter: true,
  },
];

/* ─── Best-index helper ─────────────────────────────────────────────────── */
function getBestIndices(
  contenders: ContenderState[],
  row: CompareRow
): Set<number> {
  const nums = contenders.map((c) => row.values(c).raw);
  const candidates = row.survivorsOnly
    ? nums.map((n, i) =>
        contenders[i].status === "survived" ? n : null
      )
    : nums;

  const filtered = candidates.filter((n) => n !== null) as number[];
  if (filtered.length === 0) return new Set();

  const target = row.lowerIsBetter
    ? Math.min(...filtered)
    : Math.max(...filtered);

  const best = new Set<number>();
  candidates.forEach((n, i) => { if (n === target) best.add(i); });
  return best;
}

/* ─── Distinction badge ─────────────────────────────────────────────────── */
function DistinctionBadge({ d }: { d: Distinction }) {
  const color = ROLE_COLOR[d.contenderId];
  const icon = ROLE_ICON[d.contenderId];
  return (
    <div
      style={{
        background: `${color}0d`,
        border: `1px solid ${color}30`,
        borderRadius: "var(--radius-md)",
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span style={{ fontSize: 13, color, lineHeight: 1 }}>{icon}</span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {d.label}
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 10,
            fontFamily: "var(--font-geist-mono, monospace)",
            color: "var(--text-muted)",
          }}
        >
          → {d.contenderId}
        </span>
      </div>
      <p
        style={{
          fontSize: 11,
          color: "var(--text-secondary)",
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        {d.evidence}
      </p>
    </div>
  );
}

/* ─── Benchmark comparison table ────────────────────────────────────────── */
function BenchmarkTable({
  survivors,
}: {
  survivors: ContenderState[];
}) {
  if (survivors.length === 0) return null;

  // Collect all unique benchmark labels from first survivor (all survivors have same set)
  const labels: string[] = survivors[0].benchmarks.map((b) => b.label);

  // Build lookup: contenderId → label → BenchmarkResult
  const lookup: Record<string, Record<string, BenchmarkResult>> = {};
  survivors.forEach((c) => {
    lookup[c.id] = {};
    c.benchmarks.forEach((b) => { lookup[c.id][b.label] = b; });
  });

  function getBestBenchIdx(label: string): Set<number> {
    const first = survivors[0].benchmarks.find((b) => b.label === label);
    if (!first) return new Set();
    const raws = survivors.map((c) => lookup[c.id][label]?.raw ?? 0);
    const target = first.lowerIsBetter ? Math.min(...raws) : Math.max(...raws);
    const best = new Set<number>();
    raws.forEach((r, i) => { if (r === target) best.add(i); });
    return best;
  }

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        marginBottom: 16,
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `160px repeat(${survivors.length}, 1fr)`,
          background: "var(--bg-raised)",
          borderBottom: "1px solid var(--border-default)",
        }}
      >
        <div
          style={{
            padding: "10px 16px",
            fontSize: 10,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            fontFamily: "var(--font-geist-mono, monospace)",
          }}
        >
          Benchmark
        </div>
        {survivors.map((c) => (
          <div
            key={c.id}
            style={{
              padding: "10px 16px",
              borderLeft: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ fontSize: 12, color: ROLE_COLOR[c.id] }}>
              {ROLE_ICON[c.id]}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: ROLE_COLOR[c.id],
                letterSpacing: "0.02em",
              }}
            >
              {c.label}
            </span>
          </div>
        ))}
      </div>

      {/* Benchmark rows */}
      {labels.map((label, li) => {
        const bestSet = getBestBenchIdx(label);
        return (
          <div
            key={label}
            style={{
              display: "grid",
              gridTemplateColumns: `160px repeat(${survivors.length}, 1fr)`,
              borderBottom:
                li < labels.length - 1 ? "1px solid var(--border-subtle)" : "none",
            }}
          >
            <div
              style={{
                padding: "11px 16px",
                fontSize: 12,
                color: "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
              }}
            >
              {label}
            </div>
            {survivors.map((c, ci) => {
              const b = lookup[c.id][label];
              const isBest = bestSet.has(ci);
              const color = ROLE_COLOR[c.id];
              return (
                <div
                  key={c.id}
                  style={{
                    padding: "11px 16px",
                    borderLeft: "1px solid var(--border-subtle)",
                    fontFamily: "var(--font-geist-mono, monospace)",
                    fontSize: 13,
                    fontWeight: isBest ? 700 : 400,
                    color: isBest ? color : "var(--text-secondary)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: isBest ? `${color}08` : "transparent",
                  }}
                >
                  {b?.value ?? "—"}
                  {isBest && (
                    <span
                      style={{
                        fontSize: 8,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color,
                        opacity: 0.8,
                      }}
                    >
                      ▲
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/* ─── General comparison table ──────────────────────────────────────────── */
function ComparisonTable({ contenders }: { contenders: ContenderState[] }) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `180px repeat(${contenders.length}, 1fr)`,
          background: "var(--bg-raised)",
          borderBottom: "1px solid var(--border-default)",
        }}
      >
        <div
          style={{
            padding: "10px 16px",
            fontSize: 10,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            fontFamily: "var(--font-geist-mono, monospace)",
          }}
        >
          Metric
        </div>
        {contenders.map((c) => {
          const isElim = c.status === "eliminated" || c.status === "failed";
          return (
            <div
              key={c.id}
              style={{
                padding: "10px 16px",
                borderLeft: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                gap: 6,
                opacity: isElim ? 0.55 : 1,
              }}
            >
              <span style={{ fontSize: 12, color: ROLE_COLOR[c.id] }}>
                {ROLE_ICON[c.id]}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: isElim ? "var(--text-muted)" : ROLE_COLOR[c.id],
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
                    border: "1px solid var(--s-failed)40",
                    borderRadius: 3,
                    padding: "1px 5px",
                  }}
                >
                  elim.
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Rows */}
      {COMPARISON_ROWS.map((row, ri) => {
        const bestSet = getBestIndices(contenders, row);
        return (
          <div
            key={row.label}
            style={{
              display: "grid",
              gridTemplateColumns: `180px repeat(${contenders.length}, 1fr)`,
              borderBottom:
                ri < COMPARISON_ROWS.length - 1
                  ? "1px solid var(--border-subtle)"
                  : "none",
            }}
          >
            <div
              style={{
                padding: "12px 16px",
                fontSize: 12,
                color: "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
              }}
            >
              {row.label}
            </div>
            {contenders.map((c, ci) => {
              const isElim = c.status === "eliminated" || c.status === "failed";
              const isBest = bestSet.has(ci);
              const color = ROLE_COLOR[c.id];
              const { display } = row.values(c);
              return (
                <div
                  key={c.id}
                  style={{
                    padding: "12px 16px",
                    borderLeft: "1px solid var(--border-subtle)",
                    fontFamily: "var(--font-geist-mono, monospace)",
                    fontSize: 13,
                    fontWeight: isBest ? 700 : 400,
                    color: isElim
                      ? "var(--text-disabled)"
                      : isBest
                      ? color
                      : "var(--text-secondary)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background:
                      isBest && !isElim ? `${color}08` : "transparent",
                  }}
                >
                  {display}
                  {isBest && !isElim && (
                    <span
                      style={{
                        fontSize: 8,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color,
                        opacity: 0.8,
                      }}
                    >
                      ▲
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Survivor actions ──────────────────────────────────────────────────── */
function SurvivorActions({ survivors }: { survivors: ContenderState[] }) {
  if (survivors.length === 0) return null;
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        marginTop: 16,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          fontFamily: "var(--font-geist-mono, monospace)",
          marginBottom: 4,
        }}
      >
        Developer Actions
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {survivors.map((c) => {
          const color = ROLE_COLOR[c.id];
          const icon = ROLE_ICON[c.id];
          return (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              {/* Identity */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  minWidth: 120,
                }}
              >
                <span style={{ color, fontSize: 13 }}>{icon}</span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}
                >
                  {c.label}
                </span>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 8 }}>
                {/* Inspect Diff */}
                <button
                  disabled
                  style={{
                    height: 32,
                    padding: "0 14px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-default)",
                    background: "var(--bg-raised)",
                    color: "var(--text-secondary)",
                    fontFamily: "var(--font-geist-mono, monospace)",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    cursor: "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M2 3h8M2 6h8M2 9h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  Inspect Diff
                </button>

                {/* Choose Candidate */}
                <button
                  disabled
                  style={{
                    height: 32,
                    padding: "0 14px",
                    borderRadius: "var(--radius-sm)",
                    border: `1px solid ${color}50`,
                    background: `${color}10`,
                    color,
                    fontFamily: "var(--font-geist-mono, monospace)",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    cursor: "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Choose Candidate
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── ResultsPanel ──────────────────────────────────────────────────────── */
interface ResultsPanelProps {
  contenders: ContenderState[];
  distinctions: Distinction[];
}

export default function ResultsPanel({
  contenders,
  distinctions,
}: ResultsPanelProps) {
  const survivors = contenders.filter((c) => c.status === "survived");

  return (
    <section style={{ padding: "0 24px 48px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* ── Section label ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 20,
          }}
        >
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
          <div
            style={{ flex: 1, height: 1, background: "var(--border-subtle)" }}
          />
        </div>

        {/* ── Distinctions ── */}
        {distinctions.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 12,
              marginBottom: 20,
            }}
          >
            {distinctions.map((d) => (
              <DistinctionBadge key={d.label} d={d} />
            ))}
          </div>
        )}

        {/* ── Sub-label: Implementation Benchmarks ── */}
        {survivors.length >= 2 && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-geist-mono, monospace)",
                  fontSize: 10,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                }}
              >
                Implementation Benchmarks
              </span>
              <div
                style={{ flex: 1, height: 1, background: "var(--border-subtle)" }}
              />
              <span
                style={{
                  fontSize: 10,
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-geist-mono, monospace)",
                }}
              >
                Survivors only
              </span>
            </div>
            <BenchmarkTable survivors={survivors} />
          </>
        )}

        {/* ── Sub-label: Full Comparison ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-geist-mono, monospace)",
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            Full Comparison
          </span>
          <div
            style={{ flex: 1, height: 1, background: "var(--border-subtle)" }}
          />
        </div>

        <ComparisonTable contenders={contenders} />

        {/* ── Developer actions ── */}
        <SurvivorActions survivors={survivors} />
      </div>
    </section>
  );
}
