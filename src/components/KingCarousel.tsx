
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ChevronLeft,
    ChevronRight,
    Skull,
    Users,
    Swords,
    Brain,
    HeartCrack,
    Handshake,
    Activity
} from "lucide-react";
import { cn } from "../lib/utils";

interface KingProfile {
    name: string;
    title: string;
    description: string;
    imageUrl: string;
    stats: {
        icon: any;
        label: string;
        value: string;
    }[];
}

const kings: KingProfile[] = [
    {
        name: "King of Spades",
        title: "The Physical Challenge",
        description:
            "The King of Spades governs the arena of raw survival. His games are a test of endurance, strength, and combat prowess. In his domain, words are meaningless; only physical superiority guarantees another day of life.",
        imageUrl: "/borderland_cards/Spades_K.png",
        stats: [
            { icon: Skull, label: "Difficulty", value: "Extreme" },
            { icon: Swords, label: "Type", value: "Physical" },
            { icon: Users, label: "Survivors", value: "0" },
            { icon: Activity, label: "Status", value: "Active" },
        ],
    },
    {
        name: "King of Diamonds",
        title: "The Supreme Intellect",
        description:
            "The King of Diamonds represents the pinnacle of logic and strategy. His games require precise calculation and unwavering focus. One slip in reasoning, one moment of doubt, and the game is lost.",
        imageUrl: "/borderland_cards/Diamonds_K.png",
        stats: [
            { icon: Skull, label: "Difficulty", value: "Hard" },
            { icon: Brain, label: "Type", value: "Logic" },
            { icon: Users, label: "Survivors", value: "2" },
            { icon: Activity, label: "Status", value: "Active" },
        ],
    },
    {
        name: "King of Clubs",
        title: "The Teamwork Tactician",
        description:
            "The King of Clubs demands cooperation and balance. His games cannot be won alone. You must build trust with strangers, but remember: in the Borderland, every alliance is fragile.",
        imageUrl: "/borderland_cards/Clubs_K.png",
        stats: [
            { icon: Skull, label: "Difficulty", value: "Very Hard" },
            { icon: Handshake, label: "Type", value: "Team" },
            { icon: Users, label: "Survivors", value: "5" },
            { icon: Activity, label: "Status", value: "Active" },
        ],
    },
    {
        name: "King of Hearts",
        title: "The Master of Betrayal",
        description:
            "The King of Hearts dominates the psychological realm. His games play with your emotions, turning friends into enemies. To survive here, you must be willing to sacrifice what you hold most dear.",
        imageUrl: "/borderland_cards/Hearts_K.png",
        stats: [
            { icon: Skull, label: "Difficulty", value: "Hope-less" },
            { icon: HeartCrack, label: "Type", value: "Psych" },
            { icon: Users, label: "Survivors", value: "1" },
            { icon: Activity, label: "Status", value: "Active" },
        ],
    },
];

export interface KingCarouselProps {
    className?: string;
}

