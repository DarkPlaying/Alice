import { useState, useEffect, useRef } from 'react';
import { X, Sword, Heart, Users, Brain, AlertTriangle, ArrowRight } from 'lucide-react';

import { motion, AnimatePresence } from 'framer-motion';
import { SpadesGame } from './games/SpadesGame';

import { HeartsGame } from './games/HeartsGame';
import { HeartsGameMaster } from './games/HeartsGameMaster';
import { ClubsGame } from './games/ClubsGame';
import { ClubsGameMaster } from './games/ClubsGameMaster';
import { DiamondsGame } from './games/DiamondsGame';
import { GlowCard } from './ui/spotlight-card';
import { PlayerCardModal } from './PlayerCardModal';
import { supabase } from '../supabaseClient';
import { auth, db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

interface GameContainerProps {
    type: string;
    onClose: () => void;
    isLoggedIn?: boolean;
    onLogoutClick?: () => void;
    userInfo?: any;
}

export const GameContainer = ({ type, onClose, isLoggedIn, onLogoutClick, userInfo }: GameContainerProps) => {
    const [status, setStatus] = useState<'idle' | 'cleared' | 'failed'>('idle');
    const [showRules, setShowRules] = useState(true);
    const [waitingForGM, setWaitingForGM] = useState(true);
    const [localSystemStart, setLocalSystemStart] = useState(false);
    const [localAllowedPlayers, setLocalAllowedPlayers] = useState<string[]>([]);
    const [isPaused, setIsPaused] = useState(false);
    const [showPlayerCard, setShowPlayerCard] = useState(false);
    const isMasterRole = userInfo?.role === 'master' || userInfo?.role === 'admin' || userInfo?.username === 'admin' || userInfo?.username === 'SANJAY';
    const [kickedUser, setKickedUser] = useState(false);

    useEffect(() => {
        console.log("GAMECONTAINER MOUNTED. UserInfo:", userInfo);
        console.log("GAMECONTAINER ROLE CHECK:", {
            isMasterRole,
            username: userInfo?.username,
            role: userInfo?.role,
            gameType: type
        });
    }, [userInfo, isMasterRole, type]);


    // Forcefully eject non-logged-in players to login screen
    useEffect(() => {
        if (!isLoggedIn) {
            const timer = setTimeout(() => {
                if (!isLoggedIn) {
                    console.warn('[SECURITY] Non-authenticated access attempt. Redirecting...');
                    onClose();
                }
            }, 800); // Grace period for auth state
            return () => clearTimeout(timer);
        }
    }, [isLoggedIn, onClose]);

    // Unified monitor for system_start, allowed_players, and is_paused
    // (Consolidated into the effect starting at line 115)

    // ALL GAMES: Listen for System Start via Supabase (Primary)
    useEffect(() => {
        const suitIdMap: Record<string, string> = {
            'Clubs': 'clubs_king',
            'Hearts': 'hearts_main',
            'Spades': 'spades_main',
            'Diamonds': 'diamonds_king'
        };

        const targetId = suitIdMap[type];
        if (!targetId) return;

        let tableName = 'clubs_game_status';
        if (type === 'Spades') tableName = 'spades_game_state';
        if (type === 'Hearts') tableName = 'hearts_game_state';
        if (type === 'Diamonds') tableName = 'diamonds_game_state';

        const fetchInitialState = async () => {
            try {
                const { data, error } = await supabase
                    .from(tableName)
                    .select('*')
                    .eq('id', targetId)
                    .maybeSingle();

                if (data) {
                    console.log(`[GAME_MONITOR] Initial state for ${type}:`, data);
                    setLocalSystemStart(!!data.system_start);

                    if (data.is_paused !== undefined) {
                        setIsPaused(!!data.is_paused);
                    }

                    // Hearts uses participants (array of objects), extract IDs
                    if (data.participants && Array.isArray(data.participants)) {
                        const participantIds = data.participants.map((p: any) => p.id || p).filter(Boolean);
                        setLocalAllowedPlayers(participantIds);
                    } else {
                        setLocalAllowedPlayers(data.allowed_players || []);
                    }
                } else if (error) {
                    console.warn(`[GAME_MONITOR] Initial fetch failed for ${type}, retrying minimal...`);
                    const { data: minData } = await supabase.from(tableName).select('system_start').eq('id', targetId).maybeSingle();
                    if (minData) setLocalSystemStart(!!minData.system_start);
                }
            } catch (err) {
                console.error(`[GAME_MONITOR] Fetch error for ${type}:`, err);
            }
        };

        fetchInitialState();

        const channel = supabase
            .channel(`game_start_monitor_${type}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: tableName,
                filter: `id=eq.${targetId}`
            }, (payload) => {
                const newData = payload.new as any;
                console.log(`[GAME_MONITOR] Update detected for ${type}:`, newData);

                if (newData.system_start !== undefined) {
                    setLocalSystemStart(!!newData.system_start);
                }
                if (newData.is_paused !== undefined) {
                    setIsPaused(!!newData.is_paused);
                }
                if (newData.allowed_players !== undefined) {
                    setLocalAllowedPlayers(newData.allowed_players || []);
                } else if (newData.participants !== undefined) {
                    // Hearts uses participants array of objects, extract IDs
                    const participantIds = Array.isArray(newData.participants)
                        ? newData.participants.map((p: any) => p.id || p).filter(Boolean)
                        : [];
                    setLocalAllowedPlayers(participantIds);
                }
            })
            .subscribe((status) => {
                console.log(`[GAME_MONITOR] Subscribed to ${tableName} (${status})`);
                // Force a fetch on connect to ensure Freshness
                if (status === 'SUBSCRIBED') fetchInitialState();
            });

        const broadcastChannels: Record<string, string> = {
            'Clubs': 'clubs_king_game',
            'Diamonds': 'diamonds_king_game',
            'Hearts': 'hearts_main_game',
            'Spades': 'spades_main_game'
        };
        const resetChannel = supabase.channel(broadcastChannels[type] || 'lobby')
            .on('broadcast', { event: 'force_exit' }, () => {
                console.log(`[GAME:${type}] Admin forced reset signal detected.`);
                if (type === 'Diamonds' || type === 'Hearts') {
                    // Delay for internal overlays
                    setTimeout(() => {
                        setWaitingForGM(true);
                        setLocalSystemStart(false);
                    }, 2000);
                } else {
                    onClose();
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            supabase.removeChannel(resetChannel);
        };
    }, [type, onClose]);

    // DEBUG: Monitor pause state in render
    useEffect(() => {
        console.log(`[GAME_CONTAINER] State Sync: isPaused=${isPaused}, localSystemStart=${localSystemStart}, type=${type}, Role=${isMasterRole ? 'MASTER' : 'PLAYER'}`);
    }, [isPaused, localSystemStart, type, isMasterRole]);

    // Polling for Game Start (Fix for "Refresh to Join")
    // If Realtime misses the "Start" signal, we check every 2 seconds while waiting.
    useEffect(() => {
        if (!waitingForGM) return;

        const interval = setInterval(async () => {
            const suitIdMap: Record<string, string> = {
                'Clubs': 'clubs_king',
                'Hearts': 'hearts_main',
                'Spades': 'spades_main',
                'Diamonds': 'diamonds_king'
            };
            const targetId = suitIdMap[type];
            let tableName = 'clubs_game_status';
            if (type === 'Spades') tableName = 'spades_game_state';
            if (type === 'Hearts') tableName = 'hearts_game_state';
            if (type === 'Diamonds') tableName = 'diamonds_game_state';

            const { data } = await supabase
                .from(tableName)
                .select('*')
                .eq('id', targetId)
                .maybeSingle();

            if (data) {
                let parsedAllowed: string[] = [];

                if (data.allowed_players && Array.isArray(data.allowed_players)) {
                    parsedAllowed = data.allowed_players;
                } else if (data.participants && Array.isArray(data.participants)) {
                    // Hearts/Diamonds uses array of objects
                    if (data.participants.length > 0 && typeof data.participants[0] === 'object') {
                        parsedAllowed = data.participants.map((p: any) => p.id || p).filter(Boolean);
                    } else {
                        parsedAllowed = data.participants; // Fallback for simple string array
                    }
                }

                console.log(`[GAME_POLLING] ${type} State: Started=${data.system_start}, Users=${parsedAllowed.length}`);

                // Update state
                if (data.system_start !== undefined) setLocalSystemStart(!!data.system_start);
                setLocalAllowedPlayers(parsedAllowed);
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [waitingForGM, type]);

    // Unified Entrance Logic (Reacts to local state changes)
    const resetTimerRef = useRef<any>(null);

    useEffect(() => {
        const currentUserId = userInfo?.id || auth.currentUser?.uid;
        const whitelistActive = localAllowedPlayers.length > 0;
        const isAllowed = currentUserId && localAllowedPlayers.includes(currentUserId);
        const accessGranted = isMasterRole || !whitelistActive || isAllowed;

        if (localSystemStart && accessGranted) {
            console.log(`[GAME_ENTRY] Access confirmed for ${type}. Entry active.`);
            if (resetTimerRef.current) {
                clearTimeout(resetTimerRef.current);
                resetTimerRef.current = null;
            }
            setWaitingForGM(false);
            setShowRules(false);
        } else if (!localSystemStart) {
            // If system has stopped (RESET), and we are currently IN-GAME
            if (!waitingForGM) {
                // We let the internal game component handle the "RESET" overlay first
                // but we prepare the transition back to Authority Hold.
                if (!resetTimerRef.current) {
                    resetTimerRef.current = setTimeout(() => {
                        setWaitingForGM(true);
                        resetTimerRef.current = null;
                    }, 3000); // Increased slightly to allow content-based reset to finish first
                }
            }
        }
    }, [localSystemStart, localAllowedPlayers, userInfo, isMasterRole, type, waitingForGM]);

    // LOBBY PRESENCE: Track user in lobby (Hybrid)
    useEffect(() => {
        if (!waitingForGM) return;

        const safeUser = userInfo || { id: 'anon-' + Math.random(), username: 'Anonymous' };

        const channel = supabase.channel('clubs_lobby');
        channel
            .on('broadcast', { event: 'player_kick' }, (payload) => {
                const targetId = payload.payload.userId;
                const myId = userInfo?.id;
                const myName = userInfo?.username;

                if ((myId && targetId === myId) || (!myId && payload.payload.username === myName)) {
                    // For Diamonds, we want to trigger onClose with a delay
                    if (type === 'Diamonds') {
                        // Delay for internal overlays
                        setTimeout(() => {
                            if (onClose) onClose();
                        }, 2500);
                    } else {
                        setWaitingForGM(false);
                        setKickedUser(true);
                    }
                }
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    console.log(`[PRESENCE] Tracking for ${type.toLowerCase()} in clubs_lobby...`);
                    await channel.track({
                        user_id: safeUser.id,
                        username: safeUser.username,
                        role: safeUser.role || 'player',
                        entered_at: new Date().toISOString(),
                        game_type: type.toLowerCase()
                    });
                }
            });

        return () => {
            supabase.removeChannel(channel);
            // Removed automatic clean-up to prevent race conditions during refreshes
            // if (userInfo?.id) {
            //     updateDoc(doc(db, 'users', userInfo.id), {
            //         waiting_for_game: null
            //     }).catch(() => { });
            // }
        };
    }, [waitingForGM, userInfo, type, onClose]);

    const addToFirestore = async () => {
        console.log("[PRESENCE_DEBUG] Attempting to add to Firestore...", { userInfo, type });
        if (!userInfo?.id) {
            console.error("[PRESENCE_DEBUG] ABORT: No User Info/ID found!");
            return;
        }

        let targetGameId = '';
        if (type === 'Clubs') targetGameId = 'clubs_king';
        else if (type === 'Hearts') targetGameId = 'hearts_main';
        else if (type === 'Spades') targetGameId = 'spades_main';
        else if (type === 'Diamonds') targetGameId = 'diamonds_king';

        console.log(`[PRESENCE_DEBUG] Target Game ID: ${targetGameId}`);

        try {
            await setDoc(doc(db, 'users', userInfo.id), {
                waiting_for_game: targetGameId,
                last_active: Date.now(),
                role: userInfo.role || 'player'
            }, { merge: true });
            console.log("[PRESENCE_DEBUG] Firestore write successful.");
        } catch (e) {
            console.error("[PRESENCE_DEBUG] Firestore Waitlist Add Error:", e);
        }
    };

    // Auto-trigger on mount/change
    useEffect(() => {
        if (waitingForGM) addToFirestore();
    }, [waitingForGM, userInfo, type]);

    const getRules = () => {
        switch (type) {
            case 'Spades':
                return {
                    title: "Physical Prowess",
                    difficulty: "5 of Spades",
                    description: "Endure the trial. Survival depends exclusively on your physical endurance and combat readiness. No tools. No allies. Only strength.",
                    limit: "30 Minutes",
                    objective: "Reach the objective point through the hazard zone.",
                    cardImage: "/borderland_cards/Spades_5.png"
                };
            case 'Clubs':
                return {
                    title: "Equilibrium Phase",
                    difficulty: "King of Clubs",
                    description: "A symmetrical social deduction game of survival where strategy and teamwork are your only assets. \n\n[SYSTEM UPDATE]: \n1. If votes are TIED, the Architect algorithm will select one randomly. \n2. In the Reveal Phase, the top 2 voted cards are usually opened. However, if ALL participants vote for a SINGLE card, ONLY that card will be revealed.",
                    limit: "12:00 Minutes",
                    objective: "Assign targets and identify the opponent's hidden Angel.",
                    cardImage: "/borderland_cards/Clubs_K.png"
                };
            case 'Hearts':
                return {
                    title: "Psychological Betrayal",
                    difficulty: "10 of Hearts",
                    description: "A 5-round social deduction game of survival where you must deduce your own identity using hints from your partner. \n\n[SYSTEM UPDATE]: \n1. Each round you are paired with a random survivor. \n2. You see your partner's card, but NOT your own. \n3. Use private chat (Limit: 4 messages) to share hints indirectly. \n4. Use 'Eye of Truth' power wisely (Master: 2x, Player: 1x).",
                    limit: "5 Rounds",
                    objective: "Correctly identify your own suit to avoid elimination.",
                    cardImage: "/borderland_cards/Hearts_10.png"
                };
            case 'Diamonds':
                return {
                    title: "Wit and Logic",
                    difficulty: "K of Diamonds",
                    description: "Logical reasoning and data analysis. Solve the algorithm or be deleted by it. Pure intelligence is the only exit.",
                    limit: "Varies",
                    objective: "Solve all complexity protocols.",
                    cardImage: "/borderland_cards/Diamonds_K.png"
                };
            default:
                return {
                    title: "Unknown Protocol",
                    difficulty: "???",
                    description: "No data available.",
                    limit: "???",
                    objective: "???",
                    cardImage: null
                };
        }
    };

    const handleComplete = (score: number) => {
        setStatus('cleared');
        console.log(`Game Cleared! Score: ${score}`);
    };

    const handleFail = () => {
        setStatus('failed');
        console.log("Game Over");
    };

    const getTheme = (type: string) => {
        switch (type) {
            case 'Spades': return { color: '#3b82f6', tailwindColor: 'text-blue-500', bg: 'bg-blue-600', border: 'border-blue-500/50', shadow: 'shadow-blue-500/50', icon: Sword, glow: 'blue' as const };
            case 'Hearts': return { color: '#ef4444', tailwindColor: 'text-red-500', bg: 'bg-red-600', border: 'border-red-500/50', shadow: 'shadow-red-500/50', icon: Heart, glow: 'red' as const };
            case 'Clubs': return { color: '#22c55e', tailwindColor: 'text-green-500', bg: 'bg-green-600', border: 'border-green-500/50', shadow: 'shadow-green-500/50', icon: Users, glow: 'green' as const };
            case 'Diamonds': return { color: '#eab308', tailwindColor: 'text-orange-500', bg: 'bg-orange-600', border: 'border-orange-500/50', shadow: 'shadow-orange-500/50', icon: Brain, glow: 'orange' as const };
            default: return { color: '#ffffff', tailwindColor: 'text-white', bg: 'bg-gray-600', border: 'border-gray-500', shadow: 'shadow-white/20', icon: AlertTriangle, glow: 'blue' as const };
        }
    };

    const theme = getTheme(type);
    const rules = getRules();

    return (
        <div className="fixed inset-0 z-[100] bg-[#050508] flex flex-col overflow-hidden font-sans">
            {showPlayerCard && (
                <PlayerCardModal
                    user={userInfo}
                    onClose={() => setShowPlayerCard(false)}
                />
            )}

            {/* Background Atmosphere */}
            <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-[url('/hero-bg.webp')] bg-cover bg-center opacity-20 blur-sm brightness-50" />
                <div
                    className="absolute inset-0 opacity-10 mix-blend-overlay pointer-events-none"
                    style={{
                        backgroundImage: `
                            linear-gradient(45deg, #000 25%, transparent 25%),
                            linear-gradient(-45deg, #000 25%, transparent 25%),
                            linear-gradient(45deg, transparent 75%, #000 75%),
                            linear-gradient(-45deg, transparent 75%, #000 75%)
                        `,
                        backgroundSize: '60px 60px',
                        backgroundPosition: '0 0, 0 30px, 30px 30px, 30px 0'
                    }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                <div className="absolute inset-0 bg-scanline pointer-events-none opacity-[0.05]" />
            </div>

            {/* Protocol Header */}
            {((type === 'Clubs' || type === 'Hearts') || (waitingForGM || showRules || kickedUser)) && (
                <div className="relative z-50 flex justify-between items-center px-4 py-3 sm:px-8 sm:py-6 border-b border-white/10 bg-black/40 backdrop-blur-md">
                    <div className="flex items-center gap-3 sm:gap-6">
                        {/* Close Button - Shown during rules OR while waiting for GM */}
                        {(showRules || waitingForGM || kickedUser) && (
                            <button
                                onClick={onClose}
                                className="p-2 sm:p-3 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 text-white transition-all group hover:scale-105 active:scale-95"
                            >
                                <X size={16} className="sm:w-5 sm:h-5 group-hover:rotate-90 transition-transform" />
                            </button>
                        )}

                        <div className="space-y-0.5">
                            <div className="flex items-center gap-2 sm:gap-3">
                                <span className={`h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full ${theme.bg} animate-pulse shadow-[0_0_10px_currentColor]`} />
                                <p className={`${theme.tailwindColor} font-mono text-[8px] sm:text-[10px] uppercase font-bold tracking-[0.2em] sm:tracking-[0.4em]`}>
                                    TRIAL SPECIALTY // {type.toUpperCase()}
                                </p>
                            </div>
                            <h1 className="text-lg sm:text-3xl font-cinzel text-white uppercase tracking-wider drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] leading-tight">
                                Borderland Trials
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-8">
                        {/* Add Admin Tools for Hearts too maybe? For now just keep layout */}
                        {isLoggedIn && (
                            <div className="flex items-center gap-2 sm:gap-4">
                                <button
                                    onClick={() => setShowPlayerCard(true)}
                                    className="flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                                >
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                                    <span className="text-[10px] font-mono tracking-widest text-gray-300 uppercase">
                                        {userInfo?.username || 'PLAYER'}
                                    </span>
                                </button>
                                <button
                                    onClick={async () => {
                                        if (!confirm('⚠️ CONFIRM LOGOUT?\n\nYou will be ejected from the trial and must re-authenticate to continue.')) {
                                            return;
                                        }

                                        try {
                                            // Sign out from Firebase
                                            const { signOut } = await import('firebase/auth');
                                            await signOut(auth);

                                            // Call parent logout handler
                                            if (onLogoutClick) onLogoutClick();

                                            // Close game container
                                            onClose();

                                            // Show success message
                                            alert('✓ LOGOUT SUCCESSFUL\n\nYou have been disconnected from the Borderland system.');
                                        } catch (error) {
                                            console.error('Logout error:', error);
                                            alert('❌ LOGOUT ERROR\n\nFailed to disconnect. Please try again.');
                                        }
                                    }}
                                    className="bg-red-500/10 hover:bg-red-500 border border-red-500/50 text-red-500 hover:text-white px-3 py-1 sm:px-4 sm:py-1.5 rounded text-[9px] sm:text-[10px] font-mono tracking-widest uppercase transition-all"
                                >
                                    Logout
                                </button>
                            </div>
                        )}
                        <div className="h-10 w-px bg-white/10 mx-2 hidden sm:block" />
                        <div className="text-right hidden sm:block">
                            <p className="text-white/20 font-mono text-[9px] uppercase tracking-widest leading-none mb-1">Current State</p>
                            <p className={`text-xl font-display font-black italic uppercase leading-none ${status === 'cleared' ? 'text-green-500' : status === 'failed' ? 'text-red-500' : 'text-white'}`}>
                                {status === 'idle' ? 'Registration' : status}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 relative z-[60] flex items-center justify-center p-4 min-h-0 overflow-hidden">
                <AnimatePresence mode="wait">
                    {showRules ? (
                        <motion.div
                            key="rules-screen"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-center overflow-y-auto max-h-full py-8 custom-scrollbar"
                        >
                            {/* LEFT: The Card Artifact */}
                            <div className="lg:col-span-5 flex justify-center lg:justify-end order-2 lg:order-1">
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 1, ease: "easeOut" }}
                                    className="relative w-[280px] h-[420px] md:w-[350px] md:h-[520px] rounded-[2.5rem] group"
                                    style={{ willChange: 'opacity' }}
                                >
                                    <GlowCard glowColor={theme.glow} className="w-full h-full border-none p-0 overflow-hidden rounded-[2.5rem]">
                                        <div className="absolute inset-0">
                                            {rules.cardImage && (
                                                <img
                                                    src={rules.cardImage}
                                                    alt="Rules Card"
                                                    className="w-full h-full object-cover"
                                                />
                                            )}
                                        </div>
                                    </GlowCard>
                                </motion.div>
                            </div>

                            {/* RIGHT: The Protocol Instructions */}
                            <div className="lg:col-span-7 space-y-8 text-left order-1 lg:order-2">
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-widest bg-white/5 border border-white/10 ${theme.tailwindColor}`}>
                                                Difficulty: {rules.difficulty}
                                            </span>
                                        </div>
                                        <h2 className="text-3xl sm:text-5xl md:text-7xl font-cinzel text-white uppercase font-bold tracking-tight">
                                            {rules.title}
                                        </h2>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="bg-white/5 border-l-2 border-white/20 pl-4 sm:pl-6 py-2">
                                            <p className="text-white/30 font-mono text-[10px] uppercase tracking-widest mb-1">Description</p>
                                            <p className="text-gray-300 font-mono text-[11px] sm:text-sm leading-relaxed">
                                                {rules.description}
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-8">
                                            <div>
                                                <p className="text-white/30 font-mono text-[10px] uppercase tracking-widest mb-1">Objective</p>
                                                <p className="text-white font-bold font-mono text-[10px] sm:text-xs uppercase tracking-wider">
                                                    {rules.objective}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-white/30 font-mono text-[10px] uppercase tracking-widest mb-1">Time Limit</p>
                                                <p className={`text-base sm:text-xl font-display font-black italic uppercase ${theme.tailwindColor}`}>
                                                    {rules.limit}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-4">
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => {
                                                // Late joiner check is already handled in useEffect (lines 80-90)
                                                // which checks allowed_players list properly
                                                setShowRules(false);
                                                // Everyone waits based on Game Type Logic
                                                // Clubs & Hearts & Spades & Diamonds
                                                setWaitingForGM(true);
                                            }}
                                            className="group relative px-10 py-5 bg-white text-black font-black font-mono uppercase text-lg tracking-widest overflow-hidden hover:bg-gray-200 transition-colors"
                                            style={{
                                                clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)"
                                            }}
                                        >
                                            <span className="relative z-10 flex items-center gap-4">
                                                CONFIRM PARTICIPATION
                                                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                            </span>
                                        </motion.button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ) : kickedUser ? (
                        <motion.div
                            key="kicked-screen"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center justify-center p-8 text-center space-y-8"
                        >
                            <div className="w-24 h-24 rounded-full bg-red-500/10 border border-red-500/50 flex items-center justify-center">
                                <AlertTriangle size={40} className="text-red-500" />
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <h2 className="text-3xl font-display font-bold text-white tracking-[0.3em] uppercase">ACCESS REVOKED</h2>
                                    <p className="text-red-500 font-mono text-xs uppercase tracking-widest">Administrative Override</p>
                                </div>
                                <p className="text-gray-400 font-mono text-sm max-w-md mx-auto">
                                    You have been manually removed from the deployment queue by the Game Master.
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setKickedUser(false);
                                    setShowRules(true);
                                }}
                                className="px-8 py-3 bg-red-500 hover:bg-red-400 text-black font-bold font-mono uppercase tracking-widest rounded transition-colors"
                            >
                                Acknowledge
                            </button>
                        </motion.div>
                    ) : waitingForGM ? (
                        <motion.div
                            key="waiting-screen"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className={`absolute inset-0 z-50 backdrop-blur-xl flex items-center justify-center pointer-events-auto transition-colors duration-1000 ${type?.toLowerCase() === 'hearts' ? 'bg-red-950/40' : 'bg-black/95'
                                }`}
                        >
                            {/* Ambient Hearts Glow */}
                            {type?.toLowerCase() === 'hearts' && (
                                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                                    <motion.div
                                        animate={{
                                            scale: [1, 1.2, 1],
                                            opacity: [0.1, 0.2, 0.1]
                                        }}
                                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-600/20 rounded-full blur-[120px]"
                                    />
                                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#000_100%)] opacity-60" />
                                </div>
                            )}

                            <div className="max-w-md mx-auto text-center space-y-8 p-8 relative z-10">
                                {/* Card Visual */}
                                <motion.div
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{
                                        scale: type?.toLowerCase() === 'hearts' ? [1, 1.05, 1] : 1,
                                        opacity: 1
                                    }}
                                    transition={{
                                        opacity: { duration: 0.4 },
                                        scale: { duration: 0.8, repeat: Infinity, ease: "easeInOut" }
                                    }}
                                    className={`w-48 h-72 mx-auto rounded-2xl shadow-2xl relative overflow-hidden flex flex-col items-center justify-center p-4 border-4 transition-colors duration-500 ${type?.toLowerCase() === 'hearts' ? 'bg-black border-red-600 shadow-red-900/40' : 'bg-white border-gray-200 shadow-black/50'
                                        }`}
                                >
                                    {/* Dynamic Card Content based on Type */}
                                    {(() => {
                                        let suit = '♣';
                                        let suitColor = 'text-green-600';
                                        let rank = 'K';

                                        const t = type?.toLowerCase();
                                        if (t === 'hearts') { suit = '♥'; suitColor = 'text-red-500'; rank = 'K'; }
                                        else if (t === 'spades') { suit = '♠'; suitColor = 'text-black'; rank = 'K'; }
                                        else if (t === 'diamonds') { suit = '♦'; suitColor = 'text-orange-500'; rank = 'K'; }

                                        // Standard Card Rendering for All Suits
                                        return (
                                            <>
                                                {/* Top Left */}
                                                <div className="absolute top-4 left-4 flex flex-col items-center leading-none">
                                                    <span className={`text-3xl font-bold ${t === 'spades' ? 'text-black' : t === 'hearts' ? 'text-red-500' : t === 'diamonds' ? 'text-orange-500' : 'text-black'}`}>{rank}</span>
                                                    <span className={`text-2xl ${suitColor}`}>{suit}</span>
                                                </div>

                                                {/* Center */}
                                                <div className={`text-8xl ${suitColor} animate-slow-pulse`}>{suit}</div>

                                                {/* Bottom Right */}
                                                <div className="absolute bottom-4 right-4 flex flex-col items-center leading-none rotate-180">
                                                    <span className={`text-3xl font-bold ${t === 'spades' ? 'text-black' : t === 'hearts' ? 'text-red-500' : t === 'diamonds' ? 'text-orange-500' : 'text-black'}`}>{rank}</span>
                                                    <span className={`text-2xl ${suitColor}`}>{suit}</span>
                                                </div>
                                            </>
                                        );
                                    })()}

                                    {/* Shimmer Effect */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-slow-shimmer" />
                                </motion.div>

                                {/* Message */}
                                <div className="space-y-4">
                                    <h2 className={`text-3xl font-cinzel font-bold tracking-widest uppercase transition-colors duration-500 ${type?.toLowerCase() === 'hearts' ? 'text-red-500' : 'text-white'
                                        }`}>
                                        Authority Hold
                                    </h2>
                                    <div className="space-y-2">
                                        <p className={`${type?.toLowerCase() === 'hearts' ? 'text-red-400' : 'text-green-400'} font-mono text-sm uppercase tracking-wider animate-pulse`}>
                                            ► Awaiting Game Master Authorization
                                        </p>
                                        <p className="text-gray-400 font-mono text-xs max-w-[280px] mx-auto">
                                            Your participation request has been submitted. Stand by for clearance...
                                        </p>
                                    </div>
                                </div>

                                {/* Buttons */}
                                <div className="flex flex-col gap-3 w-full max-w-xs mx-auto">
                                    <button
                                        onClick={async () => {
                                            // Force re-submit presence signal before reload
                                            await addToFirestore();
                                            setTimeout(() => window.location.reload(), 500);
                                        }}
                                        className={`px-6 py-3 border rounded font-mono text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${type?.toLowerCase() === 'hearts'
                                            ? 'bg-red-600/10 hover:bg-red-600/20 border-red-600/50 text-red-400'
                                            : 'bg-white/5 hover:bg-white/10 border-white/20 text-white'
                                            }`}
                                    >
                                        ⟳ FORCE SIGNAL REFRESH
                                    </button>

                                    {/* MASTER OVERRIDE REMOVED - NOW HANDLED BY AUTO-ENTRY LOGIC */}
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="game-screen"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="h-full w-full relative"
                        >
                            {(() => {
                                switch (type) {
                                    case 'Spades':
                                        return <SpadesGame onComplete={handleComplete} onFail={handleFail} user={userInfo} onClose={onClose} />;
                                    case 'Hearts':
                                        return isMasterRole ?
                                            <HeartsGameMaster onComplete={() => handleComplete(0)} user={userInfo} /> :
                                            <HeartsGame user={userInfo} />;
                                    case 'Clubs':
                                        return isMasterRole ?
                                            <ClubsGameMaster onComplete={handleComplete} onFail={handleFail} user={userInfo} onProfileClick={() => setShowPlayerCard(true)} /> :
                                            <ClubsGame onComplete={handleComplete} onFail={handleFail} user={userInfo} onProfileClick={() => setShowPlayerCard(true)} />;
                                    case 'Diamonds':
                                        return <DiamondsGame user={userInfo} onClose={() => setWaitingForGM(true)} />;
                                    default:
                                        return <div className="text-white uppercase font-mono tracking-widest p-12 text-center bg-white/5 rounded-xl border border-white/10">UNKNOWN PROTOCOL ERROR. RE-INITIATING HANDSHAKE...</div>;
                                }
                            })()}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div >


            {isPaused && (
                <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center text-center p-8 backdrop-blur-xl">
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="space-y-6"
                    >
                        <AlertTriangle size={64} className="text-red-500 mx-auto animate-pulse" />
                        <h2 className="text-4xl font-display font-bold text-white tracking-[0.2em] uppercase">Trial Suspended</h2>
                        <p className="text-red-400 font-mono text-sm uppercase">The Game Master has temporarily paused the protocol.</p>
                    </motion.div>
                </div>
            )}

            {/* 
              Running Headless Master Logic for Admins/Masters playing the game.
              This ensures the game keeps running (timers, transitions) even if they leave the Admin Dashboard.
            */}
            {

            }
            {
                isMasterRole && type === 'Hearts' && (
                    <div className="hidden pointer-events-none opacity-0 h-0 w-0 overflow-hidden">
                        <HeartsGameMaster
                            onComplete={() => console.log("Hearts Headless Master Complete")}
                            user={userInfo || { id: 'admin-fallback', username: 'ADMIN', role: 'admin' }}
                        />
                    </div>
                )
            }
        </div >
    );
};
