import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, DoorOpen, ArrowRight, Briefcase, Lock } from 'lucide-react';
import type { JokerPlayer, MapCell, DoorData } from './jokerTypes';

interface JokerRevealOverlayProps {
    timeLeft: number;
    player: JokerPlayer;
    currentCell: MapCell;
    onEnterRoom?: () => void;
}

export const JokerRevealOverlay: React.FC<JokerRevealOverlayProps> = ({
    timeLeft,
    player,
    currentCell,
    onEnterRoom
}) => {
    const [isFlipped, setIsFlipped] = useState(false);
    const [doorOpened, setDoorOpened] = useState(false);
    const [enterTimeLeft, setEnterTimeLeft] = useState(30);
    const [hasEntered, setHasEntered] = useState(false);
    const hasTriggeredRef = useRef(false);

    // Door open animation followed by card flip reveal
    useEffect(() => {
        const timer1 = setTimeout(() => {
            setDoorOpened(true);
        }, 400);

        const timer2 = setTimeout(() => {
            setIsFlipped(true);
        }, 1000);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
        };
    }, []);

    // 30-Second Enter Room Timer
    useEffect(() => {
        if (hasEntered) return;

        const timer = setInterval(() => {
            setEnterTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    // Automatically teleport when timer hits 0s
                    if (!hasTriggeredRef.current) {
                        hasTriggeredRef.current = true;
                        setHasEntered(true);
                        if (onEnterRoom) onEnterRoom();
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [hasEntered, onEnterRoom]);

    const handleManualEnter = () => {
        if (hasEntered || hasTriggeredRef.current) return;
        hasTriggeredRef.current = true;
        setHasEntered(true);
        if (onEnterRoom) onEnterRoom();
    };

    const choice = player.pendingDoorChoice || player.lastDoorChoice;
    const door: DoorData | undefined = choice?.door;

    let imageSrc = '/specialcard_joker/none.png';
    let title = 'NO DOOR SELECTED';
    let subtitle = 'NO DOOR PURCHASED // 0 PTS DEDUCTION';
    let cardTypeLabel = 'STANDARD PASSAGE';
    let badgeColor = 'bg-slate-800 text-slate-300 border-slate-600';
    let glowColor = 'shadow-[0_0_50px_rgba(255,255,255,0.1)]';

    if (door) {
        if (door.cardType === 'special' && door.specialType) {
            if (door.specialType === 'red') {
                imageSrc = '/specialcard_joker/red.png';
                title = 'RED HAZARD CARD!';
                subtitle = 'PENALTY: NEXT ROUND COSTS MULTIPLIED!';
                cardTypeLabel = 'HAZARD PENALTY';
                badgeColor = 'bg-red-950 text-red-300 border-red-500/80';
                glowColor = 'shadow-[0_0_80px_rgba(239,68,68,0.4)]';
            } else if (door.specialType === 'green') {
                imageSrc = '/specialcard_joker/green.png';
                title = 'GREEN SPECIAL CARD!';
                subtitle = 'FREE PASSAGE // ADDED TO INVENTORY ON ENTRY';
                cardTypeLabel = 'FREE CARD ACQUIRED';
                badgeColor = 'bg-emerald-950 text-emerald-300 border-emerald-500/80';
                glowColor = 'shadow-[0_0_80px_rgba(16,185,129,0.4)]';
            } else if (door.specialType === 'skip') {
                imageSrc = '/specialcard_joker/skip.png';
                title = 'SKIP CARD!';
                subtitle = 'ADVANCE +2 CELLS // ADDED TO INVENTORY ON ENTRY';
                cardTypeLabel = 'JUMP CARD ACQUIRED';
                badgeColor = 'bg-cyan-950 text-cyan-300 border-cyan-500/80';
                glowColor = 'shadow-[0_0_80px_rgba(6,182,212,0.4)]';
            } else if (door.specialType === 'freeze') {
                imageSrc = '/specialcard_joker/freeze.png';
                title = 'FREEZE CARD!';
                subtitle = 'FREEZE OTHERS 5X COSTS // ADDED TO INVENTORY ON ENTRY';
                cardTypeLabel = 'FREEZE CARD ACQUIRED';
                badgeColor = 'bg-indigo-950 text-indigo-300 border-indigo-500/80';
                glowColor = 'shadow-[0_0_80px_rgba(99,102,241,0.4)]';
            }
        } else {
            const val = door.cost;
            if (val === 10) imageSrc = '/borderland_cards/Spades_10.png';
            else if (val === 11) imageSrc = '/borderland_cards/Spades_J.png';
            else if (val === 12) imageSrc = '/borderland_cards/Spades_Q.png';
            else if (val === 13) imageSrc = '/borderland_cards/Spades_K.png';
            else if (val === 14) imageSrc = '/borderland_cards/Spades_A.png';
            else imageSrc = '/borderland_cards/Spades_10.png';

            title = `${door.direction.toUpperCase()} DOOR OPENED (${door.cost} CR)`;
            subtitle = `CLEARED PASSAGE // DEDUCTED ${choice?.finalCost || door.cost} CR`;
            cardTypeLabel = 'STANDARD DOOR';
            badgeColor = 'bg-slate-800 text-slate-200 border-slate-600';
            glowColor = 'shadow-[0_0_50px_rgba(255,255,255,0.15)]';
        }
    }

    return (
        <div className="fixed inset-0 z-[1100] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-full max-w-lg bg-[#05050a] border border-slate-500/40 rounded-3xl p-6 flex flex-col items-center text-center font-mono relative shadow-[0_0_100px_rgba(0,0,0,0.9)] space-y-5"
            >
                {/* Header Phase & 30s Timer Indicator */}
                <div className="w-full flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                        <Sparkles size={18} className="text-yellow-400 animate-pulse" />
                        <span className="text-xs font-bold text-slate-200 uppercase tracking-widest font-cinzel">
                            PHASE 3: REVEAL & DOOR ENTRY
                        </span>
                    </div>
                    <div className="px-3 py-1 bg-slate-900 border border-amber-500/60 rounded-full text-xs font-bold text-amber-300 animate-pulse flex items-center gap-1.5">
                        <span>AUTO TELEPORT IN:</span>
                        <span className="font-mono text-sm">{enterTimeLeft}s</span>
                    </div>
                </div>

                {/* 3D OPENING DOOR ANIMATION CONTAINER */}
                <div className="relative w-full h-44 flex items-center justify-center bg-slate-950/80 rounded-2xl border border-slate-800 p-2 overflow-hidden shadow-inner">
                    <motion.div
                        className="w-full h-full flex items-center justify-center relative"
                        animate={{ scale: doorOpened ? 1.05 : 1 }}
                    >
                        {/* Split Door Panels Opening Effect */}
                        <motion.div
                            initial={{ x: 0 }}
                            animate={{ x: doorOpened ? '-100%' : '0%' }}
                            transition={{ duration: 0.8, ease: 'easeInOut' }}
                            className="absolute left-0 top-0 bottom-0 w-1/2 bg-slate-900 border-r border-slate-700 flex items-center justify-end pr-2 z-20"
                        >
                            <img src="/top.png" alt="Door Panel Left" className="w-12 h-12 object-contain opacity-50" />
                        </motion.div>
                        <motion.div
                            initial={{ x: 0 }}
                            animate={{ x: doorOpened ? '100%' : '0%' }}
                            transition={{ duration: 0.8, ease: 'easeInOut' }}
                            className="absolute right-0 top-0 bottom-0 w-1/2 bg-slate-900 border-l border-slate-700 flex items-center justify-start pl-2 z-20"
                        >
                            <img src="/bottom.png" alt="Door Panel Right" className="w-12 h-12 object-contain opacity-50" />
                        </motion.div>

                        {/* Door Inner Light Glow */}
                        <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/40 via-transparent to-transparent flex items-center justify-center">
                            <DoorOpen size={48} className="text-emerald-400 opacity-30 animate-pulse" />
                        </div>
                    </motion.div>
                </div>

                {/* REVEALED CARD PLACED AT THE CENTER */}
                <div className="relative w-40 sm:w-48 h-56 sm:h-64 cursor-pointer my-1 flex items-center justify-center">
                    <motion.div
                        className="w-full h-full relative"
                        style={{ transformStyle: 'preserve-3d' }}
                        animate={{ rotateY: isFlipped ? 180 : 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                    >
                        {/* Card Back (Default Joker Game Card) */}
                        <div
                            className="absolute inset-0 w-full h-full rounded-2xl overflow-hidden border border-slate-400/50 shadow-2xl bg-slate-950 flex flex-col items-center justify-center"
                            style={{ backfaceVisibility: 'hidden' }}
                        >
                            <img
                                src="/specialcard_joker/game.png"
                                alt="Joker Card Back"
                                className="w-full h-full object-cover rounded-2xl"
                            />
                            <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center">
                                <span className="px-3 py-1.5 bg-slate-900/90 border border-slate-400 text-slate-100 text-xs font-bold rounded uppercase tracking-widest animate-pulse">
                                    OPENING DOOR...
                                </span>
                            </div>
                        </div>

                        {/* Card Front (Actual Center Card Revealed) */}
                        <div
                            className={`absolute inset-0 w-full h-full rounded-2xl overflow-hidden border-2 ${glowColor} bg-slate-950 flex flex-col items-center justify-center`}
                            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                        >
                            <img
                                src={imageSrc}
                                alt="Special Card Revealed"
                                className="w-full h-full object-cover rounded-2xl"
                            />
                        </div>
                    </motion.div>
                </div>

                {/* Card Info & Details */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: isFlipped ? 1 : 0, y: isFlipped ? 0 : 10 }}
                    transition={{ delay: 0.4 }}
                    className="space-y-2 w-full"
                >
                    <div className={`inline-block px-3 py-1 border rounded-full text-[10px] font-bold tracking-widest uppercase ${badgeColor}`}>
                        {cardTypeLabel}
                    </div>
                    <h3 className="font-cinzel text-lg sm:text-xl font-black text-white uppercase tracking-widest">
                        {title}
                    </h3>
                    <p className="text-xs text-slate-400 uppercase tracking-wider max-w-sm mx-auto">
                        {subtitle}
                    </p>
                </motion.div>

                {/* MANUAL ENTER ROOM ACTION BUTTON */}
                <div className="w-full pt-3 border-t border-slate-800">
                    <button
                        onClick={handleManualEnter}
                        disabled={hasEntered}
                        className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-[0_0_25px_rgba(52,211,153,0.5)] cursor-pointer flex items-center justify-center gap-2"
                    >
                        <DoorOpen size={18} />
                        <span>ENTER ROOM & ADD TO INVENTORY</span>
                        <ArrowRight size={18} />
                    </button>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-2">
                        IF NOT CLICKED, AUTOMATIC TELEPORT IN {enterTimeLeft} SECONDS
                    </p>
                </div>
            </motion.div>
        </div>
    );
};
