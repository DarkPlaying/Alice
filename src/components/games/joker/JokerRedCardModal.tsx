import React, { useState, useEffect } from 'react';
import { ShieldAlert, MapPin, X, AlertTriangle, ArrowUp, ArrowRight, ArrowDown, ArrowLeft } from 'lucide-react';
import type { JokerPlayer, MapCell } from './jokerTypes';

interface JokerRedCardModalProps {
    allPlayers: JokerPlayer[];
    myPlayer: JokerPlayer;
    gridMatrix: MapCell[][];
    onClose: () => void;
    onBlockPlayerDoor: (targetPlayerId: string, direction: 'up' | 'right' | 'down' | 'left') => void;
}

export const JokerRedCardModal: React.FC<JokerRedCardModalProps> = ({
    allPlayers,
    myPlayer,
    gridMatrix,
    onClose,
    onBlockPlayerDoor
}) => {
    const [selectedPlayer, setSelectedPlayer] = useState<JokerPlayer | null>(null);

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
    const redAttacker = allCandidates.find(p =>
        (myPlayer.blockedByPlayerId && p.id === myPlayer.blockedByPlayerId) ||
        (myPlayer.blockedByPlayerName && (
            p.id === myPlayer.blockedByPlayerName ||
            (p.username && String(p.username).toLowerCase() === String(myPlayer.blockedByPlayerName).toLowerCase())
        ))
    );

    const eligiblePlayers = [...top3];
    if (redAttacker && !eligiblePlayers.some(p => p.id === redAttacker.id)) {
        eligiblePlayers.push(redAttacker);
    }

    const getAvailableDoors = (p: JokerPlayer) => {
        const cell = gridMatrix[p.currentR]?.[p.currentC];
        if (!cell || !cell.doors) return [];
        return cell.doors;
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300 font-mono">
            <div className="w-full max-w-lg bg-slate-950 border-2 border-red-500/80 rounded-2xl shadow-[0_0_50px_rgba(239,68,68,0.3)] overflow-hidden flex flex-col relative">
                
                {/* Header */}
                <div className="bg-gradient-to-r from-red-950 via-slate-900 to-red-950 border-b border-red-500/40 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-950 border border-red-500 flex items-center justify-center">
                            <ShieldAlert size={24} className="text-red-400 animate-pulse" />
                        </div>
                        <div>
                            <h2 className="text-xl font-cinzel font-bold text-red-50 tracking-wider">RED CARD ATTACK</h2>
                            <p className="text-xs text-red-400/80 uppercase tracking-widest">Block Target Player Door Direction</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 flex flex-col gap-4">
                    <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
                        <AlertTriangle size={18} className="text-red-400 mt-0.5 shrink-0 animate-pulse" />
                        <p className="text-xs text-red-200/90 leading-relaxed uppercase tracking-wider">
                            Select a target player and choose which door direction to <span className="font-bold text-red-400">BLOCK</span> for their current room. If 3 doors are blocked on a single room, all doors become blocked!
                        </p>
                    </div>

                    {!selectedPlayer ? (
                        <div className="flex flex-col gap-3 mt-1">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select Target Player (Top 3 + Attacker):</h4>
                            {eligiblePlayers.length === 0 ? (
                                <div className="text-center p-8 text-slate-500 border border-slate-700 border-dashed rounded-xl uppercase tracking-widest text-sm">
                                    No active target opponents found.
                                </div>
                            ) : (
                                eligiblePlayers.map(target => {
                                    const isAttacker = !!(
                                        (myPlayer.blockedByPlayerId && target.id === myPlayer.blockedByPlayerId) ||
                                        (myPlayer.blockedByPlayerName && (
                                            target.id === myPlayer.blockedByPlayerName ||
                                            (target.username && String(target.username).toLowerCase() === String(myPlayer.blockedByPlayerName).toLowerCase())
                                        ))
                                    );
                                    return (
                                        <div
                                            key={target.id}
                                            onClick={() => setSelectedPlayer(target)}
                                            className={`border rounded-xl p-3.5 flex items-center justify-between group transition-all cursor-pointer ${
                                                isAttacker
                                                    ? 'bg-red-950/70 border-red-500 ring-2 ring-red-500/80 shadow-[0_0_20px_rgba(239,68,68,0.5)]'
                                                    : 'bg-slate-900 border-slate-700 hover:border-red-500/80 hover:bg-red-950/20'
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
                                                            <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-black uppercase rounded-full tracking-wider animate-pulse shadow-sm">
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
                                            <span className="text-xs font-bold text-red-400 group-hover:underline uppercase tracking-wider">SELECT &rarr;</span>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between bg-slate-900 p-3 rounded-xl border border-slate-800">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400 uppercase font-bold">Target:</span>
                                    <span className="text-sm font-extrabold text-red-400 uppercase">{selectedPlayer.username}</span>
                                </div>
                                <button
                                    onClick={() => setSelectedPlayer(null)}
                                    className="text-[10px] text-slate-400 hover:text-white underline uppercase font-bold"
                                >
                                    Change Target
                                </button>
                            </div>

                            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Select Direction To Block:</h4>
                            <div className="grid grid-cols-2 gap-3">
                                {getAvailableDoors(selectedPlayer).map(door => {
                                    const dir = door.direction as 'up' | 'right' | 'down' | 'left';
                                    const isBlockedAlready = (selectedPlayer.blockedDoorsByRed || []).includes(dir);

                                    return (
                                        <button
                                            key={dir}
                                            disabled={isBlockedAlready}
                                            onClick={() => {
                                                onBlockPlayerDoor(selectedPlayer.id || selectedPlayer.username, dir);
                                                onClose();
                                            }}
                                            className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all font-mono ${
                                                isBlockedAlready
                                                    ? 'bg-slate-900 border-slate-800 text-slate-600 opacity-50 cursor-not-allowed'
                                                    : 'bg-red-950/40 hover:bg-red-900/80 border-red-500/80 text-red-100 hover:scale-105 cursor-pointer shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                                            }`}
                                        >
                                            {dir === 'up' && <ArrowUp size={24} className="text-red-400" />}
                                            {dir === 'right' && <ArrowRight size={24} className="text-red-400" />}
                                            {dir === 'down' && <ArrowDown size={24} className="text-red-400" />}
                                            {dir === 'left' && <ArrowLeft size={24} className="text-red-400" />}
                                            <span className="text-xs font-black uppercase tracking-widest">{dir} VECTOR DOOR</span>
                                            <span className="text-[9px] text-red-300 font-bold uppercase">{isBlockedAlready ? 'ALREADY BLOCKED' : 'BLOCK DOOR'}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
