import React, { useEffect } from 'react';
import { Snowflake, MapPin, X, AlertTriangle } from 'lucide-react';
import type { JokerPlayer, MapCell } from './jokerTypes';

interface JokerFreezeModalProps {
    allPlayers: JokerPlayer[];
    myPlayer: JokerPlayer;
    gridMatrix: MapCell[][];
    onClose: () => void;
    onFreezePlayer: (playerId: string) => void;
}

export const JokerFreezeModal: React.FC<JokerFreezeModalProps> = ({
    allPlayers,
    myPlayer,
    gridMatrix,
    onClose,
    onFreezePlayer
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

    // Calculate Manhattan distance as a simple shortest-path heuristic
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
    const freezeAttacker = allCandidates.find(p =>
        (myPlayer.frozenByPlayerId && p.id === myPlayer.frozenByPlayerId) ||
        (myPlayer.frozenBy && (
            p.id === myPlayer.frozenBy ||
            (p.username && String(p.username).toLowerCase() === String(myPlayer.frozenBy).toLowerCase())
        ))
    );

    const eligiblePlayers = [...top3];
    if (freezeAttacker && !eligiblePlayers.some(p => p.id === freezeAttacker.id)) {
        eligiblePlayers.push(freezeAttacker);
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300 font-mono">
            <div className="w-full max-w-lg bg-slate-900 border-2 border-cyan-500/50 rounded-2xl shadow-[0_0_40px_rgba(6,182,212,0.2)] overflow-hidden flex flex-col relative">
                
                {/* Header */}
                <div className="bg-gradient-to-r from-cyan-950 to-slate-900 border-b border-cyan-500/30 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-400 flex items-center justify-center">
                            <Snowflake size={24} className="text-cyan-400 animate-pulse" />
                        </div>
                        <div>
                            <h2 className="text-xl font-cinzel font-bold text-cyan-50 tracking-wider">FREEZE CARD ACTIVATED</h2>
                            <p className="text-xs text-cyan-400/80 uppercase tracking-widest">Select target to freeze</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 flex flex-col gap-4">
                    <div className="bg-cyan-950/30 border border-cyan-500/20 rounded-xl p-4 flex items-start gap-3">
                        <AlertTriangle size={18} className="text-cyan-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-cyan-200/90 leading-relaxed uppercase tracking-wider">
                            Applying Freeze will increase the target's door costs by <span className="font-bold text-cyan-400">5X</span> for their next purchase. Shown below are the <span className="font-bold text-white">Top 3 Active Players + Attacker</span>.
                        </p>
                    </div>

                    <div className="flex flex-col gap-3 mt-2">
                        {eligiblePlayers.length === 0 ? (
                            <div className="text-center p-8 text-slate-500 border border-slate-700 border-dashed rounded-xl uppercase tracking-widest text-sm">
                                No eligible targets found.
                            </div>
                        ) : (
                            eligiblePlayers.map(target => {
                                const isAttacker = !!(
                                    (myPlayer.frozenByPlayerId && target.id === myPlayer.frozenByPlayerId) ||
                                    (myPlayer.frozenBy && (
                                        target.id === myPlayer.frozenBy ||
                                        (target.username && String(target.username).toLowerCase() === String(myPlayer.frozenBy).toLowerCase())
                                    ))
                                );
                                return (
                                    <div
                                        key={target.id}
                                        className={`border rounded-xl p-3 flex items-center justify-between group transition-all ${
                                            isAttacker
                                                ? 'bg-cyan-950/70 border-cyan-400 ring-2 ring-cyan-400/80 shadow-[0_0_20px_rgba(6,182,212,0.5)]'
                                                : 'bg-slate-800/50 border-slate-700 hover:border-cyan-500/50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center overflow-hidden shrink-0">
                                                {target.avatar_url ? (
                                                    <img src={target.avatar_url} alt={target.username} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-sm font-bold text-slate-400">
                                                        {target.username?.substring(0, 2).toUpperCase() || 'P'}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-200 text-sm">{target.username}</span>
                                                    {isAttacker && (
                                                        <span className="px-2 py-0.5 bg-cyan-400 text-slate-950 text-[10px] font-black uppercase rounded-full tracking-wider animate-pulse shadow-sm">
                                                            🎯 ATTACKER
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                                    <MapPin size={12} className="text-emerald-400" />
                                                    <span>Distance to Exit: <span className="text-white font-bold">{target.distanceToExit}</span></span>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => onFreezePlayer(target.id || target.username)}
                                            className="px-4 py-2 bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-400 rounded-lg text-xs font-bold uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(6,182,212,0.1)] group-hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] cursor-pointer"
                                        >
                                            FREEZE
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
