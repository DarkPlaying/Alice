import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Unlock, DoorOpen } from 'lucide-react';

interface ThreeDoorViewerProps {
    direction: 'up' | 'down' | 'left' | 'right';
    cost?: number;
    isOpen?: boolean;
    isLocked?: boolean;
    onToggleLock?: () => void;
}

export const ThreeDoorViewer: React.FC<ThreeDoorViewerProps> = ({
    direction,
    cost,
    isOpen = false,
    isLocked = false,
    onToggleLock
}) => {
    const getDirectionHeaderSrc = (dir: 'up' | 'down' | 'left' | 'right') => {
        if (dir === 'up') return '/top.png';
        if (dir === 'right') return '/right.png';
        if (dir === 'down') return '/bottom.png';
        return '/left.png';
    };

    const getDoorTextureSrc = (dir: 'up' | 'down' | 'left' | 'right') => {
        if (dir === 'up') return '/3d door/preview/preview1.jpg';
        if (dir === 'right') return '/3d door/preview/preview2.jpg';
        if (dir === 'down') return '/3d door/preview/preview3.jpg';
        return '/3d door/preview/preview4.jpg';
    };

    const getRotationY = (dir: 'up' | 'down' | 'left' | 'right') => {
        if (dir === 'left') return -10;
        if (dir === 'right') return 10;
        if (dir === 'up') return -5;
        return 5;
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-between relative p-2 font-mono select-none">
            {/* TOP DIRECTION IMAGE HEADER */}
            <div className="w-full flex items-center justify-between bg-slate-950/80 border border-slate-700/80 px-2.5 py-1.5 rounded-lg mb-2 shadow-inner">
                <div className="flex items-center gap-2">
                    <img
                        src={getDirectionHeaderSrc(direction)}
                        alt={`${direction} direction`}
                        className="w-6 h-6 object-contain filter drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]"
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                        }}
                    />
                    <span className="text-[11px] font-black tracking-widest text-slate-200 uppercase font-cinzel">
                        {direction.toUpperCase()} VECTOR
                    </span>
                </div>

                {/* LOCK / UNLOCK TOGGLE BADGE */}
                {onToggleLock && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleLock();
                        }}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                            isLocked
                                ? 'bg-amber-950/90 text-amber-300 border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                                : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200 hover:border-slate-500'
                        }`}
                        title={isLocked ? "Click to Unlock Door" : "Click to Lock Door"}
                    >
                        {isLocked ? (
                            <>
                                <Lock size={12} className="text-amber-400 animate-pulse" />
                                <span>LOCKED</span>
                            </>
                        ) : (
                            <>
                                <Unlock size={12} className="text-slate-400" />
                                <span>UNLOCK</span>
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* 3D DOOR CONTAINER WITH OPEN / CLOSE ANIMATION */}
            <motion.div
                initial={{ scale: 0.95 }}
                animate={{
                    rotateY: isOpen ? (direction === 'left' ? -75 : 75) : [getRotationY(direction), 0, getRotationY(direction)],
                    scale: isOpen ? 1.05 : 1,
                    y: isOpen ? 0 : [-2, 2, -2]
                }}
                transition={{
                    duration: isOpen ? 0.8 : 3.5,
                    repeat: isOpen ? 0 : Infinity,
                    repeatType: "mirror",
                    ease: "easeInOut"
                }}
                className="relative w-full flex-1 flex items-center justify-center min-h-[140px] overflow-hidden rounded-xl border border-slate-700/60 bg-slate-950/90 shadow-2xl p-1"
                style={{ perspective: 1000, transformStyle: 'preserve-3d' }}
            >
                {/* DOOR BACKGROUND CARD IMAGE TEXTURE */}
                <img
                    src="/specialcard_joker/game.png"
                    alt="Door Card Back"
                    className="absolute inset-0 w-full h-full object-cover rounded-lg opacity-40 filter brightness-90 contrast-125"
                    onError={(e) => {
                        e.currentTarget.src = getDoorTextureSrc(direction);
                    }}
                />

                {/* 3D DOOR ARTWORK OVERLAY */}
                <motion.div
                    className="relative z-10 w-full h-full flex flex-col items-center justify-center p-2"
                    animate={{ opacity: isOpen ? 0.3 : 1 }}
                >
                    <img
                        src={getDoorTextureSrc(direction)}
                        alt={`${direction} 3D Door`}
                        className="max-h-28 sm:max-h-32 w-auto object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,0.9)] rounded filter brightness-110 contrast-125"
                    />

                    {/* DOOR COST BADGE AT CENTER */}
                    {cost !== undefined && (
                        <div className="mt-2 px-3 py-1 bg-slate-950/90 border border-emerald-500/80 rounded-md shadow-[0_0_15px_rgba(16,185,129,0.4)] flex items-center gap-1.5">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">DOOR COST:</span>
                            <span className="text-xs font-black font-mono text-emerald-400">{cost} CR</span>
                        </div>
                    )}
                </motion.div>

                {/* DOOR OPEN INDICATOR OVERLAY */}
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-20 bg-emerald-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-2 text-emerald-200 border-2 border-emerald-400 rounded-lg shadow-[0_0_30px_rgba(52,211,153,0.8)]"
                        >
                            <DoorOpen size={36} className="text-emerald-400 animate-bounce" />
                            <span className="text-xs font-black tracking-widest uppercase mt-1 font-cinzel text-emerald-300">
                                DOOR OPENED
                            </span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* LOCKED PADLOCK OVERLAY IF DOOR IS LOCKED */}
                {isLocked && !isOpen && (
                    <div className="absolute top-2 right-2 z-20 p-1.5 bg-amber-950/90 border border-amber-500 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.8)]">
                        <Lock size={14} className="text-amber-400" />
                    </div>
                )}
            </motion.div>
        </div>
    );
};
