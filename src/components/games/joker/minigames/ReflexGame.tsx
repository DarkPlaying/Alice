import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Zap, CheckCircle2, AlertTriangle } from 'lucide-react';

interface ReflexGameProps {
    onComplete: (success: boolean, scoreBonus: number) => void;
}

type ColorName = 'RED' | 'GREEN' | 'BLUE' | 'YELLOW';

interface ReflexCard {
    id: number;
    bgClass: string;
    textLabel: ColorName;
    textColorClass: string;
}

const COLOR_MAP: Record<ColorName, { bg: string; textClass: string }> = {
    RED: { bg: 'bg-red-950/80 border-red-500', textClass: 'text-red-500' },
    GREEN: { bg: 'bg-emerald-950/80 border-emerald-500', textClass: 'text-emerald-400' },
    BLUE: { bg: 'bg-blue-950/80 border-blue-500', textClass: 'text-blue-400' },
    YELLOW: { bg: 'bg-amber-950/80 border-amber-500', textClass: 'text-amber-400' }
};

export const ReflexGame: React.FC<ReflexGameProps> = ({ onComplete }) => {
    const [timeLeft, setTimeLeft] = useState(60);
    const [score, setScore] = useState(0);
    const [targetColorText, setTargetColorText] = useState<ColorName>('RED');
    const [cards, setCards] = useState<ReflexCard[]>([]);
    const [gameResult, setGameResult] = useState<'playing' | 'won' | 'lost'>('playing');

    // Generate new round layout
    const generateRound = () => {
        const colors: ColorName[] = ['RED', 'GREEN', 'BLUE', 'YELLOW'];
        const target = colors[Math.floor(Math.random() * colors.length)];
        setTargetColorText(target);

        // Create 4 cards with mismatched bg and text colors (Stroop effect)
        const shuffledBgs = [...colors].sort(() => Math.random() - 0.5);
        const shuffledTextNames = [...colors].sort(() => Math.random() - 0.5);
        const shuffledTextColorClasses = [...colors].sort(() => Math.random() - 0.5);

        const newCards: ReflexCard[] = colors.map((_, idx) => ({
            id: idx,
            bgClass: COLOR_MAP[shuffledBgs[idx]].bg,
            textLabel: shuffledTextNames[idx],
            textColorClass: COLOR_MAP[shuffledTextColorClasses[idx]].textClass
        }));

        setCards(newCards);
    };

    useEffect(() => {
        generateRound();
    }, []);

    // Timer
    useEffect(() => {
        if (gameResult !== 'playing') return;

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    const finalWon = score >= 25;
                    setGameResult(finalWon ? 'won' : 'lost');
                    setTimeout(() => onComplete(finalWon, finalWon ? 300 : -100), 2000);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [gameResult, score]);

    const handleCardClick = (card: ReflexCard) => {
        if (gameResult !== 'playing') return;

        if (card.textLabel === targetColorText) {
            const nextScore = score + 1;
            setScore(nextScore);
            if (nextScore >= 25 && timeLeft > 0) {
                setGameResult('won');
                setTimeout(() => onComplete(true, 300), 1800);
                return;
            }
        } else {
            setScore(prev => Math.max(0, prev - 1));
        }

        generateRound();
    };

    return (
        <div className="flex flex-col items-center justify-center w-full max-w-3xl p-6 bg-[#050508]/95 border border-slate-400/30 rounded-2xl backdrop-blur-xl shadow-[0_0_50px_rgba(226,232,240,0.15)] text-slate-100 font-mono">
            {/* Header */}
            <div className="w-full pb-4 border-b border-slate-700/50 flex justify-between items-center">
                <div>
                    <h3 className="font-cinzel text-xl sm:text-2xl font-black text-slate-200 uppercase tracking-widest flex items-center gap-3">
                        <Zap className="text-amber-400 animate-pulse" size={24} />
                        STROOP REFLEX PROTOCOL
                    </h3>
                    <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] mt-1">
                        SCORE 25 POINTS IN 1 MINUTE // READ THE TEXT LABEL
                    </p>
                </div>

                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest block">Time Left</span>
                        <span className={`text-2xl font-bold ${timeLeft <= 15 ? 'text-red-400 animate-pulse' : 'text-slate-200'}`}>
                            {timeLeft}s
                        </span>
                    </div>

                    <div className="text-right">
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest block">Score</span>
                        <span className="text-2xl font-bold text-emerald-400">{score}/25</span>
                    </div>
                </div>
            </div>

            {/* Target Hint Box */}
            <div className="w-full my-6 p-4 bg-slate-900/80 border border-slate-700/80 rounded-xl text-center flex flex-col items-center justify-center gap-1 shadow-lg">
                <span className="text-[10px] text-slate-400 uppercase tracking-[0.3em] font-bold">TARGET INSTRUCTION</span>
                <div className="text-2xl sm:text-3xl font-black tracking-widest flex items-center gap-2">
                    <span>CLICK CARD CONTAINING</span>
                    <span className={`px-3 py-1 rounded bg-slate-800 border border-slate-600 ${COLOR_MAP[targetColorText].textClass}`}>
                        "{targetColorText}" TEXT
                    </span>
                </div>
                <span className="text-[9px] text-slate-500 uppercase tracking-wider mt-1">
                    (ATTENTION: IGNORE CARD BACKGROUND COLOR! MATCH THE TEXT LABEL NAME)
                </span>
            </div>

            {/* 4 Colored Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full my-2">
                {cards.map(card => (
                    <motion.div
                        key={card.id}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleCardClick(card)}
                        className={`p-6 rounded-xl border-2 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 shadow-xl ${card.bgClass}`}
                    >
                        <span className={`text-xl sm:text-2xl font-black tracking-widest ${card.textColorClass}`}>
                            {card.textLabel}
                        </span>
                    </motion.div>
                ))}
            </div>

            {/* Result Toast */}
            {gameResult !== 'playing' && (
                <div className={`mt-4 p-3 rounded-lg font-black text-sm uppercase tracking-widest border ${gameResult === 'won' ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300' : 'bg-red-950/80 border-red-500 text-red-300'}`}>
                    {gameResult === 'won' ? 'REFLEX PROTOCOL PASSED (+300 CR)' : 'REFLEX PROTOCOL FAILED (0 CR DEDUCTION)'}
                </div>
            )}
        </div>
    );
};
