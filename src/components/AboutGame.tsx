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
                    className="relative max-w-sm mx-auto"
                >
                    <div className="absolute inset-0 bg-[#ff0050]/20 blur-2xl -z-10 rounded-full opacity-60"></div>
                    <motion.img
                        src="/about-image.png"
                        alt="About The Game"
                        initial={{ filter: "grayscale(100%)" }}
                        whileInView={{ filter: "grayscale(0%)" }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.5, ease: "easeInOut" }}
                        className="w-full h-auto rounded-lg shadow-2xl border border-white/10 object-cover aspect-[3/4]"
                    />
                    {/* Decorative Elements */}
                    <div className="absolute -bottom-6 -right-6 w-24 h-24 border-b-2 border-r-2 border-[#ff0050] opacity-50"></div>
                    <div className="absolute -top-6 -left-6 w-24 h-24 border-t-2 border-l-2 border-[#ff0050] opacity-50"></div>
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
                        WELCOME PLAYERS
                    </h3>

                    <h2 className="text-6xl md:text-8xl font-display text-[#ff0050] mb-6 tracking-tighter leading-none relative group w-fit">
                        <span className="relative z-10">HOLD</span>
                        <br />
                        <span className="text-white text-4xl md:text-6xl tracking-normal relative z-10">THE CARD</span>

                        {/* Glitch Shadow for Title */}
                        <span className="absolute top-0 left-0 text-[#00ffff] opacity-0 group-hover:opacity-60 animate-glitch blur-[1px] mix-blend-screen -z-10 translate-x-1">HOLD</span>
                    </h2>

                    <div className="space-y-6 text-gray-400 font-mono text-sm md:text-base leading-relaxed max-w-md">
                        <p>
                            Begin the game. <span className="text-white">Accept it</span> or <span className="text-white">walk away</span>.
                        </p>
                        <p className="opacity-70">
                            The moment you take the card, your fate is sealed. The suits will determine your challenge.
                        </p>
                    </div>

                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="group relative mt-10 px-10 py-3 bg-[#ff0050] text-white font-display text-sm tracking-[0.2em] hover:bg-[#ff0050]/80 transition-all uppercase rounded-full shadow-[0_0_20px_rgba(255,0,80,0.5)] overflow-hidden"
                    >
                        <span className="relative z-10">ACCEPT</span>
                        {/* Removed Scan Effect */}
                    </motion.button>
                </motion.div>
            </div>
        </section>
    );
};
