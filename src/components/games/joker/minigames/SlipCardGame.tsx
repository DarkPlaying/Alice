import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, ShieldAlert, XOctagon } from 'lucide-react';

interface SlipCardGameProps {
    timeLeft?: number;
    onComplete: (success: boolean, scoreBonus: number) => void;
}

interface CardItem {
    id: number;
    pairId: number;
    suit: string;
    value: string;
    isFlipped: boolean;
    isMatched: boolean;
}

export const SlipCardGame: React.FC<SlipCardGameProps> = ({ timeLeft: mainTimeLeft, onComplete }) => {
    const [phase, setPhase] = useState<'memorize' | 'splicing'>('memorize');
    const [cards, setCards] = useState<CardItem[]>([]);
    const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
    const [matchedPairsCount, setMatchedPairsCount] = useState(0);
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [gameResult, setGameResult] = useState<'playing' | 'won' | 'lost'>('playing');
    const [isAdminLocked, setIsAdminLocked] = useState(false);

    // Format seconds into M:SS (e.g., 90 -> 1:30)
    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    // Use main timer passed from parent header or fallback
    const displayTimer = mainTimeLeft !== undefined ? mainTimeLeft : 60;

    // Initialize 6x6 Grid (36 Cards = 18 Pairs)
    useEffect(() => {
        const suits = ['♠', '♥', '♣', '♦'];
        const values = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6'];
        const pairs: Array<{ pairId: number; suit: string; value: string }> = [];

        for (let i = 0; i < 18; i++) {
            pairs.push({
                pairId: i,
                suit: suits[i % suits.length],
                value: values[i % values.length]
            });
        }

        const fullDeck: CardItem[] = [];
        let cardId = 0;
        pairs.forEach(p => {
            fullDeck.push({ id: cardId++, pairId: p.pairId, suit: p.suit, value: p.value, isFlipped: true, isMatched: false });
            fullDeck.push({ id: cardId++, pairId: p.pairId, suit: p.suit, value: p.value, isFlipped: true, isMatched: false });
        });

        // Fisher-Yates Shuffle
        for (let i = fullDeck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [fullDeck[i], fullDeck[j]] = [fullDeck[j], fullDeck[i]];
        }

        setCards(fullDeck);

        // Auto fold cards after 15s viewing period to start matching phase
        const foldTimer = setTimeout(() => {
            setPhase('splicing');
            setCards(cList => cList.map(c => ({ ...c, isFlipped: false })));
        }, 15000);

        return () => clearTimeout(foldTimer);
    }, []);

    // Check phase timer expiration
    useEffect(() => {
        if (displayTimer <= 0 && gameResult === 'playing') {
            handleGameOver(false);
        }
    }, [displayTimer, gameResult]);

    const handleCardClick = (index: number) => {
        if (phase === 'memorize' || gameResult !== 'playing' || isAdminLocked) return;
        if (cards[index].isMatched || cards[index].isFlipped) return;
        if (flippedIndices.length >= 2) return;

        const nextCards = [...cards];
        nextCards[index].isFlipped = true;
        setCards(nextCards);

        const newFlipped = [...flippedIndices, index];
        setFlippedIndices(newFlipped);

        if (newFlipped.length === 2) {
            const idx1 = newFlipped[0];
            const idx2 = newFlipped[1];

            if (nextCards[idx1].pairId === nextCards[idx2].pairId) {
                // Match!
                setTimeout(() => {
                    const matchCards = [...nextCards];
                    matchCards[idx1].isMatched = true;
                    matchCards[idx2].isMatched = true;
                    setCards(matchCards);
                    setFlippedIndices([]);
                    const newCount = matchedPairsCount + 1;
                    setMatchedPairsCount(newCount);

                    if (newCount >= 5) {
                        handleGameOver(true);
                    }
                }, 400);
            } else {
                // Fail mismatch
                setTimeout(() => {
                    const failCards = [...nextCards];
                    failCards[idx1].isFlipped = false;
                    failCards[idx2].isFlipped = false;
                    setCards(failCards);
                    setFlippedIndices([]);
                    const newFails = failedAttempts + 1;
                    setFailedAttempts(newFails);

                    if (newFails >= 5) {
                        setIsAdminLocked(true);
                        handleGameOver(false);
                    }
                }, 700);
            }
        }
    };

    const handleGameOver = (won: boolean) => {
        setGameResult(won ? 'won' : 'lost');
        setTimeout(() => {
            onComplete(won, won ? 300 : 0);
        }, 1500);
    };

    return (
        <div className="flex flex-col items-center justify-between w-full max-w-4xl p-4 sm:p-6 bg-[#050508]/95 border border-slate-400/30 rounded-2xl backdrop-blur-xl shadow-[0_0_50px_rgba(226,232,240,0.15)] text-slate-100 font-mono relative select-none">
            {/* Header Dialog Aesthetic */}
            <div className="w-full pb-4 border-b border-slate-700/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                    <h3 className="font-cinzel text-xl sm:text-2xl font-black text-slate-200 uppercase tracking-widest flex items-center gap-3">
                        <Eye className="text-slate-400 animate-pulse" size={24} />
                        SLIP THE CARD :: PAIR PROTOCOL
                    </h3>
                    <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] mt-1">
                        {phase === 'memorize' ? 'PHASE 1: MEMORIZATION (VIEWING CARDS)' : 'PHASE 2: MATCH 5 PAIRS (SPLICING)'}
                    </p>
                </div>

                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest block">Phase Timer</span>
                        <span className={`text-xl font-bold font-mono ${displayTimer <= 15 ? 'text-red-400 animate-pulse' : 'text-slate-200'}`}>
                            {formatTime(displayTimer)}
                        </span>
                    </div>

                    <div className="text-right">
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest block">Matched Pairs</span>
                        <span className="text-xl font-bold text-emerald-400">{matchedPairsCount}/5</span>
                    </div>

                    <div className="text-right">
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest block">Fails Left</span>
                        <span className={`text-xl font-bold ${failedAttempts >= 5 ? 'text-red-500 font-black' : 'text-slate-300'}`}>
                            {Math.max(0, 5 - failedAttempts)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Status Bar */}
            <div className="w-full my-3 p-3 bg-slate-900/60 border border-slate-700/50 rounded-lg flex items-center justify-between text-xs">
                <span className="text-slate-300 font-bold uppercase tracking-widest flex items-center gap-2">
                    {phase === 'memorize' ? (
                        <>
                            <Eye size={16} className="text-slate-400 animate-pulse" /> MEMORIZE ALL CARD LOCATIONS BEFORE FOLD
                        </>
                    ) : (
                        <>
                            <ShieldAlert size={16} className="text-slate-400" /> SLIP CARDS TO MATCH 5 PAIRS
                        </>
                    )}
                </span>

                {gameResult !== 'playing' && (
                    <span className={`font-black text-xs uppercase tracking-widest ${gameResult === 'won' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {gameResult === 'won' ? 'PROTOCOL CLEARED (+300 CR)' : 'PROTOCOL ENDED (0 CR DEDUCTION - NO MINUS)'}
                    </span>
                )}
            </div>

            {/* Admin 5 Fails Warning Lockdown Modal */}
            <AnimatePresence>
                {isAdminLocked && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="w-full my-3 p-4 bg-red-950/90 border-2 border-red-500 rounded-xl flex flex-col items-center text-center space-y-2 text-red-200 shadow-[0_0_30px_rgba(239,68,68,0.5)] z-20"
                    >
                        <div className="flex items-center gap-2 text-red-400 font-black uppercase tracking-widest text-sm">
                            <XOctagon size={20} className="animate-bounce" />
                            <span>5 WRONG ATTEMPTS REACHED — PROTOCOL LOCKED</span>
                        </div>
                        <p className="text-[10px] text-red-300 uppercase tracking-widest font-mono">
                            ADMIN SECURITY LOCKDOWN ACTIVATED // CARD SPLICING SUSPENDED FOR THIS ROUND
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 6x6 Card Grid fits in single screen view without scrolling */}
            <div className="w-full max-w-2xl sm:max-w-3xl my-1">
                <div className="grid grid-cols-6 gap-1.5 sm:gap-2 w-full">
                    {cards.map((card, idx) => {
                        let suitName = 'Spades';
                        if (card.suit === '♥') suitName = 'Hearts';
                        if (card.suit === '♣') suitName = 'Clubs';
                        if (card.suit === '♦') suitName = 'Diamonds';
                        const cardImgSrc = `/borderland_cards/${suitName}_${card.value}.png`;

                        return (
                            <motion.div
                                key={card.id}
                                whileHover={phase === 'splicing' && !card.isMatched && !isAdminLocked ? { scale: 1.05 } : {}}
                                whileTap={phase === 'splicing' && !card.isMatched && !isAdminLocked ? { scale: 0.95 } : {}}
                                onClick={() => handleCardClick(idx)}
                                className={`aspect-[2/3] max-h-[75px] sm:max-h-[95px] rounded-lg border flex flex-col items-center justify-center cursor-pointer transition-all duration-200 select-none overflow-hidden ${
                                    card.isMatched
                                        ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 opacity-60'
                                        : card.isFlipped
                                        ? 'bg-slate-900 border-slate-400 text-slate-100 shadow-[0_0_15px_rgba(226,232,240,0.2)]'
                                        : isAdminLocked
                                        ? 'bg-red-950/30 border-red-900 opacity-40 cursor-not-allowed'
                                        : 'bg-[#0a0a0f] border-slate-700/80 hover:border-slate-400/50'
                                }`}
                            >
                                {card.isFlipped || card.isMatched ? (
                                    <img
                                        src={cardImgSrc}
                                        alt={`${card.value} of ${card.suit}`}
                                        className="w-full h-full object-cover rounded-lg"
                                    />
                                ) : (
                                    <img
                                        src="/specialcard_joker/game.png"
                                        alt="Joker Card Back"
                                        className="w-full h-full object-cover rounded-lg opacity-80 hover:opacity-100 transition-opacity"
                                    />
                                )}
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
