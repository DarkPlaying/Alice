import { motion } from 'framer-motion';
import { useMemo } from 'react';

// Generate the list of all card files based on the file listing
const suits = ['Clubs', 'Diamonds', 'Hearts', 'Spades'];
const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const allCards = suits.flatMap(suit => values.map(value => `${suit}_${value}.png`));

interface FadingCardProps {
    card: string;
    index: number;
    config: {
        baseRotation: number;
        opacityClass: string;
        animateRotate: number[];
        animateY: number[];
        durationY: number;
        durationRotate: number;
    };
}

const FadingCard = ({ card, config }: FadingCardProps) => {
    return (
        <motion.div
            className="will-change-transform"
            initial={{
                opacity: 0,
                rotate: config.baseRotation,
                y: 50 // Start slightly lower for "slide up" effect
            }}
            whileInView={{
                opacity: 1,
                rotate: config.animateRotate, // Breathing rotation
                y: config.animateY // Breathing float
            }}
            viewport={{ margin: "100px" }} // Trigger before it enters screen
            transition={{
                opacity: { duration: 0.8, ease: "easeOut" },
                y: {
                    duration: config.durationY,
                    repeat: Infinity,
                    ease: "easeInOut",
                    // The first value of animateY determines start, but we want a smooth entry.
                    // Actually, breathing y usually goes [0, -20, 0].
                    // Mixing 'slide up' (50 -> 0) and 'breathing' is tricky in one prop.
                    // Let's simplify: Just fade in. The breathing starts immediately.
                },
                rotate: {
                    duration: config.durationRotate,
                    repeat: Infinity,
                    ease: "easeInOut"
                }
            }}
        >
            <img
                loading="lazy"
                src={`/borderland_cards/${card}`}
                alt="card"
                className={`w-full ${config.opacityClass}`}
            />
        </motion.div>
    );
};

export const FloatingCards = () => {
    // Generate the list of all card files based on the file listing
    // shuffling logic...
    const shuffledCards = useMemo(() => {
        return [...allCards].sort(() => 0.5 - Math.random());
    }, []);

    // Use 3 sets (18 cards per column) to fill a long page (~5000px with gap-32)
    const cardsLeftMain = [...shuffledCards.slice(0, 6), ...shuffledCards.slice(0, 6), ...shuffledCards.slice(0, 6)];
    const cardsLeftInner = [...shuffledCards.slice(6, 12), ...shuffledCards.slice(6, 12), ...shuffledCards.slice(6, 12)];
    const cardsRightInner = [...shuffledCards.slice(12, 18), ...shuffledCards.slice(12, 18), ...shuffledCards.slice(12, 18)];
    const cardsRightMain = [...shuffledCards.slice(18, 24), ...shuffledCards.slice(18, 24), ...shuffledCards.slice(18, 24)];

    // Configurations for each column type
    const configLeftMain = {
        baseRotation: 12,
        opacityClass: "opacity-60 md:opacity-40",
        animateRotate: [12, 15, 9, 12],
        animateY: [0, -15, 0],
        durationY: 8,
        durationRotate: 10
    };

    const configLeftInner = {
        baseRotation: -6,
        opacityClass: "opacity-40 md:opacity-30",
        animateRotate: [-6, -3, -9, -6],
        animateY: [0, -20, 0],
        durationY: 9,
        durationRotate: 11
    };

    const configRightInner = {
        baseRotation: 6,
        opacityClass: "opacity-40 md:opacity-30",
        animateRotate: [6, 9, 3, 6],
        animateY: [0, -20, 0],
        durationY: 9,
        durationRotate: 11
    };

    const configRightMain = {
        baseRotation: -12,
        opacityClass: "opacity-60 md:opacity-40",
        animateRotate: [-12, -15, -9, -12],
        animateY: [0, -15, 0],
        durationY: 8,
        durationRotate: 10
    };

    return (
        <div className="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-hidden">
            {/* --- LEFT SIDE --- */}
            <div className="absolute top-0 left-0 md:left-6 w-24 md:w-48 h-full">
                {/* Left Main */}
                <div className="absolute left-0 top-0 w-10 md:w-20 flex flex-col gap-32 md:gap-40 pb-40">
                    {cardsLeftMain.map((card, i) => (
                        <div key={`lm-${i}`} className={i % 2 === 0 ? 'block' : 'hidden md:block'}>
                            <FadingCard
                                card={card}
                                index={i}
                                config={configLeftMain}
                            />
                        </div>
                    ))}
                </div>

                {/* Left Inner */}
                <div className="absolute left-12 md:left-24 top-24 w-12 md:w-24 hidden md:flex flex-col gap-32 md:gap-40 pb-40">
                    {cardsLeftInner.map((card, i) => (
                        <FadingCard
                            key={`li-${i}`}
                            card={card}
                            index={i}
                            config={configLeftInner}
                        />
                    ))}
                </div>
            </div>

            {/* --- RIGHT SIDE --- */}
            <div className="absolute top-0 right-0 md:right-6 w-24 md:w-48 h-full">
                {/* Right Inner */}
                <div className="absolute right-12 md:right-24 top-24 w-12 md:w-24 hidden md:flex flex-col gap-32 md:gap-40 pb-40">
                    {cardsRightInner.map((card, i) => (
                        <FadingCard
                            key={`ri-${i}`}
                            card={card}
                            index={i}
                            config={configRightInner}
                        />
                    ))}
                </div>

                {/* Right Main */}
                <div className="absolute right-0 top-0 w-10 md:w-20 flex flex-col gap-32 md:gap-40 pb-40">
                    {cardsRightMain.map((card, i) => (
                        <div key={`rm-${i}`} className={i % 2 !== 0 ? 'block' : 'hidden md:block'}>
                            <FadingCard
                                card={card}
                                index={i}
                                config={configRightMain}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
