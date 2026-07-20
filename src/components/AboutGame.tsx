import { useState } from 'react';
import { motion, useScroll, useTransform, useSpring, useVelocity } from 'framer-motion';

const scrollCards = [
    { src: 'Spades_A.png', left: '10%', top: '20%', delay: 0 },
    { src: 'Hearts_K.png', left: '85%', top: '15%', delay: 0.1 },
    { src: 'Diamonds_7.png', left: '5%', top: '70%', delay: 0.2 },
    { src: 'Clubs_J.png', left: '80%', top: '65%', delay: 0.3 },
    { src: 'Spades_9.png', left: '45%', top: '40%', delay: 0.15 },
];

const ScrollRevealingCards = () => {
    const { scrollY } = useScroll();
    const scrollVelocity = useVelocity(scrollY);
    const smoothVelocity = useSpring(scrollVelocity, {
        damping: 50,
        stiffness: 400
    });

    // Map velocity to opacity: 0 velocity -> 0 opacity, high velocity -> 1 opacity
    const opacity = useTransform(smoothVelocity, [-2000, -50, 0, 50, 2000], [1, 1, 0, 1, 1]);

    // Parallax/Falling effect: Move cards down as we scroll
    const y1 = useTransform(scrollY, [0, 2000], [0, 400]);
    const y2 = useTransform(scrollY, [0, 2000], [0, 600]);

    return (
        <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
            {scrollCards.map((card, i) => (
                <motion.img
                    key={i}
                    src={`/borderland_cards/${card.src}`}
                    alt="Falling Card"
                    style={{
                        opacity,
                        y: i % 2 === 0 ? y1 : y2,
                        rotate: useTransform(scrollY, [0, 2000], [0, i % 2 === 0 ? 360 : -360])
                    }}
                    className="absolute w-16 md:w-24 opacity-0 drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]"
                    initial={{ left: card.left, top: card.top }}
                />
            ))}
        </div>
    );
};

