import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Spade, Heart, Club, Diamond } from 'lucide-react';

export function Loader() {
    const [currentSuit, setCurrentSuit] = useState(0);
    const suits = [
        { Icon: Spade, color: 'text-red-500' },
        { Icon: Heart, color: 'text-[var(--color-squid-pink)]' },
        { Icon: Club, color: 'text-red-500' },
        { Icon: Diamond, color: 'text-[var(--color-squid-pink)]' }
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentSuit((prev) => (prev + 1) % suits.length);
        }, 200);
        return () => clearInterval(interval);
    }, []);

    const CurrentIcon = suits[currentSuit].Icon;

    return (
        <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center overflow-hidden">
            {/* Background Grid */}
            <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                    backgroundImage: `
            linear-gradient(to right, #333 1px, transparent 1px),
            linear-gradient(to bottom, #333 1px, transparent 1px)
          `,
                    backgroundSize: '40px 40px'
                }}
            />

            {/* Center Suit Animation */}
            <div className="relative z-10 w-32 h-32 flex items-center justify-center mb-8">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentSuit}
                        initial={{ opacity: 0, scale: 0.5, rotateY: 90 }}
                        animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                        exit={{ opacity: 0, scale: 0.5, rotateY: -90 }}
                        transition={{ duration: 0.15 }}
                        className={`${suits[currentSuit].color}`}
                    >
                        <CurrentIcon size={80} strokeWidth={1.5} />
                    </motion.div>
                </AnimatePresence>

                {/* Orbiting Rings */}
                <div className="absolute inset-0 border-2 border-red-500/20 rounded-full animate-[spin_3s_linear_infinite]" />
                <div className="absolute inset-[-10px] border border-dashed border-red-500/30 rounded-full animate-[spin_4s_linear_infinite_reverse]" />
            </div>

            {/* Loading Text */}
            <div className="z-10 flex flex-col items-center space-y-2">
                <motion.h2
                    className="text-2xl font-display tracking-[0.2em] text-white"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                >
                    INITIALIZING
                </motion.h2>

                <div className="flex space-x-1">
                    {[...Array(3)].map((_, i) => (
                        <motion.div
                            key={i}
                            className="w-2 h-2 bg-red-500/50 rounded-full"
                            animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                        />
                    ))}
                </div>
            </div>

            {/* Decorative Corners */}
            <div className="absolute top-8 left-8 w-16 h-16 border-t-2 border-l-2 border-red-500 opacity-50" />
            <div className="absolute top-8 right-8 w-16 h-16 border-t-2 border-r-2 border-red-500 opacity-50" />
            <div className="absolute bottom-8 left-8 w-16 h-16 border-b-2 border-l-2 border-red-500 opacity-50" />
            <div className="absolute bottom-8 right-8 w-16 h-16 border-b-2 border-r-2 border-red-500 opacity-50" />

            {/* Random Code Snippets Background overlay */}
            <div className="absolute inset-0 overflow-hidden opacity-5 pointer-events-none font-mono text-xs text-red-500 p-4">
                {Array.from({ length: 20 }).map((_, i) => (
                    <div key={i} className="absolute" style={{
                        top: `${Math.random() * 100}%`,
                        left: `${Math.random() * 100}%`,
                        opacity: Math.random()
                    }}>
                        {Math.random() > 0.5 ? '0x' + Math.random().toString(16).slice(2, 8) : 'Loading...'}
                    </div>
                ))}
            </div>
        </div>
    );
}