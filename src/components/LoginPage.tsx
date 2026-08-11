import { useState, useEffect, useRef } from 'react';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import { User, Lock, ArrowRight, AlertCircle, ShieldAlert, Play, X } from 'lucide-react';
import clsx from 'clsx';
import { supabase, supabaseUrl, supabaseKey } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

interface LoginPageProps {
    onLogin: (user?: any) => void;
    onAdminLogin: (user?: any) => void;
}

export const LoginPage = ({ onLogin, onAdminLogin }: LoginPageProps) => {
    const navigate = useNavigate();
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const isRegistering = false;
    const [error, setError] = useState<string | false>(false);
    const [isFocused, setIsFocused] = useState(false);
    const [showDemoModal, setShowDemoModal] = useState(false);
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


    useEffect(() => {
        const storedError = sessionStorage.getItem('login_error_msg');
        if (storedError) {
            sessionStorage.removeItem('login_error_msg');
            setError(storedError);
            setTimeout(() => {
                shakeForm();
            }, 200);
        }
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(false);

        try {
            if (username === 'demo' && password === 'demo') {
                const demoUser = {
                    id: 'demo-user',
                    username: 'demo',
                    role: 'demo',
                    uid: 'demo-user',
                    email: 'demo@borderland.com'
                };
                localStorage.setItem('demo-user-session', JSON.stringify(demoUser));
                if (onLogin) onLogin(demoUser);
                return;
            }

            const sanitizedUsername = username.trim().toLowerCase().replace(/\s+/g, '');
            let email = sanitizedUsername;

            if (!email.includes('@')) {
                const { data: profile } = await supabase.from('profiles').select('email').eq('username', sanitizedUsername).single();
                if (profile && profile.email) {
                    email = profile.email;
                } else {
                    email = `${sanitizedUsername}@borderland.app`;
                }
            }

            console.log("Login attempt for:", email);

            if (isRegistering) {
                const { data, error: authError } = await supabase.auth.signUp({ email, password });
                if (authError) throw authError;

                // Ensure profile is correctly initialized if they didn't exist
                const { data: upsertData, error: profileError } = await supabase.from('profiles').upsert({
                    email,
                    username,
                    role: 'player'
                }, { onConflict: 'email' }).select().single();
                if (profileError) throw profileError;

                const finalUser = { ...upsertData, uid: data?.user?.id, email: email, id: data?.user?.id };
                onLogin(finalUser);
                return;
            }

            const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
            if (authError) throw authError;

            // Fetch profile
            const { data: userData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('email', email)
                .single();

            if (profileError || !userData) {
                const unlinkedMsg = "IDENTITY UNLINKED. CONTACT GAME MASTER.";
                sessionStorage.setItem('login_error_msg', unlinkedMsg);
                window.location.reload();
                return;
            }

            const finalUser = { ...userData, uid: data?.user?.id, email: email, id: data?.user?.id };

            // 1. Log the entry in the system_logs table (Persistence)
            const syncLoginLog = async () => {
                try {
                    // Delete previous login logs for this player to keep only the latest
                    await supabase.from('system_logs')
                        .delete()
                        .eq('player_id', data?.user?.id)
                        .eq('type', 'login');

                    // Insert the new login log
                    await supabase.from('system_logs').insert({
                        message: `Player "${userData.username}" logged in to Arena LOBBY`,
                        type: 'login',
                        player_id: data?.user?.id,
                        username: userData.username,
                        created_at: new Date().toISOString()
                    });
                } catch (err) {
                    console.warn("Login log sync failed:", err);
                }
            };
            syncLoginLog();

            // 2. Broadcast the signal immediately (Instant Real-time)
            supabase.channel('admin_signals').subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    supabase.channel('admin_signals').send({
                        type: 'broadcast',
                        event: 'player_entry',
                        payload: { message: `Player "${userData.username}" logged in to Arena LOBBY` }
                    });
                }
            });

            if (userData.role === 'admin' || userData.username === 'admin') {
                onAdminLogin(finalUser);
            } else {
                onLogin(finalUser);
            }
        } catch (err: any) {
            console.error("Login Error:", err);

            let errorMsg = `SYSTEM ERROR: ${err.message || ''}`;
            const msg = err.message || '';
            if (msg.includes('Invalid login credentials')) {
                errorMsg = "ACCESS DENIED. INVALID CREDENTIALS.";
            } else if (msg.includes('User already registered')) {
                errorMsg = "IDENTITY ALREADY REGISTERED.";
            }

            sessionStorage.setItem('login_error_msg', errorMsg);
            window.location.reload();
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
            className="relative min-h-screen overflow-hidden flex items-center justify-center p-4"
            style={{ backgroundImage: "url('/hero-bg.webp')", backgroundSize: "cover", backgroundPosition: "center" }}
        >
            {/* Overlay to darken bg slightly */}
            <div className="absolute inset-0 bg-black/60 pointer-events-none" />

            {/* Top Left Navigation Section */}
            <div className="fixed top-4 left-4 sm:top-6 sm:left-6 z-50 flex items-center gap-4">
                <button
                    onClick={() => navigate('/home')}
                    className="flex items-center gap-2 bg-black hover:bg-black-500/20 border border-red-500/30 text-red-400 hover:text-red-300 px-4 py-1.5 rounded-full text-[12px] font-mono tracking-widest uppercase transition-all group cursor-pointer"
                >
                    <span className="group-hover:-translate-x-1 transition-transform">←</span>
                    Go Back
                </button>
            </div>

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
                className="relative z-30 w-full max-w-md p-8 bg-[#0a0a0f] md:bg-black/800 md:backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)]"
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
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-red-400 transition-colors">
                            <User size={20} />
                        </div>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            className={clsx(
                                "w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-white-400 focus:ring-1 focus:ring-white-400 transition-all duration-300 font-mono",
                                error && "border-white-500 text-red-100 placeholder-red-300 focus:border-white-500 focus:ring-white-500"
                            )}
                            placeholder="USERNAME"
                        />
                        {/* Field Scanline Animation (optional polish) */}
                        <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-white-400 group-focus-within:w-full transition-all duration-500" />
                    </div>

                    {/* Password Field */}
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-red-400 transition-colors">
                            <Lock size={20} />
                        </div>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            className={clsx(
                                "w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-white-400 focus:ring-1 focus:ring-white-400 transition-all duration-300 font-mono",
                                error && "border-red-500 text-red-100 placeholder-red-300 focus:border-white-500 focus:ring-white-500"
                            )}
                            placeholder="PASSWORD"
                        />
                        <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-white-400 group-focus-within:w-full transition-all duration-500" />
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

                    {/* Submit Button */}
                    <motion.button
                        type="submit"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full relative overflow-hidden group bg-gradient-to-r from-red to-red-500 hover:from-red-500 hover:to-red-500 text-white font-display font-bold py-3 px-6 rounded-lg uppercase tracking-widest shadow-lg transition-all duration-300"
                    >
                        <span className="relative z-10 flex items-center justify-center gap-2">
                            Enter The Borderland <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                        </span>
                        {/* Shine effect */}
                        <div className="absolute inset-0 bg-white/20 translate-x-[-120%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12" />
                    </motion.button>

                    {/* Demo Simulation Access Button */}
                    <div className="flex items-center justify-center pt-2">
                        <button
                            type="button"
                            onClick={() => setShowDemoModal(true)}
                            className="w-full text-xs text-yellow-500 hover:text-yellow-400 font-mono tracking-wider uppercase border border-yellow-500/30 hover:border-yellow-500/60 bg-yellow-500/5 px-4 py-3 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <ShieldAlert size={14} className="animate-pulse" />
                            DEMO SIMULATION ACCESS
                        </button>
                    </div>

                    <div className="text-center mt-4">
                        <p className="text-gray-500 font-mono text-[10px] tracking-wider uppercase select-none">
                            Identity registration locked. Contact a System Architect for credentials.
                        </p>
                    </div>
                </form>
            </motion.div>

            {/* Demo Credentials Overlay */}
            <AnimatePresence>
                {showDemoModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
                        onClick={() => setShowDemoModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-[#0c0c12] border border-yellow-500/30 p-6 rounded-2xl max-w-sm w-full shadow-2xl relative"
                            onClick={e => e.stopPropagation()}
                        >
                            <button
                                onClick={() => setShowDemoModal(false)}
                                className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>

                            <div className="flex flex-col items-center text-center space-y-4">
                                <div className="w-12 h-12 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-yellow-500">
                                    <ShieldAlert size={24} className="animate-pulse" />
                                </div>

                                <div className="space-y-1">
                                    <h3 className="text-lg font-oswald font-black text-yellow-500 uppercase tracking-wider">
                                        DEMO SIMULATION ACTIVE
                                    </h3>
                                    <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
                                        System Credentials Provided Below
                                    </p>
                                </div>

                                <div className="w-full bg-white/5 border border-white/10 rounded-xl p-4 space-y-2 text-left font-mono text-xs">
                                    <div className="flex justify-between items-center">
                                        <span className="text-white/40 uppercase">Username:</span>
                                        <span className="text-yellow-400 font-bold">demo</span>
                                    </div>
                                    <div className="flex justify-between items-center border-t border-white/5 pt-2">
                                        <span className="text-white/40 uppercase">Password:</span>
                                        <span className="text-yellow-400 font-bold">demo</span>
                                    </div>
                                </div>

                                <button
                                    onClick={async () => {
                                        setUsername('demo');
                                        setPassword('demo');
                                        setShowDemoModal(false);
                                        // Trigger auto login simulation directly
                                        const demoUser = {
                                            id: 'demo-user',
                                            username: 'demo',
                                            role: 'demo',
                                            uid: 'demo-user',
                                            email: 'demo@borderland.com'
                                        };
                                        localStorage.setItem('demo-user-session', JSON.stringify(demoUser));
                                        if (onLogin) onLogin(demoUser);
                                    }}
                                    className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 text-black font-bold uppercase tracking-widest rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <Play size={14} className="fill-current" />
                                    Auto-fill &amp; Enter
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
