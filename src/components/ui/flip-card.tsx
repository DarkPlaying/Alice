'use client';

import { cn } from '../../lib/utils';
import { ArrowRight, Sword, Brain, Users, Heart, Zap, Shield, Target, Activity } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlowCard } from './spotlight-card';

export interface CardFlipProps {
    title: string;
    nickname: string;
    description: string;
    symbol: string;
    image: string;
    color: string;
    type: string;
    onSelect: (type: string) => void;
    isExpanded?: boolean;
}

export default function CardFlip({
    title,
    nickname,
    description,
    symbol,
    image,
    color,
    type,
    onSelect,
    isExpanded = true
}: CardFlipProps) {
    const [isFlipped, setIsFlipped] = useState(false);

    const getIcon = () => {
        switch (type) {
            case 'Spades': return <Sword className="h-6 w-6 text-white" />;
            case 'Diamonds': return <Brain className="h-6 w-6 text-white" />;
            case 'Clubs': return <Users className="h-6 w-6 text-white" />;
            case 'Hearts': return <Heart className="h-6 w-6 text-white" />;
            default: return <Zap className="h-6 w-6 text-white" />;
        }
    };

    const getGlowColor = (): 'blue' | 'purple' | 'green' | 'red' | 'orange' => {
        switch (type) {
            case 'Spades': return 'blue';
            case 'Diamonds': return 'orange';
            case 'Clubs': return 'green';
            case 'Hearts': return 'red';
            default: return 'blue';
        }
    };

    const getFeatures = () => {
        switch (type) {
            case 'Spades': return ['Physical Prowess', 'High Endurance', 'Combat Ready', 'Solo Survival'];
            case 'Diamonds': return ['Logical Reasoning', 'Strategic Depth', 'Wit Battle', 'Data Analysis'];
            case 'Clubs': return ['Team Synergy', 'Communication', 'Shared Fate', 'Group Strategy'];
            case 'Hearts': return ['Mental Fortitude', 'Deception Mastery', 'Emotional Control', 'High Stakes'];
            default: return [];
        }
    };

    const features = getFeatures();
    const featureIcons = [Target, Activity, Shield, Zap];

    return (
        <div
            className="group relative h-full w-full [perspective:2000px] font-display"
            onMouseEnter={() => setIsFlipped(true)}
            onMouseLeave={() => setIsFlipped(false)}
        >
            <div
                className={cn(
                    'relative h-full w-full',
                    '[transform-style:preserve-3d]',
                    'transition-all duration-700',
                    isFlipped && isExpanded
                        ? '[transform:rotateY(180deg)]'
                        : '[transform:rotateY(0deg)]',
                )}
            >
                {/* Front of card (The Pillar) */}
                <div
                    className={cn(
                        'absolute inset-0 h-full w-full',
                        '[transform:rotateY(0deg)] [backface-visibility:hidden]',
                        'transition-all duration-700 rounded-[4rem] overflow-hidden',
                        isFlipped && isExpanded ? 'opacity-0' : 'opacity-100',
                    )}
                >
                    <GlowCard
                        glowColor={getGlowColor()}
                        className="w-full h-full border-none p-0 backdrop-blur-none"
                        customSize={true}
                    >
                        {/* Character/Suit Background Image - Always Full Frame Slice */}
                        <div className="absolute inset-0 z-0">
                            <img
                                src={image}
                                alt={title}
                                className={cn(
                                    "w-full h-full object-cover transition-all duration-1000",
                                    isExpanded ? "scale-105 opacity-70" : "scale-125 opacity-40 blur-[1px] grayscale-[0.5] group-hover:grayscale-0 group-hover:opacity-60"
                                )}
                            />
                            <div className={cn(
                                "absolute inset-0 transition-opacity duration-700",
                                isExpanded ? "bg-gradient-to-t from-black via-black/30 to-transparent opacity-100" : "bg-black/40 opacity-100"
                            )} />
                        </div>

                        {/* Expanded HUD Elements */}
                        <AnimatePresence>
                            {isExpanded && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-x-0 bottom-0 z-10 p-10 pb-16 flex flex-col items-start gap-1"
                                >
                                    {/* Center Highlight Icon */}
                                    <motion.div
                                        animate={{
                                            boxShadow: [`0 0 10px ${color}`, `0 0 30px ${color}`, `0 0 10px ${color}`]
                                        }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                        className="h-16 w-16 rounded-2xl flex items-center justify-center mb-6"
                                        style={{ backgroundColor: color }}
                                    >
                                        {getIcon()}
                                    </motion.div>

                                    <div className="skew-x-[-12deg]">
                                        <h3 className="text-5xl font-black italic text-white mb-0 uppercase tracking-tighter leading-none">
                                            {title}
                                        </h3>
                                        <p className="text-xs font-mono font-bold mb-4 italic opacity-100 uppercase tracking-[0.4em]" style={{ color }}>
                                            {nickname}
                                        </p>
                                    </div>

                                    {/* HUD Data Bars */}
                                    <div className="w-full flex flex-col gap-2 mt-2">
                                        {[...Array(4)].map((_, i) => (
                                            <div
                                                key={i}
                                                className="h-[2px] rounded-full animate-[slideIn_3s_ease-in-out_infinite]"
                                                style={{
                                                    backgroundImage: `linear-gradient(to right, transparent, ${color}cc, transparent)`,
                                                    width: `${30 + Math.random() * 50}%`,
                                                    animationDelay: `${i * 0.3}s`,
                                                }}
                                            />
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* symbol always present but positions differently */}
                        <div className={cn(
                            "absolute transition-all duration-700 ease-in-out pointer-events-none",
                            isExpanded ? "top-10 left-10 opacity-60 scale-100" : "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-30 scale-[2]"
                        )} style={{ color }}>
                            <span className="text-5xl font-bold leading-none select-none">{symbol}</span>
                        </div>

                        {/* Scanline Effect */}
                        <div className="absolute inset-0 bg-scanline pointer-events-none opacity-[0.1]" />
                    </GlowCard>
                </div>

                {/* Back of card (The Data View) */}
                {isExpanded && (
                    <div
                        className={cn(
                            'absolute inset-0 h-full w-full',
                            '[transform:rotateY(180deg)] [backface-visibility:hidden]',
                            'transition-all duration-700 rounded-[4rem] overflow-hidden',
                            !isFlipped ? 'opacity-0' : 'opacity-100',
                        )}
                    >
                        <GlowCard
                            glowColor={getGlowColor()}
                            className="w-full h-full border-none p-0 bg-[#0a0a0c]"
                            customSize={true}
                        >
                            <div className="relative z-10 flex-1 flex flex-col p-10 h-full justify-center">
                                <div className="space-y-6">
                                    <div className="flex items-center gap-6 skew-x-[-12deg]">
                                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: color, boxShadow: `0 0 20px ${color}66` }}>
                                            {getIcon()}
                                        </div>
                                        <div>
                                            <h3 className="text-3xl font-black italic text-white uppercase tracking-tighter leading-none">
                                                {title}
                                            </h3>
                                            <p className="text-[10px] font-mono tracking-widest uppercase opacity-50">Operational Data</p>
                                        </div>
                                    </div>

                                    <div className="h-[1px] w-full bg-white/10" />

                                    <p className="text-[14px] leading-relaxed text-gray-400 font-mono uppercase tracking-tight max-w-sm">
                                        {description}
                                    </p>
                                </div>

                                <div className="space-y-4 pt-10">
                                    {features.map((feature, index) => {
                                        const IconComponent = featureIcons[index % featureIcons.length];
                                        return (
                                            <motion.div
                                                key={feature}
                                                initial={{ x: -20, opacity: 0 }}
                                                animate={{ x: 0, opacity: 1 }}
                                                transition={{ delay: index * 0.1 + 0.5 }}
                                                className="flex items-center gap-5 text-sm text-gray-200 font-mono"
                                            >
                                                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border" style={{ borderColor: `${color}44`, backgroundColor: `${color}11` }}>
                                                    <IconComponent className="h-4 w-4" style={{ color: color }} />
                                                </div>
                                                <span className="font-black tracking-[0.2em] uppercase text-[11px]">{feature}</span>
                                            </motion.div>
                                        );
                                    })}
                                </div>

                                <div className="mt-12 pt-8 border-t border-white/5">
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSelect(type);
                                        }}
                                        className="group/btn relative w-full flex items-center justify-between rounded-3xl py-5 px-8 transition-all duration-300 border border-white/10 overflow-hidden"
                                        style={{ backgroundColor: `${color}15` }}
                                    >
                                        <div className="absolute inset-0 bg-white/0 group-hover/btn:bg-white/5 transition-colors" />
                                        <span className="text-xs font-black font-display uppercase tracking-[0.4em] text-white transition-colors duration-300 relative z-10">
                                            Establish Profile
                                        </span>
                                        <ArrowRight className="h-6 w-6 text-white group-hover/btn:translate-x-2 transition-transform duration-300 relative z-10" />
                                    </motion.button>
                                </div>
                            </div>
                        </GlowCard>
                    </div>
                )}
            </div>
        </div>
    );
}
