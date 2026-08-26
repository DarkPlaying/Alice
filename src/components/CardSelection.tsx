import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { PlayerCardModal } from './PlayerCardModal';
import { LogOut, User, ChevronLeft, ChevronRight } from 'lucide-react';

const cards = [
    {
        type: 'Spades',
        title: 'SURVIVAL',
        nickname: 'THE VETERAN',
        description: 'Physical games. High endurance and combat skills required.',
        color: '#3b82f6',
        glow: 'rgba(59, 130, 246, 0.4)',
        symbol: '♠',
        image: '/Game Wallpaper/spade.png',
    },
    {
        type: 'Clubs',
        title: 'TEAMWORK',
        nickname: 'THE LANTERN',
        description: 'Cooperative games. Survival depends on group synergy.',
        color: '#22c55e',
        glow: 'rgba(34, 197, 94, 0.4)',
        symbol: '♣',
        image: '/Game Wallpaper/clubs.png',
    },
    {
        type: 'Joker',
        title: 'THE ULTIMATE PROTOCOL',
        nickname: 'THE WILD CARD',
        description: 'Individual rotated maze trial. 14 rounds, special doors & minigames.',
        color: '#e2e8f0',
        glow: 'rgba(226, 232, 240, 0.5)',
        symbol: '🃏',
        image: '/Game Wallpaper/Joker.png',
    },
    {
        type: 'Hearts',
        title: 'PSYCHOLOGICAL',
        nickname: 'THE NIGHTMARE',
        description: 'Games of betrayal. Manipulation and emotional control.',
        color: '#ef4444',
        glow: 'rgba(239, 68, 68, 0.4)',
        symbol: '♥',
        image: '/Game Wallpaper/hearts.png',
    },
    {
        type: 'Diamonds',
        title: 'INTELLIGENCE',
        nickname: 'THE FIXER',
        description: 'Games of wit. Logical thinking and strategy are key.',
        color: '#a855f7',
        glow: 'rgba(168, 85, 247, 0.4)',
        symbol: '♦',
        image: '/Game Wallpaper/diamond.png',
    }
];

interface CardSelectionProps {
    onCardSelect: (type: string) => void;
    onBack: () => void;
    isLoggedIn?: boolean;
    onLogoutClick?: () => void;
    userInfo?: any;
}

import { useAssetLoader } from '../hooks/useAssetLoader';
import { Loader } from './Loader';

