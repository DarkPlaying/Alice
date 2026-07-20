import { useState, useEffect, useRef } from 'react';
import { User, Layers, HeartCrack, Clock, Play, Shield } from 'lucide-react';
import { motion, useScroll, useSpring, useTransform } from 'framer-motion';

const protocols = [
    {
        title: 'INITIALIZE (Register)',
        icon: User,
        desc: 'Authenticate player credentials and initialize your starting visa tracker.',
        textColor: 'text-blue-400',
        glowColor: 'shadow-[0_0_20px_rgba(59,130,246,0.3)]',
        activeBgGlow: 'bg-blue-500/5',
        cornerBg: 'bg-blue-500',
        activeBorder: 'border-blue-500/40',
        activeShadow: 'shadow-[0_0_15px_rgba(59,130,246,0.5)]',
        lineColor: '#3b82f6'
    },
    {
        title: 'SYNC (Lobby)',
        icon: Clock,
        desc: 'Join the active game waitlist under the real-time supervision of a Game Master.',
        textColor: 'text-purple-400',
        glowColor: 'shadow-[0_0_20px_rgba(168,85,247,0.3)]',
        activeBgGlow: 'bg-purple-500/5',
        cornerBg: 'bg-purple-500',
        activeBorder: 'border-purple-500/40',
        activeShadow: 'shadow-[0_0_15px_rgba(168,85,247,0.5)]',
        lineColor: '#a855f7'
    },
    {
        title: 'DRAW (Suit Select)',
        icon: Layers,
        desc: 'Choose your arena: Spades (Trick-Taking), Clubs (Angel & Demon), Diamonds (Zombies-Injections), or Hearts (Trust & Identity).',
        textColor: 'text-yellow-400',
        glowColor: 'shadow-[0_0_20px_rgba(245,158,11,0.3)]',
        activeBgGlow: 'bg-yellow-500/5',
        cornerBg: 'bg-yellow-500',
        activeBorder: 'border-yellow-500/40',
        activeShadow: 'shadow-[0_0_15px_rgba(245,158,11,0.5)]',
        lineColor: '#f59e0b'
    },
    {
        title: 'TRIAL (Game Arena)',
        icon: Play,
        desc: 'Participate in the game. Secure card tricks, vote on secret roles, deploy asset slots, or deduce player coordinates.',
        textColor: 'text-cyan-400',
        glowColor: 'shadow-[0_0_20px_rgba(34,211,238,0.3)]',
        activeBgGlow: 'bg-cyan-500/5',
        cornerBg: 'bg-cyan-400',
        activeBorder: 'border-cyan-500/40',
        activeShadow: 'shadow-[0_0_15px_rgba(34,211,238,0.5)]',
        lineColor: '#22d3ee'
    },
    {
        title: 'EXTEND (Visa Clear)',
        icon: Shield,
        desc: 'Clear the arena to renew your Visa days. Failing to clear results in instant laser termination.',
        textColor: 'text-rose-500',
        glowColor: 'shadow-[0_0_20px_rgba(244,63,94,0.4)]',
        activeBgGlow: 'bg-rose-500/5',
        cornerBg: 'bg-rose-500',
        activeBorder: 'border-rose-500/40',
        activeShadow: 'shadow-[0_0_15px_rgba(244,63,94,0.6)]',
        lineColor: '#f43f5e'
    }
];

