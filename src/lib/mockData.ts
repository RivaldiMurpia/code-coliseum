/**
 * mockData.ts — kept for reference; no longer used by the live app.
 * The Arena is now wired to the real Battle API.
 */

import type { BattleState } from "./types";

export const MOCK_BATTLE: BattleState = {
  phase: "idle",
  featureRequest: "",
  contenders: [],
  distinctions: [],
};
