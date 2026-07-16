/**
 * DemoClubsGame — A fully local simulation of the Clubs game.
 * 
 * Features:
 * - All real game phases: briefing → setup_phase1 → selection_reveal → playing → card_reveal → result
 * - Bot opponent (DEMO-BOT) behaves exactly as requested:
 *   - In setup: selects 'A' (1) as Angel, '10' as Demon.
 *   - In playing (voting): votes for cards EXCEPT the ones selected by the player.
 * - After 1 round completes, shows the clear screen with a "contact admin" banner.
 * - Zero Supabase writes — fully client-side.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, Shield, CheckCircle2, X, FileText, User } from 'lucide-react';
import { ClubsPointsTable } from './ClubsPointsTable';

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

export const DemoClubsGame: React.FC<DemoClubsGameProps> = ({ user }) => {
    const myId = user?.id || 'demo-user';
    const myName = user?.username || 'DEMO';

    // ── State ──────────────────────────────────────────────────────────────
    const [phase, setPhase] = useState<DemoPhase>('briefing');
    const [timeLeft, setTimeLeft] = useState(PHASE_DURATIONS.briefing);
    const [round] = useState(1);
    const [myScore, setMyScore] = useState(DEMO_START_SCORE);
    const [botScore, setBotScore] = useState(DEMO_START_SCORE);

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
    const [botSelection] = useState({ angel: 'clubs-A', demon: 'clubs-10' }); // Bot always selects A (1) as angel, 10 as demon
    const [showPointsTable, setShowPointsTable] = useState(false);

    // Voting Phase 2 state
    const [myVote, setMyVote] = useState<string[]>([]);
    const [botVote, setBotVote] = useState<string[]>([]);

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

    // ── Bot voting action (Always select except player's cards) ─────────────
    useEffect(() => {
        if (phase === 'playing') {
            // Find candidate cards that the player has NOT voted/selected
            const candidateIds = cards
                .map(c => c.id)
                .filter(id => !myVote.includes(id));

            // Select 2 random ones
            const shuffled = [...candidateIds].sort(() => Math.random() - 0.5);
            setBotVote(shuffled.slice(0, 2));
        }
    }, [phase, myVote, cards]);

    // ── Card clicking handler ──────────────────────────────────────────────
    const handleCardClick = (cardId: string) => {
        // Phase 1 Selection
        if (phase === 'setup_phase1') {
            const card = cards.find(c => c.id === cardId);
            if (!card) return;

            let next = { ...selection };
            if (selection.angel === cardId) {
                next.angel = null;
            } else if (selection.demon === cardId) {
                next.demon = null;
            } else {
                if (!next.angel) next.angel = cardId;
                else if (!next.demon) next.demon = cardId;
                else next.angel = cardId;
            }
            setSelection(next);
        }

        // Phase 2 Voting
        if (phase === 'playing') {
            if (myVote.includes(cardId)) {
                setMyVote(prev => prev.filter(id => id !== cardId));
            } else {
                if (myVote.length >= 2) return;
                setMyVote(prev => [...prev, cardId]);
            }
        }
    };

    // ── Evaluation for score changes ────────────────────────────────────────
    useEffect(() => {
        if (phase === 'card_reveal') {
            // Unveil roles based on final consensus selection (demo defaults to player's selections)
            setCards(prev => prev.map(c => {
                if (c.id === selection.angel) return { ...c, playerRole: 'angel', isRevealed: true };
                if (c.id === selection.demon) return { ...c, playerRole: 'demon', isRevealed: true };
                return c;
            }));

            // Score changes calculations
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

    // ── HUD Render ─────────────────────────────────────────────────────────
    const renderHUD = () => (
        <div className="px-4 py-3 sm:px-8 sm:py-2 border-b border-white/5 flex flex-col sm:flex-row justify-center items-center bg-white/[0.01] z-[110] gap-4 sm:gap-0 relative">
            <button
                onClick={() => setShowPointsTable(true)}
                className="sm:absolute sm:left-4 sm:top-1/2 sm:-translate-y-1/2 flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/60 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-all mb-2 sm:mb-0"
            >
                <FileText size={14} />
                <span>Rules & Points</span>
            </button>

            <div className="flex items-center gap-4 sm:gap-8 w-full sm:w-auto justify-center">
                <div className="flex items-center gap-4 sm:gap-8 border-l-0 sm:border-l border-white/10 pl-0 sm:pl-8 w-full justify-around sm:justify-start">
                    <div className="text-center min-w-[40px]">
                        <p className="text-[7px] text-white/30 uppercase tracking-widest mb-0.5">ROUND</p>
                        <p className="text-xs sm:text-lg font-mono font-bold text-white leading-none">1/1</p>
                    </div>
                    <div className="w-px h-6 bg-white/10" />
                    <div className="text-center min-w-[70px] sm:min-w-[100px]">
                        <p className="text-[7px] text-yellow-500/50 uppercase tracking-widest mb-0.5">PLAYER</p>
                        <div className="flex flex-col items-center leading-none">
                            <p className="text-[7px] sm:text-[9px] font-bold text-yellow-500 mb-0.5 truncate max-w-[80px]">{myName.toUpperCase()}</p>
                            <p className="text-xs sm:text-lg font-mono font-black text-white">{myScore}</p>
                        </div>
                    </div>
                    <div className="w-px h-6 bg-white/10" />
                    <div className="text-center min-w-[40px]">
                        <p className="text-[7px] text-red-500/50 uppercase tracking-widest mb-0.5">BOT SCORE</p>
                        <p className="text-xs sm:text-lg font-mono font-bold text-white leading-none">{botScore}</p>
                    </div>
                    <div className="w-px h-6 bg-white/10" />
                    <div className="text-center min-w-[60px]">
                        <p className="text-[7px] text-red-500/50 uppercase tracking-widest mb-0.5">TIME</p>
                        <div className="flex items-center justify-center gap-1">
                            <Timer size={12} className="text-red-500" />
                            <p className="text-xs sm:text-lg font-mono font-black text-red-500 leading-none">{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    // ── Main UI Layout ─────────────────────────────────────────────────────
    return (
        <div className="relative w-full h-full min-h-screen bg-[#050508] flex flex-col font-sans overflow-hidden text-white">
            {/* Rules Modal */}
            {showPointsTable && <ClubsPointsTable isOpen={showPointsTable} currentRound={round} onClose={() => setShowPointsTable(false)} />}

            {/* Briefing Overlay */}
            <AnimatePresence>
                {phase === 'briefing' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center">
                        <div className="max-w-4xl mx-auto text-center space-y-4 sm:space-y-8 p-4 sm:p-8 pt-20 sm:pt-8">
                            <div className="px-2 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-400 text-[10px] font-mono tracking-widest uppercase inline-block mx-auto">
                                DEMO MODE
                            </div>
                            <h1 className="text-3xl sm:text-5xl font-cinzel font-black text-white uppercase tracking-widest">
                                Protocol Briefing
                            </h1>
                            <div className="h-0.5 sm:h-1 w-32 sm:w-64 mx-auto bg-gradient-to-r from-transparent via-green-500 to-transparent" />
                            <div className="space-y-4 sm:space-y-6 text-white/80 font-mono">
                                <p className="text-base sm:text-xl leading-relaxed">
                                    Welcome to the Clubs Trial, Agent.
                                </p>
                                <p className="text-xs sm:text-base leading-relaxed max-w-md mx-auto">
                                    Work as a team to identify hidden cards. Select Angel and Demon targets.
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Shuffling Screen */}
            <AnimatePresence>
                {phase === 'shuffle' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center">
                        <div className="text-center space-y-4">
                            <RotateCcw size={80} className="text-green-500 animate-spin mx-auto" />
                            <h1 className="text-3xl sm:text-5xl font-cinzel font-black text-white uppercase tracking-widest">
                                Randomizing Assets
                            </h1>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {renderHUD()}

            {/* BOARD VIEW */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 relative bg-black/40">
                <div className="max-w-6xl mx-auto mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 sm:gap-0 px-4 sm:px-0">
                    <div className="space-y-1 w-full sm:w-auto">
                        <h2 className="text-xl sm:text-4xl font-cinzel font-bold text-white uppercase tracking-widest">
                            {phase === 'setup_phase1' ? "SELECT Your CHAMPIONS" :
                                phase === 'selection_reveal' ? "SELECTIONS LOCKED" :
                                    phase === 'playing' ? "HUNTING PHASE" :
                                        phase === 'card_reveal' ? "IDENTITY REVEAL" :
                                            "TRIAL COMPLETE"}
                        </h2>
                        <p className="text-white/40 font-mono text-[9px] sm:text-xs uppercase tracking-[0.2em]">
                            {phase === 'setup_phase1' ? "CHOOSE ANGEL & DEMON CARDS WITH YOUR TEAMATE." :
                                phase === 'playing' ? "VOTE FOR 2 CARDS. FIND ANGEL (+300) & AVOID DEMON (-50)." :
                                    "AWAITING NEXT PHASE..."}
                        </p>
                    </div>

                    {/* Consensus selections displayed */}
                    {(phase === 'setup_phase1' || phase === 'selection_reveal' || phase === 'playing') && (
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                            <div className={`relative px-3 py-2 sm:px-4 sm:py-3 rounded-lg border transition-all duration-300 ${selection.angel ? 'border-yellow-500/50 bg-yellow-500/10 shadow-[0_0_15px_rgba(234,179,8,0.1)]' : 'border-white/5 bg-white/[0.02]'} text-center min-w-[80px] sm:min-w-[100px]`}>
                                <p className="text-[7px] sm:text-[8px] text-yellow-500/70 font-black uppercase tracking-[0.2em] mb-1">TEAM ANGEL</p>
                                <p className="text-base sm:text-lg font-mono font-black text-white">{selection.angel ? selection.angel.split('-')[1] : '-'}</p>
                            </div>
                            <div className={`relative px-3 py-2 sm:px-4 sm:py-3 rounded-lg border transition-all duration-300 ${selection.demon ? 'border-red-500/50 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'border-white/5 bg-white/[0.02]'} text-center min-w-[80px] sm:min-w-[100px]`}>
                                <p className="text-[7px] sm:text-[8px] text-red-500/70 font-black uppercase tracking-[0.2em] mb-1">TEAM DEMON</p>
                                <p className="text-base sm:text-lg font-mono font-black text-white">{selection.demon ? selection.demon.split('-')[1] : '-'}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Grid layout of Cards */}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 max-w-6xl mx-auto px-4 sm:px-0">
                    {cards.map(card => {
                        const isAngelSel = selection.angel === card.id;
                        const isDemonSel = selection.demon === card.id;
                        const isVoted = myVote.includes(card.id);
                        const isBotVoted = botVote.includes(card.id);

                        return (
                            <div
                                key={card.id}
                                onClick={() => handleCardClick(card.id)}
                                className={`relative aspect-[2/3] rounded-xl border flex flex-col items-center justify-between p-3 cursor-pointer transition-all duration-300 ${
                                    isAngelSel ? 'border-yellow-500 bg-yellow-500/10 shadow-[0_0_20px_rgba(234,179,8,0.2)] scale-105' :
                                        isDemonSel ? 'border-red-500 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.2)] scale-105' :
                                            isVoted ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.2)]' :
                                                'border-white/10 bg-[#0a0a0f] hover:border-white/30'
                                }`}
                            >
                                <div className="text-[10px] font-mono text-white/30 self-start">♣</div>
                                <div className="text-3xl font-black font-mono tracking-tighter text-white">{card.rank}</div>
                                
                                {/* Badges */}
                                <div className="flex flex-col items-center gap-1 w-full mt-2">
                                    {isAngelSel && <span className="text-[8px] bg-yellow-500 text-black px-1.5 py-0.5 rounded font-black tracking-widest">ANGEL</span>}
                                    {isDemonSel && <span className="text-[8px] bg-red-500 text-white px-1.5 py-0.5 rounded font-black tracking-widest">DEMON</span>}
                                    {isVoted && <span className="text-[8px] bg-blue-500 text-white px-1.5 py-0.5 rounded font-black tracking-widest">VOTE</span>}
                                    {phase === 'card_reveal' && isBotVoted && <span className="text-[8px] bg-purple-500 text-white px-1.5 py-0.5 rounded font-black tracking-widest">BOT VOTE</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Sub-panels for feedback */}
                {phase === 'setup_phase1' && (
                    <div className="max-w-md mx-auto mt-8 bg-zinc-900/60 border border-white/5 rounded-xl p-4 text-center">
                        <p className="text-xs font-mono text-white/50 mb-2">PARTICIPANTS SELECTION TARGETS</p>
                        <div className="flex justify-around">
                            <div>
                                <span className="text-[10px] text-white/30 block">DEMO-BOT ANGEL</span>
                                <span className="text-yellow-400 font-bold text-lg">A</span>
                            </div>
                            <div>
                                <span className="text-[10px] text-white/30 block">DEMO-BOT DEMON</span>
                                <span className="text-red-400 font-bold text-lg">10</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Trial Complete / Completed Screen */}
            <AnimatePresence>
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
                                TEAMWORK AUCTION COMPLETE
                            </h1>
                            <h2 className="text-xs md:text-sm font-bold font-mono text-green-500 tracking-[0.4em] uppercase italic">
                                VITALITY CHECK // PASSED
                            </h2>
                        </div>

                        {/* Score Card */}
                        <div className="relative group w-full max-w-xl px-4 sm:px-0">
                            <div className="relative rounded-2xl bg-zinc-950/90 backdrop-blur-xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col sm:flex-row items-stretch justify-between p-0 z-10">
                                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-green-500 to-transparent opacity-80" />
                                <div className="flex-1 min-h-[100px] sm:min-h-[140px] flex flex-col items-center justify-center relative p-4 sm:p-6 sm:border-r border-b sm:border-b-0 border-white/5 bg-zinc-900/40">
                                    <p className="text-zinc-500 font-mono text-[10px] sm:text-[9px] uppercase tracking-[0.4em] mb-3">NET MERIT</p>
                                    <p className="text-3xl sm:text-6xl font-black font-oswald tracking-tighter leading-tight text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.15)] py-2">
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
                        </div>

                        {/* Opponent result */}
                        <div className="w-full max-w-xl px-4 sm:px-0">
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

                        {/* Contact Admin CTA */}
                        <div className="w-full max-w-xl px-4 sm:px-0">
                            <div className="relative overflow-hidden bg-gradient-to-br from-red-950/60 to-black/80 border border-red-500/30 rounded-2xl p-5 text-center shadow-[0_0_30px_rgba(255,0,80,0.1)]">
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
                                <div className="flex items-center justify-center gap-3 flex-wrap">
                                    <div className="px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-full">
                                        <span className="text-red-400 font-mono text-[11px] uppercase tracking-widest">
                                            📡 Contact an Admin to unlock your player access
                                        </span>
                                    </div>
                                </div>
                            </div>
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
            </AnimatePresence>
        </div>
    );
};