export const AboutGame = () => {
    const [scanState, setScanState] = useState<'idle' | 'scanning' | 'success'>('idle');

    const handleScan = () => {
        if (scanState !== 'idle') return;
        setScanState('scanning');
        setTimeout(() => {
            setScanState('success');
            setTimeout(() => {
                setScanState('idle');
            }, 4000);
        }, 1800);
    };

    return (
        <section className="py-16 relative z-30 overflow-hidden bg-white/5 backdrop-blur-sm border-y border-white/10">
            <ScrollRevealingCards />
            <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center relative z-20">

                {/* Left Side: Image */}
                <motion.div
                    initial={{ opacity: 0, x: -50 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="relative max-w-sm mx-auto group cursor-crosshair"
                >
                    <div className="absolute inset-0 bg-[#ff0050]/25 blur-3xl -z-10 rounded-full opacity-60 group-hover:scale-125 group-hover:bg-[#ff0050]/35 transition-all duration-500"></div>
                    <div className="relative overflow-hidden rounded-lg">
                        <motion.img
                            src="/about-image.jpg"
                            alt="About The Game"
                            referrerPolicy="no-referrer"
                            initial={{ filter: "grayscale(100%)" }}
                            whileInView={{ filter: "grayscale(20%)" }}
                            whileHover={{ scale: 1.05, filter: "grayscale(0%)" }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, ease: "easeInOut" }}
                            className="w-full h-auto rounded-lg shadow-2xl border border-white/10 object-cover aspect-[3/4] transition-all duration-500"
                        />
                        {/* Glowing sweep effect on hover */}
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#ff0050]/15 to-transparent -translate-y-full group-hover:translate-y-full transition-transform duration-1000 ease-out pointer-events-none" />
                    </div>
                    {/* Decorative Elements */}
                    <div className="absolute -bottom-6 -right-6 w-24 h-24 border-b-2 border-r-2 border-[#ff0050] opacity-50 group-hover:translate-x-2 group-hover:translate-y-2 group-hover:opacity-100 transition-all duration-300"></div>
                    <div className="absolute -top-6 -left-6 w-24 h-24 border-t-2 border-l-2 border-[#ff0050] opacity-50 group-hover:-translate-x-2 group-hover:-translate-y-2 group-hover:opacity-100 transition-all duration-300"></div>
                </motion.div>

                {/* Right Side: Content */}
                <motion.div
                    initial={{ opacity: 0, x: 50 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
                    className="text-left"
                >
                    <h3 className="text-xl md:text-2xl font-mono text-gray-400 mb-2 tracking-[0.5em] uppercase hover:animate-glitch cursor-default transition-all duration-300">
                        PROJECT ALICE
                    </h3>

                    <h2 className="text-4xl md:text-6xl font-display text-[#ff0050] mb-6 tracking-tighter leading-none relative group w-fit">
                        <span className="relative z-10">BEYOND</span>
                        <br />
                        <span className="text-white text-3xl md:text-5xl tracking-normal relative z-10">THE BORDERLINE</span>

                        {/* Glitch Shadow for Title */}
                        <span className="absolute top-0 left-0 text-[#00ffff] opacity-0 group-hover:opacity-60 animate-glitch blur-[1px] mix-blend-screen -z-10 translate-x-1">BEYOND</span>
                    </h2>

                    <div className="space-y-4 text-gray-300 font-display text-xs sm:text-sm md:text-[14px] leading-relaxed max-w-md tracking-wide">
                        <p>
                            ALICE is an immersive survival game platform powered by <span className="text-white">React</span> and <span className="text-white">Supabase</span>. Inspired by the high-stakes world of Borderland, every game is a test of your will to survive.
                        </p>
                        <p className="opacity-70">
                            Explore four distinct challenge types—<span className="text-cyan-400">Physical</span>, <span className="text-blue-400">Intellectual</span>, <span className="text-purple-400">Balanced</span>, and <span className="text-[#ff0050]">Psychological</span>. The suit you choose defines your fate.
                        </p>
                        <p>
                            Real-time synchronization, cinematic animations, and a merciless scoring system ensure that no two games are the same. Are you ready to hold the card?
                        </p>
                    </div>

                    <motion.button 
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleScan}
                        disabled={scanState === 'scanning'}
                        className={`mt-10 relative text-left overflow-hidden rounded-md border p-4 max-w-sm flex flex-col gap-2 backdrop-blur-md transition-all duration-300 w-full cursor-pointer select-none ${
                            scanState === 'scanning' ? 'border-amber-500/50 bg-amber-950/20 shadow-[0_0_20px_rgba(245,158,11,0.25)]' :
                            scanState === 'success' ? 'border-emerald-500/50 bg-emerald-950/20 shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-pulse' :
                            'border-red-500/30 bg-red-950/20 shadow-[0_0_20px_rgba(239,68,68,0.15)] hover:border-[#ff0050]/60'
                        }`}
                    >
                        {/* High-tech corner accents */}
                        <div className={`absolute top-0 right-0 w-3 h-3 border-t border-r opacity-60 ${
                            scanState === 'scanning' ? 'border-amber-400' :
                            scanState === 'success' ? 'border-emerald-400' :
                            'border-[#ff0050]'
                        }`}></div>
                        <div className={`absolute bottom-0 left-0 w-3 h-3 border-b border-l opacity-60 ${
                            scanState === 'scanning' ? 'border-amber-400' :
                            scanState === 'success' ? 'border-emerald-400' :
                            'border-[#ff0050]'
                        }`}></div>
                        
                        {/* Moving Scanline inside telemetry box */}
                        <motion.div
                            animate={{ 
                                y: [-10, 80, -10],
                                opacity: [0.1, 0.4, 0.1]
                            }}
                            transition={{
                                duration: scanState === 'scanning' ? 1.5 : 4,
                                repeat: Infinity,
                                ease: "linear"
                            }}
                            className={`absolute inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent to-transparent pointer-events-none ${
                                scanState === 'scanning' ? 'via-amber-400' :
                                scanState === 'success' ? 'via-emerald-400' :
                                'via-[#ff0050]'
                            }`}
                        />

                        {/* Status Header */}
                        <div className={`flex items-center justify-between border-b pb-2 w-full ${
                            scanState === 'scanning' ? 'border-amber-500/10' :
                            scanState === 'success' ? 'border-emerald-500/10' :
                            'border-[#ff0050]/10'
                        }`}>
                            <div className="flex items-center gap-2.5">
                                <span className="relative flex h-2 w-2">
                                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                                        scanState === 'scanning' ? 'bg-amber-400' :
                                        scanState === 'success' ? 'bg-emerald-400' :
                                        'bg-[#ff0050]'
                                    }`}></span>
                                    <span className={`relative inline-flex rounded-full h-2 w-2 ${
                                        scanState === 'scanning' ? 'bg-amber-400' :
                                        scanState === 'success' ? 'bg-emerald-400' :
                                        'bg-[#ff0050]'
                                    }`}></span>
                                </span>
                                <span className={`text-[10px] font-mono font-bold tracking-[0.2em] uppercase ${
                                    scanState === 'scanning' ? 'text-amber-400' :
                                    scanState === 'success' ? 'text-emerald-400' :
                                    'text-[#ff0050]'
                                }`}>
                                    {scanState === 'scanning' ? 'ESTABLISHING DOWNLINK' :
                                     scanState === 'success' ? 'SECURE CONNECTION' :
                                     'REAL-TIME SYSTEM MONITOR'}
                                </span>
                            </div>
                            <span className={`text-[9px] font-mono tracking-wider ${
                                scanState === 'scanning' ? 'text-amber-500/80' :
                                scanState === 'success' ? 'text-emerald-500/80' :
                                'text-[#ff0050]/60'
                            }`}>
                                {scanState === 'scanning' ? 'SYS: BUSY' :
                                 scanState === 'success' ? 'SYS: DECRYPTED' :
                                 'SYS: NOMINAL'}
                            </span>
                        </div>

                        {/* Telemetry info */}
                        <div className={`flex flex-col gap-1 text-[11px] font-mono tracking-widest leading-relaxed w-full ${
                            scanState === 'scanning' ? 'text-amber-100/80' :
                            scanState === 'success' ? 'text-emerald-100/80' :
                            'text-red-100/80'
                        }`}>
                            <div className="flex justify-between items-center gap-4">
                                <span className={`text-[9px] uppercase ${
                                    scanState === 'scanning' ? 'text-amber-400/80' :
                                    scanState === 'success' ? 'text-emerald-400/80' :
                                    'text-[#ff0050]/80'
                                }`}>SYNCHRONIZATION:</span>
                                <span className={`font-bold ${
                                    scanState === 'scanning' ? 'text-amber-300 animate-pulse' :
                                    scanState === 'success' ? 'text-emerald-300' :
                                    'text-[#ff0050]'
                                }`}>
                                    {scanState === 'scanning' ? 'SCANNING SEC_v42...' :
                                     scanState === 'success' ? 'ACTIVE // 100%' :
                                     'ACTIVE // 99.9%'}
                                </span>
                            </div>
                            <div className={`flex justify-between items-center text-[9px] pt-0.5 font-mono ${
                                scanState === 'scanning' ? 'text-amber-500/70' :
                                scanState === 'success' ? 'text-emerald-500/70' :
                                'text-red-500/70'
                            }`}>
                                <span>{scanState === 'scanning' ? 'CONNECTING...' : scanState === 'success' ? 'PING: 4MS' : 'PING: 14MS'}</span>
                                <span>{scanState === 'scanning' ? 'SSL HANDSHAKE' : scanState === 'success' ? 'VISA REMAINING: 15 DAYS' : 'PROTOCOL: SECURE SSL'}</span>
                            </div>
                        </div>
                    </motion.button>
                </motion.div>
            </div>
        </section>
    );
};
