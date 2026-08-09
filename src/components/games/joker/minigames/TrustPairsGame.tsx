import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Eye, MessageSquare, ShieldCheck, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { JokerPlayer } from '../jokerTypes';

interface TrustPairsGameProps {
    players: JokerPlayer[];
    myPlayerId: string;
    onComplete: (success: boolean, scoreBonus: number) => void;
}

export const TrustPairsGame: React.FC<TrustPairsGameProps> = ({ players, myPlayerId, onComplete }) => {
    const [subRound, setSubRound] = useState(1); // 1 to 7
    const [subPhase, setSubPhase] = useState<'viewing' | 'clue' | 'trust'>('viewing');
    const [phaseTimer, setPhaseTimer] = useState(10); // 10s view, 30s clue, 20s trust
    const [viewerIndex, setViewerIndex] = useState(0);

    const [secretPath, setSecretPath] = useState<Array<'L' | 'R'>>([]);
    const [typedClue, setTypedClue] = useState('');
    const [myChoice, setMyChoice] = useState<Array<'L' | 'R'>>([]);
    
    const [totalPoints, setTotalPoints] = useState(0);
    const [totalWrong, setTotalWrong] = useState(0);
    const [gameResult, setGameResult] = useState<'playing' | 'won' | 'lost'>('playing');

    const activePlayers = players.length > 0 ? players : [
        { id: myPlayerId, username: 'Player 1', score: 1000 } as any,
        { id: 'bot_2', username: 'Player 2', score: 1000 } as any,
        { id: 'bot_3', username: 'Player 3', score: 1000 } as any
    ];

    const currentViewer = activePlayers[viewerIndex % activePlayers.length];
    const isMeViewer = currentViewer?.id === myPlayerId;

    // Start a sub-round
    const startSubRound = (roundNum: number) => {
        // Generate random 7-step L/R path
        const path: Array<'L' | 'R'> = Array.from({ length: 7 }, () => (Math.random() > 0.5 ? 'L' : 'R'));
        setSecretPath(path);
        setMyChoice([]);
        setTypedClue('');
        setSubPhase('viewing');
        setPhaseTimer(10);
    };

    useEffect(() => {
        startSubRound(1);
    }, []);

    // Timer controller for 3 sub-phases
    useEffect(() => {
        if (gameResult !== 'playing') return;

        const timer = setInterval(() => {
            setPhaseTimer(prev => {
                if (prev <= 1) {
                    if (subPhase === 'viewing') {
                        setSubPhase('clue');
                        return 30; // 30s clue phase
                    } else if (subPhase === 'clue') {
                        setSubPhase('trust');
                        return 20; // 20s trust phase
                    } else if (subPhase === 'trust') {
                        evaluateSubRound();
                        return 10;
                    }
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [subPhase, gameResult, secretPath, myChoice]);

    const evaluateSubRound = () => {
        // Compare choice with secretPath
        let correctCount = 0;
        secretPath.forEach((step, idx) => {
            if (myChoice[idx] === step) correctCount++;
        });

        const roundPts = correctCount * 2;
        const wrongPts = (7 - correctCount);
        const newPts = totalPoints + roundPts;
        const newWrong = totalWrong + wrongPts;

        setTotalPoints(newPts);
        setTotalWrong(newWrong);

        if (subRound >= 7 || newWrong >= 10 || newPts >= 39) {
            const won = newPts >= 39 && newWrong < 10;
            setGameResult(won ? 'won' : 'lost');
            setTimeout(() => onComplete(won, won ? 300 : 0), 2000);
        } else {
            const nextRound = subRound + 1;
            setSubRound(nextRound);
            setViewerIndex(prev => prev + 1);
            startSubRound(nextRound);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center w-full max-w-4xl p-6 bg-[#050508]/95 border border-slate-400/30 rounded-2xl backdrop-blur-xl shadow-[0_0_50px_rgba(226,232,240,0.15)] text-slate-100 font-mono">
            {/* Header Dialog */}
            <div className="w-full pb-4 border-b border-slate-700/50 flex justify-between items-center">
                <div>
                    <h3 className="font-cinzel text-xl sm:text-2xl font-black text-slate-200 uppercase tracking-widest flex items-center gap-3">
                        <Users className="text-purple-400 animate-pulse" size={24} />
                        TRUST & CLUES :: PAIR PROTOCOL
                    </h3>
                    <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] mt-1">
                        ROUND {subRound}/7 // VIEWER: {currentViewer?.username} // TARGET PASSING SCORE: 39 PTS
                    </p>
                </div>

                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest block">Sub-Phase Timer</span>
                        <span className="text-2xl font-bold text-slate-200">{phaseTimer}s</span>
                    </div>

                    <div className="text-right">
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest block">Points</span>
                        <span className="text-2xl font-bold text-emerald-400">{totalPoints}/39</span>
                    </div>

                    <div className="text-right">
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest block">Wrong Max</span>
                        <span className={`text-2xl font-bold ${totalWrong >= 10 ? 'text-red-500' : 'text-slate-300'}`}>
                            {totalWrong}/10
                        </span>
                    </div>
                </div>
            </div>

            {/* Permanent Top Hint Banner */}
            <div className="w-full my-4 p-3 bg-slate-900/80 border border-purple-500/30 rounded-xl flex items-center justify-between text-xs">
                <span className="text-purple-300 font-bold uppercase tracking-widest flex items-center gap-2">
                    <ShieldCheck size={16} className="text-purple-400" /> PERMANENT HINT: TRUST THE VIEWER'S CLUE SIGNAL OR ALTER VECTOR
                </span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                    SUB-PHASE: {subPhase.toUpperCase()}
                </span>
            </div>

            {/* Sub-phase 1: Viewing (Viewer Only sees Secret Path) */}
            {subPhase === 'viewing' && (
                <div className="w-full p-6 bg-black/60 border border-slate-700/60 rounded-xl text-center space-y-4 my-2">
                    <h4 className="text-sm text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2">
                        <Eye size={18} className="text-slate-300" /> PHASE 1: PATH REVEAL
                    </h4>
                    {isMeViewer ? (
                        <div className="flex justify-center items-center gap-3 py-4">
                            {secretPath.map((step, idx) => (
                                <div key={idx} className="w-12 h-16 bg-purple-950/80 border-2 border-purple-400 rounded-lg flex flex-col items-center justify-center">
                                    <span className="text-[9px] text-purple-300 font-bold">#{idx + 1}</span>
                                    <span className="text-xl font-black text-white">{step === 'L' ? 'LEFT' : 'RIGHT'}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="py-6 text-slate-400 text-xs uppercase tracking-widest animate-pulse">
                            VIEWER "{currentViewer?.username}" IS MEMORIZING THE SECRET 7-STEP VECTOR...
                        </p>
                    )}
                </div>
            )}

            {/* Sub-phase 2: Clue Giving (30s) */}
            {subPhase === 'clue' && (
                <div className="w-full p-6 bg-black/60 border border-slate-700/60 rounded-xl space-y-4 my-2">
                    <h4 className="text-sm text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <MessageSquare size={18} className="text-slate-300" /> PHASE 2: CLUE BROADCAST (30S)
                    </h4>
                    {isMeViewer ? (
                        <div className="space-y-3">
                            <label className="text-[10px] text-slate-400 uppercase tracking-wider block">TYPE TACTICAL CLUE SIGNAL TO TEAMMATES:</label>
                            <input
                                type="text"
                                value={typedClue}
                                onChange={(e) => setTypedClue(e.target.value)}
                                placeholder="e.g., L-R-L-L-R-R-L or Go Left twice then Right..."
                                className="w-full p-3 bg-slate-900 border border-purple-500/50 rounded-lg text-sm text-white placeholder-slate-600 font-mono focus:outline-none focus:border-purple-400"
                            />
                        </div>
                    ) : (
                        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg text-center">
                            <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1">CLUE FROM VIEWER "{currentViewer?.username}":</span>
                            <span className="text-lg font-bold text-purple-300 tracking-wider">
                                {typedClue || 'Broadcasting clue sequence...'}
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Sub-phase 3: Trust Guessing (20s) */}
            {subPhase === 'trust' && (
                <div className="w-full p-6 bg-black/60 border border-slate-700/60 rounded-xl space-y-4 my-2">
                    <h4 className="text-sm text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <ShieldCheck size={18} className="text-emerald-400" /> PHASE 3: TEAMMATES TRUST CHOICE (20S)
                    </h4>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">SELECT 7-STEP DIRECTION COMBINATION (EDITABLE WITHIN TIMER):</p>
                    
                    <div className="grid grid-cols-7 gap-2 my-4">
                        {Array.from({ length: 7 }).map((_, idx) => (
                            <div key={idx} className="flex flex-col items-center gap-2">
                                <span className="text-[9px] text-slate-400 font-mono font-bold">#{idx + 1}</span>
                                <button
                                    onClick={() => {
                                        const next = [...myChoice];
                                        next[idx] = 'L';
                                        setMyChoice(next);
                                    }}
                                    className={`w-full py-1.5 px-1 rounded border flex flex-col items-center justify-center gap-1 transition-all ${myChoice[idx] === 'L' ? 'bg-slate-200 border-white text-black font-black scale-105 shadow-[0_0_10px_rgba(226,232,240,0.5)]' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                                >
                                    <img src="/left.png" alt="Left" className="w-5 h-5 object-contain" />
                                    <span className="text-[9px] font-mono font-bold">LEFT</span>
                                </button>
                                <button
                                    onClick={() => {
                                        const next = [...myChoice];
                                        next[idx] = 'R';
                                        setMyChoice(next);
                                    }}
                                    className={`w-full py-1.5 px-1 rounded border flex flex-col items-center justify-center gap-1 transition-all ${myChoice[idx] === 'R' ? 'bg-slate-200 border-white text-black font-black scale-105 shadow-[0_0_10px_rgba(226,232,240,0.5)]' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                                >
                                    <img src="/right.png" alt="Right" className="w-5 h-5 object-contain" />
                                    <span className="text-[9px] font-mono font-bold">RIGHT</span>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Result Toast */}
            {gameResult !== 'playing' && (
                <div className={`mt-4 p-3 rounded-lg font-black text-sm uppercase tracking-widest border ${gameResult === 'won' ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300' : 'bg-red-950/80 border-red-500 text-red-300'}`}>
                    {gameResult === 'won' ? 'TRUST PROTOCOL PASSED (+300 CR)' : 'TRUST PROTOCOL FAILED (0 CR DEDUCTION)'}
                </div>
            )}
        </div>
    );
};
