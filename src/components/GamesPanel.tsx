import { motion } from 'framer-motion';
import { KingCarousel } from './KingCarousel';

export const GamesPanel = () => {
    return (
        <section id="games" className="py-24 bg-black relative border-b border-white/5">
            <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>

            <div className="max-w-7xl mx-auto px-6 relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-16"
                >
                    <h2 className="text-3xl md:text-5xl font-display text-white uppercase tracking-tighter mb-4">
                        Card Games
                    </h2>
                    <p className="text-gray-500 font-mono text-xs tracking-[0.3em] uppercase">
                        Every suit is a different way to die
                    </p>
                </motion.div>

                <div className="mt-8">
                    <KingCarousel />
                </div>
            </div>
        </section>
    );
};
