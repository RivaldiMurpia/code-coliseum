/**
 * GET /api/battles/[battleId]  — Retrieve battle state
 */

import { type NextRequest } from "next/server";
import { getBattle } from "@/lib/coliseum/battle-store";
import type { ApiError } from "@/lib/coliseum/types";

export async function GET(
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

  return Response.json(battle);
}
