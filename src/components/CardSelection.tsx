import { useState } from 'react';
import { motion } from 'framer-motion';
import { GlowCard } from './ui/spotlight-card';
import { Sword, Brain, Users, Heart } from 'lucide-react';
import { PlayerCardModal } from './PlayerCardModal';

const cards = [
    {
        type: 'Spades',
        title: 'SURVIVAL',
        nickname: 'THE VETERAN',
        description: 'Physical games. High endurance and combat skills required.',
        color: '#3b82f6',
        glow: 'rgba(59, 130, 246, 0.4)',
        symbol: '♠',
        image: '/suit_assets/spade.jpg',
        icon: Sword
    },
    {
        type: 'Hearts',
        title: 'PSYCHOLOGICAL',
        nickname: 'THE NIGHTMARE',
        description: 'Games of betrayal. Manipulation and emotional control.',
        color: '#ef4444',
        glow: 'rgba(239, 68, 68, 0.4)',
        symbol: '♥',
        image: '/suit_assets/heart.jpg',
        icon: Heart
    },
    {
        type: 'Clubs',
        title: 'TEAMWORK',
        nickname: 'THE LANTERN',
        description: 'Cooperative games. Survival depends on group synergy.',
        color: '#22c55e',
        glow: 'rgba(34, 197, 94, 0.4)',
        symbol: '♣',
        image: '/suit_assets/clubs.jpg',
        icon: Users
    },
    {
        type: 'Diamonds',
        title: 'INTELLIGENCE',
        nickname: 'THE FIXER',
        description: 'Games of wit. Logical thinking and strategy are key.',
        color: '#eab308',
        glow: 'rgba(234, 179, 8, 0.4)',
        symbol: '♦',
        image: '/suit_assets/diamond.jpg',
        icon: Brain
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
        <div className="min-h-screen bg-[#050508] flex flex-col items-center justify-center p-8 relative overflow-hidden font-sans">
            {/* Top Left Navigation Section */}
            <div className="fixed top-4 left-4 sm:top-6 sm:left-6 z-50 flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white px-4 py-1.5 rounded-full text-[10px] font-mono tracking-widest uppercase transition-all group"
                >
                    <span className="group-hover:-translate-x-1 transition-transform">←</span>
                    Go Back
                </button>
            </div>
            {showPlayerCard && (
                <PlayerCardModal
                    user={userInfo}
                    onClose={() => setShowPlayerCard(false)}
                />
            )}
            {/* Background with blurred urban feel */}
            <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-[url('/hero-bg.webp')] bg-cover bg-center opacity-10 blur-3xl scale-125" />

                {/* Red Checkered Overlay */}
                <div
                    className="absolute inset-0 opacity-10"
                    style={{
                        backgroundImage: `
                            linear-gradient(45deg, #ff0050 25%, transparent 25%), 
                            linear-gradient(-45deg, #ff0050 25%, transparent 25%), 
                            linear-gradient(45deg, transparent 75%, #ff0050 75%), 
                            linear-gradient(-45deg, transparent 75%, #ff0050 75%)
                        `,
                        backgroundSize: '80px 80px',
                        backgroundPosition: '0 0, 0 40px, 40px 40px, 40px 0'
                    }}
                />

                <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black" />
            </div>

            {/* Top Right Logout Section */}
            {isLoggedIn && (
                <div className="fixed top-4 right-4 sm:top-6 sm:right-8 z-50 flex items-center gap-4">
                    <button
                        onClick={() => setShowPlayerCard(true)}
                        className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                    >
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-[10px] font-mono tracking-widest text-gray-300 uppercase">
                            {userInfo?.username || 'PLAYER'}
                        </span>
                    </button>
                    <button
                        onClick={onLogoutClick}
                        className="bg-red-500/10 hover:bg-red-500 border border-red-500/50 text-red-500 hover:text-white px-4 py-1.5 rounded text-[10px] font-mono tracking-widest uppercase transition-all"
                    >
                        Logout
                    </button>
                </div>
            )}

            {/* Header Section - Matches Landing Page Logo Style */}
            <motion.div
                initial={{ opacity: 0, y: -30 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative z-10 flex flex-col items-center mb-16 text-center"
            >


                <p className="text-white/40 text-[10px] tracking-[0.5em] mb-3 select-none">今際の国のアリス</p>
                <div className="flex flex-col items-center gap-0 leading-none mb-6">
                    <h1 className="text-7xl md:text-9xl font-gothic text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                        <span className="font-bold" style={{ fontFamily: "'UnifrakturCook', cursive" }}>A</span>lice
                    </h1>
                    <h2 className="text-3xl md:text-5xl font-gothic text-white/80 -mt-4 drop-shadow-[0_10px_20px_rgba(0,0,0,0.4)]">
                        in Borderland
                    </h2>
                </div>

                <div className="flex items-center gap-6 mt-4">
                    <div className="h-px w-16 bg-[#ff0050]" />
                    <p className="text-[#ff0050] font-cinzel tracking-[0.4em] text-[12px] uppercase font-bold">
                        Specialty Selection
                    </p>
                    <div className="h-px w-16 bg-[#ff0050]" />
                </div>
            </motion.div>

            {/* Playing Card Shape Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 w-full max-w-7xl relative z-10 px-4">
                {cards.map((card, index) => (
                    <motion.div
                        key={card.type}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1 }}
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        onClick={() => {
                            console.log("Card Selection Triggered:", card.type);
                            onCardSelect(card.type);
                        }}
                        className="relative cursor-pointer"
                    >
                        <GlowCard
                            glowColor={card.type === 'Spades' ? 'blue' : card.type === 'Hearts' ? 'red' : card.type === 'Clubs' ? 'green' : 'orange'}
                            className="w-full aspect-[5/7] border-white/10 bg-[#0d0d0f] p-0 overflow-hidden group rounded-[1.2rem] shadow-2xl transition-all duration-500 hover:scale-[1.05]"
                        >
                            <div
                                className="absolute inset-0 z-0"
                            >
                                <img
                                    src={card.image}
                                    alt={card.type}
                                    className="w-full h-full object-cover opacity-70 grayscale-[0.5] group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-100 group-hover:opacity-80 transition-opacity duration-500" />
                            </div>

                            <div className="absolute inset-0 z-10 p-8 flex flex-col justify-end pointer-events-none">
                                <div className="space-y-6 transform group-hover:-translate-y-2 transition-transform duration-500">
                                    <div className="h-px w-full bg-white/10" />

                                    <div className="space-y-1">
                                        <h3 className="text-3xl font-cinzel text-white uppercase tracking-widest drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] font-bold">
                                            {card.type}
                                        </h3>
                                        <p className="text-[12px] font-playfair text-white/50 group-hover:text-white/100 transition-colors uppercase tracking-widest">
                                            {card.type} Specialization
                                        </p>
                                    </div>

                                    <p className="text-[10px] font-playfair tracking-[0.2em] text-white/30 uppercase leading-relaxed group-hover:text-white/60 transition-colors">
                                        Citizens of the Borderland<br />
                                        Pattern: {card.type.toUpperCase()}<br />
                                        Status: PENDING
                                    </p>
                                </div>
                            </div>

                            {/* Corner Symbol */}
                            <div className="absolute top-8 left-8 z-10 opacity-80">
                                <span className="text-3xl font-display font-black leading-none" style={{ color: card.color }}>{card.symbol}</span>
                            </div>

                            {/* Scanline & HUD */}
                            <div className="absolute inset-0 bg-scanline pointer-events-none opacity-[0.05]" />
                        </GlowCard>

                        {/* Status Light below card */}
                        <div className="mt-8 flex justify-center">
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

            {/* System Status Footer */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="mt-20 text-white/5 font-mono text-[7px] tracking-[1.5em] uppercase text-center"
            >
                Neural Synchronization Complete // Input Required
            </motion.div>
        </div>
    );
};
