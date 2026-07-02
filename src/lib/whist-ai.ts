// 客户端 AI 服务层：调用 API 路由获取 LLM 出牌决策，失败时回退到规则 AI

import type { Card, TrickPlay, Player } from "@/components/WhistGame";

const AI_TIMEOUT = 8000; // 8 秒超时

interface AIRequestData {
  player: Player;
  partner: Player;
  hand: Card[];
  currentTrick: TrickPlay[];
  trumpSuit: string;
  trickNumber: number;
  scores: { NS: number; EW: number };
  leader: Player;
  legalCards: Card[];
}

interface AIResponse {
  card: Card;
  reasoning: string;
}

const PARTNER: Record<Player, Player> = {
  North: "South",
  South: "North",
  East: "West",
  West: "East",
};

export async function getAIMove(
  hand: Card[],
  trick: TrickPlay[],
  trumpSuit: string,
  player: Player,
  trickNumber: number,
  scores: { NS: number; EW: number },
  leader: Player,
  legalCards: Card[]
): Promise<{ card: Card; reasoning: string }> {
  const requestData: AIRequestData = {
    player,
    partner: PARTNER[player],
    hand,
    currentTrick: trick,
    trumpSuit,
    trickNumber,
    scores,
    leader,
    legalCards,
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT);

    const response = await fetch("/api/whist-ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestData),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`AI API returned ${response.status}, using fallback`);
      const card = fallbackAI(legalCards, trick, trumpSuit);
      return { card, reasoning: "规则AI回退" };
    }

    const data: AIResponse = await response.json();

    // 验证返回的牌是否在合法牌列表中
    const isValid = legalCards.some((c) => c.id === data.card.id);
    if (!isValid) {
      console.warn("AI returned illegal card, using fallback");
      const card = fallbackAI(legalCards, trick, trumpSuit);
      return { card, reasoning: "规则AI回退" };
    }

    return { card: data.card, reasoning: data.reasoning || "" };
  } catch (error) {
    console.warn("AI API call failed, using fallback:", error);
    const card = fallbackAI(legalCards, trick, trumpSuit);
    return { card, reasoning: "规则AI回退" };
  }
}

// 回退到规则 AI（简化版 chooseAICard 逻辑）
function fallbackAI(legalCards: Card[], trick: TrickPlay[], trumpSuit: string): Card {
  if (trick.length === 0) {
    // 先手：出最大的非王牌
    const nonTrump = legalCards.filter((c) => c.suit !== trumpSuit);
    const pool = nonTrump.length > 0 ? nonTrump : legalCards;
    pool.sort((a, b) => cardStrength(b) - cardStrength(a));
    return pool[0];
  }

  const leadSuit = trick[0].card.suit;
  const PARTNER_MAP: Record<Player, Player> = { North: "South", South: "North", East: "West", West: "East" };
  const partner = PARTNER_MAP[trick[0].player];

  // 判断搭档是否在赢
  const currentWinner = determineTrickWinner(trick, trumpSuit);
  const partnerIsWinning = currentWinner === partner;

  const sameSuit = legalCards.filter((c) => c.suit === leadSuit);
  if (sameSuit.length > 0) {
    if (partnerIsWinning) {
      sameSuit.sort((a, b) => cardStrength(a) - cardStrength(b));
      return sameSuit[0];
    }
    sameSuit.sort((a, b) => cardStrength(b) - cardStrength(a));
    return sameSuit[0];
  }

  const trumps = legalCards.filter((c) => c.suit === trumpSuit);
  if (trumps.length > 0 && !partnerIsWinning) {
    trumps.sort((a, b) => cardStrength(a) - cardStrength(b));
    return trumps[0];
  }

  const discards = legalCards.filter((c) => c.suit !== trumpSuit);
  const pool = discards.length > 0 ? discards : legalCards;
  pool.sort((a, b) => cardStrength(a) - cardStrength(b));
  return pool[0];
}

const RANK_ORDER: Record<string, number> = {};
["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"].forEach(
  (r, i) => (RANK_ORDER[r] = i)
);

function cardStrength(card: Card): number {
  return RANK_ORDER[card.rank];
}

function determineTrickWinner(trick: TrickPlay[], trumpSuit: string): Player {
  const leadSuit = trick[0].card.suit;
  let winning = trick[0];
  for (const play of trick.slice(1)) {
    const isTrump = play.card.suit === trumpSuit;
    const winIsTrump = winning.card.suit === trumpSuit;
    if (isTrump && !winIsTrump) {
      winning = play;
    } else if (isTrump && winIsTrump) {
      if (cardStrength(play.card) > cardStrength(winning.card)) winning = play;
    } else if (!isTrump && !winIsTrump && play.card.suit === leadSuit) {
      if (cardStrength(play.card) > cardStrength(winning.card)) winning = play;
    }
  }
  return winning.player;
}
