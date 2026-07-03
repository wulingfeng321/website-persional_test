import { NextResponse } from "next/server";
import OpenAI from "openai";

interface Card {
  rank: string;
  suit: string;
  label: string;
  id: string;
}

interface TrickPlay {
  player: string;
  card: Card;
}

interface AIRequestBody {
  player: string;
  partner: string;
  hand: Card[];
  currentTrick: TrickPlay[];
  trumpSuit: string;
  trickNumber: number;
  scores: { NS: number; EW: number };
  leader: string;
  legalCards: Card[];
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
  baseURL: process.env.OPENAI_BASE_URL || "https://api.deepseek.com/v1",
});

const SUIT_NORMALIZE: Record<string, string> = {
  "♠": "♠", "♥": "♥", "♦": "♦", "♣": "♣",
  "spades": "♠", "hearts": "♥", "diamonds": "♦", "clubs": "♣",
  "spade": "♠", "heart": "♥", "diamond": "♦", "club": "♣",
  "黑桃": "♠", "红心": "♥", "红桃": "♥", "方块": "♦", "梅花": "♣",
};

function normalizeSuit(suit: string): string {
  const key = suit.trim().toLowerCase();
  return SUIT_NORMALIZE[key] || SUIT_NORMALIZE[suit] || suit;
}

const SYSTEM_PROMPT = `你是Whist桥牌AI。规则：必须跟花色；无同花色可出任意牌；王牌最大；同花色A最大2最小。
你必须从合法牌中选择。
回复格式：先写一行简短思考（10字以内），然后写JSON。
示例：
出最大牌
{"rank":"A","suit":"♠"}`;

function buildUserPrompt(body: AIRequestBody): string {
  const handStr = body.hand.map((c) => c.label).join(", ");
  const legalStr = body.legalCards.map((c) => c.label).join(", ");
  const trickStr =
    body.currentTrick.length > 0
      ? body.currentTrick.map((t) => `${t.player}出${t.card.label}`).join(", ")
      : "（空，你是首出）";

  return `你是${body.player}，搭档是${body.partner}。
王牌花色：${body.trumpSuit}
你的手牌：${handStr}
当前墩已出牌：${trickStr}
比分：南北${body.scores.NS} - 东西${body.scores.EW}
第${body.trickNumber}/13墩
先手玩家：${body.leader}

你可以出的合法牌：${legalStr}

请选择一张牌出牌。`;
}

function parseCardResponse(text: string, legalCards: Card[]): Card | null {
  // 尝试从响应中提取 JSON（支持 markdown code blocks）
  const cleaned = text.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      // 处理 {rank, suit} 和 {card: {rank, suit}} 两种格式
      const cardData = parsed.rank && parsed.suit ? parsed : parsed.card;
      if (cardData && cardData.rank && cardData.suit) {
        const normalizedSuit = normalizeSuit(cardData.suit);
        const found = legalCards.find(
          (c) => c.rank === cardData.rank && c.suit === normalizedSuit
        );
        if (found) return found;
      }
    } catch { /* continue */ }
  }

  // 回退：尝试从文本中直接匹配合法牌的 label（如 "A♠"）
  for (const card of legalCards) {
    if (text.includes(card.label) || text.includes(`${card.rank}${card.suit}`)) {
      return card;
    }
  }

  // 回退：匹配 rank + suit 文字（如 "rank: A, suit: ♠"）
  for (const card of legalCards) {
    const rankPattern = new RegExp(`"?rank"?\\s*[:=]\\s*"?${card.rank}"?`, "i");
    const suitPattern = new RegExp(`"?suit"?\\s*[:=]\\s*"?${card.suit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"?`);
    if (rankPattern.test(text) && suitPattern.test(text)) {
      return card;
    }
  }

  return null;
}

function parseReasoning(text: string): string {
  // 提取 JSON 之前的文本作为思考内容
  const jsonIndex = text.indexOf("{");
  if (jsonIndex > 0) {
    return text.slice(0, jsonIndex).trim();
  }
  return text.slice(0, 50).trim();
}

export async function POST(request: Request) {
  try {
    const body: AIRequestBody = await request.json();

    // 验证输入
    if (!body.player || !body.legalCards || body.legalCards.length === 0) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // 如果没有配置 API Key，返回错误让客户端回退
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "your-api-key-here") {
      return NextResponse.json({ error: "API key not configured" }, { status: 503 });
    }

    const model = process.env.OPENAI_MODEL || "deepseek-chat";
    const MAX_RETRIES = 1;

    let card: Card | null = null;
    let responseText = "";

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const messages = attempt === 0
        ? [
            { role: "system" as const, content: SYSTEM_PROMPT },
            { role: "user" as const, content: buildUserPrompt(body) },
          ]
        : [
            { role: "system" as const, content: SYSTEM_PROMPT },
            { role: "user" as const, content: buildUserPrompt(body) },
            { role: "assistant" as const, content: responseText },
            { role: "user" as const, content: `你的回复无法解析。请只回复JSON格式，不要添加其他文字。从以下合法牌中选择一张：${body.legalCards.map(c => `${c.rank}${c.suit}`).join(", ")}\n回复格式：\n{"rank":"A","suit":"♠"}` },
          ];

      const completion = await openai.chat.completions.create({
        model,
        max_tokens: 200,
        temperature: 0.3,
        messages,
      });

      responseText = completion.choices[0]?.message?.content || "";
      console.log(`[Whist AI] ${body.player} raw response (attempt ${attempt + 1}):`, responseText);

      card = parseCardResponse(responseText, body.legalCards);
      if (card) break;
    }

    if (!card) {
      console.warn(`[Whist AI] Failed to parse card after ${MAX_RETRIES + 1} attempts: "${responseText}"`);
      return NextResponse.json(
        { error: "AI returned invalid card", raw: responseText },
        { status: 422 }
      );
    }

    const reasoning = parseReasoning(responseText);
    return NextResponse.json({ card, reasoning });
  } catch (error) {
    console.error("Whist AI API error:", error);
    return NextResponse.json(
      { error: "AI service unavailable" },
      { status: 500 }
    );
  }
}
