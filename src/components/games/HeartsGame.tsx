import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase as originalSupabase, supabaseUrl, supabaseKey, getAccessToken } from '../../supabaseClient';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        storageKey: 'borderland-fresh-token-v2',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        lock: async (_name: string, ...args: any[]) => {
            const acquire = args.pop();
            if (typeof acquire === 'function') {
                return await acquire();
            }
        }
    }
});
import {
    type HeartsGameState,
    type HeartsPlayer
} from '../../game/hearts';
import { Eye, ShieldAlert, Send, Heart, User as UserIcon, RotateCcw, X, Loader2, AlertTriangle, MessageSquare, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DemoHeartsGame } from './DemoHeartsGame';

const getPlayerDisplayName = (playerId: string | undefined, gameState: HeartsGameState | null) => {
    if (!playerId || !gameState || !gameState.participants) return 'Agent';
    const index = gameState.participants.findIndex(p => p.id === playerId);
    if (index === -1) return 'Agent';
    return `player${index + 1}`;
};

interface HeartsGameProps {
    user: any; // User object from auth
}

export const HeartsGame: React.FC<HeartsGameProps> = ({ user }) => {
    if (user?.role === 'demo') {
        return <DemoHeartsGame user={user} />;
    }

    // --- State ---
    const [gameState, setGameState] = useState<HeartsGameState | null>(null);
    const [myPlayer, setMyPlayer] = useState<HeartsPlayer | null>(null);
    const [chatInput, setChatInput] = useState('');
    const [messages, setMessages] = useState<any[]>([]); // Chat messages state
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isScoringOpen, setIsScoringOpen] = useState(false);
    const [isIntelOpen, setIsIntelOpen] = useState(false);

    // Choosing Phase State
    const [selectedSuit, setSelectedSuit] = useState<string | null>(null);
    const [hasSubmitted, setHasSubmitted] = useState(false);

    // Message Convey Phase State
    const [messageTargetIndex, setMessageTargetIndex] = useState(0);

    // Verify Power State
    const [verifyResult, setVerifyResult] = useState<string | null>(null);
    const [verifyError, setVerifyError] = useState<string | null>(null);

    // Scroll state for dynamic header
    const [isScrolled, setIsScrolled] = useState(false);
    
    // Penalty state
    const [dismissedPenaltyRound, setDismissedPenaltyRound] = useState<number | null>(null);

    // End video state
    const [hasPlayedEndVideo, setHasPlayedEndVideo] = useState(false);

    // Player real names are pulled directly from gameState.participants

    // --- Sync ---
    useEffect(() => {
        let isFetching = false;
        const fetchState = async () => {
            if (isFetching) return;
            isFetching = true;
            try {
                const accessToken = await getAccessToken();
                const response = await fetch(`${supabaseUrl}/rest/v1/hearts_game_state?id=eq.hearts_main&select=*`, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'apikey': supabaseKey,
                        'Accept': 'application/vnd.pgrst.object+json'
                    },
                    cache: 'no-store'
                });
                if (response.ok) {
                    const rawData = await response.json();
                    const data = Array.isArray(rawData) ? rawData[0] : rawData;
                    setGameState(prev => {
                        if (prev?.phase_started_at && data?.phase_started_at) {
                            if (new Date(data.phase_started_at).getTime() < new Date(prev.phase_started_at).getTime()) {
                                return prev;
                            }
                        }
                        return data;
                    });
                }
            } catch (err) {
                console.warn("[HEARTS SYNC] Fetch error:", err);
            } finally { isFetching = false; }
        };
        fetchState();
        const intervalId = setInterval(fetchState, 15000);

        const channel = originalSupabase.channel('hearts_player_sync')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'hearts_game_state', filter: 'id=eq.hearts_main' }, (payload) => {
                setGameState(prev => {
                    const data = payload.new as HeartsGameState;
                    if (prev?.phase_started_at && data?.phase_started_at) {
                        if (new Date(data.phase_started_at).getTime() < new Date(prev.phase_started_at).getTime()) {
                            return prev;
                        }
                    }
                    return data;
                });
            })
            .subscribe();

        joinGame();
        return () => { clearInterval(intervalId); originalSupabase.removeChannel(channel); };
    }, []);

    // --- HUD Sync: Keep myPlayer updated with latest gameState ---
    useEffect(() => {
        if (gameState && user) {
            const userId = user.id || user.uid;
            const p = gameState.participants?.find((p: any) => p.id === userId);
            if (p) {
                setMyPlayer(p);
            } else if (!p && (gameState.phase === 'idle' || gameState.phase === 'briefing')) {
                joinGame();
            }
        }
    }, [gameState?.participants, gameState?.phase, user]);

    const joinGame = async () => {
        const userId = user?.id || user?.uid;
        if (!userId) return;

        const isAdminType = user.role === 'admin' || user.username === 'admin' || user.username?.toLowerCase().includes('architect');
        if (isAdminType) return;

        const { data } = await supabase.from('hearts_game_state').select('participants, phase').eq('id', 'hearts_main').single();
        if (data) {
            const participants = data.participants || [];
            const existingPlayer = participants.find((p: any) => p.id === userId);
            const isEarlyPhase = data.phase === 'briefing' || data.phase === 'shuffle' || data.phase === 'idle';

            if (!existingPlayer && isEarlyPhase) {
                // Default to 1000 for new participants to avoid showing 0.
                // This will be authoritatively synced by the Master or the self-sync logic below.
                let initialScore = 1000;
                let userEmail = user.email || user.emailAddress || user.attributes?.email;
                if (!userEmail) {
                    const { data: userData } = await supabase.from('users').select('email').eq('id', userId).maybeSingle();
                    if (userData?.email) userEmail = userData.email;
                }
                if (userEmail) {
                    console.log(`[HEARTS] joinGame: Authoritatively fetching profile for ${userEmail}...`);
                    const { data: profile } = await supabase.from('profiles').select('visa_points').ilike('email', userEmail).maybeSingle();
                    if (profile?.visa_points !== undefined) {
                        initialScore = profile.visa_points;
                        console.log(`[HEARTS] joinGame: Found profile score: ${initialScore}`);
                    }
                }
                const isMaster = user.role === 'master' || user.username?.toLowerCase().includes('master');
                const displayName = `player${participants.length + 1}`;
                const newPlayer: HeartsPlayer = {
                    id: userId, email: userEmail, name: displayName,
                    role: isMaster ? 'master' : 'player', score: initialScore,
                    status: 'active', eye_of_truth_uses: isMaster ? 2 : 1,
                    start_score: initialScore,
                    last_total_score: initialScore,
                    verify_uses: 3
                };
                console.log(`[HEARTS] Registering new participant with name ${displayName} and score ${initialScore}`);
                await supabase.from('hearts_game_state').update({ participants: [...participants, newPlayer] }).eq('id', 'hearts_main');
            } else if (existingPlayer) {
                setMyPlayer(existingPlayer);
            }
        }
    };

    // --- SCORE INTEGRITY CHECK (Force Sync) ---
    // Matches logic in SpadesGame.tsx to ensure authoritative VISA point synchronization
    // --- SCORE INTEGRITY CHECK (Force Sync) ---
    // Matches logic in SpadesGame.tsx to ensure authoritative VISA point synchronization
    const hasCorrectedScoreRef = useRef(false);
    useEffect(() => {
        const syncPlayerScore = async () => {
            const userId = user?.id || user?.uid;
            if (!userId || !myPlayer) return;

            // Only perform force-sync in early phases OR if score is suspiciously 0
            // If score is 0, we suspect a glitch, so we allow syncing even in later rounds (unless truly 0)
            const isEarlyPhase = ['idle', 'briefing', 'shuffle'].includes(gameState?.phase || '');
            const isZeroScore = myPlayer.score === 0;

            if (!isEarlyPhase && !isZeroScore) return;
            if (!isZeroScore && (gameState?.current_round !== 1 || hasCorrectedScoreRef.current)) return;

            // If score is 1000 (default) or 0 (bug?), verify against profile.
            if (myPlayer.score === 1000 || myPlayer.score === 0 || myPlayer.start_score === undefined) {
                console.log(`[HEARTS PLAYER] Score (${myPlayer.score}) suspected stale/bugged. Force Syncing for:`, userId);

                let userEmail = user?.email || user?.emailAddress || myPlayer.email;
                if (!userEmail) {
                    const { data: userData } = await supabase.from('users').select('email').eq('id', userId).maybeSingle();
                    if (userData?.email) userEmail = userData.email;
                }

                if (userEmail) {
                    const { data: profile } = await supabase.from('profiles').select('visa_points').ilike('email', userEmail).maybeSingle();
                    if (profile?.visa_points !== undefined) {
                        const profileScore = profile.visa_points;

                        // Prevent infinite loops if profile really IS 0
                        if (myPlayer.score === 0 && profileScore === 0) {
                            hasCorrectedScoreRef.current = true;
                            return;
                        }

                        // Mark as done only if we are in normal startup flow. 
                        // If we are fixing a 0-score bug, we allow re-checking if it happens again (though Ref prevents spam loop in same render cycle)
                        if (!isZeroScore) hasCorrectedScoreRef.current = true;

                        // Check if we need to update (Mismatch OR missing start_score)
                        if (myPlayer.score !== profileScore || myPlayer.start_score === undefined) {
                            console.log(`[HEARTS PLAYER] SYNCING SCORE: Game(${myPlayer.score}) -> Profile(${profileScore})`);

                            // Fetch latest state to avoid race
                            const { data: latestState } = await supabase.from('hearts_game_state').select('participants').eq('id', 'hearts_main').maybeSingle();
                            if (latestState?.participants && Array.isArray(latestState.participants)) {
                                const participants = latestState.participants;
                                const updatedParticipants = participants.map((p: HeartsPlayer) => {
                                    if (p.id === userId) {
                                        return {
                                            ...p,
                                            score: profileScore,
                                            start_score: profileScore,
                                            last_total_score: profileScore
                                        };
                                    }
                                    return p;
                                });

                                await supabase.from('hearts_game_state').update({ participants: updatedParticipants }).eq('id', 'hearts_main');
                                console.log('[HEARTS PLAYER] Score Synced & Start Score Recorded.');
                            } else {
                                console.warn('[HEARTS PLAYER] Skipping score sync: could not fetch active participants.', { latestState });
                            }
                        }
                    }
                }
            }
        };

        syncPlayerScore();
    }, [myPlayer?.score, gameState?.phase, gameState?.current_round, user]);

    // --- SELF-PERSISTENCE (BACKUP) ---
    // Ensure player score is saved to profile when game ends OR when eliminated, even if Master fails.
    useEffect(() => {
        if (gameState?.phase === 'end' && !hasPlayedEndVideo) {
            window.dispatchEvent(new CustomEvent('play-end-video'));
            setHasPlayedEndVideo(true);
        }
    }, [gameState?.phase, hasPlayedEndVideo]);

    const hasPersistedRef = useRef(false);
    useEffect(() => {
        const myPlayer = gameState?.participants?.find((p: any) => p.id === (user?.id || user?.uid));

        const isGameEnd = gameState?.phase === 'end';
        const isEliminated = myPlayer?.status === 'eliminated';
        const shouldPersist = (isGameEnd || isEliminated) && myPlayer && !hasPersistedRef.current;

        if (shouldPersist) {
            hasPersistedRef.current = true;
            console.log(`[HEARTS PLAYER] Executing Self-Persistence (Trigger: ${isGameEnd ? 'End' : 'Elimination'}). Score: ${myPlayer.score}`);

            const saveScore = async () => {
                let userEmail = user?.email || user?.emailAddress || myPlayer?.email;
                if (!userEmail) {
                    const userId = user?.id || user?.uid;
                    const { data: userData } = await supabase.from('users').select('email').eq('id', userId).maybeSingle();
                    if (userData?.email) userEmail = userData.email;
                }

                if (userEmail) {
                    await supabase
                        .from('profiles')
                        .update({ visa_points: myPlayer.score })
                        .ilike('email', userEmail);
                    console.log('[HEARTS PLAYER] Self-Persistence Complete.');
                }
            };
            saveScore();
        }

        // Reset persistence lock ONLY if game fully restarts (Briefing or Idle)
        // preventing duplicate saves if phase toggles during elimination state
        if (gameState?.phase === 'briefing' || gameState?.phase === 'idle') {
            hasPersistedRef.current = false;
        }
    }, [gameState?.phase, gameState?.participants, user]);

    // --- Chat Subscription ---
    useEffect(() => {
        if (!myPlayer?.groupId || !gameState) return;
        const myChannel = myPlayer.groupId;
        const currentGameId = gameState.active_game_id || 'hearts_main';

        const fetchMessages = async () => {
            const { data } = await supabase.from('messages').select('*').eq('game_id', currentGameId).eq('channel', myChannel).order('created_at', { ascending: false }).limit(50);
            if (data) {
                setMessages(data.reverse().map((m: any) => ({
                    id: m.id, user: m.user_name, userId: m.user_id,
                    text: m.content, timestamp: new Date(m.created_at), isSystem: m.is_system
                })));
            }
        };
        fetchMessages();

        const channel = originalSupabase.channel(`hearts_chat_${myChannel}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `game_id=eq.${currentGameId}` }, (payload) => {
                if (payload.new.channel === myChannel) {
                    const m = payload.new;
                    setMessages(prev => [...prev, {
                        id: m.id, user: m.user_name, userId: m.user_id,
                        text: m.content, timestamp: new Date(m.created_at), isSystem: m.is_system
                    }]);
                }
            })
            .subscribe();
        return () => { originalSupabase.removeChannel(channel); };
    }, [myPlayer?.groupId, gameState?.active_game_id]);


    // My Player Sync
    useEffect(() => {
        const userId = user?.id || user?.uid;
        if (gameState && userId) {
            const me = (gameState?.participants || []).find(p => p.id === userId);
            setMyPlayer(me || null);
            if (gameState.phase !== 'choosing') { setHasSubmitted(false); setSelectedSuit(null); setVerifyResult(null); setVerifyError(null); }
            if (gameState.phase === 'shuffle' || gameState.phase === 'briefing') {
                setMessages([]);
                setRevealMyCard(false);
                setMessageTargetIndex(0);
            }
        }
    }, [gameState, user]);

    // --- Timer Logic ---
    const [timeLeft, setTimeLeft] = useState(0);
    useEffect(() => {
        if (!gameState?.phase_started_at || !gameState?.phase_duration_sec) { setTimeLeft(0); return; }
        const tick = () => {
            if (gameState.is_paused) { setTimeLeft(gameState.phase_duration_sec || 0); return; }
            const now = Date.now();
            const duration = gameState.phase_duration_sec || 0;
            const start = new Date(gameState.phase_started_at!).getTime();
            const diff = Math.ceil((start + duration * 1000 - now) / 1000);
            setTimeLeft(Math.max(0, diff));
        };
        tick(); const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [gameState?.phase_started_at, gameState?.phase_duration_sec, gameState?.is_paused]);

    const myGroupId = myPlayer?.groupId;
    const myGroupMembers = (myGroupId && (gameState?.groups || {})[myGroupId]) ? (gameState?.groups || {})[myGroupId] : [];
    const othersInGroup = myGroupMembers.filter(pid => pid !== (user?.id || user?.uid)).filter(pid => {
        const p = (gameState?.participants || []).find(part => part.id === pid);
        return p && p.status !== 'eliminated';
    });

    const handleConveyMessage = async (targetId: string, color: 'black' | 'red') => {
        if (!myPlayer || !gameState) return;

        console.log(`[CONVEY MESSAGE] Sending ${color} to ${targetId}`);

        // Optimistic update for instant UI feedback
        setGameState(prev => {
            if (!prev) return prev;
            const prevConveyed = prev.chat_counts as any || {};
            const prevMine = prevConveyed[myPlayer.id] || {};
            return {
                ...prev,
                chat_counts: {
                    ...prevConveyed,
                    [myPlayer.id]: {
                        ...prevMine,
                        [targetId]: color
                    }
                }
            };
        });

        try {
            // Using chat_counts to store our messages since conveyed_messages column does not exist in DB schema
            const { data: latestState, error: fetchErr } = await supabase.from('hearts_game_state').select('chat_counts').eq('id', 'hearts_main').maybeSingle();
            if (fetchErr) console.error('[CONVEY MESSAGE] Fetch Error:', fetchErr);
            
            const conveyed = (latestState?.chat_counts as any) || {};
            const myConveyed = conveyed[myPlayer.id] || {};

            myConveyed[targetId] = color;
            conveyed[myPlayer.id] = myConveyed;

            const { error: updateErr } = await supabase.from('hearts_game_state').update({ chat_counts: conveyed }).eq('id', 'hearts_main');
            if (updateErr) console.error('[CONVEY MESSAGE] Update Error:', updateErr);

        } catch (err) {
            console.error('[CONVEY MESSAGE] Caught Exception:', err);
        }
    };

    const handleVerify = async () => {
        setVerifyError(null);
        if (!selectedSuit) {
            setVerifyError('Select any one shape first');
            return;
        }
        if (!myPlayer || !gameState) return;
        if ((myPlayer.verify_uses ?? 3) <= 0) {
            setVerifyError('No verify uses left');
            return;
        }

        // Decrement uses
        const { data: latest } = await supabase.from('hearts_game_state').select('participants').eq('id', 'hearts_main').maybeSingle();
        if (latest?.participants && Array.isArray(latest.participants)) {
            const participants = latest.participants;
            const updated = participants.map((p: any) => p.id === (user?.id || user?.uid) ? { ...p, verify_uses: (p.verify_uses ?? 3) - 1 } : p);
            await supabase.from('hearts_game_state').update({ participants: updated }).eq('id', 'hearts_main');
        }

        // Check if suit matches
        const myCard = (gameState.pairs || {})[myPlayer.id];
        if (myCard && myCard.suit === selectedSuit) {
            setVerifyResult('Correct shape!');
        } else {
            setVerifyResult('Incorrect shape!');
        }

        setTimeout(() => setVerifyResult(null), 3000);
    };

    const handleVote = async () => {
        console.log('[HEARTS VOTE CLICKED] selectedSuit:', selectedSuit, 'myPlayer:', myPlayer, 'gameState:', gameState);
        if (!selectedSuit || !myPlayer || !gameState) {
            console.warn('[HEARTS VOTE EARLY EXIT] Missing dependencies');
            return;
        }
        const playerId = user?.id || user?.uid;
        const gameId = gameState.active_game_id || 'hearts_main';
        const round = gameState.current_round;
        console.log('[HEARTS VOTE DETAILS] playerId:', playerId, 'gameId:', gameId, 'round:', round);

        try {
            const { data: existing } = await supabase.from('hearts_guesses')
                .select('id')
                .eq('game_id', gameId)
                .eq('round', round)
                .eq('player_id', playerId)
                .maybeSingle();

            console.log('[HEARTS VOTE DB CHECK] existing guess:', existing);

            let error;
            if (existing) {
                const res = await supabase.from('hearts_guesses')
                    .update({ suit: selectedSuit })
                    .eq('id', existing.id);
                error = res.error;
            } else {
                const res = await supabase.from('hearts_guesses').insert({
                    game_id: gameId,
                    round: round,
                    player_id: playerId,
                    suit: selectedSuit
                });
                error = res.error;
            }

            if (error) {
                console.error('[HEARTS VOTE ERROR]', error);
                alert("Failed to submit vote! Please check console.");
            } else {
                console.log('[HEARTS VOTE SUCCESS] Vote submitted successfully');
                setHasSubmitted(true);
            }
        } catch (err) {
            console.error('[HEARTS VOTE EXCEPTION]', err);
        }
    };

    const handleChat = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!chatInput.trim() || !myPlayer || !gameState) return;
        const temp = chatInput.trim(); setChatInput('');
        let senderId = myPlayer.id;
        let senderName = getPlayerDisplayName(myPlayer.id, gameState);

        const { error } = await supabase.from('messages').insert({
            game_id: gameState.active_game_id || 'hearts_main',
            channel: myPlayer.groupId,
            user_id: senderId,
            user_name: senderName,
            content: temp,
            is_system: false
        });

        if (error) {
            console.error('[HEARTS CHAT ERROR]', error);
            alert("Failed to send message: " + error.message);
        }
    };

    const [revealMyCard, setRevealMyCard] = useState(false);
    useEffect(() => {
        if (!gameState?.system_start || gameState.phase === 'briefing' || gameState.phase === 'shuffle' || gameState.phase === 'reveal') {
            setRevealMyCard(false);
            setHasSubmitted(false);
            setSelectedSuit(null);
        }
    }, [gameState?.system_start, gameState?.phase]);

    // Keep revealed state active if they already used their only reveal and refreshed
    useEffect(() => {
        if (myPlayer && myPlayer.role === 'player' && myPlayer.eye_of_truth_uses === 0) {
            setRevealMyCard(true);
        }
    }, [myPlayer?.eye_of_truth_uses]);

    const handleEyeOfTruth = async () => {
        if (!gameState || !myPlayer || myPlayer.eye_of_truth_uses <= 0) return;
        setRevealMyCard(true);
        const { data: latest } = await supabase.from('hearts_game_state').select('participants').eq('id', 'hearts_main').maybeSingle();
        if (latest?.participants && Array.isArray(latest.participants)) {
            const participants = latest.participants;
            const updated = participants.map((p: any) => p.id === (user?.id || user?.uid) ? { ...p, eye_of_truth_uses: (p.eye_of_truth_uses || 1) - 1 } : p);
            await supabase.from('hearts_game_state').update({ participants: updated }).eq('id', 'hearts_main');
        }
    };
    if (!gameState) return (
        <div className="w-full h-screen flex flex-col gap-6 items-center justify-center bg-transparent">
            <Loader2 size={80} className="text-rose-600 animate-spin drop-shadow-[0_0_20px_rgba(225,29,72,0.8)]" />
            <div className="text-rose-500 font-mono uppercase tracking-widest animate-pulse">Establishing Hearts Protocol...</div>
        </div>
    );

    if (!gameState.system_start) return (
        <div className="w-full h-screen flex items-center justify-center p-8 relative overflow-hidden bg-transparent">
            <Loader2 size={80} className="text-rose-600 animate-spin drop-shadow-[0_0_20px_rgba(225,29,72,0.8)]" />
        </div>
    );

    return (
        <div
            className="w-full h-full text-white font-sans overflow-y-auto relative selection:bg-rose-500/30 bg-black/40 backdrop-blur-md"
            onScroll={(e) => {
                const scrolled = e.currentTarget.scrollTop > 10;
                setIsScrolled(scrolled);
                window.dispatchEvent(new CustomEvent('hearts-scroll', { detail: scrolled }));
            }}
        >
            {/* Header / HUD */}
            <header className={`sticky top-0 left-0 right-0 z-[160] border-b border-rose-500/20 px-4 py-3 sm:px-8 sm:py-4 transition-all duration-300 ${isScrolled ? 'bg-black/90 backdrop-blur-xl' : 'bg-transparent'}`}>
                <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                    {/* Left: Brand / Title */}
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col text-center sm:text-left">
                            <h2 className="text-[10px] sm:text-xs font-cinzel font-black text-rose-500 tracking-[0.3em] uppercase leading-none mb-1">
                                HEARTS TRIAL
                            </h2>
                            <h1 className="text-sm sm:text-lg font-black font-oswald text-white tracking-widest uppercase leading-none">
                                IDENTITY CRISIS
                            </h1>
                        </div>
                    </div>

                    {/* Right: HUD & Actions */}
                    <div className="flex items-center gap-2.5 sm:gap-8 overflow-x-auto w-full sm:w-auto justify-start sm:justify-end pb-2 sm:pb-0 hide-scrollbar scroll-smooth flex-nowrap snap-x">
                        {/* PHASE */}
                        <div className="flex flex-col items-center sm:items-end shrink-0 snap-start">
                            <p className="text-[6px] sm:text-[9px] text-rose-300/40 font-mono uppercase tracking-[0.2em]">PHASE</p>
                            <p className="text-[10px] sm:text-lg font-black font-oswald text-rose-500 uppercase leading-none mt-0.5 sm:mt-0">
                                {gameState.phase}
                            </p>
                        </div>

                        <div className="w-px h-5 sm:h-6 bg-white/10 shrink-0" />

                        {/* ROUND */}
                        <div className="flex flex-col items-center sm:items-end shrink-0 snap-start">
                            <p className="text-[6px] sm:text-[9px] text-rose-300/40 font-mono uppercase tracking-[0.2em]">ROUND</p>
                            <p className="text-[10px] sm:text-lg font-black font-oswald text-white leading-none mt-0.5 sm:mt-0">
                                {gameState.current_round}<span className="text-rose-900 text-[8px] sm:text-sm">/5</span>
                            </p>
                        </div>

                        <div className="w-px h-5 sm:h-6 bg-white/10 shrink-0" />

                        {/* TIMER */}
                        <div className="flex flex-col items-center sm:items-end shrink-0 snap-start">
                            <p className="text-[6px] sm:text-[9px] text-rose-300/40 font-mono uppercase tracking-[0.2em]">TIMER</p>
                            <div className="flex items-center gap-1 sm:gap-1.5 leading-none mt-0.5 sm:mt-0">
                                <RotateCcw size={10} className={`text-rose-500 sm:w-4 sm:h-4 ${timeLeft < 10 ? 'animate-spin' : ''}`} />
                                <p className={`text-[10px] sm:text-lg font-black font-oswald tabular-nums ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-rose-500'}`}>
                                    {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                                </p>
                            </div>
                        </div>

                        <div className="w-px h-5 sm:h-6 bg-white/10 shrink-0" />

                        {/* SCORE - Centered on Mobile */}
                        <div className="flex flex-col items-center sm:items-end bg-rose-500/10 px-2 py-0.5 sm:px-4 sm:py-1 rounded border border-rose-500/20 shrink-0 snap-start">
                            <p className="text-[6px] sm:text-[9px] text-rose-400/70 font-mono uppercase tracking-[0.2em]">SCORE</p>
                            <p className="text-[10px] sm:text-lg font-black font-oswald text-rose-500 leading-none mt-0.5 sm:mt-0">
                                {myPlayer?.score !== undefined ? myPlayer.score : (user?.visa_points ?? 0)}
                            </p>
                        </div>

                        {/* INTEL */}
                        {othersInGroup.length > 0 && (
                            <button
                                onClick={() => setIsIntelOpen(!isIntelOpen)}
                                className="p-1.5 px-2 sm:px-4 sm:py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded text-rose-500 transition-all active:scale-95 shrink-0 animate-pulse flex items-center justify-center gap-1 sm:gap-2 ml-1"
                            >
                                <MessageSquare size={12} className="sm:w-4 sm:h-4" />
                                <span className="hidden sm:inline font-mono text-[11px] tracking-widest uppercase">INTEL</span>
                            </button>
                        )}

                        {/* SYNOPSIS */}
                        <button
                            onClick={() => setIsScoringOpen(true)}
                            className="p-1.5 px-2 sm:px-4 sm:py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded text-rose-500 transition-all active:scale-95 shrink-0 flex items-center justify-center gap-1 sm:gap-2 ml-auto sm:ml-0"
                        >
                            <Info size={12} className="sm:w-4 sm:h-4" />
                            <span className="hidden sm:inline font-mono text-[11px] tracking-widest uppercase">SYNOPSIS</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* MAIN STAGE */}
            <div className="flex min-h-full items-start justify-center p-8 relative z-10 pt-8 sm:pt-8 pb-20 ">
                {myPlayer?.status === 'eliminated' && gameState.phase !== 'result' && gameState.phase !== 'end' && (
                    <div className="absolute inset-0 bg-black/40  z-50 flex flex-col items-center justify-center p-8">
                        <ShieldAlert size={80} className="text-red-600 mb-8" />
                        <h1 className="text-5xl md:text-8xl font-black-200 font-oswald text-red-600 mb-4 tracking-widest uppercase text-center">TERMINATED</h1>
                        <button onClick={() => window.location.href = '/home'} className="px-8 py-4 bg-red-900/20 border border-red-600/50 text-red-500 font-bold font-oswald uppercase tracking-widest rounded-xl hover:bg-red-900/40 transition-all">RETURN HOME</button>
                    </div>
                )}

                {gameState.phase === 'choosing' && 
                 othersInGroup.filter(pid => {
                     const p = gameState?.participants?.find(part => part.id === pid);
                     return p && p.status !== 'eliminated' && !((gameState?.chat_counts as any)?.[myPlayer?.id || '']?.[pid]);
                 }).length > 0 && 
                 dismissedPenaltyRound !== gameState.current_round && (
                    <div className="fixed inset-0 bg-black/80 z-[999] flex flex-col items-center justify-center p-8 backdrop-blur-md">
                        <div className="relative bg-[#0a0a0f] border border-red-500/20 p-6 sm:p-8 rounded-2xl max-w-md w-full text-center shadow-[0_0_80px_rgba(220,38,38,0.15)] overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent"></div>
                            
                            <AlertTriangle size={40} className="text-red-500 mx-auto mb-4 animate-pulse drop-shadow-[0_0_15px_rgba(220,38,38,0.8)]" />
                            <h2 className="text-2xl sm:text-4xl font-black font-oswald text-red-500 mb-2 tracking-widest uppercase drop-shadow-[0_0_15px_rgba(220,38,38,0.8)]">
                                TRANSMISSION FAILED
                            </h2>
                            <p className="text-red-400/80 font-mono text-xs sm:text-sm mb-6 uppercase tracking-widest">
                                You failed to transmit intel to <span className="text-red-400 font-bold">{othersInGroup.filter(pid => {
                                    const p = gameState?.participants?.find(part => part.id === pid);
                                    return p && p.status !== 'eliminated' && !((gameState?.chat_counts as any)?.[myPlayer?.id || '']?.[pid]);
                                }).length}</span> agents.
                            </p>
                            
                            <div className="inline-block bg-red-950/40 border border-red-500/30 px-6 py-3 rounded-xl mb-6">
                                <p className="text-[9px] text-red-400/50 font-mono uppercase tracking-[0.2em] mb-1">PENALTY APPLIED</p>
                                <p className="text-2xl font-black font-oswald text-white tracking-widest">-{othersInGroup.filter(pid => {
                                    const p = gameState?.participants?.find(part => part.id === pid);
                                    return p && p.status !== 'eliminated' && !((gameState?.chat_counts as any)?.[myPlayer?.id || '']?.[pid]);
                                }).length * 100} CREDITS</p>
                            </div>
                            
                            <button 
                                onClick={() => setDismissedPenaltyRound(gameState.current_round)}
                                className="w-full sm:w-auto px-8 py-3 bg-red-600/10 hover:bg-red-600/20 border border-red-600/50 text-red-500 hover:text-white font-bold font-oswald uppercase tracking-[0.2em] rounded-lg transition-all active:scale-95 shadow-[0_0_20px_rgba(220,38,38,0.2)]"
                            >
                                ACKNOWLEDGE
                            </button>
                        </div>
                    </div>
                )}

                {gameState.phase === 'briefing' && myPlayer?.status !== 'eliminated' && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 pt-10 sm:pt-0 items-stretch">
                        <div className="bg-black/1 backdrop-blur-md p-8 rounded-3xl border border-rose-500/30 text-center h-full flex flex-col justify-center">
                            <h1 className="text-3xl md:text-6xl font-black font-oswald text-white mb-6 uppercase tracking-tighter leading-none">
                                MISSION <span className="text-rose-600">BRIEFING</span>
                            </h1>
                            {myGroupId ? (
                                <>
                                    <p className="text-lg text-white/80 font-light mb-8">You are in <span className="text-rose-500 font-bold">GROUP {myGroupId}</span>.</p>
                                    <div className="flex justify-center gap-4 flex-wrap">
                                        {myGroupMembers.map(pid => (
                                            <div key={pid} className={`p-4 rounded-xl border min-w-[100px] flex flex-col items-center justify-center ${pid === (user?.id || user?.uid) ? 'bg-rose-500/20 border-rose-500' : 'bg-white/5 border-white/10'}`}>
                                                <UserIcon className="mb-2 text-white/70" />
                                                <div className="text-xs font-mono uppercase truncate max-w-[100px]">{getPlayerDisplayName(pid, gameState)}</div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center py-10">
                                    <RotateCcw size={40} className="animate-spin text-rose-500 mb-4" />
                                    <h2 className="text-xl font-bold text-white mb-2 uppercase tracking-tight">System Initialization</h2>
                                    <div className="flex items-baseline gap-2 mb-2">
                                        <span className="text-4xl font-black text-rose-500 font-oswald">{gameState.participants?.length || 0}</span>
                                        <span className="text-white/40 text-xs font-mono uppercase tracking-widest">Agents Initialized</span>
                                    </div>
                                    <p className="text-white/40 font-mono text-[9px] uppercase tracking-widest">Awaiting further registrations...</p>
                                </div>
                            )}
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 overflow-y-auto custom-scrollbar h-full flex flex-col justify-center">
                            <h3 className="text-rose-500 font-bold font-oswald tracking-widest mb-3 sm:mb-4 uppercase text-sm sm:text-base">Game Protocol</h3>
                            <div className="space-y-2 sm:space-y-3 text-[10px] sm:text-xs font-mono text-white/70 leading-relaxed">
                                <p><span className="text-rose-500 font-bold">I. SETUP:</span> See partners' cards.</p>
                                <p><span className="text-rose-500 font-bold">II. CHAT:</span> Help or Trick (Max 10).</p>
                                <p><span className="text-rose-500 font-bold">III. GUESS:</span> Identify SUIT to survive.</p>
                                <p><span className="text-rose-500 font-bold">IV. EYE:</span> Peek your card (Limited).</p>
                            </div>
                            <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-white/10">
                                <h3 className="text-rose-500 font-bold font-oswald tracking-widest mb-2 sm:mb-3 uppercase text-sm sm:text-base">Scoring Protocol</h3>
                                <table className="w-full text-[10px] sm:text-xs font-mono">
                                    <tbody>
                                        <tr className="border-b border-white/5"><td className="py-1.5 sm:py-2 text-white/50 uppercase">Correct Identity</td><td className="py-1.5 sm:py-2 text-right text-green-400 font-bold">+300</td></tr>
                                        <tr className="border-b border-white/5"><td className="py-1.5 sm:py-2 text-white/50 uppercase">Incorrect Identity</td><td className="py-1.5 sm:py-2 text-right text-red-500 font-bold">-200</td></tr>
                                        <tr className="border-b border-white/5"><td className="py-1.5 sm:py-2 text-white/50 uppercase">Missed Transmission</td><td className="py-1.5 sm:py-2 text-right text-red-500 font-bold">-100</td></tr>
                                        <tr className="border-b border-white/5"><td className="py-1.5 sm:py-2 text-white/50 uppercase">Master Defeat</td><td className="py-1.5 sm:py-2 text-right text-green-400 font-bold">+500</td></tr>
                                        <tr><td className="py-1.5 sm:py-2 text-white/50 uppercase">Game Over (Loss)</td><td className="py-1.5 sm:py-2 text-right text-red-500 font-bold">-200</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </motion.div>
                )}

                {gameState.phase === 'shuffle' && (
                    <motion.div
                        key="shuffle-screen"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center z-[20]"
                    >
                        <div className="mb-8 flex justify-center">
                            <RotateCcw size={80} className="text-rose-500 animate-spin" />
                        </div>
                        <h1 className="text-4xl sm:text-6xl font-black font-oswald text-white tracking-[0.3em] uppercase">SHUFFLE</h1>
                        <p className="text-rose-400 font-mono text-sm mt-4 tracking-widest uppercase">Randomizing Subject Assets</p>
                    </motion.div>
                )}

                {gameState.phase === 'reveal' && myPlayer?.status !== 'eliminated' && (
                    <div className="w-full flex items-center justify-center p-2 sm:p-4">
                        <div className="max-w-6xl w-full flex flex-row flex-wrap justify-center items-end content-center gap-4 sm:gap-12 py-2 sm:py-4">
                            <div className="flex flex-col items-center gap-2 sm:gap-4 shrink-0 max-w-[45%] sm:max-w-none">
                                <span className="text-[9px] sm:text-xs font-bold uppercase tracking-widest text-rose-500 text-center leading-tight flex items-end justify-center min-h-[28px] sm:min-h-0">
                                    <span>Your Identity <br className="sm:hidden" /><span className="text-rose-500/50">({getPlayerDisplayName(myPlayer?.id, gameState)})</span></span>
                                </span>
                                <div className="w-32 sm:w-64 h-48 sm:h-96 bg-[#111] rounded-xl sm:rounded-2xl border-2 border-rose-500/60 flex flex-col items-center justify-center relative overflow-hidden group">
                                    {!revealMyCard ? (
                                        <div className="flex flex-col items-center justify-center p-2 sm:p-6 text-center">
                                            <ShieldAlert size={24} className="text-rose-800 animate-pulse mb-2 sm:hidden" />
                                            <ShieldAlert size={48} className="text-rose-800 animate-pulse mb-4 hidden sm:block" />
                                            <p className="text-[8px] sm:text-[10px] text-white/30 uppercase tracking-[0.2em] mb-2 sm:mb-6">Identity Shield Active</p>
                                            {myPlayer?.eye_of_truth_uses! > 0 && (
                                                <button
                                                    onClick={handleEyeOfTruth}
                                                    className="px-3 py-1.5 sm:px-6 sm:py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-[8px] sm:text-[10px] font-bold rounded-full shadow-[0_0_20px_rgba(225,29,72,0.4)] transition-all flex items-center gap-1 sm:gap-2 active:scale-95"
                                                >
                                                    <Eye size={10} className="sm:w-[14px] sm:h-[14px]" /> REVEAL ({myPlayer?.eye_of_truth_uses})
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="w-full h-full overflow-hidden rounded-xl sm:rounded-2xl animate-flip-in">
                                            {(gameState?.pairs || {})[myPlayer?.id!] ? (
                                                <img src={`/borderland_cards/${(gameState?.pairs || {})[myPlayer?.id!].suit.charAt(0).toUpperCase() + (gameState?.pairs || {})[myPlayer?.id!].suit.slice(1)}_${(gameState?.pairs || {})[myPlayer?.id!].rank}.png`} alt="My Card" className="w-full h-full object-cover" />
                                            ) : <div className="flex items-center justify-center h-full text-white/20 text-[10px]">NO DATA</div>}
                                        </div>
                                    )}
                                </div>
                            </div>
                            {othersInGroup.map(pid => {
                                const card = (gameState?.pairs || {})[pid];
                                return (
                                    <div key={pid} className="flex flex-col items-center gap-2 sm:gap-4 shrink-0 max-w-[45%] sm:max-w-none">
                                        <span className="text-[9px] sm:text-xs font-bold uppercase tracking-widest text-white/50 text-center leading-tight flex items-end justify-center min-h-[28px] sm:min-h-0">
                                            {getPlayerDisplayName(pid, gameState)}
                                        </span>
                                        <div className="w-32 sm:w-64 h-48 sm:h-96 rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden border-2 border-white/50">
                                            <img src={`/borderland_cards/${card?.suit.charAt(0).toUpperCase() + card?.suit.slice(1)}_${card?.rank}.png`} alt="Card" className="w-full h-full object-cover" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Scoring Protocol Modal Overlay - Portaled to escape stacking contexts */}
                {createPortal(
                    <AnimatePresence>
                        {isScoringOpen && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4 bg-black backdrop-blur-md"
                            >
                                <div className="w-full max-w-sm bg-zinc-950 border border-rose-500/30 rounded-3xl p-8 shadow-2xl max-h-[85vh] overflow-y-auto custom-scrollbar">
                                    <div className="flex justify-between items-center mb-8 pb-4 border-b border-white/5">
                                        <h3 className="text-2xl font-black font-oswald tracking-widest text-rose-500 uppercase">TRIAL SYNOPSIS</h3>
                                        <button onClick={() => setIsScoringOpen(false)} className="text-white/40 hover:text-white transition-colors"><X size={24} /></button>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="space-y-3">
                                            <p className="text-[10px] font-black font-mono text-rose-400 uppercase tracking-widest">Scoring Protocol</p>
                                            <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                                <table className="w-full text-[10px] font-mono">
                                                    <tbody>
                                                        <tr className="border-b border-white/5"><td className="py-2.5 text-white/50 uppercase">Correct Identity</td><td className="py-2.5 text-right text-green-400 font-bold">+300</td></tr>
                                                        <tr className="border-b border-white/5"><td className="py-2.5 text-white/50 uppercase">Incorrect Identity</td><td className="py-2.5 text-right text-red-500 font-bold">-200</td></tr>
                                                        <tr className="border-b border-white/5"><td className="py-2.5 text-white/50 uppercase">Missed Transmission</td><td className="py-2.5 text-right text-red-500 font-bold">-100</td></tr>
                                                        <tr className="border-b border-white/5"><td className="py-2.5 text-white/50 uppercase">Master Defeat</td><td className="py-2.5 text-right text-green-400 font-bold">+500</td></tr>
                                                        <tr><td className="py-2.5 text-white/50 uppercase">Game Over (Loss)</td><td className="py-2.5 text-right text-red-500 font-bold">-200</td></tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => setIsScoringOpen(false)}
                                            className="w-full py-4 mt-4 bg-rose-600 hover:bg-rose-500 text-white font-black font-oswald uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95"
                                        >
                                            ACKNOWLEDGE
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>,
                    document.body
                )}

                {/* Intel Modal Overlay - Portaled */}
                {createPortal(
                    <AnimatePresence>
                        {isIntelOpen && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
                            >
                                <div className="w-full max-w-sm bg-zinc-950 border border-rose-500/30 rounded-3xl p-8 shadow-2xl">
                                    <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/5">
                                        <h3 className="text-2xl font-black font-oswald tracking-widest text-rose-500 uppercase">INTEL RECEIVED</h3>
                                        <button onClick={() => setIsIntelOpen(false)} className="text-white/40 hover:text-white transition-colors"><X size={24} /></button>
                                    </div>
                                    <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
                                        {othersInGroup.length === 0 ? (
                                            <p className="text-white/40 font-mono text-xs uppercase text-center py-4">No intel available.</p>
                                        ) : (
                                            othersInGroup.map(pid => {
                                                const msg = (gameState.chat_counts as any)?.[pid]?.[myPlayer?.id || ''];
                                                return (
                                                    <div key={pid} className="flex flex-col bg-black/40 p-4 rounded-xl border border-white/5">
                                                        <span className="text-xs uppercase text-white/40 tracking-widest mb-2">{getPlayerDisplayName(pid, gameState)}</span>
                                                        <span className={`text-sm font-bold uppercase ${msg === 'red' ? 'text-rose-500' : msg === 'black' ? 'text-zinc-400' : 'text-white/20'}`}>
                                                            {msg ? `IT'S ${msg}` : 'NO SIGNAL RECEIVED'}
                                                        </span>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setIsIntelOpen(false)}
                                        className="w-full py-4 mt-6 bg-rose-600/20 hover:bg-rose-500/40 border border-rose-500/50 text-white font-black font-oswald uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95"
                                    >
                                        CLOSE INTEL
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>,
                    document.body
                )}

                {gameState.phase === 'result' && (
                    <div className="text-center">
                        {gameState.winners?.includes(user?.id || user?.uid) ? (
                            <div className="bg-green-500/10 border border-green-500/50 p-8 sm:p-12 rounded-3xl backdrop-blur-xl">
                                <h2 className="text-4xl sm:text-6xl font-black text-green-500 mb-4 tracking-tighter uppercase">SURVIVED</h2>
                                <p className="text-xl sm:text-2xl font-mono text-green-200 tracking-widest">+300 CREDITS</p>
                            </div>
                        ) : (
                            <div className="bg-red-500/10 border border-red-500/50 p-8 sm:p-12 rounded-3xl backdrop-blur-xl">
                                <h2 className="text-4xl sm:text-6xl font-black text-red-600 mb-4 animate-pulse">TERMINATED</h2>
                                <p className="text-lg sm:text-xl font-mono text-white/50">FINAL SCORE: {myPlayer?.score || 0}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Message Convey Phase */}
                {gameState.phase === 'message' && myPlayer && myPlayer.status !== 'eliminated' && (
                        <div className="w-full max-w-2xl mx-auto flex flex-col items-center justify-center p-4 z-[60]">
                            <div className="flex flex-col items-center mb-6 sm:mb-8 text-center">
                                <h2 className="text-3xl sm:text-4xl font-black font-oswald text-rose-600 mb-2 tracking-[0.2em] uppercase drop-shadow-[0_0_15px_rgba(225,29,72,0.8)]">TRANSMIT INTEL</h2>
                                <p className="text-[10px] sm:text-xs font-mono text-white/60 tracking-widest uppercase bg-rose-950/40 px-3 py-1.5 rounded-sm border-l-2 border-rose-500">
                                    SIGNAL CARD COLORS TO YOUR SQUAD. <span className="text-rose-500 font-bold">DECEPTION IS FATAL.</span>
                                </p>
                            </div>

                            <div className="bg-[#0a0a0a] border border-rose-900/50 rounded-xl p-4 sm:p-6 w-full relative overflow-hidden shadow-[0_0_50px_rgba(225,29,72,0.1)]">
                                {/* Decorative background grid */}
                                <div className="absolute inset-0 bg-[linear-gradient(rgba(225,29,72,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(225,29,72,0.05)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

                                {othersInGroup.length === 0 ? (
                                    <div className="text-center py-12 relative z-10">
                                        <div className="text-xl sm:text-2xl font-black text-rose-500/30 mb-2 tracking-widest">NO TARGETS LOCATED</div>
                                        <p className="text-white/40 font-mono text-[10px] sm:text-sm uppercase tracking-widest">SQUAD VITALS FLATLINED OR NON-EXISTENT.</p>
                                    </div>
                                ) : (
                                    <div className={`grid grid-cols-1 ${othersInGroup.length === 1 ? 'sm:grid-cols-1 max-w-sm mx-auto' : 'sm:grid-cols-2'} gap-4 relative z-10 w-full`}>
                                        {othersInGroup.map(pid => (
                                            <div key={pid} className="bg-black/60 border border-rose-900/30 rounded-lg p-4 flex flex-col gap-4 hover:border-rose-900/60 transition-colors">
                                                <div className="flex justify-between items-center border-b border-rose-900/20 pb-2">
                                                    <span className="text-[9px] text-white/40 font-mono uppercase tracking-widest">Target Alias</span>
                                                    <span className="text-sm font-black font-oswald tracking-widest text-white">
                                                        {getPlayerDisplayName(pid, gameState)}
                                                    </span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleConveyMessage(pid, 'black')}
                                                        className={`flex-1 py-2.5 rounded border-b-2 transition-all font-black font-oswald uppercase tracking-widest text-[10px] sm:text-xs active:scale-95 ${(gameState.chat_counts as any)?.[myPlayer?.id || '']?.[pid] === 'black'
                                                            ? 'bg-zinc-800 border-zinc-500 text-white shadow-[0_0_10px_rgba(255,255,255,0.1)]'
                                                            : 'bg-black/50 border-zinc-900 text-zinc-600 hover:border-zinc-700 hover:text-zinc-400'
                                                            }`}
                                                    >
                                                        ♠♣ BLACK
                                                    </button>
                                                    <button
                                                        onClick={() => handleConveyMessage(pid, 'red')}
                                                        className={`flex-1 py-2.5 rounded border-b-2 transition-all font-black font-oswald uppercase tracking-widest text-[10px] sm:text-xs active:scale-95 ${(gameState.chat_counts as any)?.[myPlayer?.id || '']?.[pid] === 'red'
                                                            ? 'bg-rose-900 border-rose-500 text-white shadow-[0_0_10px_rgba(225,29,72,0.4)]'
                                                            : 'bg-black/50 border-rose-950 text-rose-900 hover:border-rose-900 hover:text-rose-700'
                                                            }`}
                                                    >
                                                        ♥♦ RED
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                )}

                {gameState.phase === 'choosing' && myPlayer && myPlayer.status !== 'eliminated' && (
                    <div className="flex flex-col lg:flex-row w-full max-w-6xl mx-auto gap-8 justify-center items-start pt-4">
                        <div className="text-center flex-1 w-full">
                            <h2 className="text-xl sm:text-4xl font-black font-oswald text-white mb-4 sm:mb-8">CONFIRM IDENTITY</h2>
                            <div className="flex flex-row justify-center gap-2 sm:gap-6 mb-4 sm:mb-8 w-full max-w-full overflow-x-hidden px-2">
                                {['hearts', 'diamonds', 'clubs', 'spades'].map(suit => (
                                    <button
                                        key={suit}
                                        onClick={() => setSelectedSuit(suit)}
                                        className={`flex-1 sm:flex-none sm:w-32 h-24 sm:h-40 rounded-xl sm:rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 sm:gap-4 transition-all ${selectedSuit === suit
                                            ? 'bg-rose-600 border-rose-500 scale-105 shadow-[0_0_30px_rgba(225,29,72,0.5)] z-10'
                                            : 'bg-white/5 border-white/10 hover:border-white/30'
                                            }`}
                                    >
                                        <div className={`text-2xl sm:text-4xl ${selectedSuit === suit ? 'text-white' : 'text-white/50'}`}>
                                            {suit === 'hearts' && '♥'} {suit === 'diamonds' && '♦'}
                                            {suit === 'clubs' && '♣'} {suit === 'spades' && '♠'}
                                        </div>
                                        <div className="text-[8px] sm:text-xs font-mono uppercase tracking-widest">{suit}</div>
                                    </button>
                                ))}
                            </div>
                            <div className="flex flex-wrap items-center justify-center gap-4">
                                <button
                                    onClick={handleVote}
                                    disabled={hasSubmitted || !selectedSuit}
                                    className={`px-8 sm:px-12 py-4 rounded-full font-bold uppercase tracking-widest text-sm sm:text-lg transition-all ${hasSubmitted ? 'bg-green-500 text-black cursor-not-allowed shadow-[0_0_20px_rgba(34,197,94,0.4)]' : !selectedSuit ? 'bg-white/10 text-white/20 cursor-not-allowed' : 'bg-white text-black hover:bg-gray-200 shadow-xl active:scale-95'}`}
                                >
                                    {hasSubmitted ? 'CONFIRMED' : 'INITIALIZE'}
                                </button>

                                <button
                                    onClick={handleVerify}
                                    disabled={(myPlayer?.verify_uses ?? 3) === 0 || hasSubmitted}
                                    className={`px-6 sm:px-8 py-4 rounded-full font-bold uppercase tracking-widest text-sm sm:text-lg transition-all ${((myPlayer?.verify_uses ?? 3) === 0 || hasSubmitted) ? 'bg-white/5 text-white/20 cursor-not-allowed border border-white/10' : 'bg-transparent border-2 border-rose-600 text-rose-500 hover:bg-rose-600 hover:text-white shadow-xl active:scale-95'}`}
                                >
                                    VERIFY ({myPlayer?.verify_uses ?? 3})
                                </button>

                                {hasSubmitted && (
                                    <button
                                        onClick={() => setHasSubmitted(false)}
                                        className="p-4 bg-rose-500/10 text-rose-500 rounded-full hover:bg-rose-600 hover:text-white transition-all border border-rose-500/30 flex items-center justify-center shadow-lg active:scale-95 group"
                                        title="Edit Selection"
                                    >
                                        <X size={24} className="group-hover:rotate-90 transition-transform" />
                                    </button>
                                )}
                            </div>

                            {verifyError && <p className="text-red-500 font-mono mt-6 uppercase text-sm">{verifyError}</p>}
                            {verifyResult && <p className="text-rose-400 font-mono mt-6 uppercase text-lg font-bold animate-pulse">{verifyResult}</p>}
                        </div>

                        {/* Removed Right Side Panel: Hints - Moved to Hub Header */}
                    </div>
                )}

                {gameState.phase === 'end' && (
                    <div className="text-center w-full z-50 px-4">
                        <div className={`relative p-6 sm:p-10 mb-8 mx-auto max-w-xl bg-black/80 border-2 rounded-3xl backdrop-blur-md shadow-2xl ${myPlayer?.status === 'eliminated' ? 'border-red-600/50 shadow-red-900/20' : 'border-rose-500/50 shadow-rose-900/20'}`}>
                            <h2 className={`text-3xl sm:text-5xl font-black mb-2 uppercase break-words ${myPlayer?.status === 'eliminated' ? 'text-red-600' : 'text-rose-500'}`}>
                                {myPlayer?.role === 'master'
                                    ? (myPlayer.status === 'survived' ? 'VICTORY' : 'DEFEAT')
                                    : (myPlayer?.status === 'survived' ? 'VICTORY' : 'TERMINATED')
                                }
                            </h2>
                            <h3 className={`text-xs sm:text-lg font-mono tracking-[0.3em] sm:tracking-[0.5em] mb-6 sm:mb-8 uppercase ${myPlayer?.status === 'eliminated' ? 'text-red-600' : 'text-rose-500'}`}>
                                {myPlayer?.role === 'master'
                                    ? (myPlayer.status === 'survived' ? 'SUBJECTS ELIMINATED' : 'SYSTEM FAILURE')
                                    : (myPlayer?.status === 'survived' ? 'MASTER DEFEATED' : 'MASTER VICTORY')
                                }
                            </h3>
                            <div className={`text-4xl sm:text-5xl font-black flex justify-center items-center gap-3 sm:gap-4 ${myPlayer?.status === 'eliminated' ? 'text-red-600' : 'text-rose-500'}`}>
                                <Heart className="w-10 h-10 sm:w-12 sm:h-12 fill-current" /> {myPlayer?.score}
                            </div>
                        </div>
                        <button onClick={() => window.location.href = '/home'} className={`px-12 py-3 sm:px-16 sm:py-4 text-xs sm:text-base bg-transparent font-bold uppercase border transition-all ${myPlayer?.status === 'eliminated' ? 'text-red-600 border-red-600 hover:bg-red-600 hover:text-white' : 'text-rose-500 border-rose-500 hover:bg-pink-500 hover:text-white'}`}>Return Home</button>
                    </div>
                )}
            </div>

            {/* Chat UI - Optimized for Mobile Overlay */}
            {myPlayer?.groupId && (gameState.phase !== 'briefing' && gameState.phase !== 'shuffle') && (
                <>
                    {/* Floating Chat Button */}
                    <motion.button
                        layoutId="chat-button"
                        onClick={() => setIsChatOpen(true)}
                        className="fixed bottom-6 right-6 w-14 h-14 bg-rose-600 text-white rounded-full shadow-[0_0_30px_rgba(225,29,72,0.4)] z-[140] flex items-center justify-center border-2 border-white/10 active:scale-90 transition-transform sm:w-16 sm:h-16"
                    >
                        <Send size={24} className="-rotate-45" />
                        {messages.length > 0 && !isChatOpen && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-white text-rose-600 text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-rose-600">
                                !
                            </span>
                        )}
                    </motion.button>

                    <AnimatePresence>
                        {isChatOpen && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                className="fixed bottom-6 right-6 w-[calc(100vw-48px)] sm:w-80 h-[500px] max-h-[80vh] bg-black/95 backdrop-blur-2xl border-2 border-rose-500/30 rounded-3xl shadow-2xl z-[200] flex flex-col overflow-hidden"
                            >
                                <div className="bg-rose-600/20 border-b border-rose-500/30 px-6 py-4 flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-white font-bold text-xs uppercase tracking-widest">Group Comms</span>
                                        <span className="text-white/40 text-[9px]">Channel: {myPlayer.groupId}</span>
                                    </div>
                                    <button
                                        onClick={() => setIsChatOpen(false)}
                                        className="p-2 hover:bg-white/10 rounded-full text-white/60 transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col-reverse custom-scrollbar">
                                    {messages.length === 0 ? (
                                        <div className="text-center text-white/20 text-[10px] italic py-8 flex flex-col items-center gap-3">
                                            <div className="w-1 h-1 bg-white/20 rounded-full" />
                                            No messages yet. Send a hint to your group!
                                        </div>
                                    ) : messages.slice().reverse().map((msg, i) => (
                                        <div key={i} className={`flex flex-col ${msg.userId === (user?.id || user?.uid) ? 'items-end' : 'items-start'}`}>
                                            <span className="text-[9px] text-white/30 mb-1 px-1">{msg.isSystem ? 'SYSTEM' : getPlayerDisplayName(msg.userId, gameState)}</span>
                                            <div className={`px-4 py-2.5 rounded-2xl text-[11px] sm:text-xs max-w-[85%] break-words leading-relaxed shadow-sm ${msg.userId === (user?.id || user?.uid) ? 'bg-rose-500 text-white rounded-br-none' : 'bg-white/10 text-white/90 rounded-bl-none border border-white/5'}`}>
                                                {msg.text}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="p-4 bg-black/50 border-t border-white/5">
                                    <form onSubmit={handleChat} className="flex gap-2">
                                        <input
                                            value={chatInput}
                                            onChange={e => setChatInput(e.target.value)}
                                            placeholder="Type a hint..."
                                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-xs outline-none focus:border-rose-500/50 transition-colors"
                                        />
                                        <button
                                            type="submit"
                                            disabled={!chatInput.trim()}
                                            className="w-10 h-10 bg-rose-600 text-white rounded-xl flex items-center justify-center active:scale-95 disabled:opacity-50 transition-all shadow-lg"
                                        >
                                            <Send size={18} />
                                        </button>
                                    </form>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </>
            )}
        </div>
    );
};
