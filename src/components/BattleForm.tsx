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
        {/* Section label - more prominent */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 16,
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            style={{ color: "var(--accent)", flexShrink: 0 }}
          >
            <path
              d="M8 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm0 1a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M8 5.5v3.5M8 11.5v.01"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
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

        {/* Input row - more prominent */}
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
          }}
          className="battle-form-row"
        >
          {/* Textarea - larger, more prominent */}
          <div
            style={{
              flex: 1,
              position: "relative",
              borderRadius: "var(--radius-lg)",
              border: `2px solid ${
                focused ? "var(--accent)" : "var(--border-default)"
              }`,
              background: "var(--bg-raised)",
              transition: "border-color 0.15s, box-shadow 0.15s",
              boxShadow: focused
                ? "0 0 0 4px var(--accent-glow), 0 4px 24px rgba(0,0,0,0.2)"
                : "0 2px 12px rgba(0,0,0,0.15)",
            }}
          >
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              disabled={isRunning}
              rows={4}
              placeholder="Describe the feature to implement. Be specific — three agents will compete to build it."
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                outline: "none",
                padding: "16px 16px",
                color: isRunning ? "var(--text-muted)" : "var(--text-primary)",
                fontFamily: "var(--font-geist-sans, sans-serif)",
                fontSize: 15,
                lineHeight: 1.7,
                resize: "vertical",
                minHeight: 100,
                cursor: isRunning ? "not-allowed" : "text",
              }}
            />
            {!isRunning && value.trim().length === 0 && !focused && (
              <div
                style={{
                  position: "absolute",
                  bottom: 12,
                  right: 16,
                  fontSize: 10,
                  fontFamily: "var(--font-geist-mono, monospace)",
                  color: "var(--text-disabled)",
                  letterSpacing: "0.04em",
                  pointerEvents: "none",
                }}
              >
                Press ⌘Enter to start
              </div>
            )}
          </div>

          {/* Start button - more prominent */}
          <button
            onClick={onStart}
            disabled={isRunning || value.trim().length === 0}
            style={{
              flexShrink: 0,
              height: 56,
              padding: "0 28px",
              borderRadius: "var(--radius-lg)",
              border: "1px solid transparent",
              background:
                isRunning || value.trim().length === 0
                  ? "var(--bg-card)"
                  : "linear-gradient(180deg, var(--accent) 0%, #2563eb 100%)",
              color:
                isRunning || value.trim().length === 0
                  ? "var(--text-muted)"
                  : "#fff",
              fontFamily: "var(--font-geist-sans, sans-serif)",
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "0.02em",
              cursor:
                isRunning || value.trim().length === 0
                  ? "not-allowed"
                  : "pointer",
              transition: "background 0.15s, opacity 0.15s, transform 0.05s",
              whiteSpace: "nowrap",
              alignSelf: "flex-start",
              boxShadow:
                isRunning || value.trim().length === 0
                  ? "none"
                  : "0 4px 16px rgba(59,130,246,0.35)",
              marginTop: 0,
            }}
            onMouseDown={(e) => {
              if (!e.currentTarget.disabled) e.currentTarget.style.transform = "scale(0.98)";
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            {isRunning ? (
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <SpinnerIcon />
                <span style={{ letterSpacing: "0.04em" }}>Running Battle…</span>
              </span>
            ) : isComplete ? (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M7 1a6 6 0 1 1-.01 12A6 6 0 0 1 7 1Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M4 7l2.5 2.5L10 4"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Run Again
              </span>
            ) : (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  aria-hidden="true"
                >
                  <polygon
                    points="7,1 13,7 7,13 1,7"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    fill="none"
                  />
                </svg>
                Start Battle
              </span>
            )}
          </button>
        </div>

        {/* Hint */}
        {!isRunning && value.trim().length === 0 && (
          <p
            style={{
              marginTop: 10,
              fontSize: 12,
              color: "var(--text-muted)",
              fontFamily: "var(--font-geist-sans, sans-serif)",
            }}
          >
            Enter a feature request to begin. Three agents — Minimalist, Sprinter, Architect — will compete to implement it.
          </p>
        )}
      </div>
    </section>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{ animation: "spin 1s linear infinite" }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeOpacity="0.25"
      />
      <path
        d="M8 2A6 6 0 0 1 14 8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
