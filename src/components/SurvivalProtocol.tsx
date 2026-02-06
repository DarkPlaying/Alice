import { User, Layers, HeartCrack } from 'lucide-react';
import { motion } from 'framer-motion';

const protocols = [
    {
        title: 'INITIALIZE',
        icon: User,
        desc: 'Connect to the Borderland. You receive a random player ID and a starting visa. Your real name is erased from the arena.',
        color: 'text-blue-500',
        border: 'group-hover:border-blue-500/50'
    },
    {
        title: 'DRAW',
        icon: Layers,
        desc: 'The system draws a suit and number. That card decides your next game: Hearts for betrayal, Diamonds for logic, Clubs for teamwork, Spades for survival.',
        color: 'text-yellow-500',
        border: 'group-hover:border-yellow-500/50'
    },
    {
        title: 'SURVIVE',
        icon: HeartCrack,
        desc: 'Enter the arena, follow the rules, and outplay the others. Clear the game to extend your visa. Fail, and your run in the Borderland ends.',
        color: 'text-[#ff0050]',
        border: 'group-hover:border-[#ff0050]/50'
    }
];

export const SurvivalProtocol = () => {
    return (
        <section id="protocol" className="py-32 relative border-b border-white/5 overflow-hidden z-20">
            {/* Background elements */}
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

                <div className="relative">
                    {/* Central Line */}
                    <div className="absolute left-[20px] md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[#ff0050]/50 to-transparent"></div>

                    <div className="space-y-24">
                        {protocols.map((item, i) => (
                            <motion.div
                                key={item.title}
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
                                <div className="absolute left-[4px] md:left-1/2 -translate-x-1/2 w-10 h-10 bg-black border border-[#ff0050] rounded-full flex items-center justify-center z-20 shadow-[0_0_20px_rgba(255,0,80,0.5)]">
                                    <item.icon size={16} className="text-white" />
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
