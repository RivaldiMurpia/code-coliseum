"use client";

import { useState } from "react";
import type { BattleState } from "@/lib/types";

interface BattleFormProps {
  value: string;
  phase: BattleState["phase"];
  onChange: (v: string) => void;
  onStart: () => void;
}

export default function BattleForm({
  value,
  phase,
  onChange,
  onStart,
}: BattleFormProps) {
  const [focused, setFocused] = useState(false);
  const isRunning = phase === "running";
  const isComplete = phase === "complete";

  return (
    <section
      style={{
        borderBottom: "1px solid var(--border-subtle)",
        background: "var(--bg-surface)",
        padding: "32px 24px",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Section label */}
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
            Feature Request
          </span>
          <div
            style={{
              flex: 1,
              height: 1,
              background: "var(--border-subtle)",
            }}
          />
        </div>

        {/* Input row */}
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
          }}
          className="battle-form-row"
        >
          {/* Textarea */}
          <div
            style={{
              flex: 1,
              position: "relative",
              borderRadius: "var(--radius-md)",
              border: `1px solid ${focused ? "var(--accent)" : "var(--border-default)"}`,
              background: "var(--bg-raised)",
              transition: "border-color 0.15s",
              boxShadow: focused ? "0 0 0 3px var(--accent-glow)" : "none",
            }}
          >
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              disabled={isRunning}
              rows={3}
              placeholder="Describe the feature to implement. Be specific — the agents will compete to build it."
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                outline: "none",
                padding: "12px 14px",
                color: isRunning ? "var(--text-muted)" : "var(--text-primary)",
                fontFamily: "var(--font-geist-sans, sans-serif)",
                fontSize: 14,
                lineHeight: 1.6,
                resize: "vertical",
                minHeight: 72,
                cursor: isRunning ? "not-allowed" : "text",
              }}
            />
          </div>

          {/* Start button */}
          <button
            onClick={onStart}
            disabled={isRunning || value.trim().length === 0}
            style={{
              flexShrink: 0,
              height: 44,
              padding: "0 22px",
              borderRadius: "var(--radius-md)",
              border: "1px solid transparent",
              background:
                isRunning || value.trim().length === 0
                  ? "var(--bg-card)"
                  : "var(--accent)",
              color:
                isRunning || value.trim().length === 0
                  ? "var(--text-muted)"
                  : "#fff",
              fontFamily: "var(--font-geist-sans, sans-serif)",
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.02em",
              cursor:
                isRunning || value.trim().length === 0
                  ? "not-allowed"
                  : "pointer",
              transition: "background 0.15s, opacity 0.15s",
              whiteSpace: "nowrap",
              alignSelf: "flex-start",
              marginTop: 0,
            }}
          >
            {isRunning ? (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <SpinnerIcon />
                Running…
              </span>
            ) : isComplete ? (
              "Run Again"
            ) : (
              "Start Battle"
            )}
          </button>
        </div>

        {/* Hint */}
        {!isRunning && value.trim().length === 0 && (
          <p
            style={{
              marginTop: 8,
              fontSize: 12,
              color: "var(--text-muted)",
            }}
          >
            Enter a feature request to begin. Three agents will compete to
            implement it.
          </p>
        )}
      </div>
    </section>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      style={{ animation: "spin 1s linear infinite" }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle
        cx="7"
        cy="7"
        r="5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeOpacity="0.3"
      />
      <path
        d="M7 1.5A5.5 5.5 0 0 1 12.5 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
