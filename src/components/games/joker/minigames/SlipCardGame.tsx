import React, { useState, useEffect, useRef } from 'react';
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

        // Auto fold cards after 60s viewing period (when displayTimer <= 50s) to start matching phase
        if (displayTimer > 50) {
            setPhase('memorize');
            setCards(fullDeck);
        } else {
            setPhase('splicing');
            setCards(fullDeck.map(c => ({ ...c, isFlipped: false })));
        }
    }, []);

    const [isScreenProtected, setIsScreenProtected] = useState(false);

    useEffect(() => {
        const triggerProtection = () => {
            setIsScreenProtected(true);
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText('');
                }
            } catch (err) { }
            setTimeout(() => setIsScreenProtected(false), 3000);
        };

        const handleBlur = () => triggerProtection();
        const handleFocus = () => setIsScreenProtected(false);
        const handleVisibility = () => {
            if (document.hidden) triggerProtection();
            else setIsScreenProtected(false);
        };

        const handleKey = (e: KeyboardEvent) => {
            const keyLower = e.key ? e.key.toLowerCase() : '';
            const codeLower = e.code ? e.code.toLowerCase() : '';
            const isFKey = keyLower.startsWith('f') && keyLower.length > 1; // F1 - F12
            const isPrtScr = keyLower.includes('print') || keyLower.includes('snapshot') || e.keyCode === 44 || codeLower.includes('print');
            const isSystemKey =
                isPrtScr ||
                e.ctrlKey ||
                e.altKey ||
                e.metaKey ||
                keyLower === 'control' ||
                keyLower === 'alt' ||
                keyLower === 'meta' ||
                keyLower === 'contextmenu' ||
                codeLower.includes('win') ||
                isFKey;

            if (isSystemKey) {
                e.preventDefault();
                e.stopPropagation();
                triggerProtection();
            }
        };

        const handleCopy = (e: ClipboardEvent) => {
            e.preventDefault();
            triggerProtection();
        };

        window.addEventListener('blur', handleBlur);
        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('keydown', handleKey, { capture: true });
        window.addEventListener('keyup', handleKey, { capture: true });
        window.addEventListener('copy', handleCopy, { capture: true });

        return () => {
            window.removeEventListener('blur', handleBlur);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('keydown', handleKey, { capture: true });
            window.removeEventListener('keyup', handleKey, { capture: true });
            window.removeEventListener('copy', handleCopy, { capture: true });
        };
    }, []);

    const hasReportedResult = useRef(false);
    const isWonRef = useRef(false);

    // Sync phase transitions based on main 110s phase timer
    useEffect(() => {
        if (displayTimer > 50) {
            if (phase !== 'memorize') setPhase('memorize');
        } else if (displayTimer <= 50 && displayTimer > 20) {
            if (phase === 'memorize') {
                setPhase('splicing');
                setCards(cList => cList.map(c => ({ ...c, isFlipped: false })));
            }
        } else if (displayTimer <= 20) {
            // Open result modal ONLY during result phase (last 20s)
            if (!hasReportedResult.current) {
                hasReportedResult.current = true;
                const won = isWonRef.current || gameResult === 'won' || matchedPairsCount >= 1;
                onComplete(won, 0);
            }
        }
    }, [displayTimer, phase, gameResult, matchedPairsCount]);

    const handleCardClick = (index: number) => {
        if (phase === 'memorize' || isAdminLocked || failedAttempts >= 5) return;
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
                // Synchronously mark win!
                isWonRef.current = true;
                setGameResult('won');
                const newCount = matchedPairsCount + 1;
                setMatchedPairsCount(newCount);

                setTimeout(() => {
                    const matchCards = [...nextCards];
                    matchCards[idx1].isMatched = true;
                    matchCards[idx2].isMatched = true;
                    setCards(matchCards);
                    setFlippedIndices([]);
                }, 300);
            } else {
                // Fail mismatch
                const newFails = failedAttempts + 1;
                setFailedAttempts(newFails);

                if (newFails >= 5) {
                    setIsAdminLocked(true);
                    if (!isWonRef.current && matchedPairsCount === 0) {
                        setGameResult('lost');
                    }
                }

                setTimeout(() => {
                    const failCards = [...nextCards];
                    failCards[idx1].isFlipped = false;
                    failCards[idx2].isFlipped = false;
                    setCards(failCards);
                    setFlippedIndices([]);
                }, 600);
            }
        }
    };

    return (
        <div className="flex flex-col items-center justify-between w-full max-w-full p-4 sm:p-6 bg-[#050508]/95 border border-slate-400/30 rounded-2xl backdrop-blur-xl shadow-[0_0_50px_rgba(226,232,240,0.15)] text-slate-100 font-mono relative select-none">
            {/* Header Dialog Aesthetic */}
            <div className="w-full pb-4 border-b border-slate-700/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                    <h3 className="font-cinzel text-xl sm:text-2xl font-black text-slate-200 uppercase tracking-widest flex items-center gap-3">
                        <Eye className="text-slate-400 animate-pulse" size={24} />
                        CARD GAME :: MATCH THE PAIRS
                    </h3>
                    <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] mt-1">
                        {phase === 'memorize' ? 'PHASE 1: MEMORIZE CARD LOCATIONS' : 'PHASE 2: FIND MATCHING PAIR'}
                    </p>
                </div>

                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest block">Phase Timer</span>
                        <span className={`text-xl font-bold font-mono ${((phase === 'memorize' ? (displayTimer - 50) : (displayTimer - 20)) <= 5) ? 'text-red-400 animate-pulse' : 'text-slate-200'}`}>
                            {formatTime(phase === 'memorize' ? Math.max(0, displayTimer - 50) : Math.max(0, displayTimer - 20))}
                        </span>
                    </div>

                    <div className="text-right">
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest block">Matched Pairs</span>
                        <span className="text-xl font-bold text-emerald-400">{matchedPairsCount}/1</span>
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
                            <Eye size={16} className="text-slate-400 animate-pulse" /> MEMORIZE ALL CARD LOCATIONS NOW
                        </>
                    ) : (
                        <>
                            <ShieldAlert size={16} className="text-slate-400" /> CLICK CARDS TO MATCH A PAIR
                        </>
                    )}
                </span>

                {gameResult !== 'playing' && (
                    <span className={`font-black text-xs uppercase tracking-widest ${gameResult === 'won' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {gameResult === 'won' ? 'YOU WON! (1 GAME CARD REWARD)' : 'GAME ENDED'}
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

            {/* 12 x 3 Square Card Grid with Anti-Screenshot Shield */}
            <div className="w-full my-3 min-h-[360px] flex items-center justify-center relative">
                {isScreenProtected ? (
                    <div className="w-full h-[360px] bg-black border-2 border-red-600 rounded-2xl flex flex-col items-center justify-center text-red-500 font-mono space-y-3 z-50 shadow-[0_0_50px_rgba(239,68,68,0.5)]">
                        <ShieldAlert size={64} className="animate-pulse text-red-500" />
                        <h2 className="text-2xl font-black uppercase tracking-widest text-red-500">SCREENSHOT PROTECTED</h2>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">MINIGAME CARDS HIDDEN FOR GAME SECURITY</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5 sm:gap-3 w-full max-w-full">
                        {cards.map((card, idx) => {
                            let suitName = 'Spades';
                            if (card.suit === '♥') suitName = 'Hearts';
                            if (card.suit === '♣') suitName = 'Clubs';
                            if (card.suit === '♦') suitName = 'Diamonds';
                            const cardImgSrc = `/borderland_cards/${suitName}_${card.value}.png`;
                            const isInteractionDisabled = phase !== 'splicing' || card.isMatched || isAdminLocked || failedAttempts >= 5;

                            return (
                                <motion.div
                                    key={card.id}
                                    whileHover={!isInteractionDisabled ? { scale: 1.06 } : {}}
                                    whileTap={!isInteractionDisabled ? { scale: 0.95 } : {}}
                                    onClick={() => handleCardClick(idx)}
                                    className={`aspect-[5/7] w-full rounded-xl border flex items-center justify-center transition-all duration-200 select-none overflow-hidden ${card.isMatched
                                            ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 opacity-60'
                                            : card.isFlipped
                                                ? 'bg-slate-900 border-slate-400 text-slate-100 shadow-[0_0_20px_rgba(226,232,240,0.25)]'
                                                : isInteractionDisabled
                                                    ? 'bg-red-950/30 border-red-900 opacity-40 cursor-not-allowed'
                                                    : 'bg-[#0a0a0f] border-slate-700/80 hover:border-slate-400/50 cursor-pointer'
                                        }`}
                                >
                                    {card.isFlipped || card.isMatched ? (
                                        <>
                                            {/* Laptop/Desktop View (sm:block): Render Real PNG Card Asset */}
                                            <img
                                                src={cardImgSrc}
                                                alt={`${card.value} of ${card.suit}`}
                                                className="hidden sm:block w-full h-full object-contain rounded-lg p-0.5 select-none"
                                            />

                                            {/* Mobile View Only (sm:hidden): Render CSS Text & Suit Shapes */}
                                            <div className={`sm:hidden w-full h-full p-1 flex flex-col justify-between items-center rounded-lg border-2 select-none relative overflow-hidden ${
                                                card.suit === '♥' || card.suit === '♦'
                                                    ? 'text-red-500 border-red-500/60 bg-gradient-to-b from-slate-900 to-red-950/40 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                                                    : 'text-cyan-300 border-cyan-500/60 bg-gradient-to-b from-slate-900 to-cyan-950/40 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                                            }`}>
                                                {/* Top Left Rank & Suit */}
                                                <div className="absolute top-0.5 left-1 flex flex-col items-start leading-none text-[9px] font-black z-10">
                                                    <span>{card.value}</span>
                                                    <span className="text-[7px] leading-none">{card.suit}</span>
                                                </div>

                                                {/* Center Large Suit Shape */}
                                                <div className="my-auto text-lg font-black drop-shadow-[0_0_12px_rgba(255,255,255,0.3)]">
                                                    {card.suit}
                                                </div>

                                                {/* Bottom Right Inverted Rank & Suit */}
                                                <div className="absolute bottom-0.5 right-1 flex flex-col items-end leading-none text-[9px] font-black rotate-180 z-10">
                                                    <span>{card.value}</span>
                                                    <span className="text-[7px] leading-none">{card.suit}</span>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        /* Sleek Cyberpunk Card Back Pattern */
                                        <div className="w-full h-full rounded-xl bg-gradient-to-br from-[#0e101c] via-[#161a2e] to-[#0a0c16] border border-cyan-500/40 p-1 flex flex-col items-center justify-center relative shadow-inner">
                                            <div className="w-full h-full border border-cyan-500/20 rounded-lg flex items-center justify-center bg-[radial-gradient(#1e2442_1px,transparent_1px)] bg-[size:8px_8px]">
                                                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-cyan-950/80 border border-cyan-400/50 rotate-45 flex items-center justify-center shadow-[0_0_10px_rgba(6,182,212,0.4)]">
                                                    <span className="-rotate-45 text-[9px] sm:text-[11px] font-black text-cyan-300 font-mono">
                                                        JK
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