export const CardSelection = ({ onCardSelect, onBack, isLoggedIn, onLogoutClick, userInfo }: CardSelectionProps) => {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [showPlayerCard, setShowPlayerCard] = useState(false);
    const [activeMobileIndex, setActiveMobileIndex] = useState(0);
    const mobileScrollRef = useRef<HTMLDivElement>(null);

    const isLoaded = useAssetLoader([
        '/Untitled design.png',
        ...cards.map(c => c.image)
    ]);

    const handleMobileScroll = () => {
        if (!mobileScrollRef.current) return;
        const scrollLeft = mobileScrollRef.current.scrollLeft;
        const width = mobileScrollRef.current.clientWidth;
        if (width > 0) {
            const idx = Math.round(scrollLeft / width);
            setActiveMobileIndex(Math.min(Math.max(idx, 0), cards.length - 1));
        }
    };

    const scrollToMobileCard = (index: number) => {
        if (!mobileScrollRef.current) return;
        const width = mobileScrollRef.current.clientWidth;
        mobileScrollRef.current.scrollTo({
            left: index * width,
            behavior: 'smooth'
        });
        setActiveMobileIndex(index);
    };

    if (!isLoaded) return <Loader />;

    return (
        <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-[#050508] flex flex-col items-center justify-start lg:justify-center pt-10 pb-4 lg:pt-8 lg:pb-6 px-4 sm:px-6 lg:px-8 relative font-sans overflow-x-hidden w-full">

            {/* ── Top Left: Back Button ── */}
            <div className="fixed top-4 left-3 sm:top-6 sm:left-6 z-50">
                <button
                    onClick={onBack}
                    className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 hover:text-red-300 px-3 py-1.5 rounded-full text-[10px] font-mono tracking-widest uppercase transition-all group cursor-pointer"
                >
                    <span className="group-hover:-translate-x-1 transition-transform">←</span>
                    <span className="hidden xs:inline sm:inline">Go Back</span>
                </button>
            </div>

            {showPlayerCard && (
                <PlayerCardModal
                    user={userInfo}
                    onClose={() => setShowPlayerCard(false)}
                />
            )}

            {/* Background */}
            <div className="absolute inset-0 z-0">
                <div 
                    className="absolute inset-0 bg-cover bg-center opacity-60" 
                    style={{ backgroundImage: "url('/Untitled design.png')" }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-[#050508] via-transparent to-[#050508]" />
            </div>

            {/* ── Top Right: Profile + Logout ── */}
            {isLoggedIn && (
                <div className="fixed top-3 right-2 sm:top-6 sm:right-8 z-50 flex items-center gap-1 sm:gap-2">
                    {/* Profile — icon only on mobile */}
                    <button
                        onClick={() => setShowPlayerCard(true)}
                        className="flex items-center justify-center w-8 h-8 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer flex-shrink-0"
                        title="Player Profile"
                    >
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse sm:mr-1.5 flex-shrink-0"></div>
                        <span className="hidden sm:inline text-[10px] font-mono tracking-widest text-gray-300 uppercase">
                            {userInfo?.username || 'PLAYER'}
                        </span>
                        <User size={13} className="sm:hidden text-gray-400" />
                    </button>
                    {/* Logout — icon only on mobile */}
                    <button
                        onClick={onLogoutClick}
                        className="flex items-center justify-center w-8 h-8 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 bg-red-500/10 hover:bg-red-500 border border-red-500/50 text-red-500 hover:text-white rounded transition-all flex-shrink-0"
                        title="Logout"
                    >
                        <LogOut size={13} />
                        <span className="hidden sm:inline text-[10px] font-mono tracking-widest uppercase ml-1">Logout</span>
                    </button>
                </div>
            )}

            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -30 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative z-10 flex flex-col items-center mb-5 lg:mb-10 text-center w-full max-w-7xl mx-auto"
            >
                <p className="text-white/40 text-[9px] tracking-[0.5em] mb-1 select-none">今際の国のアリス</p>
                <motion.div 
                    initial={{ opacity: 0, filter: "blur(10px)" }}
                    animate={{ opacity: 1, filter: "blur(0px)" }}
                    transition={{ duration: 2, ease: "easeOut", delay: 0.2 }}
                    className="flex flex-col items-center gap-0 leading-none mb-4"
                >
                    <h1 className="text-7xl md:text-8xl lg:text-9xl font-gothic text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                        <span className="font-bold" style={{ fontFamily: "'UnifrakturCook', cursive" }}>A</span>lice
                    </h1>
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-gothic text-white/80 -mt-2 lg:-mt-4 drop-shadow-[0_10px_20px_rgba(0,0,0,0.4)]">
                        in Borderland
                    </h2>
                </motion.div>

                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6 mt-2 w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
                    <div className="h-[2px] w-full bg-[#ff0050] rounded-full shadow-[0_0_8px_#ff0050]" />
                    <span className="text-[#ff0050] font-cinzel tracking-[0.3em] pl-[0.3em] text-[10px] sm:text-xs md:text-sm uppercase font-bold whitespace-nowrap text-center">
                        Specialty Selection
                    </span>
                    <div className="h-[2px] w-full bg-[#ff0050] rounded-full shadow-[0_0_8px_#ff0050]" />
                </div>
            </motion.div>

            {/* ── Desktop & iPad View (5 cards in 1 row) ── */}
            <div className="hidden sm:grid sm:grid-cols-5 gap-3 md:gap-4 lg:gap-5 xl:gap-6 w-full max-w-7xl relative z-10 items-center justify-center justify-items-center mx-auto my-auto">
                {cards.map((card, index) => (
                    <motion.div
                        key={card.type}
                        initial={{ opacity: 0, scale: 0.9, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 1.2, ease: "easeOut", delay: index * 0.12 }}
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        onClick={() => onCardSelect(card.type)}
                        className="relative cursor-pointer w-full max-w-[150px] sm:max-w-[170px] lg:max-w-[210px] xl:max-w-[240px] flex flex-col items-center justify-center text-center"
                    >
                        <motion.div
                            animate={{ y: [0, -8, 0] }}
                            transition={{ duration: 1.5, ease: "easeInOut", delay: index * 0.3 }}
                            className="w-full flex justify-center items-center"
                        >
                            <div
                                className={`w-full aspect-[5/7] relative group rounded-[0.8rem] sm:rounded-[1.2rem] overflow-hidden shadow-2xl transition-all duration-500 hover:scale-[1.05] border ${card.type === 'Joker' ? 'border-slate-300/50 shadow-[0_0_20px_rgba(226,232,240,0.3)]' : 'border-white/10'}`}
                                style={{
                                    boxShadow: hoveredIndex === index ? `0 0 35px ${card.glow}, 0 20px 60px rgba(0,0,0,0.7)` : '0 8px 40px rgba(0,0,0,0.6)'
                                }}
                            >
                                <img
                                    src={card.image}
                                    alt={card.type}
                                    className="absolute inset-0 w-full h-full object-cover object-center opacity-80 grayscale-[0.3] group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-50 group-hover:opacity-30 transition-opacity duration-500" />
                                <div className="absolute inset-0 bg-scanline pointer-events-none opacity-[0.05]" />
                            </div>
                        </motion.div>

                        <div className="mt-2 flex justify-center items-center">
                            <motion.div
                                animate={hoveredIndex === index ? {
                                    scale: [1, 1.3, 1],
                                    opacity: [0.1, 0.6, 0.1]
                                } : {}}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: card.color, boxShadow: `0 0 15px ${card.color}` }}
                            />
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* ── Mobile View (1 card in view horizontal carousel) ── */}
            <div className="sm:hidden w-full relative z-10 flex flex-col items-center max-w-sm mx-auto my-auto">
                <div className="relative w-full flex items-center justify-center">
                    {/* Left Arrow */}
                    <button
                        onClick={() => scrollToMobileCard(Math.max(0, activeMobileIndex - 1))}
                        disabled={activeMobileIndex === 0}
                        className={`absolute left-1 z-20 p-2.5 rounded-full bg-black/70 border border-white/30 text-white backdrop-blur-md transition-all shadow-lg ${activeMobileIndex === 0 ? 'opacity-20 cursor-not-allowed' : 'opacity-90 hover:opacity-100 active:scale-90'}`}
                    >
                        <ChevronLeft size={22} />
                    </button>

                    {/* Scrollable Container */}
                    <div
                        ref={mobileScrollRef}
                        onScroll={handleMobileScroll}
                        className="w-full flex overflow-x-auto snap-x snap-mandatory scrollbar-none py-3 items-center justify-start"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                        {cards.map((card, index) => (
                            <div
                                key={card.type}
                                onClick={() => onCardSelect(card.type)}
                                className="w-full shrink-0 snap-center cursor-pointer flex flex-col items-center justify-center px-4"
                            >
                                <motion.div
                                    whileTap={{ scale: 0.96 }}
                                    className={`w-[250px] xs:w-[270px] aspect-[5/7] relative rounded-[1.4rem] overflow-hidden shadow-2xl border ${card.type === 'Joker' ? 'border-slate-300/60 shadow-[0_0_30px_rgba(226,232,240,0.4)]' : 'border-white/20'}`}
                                    style={{ boxShadow: `0 0 35px ${card.glow}, 0 20px 50px rgba(0,0,0,0.85)` }}
                                >
                                    <img
                                        src={card.image}
                                        alt={card.type}
                                        className="absolute inset-0 w-full h-full object-cover object-center opacity-90"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                                    <div className="absolute bottom-5 left-0 right-0 text-center px-3">
                                        <p className="text-base font-mono font-bold uppercase tracking-widest text-white drop-shadow-md">{card.type} Game</p>
                                        <p className="text-xs font-mono text-gray-300 uppercase tracking-wider mt-1">{card.title}</p>
                                    </div>
                                </motion.div>
                            </div>
                        ))}
                    </div>

                    {/* Right Arrow */}
                    <button
                        onClick={() => scrollToMobileCard(Math.min(cards.length - 1, activeMobileIndex + 1))}
                        disabled={activeMobileIndex === cards.length - 1}
                        className={`absolute right-1 z-20 p-2.5 rounded-full bg-black/70 border border-white/30 text-white backdrop-blur-md transition-all shadow-lg ${activeMobileIndex === cards.length - 1 ? 'opacity-20 cursor-not-allowed' : 'opacity-90 hover:opacity-100 active:scale-90'}`}
                    >
                        <ChevronRight size={22} />
                    </button>
                </div>

                {/* Mobile Pagination Indicator Dots */}
                <div className="flex items-center justify-center gap-2 mt-4">
                    {cards.map((card, idx) => (
                        <button
                            key={card.type}
                            onClick={() => scrollToMobileCard(idx)}
                            className={`h-2 rounded-full transition-all duration-300 ${activeMobileIndex === idx ? 'w-6 bg-white' : 'w-2 bg-white/30'}`}
                            aria-label={`Go to ${card.type}`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};
