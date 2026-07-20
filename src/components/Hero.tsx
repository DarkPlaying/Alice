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
                x: { duration: 1.8, ease: "easeOut" },
                rotate: { duration: 1.8, ease: "easeOut" },
                opacity: { duration: 1.4 },
                y: { duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.8 }
            }}
        />
    );
};

export const Hero = ({ onStart, userInfo }: HeroProps) => {
    const isSystemArchitect = userInfo?.username === 'admin' || userInfo?.role === 'admin';
    const isGameMaster = userInfo?.role === 'master';
    const isElevated = isSystemArchitect || isGameMaster;

    return (
        <section className="relative h-screen min-h-[600px] md:min-h-[800px] flex items-center justify-center overflow-hidden bg-[#050508]">

            {/* Background: Poster Image */}
            <div className="absolute inset-0 z-0">
                <img
                    src="/hero-bg.webp"
                    alt="Alice in Borderland Background"
                    className="w-full h-full object-cover opacity-60"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-[#050505]/60"></div>
            </div>

            {/* Laser Grid Layer (Overlay) */}
            <div className="absolute inset-0 z-10 pointer-events-none opacity-80">
                <LaserGrid />
            </div>

            {/* Intro Cards (Fully responsive, scaled by vw so they don't overlap text) */}

            <div className="absolute left-4 bottom-[5%] sm:bottom-auto sm:left-[4%] md:left-[8%] lg:left-[12%] sm:top-[50%] lg:top-[55%] sm:-translate-y-1/2 w-[18vw] min-w-[60px] max-w-[90px] sm:w-[15vw] sm:min-w-[110px] md:w-[14vw] md:max-w-[190px] lg:w-[14vw] lg:max-w-[210px] z-20 pointer-events-none opacity-80 sm:opacity-60 md:opacity-85 lg:opacity-90">
                <SeekingCard side="left" fixedCard="Spades_K.png" className="w-full h-auto drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)]" />
            </div>
            <div className="absolute right-4 top-[25%] -translate-y-1/2 sm:top-[50%] lg:top-[55%] sm:right-[4%] md:right-[8%] lg:right-[12%] w-[18vw] min-w-[60px] max-w-[90px] sm:w-[15vw] sm:min-w-[110px] md:w-[14vw] md:max-w-[190px] lg:w-[14vw] lg:max-w-[210px] z-20 pointer-events-none opacity-80 sm:opacity-60 md:opacity-85 lg:opacity-90">
                <SeekingCard side="right" fixedCard="Hearts_Q.png" className="w-full h-auto drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)]" />
            </div>

            {/* Main Title Sequence */}
            <div className="relative z-30 max-w-7xl mx-auto px-4 sm:px-6 flex flex-col items-center justify-center h-full text-center mt-8 sm:mt-0 -translate-y-2 sm:-translate-y-10 md:-translate-y-12 lg:-translate-y-14 landscape:translate-y-0 landscape:my-auto transition-transform duration-300">

                {/* Japanese Subtitle: Serif White */}
                <motion.p
                    initial={{ opacity: 0, letterSpacing: "0.6em" }}
                    animate={{ opacity: 1, letterSpacing: "0.5em" }}
                    transition={{ duration: 1.5, ease: "circOut" }}
                    className="text-white font-serif text-sm md:text-lg mb-4 animate-pulse drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                >
                    {isElevated ? (isSystemArchitect ? "システムアーキテクト" : "ゲームマスター") : "今際の国のアリス"}
                </motion.p>

                {/* Auth Badge */}
                {userInfo && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`mb-3 sm:mb-4 px-3 sm:px-6 py-0.5 sm:py-1 border-y ${isElevated ? 'border-yellow-500/50 bg-yellow-500/10' : 'border-[#ff0050]/50 bg-[#ff0050]/10'}`}
                    >
                        <span className={`font-mono text-[10px] xs:text-[11px] sm:text-xs tracking-[0.18em] xs:tracking-[0.25em] sm:tracking-[0.5em] font-bold uppercase ${isElevated ? 'text-yellow-500' : 'text-[#ff0050]'}`}>
                            {isSystemArchitect ? "System Architect Authenticated" : isGameMaster ? "Game Master Authorization Active" : "Borderland Resident Authenticated"}
                        </span>
                    </motion.div>
                )}

                {/* Alice - Giant Gothic Title (White) */}
                <motion.h1
                    initial={{ scale: 1.2, filter: 'blur(10px)', opacity: 0 }}
                    animate={{ scale: 1, filter: 'blur(0px)', opacity: 1 }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    className="font-gothic text-[8rem] sm:text-[9rem] md:text-[11rem] lg:text-[15rem] leading-[0.8] text-white drop-shadow-[0_0_30px_rgba(255,0,80,0.5)] relative mb-2"
                >
                    <span className="font-bold" style={{ fontFamily: "'UnifrakturCook', cursive" }}>A</span>lice
                </motion.h1>

                {/* in Borderland - Gothic Subtitle (White) */}
                <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className="font-gothic text-3xl sm:text-3xl md:text-4xl lg:text-5xl text-white tracking-[0.1em] mt-2 mb-4 md:mb-8 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] whitespace-nowrap"
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
                    className="group relative inline-flex items-center justify-center w-[80vw] max-w-[320px] sm:w-auto sm:max-w-none py-4 sm:px-10 sm:py-5 md:px-14 md:py-6 lg:px-16 lg:py-7 bg-transparent overflow-hidden mt-2 sm:mt-4 md:mt-6 mb-6 cursor-pointer"
                >
                    {/* Tech Background Shape */}
                    <div className={`absolute inset-0 w-full h-full bg-[#050508]/80 border ${isElevated ? 'border-yellow-500' : 'border-[#ff0050]'} transform skew-x-[-20deg] ${isElevated ? 'group-hover:bg-yellow-500' : 'group-hover:bg-[#ff0050]'} transition-all duration-300 shadow-[0_0_20px_rgba(255,0,80,0.3)] ${isElevated ? 'group-hover:shadow-[0_0_40px_rgba(234,179,8,0.6)]' : 'group-hover:shadow-[0_0_40px_rgba(255,0,80,0.6)]'}`}></div>

                    {/* Decorative Tech Bits */}
                    <div className="absolute top-1 left-4 w-2 h-2 bg-white rounded-full z-20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="absolute bottom-1 right-4 w-2 h-2 bg-white rounded-full z-20 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                    {/* Button Text */}
                    <span
                        className=" relative z-10 font-cinzel font-bold text-base xs:text-lg sm:text-base md:text-xl lg:text-2xl tracking-[0.12em] xs:tracking-[0.15em] sm:tracking-[0.2em] text-white flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-3 md:gap-4 group-hover:text-black transition-colors duration-300 uppercase text-center"
                        style={{ paddingTop: '5px' }}
                    >
                        {isElevated ? (
                            <span className="flex items-center justify-center gap-2">
                                {isSystemArchitect ? "Control The System" : "Manage The Games"}
                                <Play size={16} className="fill-current w-[14px] h-[14px] sm:w-[16px] sm:h-[16px] md:w-[20px] md:h-[20px] lg:w-[24px] lg:h-[24px]" />
                            </span>
                        ) : (
                            <>
                                <span className="sm:hidden flex flex-col items-center leading-tight">
                                    <span>Enter The</span>
                                    <span className="flex items-center gap-1.5 mt-0.5">
                                        Borderland <Play size={18} className="fill-current" />
                                    </span>
                                </span>
                                <span className="hidden sm:flex items-center gap-3 md:gap-4 whitespace-nowrap">
                                    Enter The Borderland
                                    <Play size={16} className="fill-current sm:w-[16px] sm:h-[16px] md:w-[20px] md:h-[20px] lg:w-[24px] lg:h-[24px]" />
                                </span>
                            </>
                        )}
                    </span>
                </motion.button >
            </div>
        </section>
    );
};
