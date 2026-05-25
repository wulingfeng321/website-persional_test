"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

interface Card {
  rank: string;
  suit: string;
}

function calculateScore(cards: Card[]): number {
  let total = 0;
  let aceCount = 0;

  for (const card of cards) {
    if (card.rank === "A") {
      aceCount++;
      total += 11;
    } else if (["K", "Q", "J"].includes(card.rank)) {
      total += 10;
    } else {
      total += parseInt(card.rank);
    }
  }

  while (total > 21 && aceCount > 0) {
    total -= 10;
    aceCount--;
  }

  return total;
}

function isNaturalBlackjack(cards: Card[]): boolean {
  if (cards.length !== 2) return false;
  const hasAce = cards.some((c) => c.rank === "A");
  const hasTen = cards.some((c) => ["K", "Q", "J", "10"].includes(c.rank));
  return hasAce && hasTen;
}

function shuffleDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function CardDisplay({ card, faceDown = false }: { card: Card; faceDown?: boolean }) {
  if (faceDown) {
    return (
      <motion.div
        initial={{ rotateY: 180, opacity: 0 }}
        animate={{ rotateY: 0, opacity: 1 }}
        className="card back"
      >
        <span className="text-xs text-cyan-900">?</span>
      </motion.div>
    );
  }

  const isRed = card.suit === "♥" || card.suit === "♦";

  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0, rotateY: -180 }}
      animate={{ scale: 1, opacity: 1, rotateY: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className={`card ${isRed ? "red" : ""}`}
    >
      <span className="rank">{card.rank}</span>
      <span className="suit">{card.suit}</span>
    </motion.div>
  );
}

export default function BlackJackGame() {
  const [deck, setDeck] = useState<Card[]>([]);
  const [dealerCards, setDealerCards] = useState<Card[]>([]);
  const [playerCards, setPlayerCards] = useState<Card[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState<"win" | "lose" | "push" | "">("");
  const [message, setMessage] = useState("");
  const [gameStarted, setGameStarted] = useState(false);

  const newGame = useCallback(() => {
    const newDeck = shuffleDeck();
    const dCards: Card[] = [];
    const pCards: Card[] = [];

    // 庄家先抽一张明牌（欧式规则）
    dCards.push(newDeck.pop()!);
    // 玩家抽两张牌
    pCards.push(newDeck.pop()!);
    pCards.push(newDeck.pop()!);

    setDeck(newDeck);
    setDealerCards(dCards);
    setPlayerCards(pCards);
    setGameOver(false);
    setResult("");
    setMessage("");
    setGameStarted(true);
  }, []);

  const playerHit = useCallback(() => {
    if (gameOver || deck.length === 0) return;

    const newDeck = [...deck];
    const card = newDeck.pop()!;
    const newPlayerCards = [...playerCards, card];

    setDeck(newDeck);
    setPlayerCards(newPlayerCards);

    const score = calculateScore(newPlayerCards);
    if (score > 21) {
      setGameOver(true);
      setResult("lose");
      setMessage(`你爆牌了！（${score} 点）庄家胜。`);
    }
  }, [gameOver, deck, playerCards]);

  const playerStand = useCallback(() => {
    if (gameOver) return;

    const newDeck = [...deck];
    const newDealerCards = [...dealerCards];

    // 庄家抽取第二张牌
    newDealerCards.push(newDeck.pop()!);

    // 检查庄家自然 Blackjack
    if (isNaturalBlackjack(newDealerCards)) {
      if (isNaturalBlackjack(playerCards)) {
        setDealerCards(newDealerCards);
        setDeck(newDeck);
        setGameOver(true);
        setResult("push");
        setMessage("双方都是自然 Blackjack，平局！");
        return;
      } else {
        setDealerCards(newDealerCards);
        setDeck(newDeck);
        setGameOver(true);
        setResult("lose");
        setMessage("庄家自然 Blackjack！庄家胜。");
        return;
      }
    }

    // 庄家按规则要牌（17点及以上停牌）
    let dealerScore = calculateScore(newDealerCards);
    while (dealerScore < 17 && newDeck.length > 0) {
      newDealerCards.push(newDeck.pop()!);
      dealerScore = calculateScore(newDealerCards);
    }

    setDealerCards(newDealerCards);
    setDeck(newDeck);

    const playerScore = calculateScore(playerCards);

    if (dealerScore > 21) {
      setGameOver(true);
      setResult("win");
      setMessage(`庄家爆牌（${dealerScore} 点），你赢了！`);
    } else if (playerScore > dealerScore) {
      setGameOver(true);
      setResult("win");
      if (isNaturalBlackjack(playerCards)) {
        setMessage("自然 Blackjack！你赢了！");
      } else {
        setMessage(`你 ${playerScore} 点 vs 庄家 ${dealerScore} 点，你赢了！`);
      }
    } else if (playerScore === dealerScore) {
      setGameOver(true);
      setResult("push");
      setMessage(`平局！（双方各 ${playerScore} 点）`);
    } else {
      setGameOver(true);
      setResult("lose");
      setMessage(`你 ${playerScore} 点 vs 庄家 ${dealerScore} 点，庄家胜。`);
    }
  }, [gameOver, deck, dealerCards, playerCards]);

  return (
    <div className="space-y-6">
      {/* 控制按钮 */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={newGame}
          className="btn-cyber"
        >
          {gameStarted ? "重新开始" : "开始新游戏"}
        </button>
        <button
          onClick={playerHit}
          disabled={gameOver || !gameStarted}
          className="btn-cyber disabled:opacity-30 disabled:cursor-not-allowed"
        >
          要牌 (Hit)
        </button>
        <button
          onClick={playerStand}
          disabled={gameOver || !gameStarted}
          className="btn-cyber disabled:opacity-30 disabled:cursor-not-allowed"
        >
          停牌 (Stand)
        </button>
      </div>

      {/* 游戏区域 */}
      {gameStarted && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* 庄家区域 */}
          <div className="card-cyber">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-mono text-sm text-slate-400 uppercase tracking-wider">
                庄家 (Dealer)
              </h3>
              <span className="font-mono text-sm text-primary">
                {gameOver ? `(${calculateScore(dealerCards)})` : ""}
              </span>
            </div>
            <div className="cards-row">
              {dealerCards.map((card, i) => (
                <CardDisplay key={`${card.rank}-${card.suit}-${i}`} card={card} />
              ))}
            </div>
          </div>

          {/* 分隔线 */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent to-primary/20" />
            <span className="font-mono text-xs text-slate-600">VS</span>
            <div className="flex-1 h-px bg-gradient-to-l from-transparent to-primary/20" />
          </div>

          {/* 玩家区域 */}
          <div className="card-cyber">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-mono text-sm text-slate-400 uppercase tracking-wider">
                玩家 (Player)
              </h3>
              <span className="font-mono text-sm text-primary">
                ({calculateScore(playerCards)})
              </span>
            </div>
            <div className="cards-row">
              {playerCards.map((card, i) => (
                <CardDisplay key={`${card.rank}-${card.suit}-${i}`} card={card} />
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* 游戏结果 */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`game-result ${result}`}
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 未开始提示 */}
      {!gameStarted && (
        <div className="text-center py-12 font-mono text-sm text-slate-600">
          点击「开始新游戏」开始一局欧式 Blackjack
        </div>
      )}
    </div>
  );
}
