/**
 * POST /api/battles/[battleId]/run
 *
 * Kicks off Battle Engine v1 for an existing battle:
 *   1. Provision dependencies in each contender worktree (sequential)
 *   2. Run IBM Bob concurrently for all provisioned contenders
 *   3. Collect basic Git evidence after each contender finishes
 *
 * The run is fire-and-forget from the HTTP perspective — it starts
 * immediately and returns 202 Accepted. Poll
 * GET /api/battles/[battleId] to inspect live state.
 *
 * A battle must be in CREATED status to be run.
 * Running a battle that is already RUNNING/COMPLETED returns 409.
 */

import { type NextRequest } from "next/server";
import { getBattle, putBattle } from "@/lib/coliseum/battle-store";
import { provisionBattle } from "@/lib/coliseum/provisioner";
import { runBattle } from "@/lib/coliseum/bob-runner";
import type { ApiError } from "@/lib/coliseum/types";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ battleId: string }> }
) {
  const { battleId } = await params;

  if (!battleId || !/^[0-9a-f-]{8,36}$/.test(battleId)) {
    return Response.json(
      { error: "Invalid battleId" } satisfies ApiError,
      { status: 400 }
    );
  }

  const battle = getBattle(battleId);
  if (!battle) {
    return Response.json(
      { error: "Battle not found" } satisfies ApiError,
      { status: 404 }
    );
  }

  // Only allow running a battle that hasn't started yet
  if (battle.status !== "CREATED") {
    return Response.json(
      {
        error: `Battle is already in status '${battle.status}' — cannot re-run`,
      } satisfies ApiError,
      { status: 409 }
    );
  }

  // Ensure it's in the store (idempotent if already there)
  putBattle(battle);

  // ── Fire-and-forget: provision then run ─────────────────────────────────
  //
  // We intentionally do NOT await this promise in the HTTP handler.
  // The client gets 202 immediately and polls for state.
  //
  // Errors at the top level are caught so they don't become unhandled
  // promise rejections.

  void (async () => {
    try {
      battle.status = "PROVISIONING";

      // Sequential provisioning
      await provisionBattle(battle);

      // Transition battle to READY if at least one contender is READY
      const anyReady = battle.contenders.some((c) => c.status === "READY");
      battle.status = anyReady ? "READY" : "FAILED";

      if (!anyReady) {
        console.error(
          `[run] Battle ${battleId}: all contenders failed provisioning`
        );
        return;
      }

      // Parallel Bob execution
      await runBattle(battle);
    } catch (err) {
      battle.status = "FAILED";
      console.error(`[run] Battle ${battleId} unexpected error:`, err);
    }
  })();

  return Response.json(
    {
      battleId,
      status: "PROVISIONING",
      message:
        "Battle run started. Poll GET /api/battles/" +
        battleId +
        " for live state.",
    },
    { status: 202 }
  );
}
