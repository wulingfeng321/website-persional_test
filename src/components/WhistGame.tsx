"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getAIMove } from "@/lib/whist-ai";

// ==================== 常量 ====================
const SUITS = ["♠", "♥", "♦", "♣"] as const;
const SUIT_NAMES: Record<string, string> = { "♠": "黑桃", "♥": "红心", "♦": "方块", "♣": "梅花" };
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const RANK_ORDER: Record<string, number> = {};
RANKS.forEach((r, i) => (RANK_ORDER[r] = i));

const PLAYERS = ["North", "East", "South", "West"] as const;
export type Player = (typeof PLAYERS)[number];

export interface Card {
  rank: string;
  suit: string;
  label: string;
  id: string;
}

export interface TrickPlay {
  player: Player;
  card: Card;
}

type StopType = "new_trick" | "lead_card" | "follow_card" | "game_over";

interface AILogEntry {
  player: Player;
  card: Card;
  reasoning: string;
}

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
  isLoading: boolean;
  loadingPlayer: Player | null;
  useAI: boolean;
  aiLog: AILogEntry[];
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

// ==================== 规则 AI（回退用）====================
const PARTNER: Record<Player, Player> = { North: "South", South: "North", East: "West", West: "East" };

function chooseAICard(hand: Card[], trick: TrickPlay[], trumpSuit: string): Card {
  const legal = getLegalCards(hand, trick);
  if (legal.length === 0) {
    throw new Error(`chooseAICard: no legal cards. hand=${hand.length}, trick=${trick.length}`);
  }

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

  const sameSuit = legal.filter((c) => c.suit === leadSuit);
  if (sameSuit.length > 0) {
    if (partnerIsWinning) {
      sameSuit.sort((a, b) => cardStrength(a) - cardStrength(b));
      return sameSuit[0];
    }
    sameSuit.sort((a, b) => cardStrength(b) - cardStrength(a));
    return sameSuit[0];
  }

  const trumps = legal.filter((c) => c.suit === trumpSuit);
  if (trumps.length > 0 && !partnerIsWinning) {
    trumps.sort((a, b) => cardStrength(a) - cardStrength(b));
    return trumps[0];
  }

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
    isLoading: false,
    loadingPlayer: null,
    useAI: true,
    aiLog: [],
  };
}

