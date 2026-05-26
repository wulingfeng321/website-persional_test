"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SUITS = ["♠", "♥", "♦", "♣"];
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

interface GameState {
  hands: Record<Player, Card[]>;
  currentTrick: TrickPlay[];
  completedTrick: TrickPlay[];
  trickNumber: number;
  leader: Player;
  message: string;
  scores: { NS: number; EW: number };
  finished: boolean;
  waitingForNextTrick: boolean;
}

function makeDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        rank,
        suit,
        label: `${rank}${suit}`,
        id: `${rank}-${suit}`,
      });
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

function createGame(): GameState {
  const deck = makeDeck();
  const hands: Record<Player, Card[]> = {
    North: [],
    East: [],
    South: [],
    West: [],
  };
  deck.forEach((card, i) => {
    hands[PLAYERS[i % 4]].push(card);
  });
  for (const player of PLAYERS) {
    hands[player].sort(
      (a, b) => SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) || cardStrength(a) - cardStrength(b)
    );
  }
  return {
    hands,
    currentTrick: [],
    completedTrick: [],
    trickNumber: 1,
    leader: "North",
    message: "南家由你控制，系统自动处理其他三家。",
    scores: { NS: 0, EW: 0 },
    finished: false,
    waitingForNextTrick: false,
  };
}

function getTurnOrder(leader: Player): Player[] {
  const idx = PLAYERS.indexOf(leader);
  return [...PLAYERS.slice(idx), ...PLAYERS.slice(0, idx)];
}

function getLegalCards(hand: Card[], currentTrick: TrickPlay[]): Card[] {
  if (currentTrick.length === 0) return hand;
  const leadSuit = currentTrick[0].card.suit;
  const follow = hand.filter((c) => c.suit === leadSuit);
  return follow.length > 0 ? follow : hand;
}

function chooseAICard(hand: Card[], currentTrick: TrickPlay[]): Card {
  const legal = getLegalCards(hand, currentTrick);
  legal.sort((a, b) => SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) || cardStrength(a) - cardStrength(b));
  return legal[0];
}

function determineTrickWinner(trick: TrickPlay[]): Player {
  const leadSuit = trick[0].card.suit;
  let winning = trick[0];
  for (const play of trick.slice(1)) {
    if (play.card.suit === leadSuit && cardStrength(play.card) > cardStrength(winning.card)) {
      winning = play;
    }
  }
  return winning.player;
}

function CardButton({
  card,
  onClick,
  disabled,
  highlight,
}: {
  card: Card;
  onClick?: () => void;
  disabled?: boolean;
  highlight?: boolean;
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
        border: `1px solid ${highlight ? "#00d4ff" : "rgba(100,100,100,0.4)"}`,
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
        boxShadow: highlight ? "0 0 10px rgba(0,212,255,0.3)" : "none",
        transition: "all 0.2s",
        padding: "2px",
      }}
    >
      <span style={{ fontSize: "14px", fontWeight: "bold" }}>{card.rank}</span>
      <span style={{ fontSize: "16px" }}>{card.suit}</span>
    </motion.button>
  );
}

function CardBack({ small }: { small?: boolean }) {
  const size = small ? { width: "32px", height: "44px" } : { width: "36px", height: "50px" };
  return (
    <div
      style={{
        ...size,
        borderRadius: "4px",
        border: "1px solid rgba(0,212,255,0.2)",
        background: "linear-gradient(135deg, rgba(0,20,40,0.9), rgba(0,10,20,0.9))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "10px",
        color: "rgba(0,212,255,0.3)",
      }}
    >
      ?
    </div>
  );
}

