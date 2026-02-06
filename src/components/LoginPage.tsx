import { useState, useEffect, useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { User, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../firebase';

interface LoginPageProps {
    onLogin: () => void;
    onAdminLogin: () => void;
}

export const LoginPage = ({ onLogin, onAdminLogin }: LoginPageProps) => {
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | false>(false);
    const [isFocused, setIsFocused] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const controls = useAnimation();

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            // Use Client Coordinates (Viewport) to match getBoundingClientRect
            setMousePos({
                x: e.clientX,
                y: e.clientY,
            });
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);


    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            // 1. AUTHENTICATION (Firebase Auth)
            // Construct email if user entered a username
            const email = username.includes('@') ? username : `${username}@borderland.com`;

            await signInWithEmailAndPassword(auth, email, password);

            // 2. AUTHORIZATION (Firestore Data)
            // Fetch role from Firestore based on username
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("username", "==", username));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                // User authenticated but has no data profile
                setError("IDENTITY UNLINKED. CONTACT GAME MASTER.");
                shakeForm();
                return;
            }

            const userData = querySnapshot.docs[0].data();

            if (userData.role === 'master' || userData.role === 'admin' || userData.username === 'admin') {
                onAdminLogin();
            } else {
                onLogin();
            }
            setError(false);

        } catch (err: any) {
            console.error("Login Error:", err);

            if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                setError("ACCESS DENIED. INVALID CREDENTIALS.");
            } else if (err.code === 'auth/too-many-requests') {
                setError("SYSTEM LOCKOUT. TOO MANY FAILED ATTEMPTS.");
            } else if (err.code === 'permission-denied') {
                setError("DATABASE LOCKED. CHECK SECURITY PROTOCOLS.");
            } else {
                setError(`SYSTEM ERROR: ${err.code || 'UNKNOWN'}`);
            }
            shakeForm();
        }
    };

    const shakeForm = async () => {
        await controls.start({
            x: [-10, 10, -10, 10, 0],
            transition: { duration: 0.4 },
        });
    };

    // Calculate rotation for cards to face mouse
    const calculateRotation = (x: number, y: number) => {
        if (!containerRef.current) return 0;

        const isMobile = window.innerWidth < 768;
        const targetX = isMobile ? window.innerWidth / 2 : mousePos.x;
        const targetY = isMobile ? window.innerHeight / 2 : mousePos.y;

        const deltaX = targetX - x;
        const deltaY = targetY - y;
        const rad = Math.atan2(deltaY, deltaX);
        const deg = rad * (180 / Math.PI);
        return deg;
    };


    const [cardCenters, setCardCenters] = useState<{ x: number, y: number }[]>([]);
    const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

    useEffect(() => {
        const updateCenters = () => {
            const newCenters = cardRefs.current.map(ref => {
                if (ref) {
                    const rect = ref.getBoundingClientRect();
                    // Use the center of the bounding box (accurate for center-rotated elements)
                    return {
                        x: rect.left + rect.width / 2,
                        y: rect.top + rect.height / 2
                    };
                }
                return null;
            }).filter((c): c is { x: number, y: number } => c !== null);

            setCardCenters(newCenters);
        };

        // Update on mount, resize, and scroll
        updateCenters();
        window.addEventListener('resize', updateCenters);
        window.addEventListener('scroll', updateCenters);

        // ResizeObserver for container
        const resizeObserver = new ResizeObserver(() => {
            updateCenters();
        });

        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        // Periodic check for first few seconds to catch load/animation settling
        const interval = setInterval(updateCenters, 500);
        setTimeout(() => clearInterval(interval), 3000); // Stop after 3s

        return () => {
            window.removeEventListener('resize', updateCenters);
            window.removeEventListener('scroll', updateCenters);
            clearInterval(interval);
            resizeObserver.disconnect();
        };
    }, []);

    const cards = [
        { top: '5%', left: '5%', img: '/borderland_cards/Spades_K.png' },
        { top: '5%', right: '5%', img: '/borderland_cards/Hearts_K.png' },
        { bottom: '5%', left: '5%', img: '/borderland_cards/Clubs_K.png' },
        { bottom: '5%', right: '5%', img: '/borderland_cards/Diamonds_K.png' },
    ];

    return (
        <div
            ref={containerRef}
            className="relative min-h-screen bg-home overflow-hidden flex items-center justify-center p-4"
        >
            {/* Overlay to darken bg slightly */}
            <div className="absolute inset-0 bg-black/60 pointer-events-none" />

            {/* Floating Watcher Cards - Kings */}
            {cards.map((card, i) => {
                // Use precise measured center if available, otherwise fallback to approximation
                let centerX, centerY;

                if (cardCenters[i]) {
                    centerX = cardCenters[i].x;
                    centerY = cardCenters[i].y;
                } else {
                    // Fallback approximation
                    const isLeft = !!card.left;
                    const isTop = !!card.top;
                    centerX = isLeft ? (window.innerWidth * 0.1) + 64 : (window.innerWidth * 0.9) - 64;
                    centerY = isTop ? (window.innerHeight * 0.1) + 96 : (window.innerHeight * 0.9) - 96;
                }

                // (Distance calculation moved to laser layer)

                return (
                    <motion.div
                        key={i}
                        ref={(el) => { cardRefs.current[i] = el; }}
                        className="absolute z-10 w-20 h-32 md:w-32 md:h-48 rounded-lg shadow-[0_0_25px_rgba(0,0,0,0.5)]"
                        style={{
                            top: card.top,
                            bottom: card.bottom,
                            left: card.left,
                            right: card.right,
                            rotate: calculateRotation(centerX, centerY) + 90
                        }}
                    >
                        {/* Card Image Container - Breathing Scale Effect */}
                        <motion.div
                            className="w-full h-full relative"
                            animate={{
                                scale: [1, 1.02, 1],
                            }}
                            transition={{
                                duration: 2 + i,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                        >
                            {/* Laser Beam - Moves with card */}


                            {/* Card visual wrapper */}
                            <div className="w-full h-full relative overflow-hidden rounded-lg border-2 border-white/20">
                                <img
                                    src={card.img}
                                    alt="Watcher Card"
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/20" />
                            </div>

                            {/* Eyes/Dots follow the card */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-[#ff0050] rounded-full blur-sm opacity-80" />
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow-[0_0_10px_#ff0050]" />
                        </motion.div>
                    </motion.div>
                );
            })}

            {/* SEPARATE LASER LAYER - Z-Index below cards but above bg - HIDDEN ON MOBILE */}
            <div className="absolute inset-0 pointer-events-none z-20 hidden md:block">
                {cardCenters.map((center, i) => {
                    const isMobile = window.innerWidth < 768;
                    const targetX = isMobile ? window.innerWidth / 2 : mousePos.x;
                    const targetY = isMobile ? window.innerHeight / 2 : mousePos.y;
                    const dist = Math.sqrt(Math.pow(targetX - center.x, 2) + Math.pow(targetY - center.y, 2));


                    // Independent rotation calculation for laser
                    const angle = calculateRotation(center.x, center.y) + 90;

                    return (
                        <div
                            key={i}
                            className="absolute bg-[#ff0050] transition-opacity duration-300 origin-bottom"
                            style={{
                                width: '2px',
                                height: `${dist}px`,
                                left: center.x,
                                top: center.y - dist, // Pivot from bottom (center.y) is tricky with top/left positioning.
                                // BETTER: Position at center, pivot at bottom.
                                // If top is `center.y - dist`, then bottom of div is at `center.y`.
                                // Transform origin 'bottom center' works perfectly then.
                                transformOrigin: 'bottom center',
                                transform: `rotate(${angle}deg) translateX(-50%)`, // Center the line width - wait, translate X acts on rotated axis?
                                // Order matters: translate first? No, usually rotate then translate?
                                // If origin is bottom center, we just rotate. translateX(-50%) centers the 2px width.
                                opacity: isFocused ? 0 : 0.9,
                                boxShadow: '0 0 5px #ff0050, 0 0 10px rgba(255, 0, 80, 0.5)'
                            }}
                        />
                    );
                })}
            </div>

            {/* Login Container */}
            <motion.div
                animate={controls}
                className="relative z-30 w-full max-w-md p-8 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)]"
            >
                <div className="mb-8 text-center">
                    <h1 className="text-4xl font-display font-bold text-white mb-2 tracking-wider">
                        LOGIN
                    </h1>
                    <p className="text-gray-400 font-mono text-xs tracking-widest uppercase">
                        Identify Yourself, Player
                    </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    {/* Username Field */}
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-cyan-400 transition-colors">
                            <User size={20} />
                        </div>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            className={clsx(
                                "w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all duration-300 font-mono",
                                error && "border-red-500 text-red-100 placeholder-red-300 focus:border-red-500 focus:ring-red-500"
                            )}
                            placeholder="USERNAME"
                        />
                        {/* Field Scanline Animation (optional polish) */}
                        <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-cyan-400 group-focus-within:w-full transition-all duration-500" />
                    </div>

                    {/* Password Field */}
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-cyan-400 transition-colors">
                            <Lock size={20} />
                        </div>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            className={clsx(
                                "w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all duration-300 font-mono",
                                error && "border-red-500 text-red-100 placeholder-red-300 focus:border-red-500 focus:ring-red-500"
                            )}
                            placeholder="PASSWORD"
                        />
                        <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-cyan-400 group-focus-within:w-full transition-all duration-500" />
                    </div>

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center gap-2 text-red-400 text-sm font-mono"
                        >
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </motion.div>
                    )}

                    {/* Login Button */}
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full relative overflow-hidden group bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-display font-bold py-3 px-6 rounded-lg uppercase tracking-widest shadow-lg transition-all duration-300"
                    >
                        <span className="relative z-10 flex items-center justify-center gap-2">
                            Enter The Borderland <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                        </span>
                        {/* Shine effect */}
                        <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12" />
                    </motion.button>
                </form>
            </motion.div>
        </div>
    );
};
