import React from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, Timer, ChevronRight } from 'lucide-react';

interface JokerBriefingProps {
    timeLeft: number;
    onStartGame?: () => void;
}

export const JokerBriefing: React.FC<JokerBriefingProps> = ({ timeLeft, onStartGame }) => {
    return (
        <div className="fixed inset-0 z-[1000] bg-white flex items-center justify-center p-4 sm:p-6 overflow-y-auto font-mono select-none">
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-full max-w-2xl bg-white border border-slate-300 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col font-mono text-slate-900 relative"
            >
                {/* Header */}
                <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-slate-200 border border-slate-300 rounded-xl text-slate-900">
                            <ShieldAlert size={24} className="animate-pulse text-slate-900" />
                        </div>
                        <div>
                            <h2 className="font-cinzel text-xl sm:text-2xl font-black text-slate-950 uppercase tracking-widest leading-none">
                                JOKER TRIAL :: THE ULTIMATE PROTOCOL
                            </h2>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1.5">
                                TACTICAL BRIEFING // INDIVIDUAL 14-ROUND LABYRINTH
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-300 rounded-xl shadow-sm">
                        <Timer size={16} className="text-slate-600 animate-pulse" />
                        <span className="text-sm font-black text-slate-900">{timeLeft}s</span>
                    </div>
                </div>

                {/* Content Body - Crisp White Aesthetic */}
                <div className="p-6 space-y-5 text-xs text-slate-800 leading-relaxed font-mono">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                        <h4 className="text-xs font-black text-slate-950 uppercase tracking-widest font-cinzel">
                            RULES OF ENGAGEMENT
                        </h4>
                        <p className="text-slate-600 text-[11px] font-medium uppercase tracking-wider">
                            Navigate the rotated maze matrix from your designated RED ENTRY point to your GREEN EXIT point. You have 14 rounds to survive.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl shadow-sm">
                            <span className="font-black text-slate-950 uppercase tracking-widest block mb-1">🚪 DOOR SELECTION (80S)</span>
                            <span className="text-slate-600 font-medium">Choose and buy 1 door per round. Failing to buy incurs a -100 points penalty.</span>
                        </div>
                        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl shadow-sm">
                            <span className="font-black text-slate-950 uppercase tracking-widest block mb-1">🃏 4 SPECIAL DOOR CARDS</span>
                            <span className="text-slate-600 font-medium">Red (2X next), Green (Free), Skip (Advance 2), Freeze (5X price for others).</span>
                        </div>
                        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl shadow-sm">
                            <span className="font-black text-slate-950 uppercase tracking-widest block mb-1">⚔️ SPECIAL ROUNDS (4, 8, 12)</span>
                            <span className="text-slate-600 font-medium">Overridden by 3 Minigames: Pair Slip, Stroop Reflex, and Trust & Clues.</span>
                        </div>
                        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl shadow-sm">
                            <span className="font-black text-slate-950 uppercase tracking-widest block mb-1">🏁 WINNING CONDITION</span>
                            <span className="text-slate-600 font-medium">First to reach GREEN EXIT wins +1000 points. All other players receive -200 points.</span>
                        </div>
                    </div>

                    {/* Confirmation Button */}
                    {onStartGame && (
                        <div className="pt-4 border-t border-slate-200 flex justify-end">
                            <button
                                onClick={onStartGame}
                                className="flex items-center gap-2 bg-slate-950 hover:bg-black text-white px-6 py-3 rounded-xl text-xs font-bold font-mono tracking-widest uppercase transition-all shadow-md cursor-pointer"
                            >
                                ACKNOWLEDGE & BEGIN <ChevronRight size={16} />
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};