export default function BridgeGame() {
  const [game, setGame] = useState<GameState | null>(null);
  const [autoTimer, setAutoTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const clearAutoTimer = useCallback(() => {
    if (autoTimer) {
      clearTimeout(autoTimer);
      setAutoTimer(null);
    }
  }, [autoTimer]);

  const startNewGame = useCallback(() => {
    clearAutoTimer();
    const newGame = createGame();
    const order = getTurnOrder(newGame.leader);
    const southIdx = order.indexOf("South");
    for (let i = 0; i < southIdx; i++) {
      const player = order[i];
      const card = chooseAICard(newGame.hands[player], newGame.currentTrick);
      newGame.hands[player] = newGame.hands[player].filter((c) => c !== card);
      newGame.currentTrick.push({ player, card });
    }
    setGame({ ...newGame });
  }, [clearAutoTimer]);

  const advanceToNextTrick = useCallback(() => {
    setGame((prev) => {
      if (!prev || prev.finished || !prev.waitingForNextTrick) return prev;
      const nextGame = { ...prev, waitingForNextTrick: false, completedTrick: [] as TrickPlay[] };
      const order = getTurnOrder(nextGame.leader);
      const southIdx = order.indexOf("South");
      for (let i = 0; i < southIdx; i++) {
        const player = order[i];
        const card = chooseAICard(nextGame.hands[player], nextGame.currentTrick);
        nextGame.hands[player] = nextGame.hands[player].filter((c) => c !== card);
        nextGame.currentTrick.push({ player, card });
      }
      nextGame.message = `第 ${nextGame.trickNumber} 墩，${nextGame.leader} 先手。`;
      return { ...nextGame };
    });
  }, []);

  const playCard = useCallback(
    (cardId: string) => {
      clearAutoTimer();
      setGame((prev) => {
        if (!prev || prev.finished) return prev;

        let g = { ...prev };
        if (g.waitingForNextTrick) {
          g.waitingForNextTrick = false;
          g.completedTrick = [];
        }

        const card = g.hands.South.find((c) => c.id === cardId);
        if (!card) {
          g.message = "请选择你手牌中的合法牌出牌。";
          return { ...g };
        }

        const legal = getLegalCards(g.hands.South, g.currentTrick);
        if (!legal.some((c) => c.id === cardId)) {
          g.message = "你必须优先跟花色。";
          return { ...g };
        }

        g.hands.South = g.hands.South.filter((c) => c.id !== cardId);
        g.currentTrick.push({ player: "South", card });

        const order = getTurnOrder(g.leader);
        const southIdx = order.indexOf("South");
        for (let i = southIdx + 1; i < 4; i++) {
          const player = order[i];
          const aiCard = chooseAICard(g.hands[player], g.currentTrick);
          g.hands[player] = g.hands[player].filter((c) => c !== aiCard);
          g.currentTrick.push({ player, card: aiCard });
        }

        if (g.currentTrick.length === 4) {
          g.completedTrick = [...g.currentTrick];
          const winner = determineTrickWinner(g.currentTrick);
          if (winner === "North" || winner === "South") {
            g.scores = { ...g.scores, NS: g.scores.NS + 1 };
          } else {
            g.scores = { ...g.scores, EW: g.scores.EW + 1 };
          }
          g.leader = winner;
          g.trickNumber += 1;
          g.currentTrick = [];

          const allEmpty = PLAYERS.every((p) => g.hands[p].length === 0);
          if (allEmpty) {
            g.finished = true;
            g.message = `比赛结束！南北 ${g.scores.NS} 墩，东西 ${g.scores.EW} 墩。`;
          } else {
            g.waitingForNextTrick = true;
            g.message = `第 ${g.trickNumber - 1} 墩结束，${winner} 获得先手。`;
          }
        }

        return { ...g };
      });
    },
    [clearAutoTimer]
  );

  useEffect(() => {
    if (game?.waitingForNextTrick && !game.finished) {
      const timer = setTimeout(advanceToNextTrick, 1200);
      setAutoTimer(timer);
      return () => clearTimeout(timer);
    }
  }, [game?.waitingForNextTrick, game?.finished, advanceToNextTrick]);

  useEffect(() => {
    startNewGame();
  }, [startNewGame]);

  if (!game) return null;

  const southLegalIds = new Set(
    getLegalCards(game.hands.South, game.currentTrick).map((c) => c.id)
  );

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
        <div style={{ display: "flex", gap: "20px", fontFamily: "monospace", fontSize: "13px" }}>
          <span style={{ color: "#4dc9f6" }}>
            南北: <strong style={{ color: "#fff" }}>{game.scores.NS}</strong>
          </span>
          <span style={{ color: "#f67019" }}>
            东西: <strong style={{ color: "#fff" }}>{game.scores.EW}</strong>
          </span>
          <span style={{ color: "#666" }}>
            第 <strong style={{ color: "#fff" }}>{game.trickNumber}</strong> 墩
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
            gridTemplateColumns: "1fr 2fr 1fr",
            gridTemplateRows: "auto auto auto",
            gap: "12px",
            alignItems: "center",
          }}
        >
          {/* 北家 - 顶部居中 */}
          <div style={{ gridColumn: "1 / -1", textAlign: "center" }}>
            <p style={{ fontFamily: "monospace", fontSize: "11px", color: "#666", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "1px" }}>
              North (AI) · {game.hands.North.length}张
            </p>
            <div style={{ display: "flex", gap: "3px", justifyContent: "center", flexWrap: "wrap" }}>
              {game.hands.North.map((card) => (
                <CardBack key={card.id} small />
              ))}
            </div>
          </div>

          {/* 西家 - 左侧 */}
          <div style={{ textAlign: "center" }}>
            <p style={{ fontFamily: "monospace", fontSize: "11px", color: "#666", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "1px" }}>
              West (AI) · {game.hands.West.length}张
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px", alignItems: "center" }}>
              {game.hands.West.map((card) => (
                <CardBack key={card.id} small />
              ))}
            </div>
          </div>

          {/* 中央 - 当前墩 */}
          <div style={{ textAlign: "center" }}>
            <p style={{ fontFamily: "monospace", fontSize: "11px", color: "#666", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "1px" }}>
              当前墩
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "6px",
                maxWidth: "200px",
                margin: "0 auto",
              }}
            >
              {(["North", "East", "South", "West"] as Player[]).map((seat) => {
                const play = game.currentTrick.find((p) => p.player === seat) ||
                  game.completedTrick.find((p) => p.player === seat);
                const isRed = play && (play.card.suit === "♥" || play.card.suit === "♦");
                return (
                  <div
                    key={seat}
                    style={{
                      padding: "6px 8px",
                      background: "rgba(30,30,40,0.6)",
                      borderRadius: "6px",
                      border: play ? "1px solid rgba(0,212,255,0.3)" : "1px solid rgba(50,50,50,0.4)",
                      fontSize: "12px",
                    }}
                  >
                    <div style={{ fontFamily: "monospace", fontSize: "10px", color: "#555", marginBottom: "2px" }}>{seat}</div>
                    {play ? (
                      <span style={{ color: isRed ? "#ff6b6b" : "#e0e0e0", fontFamily: "monospace", fontWeight: "bold" }}>
                        {play.card.label}
                      </span>
                    ) : (
                      <span style={{ color: "#333", fontSize: "11px" }}>等待</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 东家 - 右侧 */}
          <div style={{ textAlign: "center" }}>
            <p style={{ fontFamily: "monospace", fontSize: "11px", color: "#666", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "1px" }}>
              East (AI) · {game.hands.East.length}张
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px", alignItems: "center" }}>
              {game.hands.East.map((card) => (
                <CardBack key={card.id} small />
              ))}
            </div>
          </div>

          {/* 南家 - 底部居中 */}
          <div style={{ gridColumn: "1 / -1", textAlign: "center", marginTop: "8px" }}>
            <p style={{ fontFamily: "monospace", fontSize: "11px", color: "#00d4ff", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "1px" }}>
              South (你) · {game.hands.South.length}张
            </p>
            <div style={{ display: "flex", gap: "4px", justifyContent: "center", flexWrap: "wrap" }}>
              {game.hands.South.map((card) => (
                <CardButton
                  key={card.id}
                  card={card}
                  onClick={() => playCard(card.id)}
                  disabled={!southLegalIds.has(card.id) || game.waitingForNextTrick}
                  highlight={southLegalIds.has(card.id) && !game.waitingForNextTrick}
                />
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
            background: game.finished ? "rgba(0,212,255,0.08)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${game.finished ? "rgba(0,212,255,0.2)" : "rgba(255,255,255,0.05)"}`,
            color: game.finished ? "#00d4ff" : "#888",
          }}
        >
          {game.message}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
