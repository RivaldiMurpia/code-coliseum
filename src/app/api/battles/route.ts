/**
 * POST /api/battles  — Create a new battle (3 isolated git worktrees)
 * DELETE /api/battles?battleId=<id>  — Tear down worktrees + branches
 */

import { type NextRequest } from "next/server";
import {
  createBattle,
  deleteBattle,
  WorkingTreeDirtyError,
} from "@/lib/coliseum/battle-orchestrator";
import type { CreateBattleRequest, ApiError } from "@/lib/coliseum/types";

// ─── POST ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON body" } satisfies ApiError,
      { status: 400 }
    );
  }

  // Validate
  const parsed = body as Partial<CreateBattleRequest>;
  if (
    typeof parsed?.featureRequest !== "string" ||
    parsed.featureRequest.trim().length === 0
  ) {
    return Response.json(
      {
        error: "featureRequest must be a non-empty string",
      } satisfies ApiError,
      { status: 400 }
    );
  }

  const featureRequest = parsed.featureRequest.trim();

  try {
    const battle = await createBattle(featureRequest);
    return Response.json(battle, { status: 201 });
  } catch (err) {
    if (err instanceof WorkingTreeDirtyError) {
      return Response.json(
        {
          error: "Working tree is dirty",
          detail: err.message,
        } satisfies ApiError,
        { status: 409 }
      );
    }

    console.error("[POST /api/battles] Unexpected error:", err);
    return Response.json(
      {
        error: "Failed to create battle",
        detail: err instanceof Error ? err.message : String(err),
      } satisfies ApiError,
      { status: 500 }
    );
  }
}

// ─── DELETE ────────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const battleId = request.nextUrl.searchParams.get("battleId");

  if (!battleId || battleId.trim().length === 0) {
    return Response.json(
      { error: "battleId query parameter is required" } satisfies ApiError,
      { status: 400 }
    );
  }

  // Basic sanity check — battle IDs are 8-char hex from randomUUID().slice(0,8)
  if (!/^[0-9a-f-]{8,36}$/.test(battleId)) {
    return Response.json(
      { error: "Invalid battleId format" } satisfies ApiError,
      { status: 400 }
    );
  }

  try {
    await deleteBattle(battleId);
    return Response.json({ deleted: true, battleId });
  } catch (err) {
    console.error("[DELETE /api/battles] Error during cleanup:", err);
    return Response.json(
      {
        error: "Cleanup failed",
        detail: err instanceof Error ? err.message : String(err),
      } satisfies ApiError,
      { status: 500 }
    );
  }
}
