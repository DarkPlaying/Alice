import { useState, useEffect, useRef } from 'react';
import { X, Sword, Heart, Users, Brain, AlertTriangle, ArrowRight, LogOut, FastForward, User } from 'lucide-react';

import { motion, AnimatePresence } from 'framer-motion';
import { SpadesGame } from './games/SpadesGame';

import { HeartsGame } from './games/HeartsGame';
import { HeartsGameMaster } from './games/HeartsGameMaster';
import { ClubsGame } from './games/ClubsGame';
import { ClubsGameMaster } from './games/ClubsGameMaster';
import { DiamondsGame } from './games/DiamondsGame';
// import { GlowCard } from './ui/spotlight-card';
import { PlayerCardModal } from './PlayerCardModal';
import { supabase, supabaseUrl, supabaseKey, getAccessToken } from '../supabaseClient';
import { useAssetLoader } from '../hooks/useAssetLoader';
import { Loader } from './Loader';


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
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const isMasterRole = userInfo?.role === 'master' || userInfo?.role === 'admin' || userInfo?.username === 'admin' || userInfo?.username === 'SANJAY';
    const [kickedUser, setKickedUser] = useState(false);
    const [spadesMasterError, setSpadesMasterError] = useState(false); // Track if a Master tries to join Spades
    const [playingVideo, setPlayingVideo] = useState<'start' | 'end' | null>(null);
    const [videoLoaded, setVideoLoaded] = useState(false);
    const [skipVideos, setSkipVideosState] = useState(() => localStorage.getItem('skipVideos') === 'true');
    const setSkipVideos = (val: boolean) => {
        localStorage.setItem('skipVideos', String(val));
        setSkipVideosState(val);
    };

    const cardImgSrc = type === 'Diamonds' ? '/suit_assets/diamond.png' :
        type === 'Spades' ? '/suit_assets/spade.png' :
            type === 'Clubs' ? '/suit_assets/clubs.png' :
                type === 'Hearts' ? '/suit_assets/hearts.png' : undefined;

    const isLoaded = useAssetLoader([
        cardImgSrc || ''
    ].filter(Boolean));

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
                const accessToken = await getAccessToken();
                const response = await fetch(`${supabaseUrl}/rest/v1/${tableName}?id=eq.${targetId}&select=*`, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'apikey': supabaseKey,
                        'Accept': 'application/vnd.pgrst.object+json'
                    },
                    cache: 'no-store'
                });

                if (response.ok) {
                    const data = await response.json();
                    const row = Array.isArray(data) ? data[0] : data;

                    if (row) {
                        console.log(`[GAME_MONITOR] Initial state for ${type}:`, row);
                        setLocalSystemStart(!!row.system_start);

                        if (row.is_paused !== undefined) {
                            setIsPaused(!!row.is_paused);
                        }

                        // Hearts uses participants (array of objects), extract IDs
                        if (row.participants && Array.isArray(row.participants)) {
                            const participantIds = row.participants.map((p: any) => p.id || p).filter(Boolean);
                            setLocalAllowedPlayers(participantIds);
                        } else {
                            setLocalAllowedPlayers(row.allowed_players || []);
                        }
                    }
                } else {
                    console.warn(`[GAME_MONITOR] Initial fetch failed for ${type}. Status: ${response.status}`);
                }
            } catch (err) {
                console.error(`[GAME_MONITOR] Fetch error for ${type}:`, err);
            }
        };

        fetchInitialState();

        // Add robust polling fallback in case Realtime channel is stuck due to gotrue-js lock
        const pollInterval = setInterval(() => {
            if (!document.hidden) {
                fetchInitialState();
            }
        }, 15000);

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
                if (newData.allowed_players) {
                    setLocalAllowedPlayers(newData.allowed_players || []);
                } else if (newData.participants) {
                    const participantIds = newData.participants.map((p: any) => p.id || p).filter(Boolean);
                    setLocalAllowedPlayers(participantIds);
                }
            })
            .subscribe((status) => {
                console.log(`[GAME_MONITOR] Subscription status:`, status);
                // Force a fetch on connect to ensure Freshness
                if (status === 'SUBSCRIBED') fetchInitialState();
            });

        return () => {
            clearInterval(pollInterval);
            supabase.removeChannel(channel);
        };
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

            let data: any = null;
            try {
                const accessToken = await getAccessToken();
                const response = await fetch(`${supabaseUrl}/rest/v1/${tableName}?id=eq.${targetId}&select=*`, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'apikey': supabaseKey,
                        'Accept': 'application/vnd.pgrst.object+json'
                    },
                    cache: 'no-store'
                });
                if (response.ok) {
                    data = await response.json();
                }
            } catch (err) {
                console.warn("[GAME_POLLING] Fetch error:", err);
            }

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
                if (data.is_paused !== undefined) setIsPaused(!!data.is_paused);
                setLocalAllowedPlayers(parsedAllowed);
            }
        }, 15000);

        return () => clearInterval(interval);
    }, [waitingForGM, type]);

    // Demo Auto-Start Logic
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (waitingForGM && userInfo?.role === 'demo') {
            timer = setTimeout(() => {
                setWaitingForGM(false);
            }, 3000);
        }
        return () => clearTimeout(timer);
    }, [waitingForGM, userInfo?.role]);

    // Unified Entrance Logic (Reacts to local state changes)
    const resetTimerRef = useRef<any>(null);

    useEffect(() => {
        const currentUserId = userInfo?.id;
        const whitelistActive = localAllowedPlayers.length > 0;
        const isAllowed = currentUserId && localAllowedPlayers.includes(currentUserId);
        const isSpades = type === 'Spades';

        // Masters are explicitly forbidden from joining Spades
        const isForbiddenMaster = isSpades && isMasterRole;
        const accessGranted = (!isForbiddenMaster && isMasterRole) || !whitelistActive || isAllowed;

        if (isForbiddenMaster) {
            setSpadesMasterError(true);
            setWaitingForGM(false);
            setShowRules(false);
        } else if (localSystemStart && accessGranted) {
            console.log(`[GAME_ENTRY] Access confirmed for ${type}. Entry active.`);
            if (resetTimerRef.current) {
                clearTimeout(resetTimerRef.current);
                resetTimerRef.current = null;
            }
            setSpadesMasterError(false);
            setWaitingForGM(false);
            setShowRules(false);
        } else if (!localSystemStart && userInfo?.role !== 'demo') {
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

    const hasNegativeVisa = userInfo?.visa_points !== undefined && userInfo?.visa_points < 0;

    useEffect(() => {
        if (hasNegativeVisa && userInfo?.id) {
            console.log("Player is dead due to negative points (points < 0)");
        }
    }, [hasNegativeVisa, userInfo]);

    // LOBBY PRESENCE: Track user in lobby (Hybrid)
    useEffect(() => {
        if (!waitingForGM || kickedUser || hasNegativeVisa) return;

        const safeUser = userInfo || { id: 'anon-' + Math.random(), username: 'Anonymous' };

        const channel = supabase.channel('clubs_lobby', {
            config: {
                presence: {
                    key: safeUser.id
                }
            }
        });
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
            .on('broadcast', { event: 'force_exit' }, () => {
                // If the admin purges the queue, everyone is kicked
                setWaitingForGM(false);
                setKickedUser(true);
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
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [waitingForGM, userInfo?.id, type, kickedUser]);

    // LOBBY PRESENCE: Fallback Waitlist DB Addition
    const addToWaitlistDB = async () => {
        if (hasNegativeVisa) return;
        console.log("[PRESENCE_DEBUG] Attempting to add to Supabase Waitlist...", { userInfo, type });
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
            // Handled by Supabase realtime lobby
            console.log("[PRESENCE_DEBUG] Supabase write successful.");
        } catch (e) {
            console.error("[PRESENCE_DEBUG] Supabase Waitlist Add Error:", e);
        }
    };

    // Auto-trigger on mount/change
    useEffect(() => {
        if (waitingForGM) addToWaitlistDB();
    }, [waitingForGM, userInfo, type]);

    const getRules = () => {
        switch (type) {
            case 'Spades':
                return {
                    title: "Physical Prowess",
                    difficulty: "A of Spades",
                    description: "Endure the trial. Survival depends exclusively on your physical endurance and combat readiness. No tools. No allies. Only strength.",
                    limit: "30 Minutes",
                    objective: "Reach the objective point through the hazard zone.",
                    cardImage: "/borderland_cards/Spades_5.png"
                };
            case 'Clubs':
                return {
                    title: "Equilibrium Phase",
                    difficulty: "A of Clubs",
                    description: "A symmetrical social deduction game of survival where strategy and teamwork are your only assets. \n\n[SYSTEM UPDATE]: \n1. If votes are TIED, the Architect algorithm will select one randomly. \n2. In the Reveal Phase, the top 2 voted cards are usually opened. However, if ALL participants vote for a SINGLE card, ONLY that card will be revealed.",
                    limit: "12:00 Minutes",
                    objective: "Assign targets and identify the opponent's hidden Angel.",
                    cardImage: "/borderland_cards/Clubs_K.png"
                };
            case 'Hearts':
                return {
                    title: "Psychological Betrayal",
                    difficulty: "A of Hearts",
                    description: "A 5-round social deduction game of survival where you must deduce your own identity using hints from your partner. \n\n[SYSTEM UPDATE]: \n1. Each round you are paired with a random survivor. \n2. You see your partner's card, but NOT your own. \n3. Use private chat (Limit: 4 messages) to share hints indirectly. \n4. Use 'Eye of Truth' power wisely (Master: 2x, Player: 1x).",
                    limit: "5 Rounds",
                    objective: "Correctly identify your own suit to avoid elimination.",
                    cardImage: "/borderland_cards/Hearts_10.png"
                };
            case 'Diamonds':
                return {
                    title: "Wit and Logic",
                    difficulty: "A of Diamonds",
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
        if (!skipVideos) setPlayingVideo('end');
        setStatus('cleared');
        console.log(`Game Cleared! Score: ${score}`);
    };

    const handleFail = () => {
        if (!skipVideos) setPlayingVideo('end');
        setStatus('failed');
        console.log("Game Over");
    };

    const getTheme = (type: string) => {
        switch (type) {
            case 'Spades': return { color: '#3b82f6', tailwindColor: 'text-blue-500', bg: 'bg-blue-600', border: 'border-blue-500/50', shadow: 'shadow-blue-500/50', icon: Sword, glow: 'blue' as const };
            case 'Hearts': return { color: '#ef4444', tailwindColor: 'text-red-500', bg: 'bg-red-600', border: 'border-red-500/50', shadow: 'shadow-red-500/50', icon: Heart, glow: 'red' as const };
            case 'Clubs': return { color: '#22c55e', tailwindColor: 'text-green-500', bg: 'bg-green-600', border: 'border-green-500/50', shadow: 'shadow-green-500/50', icon: Users, glow: 'green' as const };
            case 'Diamonds': return { color: '#a855f7', tailwindColor: 'text-purple-500', bg: 'bg-purple-600', border: 'border-purple-500/50', shadow: 'shadow-purple-500/50', icon: Brain, glow: 'purple' as const };
            default: return { color: '#ffffff', tailwindColor: 'text-white', bg: 'bg-gray-600', border: 'border-gray-500', shadow: 'shadow-white/20', icon: AlertTriangle, glow: 'blue' as const };
        }
    };

    const theme = getTheme(type);
    const rules = getRules();

    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (playingVideo && videoRef.current) {
            videoRef.current.play().catch((err) => {
                console.error("Video autoplay blocked or failed:", err);
                // Fallback: if video fails to play, skip it
                if (playingVideo === 'start') {
                    setShowRules(false);
                    setWaitingForGM(true);
                }
                setPlayingVideo(null);
            });
        }
    }, [playingVideo]);

    if (!isLoaded) return <Loader />;

    return (
        <div className="fixed inset-0 z-[100] bg-[url('/bg.jpg')] bg-cover bg-center bg-fixed flex flex-col overflow-hidden font-sans">
            {/* Base dark overlay for readability across all games */}
            <div className="absolute inset-0 bg-black/60 pointer-events-none z-0" />

            <div className="relative z-10 flex flex-col w-full h-full">
                {showPlayerCard && (
                    <PlayerCardModal
                        user={userInfo}
                        onClose={() => setShowPlayerCard(false)}
                    />
                )}

                {/* Logout Confirm Modal */}
                {showLogoutConfirm && (
                    <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                        <div className="relative w-full max-w-sm overflow-hidden rounded-xl border border-white/15 bg-[#0a0a10] shadow-[0_0_80px_rgba(0,0,0,0.9)] backdrop-blur-sm mx-auto">
                            <div className="px-8 pt-8 pb-8 flex flex-col items-center text-center">
                                <img src="/suit_assets/joker.png" alt="System" className="w-12 h-12 object-contain mb-5 opacity-70" />
                                <h3 style={{ fontFamily: "'Cinzel', serif" }} className="text-base font-bold tracking-[0.15em] mb-3 leading-snug uppercase text-red-400">
                                    CONFIRM LOGOUT
                                </h3>
                                <div className="w-12 h-px bg-white/10 mb-4" />
                                <p className="text-gray-400 text-[13px] leading-relaxed mb-8 whitespace-pre-line font-mono tracking-wide">
                                    You will be ejected from the trial and must re-authenticate to continue.
                                </p>
                                <div className="w-full flex gap-3 flex-col sm:flex-row">
                                    <button
                                        onClick={() => setShowLogoutConfirm(false)}
                                        className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-gray-400 text-[11px] font-mono font-bold uppercase tracking-[0.15em] rounded-lg transition-all active:scale-95"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => {
                                            try {
                                                localStorage.removeItem('borderland-fresh-token-v2');
                                                window.location.href = '/login';
                                                if (onLogoutClick) onLogoutClick();
                                                onClose();
                                            } catch (error) {
                                                console.error('Logout error:', error);
                                            }
                                        }}
                                        className="flex-1 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/40 hover:border-red-400 text-red-400 text-[11px] font-mono font-bold uppercase tracking-[0.15em] rounded-lg transition-all active:scale-95"
                                    >
                                        ♦ Confirm
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Protocol Header */}
                {((type === 'Clubs' || type === 'Hearts') || (waitingForGM || showRules || kickedUser)) && (
                    <div className="relative z-50 flex justify-between items-center px-4 py-3 sm:px-8 sm:py-6 border-b border-white/10 bg-black/40 backdrop-blur-md overflow-hidden">
                        {/* Ambient Header Glow - ONLY show when waiting, not in confirm page (showRules) */}
                        {(!showRules && waitingForGM) && (
                            <div className="absolute inset-0 pointer-events-none opacity-40">
                                <motion.div
                                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[150px] rounded-full blur-[60px]"
                                    style={{ backgroundColor: theme.color }}
                                />
                            </div>
                        )}

                        <div className="relative z-10 flex items-center gap-3 sm:gap-6">
                            {/* Close Button - Shown during rules OR while waiting for GM */}
                            {(showRules || waitingForGM || kickedUser) && (
                                <button
                                    onClick={onClose}
                                    className="p-1.5 sm:p-3 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 text-white transition-all group hover:scale-105 active:scale-95"
                                >
                                    <X size={16} className="sm:w-5 sm:h-5 group-hover:rotate-90 transition-transform" />
                                </button>
                            )}

                            <div className="space-y-0.5">
                                <div className="flex items-center gap-1 lg:gap-3">
                                    <span className={`h-1 w-1 lg:h-1.5 lg:w-1.5 rounded-full ${theme.bg} animate-pulse shadow-[0_0_10px_currentColor]`} />
                                    <p className={`${theme.tailwindColor} font-mono text-[5px] sm:text-[8px] lg:text-[10px] uppercase font-bold tracking-[0.1em] sm:tracking-[0.2em] lg:tracking-[0.4em] whitespace-nowrap`}>
                                        TRIAL SPECIALTY // {type.toUpperCase()}
                                    </p>
                                </div>
                                <h1 className="text-[10px] sm:text-xl lg:text-3xl font-cinzel text-white uppercase tracking-wider drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] leading-tight whitespace-nowrap">
                                    Borderland Trials
                                </h1>
                            </div>
                        </div>

                        <div className="relative z-10 flex items-center gap-2 lg:gap-8">
                            {/* Add Admin Tools for Hearts too maybe? For now just keep layout */}
                            {isLoggedIn && (
                                <div className="flex items-center gap-1 lg:gap-4 flex-nowrap justify-end">
                                    <button
                                        onClick={() => setShowPlayerCard(true)}
                                        className="flex items-center justify-center gap-1 lg:gap-2 p-1.5 sm:p-2 lg:px-3 lg:py-1 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                                    >
                                        <div className="hidden lg:block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                                        <User size={14} className="lg:hidden text-gray-300" />
                                        <span className="hidden lg:inline text-[10px] font-mono tracking-widest text-gray-300 uppercase whitespace-nowrap">
                                            {userInfo?.username || 'PLAYER'}
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => setSkipVideos(!skipVideos)}
                                        className={`flex items-center justify-center p-1.5 sm:p-2 lg:px-3 lg:py-1.5 border lg:text-[10px] font-mono uppercase lg:tracking-[0.2em] rounded transition-all whitespace-nowrap ${skipVideos ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}
                                    >
                                        <FastForward size={14} className="lg:hidden" />
                                        <span className="hidden lg:inline">{skipVideos ? 'Skip Intro: ON' : 'Skip Intro: OFF'}</span>
                                    </button>
                                    <button
                                        onClick={() => setShowLogoutConfirm(true)}
                                        className="flex items-center justify-center p-1.5 sm:p-2 lg:px-4 lg:py-1.5 border border-red-900/50 hover:bg-red-950/30 text-red-500/70 hover:text-red-500 lg:text-[10px] font-mono uppercase lg:tracking-[0.2em] rounded transition-all whitespace-nowrap"
                                    >
                                        <LogOut size={14} className="lg:hidden" />
                                        <span className="hidden lg:inline">Logout</span>
                                    </button>
                                </div>
                            )}
                            <div className="h-6 lg:h-10 w-px bg-white/10 mx-1 lg:mx-2" />
                            <div className="text-right flex flex-col justify-center">
                                <p className="text-white/20 font-mono text-[5px] sm:text-[7px] lg:text-[9px] uppercase tracking-wider lg:tracking-widest leading-none mb-0.5 lg:mb-1 whitespace-nowrap">Current State</p>
                                <p className={`text-[8px] sm:text-base lg:text-xl font-display font-black italic uppercase leading-none whitespace-nowrap ${status === 'cleared' ? 'text-green-500' : status === 'failed' ? 'text-red-500' : 'text-white'}`}>
                                    {status === 'idle' ? 'Registration' : status}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Content Area */}
                <div className="flex-1 relative z-[60] flex items-center justify-center min-h-0 overflow-hidden">
                    <AnimatePresence mode="wait">
                        {spadesMasterError ? (
                            <motion.div
                                key="spades-master-error"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-black/90 backdrop-blur-xl border border-red-500/30 rounded-2xl p-8 max-w-lg w-full text-center space-y-6"
                            >
                                <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                                    <AlertTriangle className="w-8 h-8 text-red-500" />
                                </div>
                                <h2 className="text-2xl font-bold text-white uppercase tracking-widest font-mono">Access Denied</h2>
                                <p className="text-red-400 font-mono text-sm">
                                    This game can be played only by a PLAYER, not a MASTER.
                                </p>
                                <button
                                    onClick={onClose}
                                    className="px-8 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold font-mono uppercase tracking-widest rounded transition-colors"
                                >
                                    Return to Lobby
                                </button>
                            </motion.div>
                        ) : hasNegativeVisa ? (
                            <motion.div
                                key="negative-visa-screen"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex flex-col items-center justify-center p-8 text-center space-y-8"
                            >
                                <div className="w-24 h-24 rounded-full bg-red-900/50 border border-red-500/50 flex items-center justify-center relative overflow-hidden shadow-[0_0_30px_rgba(239,68,68,0.3)]">
                                    <AlertTriangle size={40} className="text-red-500 relative z-10" />
                                </div>
                                <div className="space-y-4 relative z-10">
                                    <div className="space-y-2">
                                        <h2 className="text-3xl font-display font-bold text-white tracking-[0.3em] uppercase drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]">VISA EXPIRED</h2>
                                        <p className="text-red-500 font-mono text-xs uppercase tracking-widest bg-black/50 inline-block px-4 py-1 border border-red-500/20">STATUS: DEAD</p>
                                    </div>
                                    <p className="text-gray-400 font-mono text-sm max-w-md mx-auto">
                                        Insufficient visa points. You cannot participate in any games. Contact the Game Master.
                                    </p>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="px-8 py-3 bg-red-950/80 border border-red-500/50 hover:bg-red-900 text-red-500 font-bold font-mono uppercase tracking-widest rounded transition-colors relative overflow-hidden group"
                                >
                                    <span className="relative z-10">Acknowledge</span>
                                    <div className="absolute inset-0 bg-red-500/20 translate-y-[100%] group-hover:translate-y-0 transition-transform"></div>
                                </button>
                            </motion.div>
                        ) : showRules ? (
                            <motion.div
                                key="rules-screen"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 w-full h-full flex flex-col items-center justify-center overflow-y-auto lg:overflow-hidden bg-black/40 backdrop-blur-md z-50"
                            >
                                <div className="w-full h-full max-w-7xl flex flex-col items-center justify-center gap-4 sm:gap-6 lg:gap-4 py-4 sm:py-8 custom-scrollbar px-4 sm:px-10 lg:px-20 mx-auto">
                                    <div className="w-full flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-6 sm:gap-8 lg:gap-16">
                                    {/* LEFT: The Card Artifact */}
                                    <div className="w-full sm:w-1/2 flex justify-center lg:justify-end perspective-1000">
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.8, rotateY: 90, filter: 'brightness(0)' }}
                                            animate={{ opacity: 1, scale: 1, rotateY: 0, filter: 'brightness(1)' }}
                                            transition={{ duration: 1.2, ease: "easeOut", type: "spring", bounce: 0.3 }}
                                            whileHover={{ scale: 1.05, y: -10, rotateY: 10, rotateX: 5, filter: 'brightness(1.2)' }}
                                            className="relative w-[140px] h-[210px] sm:w-[220px] sm:h-[330px] lg:w-[280px] lg:h-[420px] group shrink-0 cursor-pointer"
                                            style={{ willChange: 'transform, opacity, filter', transformStyle: 'preserve-3d' }}
                                        >
                                            <div className="w-full h-full relative overflow-hidden bg-transparent shadow-[0_20px_50px_rgba(0,0,0,0.7)] border border-white/20">
                                                <div className="absolute inset-0">
                                                    <img
                                                        src={
                                                            type === 'Diamonds' ? '/suit_assets/diamond.png' :
                                                                type === 'Spades' ? '/suit_assets/spade.png' :
                                                                    type === 'Clubs' ? '/suit_assets/clubs.png' :
                                                                        type === 'Hearts' ? '/suit_assets/hearts.png' :
                                                                            (rules?.cardImage || undefined)
                                                        }
                                                        alt="Rules Card"
                                                        className="w-full h-full object-cover drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                                                    />
                                                </div>
                                            </div>
                                        </motion.div>
                                    </div>

                                    {/* RIGHT: The Protocol Instructions */}
                                    <div className="w-full sm:w-1/2 space-y-4 sm:space-y-8 text-center sm:text-left lg:pr-12 xl:pr-20">
                                        <motion.div 
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 1, ease: "easeOut" }}
                                            className="space-y-4 sm:space-y-6 lg:space-y-4 xl:space-y-6"
                                        >
                                            <div className="space-y-2 sm:space-y-4 lg:space-y-2 xl:space-y-4">
                                                <div className="flex items-center justify-center sm:justify-start gap-3">
                                                    <span className={`px-2 py-0.5 rounded text-[8px] sm:text-[10px] lg:text-[9px] xl:text-[10px] font-mono font-bold uppercase tracking-widest bg-black border border-white/10 ${theme.tailwindColor}`}>
                                                        Difficulty: {rules.difficulty}
                                                    </span>
                                                </div>
                                                <h2 className="text-xl sm:text-2xl md:text-2xl lg:text-3xl xl:text-4xl 2xl:text-5xl font-cinzel text-white uppercase font-bold tracking-tight drop-shadow-lg leading-tight">
                                                    {rules.title}
                                                </h2>
                                            </div>

                                            <div className="space-y-2 sm:space-y-4 lg:space-y-3 xl:space-y-4">
                                                <div className="bg-black/40 backdrop-blur-md border-y-2 sm:border-y-0 sm:border-l-2 px-3 py-3 sm:px-0 sm:pl-6 sm:py-4 rounded-lg sm:rounded-l-none sm:rounded-r-lg" style={{ borderColor: theme.color, boxShadow: `inset 20px 0 30px -30px ${theme.color}` }}>
                                                    <p className="text-white/40 font-mono text-[8px] sm:text-[10px] lg:text-[9px] xl:text-[10px] uppercase tracking-widest mb-1 sm:mb-2">Description</p>
                                                    <p className="text-gray-300 font-mono text-[9px] sm:text-xs lg:text-[11px] xl:text-sm leading-relaxed">
                                                        {rules.description}
                                                    </p>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4 sm:gap-8 lg:gap-4 xl:gap-8">
                                                    <div>
                                                        <p className="text-white/30 font-mono text-[8px] sm:text-[10px] lg:text-[9px] xl:text-[10px] uppercase tracking-widest mb-0.5 sm:mb-1">Objective</p>
                                                        <p className="text-white font-bold font-mono text-[8px] sm:text-xs lg:text-[10px] xl:text-xs uppercase tracking-wider">
                                                            {rules.objective}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-white/30 font-mono text-[8px] sm:text-[10px] lg:text-[9px] xl:text-[10px] uppercase tracking-widest mb-0.5 sm:mb-1">Time Limit</p>
                                                        <p className={`text-sm sm:text-xl lg:text-lg xl:text-xl font-display font-black italic uppercase ${theme.tailwindColor}`}>
                                                            {rules.limit}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    </div>
                                </div>

                                {/* BOTTOM: Center Confirm Button */}
                                <div className="flex justify-center w-full">
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => {
                                                    if (skipVideos) {
                                                        setShowRules(false);
                                                        setWaitingForGM(true);
                                                    } else {
                                                        setPlayingVideo('start');
                                                    }
                                                }}
                                                className="group relative px-6 sm:px-10 py-4 sm:py-5 bg-black/60 backdrop-blur-md text-white font-black font-mono uppercase text-sm sm:text-lg tracking-widest overflow-hidden transition-all border border-white/20 hover:border-white shadow-lg"
                                                style={{
                                                    clipPath: "polygon(15px 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%, 0 15px)",
                                                    boxShadow: `0 0 20px ${theme.color}40`,
                                                    textShadow: `0 0 10px ${theme.color}80`
                                                }}
                                            >
                                                <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity" style={{ backgroundColor: theme.color }} />
                                                <span className="relative z-10 flex items-center gap-4">
                                                    CONFIRM PARTICIPATION
                                                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                                </span>
                                            </motion.button>
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
                                className={`absolute inset-0 z-50 backdrop-blur-md flex items-center justify-center pointer-events-auto transition-colors duration-1000`}
                                style={{ backgroundColor: `${theme.color}20` }}
                            >
                                {/* Ambient Glow */}
                                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                                    <motion.div
                                        animate={{
                                            scale: [1, 1.2, 1],
                                            opacity: [0.1, 0.2, 0.1]
                                        }}
                                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px] opacity-20"
                                        style={{ backgroundColor: theme.color }}
                                    />
                                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#000_100%)] opacity-60" />
                                </div>

                                <div className="max-w-md mx-auto text-center space-y-4 sm:space-y-8 p-4 sm:p-8 relative z-10">
                                    {/* Card Visual */}
                                    <motion.div
                                        initial={{ scale: 0.9, opacity: 0 }}
                                        animate={{
                                            scale: [1, 1.08, 1],
                                            opacity: 1
                                        }}
                                        transition={{
                                            opacity: { duration: 0.4 },
                                            scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                                        }}
                                        className="w-24 h-36 sm:w-32 sm:h-48 md:w-40 md:h-60 mx-auto relative flex flex-col items-center justify-center"
                                    >
                                        <img
                                            src={
                                                type?.toLowerCase() === 'diamonds' ? '/suit_assets/diamond.png' :
                                                    type?.toLowerCase() === 'hearts' ? '/suit_assets/hearts.png' :
                                                        type?.toLowerCase() === 'clubs' ? '/suit_assets/clubs.png' :
                                                            '/suit_assets/spade.png'
                                            }
                                            alt={`${type} Symbol`}
                                            className="w-full h-full object-contain drop-shadow-[0_0_40px_rgba(255,255,255,0.2)]"
                                        />
                                    </motion.div>

                                    {/* Message */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
                                        className="space-y-4 px-4 sm:px-0"
                                    >
                                        <h2 className={`text-2xl sm:text-3xl md:text-4xl font-cinzel font-bold tracking-widest uppercase transition-colors duration-500 whitespace-nowrap ${type?.toLowerCase() === 'hearts' ? 'text-red-500' : 'text-white'
                                            }`}>
                                            Authority Hold
                                        </h2>
                                        <div className="space-y-2">
                                            <p className={`${type?.toLowerCase() === 'hearts' ? 'text-red-400' : 'text-green-400'} font-mono text-xs sm:text-sm uppercase tracking-wider animate-pulse`}>
                                                ► Awaiting Game Master Authorization
                                            </p>
                                            <p className="text-gray-400 font-mono text-[10px] sm:text-xs max-w-[280px] sm:max-w-xs mx-auto leading-relaxed">
                                                Your participation request has been submitted. Stand by for clearance...
                                            </p>
                                        </div>
                                    </motion.div>

                                    {/* Buttons */}
                                    <div className="flex flex-col gap-3 w-full max-w-xs mx-auto">
                                        <button
                                            onClick={async () => {
                                                // Force re-submit presence signal before reload
                                                await addToWaitlistDB();
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
                                                <HeartsGameMaster onComplete={() => handleComplete(0)} user={userInfo} disableEngine={true} /> :
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
                        )
                        }
                    </AnimatePresence >
                </div >
            </div>

            {
                playingVideo && (
                    <div
                        className="fixed inset-0 z-[10000] bg-black cursor-pointer group"
                        onClick={() => {
                            if (playingVideo === 'start') {
                                setShowRules(false);
                                setWaitingForGM(true);
                            }
                            setPlayingVideo(null);
                            setVideoLoaded(false);
                        }}
                    >
                        {!videoLoaded && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center">
                                <Loader />
                            </div>
                        )}
                        <video
                            ref={videoRef}
                            src={`/${playingVideo}.mp4`}
                            autoPlay
                            playsInline
                            className={`w-full h-full object-cover transition-opacity duration-300 ${videoLoaded ? 'opacity-100' : 'opacity-0'}`}
                            onCanPlay={() => setVideoLoaded(true)}
                            onEnded={() => {
                                if (playingVideo === 'start') {
                                    setShowRules(false);
                                    setWaitingForGM(true);
                                }
                                setPlayingVideo(null);
                                setVideoLoaded(false);
                            }}
                        />
                        <div className="absolute bottom-8 right-8 text-red-500 font-bold font-mono text-sm sm:text-base tracking-widest uppercase animate-pulse drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]">
                            Tap anywhere to skip ➔
                        </div>
                    </div>
                )
            }


            {
                isPaused && (
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
                )
            }
        </div >
    );
};
