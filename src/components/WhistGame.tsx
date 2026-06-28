"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ==================== 常量 ====================
const SUITS = ["♠", "♥", "♦", "♣"] as const;
const SUIT_NAMES: Record<string, string> = { "♠": "黑桃", "♥": "红心", "♦": "方块", "♣": "梅花" };
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const RANK_ORDER: Record<string, number> = {};
RANKS.forEach((r, i) => (RANK_ORDER[r] = i));

const PLAYERS = ["North", "East", "South", "West"] as const;
type Player = (typeof PLAYERS)[number];

interface Card {
  rank: string;
  suit: string;
  label: string;
  id: string;
}

interface TrickPlay {
  player: Player;
  card: Card;
}

type StopType = "new_trick" | "lead_card" | "follow_card" | "game_over";

interface GameState {
  hands: Record<Player, Card[]>;
  currentTrick: TrickPlay[];
  trickNumber: number;
  leader: Player;
  message: string;
  scores: { NS: number; EW: number };
  trumpSuit: string;
  trumpCard: Card;
  stopType: StopType;
  winner: string | null;
}

// ==================== 工具函数 ====================
function makeDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit, label: `${rank}${suit}`, id: `${rank}-${suit}` });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function cardStrength(card: Card): number {
  return RANK_ORDER[card.rank];
}

function getTurnOrder(leader: Player): Player[] {
  const idx = PLAYERS.indexOf(leader);
  return [...PLAYERS.slice(idx), ...PLAYERS.slice(0, idx)];
}

function getLeadSuit(trick: TrickPlay[]): string | null {
  if (trick.length === 0) return null;
  return trick[0].card.suit;
}

function hasSuit(hand: Card[], suit: string): boolean {
  return hand.some((c) => c.suit === suit);
}

function getLegalCards(hand: Card[], trick: TrickPlay[]): Card[] {
  const leadSuit = getLeadSuit(trick);
  if (!leadSuit) return hand;
  const follow = hand.filter((c) => c.suit === leadSuit);
  return follow.length > 0 ? follow : hand;
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
      if (cardStrength(play.card) > cardStrength(winning.card)) {
        winning = play;
      }
    } else if (!isTrump && !winIsTrump && play.card.suit === leadSuit) {
      if (cardStrength(play.card) > cardStrength(winning.card)) {
        winning = play;
      }
    }
  }
  return winning.player;
}

// ==================== AI 策略 ====================
const PARTNER: Record<Player, Player> = { North: "South", South: "North", East: "West", West: "East" };

function chooseAICard(hand: Card[], trick: TrickPlay[], trumpSuit: string): Card {
  const legal = getLegalCards(hand, trick);
  if (legal.length === 0) {
    throw new Error(`chooseAICard: no legal cards. hand=${hand.length}, trick=${trick.length}`);
  }

  // 先手：出最大的非王牌
  if (trick.length === 0) {
    const nonTrump = legal.filter((c) => c.suit !== trumpSuit);
    const pool = nonTrump.length > 0 ? nonTrump : legal;
    pool.sort((a, b) => cardStrength(b) - cardStrength(a));
    return pool[0];
  }

  const leadSuit = getLeadSuit(trick)!;
  const currentWinner = determineTrickWinner(trick, trumpSuit);
  const partner = PARTNER[trick[0].player];
  const partnerIsWinning = currentWinner === partner;

  // 同花色
  const sameSuit = legal.filter((c) => c.suit === leadSuit);
  if (sameSuit.length > 0) {
    if (partnerIsWinning) {
      sameSuit.sort((a, b) => cardStrength(a) - cardStrength(b));
      return sameSuit[0];
    }
    sameSuit.sort((a, b) => cardStrength(b) - cardStrength(a));
    return sameSuit[0];
  }

  // 无同花色
  const trumps = legal.filter((c) => c.suit === trumpSuit);
  if (trumps.length > 0 && !partnerIsWinning) {
    trumps.sort((a, b) => cardStrength(a) - cardStrength(b));
    return trumps[0];
  }

  // 垫牌：出最小
  const discards = legal.filter((c) => c.suit !== trumpSuit);
  const pool = discards.length > 0 ? discards : legal;
  pool.sort((a, b) => cardStrength(a) - cardStrength(b));
  return pool[0];
}

