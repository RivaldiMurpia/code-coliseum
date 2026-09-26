"use client";

import { useState } from "react";
import ArenaHeader from "@/components/ArenaHeader";
import BattleForm from "@/components/BattleForm";
import ContenderGrid from "@/components/ContenderGrid";
import GauntletPanel from "@/components/GauntletPanel";
import ResultsPanel from "@/components/ResultsPanel";
import { MOCK_BATTLE } from "@/lib/mockData";
import type { BattleState } from "@/lib/types";

export default function Home() {
  // Seed from mock data; later: replace with real Bob event stream
  const [battle, setBattle] = useState<BattleState>(MOCK_BATTLE);

  function handleFeatureChange(value: string) {
    setBattle((prev) => ({ ...prev, featureRequest: value }));
  }

  function handleStart() {
    if (battle.phase === "running") return;
    // Future: kick off Bob orchestration.
    // For now: reset to a "running" state showing pending contenders.
    setBattle((prev) => ({
      ...prev,
      phase: "running",
      distinctions: [],
      contenders: prev.contenders.map((c) => ({
        ...c,
        status: "thinking",
        finalAction: "Analyzing feature request…",
        testsPassed: 0,
        filesChanged: 0,
        linesChanged: 0,
        agentTimeMs: 0,
        benchmarks: [],
        eliminationReason: null,
        gauntlet: {
          build:               "pending",
          "existing-tests":    "pending",
          "acceptance-tests":  "pending",
          "typescript-strict": "pending",
          "no-new-deps":       "pending",
          "api-compatibility": "pending",
        },
      })),
    }));
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-base)",
      }}
    >
      <ArenaHeader />

      <main style={{ flex: 1 }}>
        <BattleForm
          value={battle.featureRequest}
          phase={battle.phase}
          onChange={handleFeatureChange}
          onStart={handleStart}
        />

        <ContenderGrid contenders={battle.contenders} />

        <GauntletPanel contenders={battle.contenders} />

        {battle.phase === "complete" && (
          <ResultsPanel
            contenders={battle.contenders}
            distinctions={battle.distinctions}
          />
        )}

        {battle.phase === "idle" && (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: 13,
              fontFamily: "var(--font-geist-mono, monospace)",
              letterSpacing: "0.04em",
            }}
          >
            Enter a feature request above and start the battle.
          </div>
        )}
      </main>

      <footer
        style={{
          borderTop: "1px solid var(--border-subtle)",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            fontFamily: "var(--font-geist-mono, monospace)",
            letterSpacing: "0.04em",
          }}
        >
          Code Coliseum · MVP
        </span>
        <span
          style={{
            fontSize: 11,
            color: "var(--text-disabled)",
            fontFamily: "var(--font-geist-mono, monospace)",
          }}
        >
          Judge engine not yet wired
        </span>
      </footer>
    </div>
  );
}
