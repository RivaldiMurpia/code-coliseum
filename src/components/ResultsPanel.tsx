"use client";

import { useState } from "react";

import type {
  ContenderState,
  ContenderRole,
  Distinction,
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
  if (c.agentTimeMs <= 0) return { display: "—", raw: -1 };
  return { display: `${(c.agentTimeMs / 1000).toFixed(1)}s`, raw: c.agentTimeMs };
}

const COMPARISON_ROWS: CompareRow[] = [
  {
    label: "Files Changed",
    values: (c) => ({
      display: c.filesChanged > 0 ? String(c.filesChanged) : "—",
      raw: c.filesChanged,
    }),
    lowerIsBetter: true,
  },
  {
    label: "Lines Changed",
    values: (c) => ({
      display: c.linesChanged > 0 ? String(c.linesChanged) : "—",
      raw: c.linesChanged,
    }),
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
  // Only include contenders with real values (> 0 for sizes, > -1 for time)
  const candidates = nums.map((n, i) => {
    const hasValue = n > 0;
    if (!hasValue) return null;
    if (row.survivorsOnly && contenders[i].status !== "survived") return null;
    return n;
  });

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

interface DiffResponse {
  battleId: string;
  contenderId: string;
  filesChanged: number;
  files: string[];
  patch: string;
  truncated: boolean;
}

function DiffModal({
  contender,
  diff,
  onClose,
}: {
  contender: ContenderState;
  diff: DiffResponse;
  onClose: () => void;
}) {
  const color = ROLE_COLOR[contender.id];

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "rgba(0,0,0,0.62)",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="diff-modal-title"
        style={{
          width: "min(1100px, 100%)",
          maxHeight: "min(760px, calc(100vh - 48px))",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-card)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            display: "flex",
            alignItems: "flex-start",
            gap: 16,
            borderBottom: "1px solid var(--border-default)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              id="diff-modal-title"
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              {contender.label} Diff
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 11,
                color: "var(--text-secondary)",
                fontFamily: "var(--font-geist-mono, monospace)",
              }}
            >
              <span style={{ color }}>{diff.filesChanged}</span>{" "}
              file{diff.filesChanged === 1 ? "" : "s"} changed
              {diff.truncated ? " · output truncated" : ""}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              marginLeft: "auto",
              height: 30,
              padding: "0 10px",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-sm)",
              background: "var(--bg-raised)",
              color: "var(--text-secondary)",
              fontFamily: "var(--font-geist-mono, monospace)",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>

        <div
          style={{
            padding: "12px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          {diff.files.length > 0 ? (
            diff.files.map((file) => (
              <span
                key={file}
                style={{
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  padding: "3px 6px",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 3,
                  color: "var(--text-secondary)",
                  fontFamily: "var(--font-geist-mono, monospace)",
                  fontSize: 10,
                }}
              >
                {file}
              </span>
            ))
          ) : (
            <span
              style={{
                color: "var(--text-muted)",
                fontFamily: "var(--font-geist-mono, monospace)",
                fontSize: 11,
              }}
            >
              No changed files reported.
            </span>
          )}
        </div>

        <pre
          style={{
            margin: 0,
            padding: 20,
            minHeight: 0,
            overflowX: "auto",
            overflowY: "auto",
            whiteSpace: "pre",
            tabSize: 2,
            background: "var(--bg-base)",
            color: "var(--text-secondary)",
            fontFamily: "var(--font-geist-mono, monospace)",
            fontSize: 12,
            lineHeight: 1.55,
          }}
        >
          {diff.patch || "No tracked or untracked changes found."}
        </pre>
      </div>
    </div>
  );
}

