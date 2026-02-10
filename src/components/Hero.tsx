import { Play } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import LaserGrid from './LaserGrid';

interface HeroProps {
    onStart: () => void;
    userInfo?: any;
}

const SeekingCard = ({ side, className, fixedCard }: { side: 'left' | 'right', className?: string, fixedCard?: string }) => {
    const [currentCard, setCurrentCard] = useState<string | null>(null);

    useEffect(() => {
        if (fixedCard) {
            setCurrentCard(`/borderland_cards/${fixedCard}`);
        }
    }, [fixedCard]);

    if (!currentCard) return null;

    return (
        <motion.img
            src={currentCard}
            alt="Seeking Card"
            className={className}
            initial={{ x: side === 'left' ? -250 : 250, rotate: side === 'left' ? -30 : 30, opacity: 0 }}
            animate={{
                x: 0,
                rotate: side === 'left' ? 15 : -12,
                opacity: 1,
                y: [0, -10, 0]
            }}
            transition={{
                x: { duration: 2.5, ease: "easeOut" },
                rotate: { duration: 2.5, ease: "easeOut" },
                opacity: { duration: 1.5 },
                y: { duration: 4, repeat: Infinity, ease: "easeInOut", delay: 2.5 }
            }}
        />
    );
};

export const Hero = ({ onStart, userInfo }: HeroProps) => {
    const isSystemArchitect = userInfo?.username === 'admin' || userInfo?.role === 'admin';
    const isGameMaster = userInfo?.role === 'master';
    const isElevated = isSystemArchitect || isGameMaster;

    return (
        <section className="relative h-screen min-h-[800px] flex items-center justify-center overflow-hidden bg-[#050508]">

            {/* Background: Poster Image */}
            <div className="absolute inset-0 z-0">
                <img
                    src="/hero-poster.jpg"
                    alt="Alice in Borderland Background"
                    className="w-full h-full object-cover opacity-60"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-[#050505]/60"></div>
            </div>

            {/* Laser Grid Layer (Overlay) */}
            <div className="absolute inset-0 z-10 pointer-events-none opacity-80">
                <LaserGrid />
            </div>

            {/* Intro Cards */}
            <SeekingCard
                side="left"
                fixedCard="Spades_K.png"
                className="absolute left-4 md:left-[14%] bottom-32 md:bottom-1/4 w-16 md:w-56 z-20 pointer-events-none opacity-80"
            />
            <SeekingCard
                side="right"
                fixedCard="Hearts_Q.png"
                className="absolute right-4 md:right-[14%] top-32 md:top-1/3 w-16 md:w-56 z-20 pointer-events-none opacity-80"
            />

            {/* Main Title Sequence */}
            <div className="relative z-30 max-w-7xl mx-auto px-6 flex flex-col items-center justify-center h-full text-center">

                {/* Japanese Subtitle: Serif White */}
                <motion.p
                    initial={{ opacity: 0, letterSpacing: "1em" }}
                    animate={{ opacity: 1, letterSpacing: "0.5em" }}
                    transition={{ duration: 1.5, ease: "circOut" }}
                    className="text-white font-serif text-sm md:text-lg mb-4 animate-pulse drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                >
                    {isElevated ? (isSystemArchitect ? "システムアーキテクト" : "ゲームマスター") : "今際の国のアリス"}
                </motion.p>

                {/* Master Badge */}
                {isElevated && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-4 px-6 py-1 border-y border-yellow-500/50 bg-yellow-500/10"
                    >
                        <span className="text-yellow-500 font-mono text-xs tracking-[0.5em] font-bold uppercase">
                            {isSystemArchitect ? "System Architect Authenticated" : "Game Master Authorization Active"}
                        </span>
                    </motion.div>
                )}

                {/* Alice - Giant Gothic Title (White) */}
                <motion.h1
                    initial={{ scale: 1.2, filter: 'blur(10px)', opacity: 0 }}
                    animate={{ scale: 1, filter: 'blur(0px)', opacity: 1 }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    className="font-gothic text-[8rem] md:text-[15rem] leading-[0.8] text-white drop-shadow-[0_0_30px_rgba(255,0,80,0.5)] relative mb-2"
                >
                    <span className="font-bold" style={{ fontFamily: "'UnifrakturCook', cursive" }}>A</span>lice
                </motion.h1>

                {/* in Borderland - Gothic Subtitle (White) */}
                <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className="font-gothic text-3xl md:text-7xl text-white tracking-[0.1em] mt-2 mb-4 md:mb-8 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] whitespace-nowrap"
                >
                    in Borderland
                </motion.h2>

                {/* CTA Button */}
                <motion.button
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 1 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onStart}
                    className="group relative inline-flex items-center justify-center px-10 py-5 md:px-16 md:py-8 bg-transparent overflow-hidden mt-2 md:mt-8 mb-10"
                >
                    {/* Tech Background Shape */}
                    <div className={`absolute inset-0 w-full h-full bg-[#050508]/80 border ${isElevated ? 'border-yellow-500' : 'border-[#ff0050]'} transform skew-x-[-20deg] ${isElevated ? 'group-hover:bg-yellow-500' : 'group-hover:bg-[#ff0050]'} transition-all duration-300 shadow-[0_0_20px_rgba(255,0,80,0.3)] ${isElevated ? 'group-hover:shadow-[0_0_40px_rgba(234,179,8,0.6)]' : 'group-hover:shadow-[0_0_40px_rgba(255,0,80,0.6)]'}`}></div>

                    {/* Decorative Tech Bits */}
                    <div className="absolute top-1 left-4 w-2 h-2 bg-white rounded-full z-20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="absolute bottom-1 right-4 w-2 h-2 bg-white rounded-full z-20 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                    {/* Button Text */}
                    <span className=" relative z-10 font-cinzel font-bold text-lg md:text-2xl tracking-[0.2em] text-white flex items-center gap-4 group-hover:text-black transition-colors duration-300 uppercase">
                        {isElevated ? (isSystemArchitect ? "Control The System" : "Manage The Games") : "Enter The Borderland"}
                        <Play size={20} className="fill-current" />
                    </span >
                </motion.button >
            </div>
        </section>
    );
};
