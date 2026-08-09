import React from 'react';
import { FastForward, X, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { MapCell, JokerPlayer } from './jokerTypes';

interface JokerSkipModalProps {
    myPlayer: JokerPlayer;
    gridMatrix: MapCell[][];
    onClose: () => void;
    onConfirmSkip: () => void;
}

export const JokerSkipModal: React.FC<JokerSkipModalProps> = ({
    myPlayer,
    gridMatrix,
    onClose,
    onConfirmSkip
}) => {
    const currentR = Number(myPlayer.currentR || 0);
    const currentC = Number(myPlayer.currentC || 0);

    const checkDirectionStatus = (dir: 'up' | 'down' | 'left' | 'right') => {
        let s1R = currentR, s1C = currentC;
        let s2R = currentR, s2C = currentC;
        if (dir === 'up') { s1R -= 1; s2R -= 2; }
        if (dir === 'down') { s1R += 1; s2R += 2; }
        if (dir === 'left') { s1C -= 1; s2C -= 2; }
        if (dir === 'right') { s1C += 1; s2C += 2; }

        const c1 = gridMatrix[s1R]?.[s1C];
        const c2 = gridMatrix[s2R]?.[s2C];

        const is1Blocked = !c1 || c1.type === 'wall' || c1.type === 'empty' || c1.isBlockedCell;
        const is2Blocked = !c2 || c2.type === 'wall' || c2.type === 'empty' || c2.isBlockedCell;

        return !(is1Blocked || is2Blocked);
    };

    const statusUp = checkDirectionStatus('up');
    const statusDown = checkDirectionStatus('down');
    const statusLeft = checkDirectionStatus('left');
    const statusRight = checkDirectionStatus('right');

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="w-full max-w-lg bg-slate-900 border-2 border-amber-500/50 rounded-2xl shadow-[0_0_40px_rgba(245,158,11,0.2)] overflow-hidden flex flex-col relative font-mono">
                
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-950 to-slate-900 border-b border-amber-500/30 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-950 border border-amber-400 flex items-center justify-center">
                            <FastForward size={24} className="text-amber-400 animate-pulse" />
                        </div>
                        <div>
                            <h2 className="text-xl font-cinzel font-bold text-amber-50 tracking-wider">SKIP CARD ACTIVATED</h2>
                            <p className="text-xs text-amber-400/80 uppercase tracking-widest">2-Step Quantum Leap Capability</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 flex flex-col gap-4">
                    <div className="bg-amber-950/30 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                        <AlertTriangle size={20} className="text-amber-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-amber-200/90 leading-relaxed uppercase tracking-wider">
                            Activating <span className="font-bold text-amber-400">SKIP CARD</span> enables you to leap <span className="font-bold text-white">2 rooms ahead</span> in a straight line through your chosen vector.
                        </p>
                    </div>

                    <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2">
                        <h4 className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Vector Feasibility Check</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className={`p-2 rounded-lg border flex items-center justify-between ${statusUp ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-red-950/40 border-red-500/40 text-red-400'}`}>
                                <span>UP VECTOR</span>
                                <span className="font-bold text-[10px]">{statusUp ? 'VALID (2 STEPS)' : 'BLOCKED'}</span>
                            </div>
                            <div className={`p-2 rounded-lg border flex items-center justify-between ${statusDown ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-red-950/40 border-red-500/40 text-red-400'}`}>
                                <span>DOWN VECTOR</span>
                                <span className="font-bold text-[10px]">{statusDown ? 'VALID (2 STEPS)' : 'BLOCKED'}</span>
                            </div>
                            <div className={`p-2 rounded-lg border flex items-center justify-between ${statusLeft ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-red-950/40 border-red-500/40 text-red-400'}`}>
                                <span>LEFT VECTOR</span>
                                <span className="font-bold text-[10px]">{statusLeft ? 'VALID (2 STEPS)' : 'BLOCKED'}</span>
                            </div>
                            <div className={`p-2 rounded-lg border flex items-center justify-between ${statusRight ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-red-950/40 border-red-500/40 text-red-400'}`}>
                                <span>RIGHT VECTOR</span>
                                <span className="font-bold text-[10px]">{statusRight ? 'VALID (2 STEPS)' : 'BLOCKED'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 mt-2">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer"
                        >
                            CANCEL
                        </button>
                        <button
                            onClick={() => {
                                onConfirmSkip();
                                onClose();
                            }}
                            className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(245,158,11,0.4)] cursor-pointer flex items-center justify-center gap-2"
                        >
                            <ShieldCheck size={16} /> CONFIRM SKIP
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
