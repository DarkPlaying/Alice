/**
 * DemoClubsGame — A fully local simulation of the Clubs game.
 *
 * Fixes / Additions:
 * - Real card images from /borderland_cards/Clubs_*.png
 * - Sticky HUD fixed at top (z-[150])
 * - Flash overlay when Angel / Demon card is selected
 * - Result screen at z-[200] (covers sticky HUD)
 * - Profile button in HUD → opens PlayerCardModal during the game
 * - HUD stats: ROUND / PLAYER / BOT SCORE / TIME
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, FileText, User, RotateCcw, X, LogOut } from 'lucide-react';
import { ClubsPointsTable } from './ClubsPointsTable';
import { PlayerCardModal } from '../PlayerCardModal';

type DemoPhase = 'briefing' | 'setup_phase1' | 'selection_reveal' | 'playing' | 'card_reveal' | 'result';

const DEMO_START_SCORE = 1000;
const BOT_ID = 'demo-bot';
const GROUP_ID = '1';

const PHASE_DURATIONS: Record<DemoPhase, number> = {
    briefing: 20,
    setup_phase1: 30,
    selection_reveal: 10,
    playing: 30,
    card_reveal: 10,
    result: 0
};

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q'];

interface Card {
    id: string;
    suit: 'clubs';
    rank: string;
    playerRole: 'angel' | 'demon' | null;
    isRevealed: boolean;
    isRemoved: boolean;
}

interface DemoClubsGameProps {
    user?: any;
}

// ── Clubs card image helper ──────────────────────────────────────────────────
const getClubsCardImage = (rank: string) =>
    `/borderland_cards/Clubs_${rank}.png`;

// ── Card flash colours ───────────────────────────────────────────────────────
const ANGEL_FLASH = 'rgba(234,179,8,0.55)';   // yellow
const DEMON_FLASH = 'rgba(239,68,68,0.55)';   // red
const VOTE_FLASH = 'rgba(59,130,246,0.55)';  // blue

export const DemoClubsGame: React.FC<DemoClubsGameProps> = ({ user }) => {
    const myId = user?.id || 'demo-user';
    const myName = user?.username || 'DEMO';

    // ── State ──────────────────────────────────────────────────────────────
    const [phase, setPhase] = useState<DemoPhase>('briefing');
    const [timeLeft, setTimeLeft] = useState(PHASE_DURATIONS.briefing);
    const [round] = useState(1);
    const [myScore, setMyScore] = useState(DEMO_START_SCORE);
    const [botScore, setBotScore] = useState(DEMO_START_SCORE);

    // Flash state
    const [flashCard, setFlashCard] = useState<{ id: string; color: string } | null>(null);

    // Board Cards
    const [cards, setCards] = useState<Card[]>(() =>
        RANKS.map(rank => ({
            id: `clubs-${rank}`,
            suit: 'clubs',
            rank,
            playerRole: null,
            isRevealed: false,
            isRemoved: false
        }))
    );

    // Selection Phase 1 state
    const [selection, setSelection] = useState<{ angel: string | null; demon: string | null }>({ angel: null, demon: null });
    const [botSelection] = useState({ angel: 'clubs-A', demon: 'clubs-10' });
    const [showPointsTable, setShowPointsTable] = useState(false);
    const [showPlayerCard, setShowPlayerCard] = useState(false);

    // Voting Phase 2 state
    const [myVote, setMyVote] = useState<string[]>([]);
    const [botVote, setBotVote] = useState<string[]>([]);

    // Phase transition banner
    const [phaseBanner, setPhaseBanner] = useState<string | null>(null);

    const phaseTimerRef = useRef<NodeJS.Timeout | null>(null);
    const countdownRef = useRef<NodeJS.Timeout | null>(null);

    // ── Advance Phase ──────────────────────────────────────────────────────
    const advancePhase = useCallback((current: DemoPhase) => {
        const transitions: Record<DemoPhase, DemoPhase | null> = {
            briefing: 'setup_phase1',
            setup_phase1: 'selection_reveal',
            selection_reveal: 'playing',
            playing: 'card_reveal',
            card_reveal: 'result',
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

    // ── Phase transition banner ─────────────────────────────────────────
    useEffect(() => {
        const phaseLabels: Record<DemoPhase, string> = {
            briefing: '',
            setup_phase1: 'CHAMPION SELECTION',
            selection_reveal: 'SELECTIONS LOCKED',
            playing: 'HUNTING PHASE',
            card_reveal: 'IDENTITY REVEAL',
            result: ''
        };
        const label = phaseLabels[phase];
        if (label) {
            setPhaseBanner(label);
            const t = setTimeout(() => setPhaseBanner(null), 2500);
            return () => clearTimeout(t);
        } else {
            setPhaseBanner(null);
        }
    }, [phase]);

    // ── Bot voting (always select cards the player hasn't picked) ──────────
    useEffect(() => {
        if (phase === 'playing') {
            const candidates = cards.map(c => c.id).filter(id => !myVote.includes(id));
            const shuffled = [...candidates].sort(() => Math.random() - 0.5);
            setBotVote(shuffled.slice(0, 2));
        }
    }, [phase, myVote, cards]);

    // ── Flash helper ───────────────────────────────────────────────────────
    const triggerFlash = (cardId: string, color: string) => {
        setFlashCard({ id: cardId, color });
        setTimeout(() => setFlashCard(null), 500);
    };

    // ── Card click handler ─────────────────────────────────────────────────
    const [hasPlayedEndVideo, setHasPlayedEndVideo] = useState(false);

    useEffect(() => {
        if (phase === 'result' && !hasPlayedEndVideo) {
            window.dispatchEvent(new CustomEvent('play-end-video'));
            setHasPlayedEndVideo(true);
        }
    }, [phase, hasPlayedEndVideo]);

    const handleCardClick = (cardId: string) => {
        if (phase === 'setup_phase1') {
            const card = cards.find(c => c.id === cardId);
            if (!card) return;

            const next = { ...selection };
            if (selection.angel === cardId) {
                next.angel = null;
            } else if (selection.demon === cardId) {
                next.demon = null;
            } else {
                if (!next.angel) {
                    next.angel = cardId;
                    triggerFlash(cardId, ANGEL_FLASH);
                } else if (!next.demon) {
                    next.demon = cardId;
                    triggerFlash(cardId, DEMON_FLASH);
                } else {
                    next.angel = cardId;
                    triggerFlash(cardId, ANGEL_FLASH);
                }
            }
            setSelection(next);
        }

        if (phase === 'playing') {
            if (myVote.includes(cardId)) {
                setMyVote(prev => prev.filter(id => id !== cardId));
            } else {
                if (myVote.length >= 2) return;
                setMyVote(prev => [...prev, cardId]);
                triggerFlash(cardId, VOTE_FLASH);
            }
        }
    };

    // ── Score evaluation ───────────────────────────────────────────────────
    useEffect(() => {
        if (phase === 'card_reveal') {
            setCards(prev => prev.map(c => {
                if (c.id === selection.angel) return { ...c, playerRole: 'angel', isRevealed: true };
                if (c.id === selection.demon) return { ...c, playerRole: 'demon', isRevealed: true };
                return c;
            }));

            let scoreChange = 0;
            myVote.forEach(vid => {
                if (vid === selection.angel) scoreChange += 300;
                else if (vid === selection.demon) scoreChange -= 50;
            });
            setMyScore(prev => prev + scoreChange);

            let botChange = 0;
            botVote.forEach(vid => {
                if (vid === selection.angel) botChange += 300;
                else if (vid === selection.demon) botChange -= 50;
            });
            setBotScore(prev => prev + botChange);
        }
    }, [phase]);

    // ── HUD ────────────────────────────────────────────────────────────────
    const renderHUD = () => (
        <header className="fixed top-0 left-0 right-0 z-[160] bg-black/80 backdrop-blur-md">
            {/* Top Overlay — Trial Specialty */}
            <div className="flex justify-between items-center px-4 py-3 sm:px-8 sm:py-4 border-b border-green-500/10">
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
                            <span className="h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_currentColor]" />
                            <p className="text-green-500 font-mono text-[8px] sm:text-[10px] uppercase font-bold tracking-[0.2em] sm:tracking-[0.4em]">
                                TRIAL SPECIALTY // CLUBS
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
                        className="px-3 py-1.5 sm:px-4 sm:py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded text-red-400 text-[10px] sm:text-xs font-mono font-bold tracking-widest uppercase transition-all active:scale-95"
                    >
                        LOGOUT
                    </button>
                    <div className="hidden sm:flex flex-col items-end">
                        <span className="text-[8px] sm:text-[10px] text-white/40 font-mono uppercase tracking-widest">CURRENT STATE</span>
                        <span className="text-xs sm:text-sm font-black font-oswald text-white uppercase tracking-widest">REGISTRATION</span>
                    </div>
                </div>
            </div>
            {/* Game Stats Row */}
            <div className="px-3 py-2 sm:px-6 sm:py-3 border-b border-white/5 flex items-center justify-between bg-black/40 gap-2">
                <button
                    onClick={() => setShowPointsTable(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/60 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-all flex-shrink-0"
                >
                    <FileText size={13} />
                    <span className="hidden sm:inline">Rules &amp; Points</span>
                </button>
                <div className="flex items-center gap-3 sm:gap-6">
                    <div className="text-center">
                        <p className="text-[7px] text-white/30 uppercase tracking-widest mb-0.5">ROUND</p>
                        <p className="text-xs sm:text-base font-mono font-bold text-white leading-none">1/1</p>
                    </div>
                    <div className="w-px h-5 bg-white/10" />
                    <div className="text-center">
                        <p className="text-[7px] text-green-500/50 uppercase tracking-widest mb-0.5">PLAYER</p>
                        <p className="text-[9px] font-bold text-green-500 truncate max-w-[60px]">{myName.toUpperCase()}</p>
                        <p className="text-xs sm:text-base font-mono font-black text-white leading-none">{myScore}</p>
                    </div>
                    <div className="w-px h-5 bg-white/10" />
                    <div className="text-center">
                        <p className="text-[7px] text-red-500/50 uppercase tracking-widest mb-0.5">BOT SCORE</p>
                        <p className="text-xs sm:text-base font-mono font-bold text-white leading-none">{botScore}</p>
                    </div>
                    <div className="w-px h-5 bg-white/10" />
                    <div className="text-center">
                        <p className="text-[7px] text-red-500/50 uppercase tracking-widest mb-0.5">TIME</p>
                        <div className="flex items-center justify-center gap-1">
                            <Timer size={11} className={`text-red-500 ${timeLeft < 10 ? 'animate-spin' : ''}`} />
                            <p className={`text-xs sm:text-base font-mono font-black leading-none tabular-nums ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-red-500'}`}>
                                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="w-8" />
            </div>
        </header>
    );

    // ── Result Early Return ─────────────────────────────────────────────
    if (phase === 'result') {
        return (
            <div className="relative h-screen bg-black text-white overflow-y-auto font-sans overscroll-y-auto">
                <div className="absolute inset-0 bg-gradient-to-br from-green-900/10 via-black to-black pointer-events-none" />
                <div className="fixed inset-0 z-[200] flex flex-col items-center justify-start pt-8 sm:justify-center sm:pt-0 gap-5 sm:gap-8 bg-black/97 overflow-y-auto pb-12">
                    <div className="px-4 py-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded-full text-yellow-400 text-[10px] font-mono tracking-widest uppercase">
                        DEMO ROUND COMPLETE
                    </div>

                    <div className="text-center flex flex-col gap-2">
                        <h1 className="text-2xl sm:text-5xl font-black font-cinzel text-white tracking-widest uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] px-4">
                            TEAMWORK AUCTION COMPLETE
                        </h1>
                        <h2 className="text-xs md:text-sm font-bold font-mono text-green-500 tracking-[0.4em] uppercase italic">
                            VITALITY CHECK // PASSED
                        </h2>
                    </div>

                    {/* Two-column layout */}
                    <div className="w-full max-w-5xl px-4 sm:px-8 grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                        {/* Left — Demo Limitation */}
                        <div className="relative overflow-hidden bg-gradient-to-br from-red-950/60 to-black/80 border border-red-500/30 rounded-2xl p-6 shadow-[0_0_30px_rgba(255,0,80,0.1)] flex flex-col justify-between">
                            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-60" />
                            <p className="text-[10px] font-mono text-red-400/60 uppercase tracking-[0.4em] mb-2">DEMO LIMITATION</p>
                            <p className="text-white font-bold font-cinzel tracking-widest text-base mb-1">
                                WANT TO PLAY THE REAL GAME?
                            </p>
                            <p className="text-white/50 font-mono text-xs leading-relaxed mb-4">
                                This was a 1-round demo simulation.<br />
                                The real Clubs Trial has 6 rounds, real opponents,<br />
                                and actual Visa Points at stake.
                            </p>
                            <div className="px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-full inline-block">
                                <span className="text-red-400 font-mono text-[10px] uppercase tracking-widest">
                                    📡 Contact an Admin to unlock your player access
                                </span>
                            </div>
                        </div>

                        {/* Right — Stats */}
                        <div className="flex flex-col gap-4">
                            <div className="relative group w-full">
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
                            </div>

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
                        </div>
                    </div>

                    {/* Back button */}
                    <div className="w-full max-w-xs">
                        <button
                            onClick={() => window.location.href = '/home/card'}
                            className="group relative w-full h-14 bg-green-600 hover:bg-green-500 border border-green-400/50 rounded-xl shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:shadow-[0_0_30px_rgba(34,197,94,0.6)] transition-all duration-300 transform hover:scale-[1.02] active:scale-95 flex items-center justify-center overflow-hidden"
                        >
                            <span className="relative z-10 font-mono font-black tracking-[0.2em] uppercase text-white text-sm">
                                → Enter Another Arena
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Main Render ────────────────────────────────────────────────────────
    return (
        <div className="relative w-full h-full min-h-screen bg-black/40 backdrop-blur-md flex flex-col font-sans text-white overflow-x-hidden overscroll-y-auto">
            {/* Modals */}
            {showPointsTable && <ClubsPointsTable isOpen={showPointsTable} currentRound={round} onClose={() => setShowPointsTable(false)} />}
            {showPlayerCard && (
                <PlayerCardModal
                    user={user ?? { username: 'DEMO', id: 'demo-user', visa_points: myScore, wins: 0 }}
                    onClose={() => setShowPlayerCard(false)}
                    currentGameScore={myScore}
                />
            )}

            {/* ── Briefing Overlay ── */}
            <AnimatePresence>
                {phase === 'briefing' && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center"
                    >
                        <div className="max-w-4xl mx-auto text-center space-y-6 p-6 pt-10">
                            <div className="px-3 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-400 text-[10px] font-mono tracking-widest uppercase inline-block">
                                DEMO MODE
                            </div>
                            <h1 className="text-3xl sm:text-5xl font-cinzel font-black text-white uppercase tracking-widest">
                                Protocol Briefing
                            </h1>
                            <div className="h-0.5 w-32 sm:w-64 mx-auto bg-gradient-to-r from-transparent via-green-500 to-transparent" />
                            <div className="space-y-3 text-white/80 font-mono">
                                <p className="text-base sm:text-xl leading-relaxed">Welcome to the Clubs Trial, Agent.</p>
                                <p className="text-xs sm:text-base leading-relaxed max-w-md mx-auto">
                                    Work as a team to identify hidden cards. Select Angel and Demon targets.
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Sticky HUD ── */}
            {renderHUD()}

            {/* ── Board ── */}
            <div 
                className="flex-1 overflow-y-auto p-4 sm:p-8 relative bg-transparent pt-24 sm:pt-32"
                onScroll={(e) => {
                    const scrolled = e.currentTarget.scrollTop > 10;
                    window.dispatchEvent(new CustomEvent('hearts-scroll', { detail: scrolled }));
                }}
            >

                {/* Phase title row */}
                <div className="max-w-6xl mx-auto mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-2 sm:px-0">
                    <div className="space-y-1">
                        <h2 className="text-xl sm:text-4xl font-cinzel font-bold text-white uppercase tracking-widest">
                            {phase === 'setup_phase1' ? 'SELECT Your CHAMPIONS' :
                                phase === 'selection_reveal' ? 'SELECTIONS LOCKED' :
                                    phase === 'playing' ? 'HUNTING PHASE' :
                                        phase === 'card_reveal' ? 'IDENTITY REVEAL' :
                                            'TRIAL COMPLETE'}
                        </h2>
                        <p className="text-white/40 font-mono text-[9px] sm:text-xs uppercase tracking-[0.2em]">
                            {phase === 'setup_phase1' ? 'CHOOSE ANGEL & DEMON CARDS WITH YOUR TEAMMATE.' :
                                phase === 'playing' ? 'VOTE FOR 2 CARDS. FIND ANGEL (+300) & AVOID DEMON (-50).' :
                                    'AWAITING NEXT PHASE...'}
                        </p>
                    </div>

                    {/* Angel / Demon selection counters */}
                    {['setup_phase1', 'selection_reveal', 'playing'].includes(phase) && (
                        <div className="flex items-center gap-2 sm:gap-4">
                            <div className={`px-3 py-2 rounded-lg border text-center min-w-[80px] transition-all duration-300 ${selection.angel ? 'border-yellow-500/50 bg-yellow-500/10 shadow-[0_0_15px_rgba(234,179,8,0.1)]' : 'border-white/5 bg-white/[0.02]'}`}>
                                <p className="text-[7px] text-yellow-500/70 font-black uppercase tracking-[0.2em] mb-1">TEAM ANGEL</p>
                                <p className="text-base font-mono font-black text-white">
                                    {selection.angel ? selection.angel.split('-')[1] : '-'}
                                </p>
                            </div>
                            <div className={`px-3 py-2 rounded-lg border text-center min-w-[80px] transition-all duration-300 ${selection.demon ? 'border-red-500/50 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'border-white/5 bg-white/[0.02]'}`}>
                                <p className="text-[7px] text-red-500/70 font-black uppercase tracking-[0.2em] mb-1">TEAM DEMON</p>
                                <p className="text-base font-mono font-black text-white">
                                    {selection.demon ? selection.demon.split('-')[1] : '-'}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Card Grid ── */}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 sm:gap-4 max-w-6xl mx-auto px-2 sm:px-0">
                    {cards.map(card => {
                        const isAngelSel = selection.angel === card.id;
                        const isDemonSel = selection.demon === card.id;
                        const isVoted = myVote.includes(card.id);
                        const isBotVoted = botVote.includes(card.id);

                        let ringClass = 'border-white/10';
                        if (isAngelSel) ringClass = 'border-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.35)]';
                        else if (isDemonSel) ringClass = 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.35)]';
                        else if (isVoted) ringClass = 'border-blue-500 shadow-[0_0_16px_rgba(59,130,246,0.35)]';

                        return (
                            <div
                                key={card.id}
                                onClick={() => handleCardClick(card.id)}
                                className={`relative aspect-[2/3] rounded-xl border-2 cursor-pointer overflow-hidden transition-all duration-300 ${ringClass} ${isAngelSel || isDemonSel || isVoted ? 'scale-105' : 'hover:scale-[1.03] hover:border-white/30'}`}
                            >
                                {/* Real card image */}
                                <img
                                    src={getClubsCardImage(card.rank)}
                                    alt={`Clubs ${card.rank}`}
                                    className="w-full h-full object-cover"
                                    draggable={false}
                                />

                                {/* Overlay tint for selected/voted */}
                                {isAngelSel && (
                                    <div className="absolute inset-0 bg-yellow-500/25 pointer-events-none" />
                                )}
                                {isDemonSel && (
                                    <div className="absolute inset-0 bg-red-500/25 pointer-events-none" />
                                )}
                                {isVoted && !isAngelSel && !isDemonSel && (
                                    <div className="absolute inset-0 bg-blue-500/20 pointer-events-none" />
                                )}

                                {/* Badges */}
                                <div className="absolute bottom-1.5 left-0 right-0 flex flex-col items-center gap-1">
                                    {isAngelSel && <span className="text-[8px] bg-yellow-500 text-black px-1.5 py-0.5 rounded font-black tracking-widest shadow">ANGEL</span>}
                                    {isDemonSel && <span className="text-[8px] bg-red-500 text-white px-1.5 py-0.5 rounded font-black tracking-widest shadow">DEMON</span>}
                                    {isVoted && <span className="text-[8px] bg-blue-500 text-white px-1.5 py-0.5 rounded font-black tracking-widest shadow">VOTE</span>}
                                    {phase === 'card_reveal' && isBotVoted && <span className="text-[8px] bg-purple-500 text-white px-1.5 py-0.5 rounded font-black tracking-widest shadow">BOT</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>


        </div>
    );
};