/* ─── Survivor actions ──────────────────────────────────────────────────── */
function SurvivorActions({
  survivors,
  battleId,
  selectedContenderId,
  onSelect,
}: {
  survivors: ContenderState[];
  battleId: string | null;
  selectedContenderId?: ContenderRole;
  onSelect: (contenderId: ContenderRole) => void;
}) {
  const [loadingId, setLoadingId] = useState<ContenderRole | null>(null);
  const [selectingId, setSelectingId] = useState<ContenderRole | null>(null);
  const [applyingId, setApplyingId] = useState<ContenderRole | null>(null);
  const [diffData, setDiffData] = useState<DiffResponse | null>(null);
  const [diffContender, setDiffContender] = useState<ContenderState | null>(null);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState<{ filesChanged: number; files: string[] } | null>(null);

  async function inspectDiff(contender: ContenderState) {
    if (!battleId) return;

    setLoadingId(contender.id);
    setDiffError(null);

    try {
      const response = await fetch(
        `/api/battles/${encodeURIComponent(
          battleId
        )}/contenders/${encodeURIComponent(contender.id)}/diff`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to load diff");
      }

      const body = await response.json();
      setDiffData(body as DiffResponse);
      setDiffContender(contender);
    } catch (error) {
      setDiffError(
        error instanceof Error
          ? error.message
          : "Failed to load diff"
      );
    } finally {
      setLoadingId(null);
    }
  }

  async function selectContender(contender: ContenderState) {
    if (!battleId) return;

    setSelectingId(contender.id);
    setSelectionError(null);

    try {
      const response = await fetch(
        `/api/battles/${encodeURIComponent(battleId)}/select`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contenderId: contender.id }),
        }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to select candidate");
      }

      const body = await response.json();
      const echoed = body.selectedContenderId as ContenderRole | undefined;
      onSelect(echoed === contender.id ? echoed : contender.id);
    } catch (error) {
      setSelectionError(
        error instanceof Error ? error.message : "Failed to select candidate"
      );
    } finally {
      setSelectingId(null);
    }
  }

  async function applyContender(contender: ContenderState) {
    if (!battleId) return;

    setApplyingId(contender.id);
    setApplyError(null);
    setApplySuccess(null);

    try {
      const response = await fetch(
        `/api/battles/${encodeURIComponent(battleId)}/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to apply candidate");
      }

      const body = await response.json();
      setApplySuccess({
        filesChanged: body.filesChanged,
        files: body.files,
      });
    } catch (error) {
      setApplyError(
        error instanceof Error ? error.message : "Failed to apply candidate"
      );
    } finally {
      setApplyingId(null);
    }
  }

  const selectedContender = survivors.find((c) => c.id === selectedContenderId);

  if (survivors.length === 0) {
    return (
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
          padding: "16px 20px",
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
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "var(--radius-sm)",
            background: "rgba(239,68,68,0.06)",
            border: "1px solid rgba(239,68,68,0.2)",
            fontSize: 12,
            color: "var(--s-failed)",
            fontFamily: "var(--font-geist-mono, monospace)",
          }}
        >
          No contenders survived the Gauntlet — none can be selected.
        </div>
      </div>
    );
  }

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
      {diffError && (
        <div
          role="alert"
          style={{
            padding: "10px 12px",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "var(--radius-sm)",
            background: "rgba(239,68,68,0.08)",
            color: "var(--s-failed)",
            fontSize: 11,
            fontFamily: "var(--font-geist-mono, monospace)",
          }}
        >
          Failed to load diff: {diffError}
        </div>
      )}
      {selectionError && (
        <div
          role="alert"
          style={{
            padding: "10px 12px",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "var(--radius-sm)",
            background: "rgba(239,68,68,0.08)",
            color: "var(--s-failed)",
            fontSize: 11,
            fontFamily: "var(--font-geist-mono, monospace)",
          }}
        >
          Failed to select candidate: {selectionError}
        </div>
      )}
      {applyError && (
        <div
          role="alert"
          style={{
            padding: "10px 12px",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "var(--radius-sm)",
            background: "rgba(239,68,68,0.08)",
            color: "var(--s-failed)",
            fontSize: 11,
            fontFamily: "var(--font-geist-mono, monospace)",
          }}
        >
          Failed to apply candidate: {applyError}
        </div>
      )}
      {applySuccess && (
        <div
          role="status"
          style={{
            padding: "12px 16px",
            border: "1px solid rgba(34,197,94,0.3)",
            borderRadius: "var(--radius-sm)",
            background: "rgba(34,197,94,0.08)",
            color: "var(--s-done)",
            fontSize: 12,
            fontFamily: "var(--font-geist-mono, monospace)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13 }}>✓</span>
            <span style={{ fontWeight: 700 }}>APPLIED TO WORKING TREE</span>
          </div>
          <div style={{ marginTop: 8, color: "var(--text-secondary)" }}>
            {applySuccess.filesChanged} file{applySuccess.filesChanged === 1 ? "" : "s"} applied
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
            Review the changes locally and commit when ready.
          </div>
        </div>
      )}
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
                {selectedContenderId === c.id && (
                  <span
                    style={{
                      color,
                      fontFamily: "var(--font-geist-mono, monospace)",
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                    }}
                  >
                    SELECTED FOR MERGE
                  </span>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 8 }}>
                {/* Inspect Diff */}
                <button
                  type="button"
                  disabled={!battleId || loadingId === c.id}
                  onClick={() => inspectDiff(c)}
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
                    cursor:
                    !battleId || loadingId === c.id
                    ? "not-allowed"
                    : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M2 3h8M2 6h8M2 9h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  {loadingId === c.id ? "Loading..." : "Inspect Diff"}
                </button>

                {/* Choose Candidate */}
                <button
                  type="button"
                  disabled={!battleId || selectingId !== null}
                  onClick={() => void selectContender(c)}
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
                    cursor: !battleId || selectingId !== null ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {selectingId === c.id
                    ? "Selecting..."
                    : selectedContenderId === c.id
                    ? "✓ Selected"
                    : "Choose Candidate"}
                </button>

                {/* Apply Candidate */}
                {selectedContenderId === c.id && (
                  <button
                    type="button"
                    disabled={!battleId || applyingId !== null}
                    onClick={() => void applyContender(c)}
                    style={{
                      height: 32,
                      padding: "0 14px",
                      borderRadius: "var(--radius-sm)",
                      border: `1px solid ${color}`,
                      background: color,
                      color: "#fff",
                      fontFamily: "var(--font-geist-mono, monospace)",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      cursor: !battleId || applyingId !== null ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path d="M10 2L2 10M2 2l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {applyingId === c.id ? "Applying..." : "Apply Candidate"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {selectedContender && (
        <div
          style={{
            paddingTop: 12,
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <span
            style={{
              color: ROLE_COLOR[selectedContender.id],
              fontFamily: "var(--font-geist-mono, monospace)",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.1em",
            }}
          >
            SELECTED FOR MERGE
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
            {selectedContender.label}
          </span>
          <span
            style={{
              color: "var(--text-secondary)",
              fontFamily: "var(--font-geist-mono, monospace)",
              fontSize: 11,
            }}
          >
            All Gauntlet checks passed · {selectedContender.linesChanged} lines changed
          </span>
        </div>
      )}
      {diffData && diffContender && (
        <DiffModal
          contender={diffContender}
          diff={diffData}
          onClose={() => {
            setDiffData(null);
            setDiffContender(null);
          }}
        />
      )}
    </div>
  );
}

/* ─── ResultsPanel ──────────────────────────────────────────────────────── */
interface ResultsPanelProps {
  contenders: ContenderState[];
  distinctions: Distinction[];
  battleId: string | null;
  selectedContenderId?: ContenderRole;
  onSelect: (contenderId: ContenderRole) => void;
}

export default function ResultsPanel({
  contenders,
  distinctions,
  battleId,
  selectedContenderId,
  onSelect,
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

        {/* ── Survivors note ── */}
        {survivors.length > 0 && (
          <div
            style={{
              marginBottom: 16,
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              background: "rgba(34,197,94,0.06)",
              border: "1px solid rgba(34,197,94,0.2)",
              fontSize: 12,
              color: "var(--s-done)",
              fontFamily: "var(--font-geist-mono, monospace)",
            }}
          >
            {survivors.length === 1
              ? "1 contender survived the Gauntlet — it is a valid candidate."
              : survivors.length === 2
              ? "2 contenders survived the Gauntlet — both are valid candidates."
              : `${survivors.length} contenders survived the Gauntlet — all are valid candidates.`}{" "}
            Review the diff before choosing one.
          </div>
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
        <SurvivorActions
          survivors={survivors}
          battleId={battleId}
          selectedContenderId={selectedContenderId}
          onSelect={onSelect}
        />
      </div>
    </section>
  );
}