export function KingCarousel({ className }: KingCarouselProps) {
    const [currentIndex, setCurrentIndex] = useState(0);

    const handleNext = () =>
        setCurrentIndex((index) => (index + 1) % kings.length);
    const handlePrevious = () =>
        setCurrentIndex(
            (index) => (index - 1 + kings.length) % kings.length
        );

    const currentKing = kings[currentIndex];

    return (
        <div className={cn("w-full max-w-6xl mx-auto px-4 py-12", className)}>
            {/* Desktop layout */}
            <div className='hidden md:flex relative items-center justify-center scale-90 md:scale-100 lg:scale-[0.85] origin-center'>

                {/* Card Image (Left) with 3D Tilt */}
                <motion.div
                    className='w-[340px] h-[500px] rounded-2xl overflow-hidden flex-shrink-0 relative z-0 border border-white/10 group'
                    whileHover={{ scale: 1.02 }}
                    onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const y = e.clientY - rect.top;
                        const centerX = rect.width / 2;
                        const centerY = rect.height / 2;

                        // Tilt
                        const rotateX = ((y - centerY) / 20) * -1;
                        const rotateY = (x - centerX) / 20;
                        e.currentTarget.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg)`;
                    }}
                    style={{ transition: 'transform 0.1s ease-out' }}
                >

                    {/* Glitch Layers (Red/Cyan Split) */}
                    <div className="absolute inset-0 z-20 opacity-0 group-hover:opacity-100 mix-blend-screen pointer-events-none hidden group-hover:block">
                        <img
                            src={currentKing.imageUrl}
                            className="absolute inset-0 w-full h-full object-cover text-[#ff0050] opacity-50 translate-x-[2px] animate-glitch"
                            style={{ filter: 'sepia(100%) saturate(300%) hue-rotate(-50deg)' }}
                            alt=""
                        />
                        <img
                            src={currentKing.imageUrl}
                            className="absolute inset-0 w-full h-full object-cover text-cyan-400 opacity-50 -translate-x-[2px] animate-glitch"
                            style={{ filter: 'sepia(100%) saturate(300%) hue-rotate(180deg)', animationDelay: '0.1s' }}
                            alt=""
                        />
                    </div>

                    <div className="absolute inset-0 bg-black/20 z-10"></div>
                    <AnimatePresence mode='wait'>
                        <motion.div
                            key={currentKing.imageUrl}
                            initial={{ opacity: 0, scale: 1.05 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className='w-full h-full'
                        >
                            <img
                                src={currentKing.imageUrl}
                                alt={currentKing.name}
                                className='w-full h-full object-cover'
                                loading="eager"
                            />
                        </motion.div>
                    </AnimatePresence>
                </motion.div>

                {/* Info Card (Right - Overlapping) */}
                <div className='bg-[#0f0f0f] border border-white/10 rounded-2xl shadow-[0_0_20px_rgba(0,0,0,0.5)] p-10 ml-[-40px] z-20 max-w-2xl flex-1 backdrop-blur-md bg-opacity-95'>
                    <AnimatePresence mode='wait'>
                        <motion.div
                            key={currentKing.name}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                        >
                            <div className='mb-6'>
                                <h2 className='text-3xl font-display text-white mb-2 uppercase tracking-widest'>
                                    {currentKing.name}
                                </h2>

                                <p className='text-sm font-mono text-[#ff0050] tracking-[0.2em] uppercase'>
                                    {currentKing.title}
                                </p>
                            </div>

                            <p className='text-gray-300 text-base leading-relaxed mb-8 font-light'>
                                {currentKing.description}
                            </p>

                            {/* Stats / Icons */}
                            <div className='flex space-x-5'>
                                {currentKing.stats.map(({ icon: IconComponent, label, value }) => (
                                    <div key={label} className="flex flex-col items-center gap-2 group">
                                        <div className='w-10 h-10 bg-white/5 border border-white/10 rounded-full flex items-center justify-center transition-colors group-hover:bg-[#ff0050] group-hover:border-[#ff0050] group-hover:text-white'>
                                            <IconComponent className='w-4 h-4 text-gray-400 group-hover:text-white transition-colors' />
                                        </div>
                                        <div className="text-center">
                                            <span className="block text-[8px] uppercase text-gray-500 tracking-wider mb-0.5">{label}</span>
                                            <span className="block text-[10px] font-bold text-white tracking-wide">{value}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>

            {/* Mobile layout */}
            <div className='md:hidden flex flex-col items-center relative'>

                {/* Image & Navigation Row */}
                <div className="flex items-center justify-between w-full px-2 mb-6 gap-2">
                    {/* Prev Button */}
                    <button
                        onClick={handlePrevious}
                        className='w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-[#ff0050] hover:border-[#ff0050] transition-colors cursor-pointer group flex-shrink-0'
                    >
                        <ChevronLeft className='w-5 h-5 text-gray-400 group-hover:text-white' />
                    </button>

                    {/* Card Image (Reduced Size) */}
                    <div className='w-[65%] aspect-[2/3] bg-black/50 rounded-2xl overflow-hidden border border-white/10 shadow-2xl relative'>
                        <AnimatePresence mode='wait'>
                            <motion.div
                                key={currentKing.imageUrl}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3 }}
                                className='w-full h-full'
                            >
                                <img
                                    src={currentKing.imageUrl}
                                    alt={currentKing.name}
                                    className='w-full h-full object-cover'
                                />
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Next Button */}
                    <button
                        onClick={handleNext}
                        className='w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-[#ff0050] hover:border-[#ff0050] transition-colors cursor-pointer group flex-shrink-0'
                    >
                        <ChevronRight className='w-5 h-5 text-gray-400 group-hover:text-white' />
                    </button>
                </div>

                {/* Info Content */}
                <div className='px-4 text-center'>
                    <AnimatePresence mode='wait'>
                        <motion.div
                            key={currentKing.name}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                        >
                            <h2 className='text-2xl font-display text-white mb-2 uppercase tracking-widest'>
                                {currentKing.name}
                            </h2>

                            <p className='text-xs font-mono text-[#ff0050] mb-4 tracking-[0.2em] uppercase'>
                                {currentKing.title}
                            </p>

                            <p className='text-gray-400 text-sm leading-relaxed mb-6 line-clamp-4'>
                                {currentKing.description}
                            </p>

                            <div className='flex justify-between items-start w-full gap-1 mt-4 px-0'>
                                {currentKing.stats.map(({ icon: IconComponent, label, value }) => (
                                    <div key={label} className="flex flex-col items-center gap-1 group flex-1 min-w-0">
                                        <div className='w-9 h-9 bg-white/5 border border-white/10 rounded-full flex items-center justify-center transition-colors group-hover:bg-[#ff0050] group-hover:border-[#ff0050]'>
                                            <IconComponent className='w-4 h-4 text-gray-400 group-hover:text-white' />
                                        </div>
                                        <div className="text-center w-full">
                                            <span className="block text-[7px] uppercase text-gray-500 tracking-wider truncate px-1">{label}</span>
                                            <span className="block text-[9px] font-bold text-white truncate px-1">{value}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>

            {/* Desktop Navigation (Hidden on Mobile) */}
            <div className='hidden md:flex justify-center items-center gap-6 mt-12'>
                <button
                    onClick={handlePrevious}
                    aria-label='Previous'
                    className='w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-[#ff0050] hover:border-[#ff0050] transition-colors cursor-pointer group'
                >
                    <ChevronLeft className='w-6 h-6 text-gray-400 group-hover:text-white' />
                </button>

                <div className='flex gap-2'>
                    {kings.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setCurrentIndex(index)}
                            className={cn(
                                "w-2 h-2 rounded-full transition-all cursor-pointer",
                                index === currentIndex
                                    ? "bg-[#ff0050] w-6"
                                    : "bg-gray-600 hover:bg-gray-400"
                            )}
                            aria-label={`Go to king ${index + 1}`}
                        />
                    ))}
                </div>

                <button
                    onClick={handleNext}
                    aria-label='Next'
                    className='w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-[#ff0050] hover:border-[#ff0050] transition-colors cursor-pointer group'
                >
                    <ChevronRight className='w-6 h-6 text-gray-400 group-hover:text-white' />
                </button>
            </div>
        </div>
    );
}
