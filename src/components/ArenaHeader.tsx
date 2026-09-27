export type BadgePhase =
  | "ready"
  | "preparing"
  | "running"
  | "judging"
  | "complete"
  | "failed";

const BADGE_LABEL: Record<BadgePhase, string> = {
  ready:    "Ready",
  preparing: "Preparing Arena",
  running:  "Battle Running",
  judging:  "Judging",
  complete: "Battle Complete",
  failed:   "Battle Failed",
};

const BADGE_COLOR: Record<BadgePhase, string> = {
  ready:    "var(--text-muted)",
  preparing: "var(--s-running, #3b82f6)",
  running:  "var(--s-running, #3b82f6)",
  judging:  "var(--c-sprinter, #f59e0b)",
  complete: "var(--s-done)",
  failed:   "var(--s-failed)",
};

interface ArenaHeaderProps {
  phase: BadgePhase;
}

export default function ArenaHeader({ phase }: ArenaHeaderProps) {
  const dotColor = BADGE_COLOR[phase];
  const label = BADGE_LABEL[phase];

  return (
    <header
      style={{
        borderBottom: "1px solid var(--border-subtle)",
        background: "var(--bg-surface)",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: `0 ${"var(--space-lg)"}`,
          height: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-lg)",
        }}
      >
        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Coliseum glyph */}
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            fill="none"
            aria-hidden="true"
          >
            {/* Base arc */}
            <path
              d="M4 20 Q4 8 14 8 Q24 8 24 20"
              stroke="var(--accent)"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
            />
            {/* Inner arc */}
            <path
              d="M7 20 Q7 11 14 11 Q21 11 21 20"
              stroke="var(--accent)"
              strokeWidth="1"
              fill="none"
              strokeLinecap="round"
              opacity="0.6"
            />
            {/* Columns */}
            <line x1="6"  y1="20" x2="6"  y2="23" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="10" y1="20" x2="10" y2="23" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="14" y1="20" x2="14" y2="23" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="18" y1="20" x2="18" y2="23" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="22" y1="20" x2="22" y2="23" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
            {/* Base line */}
            <line x1="3"  y1="23" x2="25" y2="23" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>

          <div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 0,
                lineHeight: 1,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-geist-mono, monospace)",
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  color: "var(--text-primary)",
                  textTransform: "uppercase",
                }}
              >
                Code
              </span>
              <span
                style={{
                  fontFamily: "var(--font-geist-mono, monospace)",
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  color: "var(--accent)",
                  textTransform: "uppercase",
                  marginLeft: 5,
                }}
              >
                Coliseum
              </span>
            </div>
            <p
              style={{
                fontSize: 10,
                color: "var(--text-muted)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                marginTop: 2,
                lineHeight: 1,
              }}
            >
              Make your AI earn the merge.
            </p>
          </div>
        </div>

        {/* Status pill — shows current battle phase */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "5px 12px",
            borderRadius: 20,
            border: "1px solid var(--border-default)",
            background: "var(--bg-raised)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: dotColor,
              display: "inline-block",
              boxShadow: `0 0 6px ${dotColor}80`,
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontFamily: "var(--font-geist-mono, monospace)",
              color: "var(--text-secondary)",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            {label}
          </span>
        </div>
      </div>
    </header>
  );
}
