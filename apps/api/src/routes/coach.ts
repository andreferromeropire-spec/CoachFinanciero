import { Router, Request, Response } from "express";
import { prisma } from "@coach/db";
import { processMessage, classifyIntent, type CoachResponse } from "../services/CoachService";

export const coachRouter = Router();

interface MessageBody {
  message: string;
  conversationHistory?: { role: "user" | "assistant"; content: string }[];
  conversationId?: string;
}

// ── Error classifier ──────────────────────────────────────────────────────────

type AnthropicErrorKind = "api_key" | "credits" | "rate_limit" | "overloaded" | "unknown";

function classifyAnthropicError(err: unknown): AnthropicErrorKind {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();

  // Check numeric status if available (Anthropic SDK exposes .status)
  const status = (err as { status?: number }).status;

  if (msg.includes("anthropic_api_key") || msg.includes("api key not set") || msg.includes("x-api-key")) {
    return "api_key";
  }
  if (
    status === 402 ||
    msg.includes("credit") ||
    msg.includes("billing") ||
    msg.includes("balance") ||
    msg.includes("payment") ||
    msg.includes("insufficient") ||
    msg.includes("402")
  ) {
    return "credits";
  }
  if (status === 429 || msg.includes("rate limit") || msg.includes("too many requests") || msg.includes("429")) {
    return "rate_limit";
  }
  if (status === 529 || msg.includes("overload") || msg.includes("529")) {
    return "overloaded";
  }
  return "unknown";
}

// ── POST /api/coach/message ───────────────────────────────────────────────────

coachRouter.post("/message", async (req: Request, res: Response) => {
  const { message, conversationHistory = [], conversationId } = req.body as MessageBody;

  if (!message?.trim()) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  // Get or create conversation record
  let convo = conversationId
    ? await prisma.conversation.findUnique({ where: { id: conversationId } })
    : null;

  if (!convo) {
    convo = await prisma.conversation.create({
      data: { title: message.slice(0, 60) },
    });
  }

  // Persist user message
  await prisma.message.create({
    data: {
      conversationId: convo.id,
      role: "user",
      content: message,
    },
  });

  let result: CoachResponse;
  try {
    result = await processMessage(message, conversationHistory);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const errKind = classifyAnthropicError(err);

    // Log the full details so you can debug from the server console
    const status = (err as { status?: number }).status;
    console.error(`[coach] ===== ANTHROPIC ERROR =====`);
    console.error(`[coach]   kind    : ${errKind}`);
    console.error(`[coach]   status  : ${status ?? "n/a"}`);
    console.error(`[coach]   message : ${errMsg}`);
    if ((err as { error?: unknown }).error) {
      console.error(`[coach]   body    :`, JSON.stringify((err as { error?: unknown }).error));
    }
    console.error(`[coach] ============================`);

    if (errKind === "api_key") {
      result = {
        reply: "⚙️ El coach de IA no está configurado. Agrega ANTHROPIC_API_KEY en apps/api/.env para activarlo.",
        modelUsed: "error",
        suggestedActions: ["Ver documentación"],
        sonnetCallsRemaining: 0,
      };
    } else if (errKind === "credits") {
      result = {
        reply: "💳 La cuenta de Anthropic no tiene crédito disponible. Recarga en [console.anthropic.com](https://console.anthropic.com) y vuelve a intentarlo.",
        modelUsed: "error",
        suggestedActions: ["Recargar crédito"],
        sonnetCallsRemaining: 0,
      };
    } else if (errKind === "rate_limit") {
      result = {
        reply: "⏳ Demasiadas consultas en poco tiempo. Espera unos segundos e intenta de nuevo.",
        modelUsed: "error",
        suggestedActions: [],
        sonnetCallsRemaining: 0,
      };
    } else if (errKind === "overloaded") {
      result = {
        reply: "🔄 Los servidores de Anthropic están ocupados en este momento. Intenta de nuevo en unos segundos.",
        modelUsed: "error",
        suggestedActions: [],
        sonnetCallsRemaining: 0,
      };
    } else {
      // Unknown error — log the intent for context, don't expose internals
      const intent = classifyIntent(message);
      console.error(`[coach] Unhandled error for intent ${intent}:`, err);
      res.status(500).json({ error: "Error procesando el mensaje. Revisa los logs del servidor." });
      return;
    }
  }

  // Persist assistant reply
  await prisma.message.create({
    data: {
      conversationId: convo.id,
      role: "assistant",
      content: result.reply,
      modelUsed: result.modelUsed,
      budgetData: result.budgetData ? (result.budgetData as object) : undefined,
    },
  });

  res.json({ ...result, conversationId: convo.id });
});

// GET /api/coach/conversations — list all conversations
coachRouter.get("/conversations", async (_req: Request, res: Response) => {
  const convos = await prisma.conversation.findMany({
    orderBy: { updatedAt: "desc" },
    take: 20,
    include: {
      _count: { select: { messages: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  res.json(convos);
});

// GET /api/coach/conversations/:id — get full conversation
coachRouter.get("/conversations/:id", async (req: Request, res: Response) => {
  const convo = await prisma.conversation.findUnique({
    where: { id: req.params.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!convo) { res.status(404).json({ error: "Not found" }); return; }
  res.json(convo);
});
