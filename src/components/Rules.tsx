import { motion } from 'framer-motion';
import { Spade, Diamond, Club, Heart } from 'lucide-react';
import { useState, useEffect } from 'react';

const rules = [
    {
        id: "1",
        title: "4 games",
        desc: "Each harder. Each deadlier.",
        color: "text-cyan-400",
        shadowColor: "rgba(34,211,238,0.2)",
        borderColor: "border-cyan-400/50",
        suit: "♠",
        icon: Spade
    },
    {
        id: "2",
        title: "No second chances",
        desc: "One move. One shot.",
        color: "text-blue-400",
        shadowColor: "rgba(96,165,250,0.2)",
        borderColor: "border-blue-400/50",
        suit: "♦",
        icon: Diamond
    },
    {
        id: "3",
        title: "Trust no one",
        desc: "Allies can betray you.",
        color: "text-purple-400",
        shadowColor: "rgba(192,132,252,0.2)",
        borderColor: "border-purple-400/50",
        suit: "♣",
        icon: Club
    },
    {
        id: "4",
        title: "Time is running",
        desc: "Decide fast - or die.",
        color: "text-[#ff0050]",
        shadowColor: "rgba(255,0,80,0.2)",
        borderColor: "border-[#ff0050]/50",
        suit: "♥",
        icon: Heart
    }
];

export const Rules = () => {
    const [activeIndex, setActiveIndex] = useState(0);
    const [isHovering, setIsHovering] = useState(false);

    useEffect(() => {
        if (isHovering) return;

        const interval = setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % rules.length);
        }, 2000);

        return () => clearInterval(interval);
    }, [isHovering]);

    return (
        <div className="py-12 md:py-20 relative text-white font-sans overflow-hidden">
            {/* Background Symbols - keep or modify if needed */}
            <div className="absolute top-20 left-10 text-neutral-800 opacity-20 text-9xl font-display pointer-events-none">♠</div>
            <div className="absolute bottom-40 right-10 text-neutral-800 opacity-20 text-9xl font-display pointer-events-none">♥</div>

            <div className="max-w-7xl mx-auto px-6 relative z-10">

                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-4 relative"
                >
                    <h2 className="text-3xl md:text-5xl font-display uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-[#ff0050] to-[#a00032] drop-shadow-[0_0_15px_rgba(255,0,80,0.5)]">
                        Rules <span className="text-lg md:text-xl tracking-[0.5em] block mt-1 text-white font-light">Of Survival</span>
                    </h2>

                    {/* Decorative Symbols - Syncs with Active Index */}
                    <div className="absolute left-1/2 -translate-x-1/2 -top-12 flex gap-6">
                        <Spade size={20} fill="currentColor" className={`transition-all duration-500 ${activeIndex === 0 ? 'text-cyan-400 opacity-100 scale-125 drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]' : 'text-gray-800 opacity-20'}`} />
                        <Diamond size={20} fill="currentColor" className={`transition-all duration-500 ${activeIndex === 1 ? 'text-blue-400 opacity-100 scale-125 drop-shadow-[0_0_15px_rgba(96,165,250,0.8)]' : 'text-gray-800 opacity-20'}`} />
                        <Club size={20} fill="currentColor" className={`transition-all duration-500 ${activeIndex === 2 ? 'text-purple-400 opacity-100 scale-125 drop-shadow-[0_0_15px_rgba(192,132,252,0.8)]' : 'text-gray-800 opacity-20'}`} />
                        <Heart size={20} fill="currentColor" className={`transition-all duration-500 ${activeIndex === 3 ? 'text-[#ff0050] opacity-100 scale-125 drop-shadow-[0_0_15px_rgba(255,0,80,0.8)]' : 'text-gray-800 opacity-20'}`} />
                    </div>
                </motion.div>

                {/* View Details Indicator - Between Header and Grid */}
                <div className="text-center mb-6">
                    <p className="text-gray-500 font-mono text-[10px] uppercase tracking-[0.4em] animate-pulse cursor-pointer hover:text-white transition-colors">
                        CLICK TO FEEL THE POWER OF CARD
                    </p>
                </div>

                {/* Grid */}
                <div
                    className="grid grid-cols-1 md:grid-cols-4 gap-4 border-t border-b border-transparent md:border-white/10 relative z-10 max-w-6xl mx-auto"
                    onMouseLeave={() => setIsHovering(false)}
                >
                    {rules.map((rule, index) => {
                        const isActive = index === activeIndex;

                        return (
                            <motion.div
                                key={rule.id}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: false, margin: "-30% 0px -30% 0px" }}
                                transition={{ duration: 0.5, delay: index * 0.15 }}
                                onViewportEnter={() => { setActiveIndex(index); setIsHovering(true); }}
                                onMouseEnter={() => { setIsHovering(true); setActiveIndex(index); }}
                                className={`group relative p-6 border border-white/10 md:border-y-0 md:border-r last:border-r-0 bg-[#050505] hover:bg-[#0a0a0a] transition-all duration-500 overflow-hidden z-20 rounded-xl md:rounded-none h-[300px] flex flex-col justify-center`}
                                style={{
                                    boxShadow: isActive ? `0 0 50px ${rule.shadowColor}` : 'none',
                                    borderColor: isActive ? rule.shadowColor : 'rgba(255,255,255,0.1)'
                                }}
                            >
                                {/* Watermark Suit - Glowing */}
                                <div className={`absolute -bottom-6 -right-6 text-[8rem] transition-all duration-700 font-serif select-none pointer-events-none ${rule.color} ${isActive ? 'opacity-30 drop-shadow-[0_0_20px_currentColor] scale-110' : 'opacity-5 group-hover:opacity-10'}`}>
                                    {rule.suit}
                                </div>

                                {/* Number */}
                                <div className={`text-4xl md:text-6xl font-display font-bold mb-2 transition-opacity duration-500 ${rule.color} ${isActive ? 'opacity-100 drop-shadow-[0_0_15px_currentColor]' : 'opacity-30 group-hover:opacity-100'}`}>
                                    {rule.id}
                                </div>

                                {/* Decorative Line identifier - ALWAYS FILLED AND COLORED */}
                                <div className={`h-1 mb-4 rounded-full transition-all duration-500 ${rule.color} bg-current ${isActive ? 'w-20 opacity-100 shadow-[0_0_20px_currentColor]' : 'w-12 opacity-100 shadow-[0_0_10px_currentColor]'}`}></div>

                                {/* Content */}
                                <h3 className={`text-lg font-bold uppercase tracking-wider mb-2 text-white transition-colors relative z-10 ${isActive ? 'drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]' : ''}`}>
                                    {rule.title}
                                </h3>
                                <p className={`font-mono text-[10px] uppercase tracking-widest transition-colors relative z-10 ${isActive ? 'text-gray-300' : 'text-gray-500 group-hover:text-gray-300'}`}>
                                    {rule.desc}
                                </p>

                                {/* Active Glow Shape (Suit Icon) */}
                                <div className={`absolute top-4 right-4 transition-all duration-500 ${isActive ? 'opacity-100 scale-110' : 'opacity-0 group-hover:opacity-100'}`}>
                                    <rule.icon
                                        size={20}
                                        fill="currentColor"
                                        className={`${rule.color} drop-shadow-[0_0_15px_currentColor]`}
                                    />
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