// ==================== 游戏初始化 ====================
function createGame(): GameState {
  const deck = makeDeck();
  const hands: Record<Player, Card[]> = { North: [], East: [], South: [], West: [] };

  deck.forEach((card, i) => {
    hands[PLAYERS[i % 4]].push(card);
  });

  // 王牌：发给东家的最后一张牌（排序前确定，避免总是梅花）
  const trumpCard = deck[49];
  const trumpSuit = trumpCard.suit;

  for (const player of PLAYERS) {
    hands[player].sort(
      (a, b) => SUITS.indexOf(a.suit as typeof SUITS[number]) - SUITS.indexOf(b.suit as typeof SUITS[number]) || cardStrength(a) - cardStrength(b)
    );
  }

  return {
    hands,
    currentTrick: [],
    trickNumber: 1,
    leader: "North",
    message: `王牌花色：${SUIT_NAMES[trumpSuit]}${trumpSuit}。点击"开始"进入第一墩。`,
    scores: { NS: 0, EW: 0 },
    trumpSuit,
    trumpCard,
    stopType: "new_trick",
    winner: null,
  };
}

// ==================== 卡片组件 ====================
function CardButton({
  card,
  onClick,
  disabled,
  highlight,
  isTrump,
}: {
  card: Card;
  onClick?: () => void;
  disabled?: boolean;
  highlight?: boolean;
  isTrump?: boolean;
}) {
  const isRed = card.suit === "♥" || card.suit === "♦";
  return (
    <motion.button
      whileHover={!disabled ? { y: -6, scale: 1.05 } : undefined}
      whileTap={!disabled ? { scale: 0.95 } : undefined}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "44px",
        height: "60px",
        borderRadius: "6px",
        border: `1px solid ${highlight ? "#00d4ff" : isTrump ? "#ffd700" : "rgba(100,100,100,0.4)"}`,
        background: disabled ? "rgba(30,30,30,0.5)" : "rgba(20,20,30,0.9)",
        color: isRed ? "#ff6b6b" : "#e0e0e0",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "12px",
        fontFamily: "monospace",
        boxShadow: highlight ? "0 0 10px rgba(0,212,255,0.3)" : isTrump ? "0 0 8px rgba(255,215,0,0.2)" : "none",
        transition: "all 0.2s",
        padding: "2px",
      }}
    >
      <span style={{ fontSize: "14px", fontWeight: "bold" }}>{card.rank}</span>
      <span style={{ fontSize: "16px" }}>{card.suit}</span>
    </motion.button>
  );
}

function CardFace({ card, small, isTrump }: { card: Card; small?: boolean; isTrump?: boolean }) {
  const isRed = card.suit === "♥" || card.suit === "♦";
  const size = small ? { width: "30px", height: "42px" } : { width: "36px", height: "50px" };
  return (
    <div
      style={{
        ...size,
        borderRadius: "4px",
        border: `1px solid ${isTrump ? "#ffd700" : "rgba(100,100,100,0.4)"}`,
        background: "rgba(20,20,30,0.9)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: isRed ? "#ff6b6b" : "#e0e0e0",
        fontFamily: "monospace",
        boxShadow: isTrump ? "0 0 6px rgba(255,215,0,0.2)" : "none",
      }}
    >
      <span style={{ fontSize: small ? "10px" : "12px", fontWeight: "bold" }}>{card.rank}</span>
      <span style={{ fontSize: small ? "12px" : "14px" }}>{card.suit}</span>
    </div>
  );
}

