import { useState, useEffect, useRef } from 'react';
import { User, Layers, HeartCrack, Clock, Play, Shield } from 'lucide-react';
import { motion } from 'framer-motion';

const protocols = [
    {
        title: 'INITIALIZE (Register)',
        icon: User,
        desc: 'Authenticate player credentials and initialize your starting visa tracker.',
        color: 'text-blue-500',
        border: 'group-hover:border-blue-500/50'
    },
    {
        title: 'SYNC (Lobby)',
        icon: Clock,
        desc: 'Join the active game waitlist under the real-time supervision of a Game Master.',
        color: 'text-purple-500',
        border: 'group-hover:border-purple-500/50'
    },
    {
        title: 'DRAW (Suit Select)',
        icon: Layers,
        desc: 'Choose your arena: Spades (Trick-Taking), Clubs (Angel & Demon), Diamonds (Zombies-Injections), or Hearts (Trust & Identity).',
        color: 'text-yellow-500',
        border: 'group-hover:border-yellow-500/50'
    },
    {
        title: 'TRIAL (Game Arena)',
        icon: Play,
        desc: 'Participate in the game. Secure card tricks, vote on secret roles, deploy asset slots, or deduce player coordinates.',
        color: 'text-cyan-400',
        border: 'group-hover:border-cyan-400/50'
    },
    {
        title: 'EXTEND (Visa Clear)',
        icon: Shield,
        desc: 'Clear the arena to renew your Visa days. Failing to clear results in instant laser termination.',
        color: 'text-[#ff0050]',
        border: 'group-hover:border-[#ff0050]/50'
    }
];

export const SurvivalProtocol = () => {
    const [activeNode, setActiveNode] = useState(0);
    const [lineHeight, setLineHeight] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);

    useEffect(() => {
        const handleScroll = () => {
            if (!containerRef.current || nodeRefs.current.length === 0) return;
            const containerRect = containerRef.current.getBoundingClientRect();
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

            const activeNodeEl = nodeRefs.current[closestIndex];
            if (activeNodeEl) {
                const nodeRect = activeNodeEl.getBoundingClientRect();
                const nodeCenterInContainer = nodeRect.top + nodeRect.height / 2 - containerRect.top;
                const containerHeight = containerRect.height;
                const pct = Math.min(100, Math.max(0, (nodeCenterInContainer / containerHeight) * 100));
                setLineHeight(pct);
            }
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <section id="protocol" className="py-32 relative border-b border-white/5 overflow-hidden z-20">
            <div className="absolute inset-0 bg-home opacity-10 pointer-events-none mix-blend-overlay"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,0,80,0.05),transparent_70%)] pointer-events-none"></div>

            <div className="max-w-6xl mx-auto px-6 relative z-10">
                <div className="text-center mb-24">
                    <h2 className="text-3xl md:text-5xl font-display text-white uppercase tracking-tighter mb-4">
                        Survival <span className="text-[#ff0050]">Protocol</span>
                    </h2>
                    <p className="text-gray-500 font-mono text-xs tracking-[0.3em] uppercase">
                        Follow the roadmap or be eliminated
                    </p>
                </div>

                <div ref={containerRef} className="relative">
                    {/* Static base line */}
                    <div className="absolute left-[20px] md:left-1/2 top-0 bottom-0 w-px bg-white/10 -translate-x-1/2"></div>
                    {/* Scroll-following red line */}
                    <div
                        className="absolute left-1/2 top-0 w-px bg-[#ff0050] shadow-[0_0_8px_#ff0050,0_0_20px_#ff0050] -translate-x-1/2"
                        style={{
                            height: `${lineHeight}%`,
                            transition: 'height 0.4s cubic-bezier(0.25, 0.1, 0.25, 1)',
                        }}
                    />
                    {/* Glowing dot at the tip */}
                    <div
                        className="absolute left-1/2 w-3 h-3 bg-[#ff0050] rounded-full shadow-[0_0_12px_#ff0050,0_0_24px_#ff0050] -translate-x-1/2 z-10"
                        style={{
                            top: `${lineHeight}%`,
                            transition: 'top 0.4s cubic-bezier(0.25, 0.1, 0.25, 1)',
                        }}
                    />

                    <div className="space-y-24">
                        {protocols.map((item, i) => (
                            <motion.div
                                key={item.title}
                                ref={(el) => { nodeRefs.current[i] = el; }}
                                initial={{ opacity: 0, y: 50 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-100px" }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                                className={`relative flex flex-col md:flex-row gap-8 md:gap-0 items-start md:items-center justify-between ${i % 2 === 1 ? 'md:flex-row-reverse' : ''}`}
                            >
                                {/* Content Box */}
                                <div className={`w-full md:w-[45%] pl-16 md:pl-0 ${i % 2 === 0 ? 'md:text-right' : 'md:text-left'} md:px-12`}>
                                    <h3 className="text-3xl font-display text-white mb-2 tracking-wider">LEVEL 0{i + 1}</h3>
                                    <h4 className={`text-xl font-bold mb-4 ${item.color} tracking-widest`}>{item.title}</h4>
                                    <p className="text-gray-400 text-sm leading-relaxed font-mono">{item.desc}</p>
                                </div>

                                {/* Center Node */}
                                <div className={`absolute left-[4px] md:left-1/2 -translate-x-1/2 w-10 h-10 bg-black border rounded-full flex items-center justify-center z-20 transition-all duration-500 ${activeNode === i ? 'border-[#ff0050] shadow-[0_0_20px_#ff0050,0_0_40px_#ff0050] scale-125' : 'border-[#ff0050]/30 shadow-[0_0_10px_rgba(255,0,80,0.2)]'}`}>
                                    <item.icon size={16} className={`transition-colors duration-500 ${activeNode === i ? 'text-[#ff0050]' : 'text-white/60'}`} />
                                </div>

                                {/* Spacer for Timeline Balance */}
                                <div className="hidden md:block w-[45%]"></div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};
