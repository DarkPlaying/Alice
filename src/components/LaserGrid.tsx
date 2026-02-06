import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const LaserGrid = () => {
    const [lasers, setLasers] = useState<number[]>([]);

    useEffect(() => {
        // Reduced laser count for performance
        setLasers(Array.from({ length: 6 }, (_, i) => i));
    }, []);

    return (
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none perspective-[1000px] will-change-transform translate-z-0">
            {/* Fog/Atmosphere */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#000_100%)] opacity-80 z-10"></div>

            {/* Horizontal Lasers */}
            {lasers.map((i) => (
                <motion.div
                    key={`h-${i}`}
                    className="absolute h-[1px] bg-[#ff0050] opacity-30 w-full left-0 will-change-transform"
                    style={{ top: `${(i * 15) + 10}%` }} // Fixed top position
                    initial={{ scaleX: 0.8, opacity: 0 }}
                    animate={{
                        opacity: [0, 0.4, 0],
                        scaleX: [0.8, 1.2, 0.8], // Animate Scale instead of Layout properties
                    }}
                    transition={{
                        duration: 3 + Math.random() * 2,
                        repeat: Infinity,
                        ease: "linear",
                        delay: Math.random() * 2
                    }}
                />
            ))}

            {/* Vertical Scanning Lasers */}
            {lasers.map((i) => (
                <motion.div
                    key={`v-${i}`}
                    className="absolute w-[1px] bg-[#ff0050] h-[150%] top-[-25%] will-change-transform"
                    style={{ left: `${(i * 18) + 5}%`, rotate: '15deg' }} // Fixed left position
                    initial={{ opacity: 0, y: '-10%' }}
                    animate={{
                        y: ['0%', '20%'], // Small Y movement instead of Left movement
                        opacity: [0, 0.6, 0]
                    }}
                    transition={{
                        duration: 4 + Math.random() * 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: i * 0.5
                    }}
                />
            ))}

            {/* Optimized Sniper Dots */}
            {lasers.slice(0, 3).map((i) => (
                <motion.div
                    key={`dot-${i}`}
                    className="absolute w-1 h-1 bg-white rounded-full shadow-[0_0_8px_#ff0050] will-change-transform"
                    animate={{
                        opacity: [0, 1, 0]
                    }}
                    style={{
                        top: `${Math.random() * 100}%`,
                        left: `${Math.random() * 100}%`
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        repeatType: "reverse",
                        delay: Math.random()
                    }}
                />
            ))}
        </div>
    );
};

export default LaserGrid;
