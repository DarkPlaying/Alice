/**
 * DemoSpadesGame — A fully local simulation of the real Spades game.
 * 
 * Features:
 * - All real game phases: briefing → shuffle → hint → bidding → reveal → completed
 * - A bot opponent (DEMO-BOT) that always bids 100
 * - Demo player always wins the round (their bid is higher or tie-broken)
 * - After 1 round completes, shows the real "SURVIVAL AUCTION COMPLETE" win screen
 * - Zero Supabase writes — fully client-side
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, AlertTriangle, ShieldCheck, Info, Scan, User, X, LogOut } from 'lucide-react';
import { generateDeck, selectCardByType, buildHint } from '../../game/spades/hints';
import { scoreCard } from '../../game/spades/scoring';
import type { Card, PlayerState } from '../../game/spades/types';
import { PlayerCardModal } from '../PlayerCardModal';

type DemoPhase = 'briefing' | 'shuffle' | 'hint' | 'bidding' | 'reveal' | 'completed';

const DEMO_BOT_BID = 100;
const DEMO_START_SCORE = 1000;
const BOT_ID = 'demo-bot';
const GROUP_ID = 1;

// Phase durations for the demo (in seconds) — kept shorter for demo feel
const PHASE_DURATIONS: Record<DemoPhase, number> = {
    briefing: 20,
    shuffle: 5,
    hint: 15,
    bidding: 30,
    reveal: 10,
    completed: 0,
};

interface DemoPlayer extends PlayerState {
    displayName: string;
}

interface DemoSpadesGameProps {
    user?: any;
}

export const DemoSpadesGame: React.FC<DemoSpadesGameProps> = ({ user }) => {
    const myId = user?.id || 'demo-user';
    const myName = user?.username || 'DEMO';

    // ── State ──────────────────────────────────────────────────────────────
    const [phase, setPhase] = useState<DemoPhase>('briefing');
    const [timeLeft, setTimeLeft] = useState(PHASE_DURATIONS.briefing);
    const [targetCard, setTargetCard] = useState<Card | null>(null);
    const [hint, setHint] = useState<string>('');
    const [myBidInput, setMyBidInput] = useState('');
    const [myBid, setMyBid] = useState<number | null>(null);
    const [bidError, setBidError] = useState('');
    const [myScore, setMyScore] = useState(DEMO_START_SCORE);
    const [myCards, setMyCards] = useState<Card[]>([]);
    const [botScore, setBotScore] = useState(DEMO_START_SCORE);
    const [winnerId, setWinnerId] = useState<string | null>(null);
    const [showRulesModal, setShowRulesModal] = useState(false);
    const [showPointsModal, setShowPointsModal] = useState(false);
    const [showPlayerCard, setShowPlayerCard] = useState(false);
    const [deckRef] = useState(() => generateDeck());
    const remainingDeckRef = useRef<Card[]>([...deckRef]);
    const phaseTimerRef = useRef<NodeJS.Timeout | null>(null);
    const countdownRef = useRef<NodeJS.Timeout | null>(null);
    const bidSubmittedRef = useRef(false);
    // Tracks the score at the START of the bidding phase so we can refund on re-bid
    const bidRoundScoreRef = useRef(DEMO_START_SCORE);

    // ── Advance Phase ──────────────────────────────────────────────────────
    const advancePhase = useCallback((current: DemoPhase) => {
        const transitions: Record<DemoPhase, DemoPhase | null> = {
            briefing: 'shuffle',
            shuffle: 'hint',
            hint: 'bidding',
            bidding: 'reveal',
            reveal: 'completed',
            completed: null,
        };
        const next = transitions[current];
        if (next) {
            setPhase(next);
            setTimeLeft(PHASE_DURATIONS[next]);
        }
    }, []);

    // ── Setup Card for Round ───────────────────────────────────────────────
    useEffect(() => {
        if (phase === 'shuffle') {
            // Pick a positive (winning) card for demo — always pick a red non-face for nice +600 result
            const result = selectCardByType(remainingDeckRef.current, 'high') ||
                selectCardByType(remainingDeckRef.current, 'low');
            if (result) {
                remainingDeckRef.current = result.remainingDeck;
                const card = result.card;
                setTargetCard(card);
                setHint(buildHint(card));
            }
        }
        if (phase === 'hint') {
            setMyBidInput('');
            setMyBid(null);
            bidSubmittedRef.current = false;
            setBidError('');
        }
        if (phase === 'bidding') {
            // Snapshot score at start of bidding phase for refund calculations
            bidRoundScoreRef.current = myScore;
        }
    }, [phase]);

    // ── Bot Auto-Bid ───────────────────────────────────────────────────────
    useEffect(() => {
        if (phase !== 'bidding') return;
        // Bot bids after a 3s delay
        const t = setTimeout(() => {
            setBotScore(prev => Math.max(0, prev - DEMO_BOT_BID));
        }, 3000);
        return () => clearTimeout(t);
    }, [phase]);

    // ── Reveal: Determine Winner ───────────────────────────────────────────
    useEffect(() => {
        if (phase !== 'reveal') return;

        const effectiveBid = myBid ?? 0;
        // Demo always wins (their bid >= bot bid of 100, even if 0, demo wins by player priority)
        // If demo didn't bid, bot wins
        const demoWins = effectiveBid >= DEMO_BOT_BID || effectiveBid > 0;
        const winner = demoWins ? myId : BOT_ID;
        setWinnerId(winner);

        if (winner === myId && targetCard) {
            const gain = scoreCard(targetCard);
            setMyScore(prev => prev + gain);
            setMyCards(prev => [...prev, targetCard]);
        } else if (winner === BOT_ID && targetCard) {
            const gain = scoreCard(targetCard);
            setBotScore(prev => prev + gain);
        }
    }, [phase]);

    // ── Timer ──────────────────────────────────────────────────────────────
    useEffect(() => {
        if (phase === 'completed') return;

        // Clear any existing timers
        if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);

        const duration = PHASE_DURATIONS[phase];
        setTimeLeft(duration);

        // Countdown
        countdownRef.current = setInterval(() => {
            setTimeLeft(prev => Math.max(0, prev - 1));
        }, 1000);

        // Auto-advance
        phaseTimerRef.current = setTimeout(() => {
            advancePhase(phase);
        }, duration * 1000);

        return () => {
            if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
    }, [phase, advancePhase]);

    // ── Bid Submit ─────────────────────────────────────────────────────────
    const handleSubmitBid = () => {
        const amount = parseInt(myBidInput);
        if (isNaN(amount) || amount < 0) {
            setBidError('Invalid bid amount');
            return;
        }
        // Available score = original score at start of bidding phase
        const availableScore = bidRoundScoreRef.current;
        if (amount > availableScore) {
            setBidError(`Bid exceeds available score (${availableScore})!`);
            return;
        }
        // Refund old bid then apply new bid
        setMyBid(amount);
        setMyScore(Math.max(0, availableScore - amount));
        setBidError('');
        bidSubmittedRef.current = true;
    };

    const handleChangeBid = () => {
        // Allow editing — reset the input to current bid value for convenience
        setMyBidInput(myBid !== null ? String(myBid) : '');
        setBidError('');
    };

    const projectedScore = (() => {
        const n = parseInt(myBidInput);
        const base = bidRoundScoreRef.current;
        if (isNaN(n) || n < 0) return base;
        return Math.max(0, base - n);
    })();


    // ── Build "Players" for shared UI components ───────────────────────────
    const players: Record<string, DemoPlayer> = {
        [myId]: {
            id: myId,
            username: myName,
            displayName: myName.toUpperCase(),
            score: myScore,
            start_score: DEMO_START_SCORE,
            cards: myCards,
            bid: myBid,
            status: 'active',
            groupId: GROUP_ID,
        },
        [BOT_ID]: {
            id: BOT_ID,
            username: 'DEMO-BOT',
            displayName: 'DEMO-BOT',
            score: botScore,
            cards: [],
            bid: phase === 'reveal' || phase === 'completed' ? DEMO_BOT_BID : null,
            status: 'active',
            groupId: GROUP_ID,
        },
    };

    // ── Shared HUD & Modals ────────────────────────────────────────────────
    const renderHUD = () => (
        <header className="fixed top-0 left-0 right-0 z-[150] bg-black/80 backdrop-blur-md">
            {/* Top Overlay — Trial Specialty */}
            <div className="flex justify-between items-center px-4 py-3 sm:px-8 sm:py-4 border-b border-white/10">
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
                            <span className="h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_10px_currentColor]" />
                            <p className="text-blue-500 font-mono text-[8px] sm:text-[10px] uppercase font-bold tracking-[0.2em] sm:tracking-[0.4em]">
                                TRIAL SPECIALTY // SPADES
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
                        onClick={() => setShowPlayerCard(true)}
                        className="flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
                    >
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[10px] font-mono tracking-widest text-gray-300 uppercase">
                            {user?.username || 'PLAYER'}
                        </span>
                    </button>
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
                        <h2 className="text-[10px] sm:text-xs font-cinzel font-black text-blue-500 tracking-[0.3em] uppercase leading-none mb-1">
                            SPADES TRIAL — DEMO
                        </h2>
                        <h1 className="text-sm sm:text-lg font-black font-oswald text-white tracking-widest uppercase leading-none">
                            SURVIVAL AUCTION
                        </h1>
                    </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-4">
                    <div className="flex items-center gap-1.5 sm:gap-2 text-center">
                        <div className="flex flex-col items-center">
                            <p className="text-[6px] sm:text-[9px] text-slate-500 font-mono uppercase tracking-[0.2em]">ROUND</p>
                            <p className="text-xs sm:text-lg font-black font-oswald text-white">
                                1<span className="text-slate-600 text-[8px] sm:text-sm">/1</span>
                            </p>
                        </div>
                        <div className="w-px h-4 sm:h-6 bg-white/10" />
                        <div className="flex flex-col items-center">
                            <p className="text-[6px] sm:text-[9px] text-slate-500 font-mono uppercase tracking-[0.2em]">TIMER</p>
                            <div className="flex items-center gap-1">
                                <Timer size={10} className="text-red-500 animate-pulse sm:w-4 sm:h-4" />
                                <p className="text-xs sm:text-lg font-black font-oswald tabular-nums text-red-500">
                                    {`${String(Math.floor(timeLeft / 60)).padStart(2, '0')}:${String(timeLeft % 60).padStart(2, '0')}`}
                                </p>
                            </div>
                        </div>
                        <div className="w-px h-4 sm:h-6 bg-white/10" />
                        <div className="flex flex-col items-center bg-blue-500/10 px-2 sm:px-3 py-0.5 sm:py-1 rounded border border-blue-500/20">
                            <p className="text-[6px] sm:text-[9px] text-blue-400/70 font-mono uppercase tracking-[0.2em]">BALANCE</p>
                            <p className="text-xs sm:text-lg font-black font-oswald text-blue-400">{myScore}</p>
                        </div>
                        <div className="w-px h-4 sm:h-6 bg-white/10" />
                    </div>
                    <button
                        onClick={() => setShowRulesModal(true)}
                        className="p-2 sm:px-4 sm:py-2 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 rounded text-yellow-500 transition-all active:scale-95"
                    >
                        <span className="hidden sm:inline font-mono text-[11px] tracking-widest uppercase">RULES</span>
                        <Info size={18} className="sm:hidden" />
                    </button>
                    <button
                        onClick={() => setShowPointsModal(true)}
                        className="p-2 sm:px-4 sm:py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded text-blue-500 transition-all active:scale-95"
                    >
                        <span className="hidden sm:inline font-mono text-[11px] tracking-widest uppercase">SCORE</span>
                        <Scan size={18} className="sm:hidden" />
                    </button>
                </div>
            </div>
        </header>
    );

    // ── Render: Completed ──────────────────────────────────────────────────
    if (phase === 'completed') {
        return (
            <div className="relative h-screen bg-black text-white overflow-y-auto font-sans">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 via-black to-black pointer-events-none" />
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6 sm:gap-8 bg-black/97 overflow-y-auto pb-12"
                >
                    {/* Demo Badge */}
                    <div className="px-4 py-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded-full text-yellow-400 text-[10px] font-mono tracking-widest uppercase">
                        DEMO ROUND COMPLETE
                    </div>

                    <div className="text-center flex flex-col gap-2">
                        <h1 className="text-2xl sm:text-5xl font-black font-cinzel text-white tracking-widest uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] px-4">
                            SURVIVAL AUCTION COMPLETE
                        </h1>
                        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3, duration: 0.6 }}>
                            <h2 className="text-xs md:text-sm font-bold font-mono text-green-500 tracking-[0.4em] uppercase italic">
                                VITALITY CHECK // PASSED
                            </h2>
                        </motion.div>
                    </div>

                    {/* Two-column: Left=Demo Limitation, Right=Stats */}
                    <div className="w-full max-w-5xl px-4 sm:px-8 grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">

                        {/* Left — Demo Limitation */}
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
                                The real Spades Trial has 5 rounds, real opponents,<br />
                                and actual Visa Points at stake.
                            </p>
                            <div className="px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-full inline-block">
                                <span className="text-red-400 font-mono text-[10px] uppercase tracking-widest">
                                    📡 Contact an Admin to unlock your player access
                                </span>
                            </div>
                        </motion.div>

                        {/* Right — Stats */}
                        <div className="flex flex-col gap-4">
                            {/* Score Card */}
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
                                        <div className="flex items-center justify-between">
                                            <span className="text-zinc-500 text-xs sm:text-[10px] font-mono tracking-widest uppercase">INTEL</span>
                                            <span className="text-2xl sm:text-lg font-bold text-white font-display tracking-widest">{myCards.length}</span>
                                        </div>
                                        {myCards.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {myCards.map((c, i) => (
                                                    <div key={i} className="relative w-6 h-9 rounded-[2px] border border-white/10 overflow-hidden bg-black/40">
                                                        <img
                                                            src={`/borderland_cards/${c.suit.charAt(0).toUpperCase() + c.suit.slice(1)}_${c.rank}.png`}
                                                            className="w-full h-full object-cover"
                                                            alt={`${c.rank} of ${c.suit}`}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="absolute -inset-4 rounded-3xl blur-2xl opacity-20 bg-green-500 z-0" />
                            </motion.div>

                            {/* Bot Result */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.6 }}
                                className="w-full"
                            >
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
                            </motion.div>
                        </div>
                    </div>

                    {/* Enter Another Arena — below both columns */}
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


    // ── Main Game Render ───────────────────────────────────────────────────
    return (
        <div className="relative h-screen bg-black text-white overflow-y-auto font-sans selection:bg-blue-500/30 overscroll-y-auto">
            {/* Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 via-black to-black pointer-events-none" />

            {/* Rules Modal */}
            <AnimatePresence>
                {showRulesModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
                        onClick={() => setShowRulesModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            className="bg-zinc-950 border border-white/10 p-6 rounded-2xl max-w-sm w-full shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-6 pb-2 border-b border-white/5">
                                <h3 className="text-xl font-oswald font-black text-white uppercase tracking-widest flex items-center gap-2">
                                    <AlertTriangle size={20} className="text-yellow-500" /> SCORING RULES
                                </h3>
                                <button onClick={() => setShowRulesModal(false)} className="text-white/40 hover:text-white"><X size={20} /></button>
                            </div>
                            <ul className="space-y-4">
                                {[
                                    { label: 'Red (Non-Face)', value: '+600', color: 'text-green-400' },
                                    { label: 'Black (Non-Face)', value: '-100', color: 'text-red-400' },
                                    { label: 'Black Face', value: '+1000', color: 'text-yellow-400' },
                                    { label: 'Red Face', value: '-500', color: 'text-red-500' },
                                    { label: '0 Cards Penalty', value: '-500', color: 'text-red-500' },
                                ].map(r => (
                                    <li key={r.label} className="flex justify-between items-center bg-white/5 p-3 rounded border border-white/5">
                                        <span className="text-xs font-mono text-slate-400 uppercase">{r.label}</span>
                                        <span className={`${r.color} font-bold font-oswald text-lg`}>{r.value}</span>
                                    </li>
                                ))}
                            </ul>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Points Modal */}
            <AnimatePresence>
                {showPointsModal && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setShowPointsModal(false)}
                    >
                        <motion.div
                            initial={{ y: 50 }}
                            animate={{ y: 0 }}
                            className="bg-black/95 border border-yellow-500/30 rounded-xl p-6 max-w-md w-full"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-4 pb-3 border-b border-yellow-500/30">
                                <h2 className="text-xl font-black font-oswald text-yellow-500 uppercase tracking-wider">Points Table</h2>
                                <button onClick={() => setShowPointsModal(false)} className="text-white/50 hover:text-white text-xl">✕</button>
                            </div>
                            <div className="space-y-2">
                                {Object.values(players).sort((a, b) => b.score - a.score).map((p, idx) => (
                                    <div
                                        key={p.id}
                                        className={`flex items-center justify-between p-3 rounded ${p.id === myId ? 'bg-yellow-500/20 border border-yellow-500/50' : 'bg-white/5'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className={`text-lg font-black w-6 ${idx === 0 ? 'text-yellow-500' : 'text-white/50'}`}>{idx + 1}</span>
                                            <div>
                                                <span className={`text-sm font-mono uppercase font-semibold ${p.id === myId ? 'text-yellow-300' : 'text-white'}`}>
                                                    {p.displayName}
                                                </span>
                                                {p.id === myId && <span className="block text-[8px] text-yellow-500 uppercase">YOU</span>}
                                            </div>
                                        </div>
                                        <span className={`text-xl font-black tabular-nums ${p.id === myId ? 'text-yellow-400' : 'text-white'}`}>{p.score}</span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {renderHUD()}

            {/* PlayerCardModal */}
            {showPlayerCard && (
                <PlayerCardModal
                    user={user ?? { username: 'DEMO', id: 'demo-user', visa_points: myScore, wins: 0 }}
                    onClose={() => setShowPlayerCard(false)}
                    currentGameScore={myScore}
                />
            )}

            {/* Main Content */}
            <main className="relative z-10 container mx-auto px-4 pt-[200px] sm:pt-[200px] pb-40 flex-1 flex flex-col">
                <AnimatePresence mode="wait">
                    {/* Briefing */}
                    {phase === 'briefing' && (
                        <motion.div
                            key="briefing"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-black/40 border border-blue-900/30 p-4 sm:p-6 max-w-xl mx-auto backdrop-blur-sm rounded-lg w-full shadow-2xl flex-1 flex flex-col justify-center"
                        >
                            <h2 className="text-xl sm:text-2xl font-black font-cinzel text-blue-500 mb-4 text-center tracking-[0.1em] sm:tracking-[0.2em] drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                                PROTOCOL BRIEFING
                            </h2>
                            <div className="space-y-4 text-xs sm:text-sm font-mono text-slate-300 leading-relaxed">
                                <div className="p-3 bg-yellow-500/10 border-l-2 border-yellow-500">
                                    <h3 className="text-white font-bold mb-1">TABLE ASSIGNMENT: {GROUP_ID}</h3>
                                    <p>You have been paired with 1 other operative (DEMO-BOT).</p>
                                </div>
                                <div className="p-3 bg-blue-900/10 border-l-2 border-blue-500">
                                    <h3 className="text-white font-bold flex items-center gap-2 mb-1">
                                        <ShieldCheck size={14} /> OBJECTIVE
                                    </h3>
                                    <p className="mb-1">Win cards through strategic bidding. In this demo, you play 1 round.</p>
                                    <p className="text-blue-300">
                                        Make your strategic wagers and try to survive.
                                    </p>
                                </div>
                                <div className="p-3 bg-red-900/10 border-l-2 border-red-500">
                                    <h3 className="text-white font-bold mb-1">SCORING</h3>
                                    <ul className="space-y-0.5 text-xs">
                                        <li>• Red cards (Non-Face): <span className="text-green-400">+600 points</span></li>
                                        <li>• Black cards (Non-Face): <span className="text-red-400">-100 points</span></li>
                                        <li>• Black Face Cards: <span className="text-yellow-400">+1000 points</span></li>
                                        <li>• Red Face Cards: <span className="text-red-500">-500 points</span></li>
                                        <li>• End game with 0 cards: <span className="text-red-500">-500 penalty</span></li>
                                    </ul>
                                </div>
                            </div>
                        </motion.div>

                    )}

                    {/* Shuffle */}
                    {phase === 'shuffle' && (
                        <motion.div
                            key="shuffle"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.1 }}
                            className="flex flex-1 flex-col items-center justify-center space-y-12"
                        >
                            <h2 className="text-xs sm:text-sm font-mono text-yellow-500 tracking-widest uppercase mb-2 animate-pulse">SYSTEM RECONFIGURATION</h2>
                            <h1 className="text-3xl sm:text-6xl font-black font-display text-white tracking-tighter drop-shadow-xl text-center px-4">
                                SHUFFLING TEAMS
                            </h1>
                            <div className="w-16 h-1 bg-yellow-500/50 rounded-full overflow-hidden">
                                <div className="w-full h-full bg-yellow-400 animate-loading-bar" />
                            </div>
                        </motion.div>
                    )}

                    {/* Hint */}
                    {phase === 'hint' && (
                        <motion.div
                            key="hint"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-1 flex-col items-center justify-center space-y-12"
                        >
                            <div className="text-center">
                                <h2 className="text-sm font-mono text-blue-400 tracking-widest uppercase mb-2">INCOMING DATA STREAM</h2>
                                <h1 className="text-3xl sm:text-6xl font-black font-display text-white tracking-tighter drop-shadow-xl animate-pulse text-center px-4">
                                    TARGET ANALYSIS
                                </h1>
                            </div>
                            <div className="bg-black/60 border border-blue-500/30 p-8 rounded-xl backdrop-blur-md max-w-xl w-full text-center shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                                <p className="text-xs text-slate-500 font-mono mb-4">DECRYPTED SIGNAL FRAGMENT:</p>
                                <p className="text-2xl font-bold font-mono text-blue-300">{hint || 'LOADING...'}</p>
                            </div>
                        </motion.div>
                    )}

                    {/* Bidding */}
                    {phase === 'bidding' && (
                        <motion.div
                            key="bidding"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-1 flex-col items-center justify-center space-y-12"
                        >
                            <h2 className="text-xl sm:text-6xl font-black font-cinzel text-white tracking-widest drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] text-center px-4 uppercase">
                                Survival Auction
                            </h2>
                            <div className="bg-black/80 border border-white/10 p-8 rounded w-full max-w-md backdrop-blur shadow-2xl">
                                <label className="block text-xs font-mono text-slate-500 mb-4 uppercase tracking-widest">
                                    INPUT WAGER PARAMETER
                                </label>

                                {/* Current Bid Status (shown after first submission) */}
                                {myBid !== null && (
                                    <div className="flex items-center justify-between mb-4 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                            <span className="text-[10px] font-mono text-green-400 uppercase tracking-widest">Current Bid</span>
                                        </div>
                                        <span className="text-green-400 font-black font-oswald text-xl">{myBid}</span>
                                    </div>
                                )}

                                {/* Always-editable input */}
                                <div className="flex gap-2 w-full mb-4">
                                    <input
                                        type="number"
                                        autoFocus={myBid === null}
                                        placeholder="0000"
                                        value={myBidInput}
                                        onChange={e => {
                                            setMyBidInput(e.target.value.replace(/^0+(?=\d)/, ''));
                                            setBidError('');
                                        }}
                                        className="w-full bg-transparent border-b-2 border-slate-700 text-5xl font-black font-oswald text-center text-white focus:border-blue-500 focus:outline-none transition-colors py-4"
                                    />
                                    <button
                                        onClick={handleSubmitBid}
                                        className={`px-4 py-2 font-bold font-mono text-sm tracking-wider rounded transition-all flex flex-col items-center justify-center border ${myBid !== null && myBid === parseInt(myBidInput)
                                            ? 'bg-green-500/20 text-green-400 border-green-500/50'
                                            : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500'
                                            }`}
                                    >
                                        <span>{myBid !== null && myBid === parseInt(myBidInput) ? 'LOCKED' : myBid !== null ? 'UPDATE' : 'SUBMIT'}</span>
                                        <span className="text-[10px] opacity-70">WAGER</span>
                                    </button>
                                </div>
                                {bidError && (
                                    <div className="mb-4 px-3 py-2 bg-red-900/20 border border-red-500/30 text-red-400 text-xs rounded text-center">
                                        {bidError}
                                    </div>
                                )}
                                <div className="space-y-2 text-sm font-mono">
                                    <div className="flex justify-between p-2 bg-slate-900 rounded">
                                        <span className="text-slate-500">AVAILABLE BALANCE</span>
                                        <span className="font-bold text-white">{bidRoundScoreRef.current}</span>
                                    </div>
                                    <div className="flex justify-between p-2 bg-slate-900 rounded">
                                        <span className="text-slate-500">AFTER BID</span>
                                        <span className={`font-bold ${projectedScore >= 0 ? 'text-green-400' : 'text-red-400'}`}>{projectedScore}</span>
                                    </div>
                                </div>


                            </div>
                        </motion.div>
                    )}

                    {/* Reveal */}
                    {phase === 'reveal' && (
                        <motion.div
                            key="reveal"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-1 flex-col items-center justify-center space-y-4"
                        >
                            <h2 className="text-[10px] sm:text-xs font-mono text-blue-400 tracking-widest uppercase animate-pulse">AUCTION RESULT</h2>
                            <h1 className="text-xl sm:text-3xl font-black font-display text-white tracking-tighter px-4 text-center">
                                CARD REVEALED
                            </h1>

                            {targetCard && (
                                <motion.div
                                    initial={{ rotateY: 90, opacity: 0 }}
                                    animate={{ rotateY: 0, opacity: 1 }}
                                    transition={{ type: 'spring', duration: 0.8 }}
                                    className="relative w-28 h-40 sm:w-40 sm:h-56 rounded-lg border-2 border-blue-500/30 overflow-hidden shadow-[0_0_30px_rgba(59,130,246,0.3)]"
                                >
                                    <img
                                        src={`/borderland_cards/${targetCard.suit.charAt(0).toUpperCase() + targetCard.suit.slice(1)}_${targetCard.rank}.png`}
                                        className="w-full h-full object-cover"
                                        alt={`${targetCard.rank} of ${targetCard.suit}`}
                                    />
                                </motion.div>
                            )}

                            {winnerId && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.5 }}
                                    className={`text-center p-3 sm:p-4 rounded-lg border ${winnerId === myId ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}
                                >
                                    {winnerId === myId ? (
                                        <>
                                            <p className="text-green-400 font-black font-oswald text-sm sm:text-lg uppercase tracking-widest">YOU WIN THE CARD</p>
                                            {targetCard && (
                                                <p className={`text-[10px] sm:text-xs font-mono mt-1 ${scoreCard(targetCard) >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                                                    Score change: {scoreCard(targetCard) >= 0 ? '+' : ''}{scoreCard(targetCard)} points
                                                </p>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-red-400 font-black font-oswald text-sm sm:text-lg uppercase tracking-widest">BOT WINS THE CARD</p>
                                            <p className="text-[10px] font-mono text-white/40 mt-1">Bot bid: {DEMO_BOT_BID}</p>
                                        </>
                                    )}
                                </motion.div>
                            )}

                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
};
