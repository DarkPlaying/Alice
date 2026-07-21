import React, { useState, useEffect, useRef } from 'react';
import { PlayerCache } from '../../lib/playerCache';
import { supabase, supabaseUrl, supabaseKey, getAccessToken } from '../../supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, AlertTriangle, ShieldCheck, Loader2, LogOut, X, Info, Scan, User, FastForward, Spade } from 'lucide-react';
import { PlayerCardModal } from '../PlayerCardModal';
import { DemoSpadesGame } from './DemoSpadesGame';
import {
    type PlayersMap,
    type RoundData,
    type SpadesPhase,
    type PresenceState,
    type PlayerState,
    validateBid,
    calculateProjectedScore,
    scoreCard,
} from '../../game/spades';

interface SpadesGameProps {
    onComplete: (score: number) => void;
    onFail: () => void;
    onClose?: () => void;
    user?: any;
}

const GAME_ID = 'spades_main';

export const SpadesGame: React.FC<SpadesGameProps> = ({ user, onComplete, onFail }) => {
    if (user?.role === 'demo') {
        return <DemoSpadesGame user={user} />;
    }

    // --- State ---
    const [phase, setPhase] = useState<SpadesPhase>('idle');
    const [round, setRound] = useState(1);
    const [timeLeft, setTimeLeft] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [players, setPlayers] = useState<PlayersMap>({});
    const [roundData, setRoundData] = useState<RoundData>({}); // Map of groupId -> Round Info
    const [_connectedPlayers, setConnectedPlayers] = useState<PresenceState[]>([]);

    // Local bid input state
    const [myBidInput, setMyBidInput] = useState('');
    const [_hostError, setHostError] = useState<string | null>(null); // Track host failures
    const [projectedScore, setProjectedScore] = useState(1000);
    const [bidError, setBidError] = useState('');

    // Modal states
    const [showTableModal, setShowTableModal] = useState(false);
    const [showPointsModal, setShowPointsModal] = useState(false);
    const [showRulesModal, setShowRulesModal] = useState(false);
    const [showHintModal, setShowHintModal] = useState(false);
    const [hintModalText, setHintModalText] = useState('');
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [pointsPage, setPointsPage] = useState(0);
    const [isScrolled, setIsScrolled] = useState(false);
    const [hasPlayedEndVideo, setHasPlayedEndVideo] = useState(false);

    useEffect(() => {
        if (phase === 'completed' && !hasPlayedEndVideo) {
            window.dispatchEvent(new CustomEvent('play-end-video'));
            setHasPlayedEndVideo(true);
        }
    }, [phase, hasPlayedEndVideo]);

    // Refs
    const myId = user?.id || 'PLAYER';
    const phaseStartedAtRef = useRef<Date | null>(null);
    const phaseDurationRef = useRef<number>(0);
    const bidDebounceRef = useRef<NodeJS.Timeout | null>(null);
    const isFetchingRef = useRef<boolean>(false);

    // --- Initial State Fetch ---
    useEffect(() => {
        const fetchState = async () => {
            if (isFetchingRef.current) return;
            isFetchingRef.current = true;
            try {
                // console.log('[SPADES PLAYER] fetchState() executing...');

                const accessToken = await getAccessToken();
                const response = await fetch(`${supabaseUrl}/rest/v1/spades_game_state?id=eq.${GAME_ID}&select=*`, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'apikey': supabaseKey,
                        'Accept': 'application/vnd.pgrst.object+json'
                    },
                    cache: 'no-store'
                });

                let data = null;
                let error = null;

                if (response.ok) {
                    data = await response.json();
                } else {
                    error = await response.text();
                }

                // console.log('[SPADES PLAYER] fetchState() completed! Data:', data, 'Error:', error);
                console.log('[SPADES PLAYER] fetchState() completed! Data:', data, 'Error:', error);

                if (error) {
                    console.error('[SPADES PLAYER] CRITICAL: Raw fetch failed:', error);
                    return;
                }

                if (data) {
                    syncState(data);
                }
            } catch (err) {
                console.error('[SPADES PLAYER] fetchState() THREW AN EXCEPTION:', err);
            } finally {
                isFetchingRef.current = false;
            }
        };

        fetchState();

        // Polling Fallback (Every 1s) to fix "stuck" states if Realtime fails
        // Aggressive polling ensures "Simulated Realtime" sync
        const pollInterval = setInterval(() => {
            // Only poll if tab is visible to save resources (optional, but good practice)
            if (!document.hidden) {
                // console.log('[SPADES PLAYER] Polling for state sync...');
                fetchState();
            }
        }, 1000);

        return () => clearInterval(pollInterval);
    }, []);

    // --- Realtime Subscription ---
    const userRef = useRef(user);
    useEffect(() => { userRef.current = user; }, [user]);

    useEffect(() => {
        console.log('[SPADES PLAYER] Setting up Realtime subscriptions...');
        const currentMyId = myId;

        const channel = supabase
            .channel('spades_player')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'spades_game_state',
                filter: `id=eq.${GAME_ID}`
            }, (payload) => {
                const newData = payload.new as any;
                if (newData) {
                    // console.log('[SPADES PLAYER] Realtime update:', newData.phase, newData.timer_display);
                    syncState(newData);
                }
            })
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                const presenceList: PresenceState[] = [];
                Object.values(state).forEach((presences: any) => {
                    presences.forEach((p: any) => {
                        if (p.userId) {
                            presenceList.push(p);
                        }
                    });
                });
                setConnectedPlayers(presenceList);
            })
            .subscribe(async (status) => {
                console.log(`[SPADES PLAYER] Subscription status: ${status}`);

                if (status === 'SUBSCRIBED') {
                    await channel.track({
                        userId: currentMyId,
                        name: userRef.current?.username || 'Player',
                        avatar: userRef.current?.avatar || null,
                        isAdmin: false
                    });
                }
            });

        return () => {
            console.log('[SPADES PLAYER] Cleaning up subscriptions');
            supabase.removeChannel(channel);
        };
    }, []); // Run once on mount, use refs for dynamic data

    // --- Auto-Join Logic ---
    useEffect(() => {
        if (!user?.id || phase === 'idle') return;

        // If game is active but we're not in players list, auto-join
        if (!players[user.id]) {
            const joinGame = async () => {
                let initialScore = 1000;

                // Fetch real profile points via Email (ID is unreliable)
                if (user.email) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('visa_points')
                        .eq('email', user.email)
                        .single();

                    if (profile?.visa_points !== undefined) {
                        initialScore = profile.visa_points;
                    }
                }

                // Fetch latest to avoid race
                const { data } = await supabase
                    .from('spades_game_state')
                    .select('players, current_round')
                    .eq('id', GAME_ID)
                    .single();

                const dbPlayers = data?.players || {};
                const dbRound = data?.current_round || 1;

                // If we are already in the DB, check for Score Mismatch (Fix for 1000 vs 1200 issue)
                if (dbPlayers[user.id]) {
                    console.log('[SPADES PLAYER] Found existing player record.');

                    // Integrity Check: Only fix score in ROUND 1 to prevent overriding legitimate gameplay changes
                    if (dbRound === 1 && dbPlayers[user.id].score === 1000) {
                        if (user.email) {
                            const { data: profile } = await supabase
                                .from('profiles')
                                .select('visa_points')
                                .eq('email', user.email)
                                .single();

                            if (profile?.visa_points !== undefined && profile.visa_points !== 1000) {
                                console.log(`[SPADES PLAYER] CORRECTING SCORE: 1000 -> ${profile.visa_points}`);
                                const correctedPlayers = {
                                    ...dbPlayers,
                                    [user.id]: { ...dbPlayers[user.id], score: profile.visa_points }
                                };
                                setPlayers(correctedPlayers);
                                await supabase
                                    .from('spades_game_state')
                                    .update({ players: correctedPlayers })
                                    .eq('id', GAME_ID);
                                return;
                            }
                        }
                    }

                    setPlayers(dbPlayers);
                    return;
                }

                const newPlayer: PlayerState = {
                    id: user.id,
                    username: user.username || 'PLAYER',
                    score: initialScore,
                    cards: [],
                    bid: null,
                    status: 'active',
                    groupId: null // Master/Host will assign
                };

                // Truly new player
                const updatedPlayers = { ...dbPlayers, [user.id]: newPlayer };
                setPlayers(updatedPlayers); // Optimistic

                await supabase
                    .from('spades_game_state')
                    .update({ players: updatedPlayers })
                    .eq('id', GAME_ID);
            };

            joinGame();
        }
    }, [phase, players, user]);

    // --- SELF-PERSISTENCE (BACKUP) ---
    // Ensure player score is saved to profile when game ends, even if Master/Host fails.
    const hasPersistedRef = useRef(false);
    useEffect(() => {
        const myPlayer = players[user?.id];
        if (phase === 'completed' && myPlayer && !hasPersistedRef.current) {
            hasPersistedRef.current = true;
            console.log('[SPADES PLAYER] Executing Self-Persistence...', myPlayer.score);

            const saveScore = async () => {
                if (user?.email) {
                    await supabase
                        .from('profiles')
                        .update({ visa_points: myPlayer.score })
                        .eq('email', user.email);
                    console.log('[SPADES PLAYER] Self-Persistence Complete.');
                }
            };
            saveScore();
        }
        // Reset persistence lock if game restarts
        if (phase !== 'completed') {
            hasPersistedRef.current = false;
        }
    }, [phase, players, user]);

    // --- SCORE INTEGRITY CHECK (Watcher) ---
    // Fixes the issue where a player syncs with a default 1000 score from the Master/DB
    // but actually has a different score in their profile.
    const hasCorrectedScoreRef = useRef(false);

    useEffect(() => {
        if (!user?.id || !players[user.id]) return;

        const myPlayer = players[user.id];

        // Always force-sync with Profile in Round 1 (Briefing/Shuffle/Idle) to ensure "Visa Container" source of truth
        // This fixes the issue where a player might have a stale score (e.g. 500) from a previous glitch
        const isStartPhase = ['idle', 'briefing', 'shuffle'].includes(phase);

        if (round === 1 && isStartPhase && !hasCorrectedScoreRef.current) {
            const verifyAndCorrectScore = async () => {
                console.log('[SPADES PLAYER] Verifying score integrity (Force Sync) for:', user.id);

                let userEmail = user.email;

                // Fallback: If email is missing in user object, fetch from users table
                if (!userEmail) {
                    console.log('[SPADES PLAYER] Email missing in user object. Fetching from DB...');
                    const { data: userData } = await supabase
                        .from('users')
                        .select('email')
                        .eq('id', user.id)
                        .single();

                    if (userData?.email) {
                        userEmail = userData.email;
                    } else {
                        console.warn('[SPADES PLAYER] Could not resolve email for user:', user.id);
                        // Do NOT set ref to true here, so we can retry on next render/update
                        return;
                    }
                }

                if (userEmail) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('visa_points')
                        .ilike('email', userEmail) // Use ilike for case-insensitivity
                        .single();

                    // If profile exists, we sync. Even if it's 1000, we prefer the profile's 1000.
                    if (profile?.visa_points !== undefined) {
                        const profileScore = profile.visa_points;

                        hasCorrectedScoreRef.current = true; // Mark as done only if we got a valid profile

                        // Check if we need to update (Mismatch OR missing start_score)
                        if (myPlayer.score !== profileScore || (myPlayer as any).start_score === undefined) {
                            console.log(`[SPADES PLAYER] SYNCING SCORE: Game(${myPlayer.score}) -> Profile(${profileScore})`);

                            const { data: latestState } = await supabase
                                .from('spades_game_state')
                                .select('players')
                                .eq('id', GAME_ID)
                                .single();

                            if (latestState?.players) {
                                const latestPlayers = latestState.players;
                                const correctedPlayers = {
                                    ...latestPlayers,
                                    [user.id]: {
                                        ...latestPlayers[user.id],
                                        score: profileScore,
                                        start_score: profileScore // Track original score for "Revert" capability
                                    }
                                };

                                // Optimistic Update
                                setPlayers(correctedPlayers);

                                await supabase
                                    .from('spades_game_state')
                                    .update({ players: correctedPlayers })
                                    .eq('id', GAME_ID);

                                console.log('[SPADES PLAYER] Score Synced & Start Score Recorded.');
                            }
                        } else {
                            console.log('[SPADES PLAYER] Score verified and synced.');
                        }
                    }
                }
            };

            verifyAndCorrectScore();
        }
    }, [players[user?.id]?.score, round, phase, user]);

    const phaseRef = useRef(phase);
    const roundRef = useRef(round);

    // Keep refs in sync with state for Stale Closure Fix in Subscription
    useEffect(() => {
        phaseRef.current = phase;
        roundRef.current = round;
    }, [phase, round]);

    const bidInitializedRef = useRef(false);

    // --- Sync State from Database ---
    const syncState = (data: any) => {
        const currentPhase = phaseRef.current;
        const currentRound = roundRef.current;

        if (data.phase && data.phase !== currentPhase) setPhase(data.phase);
        if (data.current_round && data.current_round !== currentRound) {
            setRound(data.current_round);
            bidInitializedRef.current = false; // Reset for new round
        }

        // Deep compare to avoid re-renders (Fixes Input Glitch)
        if (data.players && JSON.stringify(data.players) !== JSON.stringify(players)) {
            setPlayers(data.players);

            // Update my bid input ONLY one time (initial load) OR if phase is not bidding
            // This prevents overwriting user input while they type/delete
            if (data.players[myId]) {
                const myPlayer = data.players[myId];
                // Update my bid input ONLY one time (initial load) OR if phase is not bidding
                if (myPlayer) {
                    if (myPlayer.bid !== null && myPlayer.bid !== undefined) {
                        if (!bidInitializedRef.current || currentPhase !== 'bidding') {
                            setMyBidInput(String(myPlayer.bid));
                            bidInitializedRef.current = true;
                        }
                    }
                }
            }
        }

        if (data.round_data && JSON.stringify(data.round_data) !== JSON.stringify(roundData)) {
            setRoundData(data.round_data || {});
        }

        if (data.is_paused !== undefined) setIsPaused(data.is_paused);

        // Prevent reverting to an older state due to read replica lag
        if (data.phase_started_at && phaseStartedAtRef.current) {
            let dStr = data.phase_started_at.replace(' ', 'T');
            if (dStr.match(/[+-]\d{2}$/)) dStr += ':00';

            if (!dStr.endsWith('Z') && !dStr.match(/[+-]\d{2}:?\d{2}$/)) dStr += 'Z';
            const fetchedStart = new Date(dStr);
            if (fetchedStart.getTime() < phaseStartedAtRef.current.getTime()) {
                return; // Ignore stale data
            }
        }

        // Sync timer
        if (data.phase_started_at && data.phase_duration_sec) {
            // Only update refs, don't trigger render unless needed
            let dStr = data.phase_started_at.replace(' ', 'T');
            if (dStr.match(/[+-]\d{2}$/)) dStr += ':00';

            if (!dStr.endsWith('Z') && !dStr.match(/[+-]\d{2}:?\d{2}$/)) dStr += 'Z';
            const newStart = new Date(dStr);
            if (newStart.getTime() !== phaseStartedAtRef.current?.getTime()) {
                console.log('[SPADES PLAYER] Syncing Timer:', data.phase_started_at);
                phaseStartedAtRef.current = newStart;
                phaseDurationRef.current = data.phase_duration_sec;
            }
        }
    };


    // --- HOST LOGIC (Removed, now managed by SpadesGameMaster on Admin Dashboard) ---


    // --- Timer (Client-side countdown) ---
    useEffect(() => {
        if (phase === 'idle' || phase === 'completed') return;

        const timer = setInterval(() => {
            if (isPaused) return;

            const startedAt = phaseStartedAtRef.current;
            const duration = phaseDurationRef.current;

            if (startedAt && duration > 0) {
                const now = new Date();
                const elapsed = Math.floor((now.getTime() - startedAt.getTime()) / 1000);
                const remaining = Math.max(0, duration - elapsed);
                setTimeLeft(remaining);
            }
        }, 100); // 100ms for accurate visual sync

        return () => clearInterval(timer);
    }, [phase, isPaused]);

    // --- Bid Input Handling ---
    const handleBidChange = (value: string) => {
        let sanitizedValue = value.replace(/^0+(?=\d)/, '');
        setMyBidInput(sanitizedValue);
        setBidError('');

        const numericBid = parseInt(sanitizedValue);
        if (isNaN(numericBid) || numericBid < 0) {
            setProjectedScore(players[myId]?.score || 1000);
            return;
        }

        const currentScore = players[myId]?.score || 1000;

        // Validate bid
        if (!validateBid(currentScore, numericBid)) {
            setBidError('Bid exceeds your current score!');
            setProjectedScore(currentScore);
            return;
        }

        // Calculate projected score
        const projected = calculateProjectedScore(currentScore, numericBid);
        setProjectedScore(projected);
    };

    const submitBid = () => {
        const numericBid = parseInt(myBidInput);
        if (isNaN(numericBid) || numericBid < 0) {
            setBidError('Invalid bid amount');
            return;
        }

        const currentScore = players[myId]?.score || 1000;
        if (!validateBid(currentScore, numericBid)) {
            setBidError('Bid exceeds your current score!');
            return;
        }

        updateBidInDatabase(numericBid);
    };

    const updateBidInDatabase = async (bidAmount: number) => {
        try {
            const accessToken = await getAccessToken();

            // Fetch latest players to avoid overwrite
            const fetchRes = await fetch(`${supabaseUrl}/rest/v1/spades_game_state?id=eq.${GAME_ID}&select=players`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'apikey': supabaseKey,
                    'Accept': 'application/vnd.pgrst.object+json'
                }
            });

            if (!fetchRes.ok) return;
            const data = await fetchRes.json();

            if (data?.players) {
                const updatedPlayers = { ...data.players };
                if (updatedPlayers[myId]) {
                    updatedPlayers[myId] = {
                        ...updatedPlayers[myId],
                        bid: bidAmount
                    };

                    await fetch(`${supabaseUrl}/rest/v1/spades_game_state?id=eq.${GAME_ID}`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${accessToken}`,
                            'apikey': supabaseKey,
                            'Prefer': 'return=minimal'
                        },
                        body: JSON.stringify({ players: updatedPlayers })
                    });
                }
            }
        } catch (e) {
            console.error('Error updating bid:', e);
        }
    };

    // --- Reset/Termination Handling ---
    const [isTerminated, setIsTerminated] = useState(false);
    const hasStartedRef = useRef(false);

    useEffect(() => {
        if (phase !== 'idle') {
            hasStartedRef.current = true;
        }
        if (hasStartedRef.current && phase === 'idle') {
            setIsTerminated(true);
            setTimeout(() => {
                window.location.href = '/home/card';
            }, 3000);
        }
    }, [phase]);

    // --- Global Player ID Mapping (Admin Consistency) ---
    const [globalIdMap, setGlobalIdMap] = useState<Record<string, string>>({});

    const loadGlobalPlayers = async () => {
        let allPlayers = PlayerCache.get();

        if (!allPlayers) {
            console.log('[SPADES] Global Player Cache miss, fetching...');
            try {
                const { data, error } = await supabase.from('profiles').select('*');
                if (error) throw error;
                allPlayers = data || [];

                // MATCH ADMIN DASHBOARD SORT EXACTLY
                allPlayers.sort((a: any, b: any) => {
                    const isMasterA = a.role === 'master' || a.role === 'admin' || a.username === 'admin';
                    const isMasterB = b.role === 'master' || b.role === 'admin' || b.username === 'admin';

                    if (isMasterA && !isMasterB) return -1;
                    if (!isMasterA && isMasterB) return 1;

                    const timeA = new Date(a.created_at || 0).getTime();
                    const timeB = new Date(b.created_at || 0).getTime();
                    return timeA - timeB;
                });

                // Cache the result
                PlayerCache.set(allPlayers);
            } catch (err) {
                console.error('[SPADES] Failed to load global players for ID mapping', err);
            }
        }

        if (allPlayers) {
            // INJECTION FIX: Ensure 'admin' exists for ID consistency
            const hasAdmin = allPlayers.some((p: any) => p.username === 'admin' || p.role === 'admin');
            if (!hasAdmin) {
                allPlayers.push({
                    id: 'system_admin_placeholder',
                    username: 'admin',
                    role: 'admin',
                    createdAt: { seconds: 0 } // Oldest possible time
                });
            }

            // FORCE SORT to match Admin Dashboard (Masters -> Join Date)
            allPlayers.sort((a: any, b: any) => {
                const isMasterA = a.role === 'master' || a.role === 'admin' || a.username === 'admin';
                const isMasterB = b.role === 'master' || b.role === 'admin' || b.username === 'admin';

                if (isMasterA && !isMasterB) return -1;
                if (!isMasterA && isMasterB) return 1;

                // Robust Time Helper
                const getTime = (p: any) => {
                    if (typeof p.createdAt === 'number') return p.createdAt;
                    if (!p.createdAt) return 0;
                    if (p.createdAt.seconds) return p.createdAt.seconds * 1000;
                    if (typeof p.createdAt.toMillis === 'function') return p.createdAt.toMillis();
                    if (p.createdAt instanceof Date) return p.createdAt.getTime();
                    if (typeof p.createdAt === 'string') {
                        const d = new Date(p.createdAt);
                        return isNaN(d.getTime()) ? 0 : d.getTime();
                    }
                    return 0;
                };

                return getTime(a) - getTime(b);
            });

            const map: Record<string, string> = {};
            allPlayers.forEach((p: any, idx: number) => {
                const rawName = p.username || p.displayName || `#PLAYER_${String(idx + 1).padStart(3, '0')}`;
                let pid = rawName.toUpperCase();
                if (/^PLAYER\d+$/.test(pid)) {
                    pid = pid.replace('PLAYER', 'PLAYER ');
                }
                if (p.id) map[p.id] = pid;
                if (p.uid) map[p.uid] = pid;
            });
            setGlobalIdMap(map);
        }
    };

    useEffect(() => {
        loadGlobalPlayers();
    }, []);

    // Reload players on mount AND whenever the game restarts (briefing phase)
    useEffect(() => {
        if (phase === 'briefing') {
            PlayerCache.clear(); // Force bypass of memory cache
            loadGlobalPlayers();
        }
    }, [phase]);

    // Force reload if a player is missing during an active game (fixes "stuck on loading" bug)
    useEffect(() => {
        if (!players[myId] && phase !== 'idle' && phase !== 'completed') {
            console.log('[SPADES PLAYER] Player missing from cache! Forcing reload...');
            PlayerCache.clear();
            loadGlobalPlayers();
        }
    }, [players, myId, phase]);

    // --- Player ID Mapping (Memoized for Render) ---
    const playerIdMap = React.useMemo(() => {
        const uids = Object.keys(players).sort();
        const newMap: Record<string, string> = {};
        uids.forEach((uid, idx) => {
            // Priority: Global Map (Admin ID) -> Local Map (Session ID)
            if (globalIdMap[uid]) {
                newMap[uid] = globalIdMap[uid];
            } else {
                const p = players[uid];
                const rawName = p?.username || `#PLAYER_${String(idx + 1).padStart(3, '0')}`;
                let pid = String(rawName).toUpperCase();
                if (/^PLAYER\d+$/.test(pid)) {
                    pid = pid.replace('PLAYER', 'PLAYER ');
                }
                newMap[uid] = pid;
            }
        });
        return newMap;
    }, [players, globalIdMap]);

    const myPlayer = players[myId];

    // --- Render: Termination ---
    if (isTerminated) {
        return (
            <div className="fixed inset-0 bg-black z-50 flex items-center justify-center p-4">
                <div className="text-center space-y-6">
                    <AlertTriangle className="w-24 h-24 text-red-600 mx-auto animate-pulse" />
                    <h1 className="text-4xl font-black text-red-600 tracking-widest uppercase">
                        PROTOCOL TERMINATED
                    </h1>
                    <p className="text-red-400 font-mono text-sm">
                        [System Integrity Failure] Connection Severed.
                    </p>
                </div>
            </div>
        );
    }

    // --- Render: Idle ---
    if (phase === 'idle') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white font-mono">
                <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
                <h2 className="text-xl font-bold tracking-[0.2em] animate-pulse text-center px-4">
                    CONNECTING TO NEURAL LINK...
                </h2>
                <div className="mt-8 text-xs text-slate-500">
                    STATUS: <span className="text-blue-500">WAITING FOR SIGNAL</span>
                </div>
            </div>
        );
    }

    // --- Render: Connecting ---
    // If we don't have player data yet, show loading screen
    if (!myPlayer) {
        return (
            <div className="text-white text-center mt-20 font-mono">
                CONNECTING TO NEURAL LINK...
            </div>
        );
    }

    // --- Derived State for Group Rendering ---
    const myGroupId = myPlayer?.groupId;
    const localRoundData = (myGroupId && roundData[myGroupId]) ? roundData[myGroupId] : {
        target_card: null,
        hint: null,
        winner_id: null,
        ties: []
    };

    // --- Main Game UI ---

    return (
        <div
            className="w-full h-full text-white font-sans overflow-y-auto relative selection:bg-blue-500/30 bg-black/40 backdrop-blur-md"
            onScroll={(e) => setIsScrolled(e.currentTarget.scrollTop > 10)}
        >

            {/* PAUSED OVERLAY */}
            <AnimatePresence>
                {isPaused && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 space-y-6"
                    >
                        <ShieldCheck size={80} className="text-yellow-500 animate-pulse" />
                        <h1 className="text-2xl sm:text-5xl font-black font-display text-yellow-500 tracking-[0.1em] sm:tracking-[0.2em] uppercase drop-shadow-[0_0_20px_rgba(234,179,8,0.5)] text-center px-4">
                            PROTOCOL HOLD
                        </h1>
                        <div className="h-px w-32 bg-yellow-500/50" />
                        <p className="text-yellow-200/80 font-mono text-sm sm:text-lg text-center max-w-md leading-relaxed tracking-wider">
                            SYSTEM INTERVENTION IN PROGRESS.<br />
                            <span className="text-sm opacity-60">PLEASE STAND BY FOR ADMINISTRATOR SIGNAL.</span>
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* TABLE Modal - Member List */}
            <AnimatePresence>
                {showTableModal && (
                    <motion.div
                        initial={{ opacity: 0, x: 300 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 300 }}
                        className="fixed right-4 top-24 sm:top-28 z-[110] bg-black/95 backdrop-blur-md border border-blue-500/30 rounded-lg p-4 shadow-2xl w-[200px] sm:w-[250px]"
                    >
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-blue-500/30">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                                <span className="text-[10px] font-mono text-blue-400 uppercase tracking-wider">
                                    TABLE {myGroupId || '?'}
                                </span>
                            </div>
                            <button
                                onClick={() => setShowTableModal(false)}
                                className="text-white/50 hover:text-white transition-colors"
                            >
                                ✕
                            </button>
                        </div>
                        <div
                            className="space-y-2 max-h-[300px] overflow-y-auto"
                            style={{
                                scrollbarWidth: 'thin',
                                scrollbarColor: '#3b82f6 rgba(30, 58, 138, 0.2)'
                            } as any}
                        >
                            {Object.values(players || {})
                                .filter(p => p.groupId === myGroupId)
                                .map(p => (
                                    <div
                                        key={p.id}
                                        className={`flex items-center justify-between p-2.5 rounded transition-all ${p.id === myId
                                            ? 'bg-blue-500/30 border border-blue-500/50 shadow-lg shadow-blue-500/20'
                                            : 'bg-white/5'
                                            }`}
                                    >
                                        <span className={`text-[10px] font-mono uppercase font-semibold truncate ${p.id === myId ? 'text-blue-300' : 'text-slate-400'
                                            }`}>
                                            {playerIdMap[p.id] || `P_${p.id.slice(0, 3)}`}
                                        </span>
                                        <span className={`text-sm font-bold tabular-nums ${p.id === myId ? 'text-blue-300' : 'text-white'
                                            }`}>
                                            {p.score}
                                        </span>
                                    </div>
                                ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* POINTS TABLE Modal - Full Leaderboard */}
            <AnimatePresence>
                {showPointsModal && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setShowPointsModal(false)}
                    >
                        <motion.div
                            initial={{ y: 50 }}
                            animate={{ y: 0 }}
                            className="bg-black/95 border border-yellow-500/30 rounded-xl p-6 max-w-md w-full"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-4 pb-3 border-b border-yellow-500/30">
                                <h2 className="text-xl font-black font-oswald text-yellow-500 uppercase tracking-wider">
                                    Points Table
                                </h2>
                                <button
                                    onClick={() => setShowPointsModal(false)}
                                    className="text-white/50 hover:text-white transition-colors text-xl"
                                >
                                    ✕
                                </button>
                            </div>
                            <div
                                className="space-y-2 max-h-[400px] overflow-y-auto"
                                style={{
                                    scrollbarWidth: 'thin',
                                    scrollbarColor: '#eab308 rgba(133, 77, 14, 0.2)'
                                } as any}
                            >

                                {(() => {
                                    // 1. Get Sorted List
                                    const allSorted = Object.values(players || {}).sort((a: any, b: any) => b.score - a.score);

                                    // 2. Identify Current User
                                    const myself = allSorted.find((p: any) => p.id === myId);
                                    const others = allSorted.filter((p: any) => p.id !== myId);

                                    // 3. Pagination Logic (5 per page)
                                    const ITEMS_PER_PAGE = 5;
                                    const totalPages = Math.ceil(others.length / ITEMS_PER_PAGE);
                                    const paginatedOthers = others.slice(pointsPage * ITEMS_PER_PAGE, (pointsPage + 1) * ITEMS_PER_PAGE);

                                    // Helper to render a player row
                                    const renderRow = (p: any, originalIndex: number, isMe: boolean) => (
                                        <div
                                            key={p.id}
                                            className={`flex flex-col p-3 rounded transition-all ${isMe
                                                ? 'bg-yellow-500/20 border border-yellow-500/50 shadow-lg mb-4 sticky top-0 z-10 backdrop-blur-md'
                                                : 'bg-white/5 hover:bg-white/10'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between w-full">
                                                <div className="flex items-center gap-3">
                                                    <span className={`text-lg font-black w-6 ${originalIndex === 0 ? 'text-yellow-500' :
                                                        originalIndex === 1 ? 'text-slate-400' :
                                                            originalIndex === 2 ? 'text-orange-600' :
                                                                'text-white/50'
                                                        }`}>
                                                        {originalIndex + 1}
                                                    </span>
                                                    <div className="flex flex-col">
                                                        <span className={`text-sm font-mono uppercase font-semibold ${isMe ? 'text-yellow-300' : 'text-white'
                                                            }`}>
                                                            {playerIdMap[p.id] || `P_${p.id.slice(0, 3)}`}
                                                        </span>
                                                        {isMe && (
                                                            <span className="text-[8px] text-yellow-500 uppercase">YOU</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className={`text-xl font-black tabular-nums ${isMe ? 'text-yellow-400' : 'text-white'
                                                    }`}>
                                                    {p.score}
                                                </span>
                                            </div>

                                            {/* Show Collected Cards */}
                                            {p.cards && p.cards.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-2 pl-9">
                                                    {p.cards.map((c: any, i: number) => (
                                                        <div key={i} className="relative w-6 h-9 rounded-[2px] border border-white/10 overflow-hidden bg-black/40">
                                                            <img
                                                                src={`/borderland_cards/${c.suit.charAt(0).toUpperCase() + c.suit.slice(1)}_${c.rank}.png`}
                                                                className="w-full h-full object-cover"
                                                                alt={`${c.rank} of ${c.suit}`}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );

                                    return (
                                        <>
                                            {/* Pinned User */}
                                            {myself && renderRow(myself, allSorted.indexOf(myself), true)}

                                            {/* Divider if myself is present */}
                                            {myself && <div className="h-px bg-white/10 my-2" />}

                                            {/* Paginated Others */}
                                            {paginatedOthers.map((p: any) => renderRow(p, allSorted.indexOf(p), false))}

                                            {/* Pagination Controls */}
                                            {others.length > ITEMS_PER_PAGE && (
                                                <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/10">
                                                    <button
                                                        onClick={() => setPointsPage(Math.max(0, pointsPage - 1))}
                                                        disabled={pointsPage === 0}
                                                        className="px-3 py-1.5 text-[10px] bg-white/5 disabled:opacity-30 rounded hover:bg-white/10 transition-colors"
                                                    >
                                                        PREV
                                                    </button>
                                                    <span className="text-[10px] text-white/40">
                                                        PAGE {pointsPage + 1} / {totalPages}
                                                    </span>
                                                    <button
                                                        onClick={() => setPointsPage(Math.min(totalPages - 1, pointsPage + 1))}
                                                        disabled={pointsPage === totalPages - 1}
                                                        className="px-3 py-1.5 text-[10px] bg-white/5 disabled:opacity-30 rounded hover:bg-white/10 transition-colors"
                                                    >
                                                        NEXT
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* PLAYER PROFILE MODAL */}
            {showProfileModal && (
                <PlayerCardModal
                    user={user}
                    onClose={() => setShowProfileModal(false)}
                    currentGameScore={myPlayer?.score}
                />
            )}

            {/* SCORING RULES Modal */}
            <AnimatePresence>
                {showHintModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
                        onClick={() => setShowHintModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 10 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 10 }}
                            className="bg-zinc-950 border border-white/10 rounded-2xl p-6 sm:p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Spade className="text-blue-500 mb-4" size={32} />
                            <h3 className="text-sm sm:text-base font-black font-mono text-blue-400 tracking-widest uppercase mb-4">
                                HINT SIGNAL
                            </h3>
                            <p className="text-xs sm:text-sm text-gray-300 font-mono mb-6 whitespace-pre-line">
                                {hintModalText}
                            </p>
                            <button
                                onClick={() => setShowHintModal(false)}
                                className="px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded transition-all text-xs font-bold uppercase tracking-widest text-white w-full"
                            >
                                CLOSE
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showRulesModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
                        onClick={() => setShowRulesModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            className="bg-zinc-950 border border-white/10 p-6 rounded-2xl max-w-sm w-full shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-6 pb-2 border-b border-white/5">
                                <h3 className="text-xl font-oswald font-black text-white uppercase tracking-widest flex items-center gap-2">
                                    <AlertTriangle size={20} className="text-yellow-500" /> SCORING RULES
                                </h3>
                                <button onClick={() => setShowRulesModal(false)} className="text-white/40 hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>
                            <ul className="space-y-4">
                                <li className="flex justify-between items-center bg-white/5 p-3 rounded border border-white/5">
                                    <span className="text-xs font-mono text-slate-400 uppercase">Red (Non-Face)</span>
                                    <span className="text-green-400 font-bold font-oswald text-lg">+600</span>
                                </li>
                                <li className="flex justify-between items-center bg-white/5 p-3 rounded border border-white/5">
                                    <span className="text-xs font-mono text-slate-400 uppercase">Black (Non-Face)</span>
                                    <span className="text-red-400 font-bold font-oswald text-lg">-100</span>
                                </li>
                                <li className="flex justify-between items-center bg-white/5 p-3 rounded border border-white/5">
                                    <span className="text-xs font-mono text-slate-400 uppercase">Black Face</span>
                                    <span className="text-yellow-400 font-bold font-oswald text-lg">+1000</span>
                                </li>
                                <li className="flex justify-between items-center bg-white/5 p-3 rounded border border-white/5">
                                    <span className="text-xs font-mono text-slate-400 uppercase">Red Face</span>
                                    <span className="text-red-500 font-bold font-oswald text-lg">-500</span>
                                </li>
                                <li className="flex justify-between items-center pt-2 mt-2 border-t border-white/10">
                                    <span className="text-[10px] font-mono text-slate-500 uppercase">0 Cards Penalty</span>
                                    <span className="text-red-500 font-bold font-oswald">-500</span>
                                </li>
                            </ul>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header / HUD */}
            <header className={`fixed top-0 left-0 right-0 z-[100] border-b border-white/10 px-4 py-3 sm:px-8 sm:py-4 transition-all duration-300 ${isScrolled ? 'bg-black/90 backdrop-blur-xl' : 'bg-transparent'}`}>
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    {/* Left: Brand / Title */}
                    <div className="flex flex-col">
                        <h2 className="text-[10px] sm:text-xs font-cinzel font-black text-blue-500 tracking-[0.3em] uppercase leading-none mb-1">
                            SPADES TRIAL
                        </h2>
                        <h1 className="text-sm sm:text-lg font-black font-oswald text-white tracking-widest uppercase leading-none">
                            SURVIVAL AUCTION
                        </h1>
                    </div>

                    {/* Right: Controls & Score */}
                    <div className="flex gap-2 sm:gap-4 flex-wrap justify-end">
                        <button
                            onClick={() => {
                                const current = localStorage.getItem('skipVideos') === 'true';
                                localStorage.setItem('skipVideos', String(!current));
                                window.dispatchEvent(new CustomEvent('skip-videos-toggled', { detail: !current }));
                                // Force re-render of this button to reflect state
                                setIsScrolled(prev => !prev);
                                setTimeout(() => setIsScrolled(prev => !prev), 10);
                            }}
                            className={`p-2 sm:px-4 sm:py-2 border text-[8px] sm:text-[10px] font-bold uppercase tracking-widest transition-all rounded flex items-center justify-center ${localStorage.getItem('skipVideos') === 'true' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'border-white/20 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white'}`}
                        >
                            <span className="hidden sm:inline">Skip Intro: {localStorage.getItem('skipVideos') === 'true' ? 'ON' : 'OFF'}</span>
                            <FastForward size={18} className="sm:hidden" />
                        </button>

                        <button
                            onClick={() => setShowProfileModal(true)}
                            className="p-2 sm:px-4 sm:py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-white transition-all active:scale-95"
                        >
                            <span className="hidden sm:inline font-mono text-[11px] tracking-widest uppercase">PROFILE</span>
                            <User size={18} className="sm:hidden" />
                        </button>

                        <button
                            onClick={() => setShowRulesModal(true)}
                            className="p-2 sm:px-4 sm:py-2 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 rounded text-yellow-500 transition-all active:scale-95"
                        >
                            <span className="hidden sm:inline font-mono text-[11px] tracking-widest uppercase">RULES</span>
                            <Info size={18} className="sm:hidden" />
                        </button>

                        <button
                            onClick={() => setShowPointsModal(true)}
                            className="p-2 sm:px-4 sm:py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded text-blue-500 transition-all active:scale-95"
                        >
                            <span className="hidden sm:inline font-mono text-[11px] tracking-widest uppercase">SCORE</span>
                            <Scan size={18} className="sm:hidden" />
                        </button>


                    </div>
                </div>

                {/* Sub-Header HUD (Mobile Standardized) */}
                <div className="max-w-7xl mx-auto mt-3 pt-3 border-t border-white/5 flex items-center justify-around sm:justify-end sm:gap-8">
                    {/* ROUND */}
                    <div className="flex flex-col items-center sm:items-end">
                        <p className="text-[7px] sm:text-[9px] text-slate-500 font-mono uppercase tracking-[0.2em]">ROUND</p>
                        <p className="text-sm sm:text-xl font-black font-oswald text-white">
                            {round}<span className="text-slate-600 text-[10px] sm:text-sm">/5</span>
                        </p>
                    </div>

                    <div className="w-px h-6 bg-white/10 sm:hidden" />

                    {/* HINT BUTTON IN HUB */}
                    <button
                        onClick={() => {
                            if (phase !== 'hint' && phase !== 'bidding') {
                                setHintModalText('No hint available at this time.');
                                setShowHintModal(true);
                                return;
                            }
                            if (!localRoundData || (!localRoundData.hint && !localRoundData.target_card)) {
                                setHintModalText('Awaiting signal...');
                                setShowHintModal(true);
                                return;
                            }
                            let hintText = localRoundData.hint || 'Signal corrupted.';
                            if (localRoundData.target_card && localRoundData.target_card.suit.toLowerCase() === 'clubs') {
                                hintText = `${localRoundData.target_card.rank} OF CLUBS`;
                            }
                            setHintModalText(hintText);
                            setShowHintModal(true);
                        }}
                        className="flex flex-col items-center justify-center bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 px-3 py-1 sm:px-4 sm:py-1.5 rounded transition-all active:scale-95"
                    >
                        <p className="text-[7px] sm:text-[9px] text-purple-400/70 font-mono uppercase tracking-[0.2em]">SIGNAL</p>
                        <p className="text-sm sm:text-xl font-black font-oswald text-purple-400 tracking-wider">HINT</p>
                    </button>

                    <div className="w-px h-6 bg-white/10 sm:hidden" />

                    {/* TIMER */}
                    <div className="flex flex-col items-center sm:items-end">
                        <p className="text-[7px] sm:text-[9px] text-slate-500 font-mono uppercase tracking-[0.2em]">TIMER</p>
                        <div className="flex items-center gap-1.5">
                            <Timer size={12} className="text-red-500 animate-pulse sm:w-4 sm:h-4" />
                            <p className="text-sm sm:text-xl font-black font-oswald tabular-nums text-red-500">
                                {`${String(Math.floor(timeLeft / 60)).padStart(2, '0')}:${String(timeLeft % 60).padStart(2, '0')}`}
                            </p>
                        </div>
                    </div>

                    <div className="w-px h-6 bg-white/10 sm:hidden" />

                    {/* BALANCE */}
                    <div className="flex flex-col items-center sm:items-end bg-blue-500/10 px-3 py-1 sm:px-4 sm:py-1.5 rounded border border-blue-500/20">
                        <p className="text-[7px] sm:text-[9px] text-blue-400/70 font-mono uppercase tracking-[0.2em]">BALANCE</p>
                        <p className="text-sm sm:text-xl font-black font-oswald text-blue-400">
                            {myPlayer?.score ?? 0}
                        </p>
                    </div>
                </div>
            </header>

            {/* Main Game Area */}
            <main className="relative z-10 container mx-auto px-4 pt-32 sm:pt-36 pb-40 flex-1 flex flex-col">

                {/* Persistent Scoring Sidebar (Desktop) - Centered Vertically */}
                <div className="fixed left-8 top-1/2 -translate-y-1/2 hidden lg:block w-64 p-5 bg-black/40 border border-slate-800 rounded-lg backdrop-blur-sm z-50">
                    <h3 className="text-slate-500 font-mono text-[10px] uppercase tracking-widest mb-3 border-b border-slate-800 pb-2 flex items-center gap-2">
                        <AlertTriangle size={12} /> Scoring Rules
                    </h3>
                    <ul className="space-y-3 text-xs font-mono text-slate-300">
                        <li className="flex justify-between items-center">
                            <span>Red (Non-Face)</span>
                            <span className="text-green-400 font-bold tabular-nums">+600</span>
                        </li>
                        <li className="flex justify-between items-center">
                            <span>Black (Non-Face)</span>
                            <span className="text-red-400 font-bold tabular-nums">-100</span>
                        </li>
                        <li className="flex justify-between items-center">
                            <span>Black Face</span>
                            <span className="text-yellow-400 font-bold tabular-nums">+1000</span>
                        </li>
                        <li className="flex justify-between items-center">
                            <span>Red Face</span>
                            <span className="text-red-500 font-bold tabular-nums">-500</span>
                        </li>
                        <li className="flex justify-between items-center pt-2 border-t border-slate-800/50 mt-1">
                            <span className="opacity-75">0 Cards Penalty</span>
                            <span className="text-red-500 font-bold tabular-nums">-500</span>
                        </li>
                    </ul>
                </div>

                <AnimatePresence mode="wait">
                    {/* Shuffle Phase */}
                    {phase === 'shuffle' && (
                        <motion.div
                            key="shuffle"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.1 }}
                            className="flex flex-col items-center justify-center space-y-12 mt-4 sm:mt-24"
                        >
                            <h2 className="text-xs sm:text-sm font-mono text-yellow-500 tracking-widest uppercase mb-2 animate-pulse">
                                SYSTEM RECONFIGURATION
                            </h2>
                            <h1 className="text-3xl sm:text-6xl font-black font-display text-white tracking-tighter drop-shadow-xl text-center px-4">
                                SHUFFLING TEAMS
                            </h1>
                            <div className="w-16 h-1 bg-yellow-500/50 rounded-full overflow-hidden">
                                <div className="w-full h-full bg-yellow-400 animate-loading-bar" />
                            </div>
                        </motion.div>
                    )}

                    {/* Briefing Phase */}
                    {phase === 'briefing' && (
                        <motion.div
                            key="briefing"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-black/40 border border-blue-900/30 p-8 sm:p-12 max-w-3xl mx-auto backdrop-blur-sm rounded-lg mt-4 sm:mt-20 w-full shadow-2xl"
                        >
                            <h2 className="text-2xl sm:text-4xl font-black font-cinzel text-blue-500 mb-6 sm:mb-8 text-center tracking-[0.1em] sm:tracking-[0.2em] drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                                PROTOCOL BRIEFING
                            </h2>
                            <div className="space-y-6 text-sm font-mono text-slate-300 leading-relaxed">
                                {myGroupId ? (
                                    <div className="p-4 bg-yellow-500/10 border-l-2 border-yellow-500 mb-4">
                                        <h3 className="text-white font-bold mb-2">TABLE ASSIGNMENT: {myGroupId}</h3>
                                        <p>You have been paired with {Object.values(players).filter(p => p.groupId === myGroupId && p.id !== myId).length} other operative(s).</p>
                                    </div>
                                ) : (
                                    <div className="p-4 bg-slate-800 border-l-2 border-slate-500 mb-4 animate-pulse">
                                        ASSIGNING TABLE...
                                    </div>
                                )}
                                <div className="p-4 bg-blue-900/10 border-l-2 border-blue-500">
                                    <h3 className="text-white font-bold flex items-center gap-2 mb-2">
                                        <ShieldCheck size={16} /> OBJECTIVE
                                    </h3>
                                    <p className="mb-2">
                                        Win cards through strategic bidding. You have 5 rounds to collect cards and maximize your score.
                                    </p>
                                    <p className="text-blue-300">
                                        <strong>NOTE:</strong> In Rounds 2 and 4, the actual card will be revealed during the target analysis phase.
                                    </p>
                                </div>
                                <div className="p-4 bg-red-900/10 border-l-2 border-red-500">
                                    <h3 className="text-white font-bold mb-2">SCORING</h3>
                                    <ul className="space-y-1 text-xs">
                                        <li>• Red cards (Non-Face): <span className="text-green-400">+600 points</span></li>
                                        <li>• Black cards (Non-Face): <span className="text-red-400">-100 points</span></li>
                                        <li>• Black Face Cards: <span className="text-yellow-400">+1000 points</span></li>
                                        <li>• Red Face Cards: <span className="text-red-500">-500 points</span></li>
                                        <li>• End game with 0 cards: <span className="text-red-500">-500 penalty</span></li>
                                    </ul>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Hint Phase */}
                    {phase === 'hint' && (
                        <div className="flex flex-col items-center justify-center space-y-12 mt-4 sm:mt-24">
                            <div className="text-center">
                                <h2 className="text-sm font-mono text-blue-400 tracking-widest uppercase mb-2">
                                    INCOMING DATA STREAM
                                </h2>
                                <h1 className="text-3xl sm:text-6xl font-black font-display text-white tracking-tighter drop-shadow-xl animate-pulse text-center px-4">
                                    TARGET ANALYSIS
                                </h1>
                            </div>
                            <div className="bg-black/60 border border-blue-500/30 p-8 rounded-xl backdrop-blur-md max-w-xl w-full text-center shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                                <p className="text-xs text-slate-500 font-mono mb-4">
                                    {(round === 2 || round === 4) ? 'PRECISE TARGET LOCK:' : 'DECRYPTED SIGNAL FRAGMENT:'}
                                </p>
                                <div className="flex flex-col items-center gap-4">
                                    {(round === 2 || round === 4) && localRoundData?.target_card ? (
                                        <>
                                            <div className="relative w-32 h-48 sm:w-40 sm:h-60 rounded-xl border-4 border-white/20 overflow-hidden shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                                                <img
                                                    src={`/borderland_cards/${localRoundData.target_card.suit.charAt(0).toUpperCase() + localRoundData.target_card.suit.slice(1)}_${localRoundData.target_card.rank}.png`}
                                                    className="w-full h-full object-cover"
                                                    alt={`${localRoundData.target_card.rank} of ${localRoundData.target_card.suit}`}
                                                />
                                            </div>
                                            <p className="text-xl font-bold font-mono text-blue-300 uppercase">
                                                {localRoundData.target_card.rank} OF {localRoundData.target_card.suit}
                                            </p>
                                        </>
                                    ) : (
                                        <p className="text-2xl font-bold font-mono text-blue-300">
                                            {localRoundData?.hint || 'AWAITING SIGNAL...'}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Bidding Phase */}
                    {phase === 'bidding' && (
                        <div className="flex flex-col items-center justify-center space-y-12 mt-4 sm:mt-24">
                            <h2 className="text-xl sm:text-6xl font-black font-cinzel text-white tracking-widest drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] text-center px-4 uppercase">
                                Survival Auction
                            </h2>
                            <div className="bg-black/80 border border-white/10 p-8 rounded w-full max-w-md backdrop-blur shadow-2xl">
                                <label className="block text-xs font-mono text-slate-500 mb-4 uppercase tracking-widest">
                                    INPUT WAGER PARAMETER
                                </label>
                                <div className="flex gap-2 w-full mb-4">
                                    <input
                                        type="number"
                                        autoFocus
                                        placeholder="0000"
                                        value={myBidInput}
                                        onChange={(e) => handleBidChange(e.target.value)}
                                        className="w-full bg-transparent border-b-2 border-slate-700 text-5xl font-black font-oswald text-center text-white focus:border-blue-500 focus:outline-none transition-colors py-4"
                                    />
                                    <button
                                        onClick={submitBid}
                                        className={`px-4 py-2 font-bold font-mono text-sm tracking-wider rounded transition-all flex flex-col items-center justify-center border ${myPlayer?.bid === parseInt(myBidInput) ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500'} `}
                                    >
                                        <span>{myPlayer?.bid === parseInt(myBidInput) ? 'LOCKED' : 'SUBMIT'}</span>
                                        <span className="text-[10px] opacity-70">WAGER</span>
                                    </button>
                                </div>
                                {bidError && (
                                    <div className="mb-4 px-3 py-2 bg-red-900/20 border border-red-500/30 text-red-400 text-xs rounded text-center">
                                        {bidError}
                                    </div>
                                )}
                                <div className="space-y-2 text-sm font-mono">
                                    <div className="flex justify-between p-2 bg-slate-900 rounded">
                                        <span className="text-slate-500">CURRENT MERIT</span>
                                        <span className="font-bold text-white">{myPlayer?.score || 1000}</span>
                                    </div>
                                    <div className="flex justify-between p-2 bg-slate-900 rounded">
                                        <span className="text-slate-500">PROJECTED YIELD</span>
                                        <span className={`font-bold ${projectedScore >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {projectedScore}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}



                    {/* Completed Phase */}
                    {phase === 'completed' && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="fixed inset-0 z-50 flex flex-col items-center justify-start pt-28 sm:pt-36 gap-6 sm:gap-10 bg-black/95 overflow-y-auto pb-12"
                        >
                            <div className="text-center flex flex-col gap-4 mt-10 sm:mt-15">
                                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black font-cinzel text-white tracking-widest uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] px-4">
                                    SURVIVAL AUCTION COMPLETE
                                </h1>
                                <motion.div
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.3, duration: 0.6 }}
                                >
                                    {(myPlayer?.score || 0) >= 0 ? (
                                        <h2 className="text-xs md:text-sm font-bold font-mono text-blue-500 tracking-[0.4em] uppercase italic">
                                            VITALITY CHECK // PASSED
                                        </h2>
                                    ) : (
                                        <h2 className="text-xs md:text-sm font-bold font-mono text-red-500 tracking-[0.4em] uppercase italic">
                                            VITALITY CHECK // FAILED
                                        </h2>
                                    )}
                                </motion.div>
                            </div>

                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.6, ease: "easeOut" }}
                                className="relative group w-full max-w-xl min-h-[8rem] px-4 sm:px-0"
                            >
                                {/* Unified Glass Container */}
                                <div className="relative rounded-2xl bg-zinc-950/90 backdrop-blur-xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col sm:flex-row items-stretch justify-between p-0 z-10">

                                    {/* Top Accent Line */}
                                    <div className={`absolute top-0 left-0 w-full h-[2px] ${(myPlayer?.score || 0) >= 0 ? 'bg-gradient-to-r from-transparent via-blue-500 to-transparent' : 'bg-gradient-to-r from-transparent via-red-500 to-transparent'} opacity-80`} />

                                    {/* Background Ambient Glow */}
                                    <div className={`absolute -top-20 -left-20 w-60 h-60 rounded-full blur-[100px] ${(myPlayer?.score || 0) >= 0 ? 'bg-blue-500/10' : 'bg-red-500/10'} pointer-events-none`} />

                                    {/* Left Module: Score */}
                                    <div className="flex-1 min-h-[100px] sm:min-h-[140px] flex flex-col items-center justify-center relative p-4 sm:p-6 sm:border-r border-b sm:border-b-0 border-white/5 bg-zinc-900/40">
                                        <p className="text-zinc-500 font-mono text-[10px] sm:text-[9px] uppercase tracking-[0.4em] mb-3">
                                            Final Score
                                        </p>
                                        <div className="relative">
                                            <p className={`text-3xl sm:text-6xl font-black font-oswald tracking-tighter leading-tight text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.15)] py-2`}>
                                                {myPlayer?.score ?? 0}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Right Module: Stats Grid */}
                                    <div className="flex-1 flex flex-col p-4 sm:p-6 gap-3 sm:gap-3 justify-center relative bg-black/20">
                                        {/* Status Row */}
                                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                            <span className="text-zinc-500 text-xs sm:text-[10px] font-mono tracking-widest uppercase">CONDITION</span>
                                            <span className={`text-sm sm:text-xs font-bold font-mono tracking-[0.2em] uppercase ${(myPlayer?.score || 0) >= 0 ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.4)]' : 'text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.4)]'}`}>
                                                {(myPlayer?.score || 0) >= 0 ? 'SURVIVED' : 'KIA'}
                                            </span>
                                        </div>

                                        {/* Cards Row */}
                                        <div className="flex items-center justify-between">
                                            <span className="text-zinc-500 text-xs sm:text-[10px] font-mono tracking-widest uppercase">No. Card Holding</span>
                                            <span className="text-2xl sm:text-lg font-bold text-white font-display tracking-widest">
                                                {myPlayer?.cards?.length || 0}
                                            </span>
                                        </div>

                                        {/* Penalty Indicator (Conditional) */}
                                        {myPlayer?.cards?.length === 0 && (
                                            <div className="mt-2 text-center bg-red-500/10 py-2 rounded border border-red-500/20 px-2">
                                                <span className="text-[10px] sm:text-xs text-red-500 font-bold font-mono uppercase tracking-wider animate-pulse flex items-center justify-center gap-2">
                                                    <AlertTriangle size={14} /> NO CARD HOLDING (-500)
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Subtle Outer Glow */}
                                <div className={`absolute -inset-4 rounded-3xl blur-2xl opacity-20 ${(myPlayer?.score || 0) >= 0 ? 'bg-blue-500' : 'bg-red-500'} z-0`} />
                            </motion.div>

                            <div className="mt-4 w-full max-w-xs">
                                <button
                                    onClick={() => window.location.href = '/home/card'}
                                    className="group relative w-full h-14 bg-blue-600 hover:bg-blue-500 border border-blue-400/50 rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:shadow-[0_0_30px_rgba(59,130,246,0.6)] transition-all duration-300 transform hover:scale-[1.02] active:scale-95 flex items-center justify-center overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                                    <span className="relative text-white font-oswald text-base sm:text-sm tracking-[0.2em] font-medium flex items-center gap-2 uppercase drop-shadow-md">
                                        <LogOut size={18} className="group-hover:rotate-180 transition-transform duration-500" /> INITIATE EXTRACTION
                                    </span>
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* Reveal Phase */}
                    {phase === 'reveal' && (
                        <motion.div className="flex flex-col items-center space-y-8 sm:space-y-12 mt-4 sm:mt-12">
                            <h2 className="text-xl sm:text-4xl font-black font-cinzel text-white mb-4 sm:mb-8 tracking-widest text-center uppercase drop-shadow-[0_0_20px_rgba(255,255,255,0.3)] px-4">
                                ROUND RESULTS
                            </h2>

                            <div className="flex items-center gap-6 sm:gap-12 flex-wrap justify-center">
                                {localRoundData.target_card && (
                                    <motion.div
                                        initial={{ rotateY: 90 }}
                                        animate={{ rotateY: 0 }}
                                        transition={{ type: 'spring', damping: 12 }}
                                        className="relative w-48 h-72 sm:w-64 sm:h-96 group"
                                    >
                                        <div className={`absolute -inset-2 rounded-2xl blur-2xl opacity-30 ${localRoundData.target_card.color === 'red' ? 'bg-red-600' : 'bg-white'}`} />
                                        <div className={`relative h-full w-full rounded-xl border-4 sm:border-8 overflow-hidden shadow-2xl ${localRoundData.target_card.color === 'red' ? 'border-red-600' : 'border-white/20'}`}>
                                            <img
                                                src={`/borderland_cards/${localRoundData.target_card.suit.charAt(0).toUpperCase() + localRoundData.target_card.suit.slice(1)}_${localRoundData.target_card.rank}.png`}
                                                className="w-full h-full object-cover"
                                                alt={`${localRoundData.target_card.rank} of ${localRoundData.target_card.suit}`}
                                            />
                                            {/* Score Overlay */}
                                            <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/80 backdrop-blur-md text-white text-[10px] sm:text-xs font-mono rounded border border-white/20 shadow-lg z-10">
                                                {scoreCard(localRoundData.target_card!) > 0 ? '+' : ''}{scoreCard(localRoundData.target_card!)}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Winner Info */}
                                <div className="flex flex-col gap-4">
                                    <div className="p-6 bg-black/50 border border-white/20 backdrop-blur-md rounded-lg min-w-[300px]">
                                        <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">
                                            ACQUISITION STATUS
                                        </p>
                                        {localRoundData.winner_id ? (
                                            <div className="space-y-1">
                                                <p className="text-3xl font-black font-oswald text-green-500 uppercase">
                                                    {playerIdMap[localRoundData.winner_id] || 'UNKNOWN'}
                                                </p>
                                                <p className="text-xs font-mono text-green-500/50 uppercase">
                                                    WON THE BID
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                <p className="text-2xl font-black font-oswald text-red-500 uppercase animate-pulse">
                                                    CARD DISMISSED
                                                </p>
                                                <p className="text-[10px] font-mono text-red-500/50 uppercase tracking-widest">
                                                    INSUFFICIENT BIDS // ROUND VOID
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {localRoundData.ties && localRoundData.ties.length > 0 && (
                                        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 font-mono text-xs uppercase text-center animate-pulse rounded-lg">
                                            TIE DETECTED // SYSTEM RESOLVED
                                        </div>
                                    )}

                                    {/* My Cards Collection */}
                                    {myPlayer && myPlayer.cards.length > 0 && (
                                        <div className="p-4 bg-blue-900/10 border border-blue-500/30 rounded-lg">
                                            <p className="text-[10px] font-mono text-blue-400 uppercase tracking-widest mb-2">
                                                YOUR COLLECTION
                                            </p>
                                            <div className="flex gap-2 flex-wrap">
                                                {(myPlayer.cards || []).map((c, i) => (
                                                    <div
                                                        key={i}
                                                        className="relative w-12 h-18 sm:w-16 sm:h-24 rounded border border-white/10 overflow-hidden shadow-lg bg-black/40"
                                                    >
                                                        <img
                                                            src={`/borderland_cards/${c.suit.charAt(0).toUpperCase() + c.suit.slice(1)}_${c.rank}.png`}
                                                            className="w-full h-full object-cover"
                                                            alt={`${c.rank} of ${c.suit}`}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Game Completed */}

                </AnimatePresence>

                {/* MASTER RESTRICTION POPUP */}
                {(user?.role === 'admin' || user?.role === 'master') && (
                    <div className="absolute inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center p-8 backdrop-blur-xl">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-blue-900/20 border border-blue-500/50 p-12 rounded-2xl max-w-2xl text-center space-y-6 shadow-[0_0_100px_rgba(37,99,235,0.2)]"
                        >
                            <ShieldCheck size={80} className="text-blue-500 mx-auto animate-pulse" />
                            <h2 className="text-4xl font-display font-black text-white tracking-[0.2em] uppercase">
                                NOTICE
                            </h2>
                            <div className="h-px w-32 bg-blue-500/50 mx-auto" />
                            <p className="text-blue-200 font-mono text-lg leading-relaxed">
                                THIS IS NOT A MASTER GAME.<br />
                                <span className="opacity-75 text-sm">You are viewing the player interface.</span>
                            </p>
                            <div className="pt-4">
                                <button
                                    onClick={() => window.location.href = '/home/card'}
                                    className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all uppercase tracking-wider"
                                >
                                    Return to Command
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}

            </main >
        </div >
    );
};