// ==================== 辅助：AI 取牌（带回退）====================
async function fetchAICard(
  hand: Card[],
  trick: TrickPlay[],
  trumpSuit: string,
  player: Player,
  trickNumber: number,
  scores: { NS: number; EW: number },
  leader: Player,
  useAI: boolean
): Promise<{ card: Card; reasoning: string }> {
  const legal = getLegalCards(hand, trick);
  if (useAI) {
    try {
      return await getAIMove(hand, trick, trumpSuit, player, trickNumber, scores, leader, legal);
    } catch {
      const card = chooseAICard(hand, trick, trumpSuit);
      return { card, reasoning: "规则AI回退" };
    }
  }
  const card = chooseAICard(hand, trick, trumpSuit);
  return { card, reasoning: "规则AI" };
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
  const abortRef = useRef(false);

  // 开始新局
  const startNewGame = useCallback(() => {
    abortRef.current = false;
    setGame(createGame());
  }, []);

  // 进入下一墩（异步 AI 出牌）
  const startNewTrick = useCallback(async () => {
    // 先清空当前墩，设置加载状态
    setGame((prev) => {
      if (!prev || prev.stopType !== "new_trick") return prev;
      const hands = {
        North: [...prev.hands.North],
        East: [...prev.hands.East],
        South: [...prev.hands.South],
        West: [...prev.hands.West],
      };
      return { ...prev, hands, currentTrick: [], aiLog: [], isLoading: true, loadingPlayer: null };
    });

    // 逐个 AI 出牌（等待前一个完成）
    const snapshot = await new Promise<GameState | null>((resolve) => {
      setGame((prev) => {
        resolve(prev);
        return prev;
      });
    });
    if (!snapshot || abortRef.current) return;

    const order = getTurnOrder(snapshot.leader);
    const southIdx = order.indexOf("South");

    for (let i = 0; i < southIdx; i++) {
      if (abortRef.current) return;
      const player = order[i];

      // 设置当前思考的玩家
      setGame((prev) => prev ? { ...prev, loadingPlayer: player } : prev);

      // 获取当前状态
      const currentState = await new Promise<GameState | null>((resolve) => {
        setGame((prev) => {
          resolve(prev);
          return prev;
        });
      });
      if (!currentState || abortRef.current) return;

      const aiResult = await fetchAICard(
        currentState.hands[player],
        currentState.currentTrick,
        currentState.trumpSuit,
        player,
        currentState.trickNumber,
        currentState.scores,
        currentState.leader,
        currentState.useAI
      );

      // 更新状态：加入 AI 出的牌和推理日志
      setGame((prev) => {
        if (!prev) return prev;
        const hands = {
          North: [...prev.hands.North],
          East: [...prev.hands.East],
          South: [...prev.hands.South],
          West: [...prev.hands.West],
        };
        hands[player] = hands[player].filter((c) => c.id !== aiResult.card.id);
        const currentTrick = [...prev.currentTrick, { player, card: aiResult.card }];
        const aiLog = [...prev.aiLog, { player, card: aiResult.card, reasoning: aiResult.reasoning }];
        return { ...prev, hands, currentTrick, aiLog };
      });
    }

    // 所有 AI 出完，启用人类玩家
    setGame((prev) => {
      if (!prev) return prev;
      const southIdx2 = getTurnOrder(prev.leader).indexOf("South");
      return {
        ...prev,
        isLoading: false,
        loadingPlayer: null,
        stopType: southIdx2 === 0 ? "lead_card" : "follow_card",
        message: `第 ${prev.trickNumber} 墩，${prev.leader} 先手。请出牌。`,
      };
    });
  }, []);

  // South 出牌（异步 AI 出牌）
  const playCard = useCallback(async (cardId: string) => {
    // 验证并出 South 的牌
    let isValid = false;
    setGame((prev) => {
      if (!prev || prev.stopType === "game_over" || prev.stopType === "new_trick" || prev.isLoading) return prev;

      const card = prev.hands.South.find((c) => c.id === cardId);
      if (!card) return prev;

      const legal = getLegalCards(prev.hands.South, prev.currentTrick);
      if (!legal.some((c) => c.id === cardId)) {
        return { ...prev, message: "必须跟花色！你有同花色的牌必须出。" };
      }

      isValid = true;
      const hands = {
        North: [...prev.hands.North],
        East: [...prev.hands.East],
        South: prev.hands.South.filter((c) => c.id !== cardId),
        West: [...prev.hands.West],
      };
      const currentTrick = [...prev.currentTrick, { player: "South" as Player, card }];
      return { ...prev, hands, currentTrick, isLoading: true };
    });

    if (!isValid) return;

    // 获取最新状态
    const afterSouth = await new Promise<GameState | null>((resolve) => {
      setGame((prev) => {
        resolve(prev);
        return prev;
      });
    });
    if (!afterSouth || abortRef.current) return;

    // South 之后的 AI 出牌
    const order = getTurnOrder(afterSouth.leader);
    const southIdx = order.indexOf("South");

    for (let i = southIdx + 1; i < 4; i++) {
      if (abortRef.current) return;
      const player = order[i];

      setGame((prev) => prev ? { ...prev, loadingPlayer: player } : prev);

      const currentState = await new Promise<GameState | null>((resolve) => {
        setGame((prev) => {
          resolve(prev);
          return prev;
        });
      });
      if (!currentState || abortRef.current) return;

      const aiResult = await fetchAICard(
        currentState.hands[player],
        currentState.currentTrick,
        currentState.trumpSuit,
        player,
        currentState.trickNumber,
        currentState.scores,
        currentState.leader,
        currentState.useAI
      );

      setGame((prev) => {
        if (!prev) return prev;
        const hands = {
          North: [...prev.hands.North],
          East: [...prev.hands.East],
          South: [...prev.hands.South],
          West: [...prev.hands.West],
        };
        hands[player] = hands[player].filter((c) => c.id !== aiResult.card.id);
        const currentTrick = [...prev.currentTrick, { player, card: aiResult.card }];
        const aiLog = [...prev.aiLog, { player, card: aiResult.card, reasoning: aiResult.reasoning }];
        return { ...prev, hands, currentTrick, aiLog };
      });
    }

    // 一墩完成，结算
    setGame((prev) => {
      if (!prev) return prev;
      if (prev.currentTrick.length < 4) return prev;

      const g = { ...prev, isLoading: false, loadingPlayer: null };
      const winner = determineTrickWinner(g.currentTrick, g.trumpSuit);

      if (winner === "North" || winner === "South") {
        g.scores = { ...g.scores, NS: g.scores.NS + 1 };
      } else {
        g.scores = { ...g.scores, EW: g.scores.EW + 1 };
      }

      g.leader = winner;
      g.trickNumber += 1;

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

      return g;
    });
  }, []);

  // 切换 AI 模式（AI 思考中禁止切换）
  const toggleAI = useCallback(() => {
    setGame((prev) => {
      if (!prev || prev.isLoading) return prev;
      return { ...prev, useAI: !prev.useAI };
    });
  }, []);

  // 初始自动开始
  useEffect(() => {
    startNewGame();
  }, [startNewGame]);

  // 组件卸载时中止
  useEffect(() => {
    return () => { abortRef.current = true; };
  }, []);

  if (!game) return null;

  const southLegalIds = new Set(getLegalCards(game.hands.South, game.currentTrick).map((c) => c.id));

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

  const canPlay = (game.stopType === "lead_card" || game.stopType === "follow_card") && !game.isLoading;

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
        <div style={{ display: "flex", gap: "8px" }}>
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
          <div
            onClick={toggleAI}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: game.isLoading ? "not-allowed" : "pointer",
              opacity: game.isLoading ? 0.4 : 1,
              transition: "opacity 0.2s",
              userSelect: "none",
            }}
          >
            <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#888" }}>AI</span>
            <div
              style={{
                width: "36px",
                height: "20px",
                borderRadius: "10px",
                background: game.useAI ? "rgba(255,215,0,0.3)" : "rgba(100,100,100,0.3)",
                border: `1px solid ${game.useAI ? "rgba(255,215,0,0.5)" : "rgba(100,100,100,0.3)"}`,
                position: "relative",
                transition: "all 0.25s",
              }}
            >
              <motion.div
                animate={{ x: game.useAI ? 16 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                style={{
                  width: "16px",
                  height: "16px",
                  borderRadius: "50%",
                  background: game.useAI ? "#ffd700" : "#666",
                  position: "absolute",
                  top: "1px",
                  left: "1px",
                  boxShadow: game.useAI ? "0 0 6px rgba(255,215,0,0.4)" : "none",
                }}
              />
            </div>
            <span style={{ fontFamily: "monospace", fontSize: "12px", color: game.useAI ? "#ffd700" : "#666" }}>
              {game.useAI ? "LLM" : "规则"}
            </span>
          </div>
        </div>
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
          position: "relative",
        }}
      >
        {/* AI 思考加载指示器 */}
        {game.isLoading && game.loadingPlayer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "rgba(0,0,0,0.85)",
              padding: "12px 24px",
              borderRadius: "8px",
              border: "1px solid rgba(0,212,255,0.3)",
              zIndex: 10,
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              style={{ fontSize: "18px", color: "#00d4ff" }}
            >
              ♠
            </motion.span>
            <span style={{ fontFamily: "monospace", color: "#00d4ff", fontSize: "13px" }}>
              {game.loadingPlayer} 正在思考...
            </span>
          </motion.div>
        )}

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
            <p style={{ fontFamily: "monospace", fontSize: "11px", color: game.loadingPlayer === "North" ? "#00d4ff" : "#666", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "1px" }}>
              North (AI) · {game.hands.North.length}张
              {game.loadingPlayer === "North" && " 🤔"}
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
            <p style={{ fontFamily: "monospace", fontSize: "11px", color: game.loadingPlayer === "West" ? "#00d4ff" : "#666", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "1px" }}>
              West (AI) · {game.hands.West.length}张
              {game.loadingPlayer === "West" && " 🤔"}
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
            <div style={{ marginTop: "12px", fontFamily: "monospace", fontSize: "11px", color: "#888" }}>
              翻牌: <span style={{ color: "#ffd700" }}>{game.trumpCard.label}</span>
            </div>
          </div>

          {/* 东家 */}
          <div style={{ textAlign: "center" }}>
            <p style={{ fontFamily: "monospace", fontSize: "11px", color: game.loadingPlayer === "East" ? "#00d4ff" : "#666", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "1px" }}>
              East (AI) · {game.hands.East.length}张
              {game.loadingPlayer === "East" && " 🤔"}
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

      {/* 状态消息 */}
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
      {game.stopType === "new_trick" && !game.isLoading && (
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

      {/* AI 决策日志面板 */}
      {game.useAI && game.aiLog.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: "14px 18px",
            background: "rgba(10, 15, 30, 0.65)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderRadius: "10px",
            border: "1px solid rgba(0,212,255,0.15)",
            fontFamily: "monospace",
            fontSize: "12px",
          }}
        >
          <div style={{ color: "#00d4ff", fontSize: "11px", marginBottom: "10px", letterSpacing: "1px", textTransform: "uppercase" }}>
            LLM 决策日志
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {game.aiLog.map((entry, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "8px 12px",
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: "6px",
                  borderLeft: `3px solid ${entry.card.suit === "♥" || entry.card.suit === "♦" ? "#ff6b6b" : "#00d4ff"}`,
                }}
              >
                <span style={{ color: "#888", minWidth: "42px" }}>{entry.player}</span>
                <span style={{
                  color: entry.card.suit === "♥" || entry.card.suit === "♦" ? "#ff6b6b" : "#e0e0e0",
                  fontWeight: "bold",
                  minWidth: "36px",
                }}>
                  {entry.card.label}
                </span>
                <span style={{ color: "#aaa", flex: 1 }}>{entry.reasoning || "—"}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
