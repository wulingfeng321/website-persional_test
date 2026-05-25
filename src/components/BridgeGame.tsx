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
      whileHover={!disabled ? { y: -8, scale: 1.05 } : undefined}
      whileTap={!disabled ? { scale: 0.95 } : undefined}
      onClick={onClick}
      disabled={disabled}
      className={`card ${isRed ? "red" : ""} ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"} ${
        highlight ? "ring-2 ring-primary shadow-lg shadow-primary/30" : ""
      }`}
    >
      <span className="rank">{card.rank}</span>
      <span className="suit">{card.suit}</span>
    </motion.button>
  );
}

function CardBack() {
  return (
    <div className="card back">
      <span className="text-xs text-cyan-900">?</span>
    </div>
  );
}

export default function BridgeGame() {
  const [game, setGame] = useState<GameState | null>(null);
  const [autoTimer, setAutoTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const clearAutoTimer = () => {
    if (autoTimer) {
      clearTimeout(autoTimer);
      setAutoTimer(null);
    }
  };

  const startNewGame = useCallback(() => {
    clearAutoTimer();
    const newGame = createGame();
    // AI 先手：如果 North 是先手，自动出牌到 South 之前
    const order = getTurnOrder(newGame.leader);
    const southIdx = order.indexOf("South");
    for (let i = 0; i < southIdx; i++) {
      const player = order[i];
      const card = chooseAICard(newGame.hands[player], newGame.currentTrick);
      newGame.hands[player] = newGame.hands[player].filter((c) => c !== card);
      newGame.currentTrick.push({ player, card });
    }
    setGame({ ...newGame });
  }, []);

  const advanceToNextTrick = useCallback(() => {
    setGame((prev) => {
      if (!prev || prev.finished || !prev.waitingForNextTrick) return prev;
      const nextGame = { ...prev, waitingForNextTrick: false, completedTrick: [] as TrickPlay[] };
      // AI 先手自动出牌到 South
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

        // 出牌
        g.hands.South = g.hands.South.filter((c) => c.id !== cardId);
        g.currentTrick.push({ player: "South", card });

        // AI 自动出完剩余
        const order = getTurnOrder(g.leader);
        const southIdx = order.indexOf("South");
        for (let i = southIdx + 1; i < 4; i++) {
          const player = order[i];
          const aiCard = chooseAICard(g.hands[player], g.currentTrick);
          g.hands[player] = g.hands[player].filter((c) => c !== aiCard);
          g.currentTrick.push({ player, card: aiCard });
        }

        // 一墩完成
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
    []
  );

  // 自动进入下一墩
  useEffect(() => {
    if (game?.waitingForNextTrick && !game.finished) {
      const timer = setTimeout(advanceToNextTrick, 1200);
      setAutoTimer(timer);
      return () => clearTimeout(timer);
    }
  }, [game?.waitingForNextTrick, game?.finished, advanceToNextTrick]);

  // 初始自动开始
  useEffect(() => {
    startNewGame();
  }, [startNewGame]);

  if (!game) return null;

  const southLegalIds = new Set(
    getLegalCards(game.hands.South, game.currentTrick).map((c) => c.id)
  );

  return (
    <div className="space-y-6">
      {/* 控制区 */}
      <div className="flex flex-wrap gap-3 items-center">
        <button onClick={startNewGame} className="btn-cyber">
          新局
        </button>
        <div className="flex gap-4 font-mono text-sm ml-4">
          <span className="text-cyan-400">
            南北: <strong className="text-white">{game.scores.NS}</strong>
          </span>
          <span className="text-orange-400">
            东西: <strong className="text-white">{game.scores.EW}</strong>
          </span>
          <span className="text-slate-500">
            第 <strong className="text-white">{game.trickNumber}</strong> 墩
          </span>
        </div>
      </div>

      {/* 牌桌 */}
      <div className="card-cyber p-6">
        <div className="grid grid-cols-3 gap-4 min-h-[400px]">
          {/* 北家 */}
          <div className="col-span-3 flex flex-col items-center">
            <p className="font-mono text-xs text-slate-500 mb-2 uppercase tracking-wider">
              North (AI)
            </p>
            <div className="flex gap-1 justify-center flex-wrap">
              {game.hands.North.map((card) => (
                <CardBack key={card.id} />
              ))}
            </div>
          </div>

          {/* 西家 */}
          <div className="flex flex-col items-center justify-center">
            <p className="font-mono text-xs text-slate-500 mb-2 uppercase tracking-wider">
              West (AI)
            </p>
            <div className="flex flex-col gap-1 items-center">
              {game.hands.West.map((card) => (
                <CardBack key={card.id} />
              ))}
            </div>
          </div>

          {/* 中央 - 当前墩 */}
          <div className="flex flex-col items-center justify-center">
            <p className="font-mono text-xs text-slate-500 mb-3 uppercase tracking-wider">
              当前墩
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(["North", "East", "South", "West"] as Player[]).map((seat) => {
                const play = game.currentTrick.find((p) => p.player === seat) ||
                  game.completedTrick.find((p) => p.player === seat);
                return (
                  <div key={seat} className="trick-item text-center">
                    <strong>{seat}</strong>
                    {play ? (
                      <span className={play.card.suit === "♥" || play.card.suit === "♦" ? "text-red-400" : "text-white"}>
                        {play.card.label}
                      </span>
                    ) : (
                      <span className="text-slate-600">等待</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 东家 */}
          <div className="flex flex-col items-center justify-center">
            <p className="font-mono text-xs text-slate-500 mb-2 uppercase tracking-wider">
              East (AI)
            </p>
            <div className="flex flex-col gap-1 items-center">
              {game.hands.East.map((card) => (
                <CardBack key={card.id} />
              ))}
            </div>
          </div>

          {/* 南家 - 玩家 */}
          <div className="col-span-3 flex flex-col items-center mt-4">
            <p className="font-mono text-xs text-primary mb-2 uppercase tracking-wider">
              South (你)
            </p>
            <div className="flex gap-1 justify-center flex-wrap">
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
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className={`text-center font-mono text-sm p-3 rounded-lg ${
            game.finished
              ? "bg-primary/10 border border-primary/20 text-primary"
              : "bg-white/5 border border-white/5 text-slate-400"
          }`}
        >
          {game.message}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
