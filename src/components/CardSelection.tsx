import { useState } from 'react';
import { motion } from 'framer-motion';
import { PlayerCardModal } from './PlayerCardModal';
import { LogOut, User } from 'lucide-react';

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

export const CardSelection = ({ onCardSelect, onBack, isLoggedIn, onLogoutClick, userInfo }: CardSelectionProps) => {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [showPlayerCard, setShowPlayerCard] = useState(false);

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
                className="relative z-10 flex flex-col items-center mb-5 lg:mb-10 text-center"
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

                <div className="flex items-center gap-4 mt-1">
                    <div className="h-px w-12 sm:w-36 md:w-48 bg-[#ff0050]" />
                    <p className="text-[#ff0050] font-cinzel tracking-[0.4em] text-[9px] uppercase font-bold whitespace-nowrap">
                        Specialty Selection
                    </p>
                    <div className="h-px w-12 sm:w-36 md:w-48 bg-[#ff0050]" />
                </div>
            </motion.div>

            {/* Playing Card Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 lg:gap-10 w-full max-w-sm sm:max-w-3xl lg:max-w-6xl relative z-10">
                {cards.map((card, index) => (
                    <motion.div
                        key={card.type}
                        initial={{ opacity: 0, scale: 0.9, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 1.2, ease: "easeOut", delay: index * 0.15 }}
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        onClick={() => {
                            onCardSelect(card.type);
                        }}
                        className="relative cursor-pointer"
                    >
                        <motion.div
                            animate={{ y: [0, -12, 0] }}
                            transition={{ duration: 1.5, ease: "easeInOut", delay: index * 0.4 }}
                        >
                            <div
                                className="w-full aspect-[5/7] relative group rounded-[1rem] sm:rounded-[1.2rem] overflow-hidden shadow-2xl transition-all duration-500 hover:scale-[1.05] border border-white/10"
                                style={{
                                    boxShadow: hoveredIndex === index ? `0 0 35px ${card.glow}, 0 20px 60px rgba(0,0,0,0.7)` : '0 8px 40px rgba(0,0,0,0.6)'
                                }}
                            >
                                {/* Full-bleed Image */}
                                <img
                                    src={card.image}
                                    alt={card.type}
                                    className="absolute inset-0 w-full h-full object-cover object-center opacity-80 grayscale-[0.3] group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700"
                                />
                                {/* Gradient overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-50 group-hover:opacity-30 transition-opacity duration-500" />

                                {/* Scanline */}
                                <div className="absolute inset-0 bg-scanline pointer-events-none opacity-[0.05]" />
                            </div>
                        </motion.div>

                        {/* Status light */}
                        <div className="mt-1.5 sm:mt-2.5 flex justify-center">
                            <motion.div
                                animate={hoveredIndex === index && !window.matchMedia('(max-width: 768px)').matches ? {
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
        </div>
    );
};