export const SurvivalProtocol = () => {
    const [activeNode, setActiveNode] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);

    // Framer motion hooks for real-time scroll tracking
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start center", "end center"]
    });

    // Super smooth physics-based spring animation
    const scaleY = useSpring(scrollYProgress, {
        damping: 20,
        stiffness: 80,
        restDelta: 0.001
    });

    const lineHeightPercent = useTransform(scaleY, [0, 1], ["0%", "100%"]);

    useEffect(() => {
        const handleScroll = () => {
            if (!containerRef.current || nodeRefs.current.length === 0) return;
            const viewportCenter = window.innerHeight / 2;

            let closestIndex = 0;
            let closestDistance = Infinity;

            nodeRefs.current.forEach((node, i) => {
                if (!node) return;
                const nodeRect = node.getBoundingClientRect();
                const nodeCenter = nodeRect.top + nodeRect.height / 2;
                const distance = Math.abs(nodeCenter - viewportCenter);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestIndex = i;
                }
            });

            setActiveNode(closestIndex);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Active line dynamic coloring based on the currently active node
    const activeColor = protocols[activeNode]?.lineColor || '#ff0050';

    return (
        <section id="protocol" className="py-20 relative border-b border-white/5 overflow-hidden z-20">
            <div className="absolute inset-0 bg-home opacity-10 pointer-events-none mix-blend-overlay"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,0,80,0.05),transparent_70%)] pointer-events-none"></div>

            <div className="max-w-5xl mx-auto px-6 relative z-10">
                <div className="text-center mb-16">
                    <h2 className="text-2xl md:text-4xl font-display text-white uppercase tracking-tighter mb-2">
                        Survival <span className="text-[#ff0050]">Protocol</span>
                    </h2>
                    <p className="text-gray-500 font-mono text-[10px] tracking-[0.3em] uppercase">
                        Follow the roadmap or be eliminated
                    </p>
                </div>

                <div ref={containerRef} className="relative py-6">
                    {/* Static base line track */}
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/5 -translate-x-1/2 z-0"></div>
                    
                    {/* Scroll-following glowing active colored connection line synced with touch/active box color */}
                    <motion.div
                        className="absolute left-1/2 top-0 w-px -translate-x-1/2 origin-top transition-colors duration-500 z-0"
                        style={{
                            height: lineHeightPercent,
                            background: `linear-gradient(to bottom, ${activeColor}, ${activeColor})`,
                            boxShadow: `0 0 10px ${activeColor}, 0 0 25px ${activeColor}`
                        }}
                    />
                    
                    {/* Glowing laser dot/tip traveling with scroll line, color synced dynamically */}
                    <motion.div
                        className="absolute left-1/2 w-3 h-3 rounded-full -translate-x-1/2 -translate-y-1/2 z-0 transition-colors duration-500"
                        style={{
                            top: lineHeightPercent,
                            backgroundColor: activeColor,
                            boxShadow: `0 0 12px ${activeColor}, 0 0 20px ${activeColor}`
                        }}
                    >
                        {/* High intensity core pulsing */}
                        <div className="absolute inset-0.5 bg-white rounded-full animate-ping opacity-75" />
                        <div className="absolute inset-[2px] bg-white rounded-full" />
                    </motion.div>

                    <div className="space-y-16 relative z-10">
                        {protocols.map((item, i) => (
                            <div
                                key={item.title}
                                ref={(el) => { nodeRefs.current[i] = el; }}
                                className={`relative flex flex-col md:flex-row gap-6 md:gap-0 items-center md:items-center justify-between ${i % 2 === 1 ? 'md:flex-row-reverse' : ''}`}
                            >
                                {/* High-tech Protocol Dossier Card */}
                                <motion.div 
                                    className={`w-full md:w-[44%] px-4 md:px-6 ${i % 2 === 0 ? 'md:text-right md:pl-0 md:pr-6' : 'md:text-left md:pl-6 md:pr-0'} text-center order-2 md:order-none relative z-10`}
                                    initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true, margin: "-100px" }}
                                    transition={{ duration: 0.6, ease: "easeOut" }}
                                >
                                    <div 
                                        onClick={() => {
                                            nodeRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        }}
                                        className={`p-4 sm:p-5 rounded-lg border transition-all duration-500 bg-zinc-950 md:bg-black/40 backdrop-blur-md relative overflow-hidden group/card cursor-pointer hover:scale-[1.01] ${activeNode === i ? `border-white/20 ${item.glowColor} ${item.activeBgGlow}` : 'border-white/5 bg-zinc-950 md:bg-black/10 hover:border-white/10'}`}
                                    >
                                        
                                        {/* High-tech stylized corner brackets that light up when active */}
                                        <div className={`absolute top-0 right-0 w-6 h-[2px] transition-all duration-500 ${activeNode === i ? `${item.cornerBg} opacity-100 shadow-[0_0_8px_currentColor]` : 'bg-transparent opacity-0'}`} style={{ color: activeNode === i ? 'var(--color-brand)' : 'transparent' }} />
                                        <div className={`absolute top-0 right-0 h-6 w-[2px] transition-all duration-500 ${activeNode === i ? `${item.cornerBg} opacity-100 shadow-[0_0_8px_currentColor]` : 'bg-transparent opacity-0'}`} style={{ color: activeNode === i ? 'var(--color-brand)' : 'transparent' }} />
                                        <div className={`absolute bottom-0 left-0 w-6 h-[2px] transition-all duration-500 ${activeNode === i ? `${item.cornerBg} opacity-100 shadow-[0_0_8px_currentColor]` : 'bg-transparent opacity-0'}`} style={{ color: activeNode === i ? 'var(--color-brand)' : 'transparent' }} />
                                        <div className={`absolute bottom-0 left-0 h-6 w-[2px] transition-all duration-500 ${activeNode === i ? `${item.cornerBg} opacity-100 shadow-[0_0_8px_currentColor]` : 'bg-transparent opacity-0'}`} style={{ color: activeNode === i ? 'var(--color-brand)' : 'transparent' }} />

                                        <span className={`text-[10px] font-mono tracking-wider ${activeNode === i ? item.textColor : 'text-gray-600'} uppercase block mb-0.5`}>
                                            LEVEL 0{i + 1}
                                        </span>
                                        <h4 className={`text-lg font-display font-bold mb-2 tracking-widest ${activeNode === i ? 'text-white' : 'text-gray-400'} transition-colors duration-500`}>
                                            {item.title}
                                        </h4>
                                        <p className={`text-xs leading-relaxed font-mono transition-colors duration-500 ${activeNode === i ? 'text-gray-300' : 'text-gray-500'}`}>
                                            {item.desc}
                                        </p>
                                    </div>
                                </motion.div>

                                {/* Interactive Center Node */}
                                <motion.div
                                    className={`relative md:absolute md:left-1/2 md:-translate-x-1/2 md:top-1/2 md:-translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center z-20 cursor-pointer transition-all duration-500 shrink-0 order-1 md:order-none ${activeNode === i ? `bg-black border-2 ${item.activeBorder} ${item.activeShadow}` : 'bg-zinc-950 border border-white/10'}`}
                                    animate={{
                                        scale: activeNode === i ? 1.12 : 1,
                                    }}
                                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                    onClick={() => {
                                        nodeRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }}
                                >
                                    {/* Icon with active color sync */}
                                    <item.icon 
                                        size={15} 
                                        className={`transition-colors duration-500 ${activeNode === i ? item.textColor : 'text-gray-600'}`} 
                                    />

                                    {/* Rotating outer scanning ring */}
                                    {activeNode === i && (
                                        <motion.div
                                            className={`absolute -inset-1 rounded-full border border-dashed opacity-40 ${item.textColor}`}
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                                        />
                                    )}
                                </motion.div>

                                {/* Timeline Spacer */}
                                <div className="hidden md:block w-[44%]"></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};
