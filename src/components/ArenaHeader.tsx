export default function ArenaHeader() {
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
          padding: "0 24px",
          height: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
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
            gap: 6,
            padding: "4px 10px",
            borderRadius: 20,
            border: "1px solid var(--border-default)",
            background: "var(--bg-raised)",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--s-done)",
              display: "inline-block",
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontFamily: "var(--font-geist-mono, monospace)",
              color: "var(--text-secondary)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Battle complete
          </span>
        </div>
      </div>
    </header>
  );
}
