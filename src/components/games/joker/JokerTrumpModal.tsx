import React, { useEffect } from 'react';
import { Crown, MapPin, X, ArrowLeftRight, AlertTriangle } from 'lucide-react';
import type { JokerPlayer, MapCell } from './jokerTypes';

interface JokerTrumpModalProps {
    allPlayers: JokerPlayer[];
    myPlayer: JokerPlayer;
    gridMatrix: MapCell[][];
    onClose: () => void;
    onSwapRoom: (targetPlayerId: string) => void;
}

export const JokerTrumpModal: React.FC<JokerTrumpModalProps> = ({
    allPlayers,
    myPlayer,
    gridMatrix,
    onClose,
    onSwapRoom
}) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' || e.key === ' ' || e.code === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const getExitCell = (exitIndex: number) => {
        for (let r = 0; r < 7; r++) {
            for (let c = 0; c < 7; c++) {
                if (gridMatrix[r] && gridMatrix[r][c] && gridMatrix[r][c].type === 'exit' && gridMatrix[r][c].exitIndex === exitIndex) {
                    return gridMatrix[r][c];
                }
            }
        }
        return null;
    };

    const calculateDistance = (p: JokerPlayer) => {
        const exitCell = getExitCell(p.targetExitIndex);
        if (!exitCell) return 999;
        return Math.abs(p.currentR - exitCell.r) + Math.abs(p.currentC - exitCell.c);
    };

    const allCandidates = allPlayers
        .filter(p => p.id !== myPlayer.id && p.status === 'active' && p.username && !p.username.toLowerCase().includes('admin'))
        .map(p => ({
            ...p,
            distanceToExit: calculateDistance(p)
        }))
        .filter(p => p.distanceToExit < 999)
        .sort((a, b) => a.distanceToExit - b.distanceToExit);

    const top3 = allCandidates.slice(0, 3);
    const trumpAttacker = allCandidates.find(p =>
        myPlayer.trumpSwappedBy && (
            p.id === myPlayer.trumpSwappedBy ||
            (p.username && String(p.username).toLowerCase() === String(myPlayer.trumpSwappedBy).toLowerCase())
        )
    );

    const eligiblePlayers = [...top3];
    if (trumpAttacker && !eligiblePlayers.some(p => p.id === trumpAttacker.id)) {
        eligiblePlayers.push(trumpAttacker);
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300 font-mono">
            <div className="w-full max-w-lg bg-slate-950 border-2 border-amber-400/80 rounded-2xl shadow-[0_0_50px_rgba(245,158,11,0.3)] overflow-hidden flex flex-col relative">
                
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 border-b border-amber-400/40 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-950 border border-amber-400 flex items-center justify-center">
                            <Crown size={24} className="text-amber-400 animate-pulse" />
                        </div>
                        <div>
                            <h2 className="text-xl font-cinzel font-bold text-amber-50 tracking-wider">TRUMP CARD // ROOM SWAP</h2>
                            <p className="text-xs text-amber-400/80 uppercase tracking-widest">Swap Room Position With Opponent</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 flex flex-col gap-4">
                    <div className="bg-amber-950/40 border border-amber-400/30 rounded-xl p-4 flex items-start gap-3">
                        <AlertTriangle size={18} className="text-amber-400 mt-0.5 shrink-0 animate-pulse" />
                        <p className="text-xs text-amber-200/90 leading-relaxed uppercase tracking-wider">
                            Activating Trump Card will instantly <span className="font-bold text-amber-400">SWAP ROOM POSITIONS</span> between you and the target player. You will teleport to their room, and they will teleport to yours!
                        </p>
                    </div>

                    <div className="flex flex-col gap-3 mt-1">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select Target Opponent (Top 3 + Attacker):</h4>
                        {eligiblePlayers.length === 0 ? (
                            <div className="text-center p-8 text-slate-500 border border-slate-700 border-dashed rounded-xl uppercase tracking-widest text-sm">
                                No active target opponents found.
                            </div>
                        ) : (
                            eligiblePlayers.map(target => {
                                const isAttacker = !!(myPlayer.trumpSwappedBy && (
                                    target.id === myPlayer.trumpSwappedBy ||
                                    (target.username && String(target.username).toLowerCase() === String(myPlayer.trumpSwappedBy).toLowerCase())
                                ));
                                return (
                                    <div
                                        key={target.id}
                                        className={`border rounded-xl p-3.5 flex items-center justify-between group transition-all ${
                                            isAttacker
                                                ? 'bg-amber-950/70 border-amber-400 ring-2 ring-amber-400/80 shadow-[0_0_20px_rgba(245,158,11,0.5)]'
                                                : 'bg-slate-900 border-slate-700 hover:border-amber-400/80'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                                                {target.avatar_url ? (
                                                    <img src={target.avatar_url} alt={target.username} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-sm font-bold text-slate-300">
                                                        {target.username?.substring(0, 2).toUpperCase() || 'P'}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-100 text-sm">{target.username}</span>
                                                    {isAttacker && (
                                                        <span className="px-2 py-0.5 bg-amber-400 text-slate-950 text-[10px] font-black uppercase rounded-full tracking-wider animate-pulse shadow-sm">
                                                            🎯 ATTACKER
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                                                    <span className="text-amber-400 font-bold">ROOM ({target.currentC}, {target.currentR})</span>
                                                    <div className="flex items-center gap-1">
                                                        <MapPin size={11} className="text-emerald-400" />
                                                        <span>Exit Dist: <span className="text-white font-bold">{target.distanceToExit}</span></span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => onSwapRoom(target.id || target.username)}
                                            className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md flex items-center gap-1.5 hover:scale-105"
                                        >
                                            <ArrowLeftRight size={14} />
                                            SWAP ROOM
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
