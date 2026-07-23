/**
 * DemoDiamondsGame — A fully local simulation of the Diamonds game.
 * 
 * Features:
 * - Local simulation of the Diamonds game.
 * - Player gets 5 random cards + 1 Zombie + 1 Shotgun.
 * - Bot gets 5 random cards and always places its 1 least value card in slot 0.
 * - Easy victory for the player, leading to the picking phase.
 * - In picking phase, player picks the card from the bot, then game completes with a contact admin banner.
 * - Zero Supabase writes — fully client-side.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Skull, Timer, CheckCircle2, AlertTriangle, X, Activity, Scan, Info, Shield, Syringe, Biohazard, User, ChevronRight } from 'lucide-react';
import { getCardImagePath } from '../../game/diamonds';
import type { DiamondsCard } from '../../game/diamonds';

type DemoPhase = 'briefing' | 'slotting' | 'evaluation' | 'picking' | 'result';

const DEMO_START_SCORE = 1000;
const BOT_ID = 'demo-bot';

const PHASE_DURATIONS: Record<DemoPhase, number> = {
    briefing: 6,
    slotting: 60,
    evaluation: 10,
    picking: 30,
    result: 0
};

interface DemoDiamondsGameProps {
    user?: any;
    onClose?: () => void;
}

export const DemoDiamondsGame: React.FC<DemoDiamondsGameProps> = ({ user, onClose }) => {
    const myId = user?.id || 'demo-user';
    const myName = user?.username || 'DEMO';

    // ── State ──────────────────────────────────────────────────────────────
    const [phase, setPhase] = useState<DemoPhase>('briefing');
    const [timeLeft, setTimeLeft] = useState(PHASE_DURATIONS.briefing);
    const [myScore, setMyScore] = useState(DEMO_START_SCORE);
    const [botScore, setBotScore] = useState(DEMO_START_SCORE);
    const [isLocked, setIsLocked] = useState(false);
    const [hasPicked, setHasPicked] = useState(false);
    const [showRulesModal, setShowRulesModal] = useState(false);
    const [selectedSteal, setSelectedSteal] = useState<DiamondsCard | null>(null);

    // Toast System
    const [protocolToasts, setProtocolToasts] = useState<{ id: string, message: string, type: 'info' | 'error' | 'success' }[]>([]);
    const addToast = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
        const id = Math.random().toString(36).substring(2, 9);
        setProtocolToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setProtocolToasts(prev => prev.filter(t => t.id !== id)), 4000);
    };

    // Cards State
    const [myHand, setMyHand] = useState<DiamondsCard[]>([]);
    const [mySlots, setMySlots] = useState<(DiamondsCard | null)[]>([null, null, null, null, null]);
    const [botHand, setBotHand] = useState<DiamondsCard[]>([]);
    const [botSlots, setBotSlots] = useState<(DiamondsCard | null)[]>([null, null, null, null, null]);

    // Timer Refs
    const phaseTimerRef = useRef<NodeJS.Timeout | null>(null);
    const countdownRef = useRef<NodeJS.Timeout | null>(null);

    // Helper to generate a random card
    const generateStandardCard = (id: string): DiamondsCard => {
        const suits = ['spades', 'hearts', 'clubs', 'diamonds'];
        const suit = suits[Math.floor(Math.random() * 4)];
        const val = Math.floor(Math.random() * 13) + 2; // 2 to 14
        const rank = val === 11 ? 'J' : val === 12 ? 'Q' : val === 13 ? 'K' : val === 14 ? 'A' : val.toString();
        return {
            id,
            type: 'standard',
            rank,
            suit,
            value: val
        };
    };

    // Initialize Hands
    useEffect(() => {
        // Player: 5 standard cards + 1 Zombie + 1 Shotgun
        const pHand: DiamondsCard[] = [
            generateStandardCard('player-c1'),
            generateStandardCard('player-c2'),
            generateStandardCard('player-c3'),
            generateStandardCard('player-c4'),
            generateStandardCard('player-c5'),
            {
                id: 'player-zombie',
                type: 'special',
                specialType: 'zombie',
                suit: 'special',
                value: 0,
                metadata: { usesRemaining: 1 }
            },
            {
                id: 'player-shotgun',
                type: 'special',
                specialType: 'shotgun',
                suit: 'special',
                value: 0,
                metadata: { usesRemaining: 1 }
            }
        ];

        // Bot: 5 standard cards
        const bHand: DiamondsCard[] = [
            generateStandardCard('bot-c1'),
            generateStandardCard('bot-c2'),
            generateStandardCard('bot-c3'),
            generateStandardCard('bot-c4'),
            generateStandardCard('bot-c5')
        ];

        setMyHand(pHand);
        setBotHand(bHand);

        // Prep Bot Slots: Bot always places 1 card (its least value card)
        const sortedBot = [...bHand].sort((a, b) => a.value - b.value);
        const leastCard = sortedBot[0];
        setBotSlots([leastCard, null, null, null, null]);
    }, []);

    // ── Advance Phase ──────────────────────────────────────────────────────
    const advancePhase = useCallback((current: DemoPhase) => {
        const transitions: Record<DemoPhase, DemoPhase | null> = {
            briefing: 'slotting',
            slotting: 'evaluation',
            evaluation: 'picking',
            picking: 'result',
            result: null
        };
        const next = transitions[current];
        if (next) {
            setPhase(next);
            setTimeLeft(PHASE_DURATIONS[next]);
            if (next === 'evaluation') {
                // Deduct score or evaluate winner
                setMyScore(prev => prev + 200);
                setBotScore(prev => Math.max(0, prev - 100));
                addToast("VICTORY SECURED. DUEL EVALUATED.", "success");
            }
        }
    }, []);

    // ── Timer ──────────────────────────────────────────────────────────────
    useEffect(() => {
        if (phase === 'result') return;

        if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);

        const duration = PHASE_DURATIONS[phase];
        setTimeLeft(duration);

        countdownRef.current = setInterval(() => {
            setTimeLeft(prev => Math.max(0, prev - 1));
        }, 1000);

        phaseTimerRef.current = setTimeout(() => {
            advancePhase(phase);
        }, duration * 1000);

        return () => {
            if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
    }, [phase, advancePhase]);

    // ── Handlers ───────────────────────────────────────────────────────────
    const handleSlotCard = (card: DiamondsCard, slotIndex: number) => {
        if (phase !== 'slotting' || isLocked) return;

        const newSlots = [...mySlots];
        // Remove from existing slot if present
        const existingIdx = newSlots.findIndex(s => s?.id === card.id);
        if (existingIdx !== -1) newSlots[existingIdx] = null;

        newSlots[slotIndex] = card;
        setMySlots(newSlots);
    };

    const handleUnslotCard = (index: number) => {
        if (phase !== 'slotting' || isLocked) return;
        const newSlots = [...mySlots];
        newSlots[index] = null;
        setMySlots(newSlots);
    };

    const handleConfirmSlots = () => {
        const count = mySlots.filter(s => s !== null).length;
        if (count === 0) {
            alert("MUST DEPLOY AT LEAST 1 ASSET FOR BATTLE");
            return;
        }
        setIsLocked(true);
        addToast("ASSETS LOCKED. SYNCHRONIZING DEPLOYMENT ARRAY...", "info");
        setTimeout(() => {
            advancePhase('slotting');
        }, 1500);
    };

    const handleStealCard = (card: DiamondsCard) => {
        if (phase !== 'picking' || hasPicked) return;
        setSelectedSteal(card);
        setHasPicked(true);
        addToast(`EXTRACTION COMPLETE: ${card.rank || ''}${card.suit ? card.suit.charAt(0).toUpperCase() : ''} TRANSFERRED.`, "success");
        setTimeout(() => {
            advancePhase('picking');
        }, 2000);
    };

    // Calculate Slot resolution details for evaluation phase
    const getSlotDetails = () => {
        return mySlots.map((mySlot, idx) => {
            const botSlot = botSlots[idx];
            let outcome = 'DRAW';
            let p1Val = 0;
            let p2Val = 0;

            if (mySlot) {
                if (mySlot.type === 'special') {
                    p1Val = 999;
                } else {
                    p1Val = mySlot.value;
                }
            }
            if (botSlot) {
                p2Val = botSlot.value;
            }

            if (p1Val > p2Val) outcome = 'VICTORY';
            else if (p1Val < p2Val) outcome = 'DEFEAT';

            return {
                p1Val,
                p2Val,
                p1Card: mySlot,
                p2Card: botSlot,
                outcome
            };
        });
    };

    const slotDetails = getSlotDetails();

    return (
        <div className="relative w-full min-h-screen bg-black flex flex-col font-sans overflow-y-auto text-white selection:bg-purple-500/30">

            {/* Header / HUD */}
            <header className="fixed top-0 left-0 right-0 z-[150] bg-black border-b border-purple-500/20 px-4 py-3 sm:px-8 sm:py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {/* Exit */}
                        <button
                            onClick={() => window.location.href = '/home/card'}
                            className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 hover:text-red-300 transition-all flex-shrink-0"
                            title="Exit game"
                        >
                            <X size={14} />
                        </button>
                        <div className="hidden sm:flex flex-col border-r border-white/10 pr-4">
                            <span className="text-[10px] font-black text-white/40 tracking-[0.4em] uppercase leading-none mb-1">NETWORK</span>
                            <span className="text-xs font-black text-purple-500 uppercase tracking-widest leading-none">BORDERLAND</span>
                        </div>
                        <div className="flex flex-col">
                            <h2 className="text-[10px] sm:text-xs font-cinzel font-black text-purple-500 tracking-[0.3em] uppercase leading-none mb-1">
                                DIAMONDS TRIAL — DEMO
                            </h2>
                            <h1 className="text-sm sm:text-lg font-black font-oswald text-white tracking-widest uppercase leading-none">
                                LOGIC PROTOCOL
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowRulesModal(true)}
                            className="p-2 sm:px-4 sm:py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded text-purple-500 transition-all active:scale-95"
                        >
                            <span className="hidden sm:inline font-mono text-[11px] tracking-widest uppercase">SYNOPSIS</span>
                            <Info size={18} className="sm:hidden" />
                        </button>

                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                            <span className="text-[10px] font-mono tracking-[0.2em] text-gray-300 uppercase">
                                {myName.toUpperCase()}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto mt-3 pt-3 border-t border-white/5 flex items-center justify-around sm:justify-end sm:gap-8">
                    <div className="flex flex-col items-center sm:items-end">
                        <p className="text-[7px] sm:text-[9px] text-purple-300/40 font-mono uppercase tracking-[0.2em]">ROUND</p>
                        <p className="text-sm sm:text-xl font-black font-oswald text-white">
                            1<span className="text-purple-900 text-[10px] sm:text-sm">/1</span>
                        </p>
                    </div>

                    <div className="w-px h-6 bg-white/10 sm:hidden" />

                    <div className="flex flex-col items-center sm:items-end">
                        <p className="text-[7px] sm:text-[9px] text-purple-300/40 font-mono uppercase tracking-[0.2em]">TIMER</p>
                        <div className="flex items-center gap-1.5">
                            <Timer size={12} className="text-purple-500 animate-pulse sm:w-4 sm:h-4" />
                            <p className="text-sm sm:text-xl font-black font-oswald tabular-nums text-purple-500">
                                {timeLeft}s
                            </p>
                        </div>
                    </div>

                    <div className="w-px h-6 bg-white/10 sm:hidden" />

                    <div className="flex flex-col items-center sm:items-end bg-purple-500/10 px-3 py-1 sm:px-4 sm:py-1.5 rounded border border-purple-500/20">
                        <p className="text-[7px] sm:text-[9px] text-purple-400/70 font-mono uppercase tracking-[0.2em]">CREDITS</p>
                        <p className="text-sm sm:text-xl font-black font-oswald text-purple-400">
                            {myScore}
                        </p>
                    </div>
                </div>
            </header>

            {/* SYNOPSIS Modal */}
            <AnimatePresence>
                {showRulesModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[2000] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6"
                        onClick={() => setShowRulesModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            className="max-w-md w-full bg-zinc-950 border border-purple-500/30 p-8 rounded-3xl shadow-[0_0_50px_rgba(168,85,247,0.2)]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
                                <h3 className="text-2xl font-black font-oswald tracking-widest text-purple-500 uppercase">TRIAL SYNOPSIS</h3>
                                <button onClick={() => setShowRulesModal(false)} className="text-white/40 hover:text-white transition-colors">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <p className="text-[10px] font-black font-mono text-purple-400 uppercase tracking-widest">Asset Hierarchy</p>
                                    <div className="grid grid-cols-1 gap-3">
                                        <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                                                <span className="text-xs font-black font-cinzel text-white">ZOMBIE</span>
                                            </div>
                                            <span className="text-[10px] font-mono text-white/40">BEATS ALL NUMBERS</span>
                                        </div>
                                        <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
                                                <span className="text-xs font-black font-cinzel text-white">SHOTGUN</span>
                                            </div>
                                            <span className="text-[10px] font-mono text-white/40">ELIMINATES TARGETS</span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setShowRulesModal(false)}
                                    className="w-full py-4 mt-4 bg-purple-600 hover:bg-purple-500 text-white font-black font-oswald uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95"
                                >
                                    ACKNOWLEDGE
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* MAIN STAGE */}
            <main className="flex-1 overflow-y-auto p-2 sm:p-4 pt-[100px] sm:pt-[110px] pb-56 relative z-10 flex flex-col items-center">
                {/* PHASE INDICATOR */}
                <div className="mb-4 text-center px-4">
                    <motion.div key={phase} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-2">
                        <h2 className="text-3xl font-black text-white uppercase tracking-widest font-mono">
                            {phase === 'slotting' ? "DEPLOYMENT PHASE" :
                                phase === 'evaluation' ? "COMBAT RESOLUTION" :
                                    phase === 'picking' ? "ASSET EXTRACTION" :
                                        phase.toUpperCase()}
                        </h2>
                        <p className="text-purple-500/40 text-xs font-mono uppercase tracking-[0.3em]">
                            {phase === 'slotting' ? "ARRANGE YOUR 5-SLOT BATTLE ARRAY" :
                                phase === 'evaluation' ? "COMPARING COMMITTED SIGNATURES" :
                                    phase === 'picking' ? "HARVEST 1 CARD FROM NEUTRALIZED OPPONENT" :
                                        "DIAMONDS PROTOCOL"}
                        </p>
                    </motion.div>
                </div>

                {/* Briefing View */}
                {phase === 'briefing' && (
                    <motion.div
                        key="briefing"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="bg-black/40 border border-purple-900/30 p-4 sm:p-6 max-w-xl mx-auto backdrop-blur-sm rounded-lg w-full shadow-2xl flex-1 flex flex-col justify-center mt-10"
                    >
                        <h2 className="text-xl sm:text-2xl font-black font-cinzel text-purple-500 mb-4 text-center tracking-[0.1em] sm:tracking-[0.2em] drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]">
                            PROTOCOL BRIEFING
                        </h2>
                        <div className="space-y-4 text-xs sm:text-sm font-mono text-slate-300 leading-relaxed">
                            <div className="p-3 bg-yellow-500/10 border-l-2 border-yellow-500">
                                <h3 className="text-white font-bold mb-1">TABLE ASSIGNMENT: DEMO-BOT</h3>
                                <p>You have been assigned to face DEMO-BOT.</p>
                            </div>
                            <div className="p-3 bg-purple-900/10 border-l-2 border-purple-500">
                                <h3 className="text-white font-bold flex items-center gap-2 mb-1">
                                    <Shield size={14} /> OBJECTIVE
                                </h3>
                                <p className="mb-1">Place standard and specialty cards to beat the bot's deployment. In this demo, you play 1 round.</p>
                            </div>
                            <div className="p-3 bg-red-900/10 border-l-2 border-red-500">
                                <h3 className="text-white font-bold mb-1">SCORING</h3>
                                <ul className="space-y-0.5 text-xs">
                                    <li>• Zombie (Red Face Card): <span className="text-red-400">BEATS ALL NUMBERS</span></li>
                                    <li>• Shotgun (Black Face Card): <span className="text-orange-400">ELIMINATES TARGETS</span></li>
                                </ul>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* slotting / evaluation / picking stage */}
                {['slotting', 'evaluation', 'picking'].includes(phase) && (
                    <div className="w-full max-w-5xl space-y-12">
                        {/* Slots visual */}
                        <div className="flex justify-center gap-3 sm:gap-6">
                            {mySlots.map((slot, i) => (
                                <div
                                    key={`slot-${i}`}
                                    className={`relative w-16 h-24 sm:w-24 sm:h-32 rounded-xl border-2 flex items-center justify-center transition-all duration-300 ${slot
                                        ? 'border-purple-500 bg-purple-900/20 shadow-[0_0_20px_rgba(168,85,247,0.2)]'
                                        : 'border-white/10 bg-white/5 hover:border-white/20'
                                        }`}
                                >
                                    {slot ? (
                                        <>
                                            <CardVisual card={slot} size="full" />
                                            {phase === 'slotting' && !isLocked && (
                                                <button
                                                    onClick={() => handleUnslotCard(i)}
                                                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-red-500 z-[60]"
                                                >
                                                    <X size={12} strokeWidth={3} />
                                                </button>
                                            )}
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center gap-1 opacity-20 text-center">
                                            <span className="text-[8px] font-black uppercase tracking-widest text-purple-500">PKT-0{i + 1}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* evaluation Phase Table */}
                        {phase === 'evaluation' && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="max-w-xl mx-auto w-full bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden shadow-2xl"
                            >
                                <div className="bg-white/[0.05] px-4 py-3 border-b border-white/5 flex justify-between items-center">
                                    <span className="text-xs font-black uppercase tracking-wider text-purple-400">Conflict Matrix</span>
                                    <span className="text-[10px] font-mono text-white/40">SYSTEM VERDICT</span>
                                </div>
                                <table className="w-full text-xs font-mono border-collapse">
                                    <thead>
                                        <tr className="border-b border-white/10 text-gray-500 text-[9px] uppercase tracking-widest">
                                            <th className="py-3 px-4 text-left">Slot</th>
                                            <th className="py-3 px-4 text-center">YOU</th>
                                            <th className="py-3 px-4 text-center">DEMO-BOT</th>
                                            <th className="py-3 px-4 text-right">OUTCOME</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.03]">
                                        {slotDetails.map((slot, idx) => (
                                            <tr key={idx} className="hover:bg-white/[0.01]">
                                                <td className="py-3 px-4 text-left text-white/30">PKT-0{idx + 1}</td>
                                                <td className="py-3 px-4 text-center">
                                                    {slot.p1Card ? (
                                                        <span className="font-bold">
                                                            {slot.p1Card.specialType ? slot.p1Card.specialType.toUpperCase() : `${slot.p1Card.rank}${slot.p1Card.suit?.charAt(0).toUpperCase()}`}
                                                        </span>
                                                    ) : '-'}
                                                </td>
                                                <td className="py-3 px-4 text-center text-white/50">
                                                    {slot.p2Card ? (
                                                        <span>
                                                            {slot.p2Card.specialType ? slot.p2Card.specialType.toUpperCase() : `${slot.p2Card.rank}${slot.p2Card.suit?.charAt(0).toUpperCase()}`}
                                                        </span>
                                                    ) : '-'}
                                                </td>
                                                <td className={`py-3 px-4 text-right font-bold ${slot.outcome === 'VICTORY' ? 'text-green-400' : slot.outcome === 'DEFEAT' ? 'text-red-400' : 'text-white/40'}`}>
                                                    {slot.outcome}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-purple-500/10">
                                            <td className="py-4 px-4 text-left text-purple-400 font-bold uppercase">NET RESULT</td>
                                            <td className="py-4 px-4 text-center text-green-400 font-black text-sm">SURVIVED</td>
                                            <td className="py-4 px-4 text-center text-red-500 font-black text-sm">DEFEATED</td>
                                            <td className="py-4 px-4 text-right text-purple-400 font-black">VICTORY</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </motion.div>
                        )}

                        {/* picking Phase Stealing Card */}
                        {phase === 'picking' && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="max-w-md mx-auto w-full bg-zinc-950/80 border border-purple-500/20 rounded-[30px] p-6 sm:p-8 backdrop-blur-xl text-center space-y-6"
                            >
                                <div className="flex items-center gap-3 justify-center mb-4">
                                    <div className="w-2 h-2 bg-purple-500 rounded-full shadow-[0_0_10px_#a855f7]" />
                                    <h4 className="font-mono text-purple-400 text-xs uppercase tracking-widest font-black">
                                        DEMO-BOT :: Neutralized
                                    </h4>
                                </div>
                                <p className="text-white/60 text-xs leading-relaxed">
                                    Harvest one deployed card from the bot's array to conclude your logic victory.
                                </p>
                                <div className="flex justify-center gap-4 py-4">
                                    {botSlots.filter(s => s !== null).map((card, idx) => (
                                        <motion.div
                                            key={idx}
                                            drag
                                            dragSnapToOrigin
                                            dragElastic={0.2}
                                            whileDrag={{ scale: 1.15, zIndex: 100, boxShadow: "0 20px 40px rgba(168,85,247,0.5)" }}
                                            whileHover={{ y: -5, scale: 1.05 }}
                                            onDragEnd={() => card && handleStealCard(card)}
                                            className={`cursor-grab active:cursor-grabbing rounded-2xl p-1 transition-all ${selectedSteal?.id === card?.id ? 'ring-2 ring-purple-500 bg-purple-500/20' : ''}`}
                                            onClick={() => card && handleStealCard(card)}
                                        >
                                            {card && <CardVisual card={card} size="default" />}
                                        </motion.div>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {/* player Hand Selection */}
                        {phase === 'slotting' && (
                            <div className="w-full border-t border-white/5 pt-8 flex flex-col items-center">
                                <span className="text-[10px] font-mono text-white/30 uppercase tracking-[0.4em] mb-4">
                                    Tactical Assets Available ({myHand.filter(c => !mySlots.some(s => s?.id === c.id)).length})
                                </span>
                                <div className="flex flex-wrap justify-center gap-4 py-4 max-w-3xl">
                                    {myHand.map(card => {
                                        const isSlotted = mySlots.some(s => s?.id === card.id);
                                        if (isSlotted) return null;

                                        return (
                                            <motion.div
                                                key={card.id}
                                                whileHover={{ y: -8, scale: 1.05 }}
                                                className="cursor-pointer shrink-0"
                                                onClick={() => {
                                                    const emptyIdx = mySlots.findIndex(s => s === null);
                                                    if (emptyIdx !== -1) handleSlotCard(card, emptyIdx);
                                                }}
                                            >
                                                <CardVisual card={card} />
                                            </motion.div>
                                        );
                                    })}
                                </div>

                                {/* Confirmation Button */}
                                <div className="mt-8">
                                    <button
                                        onClick={handleConfirmSlots}
                                        disabled={isLocked}
                                        className={`px-16 py-5 font-black uppercase tracking-widest text-xs transition-all duration-300 rounded ${isLocked ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500 text-black shadow-lg shadow-purple-500/20'}`}
                                    >
                                        {isLocked ? "ASSETS COMMITTED" : "AUTHORIZE DEPLOYMENT"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Final Result / contact admin screen */}
                {phase === 'result' && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="fixed inset-0 z-50 flex flex-col items-center justify-start pt-16 sm:pt-20 gap-6 sm:gap-10 bg-black/95 overflow-y-auto pb-12"
                    >
                        <div className="mt-4 px-4 py-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded-full text-yellow-400 text-[10px] font-mono tracking-widest uppercase">
                            DEMO ROUND COMPLETE
                        </div>

                        <div className="text-center flex flex-col gap-4">
                            <h1 className="text-2xl sm:text-5xl font-black font-cinzel text-white tracking-widest uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] px-4">
                                LOGIC PROTOCOL COMPLETE
                            </h1>
                            <h2 className="text-xs md:text-sm font-bold font-mono text-green-500 tracking-[0.4em] uppercase italic">
                                VITALITY CHECK // PASSED
                            </h2>
                        </div>

                        {/* Left / Right Column Result Screen */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-stretch justify-center w-full max-w-5xl gap-6 px-4 z-10">
                            {/* Left Side: Contact Admin CTA */}
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.2 }}
                                className="w-full sm:w-1/2 flex flex-col justify-center"
                            >
                                <div className="relative overflow-hidden bg-gradient-to-br from-red-950/60 to-black/80 border border-red-500/30 rounded-3xl p-8 text-center shadow-[0_0_30px_rgba(255,0,80,0.1)] h-full flex flex-col justify-center">
                                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-60" />
                                    <p className="text-xs font-mono text-red-400/60 uppercase tracking-[0.4em] mb-4">DEMO LIMITATION</p>
                                    <p className="text-white font-bold font-cinzel tracking-widest text-xl sm:text-2xl mb-4">
                                        WANT TO PLAY THE REAL GAME?
                                    </p>
                                    <p className="text-white/50 font-mono text-sm leading-relaxed mb-8">
                                        This was a 1-round demo simulation.<br />
                                        The real Diamonds Trial has 5 rounds, real opponents,<br />
                                        and actual Visa Points at stake.
                                    </p>
                                    <div className="flex items-center justify-center gap-3 flex-wrap">
                                        <div className="px-6 py-3 bg-red-500/10 border border-red-500/30 rounded-full">
                                            <span className="text-red-400 font-mono text-xs uppercase tracking-widest">
                                                📡 Contact an Admin to unlock your player access
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>

                            {/* Right Side Stack: Stats & Score */}
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.4 }}
                                className="w-full sm:w-1/2 flex flex-col gap-4 relative"
                            >
                                {/* Net Merit */}
                                <div className="w-full flex flex-col items-center justify-center relative p-6 sm:p-8 rounded-2xl bg-zinc-950/80 border border-white/10 shadow-2xl backdrop-blur-xl">
                                    <p className="text-zinc-500 font-mono text-[10px] sm:text-xs uppercase tracking-[0.4em] mb-2 relative z-10">NET MERIT</p>
                                    <p className="text-5xl sm:text-7xl font-black font-oswald text-white relative z-10">{myScore}</p>
                                </div>

                                {/* Condition */}
                                <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex flex-col gap-3">
                                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                        <span className="text-zinc-500 text-xs sm:text-[10px] font-mono tracking-widest uppercase">CONDITION</span>
                                        <span className="text-sm sm:text-xs font-bold font-mono tracking-[0.2em] uppercase text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.4)]">
                                            SURVIVED
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                        <span className="text-zinc-500 text-xs sm:text-[10px] font-mono tracking-widest uppercase">VICTORY REASON</span>
                                        <span className="text-xs font-bold font-mono text-purple-300 uppercase tracking-wider text-right max-w-[200px]">
                                            {(() => {
                                                const hasMyZombie = mySlots.some(s => s?.specialType === 'zombie');
                                                const hasMyShotgun = mySlots.some(s => s?.specialType === 'shotgun');
                                                const hasMyInjection = mySlots.some(s => s?.specialType === 'injection');
                                                const hasBotZombie = botSlots.some(s => s?.specialType === 'zombie');
                                                const hasBotShotgun = botSlots.some(s => s?.specialType === 'shotgun');
                                                const hasBotInjection = botSlots.some(s => s?.specialType === 'injection');

                                                if (hasMyShotgun && hasBotZombie) return "Zombie Neutralized by Shotgun (+100 CR)";
                                                if (hasMyInjection && hasBotZombie) return "Zombie Cured by Injection (+200 CR)";
                                                if (hasMyZombie && hasBotShotgun) return "Zombie Destroyed by Shotgun";
                                                if (hasMyZombie && hasBotInjection) return "Zombie Cured by Injection";
                                                if ((hasMyZombie || hasBotZombie) && (hasMyShotgun || hasBotShotgun || hasMyInjection || hasBotInjection)) return "Special Array Collision (Zombie vs Anti-Special)";
                                                if (hasMyZombie) return "Active Zombie Supremacy (+999 pt)";

                                                return "Higher Array Points (+200 CR)";
                                            })()}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-zinc-500 text-xs sm:text-[10px] font-mono tracking-widest uppercase">STOLEN ASSET</span>
                                        <span className="text-xs font-bold font-mono text-purple-400 uppercase">
                                            {selectedSteal ? `${selectedSteal.rank || ''}${selectedSteal.suit?.charAt(0).toUpperCase() || ''}` : '-'}
                                        </span>
                                    </div>
                                </div>

                                {/* Bot Result */}
                                <div className="w-full">
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1">OPPONENT</p>
                                            <p className="font-mono font-bold text-white/60 uppercase">DEMO-BOT</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1">FINAL SCORE</p>
                                            <p className="text-xl font-black font-oswald text-white/60">{botScore}</p>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>

                        {/* Action Button */}
                        <div className="w-full max-w-xs px-4 sm:px-0">
                            <button
                                onClick={() => window.location.href = '/home/card'}
                                className="group relative w-full h-14 bg-green-600 hover:bg-green-500 border border-green-400/50 rounded-xl shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:shadow-[0_0_30px_rgba(34,197,94,0.6)] transition-all duration-300 transform hover:scale-[1.02] active:scale-95 flex items-center justify-center overflow-hidden"
                            >
                                <span className="relative z-10 font-mono font-black tracking-[0.2em] uppercase text-white text-sm">
                                    → Enter Another Arena
                                </span>
                            </button>
                        </div>
                    </motion.div>
                )}
            </main>

            {/* Holographic Toast UI */}
            <div className="fixed bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 z-[10000] flex flex-col gap-2.5 pointer-events-none w-[92vw] max-w-sm sm:max-w-lg px-2 items-center">
                <AnimatePresence>
                    {protocolToasts.map(toast => (
                        <motion.div
                            key={toast.id}
                            initial={{ opacity: 0, y: 20, scale: 0.9, filter: 'blur(10px)' }}
                            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, scale: 0.8, filter: 'blur(10px)' }}
                            className={`w-full px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-xl border backdrop-blur-3xl flex items-center gap-3 sm:gap-4 shadow-[0_0_30px_rgba(0,0,0,0.95)] bg-zinc-950 ${toast.type === 'error' ? 'border-red-500 text-red-100' :
                                toast.type === 'success' ? 'border-emerald-500/80 text-emerald-300' :
                                    'border-purple-500/80 text-purple-300'
                                }`}
                            style={{ clipPath: 'polygon(3% 0, 100% 0, 97% 100%, 0% 100%)' }}
                        >
                            <div className={`w-1.5 h-6 sm:h-8 shrink-0 ${toast.type === 'error' ? 'bg-red-500' : toast.type === 'success' ? 'bg-emerald-500' : 'bg-purple-500'} animate-pulse shadow-[0_0_15px_rgba(168,85,247,0.4)]`} />
                            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                <span className="text-[7px] sm:text-[8px] font-mono opacity-50 uppercase tracking-[0.3em]">Protocol Notification</span>
                                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider font-mono leading-tight break-words text-left">
                                    {toast.message}
                                </span>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
};

// Simple Card Visual matching main DiamondsGame component
function CardVisual({ card, size = 'default' }: { card: DiamondsCard; size?: 'default' | 'small' | 'mini' | 'full' }) {
    const imgSrc = getCardImagePath(card);

    if (card.type === 'special') {
        let borderColor = 'border-gray-500';
        let glow = '';

        if (card.specialType === 'zombie') {
            borderColor = 'border-purple-500';
            glow = 'shadow-[0_0_30px_rgba(168,85,247,0.3)]';
        }
        if (card.specialType === 'injection') {
            borderColor = 'border-green-500';
            glow = 'shadow-[0_0_30px_rgba(34,197,94,0.3)]';
        }
        if (card.specialType === 'shotgun') {
            borderColor = 'border-orange-500';
            glow = 'shadow-[0_0_30px_rgba(249,115,22,0.3)]';
        }

        const sizeClasses = size === 'mini' ? 'w-14 h-20' : size === 'small' ? 'w-20 h-28' : size === 'full' ? 'w-full h-full' : 'w-20 h-28 sm:w-24 sm:h-36';
        return (
            <div className={`${sizeClasses} rounded-2xl border-2 ${borderColor} ${glow} flex flex-col items-center justify-center relative overflow-hidden bg-black group`}>
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent z-10 opacity-30" />
                <img
                    src={imgSrc}
                    alt={card.specialType}
                    className="w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 shadow-[inset_0_0_40px_rgba(0,0,0,0.8)] pointer-events-none" />
            </div>
        );
    }

    const sizeClasses = size === 'mini' ? 'w-14 h-20' : size === 'small' ? 'w-20 h-28' : size === 'full' ? 'w-full h-full' : 'w-20 h-28 sm:w-24 sm:h-36';
    return (
        <div className={`${sizeClasses} rounded-2xl border border-white/20 flex flex-col items-center justify-center relative overflow-hidden bg-white shadow-2xl group transition-all duration-300 hover:shadow-purple-500/20`}>
            <img
                src={imgSrc}
                alt={`${card.rank} of ${card.suit}`}
                className="w-full h-full object-cover transform transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 border-2 border-black/5 rounded-xl pointer-events-none" />
        </div>
    );
}
