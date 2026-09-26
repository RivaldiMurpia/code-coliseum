import { getBattle } from "@/lib/coliseum/battle-store";
import type { ApiError, ContenderId } from "@/lib/coliseum/types";

const CONTENDER_IDS = new Set<ContenderId>([
  "minimalist",
  "sprinter",
  "architect",
]);

function isContenderId(value: unknown): value is ContenderId {
  return typeof value === "string" && CONTENDER_IDS.has(value as ContenderId);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ battleId: string }> }
) {
  const { battleId } = await params;

  if (!/^[0-9a-f-]{8,36}$/i.test(battleId)) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON" } satisfies ApiError,
      { status: 400 }
    );
  }

  const contenderId =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as { contenderId?: unknown }).contenderId
      : undefined;

  if (!isContenderId(contenderId)) {
    return Response.json(
      { error: "Unsupported contenderId" } satisfies ApiError,
      { status: 400 }
    );
  }

  const contender = battle.contenders.find((item) => item.id === contenderId);
  if (!contender) {
    return Response.json(
      { error: "Contender does not belong to this battle" } satisfies ApiError,
      { status: 400 }
    );
  }

  if (contender.gauntlet?.status !== "SURVIVED") {
    return Response.json(
      { error: "Only contenders that survived the Gauntlet can be selected" } satisfies ApiError,
      { status: 400 }
    );
  }

  battle.selectedContenderId = contender.id;
  return Response.json(battle);
}
