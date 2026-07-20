/**
 * DemoHeartsGame — A fully local simulation of the Hearts game.
 * 
 * Features:
 * - All real game phases: briefing → shuffle → reveal → choosing → result
 * - Bot opponent (DEMO-BOT) that always selects a WRONG card
 * - After 1 round completes, shows the real survival clear screen with a "contact admin" banner
 * - Zero Supabase writes — fully client-side
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, ShieldAlert, RotateCcw, X, Info, Scan, User, Eye, Heart } from 'lucide-react';
import { createPortal } from 'react-dom';
import { PlayerCardModal } from '../PlayerCardModal';

type DemoPhase = 'briefing' | 'shuffle' | 'reveal' | 'choosing' | 'result';

const DEMO_START_SCORE = 1000;
const BOT_ID = 'demo-bot';
const GROUP_ID = '1';

const PHASE_DURATIONS: Record<DemoPhase, number> = {
    briefing: 20,
    shuffle: 5,
    reveal: 30,
    choosing: 30,
    result: 0
};

interface Card {
    rank: string;
    suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
    value: number;
}

interface DemoPlayer {
    id: string;
    name: string;
    displayName: string;
    role: 'player' | 'master' | 'admin';
    status: 'active' | 'eliminated' | 'survived';
    score: number;
    eye_of_truth_uses: number;
    groupId: string;
}

interface DemoHeartsGameProps {
    user?: any;
}

export const DemoHeartsGame: React.FC<DemoHeartsGameProps> = ({ user }) => {
    const myId = user?.id || 'demo-user';
    const myName = user?.username || 'DEMO';

    // ── State ──────────────────────────────────────────────────────────────
    const [phase, setPhase] = useState<DemoPhase>('briefing');
    const [timeLeft, setTimeLeft] = useState(PHASE_DURATIONS.briefing);
    const [myScore, setMyScore] = useState(DEMO_START_SCORE);
    const [botScore, setBotScore] = useState(DEMO_START_SCORE);
    const [eyeUses, setEyeUses] = useState(1);
    const [revealMyCard, setRevealMyCard] = useState(false);
    const [selectedSuit, setSelectedSuit] = useState<string | null>(null);
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [showRulesModal, setShowRulesModal] = useState(false);
    const [showPointsModal, setShowPointsModal] = useState(false);
    const [showPlayerCard, setShowPlayerCard] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const [messages, setMessages] = useState<any[]>([]);

    const phaseTimerRef = useRef<NodeJS.Timeout | null>(null);
    const countdownRef = useRef<NodeJS.Timeout | null>(null);

    // ── Cards mapping ──────────────────────────────────────────────────────
    const myCard: Card = { rank: 'K', suit: 'hearts', value: 13 };
    const botCard: Card = { rank: '2', suit: 'diamonds', value: 2 };

    const players: Record<string, DemoPlayer> = {
        [myId]: {
            id: myId,
            name: 'PLAYER',
            displayName: myName.toUpperCase(),
            role: 'player',
            status: 'active',
            score: myScore,
            eye_of_truth_uses: eyeUses,
            groupId: GROUP_ID
        },
        [BOT_ID]: {
            id: BOT_ID,
            name: 'DEMO-BOT',
            displayName: 'DEMO-BOT',
            role: 'player',
            status: 'active',
            score: botScore,
            eye_of_truth_uses: 1,
            groupId: GROUP_ID
        }
    };

    // ── Advance Phase ──────────────────────────────────────────────────────
    const advancePhase = useCallback((current: DemoPhase) => {
        const transitions: Record<DemoPhase, DemoPhase | null> = {
            briefing: 'shuffle',
            shuffle: 'reveal',
            reveal: 'choosing',
            choosing: 'result',
            result: null
        };
        const next = transitions[current];
        if (next) {
            setPhase(next);
            setTimeLeft(PHASE_DURATIONS[next]);
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

    // ── Handle Action Submission ───────────────────────────────────────────
    const handleVote = () => {
        if (!selectedSuit) return;
        setHasSubmitted(true);
    };

    const handleEyeOfTruth = () => {
        if (eyeUses > 0) {
            setRevealMyCard(true);
            setEyeUses(prev => prev - 1);
        }
    };

    // ── Chat logic ─────────────────────────────────────────────────────────
    const handleChat = (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim()) return;

        const newMsg = {
            userId: myId,
            text: chatInput.trim(),
            timestamp: new Date()
        };
        setMessages(prev => [...prev, newMsg]);
        setChatInput('');

        // Bot responds with a wrong hint/manipulation after 1.5s
        setTimeout(() => {
            const botResponses = [
                "I see your card. It's a black card, trust me.",
                "No, your card is diamonds, trust my eyes.",
                "Let's win this together. Guess Clubs."
            ];
            const botMsg = {
                userId: BOT_ID,
                text: botResponses[Math.floor(Math.random() * botResponses.length)],
                timestamp: new Date()
            };
            setMessages(prev => [...prev, botMsg]);
        }, 1500);
    };

    // ── Evaluation at phase transition to Result ───────────────────────────
    useEffect(() => {
        if (phase === 'result') {
            const isMyGuessCorrect = selectedSuit === 'hearts';
            // Bot always guesses wrong suit (real suit is diamonds, so bot guesses hearts/spades/clubs)
            const botGuessCorrect = false;

            if (isMyGuessCorrect) {
                setMyScore(prev => prev + 300);
            } else {
                setMyScore(prev => Math.max(0, prev - 200));
            }

            if (botGuessCorrect) {
                setBotScore(prev => prev + 300);
            } else {
                setBotScore(prev => Math.max(0, prev - 200));
            }
        }
    }, [phase]);

    // ── HUD render ─────────────────────────────────────────────────────────
    const renderHUD = () => (
        <header className="fixed top-0 left-0 right-0 z-[160] bg-black/80 backdrop-blur-md">
            {/* Top Overlay — Trial Specialty */}
            <div className="flex justify-between items-center px-4 py-3 sm:px-8 sm:py-4 border-b border-rose-500/10">
                <div className="flex items-center gap-3 sm:gap-6">
                    <button
                        onClick={() => window.location.href = '/home/card'}
                        className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all group hover:scale-105 active:scale-95"
                        title="Exit game"
                    >
                        <X size={14} className="sm:w-5 sm:h-5 group-hover:rotate-90 transition-transform" />
                    </button>
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-2 sm:gap-3">
                            <span className="h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_10px_currentColor]" />
                            <p className="text-rose-500 font-mono text-[8px] sm:text-[10px] uppercase font-bold tracking-[0.2em] sm:tracking-[0.4em]">
                                TRIAL SPECIALTY // HEARTS
                            </p>
                        </div>
                        <h1 className="text-lg sm:text-3xl font-cinzel text-white uppercase tracking-wider drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] leading-tight">
                            Borderland Trials
                        </h1>
                    </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-4">
                    <div className="hidden sm:block px-2 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-400 text-[10px] font-mono tracking-widest uppercase">
                        DEMO MODE
                    </div>
                    <button
                        onClick={() => window.location.href = '/home/card'}
                        className="bg-red-500/10 hover:bg-red-500 border border-red-500/50 text-red-500 hover:text-white px-3 py-1 sm:px-4 sm:py-1.5 rounded text-[9px] sm:text-[10px] font-mono tracking-widest uppercase transition-all"
                    >
                        LOGOUT
                    </button>
                    <div className="flex items-center gap-2 text-right">
                        <div className="hidden sm:block">
                            <p className="text-[8px] sm:text-[10px] text-gray-500 font-mono uppercase tracking-wider">CURRENT STATE</p>
                            <p className="text-sm sm:text-lg font-black font-oswald text-white uppercase">REGISTRATION</p>
                        </div>
                    </div>
                </div>
            </div>
            {/* Game Header */}
            <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3 sm:px-8 sm:py-4">
                <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                        <h2 className="text-[8px] sm:text-xs font-cinzel font-black text-rose-500 tracking-[0.3em] uppercase leading-none mb-1">
                            HEARTS TRIAL — DEMO
                        </h2>
                        <h1 className="text-[11px] sm:text-lg font-black font-oswald text-white tracking-widest uppercase leading-none">
                            IDENTITY CRISIS
                        </h1>
                    </div>
                </div>
                <div className="flex items-center gap-1 sm:gap-3">
                    <div className="flex items-center gap-1 sm:gap-2 text-center">
                        <div className="flex flex-col items-center">
                            <p className="text-[6px] sm:text-[9px] text-rose-300/40 font-mono uppercase tracking-[0.2em]">PHASE</p>
                            <p className="text-[10px] sm:text-lg font-black font-oswald text-rose-500 uppercase leading-none">
                                {phase}
                            </p>
                        </div>
                        <div className="w-px h-4 sm:h-6 bg-white/10" />
                        <div className="flex flex-col items-center">
                            <p className="text-[6px] sm:text-[9px] text-rose-300/40 font-mono uppercase tracking-[0.2em]">ROUND</p>
                            <p className="text-[10px] sm:text-lg font-black font-oswald text-white leading-none">
                                1<span className="text-rose-900 text-[7px] sm:text-sm">/1</span>
                            </p>
                        </div>
                        <div className="w-px h-4 sm:h-6 bg-white/10" />
                        <div className="flex flex-col items-center">
                            <p className="text-[6px] sm:text-[9px] text-rose-300/40 font-mono uppercase tracking-[0.2em]">TIMER</p>
                            <div className="flex items-center gap-1 leading-none">
                                <RotateCcw size={10} className={`text-rose-500 sm:w-4 sm:h-4 ${timeLeft < 10 ? 'animate-spin' : ''}`} />
                                <p className={`text-[10px] sm:text-lg font-black font-oswald tabular-nums ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-rose-500'}`}>
                                    {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                                </p>
                            </div>
                        </div>
                        <div className="w-px h-4 sm:h-6 bg-white/10" />
                        <div className="flex flex-col items-center bg-rose-500/10 px-1.5 sm:px-3 py-0.5 sm:py-1 rounded border border-rose-500/20">
                            <p className="text-[6px] sm:text-[9px] text-rose-400/70 font-mono uppercase tracking-[0.2em]">SCORE</p>
                            <p className="text-[10px] sm:text-lg font-black font-oswald text-rose-500">
                                {myScore}
                            </p>
                        </div>
                        <div className="w-px h-4 sm:h-6 bg-white/10" />
                    </div>
                    <button
                        onClick={() => setShowPlayerCard(true)}
                        className="p-2 sm:px-3 sm:py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded text-rose-500 transition-all active:scale-95"
                    >
                        <User size={16} className="sm:w-5 sm:h-5" />
                    </button>
                </div>
            </div>
        </header>
    );
        

    // ── Early return for result/completed phase ─────────────────────────
    if (phase === 'result') {
        return (
            <div className="relative h-screen bg-black text-white overflow-y-auto font-sans overscroll-y-auto">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-rose-900/20 via-[#0a0a0a] to-[#050505] pointer-events-none" />
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="fixed inset-0 z-[200] flex flex-col items-center justify-start pt-8 sm:justify-center sm:pt-0 gap-5 sm:gap-8 bg-black/97 overflow-y-auto pb-12"
                >
                    <div className="px-4 py-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded-full text-yellow-400 text-[10px] font-mono tracking-widest uppercase">
                        DEMO ROUND COMPLETE
                    </div>

                    <div className="text-center flex flex-col gap-2">
                        <h1 className="text-2xl sm:text-5xl font-black font-cinzel text-white tracking-widest uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] px-4">
                            CROSS REVEAL COMPLETE
                        </h1>
                        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3, duration: 0.6 }}>
                            <h2 className="text-xs md:text-sm font-bold font-mono text-green-500 tracking-[0.4em] uppercase italic">
                                VITALITY CHECK // PASSED
                            </h2>
                        </motion.div>
                    </div>

                    <div className="w-full max-w-5xl px-4 sm:px-8 grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.4 }}
                            className="relative overflow-hidden bg-gradient-to-br from-red-950/60 to-black/80 border border-red-500/30 rounded-2xl p-6 shadow-[0_0_30px_rgba(255,0,80,0.1)] flex flex-col justify-between"
                        >
                            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-60" />
                            <p className="text-[10px] font-mono text-red-400/60 uppercase tracking-[0.4em] mb-2">DEMO LIMITATION</p>
                            <p className="text-white font-bold font-cinzel tracking-widest text-base mb-1">
                                WANT TO PLAY THE REAL GAME?
                            </p>
                            <p className="text-white/50 font-mono text-xs leading-relaxed mb-4">
                                This was a 1-round demo simulation.<br />
                                The real Hearts Trial has 5 rounds, real opponents,<br />
                                and actual Visa Points at stake.
                            </p>
                            <div className="px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-full inline-block">
                                <span className="text-red-400 font-mono text-[10px] uppercase tracking-widest">
                                    📡 Contact an Admin to unlock your player access
                                </span>
                            </div>
                        </motion.div>

                        <div className="flex flex-col gap-4">
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.5 }}
                                className="relative group w-full"
                            >
                                <div className="relative rounded-2xl bg-zinc-950/90 backdrop-blur-xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col sm:flex-row items-stretch justify-between p-0 z-10">
                                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-green-500 to-transparent opacity-80" />
                                    <div className="absolute -top-20 -left-20 w-60 h-60 rounded-full blur-[100px] bg-green-500/10 pointer-events-none" />
                                    <div className="flex-1 min-h-[100px] flex flex-col items-center justify-center relative p-4 sm:p-6 sm:border-r border-b sm:border-b-0 border-white/5 bg-zinc-900/40">
                                        <p className="text-zinc-500 font-mono text-[10px] sm:text-[9px] uppercase tracking-[0.4em] mb-3">NET MERIT</p>
                                        <p className="text-3xl sm:text-5xl font-black font-oswald tracking-tighter leading-tight text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.15)] py-2">
                                            {myScore}
                                        </p>
                                    </div>
                                    <div className="flex-1 flex flex-col p-4 sm:p-6 gap-3 justify-center relative bg-black/20">
                                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                            <span className="text-zinc-500 text-xs sm:text-[10px] font-mono tracking-widest uppercase">CONDITION</span>
                                            <span className="text-sm sm:text-xs font-bold font-mono tracking-[0.2em] uppercase text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.4)]">
                                                SURVIVED
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute -inset-4 rounded-3xl blur-2xl opacity-20 bg-green-500 z-0" />
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.6 }}
                                className="w-full"
                            >
                                <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1">OPPONENT</p>
                                        <p className="font-mono font-bold text-white/60 uppercase">DEMO-BOT (ELIMINATED)</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1">FINAL SCORE</p>
                                        <p className="text-xl font-black font-oswald text-white/60">{botScore}</p>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                        className="w-full max-w-xs"
                    >
                        <button
                            onClick={() => window.location.href = '/home/card'}
                            className="group relative w-full h-14 bg-green-600 hover:bg-green-500 border border-green-400/50 rounded-xl shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:shadow-[0_0_30px_rgba(34,197,94,0.6)] transition-all duration-300 transform hover:scale-[1.02] active:scale-95 flex items-center justify-center overflow-hidden"
                        >
                            <span className="relative z-10 font-mono font-black tracking-[0.2em] uppercase text-white text-sm">
                                → Enter Another Arena
                            </span>
                        </button>
                    </motion.div>
                </motion.div>
            </div>
        );
    }

    // ── Main Content Render ────────────────────────────────────────────────
    return (
        <div className="w-full h-full bg-[#050505] text-white font-sans overflow-y-auto relative selection:bg-rose-500/30 min-h-screen flex flex-col overscroll-y-auto">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-rose-900/20 via-[#0a0a0a] to-[#050505] pointer-events-none" />

            {/* PlayerCardModal */}
            {showPlayerCard && (
                <PlayerCardModal
                    user={user ?? { username: 'DEMO', id: 'demo-user', visa_points: myScore, wins: 0 }}
                    onClose={() => setShowPlayerCard(false)}
                    currentGameScore={myScore}
                />
            )}

            {/* Modals */}
            {showRulesModal && (
                <div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowRulesModal(false)}>
                    <div className="bg-zinc-950 border border-rose-500/30 p-6 rounded-2xl max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6 pb-2 border-b border-white/5">
                            <h3 className="text-xl font-oswald font-black text-rose-500 uppercase tracking-widest">RULES</h3>
                            <button onClick={() => setShowRulesModal(false)} className="text-white/40 hover:text-white"><X size={20} /></button>
                        </div>
                        <ul className="space-y-4">
                            {[
                                { label: 'Correct Identity', value: '+300', color: 'text-green-400' },
                                { label: 'Incorrect Identity', value: '-200', color: 'text-red-400' },
                            ].map(r => (
                                <li key={r.label} className="flex justify-between items-center bg-white/5 p-3 rounded border border-white/5">
                                    <span className="text-xs font-mono text-slate-400 uppercase">{r.label}</span>
                                    <span className={`${r.color} font-bold font-oswald text-lg`}>{r.value}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            {showPointsModal && (
                <div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowPointsModal(false)}>
                    <div className="bg-zinc-950 border border-rose-500/30 p-6 rounded-2xl max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-rose-500/30">
                            <h2 className="text-xl font-black font-oswald text-rose-500 uppercase tracking-wider">Points Table</h2>
                            <button onClick={() => setShowPointsModal(false)} className="text-white/50 hover:text-white text-xl">✕</button>
                        </div>
                        <div className="space-y-2">
                            {Object.values(players).sort((a, b) => b.score - a.score).map((p, idx) => (
                                <div key={p.id} className={`flex items-center justify-between p-3 rounded ${p.id === myId ? 'bg-rose-500/20 border border-rose-500/50' : 'bg-white/5'}`}>
                                    <div className="flex items-center gap-3">
                                        <span className={`text-lg font-black w-6 ${idx === 0 ? 'text-rose-500' : 'text-white/50'}`}>{idx + 1}</span>
                                        <div>
                                            <span className={`text-sm font-mono uppercase font-semibold ${p.id === myId ? 'text-rose-300' : 'text-white'}`}>
                                                {p.displayName}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="text-xl font-black tabular-nums">{p.score}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {renderHUD()}

            {/* MAIN STAGE */}
            <div className="flex-1 flex items-start justify-center p-8 relative z-10 pt-28 sm:pt-24 pb-20">
                {phase === 'briefing' && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 pt-10 sm:pt-0">
                        <div className="bg-black/60 backdrop-blur-md p-8 rounded-3xl border border-rose-500/30 text-center">
                            <h1 className="text-3xl md:text-6xl font-black font-oswald text-white mb-6 uppercase tracking-tighter leading-none">
                                MISSION <span className="text-rose-600">BRIEFING</span>
                            </h1>
                            <p className="text-lg text-white/80 font-light mb-8">You are in <span className="text-rose-500 font-bold">GROUP 1</span>.</p>
                            <div className="flex justify-center gap-4 flex-wrap">
                                {Object.values(players).map(p => (
                                    <div key={p.id} className={`p-4 rounded-xl border min-w-[100px] ${p.id === myId ? 'bg-rose-500/20 border-rose-500' : 'bg-white/5 border-white/10'}`}>
                                        <User className="mx-auto mb-2 text-white/70" />
                                        <div className="text-xs font-mono uppercase truncate max-w-[100px]">{p.displayName}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 overflow-y-auto max-h-[300px] sm:max-h-[400px]">
                            <h3 className="text-rose-500 font-bold font-oswald tracking-widest mb-3 uppercase text-sm sm:text-base">Game Protocol</h3>
                            <div className="space-y-2 text-[10px] sm:text-xs font-mono text-white/70 leading-relaxed">
                                <p><span className="text-rose-500 font-bold">I. SETUP:</span> See partners' cards.</p>
                                <p><span className="text-rose-500 font-bold">II. CHAT:</span> Help or Trick.</p>
                                <p><span className="text-rose-500 font-bold">III. GUESS:</span> Identify SUIT to survive.</p>
                                <p><span className="text-rose-500 font-bold">IV. EYE:</span> Peek your card (Limited).</p>
                            </div>
                        </div>
                    </motion.div>
                )}

                {phase === 'shuffle' && (
                    <motion.div key="shuffle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center z-[20] mt-20">
                        <div className="mb-8 flex justify-center">
                            <RotateCcw size={80} className="text-rose-500 animate-spin" />
                        </div>
                        <h1 className="text-4xl sm:text-6xl font-black font-oswald text-white tracking-[0.3em] uppercase">SHUFFLE</h1>
                        <p className="text-rose-400 font-mono text-sm mt-4 tracking-widest uppercase">Randomizing Subject Assets</p>
                    </motion.div>
                )}

                {phase === 'reveal' && (
                    <div className="w-full flex items-center justify-center p-4">
                        <div className="max-w-6xl w-full flex flex-wrap justify-center content-center gap-4 sm:gap-12 py-4">
                            <div className="flex flex-col items-center gap-4 shrink-0">
                                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-rose-500">
                                    Your Identity ({myName.toUpperCase()})
                                </span>
                                <div className="w-40 sm:w-64 h-56 sm:h-96 bg-[#111] rounded-2xl border-2 border-rose-500/60 flex flex-col items-center justify-center relative overflow-hidden group">
                                    {!revealMyCard ? (
                                        <div className="flex flex-col items-center justify-center p-6 text-center">
                                            <ShieldAlert size={48} className="text-rose-800 animate-pulse mb-4" />
                                            <p className="text-[9px] sm:text-[10px] text-white/30 uppercase tracking-[0.2em] mb-4">Identity Shield Active</p>
                                            {eyeUses > 0 && (
                                                <button
                                                    onClick={handleEyeOfTruth}
                                                    className="px-4 py-2 sm:px-6 sm:py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-[9px] sm:text-[10px] font-bold rounded-full shadow-[0_0_20px_rgba(225,29,72,0.4)] transition-all flex items-center gap-2 active:scale-95"
                                                >
                                                    <Eye size={12} /> REVEAL ({eyeUses})
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="w-full h-full overflow-hidden rounded-2xl">
                                            <img src={`/borderland_cards/${myCard.suit.charAt(0).toUpperCase() + myCard.suit.slice(1)}_${myCard.rank}.png`} alt="My Card" className="w-full h-full object-cover" />
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col items-center gap-4 shrink-0">
                                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-white/50">
                                    DEMO-BOT
                                </span>
                                <div className="w-40 sm:w-64 h-56 sm:h-96 rounded-2xl shadow-2xl overflow-hidden border-2 border-white/50">
                                    <img src={`/borderland_cards/${botCard.suit.charAt(0).toUpperCase() + botCard.suit.slice(1)}_${botCard.rank}.png`} alt="Card" className="w-full h-full object-cover" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {phase === 'choosing' && (
                    <div className="text-center mt-10">
                        <h2 className="text-xl sm:text-4xl font-black font-oswald text-white mb-4 sm:mb-8">CONFIRM IDENTITY</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 mb-4 sm:mb-8">
                            {['hearts', 'diamonds', 'clubs', 'spades'].map(suit => (
                                <button
                                    key={suit}
                                    onClick={() => !hasSubmitted && setSelectedSuit(suit)}
                                    className={`w-24 h-28 sm:w-32 sm:h-40 rounded-xl sm:rounded-2xl border-2 flex flex-col items-center justify-center gap-2 sm:gap-4 transition-all ${selectedSuit === suit
                                        ? 'bg-rose-600 border-rose-500 scale-105 shadow-[0_0_30px_rgba(225,29,72,0.5)]'
                                        : 'bg-white/5 border-white/10 hover:border-white/30'
                                        }`}
                                >
                                    <div className={`text-3xl sm:text-4xl ${selectedSuit === suit ? 'text-white' : 'text-white/50'}`}>
                                        {suit === 'hearts' && '♥'} {suit === 'diamonds' && '♦'}
                                        {suit === 'clubs' && '♣'} {suit === 'spades' && '♠'}
                                    </div>
                                    <div className="text-[10px] sm:text-xs font-mono uppercase tracking-widest">{suit}</div>
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center justify-center gap-4">
                            <button
                                onClick={handleVote}
                                disabled={hasSubmitted || !selectedSuit}
                                className={`px-12 py-4 rounded-full font-bold uppercase tracking-widest text-lg transition-all ${hasSubmitted ? 'bg-green-500 text-black cursor-not-allowed shadow-[0_0_20px_rgba(34,197,94,0.4)]' : !selectedSuit ? 'bg-white/10 text-white/20 cursor-not-allowed' : 'bg-white text-black hover:bg-gray-200 shadow-xl active:scale-95'}`}
                            >
                                {hasSubmitted ? 'CONFIRMED' : 'INITIALIZE'}
                            </button>
                        </div>
                    </div>
                )}


        </div>

            {/* Chat UI */ }
    {}
        phase !== 'briefing' && phase !== 'shuffle' && phase !== 'result' && (
            <>
                <button
                    onClick={() => setIsChatOpen(true)}
                    className="fixed bottom-6 right-6 w-14 h-14 bg-rose-600 text-white rounded-full shadow-[0_0_30px_rgba(225,29,72,0.4)] z-[140] flex items-center justify-center border-2 border-white/10 active:scale-90 transition-transform sm:w-16 sm:h-16"
                >
                    <Heart size={24} className="fill-current" />
                </button>

                <AnimatePresence>
                    {isChatOpen && (
                        <div className="fixed bottom-6 right-6 w-[calc(100vw-48px)] sm:w-80 h-[500px] max-h-[80vh] bg-black/95 backdrop-blur-2xl border-2 border-rose-500/30 rounded-3xl shadow-2xl z-[200] flex flex-col overflow-hidden">
                            <div className="bg-rose-600/20 border-b border-rose-500/30 px-6 py-4 flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="text-white font-bold text-xs uppercase tracking-widest">Group Comms</span>
                                    <span className="text-white/40 text-[9px]">Channel: {GROUP_ID}</span>
                                </div>
                                <button onClick={() => setIsChatOpen(false)} className="p-2 hover:bg-white/10 rounded-full text-white/60 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col-reverse">
                                {messages.slice().reverse().map((msg, i) => (
                                    <div key={i} className={`flex flex-col ${msg.userId === myId ? 'items-end' : 'items-start'}`}>
                                        <span className="text-[9px] text-white/30 mb-1 px-1">{msg.userId === myId ? 'YOU' : 'DEMO-BOT'}</span>
                                        <div className={`px-4 py-2.5 rounded-2xl text-[11px] sm:text-xs max-w-[85%] break-words leading-relaxed shadow-sm ${msg.userId === myId ? 'bg-rose-500 text-white rounded-br-none' : 'bg-white/10 text-white/90 rounded-bl-none border border-white/5'}`}>
                                            {msg.text}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <form onSubmit={handleChat} className="p-4 bg-black/50 border-t border-white/5 flex gap-2">
                                <input
                                    value={chatInput}
                                    onChange={e => setChatInput(e.target.value)}
                                    placeholder="Type a message..."
                                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-xs outline-none"
                                />
                                <button type="submit" className="px-4 bg-rose-600 rounded-xl font-bold uppercase tracking-wider text-xs">
                                    Send
                                </button>
                            </form>
                        </div>
                    )}
                </AnimatePresence>
            </>
        )
    
        </div >
    );
};