// ==================== 主组件 ====================
export default function WhistGame() {
  const [game, setGame] = useState<GameState | null>(null);

  // 开始新局
  const startNewGame = useCallback(() => {
    setGame(createGame());
  }, []);

  // 进入下一墩（AI 先手出牌到 South）
  const startNewTrick = useCallback(() => {
    setGame((prev) => {
      if (!prev || prev.stopType !== "new_trick") return prev;

      // Deep copy hands to avoid mutation issues with React StrictMode double-invoke
      const hands = {
        North: [...prev.hands.North],
        East: [...prev.hands.East],
        South: [...prev.hands.South],
        West: [...prev.hands.West],
      };
      const g = { ...prev, hands, currentTrick: [] as TrickPlay[] };
      const order = getTurnOrder(g.leader);
      const southIdx = order.indexOf("South");

      // AI 先手出牌到 South 之前
      for (let i = 0; i < southIdx; i++) {
        const player = order[i];
        const card = chooseAICard(g.hands[player], g.currentTrick, g.trumpSuit);
        g.hands[player] = g.hands[player].filter((c) => c.id !== card.id);
        g.currentTrick.push({ player, card });
      }

      g.stopType = southIdx === 0 ? "lead_card" : "follow_card";
      g.message = `第 ${g.trickNumber} 墩，${g.leader} 先手。请出牌。`;
      return { ...g };
    });
  }, []);

  // South 出牌
  const playCard = useCallback((cardId: string) => {
    setGame((prev) => {
      if (!prev || prev.stopType === "game_over" || prev.stopType === "new_trick") return prev;

      // Deep copy hands to avoid mutation issues with React StrictMode double-invoke
      const hands = {
        North: [...prev.hands.North],
        East: [...prev.hands.East],
        South: [...prev.hands.South],
        West: [...prev.hands.West],
      };
      const g = { ...prev, hands };
      const card = g.hands.South.find((c) => c.id === cardId);
      if (!card) return prev;

      // 验证合法性
      const legal = getLegalCards(g.hands.South, g.currentTrick);
      if (!legal.some((c) => c.id === cardId)) {
        g.message = "必须跟花色！你有同花色的牌必须出。";
        return { ...g };
      }

      // South 出牌
      g.hands.South = g.hands.South.filter((c) => c.id !== cardId);
      g.currentTrick.push({ player: "South", card });

      // South 之后的 AI 出牌
      const order = getTurnOrder(g.leader);
      const southIdx = order.indexOf("South");
      for (let i = southIdx + 1; i < 4; i++) {
        const player = order[i];
        const aiCard = chooseAICard(g.hands[player], g.currentTrick, g.trumpSuit);
        g.hands[player] = g.hands[player].filter((c) => c.id !== aiCard.id);
        g.currentTrick.push({ player, card: aiCard });
      }

      // 一墩完成
      if (g.currentTrick.length === 4) {
        const winner = determineTrickWinner(g.currentTrick, g.trumpSuit);

        if (winner === "North" || winner === "South") {
          g.scores = { ...g.scores, NS: g.scores.NS + 1 };
        } else {
          g.scores = { ...g.scores, EW: g.scores.EW + 1 };
        }

        g.leader = winner;
        g.trickNumber += 1;

        // 检查游戏结束
        const allEmpty = PLAYERS.every((p) => g.hands[p].length === 0);
        if (allEmpty) {
          g.stopType = "game_over";
          const nsWin = g.scores.NS >= 7 || g.scores.NS > g.scores.EW;
          const ewWin = g.scores.EW >= 7 || g.scores.EW > g.scores.NS;
          g.winner = nsWin ? "南北" : ewWin ? "东西" : "平局";
          g.message = `游戏结束！南北 ${g.scores.NS} 墩，东西 ${g.scores.EW} 墩。${g.winner}获胜！`;
        } else {
          g.stopType = "new_trick";
          g.message = `第 ${g.trickNumber - 1} 墩结束，${winner} 获得先手。`;
        }
      }

      return { ...g };
    });
  }, []);

  // 初始自动开始
  useEffect(() => {
    startNewGame();
  }, [startNewGame]);

  if (!game) return null;

  const southLegalIds = new Set(getLegalCards(game.hands.South, game.currentTrick).map((c) => c.id));

  // 按花色分组
  const groupBySuit = (hand: Card[]) => {
    const groups: Record<string, Card[]> = {};
    for (const suit of SUITS) {
      groups[suit] = hand.filter((c) => c.suit === suit);
    }
    return groups;
  };

  const southGroups = groupBySuit(game.hands.South);
  const westGroups = groupBySuit(game.hands.West);
  const eastGroups = groupBySuit(game.hands.East);
  const northGroups = groupBySuit(game.hands.North);

  const canPlay = game.stopType === "lead_card" || game.stopType === "follow_card";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* 顶部信息栏 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 16px",
          background: "rgba(20,20,30,0.8)",
          borderRadius: "8px",
          border: "1px solid rgba(0,212,255,0.15)",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <button
          onClick={startNewGame}
          style={{
            padding: "6px 16px",
            background: "rgba(0,212,255,0.15)",
            border: "1px solid rgba(0,212,255,0.4)",
            borderRadius: "6px",
            color: "#00d4ff",
            cursor: "pointer",
            fontFamily: "monospace",
            fontSize: "13px",
          }}
        >
          新局
        </button>
        <div style={{ display: "flex", gap: "16px", fontFamily: "monospace", fontSize: "13px", flexWrap: "wrap" }}>
          <span style={{ color: "#4dc9f6" }}>
            南北: <strong style={{ color: "#fff" }}>{game.scores.NS}</strong>
          </span>
          <span style={{ color: "#f67019" }}>
            东西: <strong style={{ color: "#fff" }}>{game.scores.EW}</strong>
          </span>
          <span style={{ color: "#666" }}>
            第 <strong style={{ color: "#fff" }}>{game.trickNumber}</strong>/13 墩
          </span>
          <span style={{ color: "#ffd700" }}>
            王牌: {SUIT_NAMES[game.trumpSuit]}{game.trumpSuit}
          </span>
        </div>
      </div>

      {/* 牌桌 */}
      <div
        style={{
          background: "rgba(15,15,25,0.9)",
          borderRadius: "10px",
          border: "1px solid rgba(0,212,255,0.15)",
          padding: "16px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "140px 1fr 140px",
            gridTemplateRows: "auto auto auto",
            gap: "12px",
            alignItems: "start",
          }}
        >
          {/* 北家 */}
          <div style={{ gridColumn: "1 / -1", textAlign: "center" }}>
            <p style={{ fontFamily: "monospace", fontSize: "11px", color: "#666", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "1px" }}>
              North (AI) · {game.hands.North.length}张
            </p>
            <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap" }}>
              {SUITS.map((suit) => (
                <div key={suit} style={{ display: "flex", gap: "2px", alignItems: "flex-end" }}>
                  {northGroups[suit].map((card) => (
                    <CardFace key={card.id} card={card} small isTrump={card.suit === game.trumpSuit} />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* 西家 */}
          <div style={{ textAlign: "center" }}>
            <p style={{ fontFamily: "monospace", fontSize: "11px", color: "#666", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "1px" }}>
              West (AI) · {game.hands.West.length}张
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "center" }}>
              {SUITS.map((suit) => (
                <div key={suit} style={{ display: "flex", gap: "2px", justifyContent: "center" }}>
                  {westGroups[suit].map((card) => (
                    <CardFace key={card.id} card={card} small isTrump={card.suit === game.trumpSuit} />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* 中央 - 当前墩 */}
          <div style={{ textAlign: "center", minHeight: "180px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <p style={{ fontFamily: "monospace", fontSize: "11px", color: "#666", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "1px" }}>
              当前墩
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
                maxWidth: "220px",
                margin: "0 auto",
              }}
            >
              {(["North", "East", "South", "West"] as Player[]).map((seat) => {
                const play = game.currentTrick.find((p) => p.player === seat);
                const isRed = play && (play.card.suit === "♥" || play.card.suit === "♦");
                return (
                  <div
                    key={seat}
                    style={{
                      padding: "8px",
                      background: "rgba(30,30,40,0.6)",
                      borderRadius: "6px",
                      border: play ? "1px solid rgba(0,212,255,0.3)" : "1px solid rgba(50,50,50,0.4)",
                      fontSize: "12px",
                    }}
                  >
                    <div style={{ fontFamily: "monospace", fontSize: "10px", color: "#555", marginBottom: "4px" }}>{seat}</div>
                    {play ? (
                      <span style={{ color: isRed ? "#ff6b6b" : "#e0e0e0", fontFamily: "monospace", fontWeight: "bold", fontSize: "14px" }}>
                        {play.card.label}
                      </span>
                    ) : (
                      <span style={{ color: "#333", fontSize: "11px" }}>等待</span>
                    )}
                  </div>
                );
              })}
            </div>
            {/* 翻牌 */}
            <div style={{ marginTop: "12px", fontFamily: "monospace", fontSize: "11px", color: "#888" }}>
              翻牌: <span style={{ color: "#ffd700" }}>{game.trumpCard.label}</span>
            </div>
          </div>

          {/* 东家 */}
          <div style={{ textAlign: "center" }}>
            <p style={{ fontFamily: "monospace", fontSize: "11px", color: "#666", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "1px" }}>
              East (AI) · {game.hands.East.length}张
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "center" }}>
              {SUITS.map((suit) => (
                <div key={suit} style={{ display: "flex", gap: "2px", justifyContent: "center" }}>
                  {eastGroups[suit].map((card) => (
                    <CardFace key={card.id} card={card} small isTrump={card.suit === game.trumpSuit} />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* 南家 */}
          <div style={{ gridColumn: "1 / -1", textAlign: "center", marginTop: "8px" }}>
            <p style={{ fontFamily: "monospace", fontSize: "11px", color: "#00d4ff", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "1px" }}>
              South (你) · {game.hands.South.length}张
            </p>
            <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap" }}>
              {SUITS.map((suit) => (
                <div key={suit} style={{ display: "flex", gap: "3px", alignItems: "flex-end" }}>
                  {southGroups[suit].map((card) => (
                    <CardButton
                      key={card.id}
                      card={card}
                      onClick={() => playCard(card.id)}
                      disabled={!canPlay || !southLegalIds.has(card.id)}
                      highlight={canPlay && southLegalIds.has(card.id)}
                      isTrump={card.suit === game.trumpSuit}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 状态消息 + 操作按钮 */}
      <AnimatePresence mode="wait">
        <motion.div
          key={game.message}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          style={{
            textAlign: "center",
            fontFamily: "monospace",
            fontSize: "13px",
            padding: "10px 16px",
            borderRadius: "8px",
            background: game.stopType === "game_over" ? "rgba(255,215,0,0.08)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${game.stopType === "game_over" ? "rgba(255,215,0,0.3)" : "rgba(255,255,255,0.05)"}`,
            color: game.stopType === "game_over" ? "#ffd700" : "#888",
          }}
        >
          {game.message}
        </motion.div>
      </AnimatePresence>

      {/* 开始按钮 */}
      {game.stopType === "new_trick" && (
        <div style={{ textAlign: "center" }}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={startNewTrick}
            style={{
              padding: "10px 32px",
              background: "rgba(0,212,255,0.2)",
              border: "1px solid rgba(0,212,255,0.5)",
              borderRadius: "8px",
              color: "#00d4ff",
              cursor: "pointer",
              fontFamily: "monospace",
              fontSize: "14px",
              fontWeight: "bold",
            }}
          >
            {game.trickNumber === 1 ? "开始游戏" : "下一墩"}
          </motion.button>
        </div>
      )}

      {/* 规则说明 */}
      <div
        style={{
          padding: "12px 16px",
          background: "rgba(20,20,30,0.6)",
          borderRadius: "8px",
          border: "1px solid rgba(100,100,100,0.2)",
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#666",
          lineHeight: "1.6",
        }}
      >
        <div style={{ color: "#888", marginBottom: "4px" }}>Whist 规则：</div>
        <div>• 每人13张牌，王牌花色由翻牌决定</div>
        <div>• 必须跟花色，无同花色可出任意牌（包括王牌）</div>
        <div>• 王牌最大，同花色比点数（A最大）</div>
        <div>• 先赢得7墩的一方获胜</div>
      </div>
    </div>
  );
}
