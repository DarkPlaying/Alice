import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { MapCell, JokerPlayer } from './jokerTypes';
import { Users, Shield, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, X } from 'lucide-react';
import { parseMapMatrix } from './jokerMapData';

interface JokerMapGridProps {
    gridMatrix: any;
    players: JokerPlayer[];
    currentPlayerId?: string;
    isAdminView?: boolean;
    targetExitOnlyIndex?: number;
    onCellClick?: (cell: MapCell) => void;
}

export const JokerMapGrid: React.FC<JokerMapGridProps> = ({
    gridMatrix: rawGridMatrix,
    players,
    currentPlayerId,
    isAdminView = false,
    targetExitOnlyIndex,
    onCellClick
}) => {
    const gridMatrix = parseMapMatrix(rawGridMatrix).grid;
    const [selectedCellModal, setSelectedCellModal] = useState<{ cell: MapCell; cellPlayers: JokerPlayer[] } | null>(null);

    const isGameCardVision = targetExitOnlyIndex !== undefined;

    // Group players by cell coordinate key "r,c" (Filter out non-active players)
    const playersByCell: Record<string, JokerPlayer[]> = {};
    const validPlayers = (players || []).filter(p => p && p.status === 'active');

    validPlayers.forEach(p => {
        const key = `${p.currentR},${p.currentC}`;
        if (!playersByCell[key]) playersByCell[key] = [];
        playersByCell[key].push(p);
    });

    const handleGridCellClick = (cell: MapCell) => {
        const key = `${cell.r},${cell.c}`;
        const cellPlayers = playersByCell[key] || [];

        if (isAdminView) {
            setSelectedCellModal({ cell, cellPlayers });
        }

        if (onCellClick) {
            onCellClick(cell);
        }
    };

    return (
        <div className="flex flex-col items-center w-full max-w-[480px] sm:max-w-[500px] mx-auto font-mono select-none">
            {/* 7x7 Grid Container (Silver Theme) */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5 p-2 sm:p-3 bg-[#050508]/90 border border-slate-400/40 rounded-2xl backdrop-blur-xl shadow-[0_0_60px_rgba(226,232,240,0.15)] w-full aspect-square">
                {gridMatrix.map((row, r) =>
                    row.map((cell, c) => {
                        const cellKey = `${r},${c}`;
                        const cellPlayers = playersByCell[cellKey] || [];
                        const isCurrentPlayerHere = !isGameCardVision && cellPlayers.some(p => p.id === currentPlayerId);

                        let bgStyle = 'bg-slate-900/90 border-slate-400/60 text-slate-100 shadow-[0_0_12px_rgba(226,232,240,0.18)]';
                        if (cell.type === 'wall' || cell.isBlockedCell) {
                            bgStyle = 'bg-black border-slate-900 opacity-90';
                        } else if (cell.type === 'entry') {
                            bgStyle = isGameCardVision
                                ? 'bg-slate-900/90 border-slate-400/60 text-slate-100 shadow-[0_0_12px_rgba(226,232,240,0.18)]'
                                : 'bg-red-950/80 border-red-500 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.3)]';
                        } else if (cell.type === 'exit') {
                            const isMyExit = isGameCardVision ? cell.exitIndex === targetExitOnlyIndex : true;
                            bgStyle = isMyExit
                                ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200 shadow-[0_0_20px_rgba(34,197,94,0.6)] animate-pulse'
                                : 'bg-slate-900/90 border-slate-400/60 text-slate-100 shadow-[0_0_12px_rgba(226,232,240,0.18)]';
                        }

                        return (
                            <motion.div
                                key={cellKey}
                                whileHover={cell.type !== 'wall' ? { scale: 1.05 } : {}}
                                onClick={() => handleGridCellClick(cell)}
                                className={`relative aspect-square w-full h-full rounded-lg border flex flex-col items-center justify-center p-0.5 transition-all duration-300 cursor-pointer overflow-hidden ${bgStyle} ${
                                    isCurrentPlayerHere ? 'ring-2 ring-slate-200 ring-offset-1 ring-offset-black shadow-[0_0_20px_rgba(255,255,255,0.4)]' : ''
                                }`}
                            >
                                {/* Cell Type Labels & Centered Box Door Value */}
                                {cell.type === 'entry' && !isGameCardVision && (
                                    <div className="flex flex-col items-center justify-center leading-none">
                                        <span className="text-[9px] sm:text-[11px] font-black font-cinzel text-red-400">
                                            R{cell.entryIndex}
                                        </span>
                                    </div>
                                )}
                                {cell.type === 'exit' && (
                                    <div className="flex flex-col items-center justify-center leading-none w-full h-full p-0.5 relative">
                                        {targetExitOnlyIndex && cell.exitIndex === targetExitOnlyIndex ? (
                                            <img
                                                src="/specialcard_joker/Win Card.png"
                                                alt={`Exit G${cell.exitIndex}`}
                                                className="w-full h-full object-cover rounded shadow-[0_0_12px_rgba(34,197,94,0.8)] animate-pulse"
                                            />
                                        ) : (
                                            <span className="text-[9px] sm:text-[11px] font-black font-cinzel text-emerald-400">
                                                G{cell.exitIndex}
                                            </span>
                                        )}
                                    </div>
                                )}
                                {cell.type === 'path' && !isGameCardVision && (
                                    <div className="flex flex-col items-center justify-center leading-none">
                                         {/* Render special card indicator dots */}
                                         {(() => {
                                             const specCards = cell.specialCards || [];
                                             if (specCards.length === 0) return null;
                                             return (
                                                 <div className="flex items-center gap-0.5 mt-0.5">
                                                      {specCards.map((scType, sIdx) => {
                                                          let dotColor = 'bg-red-400';
                                                          if (scType === 'green') dotColor = 'bg-emerald-400';
                                                          if (scType === 'skip') dotColor = 'bg-amber-400';
                                                          if (scType === 'freeze') dotColor = 'bg-cyan-400';
                                                          if (scType === 'trump' as any) dotColor = 'bg-purple-500 shadow-[0_0_8px_#c084fc] animate-pulse';
                                                          return (
                                                              <span key={sIdx} className={`w-1.5 h-1.5 rounded-full ${dotColor} shadow-[0_0_6px_currentColor]`} />
                                                          );
                                                      })}
                                                 </div>
                                             );
                                         })()}
                                    </div>
                                )}

                                {/* Admin Player Indicator Dots */}
                                {!isGameCardVision && cellPlayers.length > 0 && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                                        {cellPlayers.length === 1 ? (
                                            /* Single Player Dot = Blue Dot (to avoid confusion with Red Special Cards) */
                                            <div className="w-3.5 h-3.5 bg-blue-500 rounded-full border border-white shadow-[0_0_10px_#3b82f6] animate-pulse flex items-center justify-center">
                                                <span className="text-[6px] font-bold text-white">1</span>
                                            </div>
                                        ) : (
                                            /* Grouped Players Dot = Green Dot */
                                            <div className="w-4 h-4 bg-emerald-500 rounded-full border border-white shadow-[0_0_12px_#22c55e] animate-pulse flex items-center justify-center">
                                                <span className="text-[7px] font-black text-black">{cellPlayers.length}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Render Map Door Bars Directly on Cell Edges (Clean Silver Connectors) */}
                                {cell.type !== 'wall' && cell.doors && cell.doors.map((door, dIdx) => {
                                    let posClass = 'top-0 left-1/2 -translate-x-1/2 w-3.5 h-[2px]';
                                    let textClass = 'top-1 left-1/2 -translate-x-1/2';
                                    if (door.direction === 'down') {
                                        posClass = 'bottom-0 left-1/2 -translate-x-1/2 w-3.5 h-[2px]';
                                        textClass = 'bottom-1 left-1/2 -translate-x-1/2';
                                    }
                                    if (door.direction === 'left') {
                                        posClass = 'left-0 top-1/2 -translate-y-1/2 w-[2px] h-3.5';
                                        textClass = 'left-1.5 top-1/2 -translate-y-1/2 rotate-[-90deg]';
                                    }
                                    if (door.direction === 'right') {
                                        posClass = 'right-0 top-1/2 -translate-y-1/2 w-[2px] h-3.5';
                                        textClass = 'right-1.5 top-1/2 -translate-y-1/2 rotate-90';
                                    }

                                    const isSpecial = door.cardType === 'special';

                                    return (
                                        <React.Fragment key={dIdx}>
                                            <div
                                                className={`absolute z-10 transition-all rounded-full pointer-events-none ${posClass} ${
                                                    isSpecial
                                                        ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24]'
                                                        : 'bg-slate-300/80 shadow-[0_0_6px_rgba(226,232,240,0.6)]'
                                                }`}
                                            />
                                            {!isGameCardVision && door.cost && (
                                                <span className={`absolute z-20 text-[5px] sm:text-[6px] font-mono font-bold text-slate-300 pointer-events-none ${textClass}`}>
                                                    {door.cost}
                                                </span>
                                            )}
                                        </React.Fragment>
                                    );
                                })}

                                {/* Special Card Indicator (Single amber dot per special box) */}
                                {!isGameCardVision && isAdminView && cell.doors && cell.doors.some(d => d.cardType === 'special') && (
                                    <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none z-10">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 border border-black shadow-[0_0_6px_#fbbf24]" />
                                    </div>
                                )}
                            </motion.div>
                        );
                    })
                )}
            </div>

            {/* Admin Cell Inspector Modal (Max 2 Info Cards: Door Value & Special Cards) */}
            <AnimatePresence>
                {selectedCellModal && (
                    <div className="fixed inset-0 z-[1200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
                        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-[#050508] border border-slate-400 p-6 rounded-xl max-w-md w-full font-mono text-slate-100 relative shadow-2xl">
                            <button
                                onClick={() => setSelectedCellModal(null)}
                                className="absolute top-4 right-4 text-slate-500 hover:text-white"
                            >
                                <X size={20} />
                            </button>

                            <h4 className="font-cinzel text-lg font-bold text-slate-200 uppercase tracking-widest mb-1 flex items-center gap-2">
                                <Users size={18} className="text-slate-400" />
                                CELL INSPECTOR :: ({selectedCellModal.cell.r}, {selectedCellModal.cell.c})
                            </h4>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-4">
                                TYPE: {selectedCellModal.cell.type.toUpperCase()} // OCCUPANTS: {selectedCellModal.cellPlayers.length}
                            </p>

                            {/* Occupant Players List */}
                            {selectedCellModal.cellPlayers.length > 0 && (
                                <div className="mb-4 space-y-2">
                                    <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-bold">CURRENT OCCUPANT ROSTER:</span>
                                    <div className="max-h-32 overflow-y-auto space-y-1.5 pr-2">
                                        {selectedCellModal.cellPlayers.map(p => (
                                            <div key={p.id} className="p-2 bg-slate-900 border border-slate-700 rounded flex justify-between items-center text-xs">
                                                <span className="font-bold text-slate-200">{p.username}</span>
                                                <span className="text-emerald-400">{p.score} CR</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Available Door Info (Max 2 Info Cards: Door Value & Special Cards) */}
                            {selectedCellModal.cell.type === 'wall' || selectedCellModal.cell.doors.length === 0 ? (
                                <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg text-center text-slate-400 text-xs font-mono uppercase tracking-widest">
                                    SOLID MAZE BARRIER // NO DOORS AVAILABLE
                                </div>
                            ) : (() => {
                                const stdDoor = selectedCellModal.cell.doors.find(d => d.cardType === 'standard') || selectedCellModal.cell.doors[0];
                                const specCards = selectedCellModal.cell.specialCards || [];
                                const doorCost = stdDoor?.cost || 10;
                                const specType = specCards.length > 0 ? specCards.map(s => s.toUpperCase()).join(', ') : 'NONE';

                                return (
                                    <div className="w-full space-y-2">
                                        <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-bold mb-2">
                                            CLICKED BOX DOOR INFO:
                                        </span>
                                        <div className="grid grid-cols-2 gap-3">
                                            {/* INFO CARD 1: Door Value */}
                                            <div className="p-4 bg-slate-900/90 border border-slate-700 rounded-xl flex flex-col items-center justify-center text-center shadow-lg">
                                                <span className="text-[9px] text-slate-400 uppercase tracking-widest block font-bold mb-1">
                                                    DOOR VALUE
                                                </span>
                                                <span className="font-bold text-lg text-slate-100 font-mono drop-shadow-[0_0_8px_rgba(226,232,240,0.6)]">
                                                    {doorCost} CR
                                                </span>
                                            </div>

                                            {/* INFO CARD 2: Special Cards */}
                                            <div className="p-4 bg-slate-900/90 border border-slate-700 rounded-xl flex flex-col items-center justify-center text-center shadow-lg">
                                                <span className="text-[9px] text-slate-400 uppercase tracking-widest block font-bold mb-1">
                                                    SPECIAL CARDS
                                                </span>
                                                <span className={`font-bold text-base uppercase font-cinzel tracking-wider ${specType !== 'NONE' ? 'text-amber-400 drop-shadow-[0_0_10px_#fbbf24]' : 'text-slate-500'}`}>
                                                    {specType}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};
