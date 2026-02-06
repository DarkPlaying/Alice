import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../supabaseClient';
import { db } from '../../firebase';
import { collection, getDocs } from 'firebase/firestore';
import {
    type HeartsGameState,
    type HeartsPlayer
} from '../../game/hearts';
import { Eye, ShieldAlert, Send, Heart, User as UserIcon, RotateCcw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface HeartsGameProps {
    user: any; // User object from auth
}

export const HeartsGame: React.FC<HeartsGameProps> = ({ user }) => {
    // --- State ---
    const [gameState, setGameState] = useState<HeartsGameState | null>(null);
    const [myPlayer, setMyPlayer] = useState<HeartsPlayer | null>(null);
    const [chatInput, setChatInput] = useState('');
    const [messages, setMessages] = useState<any[]>([]); // Chat messages state
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isScoringOpen, setIsScoringOpen] = useState(false);

    // Choosing Phase State
    const [selectedSuit, setSelectedSuit] = useState<string | null>(null);
    const [hasSubmitted, setHasSubmitted] = useState(false);

    // Player ID Mapping
    const [playerIdMap, setPlayerIdMap] = useState<Record<string, string>>({});

    // Fetch Player ID Mapping from Firebase (Consistent Anonymity)
    useEffect(() => {
        const fetchPlayerIds = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, 'users'));
                const usersList = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as any[];

                usersList.sort((a: any, b: any) => {
                    const isMasterA = a.role === 'master' || a.role === 'admin' || a.username === 'admin';
                    const isMasterB = b.role === 'master' || b.role === 'admin' || b.username === 'admin';
                    if (isMasterA && !isMasterB) return -1;
                    if (!isMasterA && isMasterB) return 1;
                    const timeA = a.createdAt?.seconds || a.createdAt?.toMillis?.() || 0;
                    const timeB = b.createdAt?.seconds || b.createdAt?.toMillis?.() || 0;
                    return timeA - timeB;
                });

                const mapping: Record<string, string> = {};
                let pCount = 1;
                usersList.forEach((u: { id: string, username?: string }) => {
                    const pid = `#PLAYER_${pCount.toString().padStart(3, '0')}`;
                    if (u.id) mapping[u.id] = pid;
                    if (u.username) mapping[u.username] = pid;
                    pCount++;
                });
                setPlayerIdMap(mapping);
            } catch (error) {
                console.error('Error fetching player IDs (Firebase):', error);
            }
        };
        fetchPlayerIds();
    }, []);

    // --- Sync ---
    useEffect(() => {
        const fetchState = async () => {
            const { data } = await supabase.from('hearts_game_state').select('*').eq('id', 'hearts_main').single();
            if (data) {
                setGameState(data);
            }
        };
        fetchState();

        const channel = supabase.channel('hearts_player_sync')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'hearts_game_state', filter: 'id=eq.hearts_main' }, (payload) => {
                setGameState(payload.new as HeartsGameState);
            })
            .subscribe();

        joinGame();
        return () => { supabase.removeChannel(channel); };
    }, []);

    // --- HUD Sync: Keep myPlayer updated with latest gameState ---
    useEffect(() => {
        if (gameState && user) {
            const userId = user.id || user.uid;
            const p = gameState.participants?.find((p: any) => p.id === userId);
            if (p) {
                setMyPlayer(p);
            }
        }
    }, [gameState, user]);

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
                const displayName = playerIdMap[userId] || user.displayName || user.username || 'Agent';
                const newPlayer: HeartsPlayer = {
                    id: userId, email: userEmail, name: displayName,
                    role: isMaster ? 'master' : 'player', score: initialScore,
                    status: 'active', eye_of_truth_uses: isMaster ? 2 : 1,
                    start_score: initialScore,
                    last_total_score: initialScore
                };
                console.log(`[HEARTS] Registering new participant with score ${initialScore}`);
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
                            const { data: latestState } = await supabase.from('hearts_game_state').select('participants').eq('id', 'hearts_main').single();
                            if (latestState?.participants) {
                                const updatedParticipants = latestState.participants.map((p: HeartsPlayer) => {
                                    if (p.id === userId) {
                                        return {
                                            ...p,
                                            score: profileScore,
                                            start_score: profileScore, // Reset start score to match reality
                                            last_total_score: profileScore
                                        };
                                    }
                                    return p;
                                });

                                await supabase.from('hearts_game_state').update({ participants: updatedParticipants }).eq('id', 'hearts_main');
                                console.log('[HEARTS PLAYER] Score Synced & Start Score Recorded.');
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

        const channel = supabase.channel(`hearts_chat_${myChannel}`)
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
        return () => { supabase.removeChannel(channel); };
    }, [myPlayer?.groupId, gameState?.active_game_id]);


    // My Player Sync
    useEffect(() => {
        const userId = user?.id || user?.uid;
        if (gameState && userId) {
            const me = gameState.participants.find(p => p.id === userId);
            setMyPlayer(me || null);
            if (gameState.phase !== 'choosing') { setHasSubmitted(false); setSelectedSuit(null); }
            if (gameState.phase === 'shuffle' || gameState.phase === 'briefing') {
                setMessages([]);
                setRevealMyCard(false);
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
    const myGroupMembers = (myGroupId && gameState?.groups && gameState.groups[myGroupId]) ? gameState.groups[myGroupId] : [];
    const othersInGroup = myGroupMembers.filter(pid => pid !== (user?.id || user?.uid)).filter(pid => {
        const p = gameState?.participants?.find(part => part.id === pid);
        return p && p.name && p.status !== 'eliminated';
    });

    const handleVote = async () => {
        if (!selectedSuit || !myPlayer || !gameState) return;
        const { error } = await supabase.from('hearts_guesses').upsert({
            game_id: gameState.active_game_id || 'hearts_main',
            round: gameState.current_round, player_id: user?.id || user?.uid, suit: selectedSuit
        });
        if (!error) setHasSubmitted(true);
    };

    const handleChat = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!chatInput.trim() || !myPlayer || !gameState) return;
        const currentC = gameState.chat_counts?.[myPlayer.id] || 0;
        if (currentC >= 10) { alert("COMMUNICATION LIMIT REACHED"); return; }

        const temp = chatInput.trim(); setChatInput('');
        const newCounts = { ...gameState.chat_counts, [myPlayer.id]: currentC + 1 };
        await supabase.from('hearts_game_state').update({ chat_counts: newCounts }).eq('id', 'hearts_main');

        const senderName = playerIdMap[myPlayer.id] || myPlayer.name || 'Unknown Agent';
        await supabase.from('messages').insert({
            game_id: gameState.active_game_id || 'hearts_main',
            channel: myPlayer.groupId, user_id: myPlayer.id,
            user_name: senderName, content: temp, is_system: false
        });
    };

    const [revealMyCard, setRevealMyCard] = useState(false);
    useEffect(() => { if (!gameState?.system_start || gameState.phase === 'briefing') setRevealMyCard(false); }, [gameState?.system_start, gameState?.phase]);

    const handleEyeOfTruth = async () => {
        if (!gameState || !myPlayer || myPlayer.eye_of_truth_uses <= 0) return;
        setRevealMyCard(true);
        const { data: latest } = await supabase.from('hearts_game_state').select('participants').eq('id', 'hearts_main').single();
        if (latest) {
            const updated = latest.participants.map((p: any) => p.id === (user?.id || user?.uid) ? { ...p, eye_of_truth_uses: p.eye_of_truth_uses - 1 } : p);
            await supabase.from('hearts_game_state').update({ participants: updated }).eq('id', 'hearts_main');
        }
    };

    if (!gameState) return <div className="flex items-center justify-center h-screen bg-black text-rose-500 font-mono uppercase tracking-widest animate-pulse">Establishing Hearts Protocol...</div>;

    if (!gameState.system_start) return (
        <div className="w-full h-screen bg-black flex flex-col items-center justify-center p-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-rose-900/30 via-black to-black opacity-50" />
            <motion.div animate={{ scale: [1, 1.05, 1], rotateY: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 6 }} className="mb-12 relative z-10 perspective-1000">
                <div className="w-48 sm:w-56 h-72 sm:h-80 rounded-2xl bg-gradient-to-br from-white to-gray-200 shadow-[0_0_60px_rgba(225,29,72,0.3)] border border-white/50 flex flex-col items-center justify-between p-6">
                    <div className="self-start text-5xl text-rose-600 font-serif font-black">K</div>
                    <Heart size={80} className="text-rose-600 fill-current drop-shadow-lg" />
                    <div className="self-end text-5xl text-rose-600 font-serif font-black rotate-180">K</div>
                </div>
            </motion.div>
            <h1 className="text-5xl md:text-7xl font-black font-oswald text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-pink-500 tracking-widest mb-4 z-10 text-center">HEARTS</h1>
            <p className="text-rose-400 font-mono text-sm tracking-[0.5em] animate-pulse z-10 uppercase text-center">Awaiting Master Authorization</p>
        </div>
    );

    return (
        <div className="w-full h-full bg-[#050505] text-white font-sans overflow-y-auto relative selection:bg-rose-500/30">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-rose-900/20 via-[#0a0a0a] to-[#050505] pointer-events-none" />

            {/* Header / HUD */}
            <header className="fixed top-20 left-0 right-0 z-[160] bg-black/60 backdrop-blur-xl border-b border-rose-500/20 px-4 py-3 sm:px-8 sm:py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    {/* Left: Brand / Title */}
                    <div className="flex flex-col">
                        <h2 className="text-[10px] sm:text-xs font-cinzel font-black text-rose-500 tracking-[0.3em] uppercase leading-none mb-1">
                            HEARTS TRIAL
                        </h2>
                        <h1 className="text-sm sm:text-lg font-black font-oswald text-white tracking-widest uppercase leading-none">
                            IDENTITY CRISIS
                        </h1>
                    </div>

                    {/* Right: Actions (Scoring) */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsScoringOpen(!isScoringOpen)}
                            className="p-2 sm:px-4 sm:py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded text-rose-500 transition-all active:scale-95"
                        >
                            <span className="hidden sm:inline font-mono text-[11px] tracking-widest uppercase">SYNOPSIS</span>
                            <Eye size={18} className="sm:hidden" />
                        </button>
                    </div>
                </div>

                {/* Sub-Header HUD */}
                <div className="max-w-7xl mx-auto mt-3 pt-3 border-t border-white/5 flex items-center justify-around sm:justify-end sm:gap-8">
                    {/* PHASE */}
                    <div className="flex flex-col items-center sm:items-end">
                        <p className="text-[7px] sm:text-[9px] text-rose-300/40 font-mono uppercase tracking-[0.2em]">PHASE</p>
                        <p className="text-sm sm:text-lg font-black font-oswald text-rose-500 uppercase leading-none">
                            {gameState.phase}
                        </p>
                    </div>

                    <div className="w-px h-6 bg-white/10 sm:hidden" />

                    {/* ROUND */}
                    <div className="flex flex-col items-center sm:items-end">
                        <p className="text-[7px] sm:text-[9px] text-rose-300/40 font-mono uppercase tracking-[0.2em]">ROUND</p>
                        <p className="text-sm sm:text-lg font-black font-oswald text-white leading-none">
                            {gameState.current_round}<span className="text-rose-900 text-[10px] sm:text-sm">/5</span>
                        </p>
                    </div>

                    <div className="w-px h-6 bg-white/10 sm:hidden" />

                    {/* TIMER */}
                    <div className="flex flex-col items-center sm:items-end">
                        <p className="text-[7px] sm:text-[9px] text-rose-300/40 font-mono uppercase tracking-[0.2em]">TIMER</p>
                        <div className="flex items-center gap-1.5 leading-none">
                            <RotateCcw size={12} className={`text-rose-500 sm:w-4 sm:h-4 ${timeLeft < 10 ? 'animate-spin' : ''}`} />
                            <p className={`text-sm sm:text-lg font-black font-oswald tabular-nums ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-rose-500'}`}>
                                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                            </p>
                        </div>
                    </div>

                    <div className="w-px h-6 bg-white/10 sm:hidden" />

                    {/* SCORE */}
                    <div className="flex flex-col items-center sm:items-end bg-rose-500/10 px-3 py-1 sm:px-4 sm:py-1 rounded border border-rose-500/20">
                        <p className="text-[7px] sm:text-[9px] text-rose-400/70 font-mono uppercase tracking-[0.2em]">SCORE</p>
                        <p className="text-sm sm:text-lg font-black font-oswald text-rose-500">
                            {myPlayer?.score !== undefined ? myPlayer.score : (user?.visa_points ?? 0)}
                        </p>
                    </div>
                </div>
            </header>

            {/* MAIN STAGE */}
            <div className="flex min-h-full items-start justify-center p-8 relative z-10 pt-40 sm:pt-32 pb-20 ">
                {myPlayer?.status === 'eliminated' && gameState.phase !== 'result' && gameState.phase !== 'end' && (
                    <div className="absolute inset-0 bg-black z-50 flex flex-col items-center justify-center p-8">
                        <ShieldAlert size={80} className="text-red-600 mb-8" />
                        <h1 className="text-5xl md:text-8xl font-black font-oswald text-red-600 mb-4 tracking-widest uppercase text-center">TERMINATED</h1>
                        <button onClick={() => window.location.href = '/home'} className="px-8 py-4 bg-red-900/20 border border-red-600/50 text-red-500 font-bold font-oswald uppercase tracking-widest rounded-xl hover:bg-red-900/40 transition-all">RETURN HOME</button>
                    </div>
                )}

                {gameState.phase === 'briefing' && myPlayer?.status !== 'eliminated' && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 pt-20 sm:pt-0">
                        <div className="bg-black/60 backdrop-blur-md p-8 rounded-3xl border border-rose-500/30 text-center">
                            <h1 className="text-3xl md:text-6xl font-black font-oswald text-white mb-6 uppercase tracking-tighter leading-none">
                                MISSION <span className="text-rose-600">BRIEFING</span>
                            </h1>
                            {myGroupId ? (
                                <>
                                    <p className="text-lg text-white/80 font-light mb-8">You are in <span className="text-rose-500 font-bold">GROUP {myGroupId}</span>.</p>
                                    <div className="flex justify-center gap-4 flex-wrap">
                                        {myGroupMembers.map(pid => (
                                            <div key={pid} className={`p-4 rounded-xl border min-w-[100px] ${pid === (user?.id || user?.uid) ? 'bg-rose-500/20 border-rose-500' : 'bg-white/5 border-white/10'}`}>
                                                <UserIcon className="mx-auto mb-2 text-white/70" />
                                                <div className="text-xs font-mono uppercase truncate max-w-[100px]">{playerIdMap[pid] || 'Agent'}</div>
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
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 overflow-y-auto max-h-[300px] sm:max-h-[400px] custom-scrollbar">
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
                    <div className="w-full h-full flex items-center justify-center p-4">
                        <div className="max-w-6xl w-full flex flex-wrap justify-center content-center gap-4 sm:gap-12 overflow-y-auto max-h-full py-4 no-scrollbar">
                            <div className="flex flex-col items-center gap-4 shrink-0">
                                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-rose-500">
                                    Your Identity <span className="text-rose-500/50">({playerIdMap[user?.id || user?.uid] || '...'})</span>
                                </span>
                                <div className="w-40 sm:w-64 h-56 sm:h-96 bg-[#111] rounded-2xl border-2 border-rose-500/60 flex flex-col items-center justify-center relative overflow-hidden group">
                                    {!revealMyCard ? (
                                        <div className="flex flex-col items-center justify-center p-6 text-center">
                                            <ShieldAlert size={32} className="text-rose-800 animate-pulse mb-4 sm:hidden" />
                                            <ShieldAlert size={48} className="text-rose-800 animate-pulse mb-4 hidden sm:block" />
                                            <p className="text-[9px] sm:text-[10px] text-white/30 uppercase tracking-[0.2em] mb-4 sm:mb-6">Identity Shield Active</p>
                                            {myPlayer?.eye_of_truth_uses! > 0 && (
                                                <button
                                                    onClick={handleEyeOfTruth}
                                                    className="px-4 py-2 sm:px-6 sm:py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-[9px] sm:text-[10px] font-bold rounded-full shadow-[0_0_20px_rgba(225,29,72,0.4)] transition-all flex items-center gap-2 active:scale-95"
                                                >
                                                    <Eye size={12} className="sm:w-[14px] sm:h-[14px]" /> REVEAL ({myPlayer?.eye_of_truth_uses})
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="w-full h-full overflow-hidden rounded-2xl animate-flip-in">
                                            {gameState.cards[myPlayer?.id!] ? (
                                                <img src={`/borderland_cards/${gameState.cards[myPlayer?.id!].suit.charAt(0).toUpperCase() + gameState.cards[myPlayer?.id!].suit.slice(1)}_${gameState.cards[myPlayer?.id!].rank}.png`} alt="My Card" className="w-full h-full object-cover" />
                                            ) : <div className="flex items-center justify-center h-full text-white/20">NO DATA</div>}
                                        </div>
                                    )}
                                </div>
                            </div>
                            {othersInGroup.map(pid => {
                                const card = gameState.cards[pid];
                                return (
                                    <div key={pid} className="flex flex-col items-center gap-4 shrink-0">
                                        <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-white/50">{playerIdMap[pid] || 'Agent'}</span>
                                        <div className="w-40 sm:w-64 h-56 sm:h-96 rounded-2xl shadow-2xl overflow-hidden border-2 border-white/50">
                                            {card ? <img src={`/borderland_cards/${card.suit.charAt(0).toUpperCase() + card.suit.slice(1)}_${card.rank}.png`} alt="Card" className="w-full h-full object-cover" />
                                                : <div className="w-full h-full bg-white/5 flex items-center justify-center text-white/10">NO DATA</div>}
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
                                                        <tr className="border-b border-white/5"><td className="py-2.5 text-white/50 uppercase">Master Defeat</td><td className="py-2.5 text-right text-green-400 font-bold">+500</td></tr>
                                                        <tr><td className="py-2.5 text-white/50 uppercase">Game Over (Loss)</td><td className="py-2.5 text-right text-red-500 font-bold">-200</td></tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <p className="text-[10px] font-black font-mono text-rose-400 uppercase tracking-widest">Field Rules</p>
                                            <ul className="text-[10px] font-mono text-white/60 space-y-2 list-disc pl-4">
                                                <li>COORDINATE WITH YOUR GROUP TO IDENTIFY ASSETS.</li>
                                                <li>CHAT LIMIT IS 10 TRANSMISSIONS PER PHASE.</li>
                                                <li>USE THE EYE OF TRUTH WISELY (LIMITED USES).</li>
                                            </ul>
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

                {gameState.phase === 'choosing' && myPlayer?.status !== 'eliminated' && (
                    <div className="text-center">
                        <h2 className="text-2xl sm:text-4xl font-black font-oswald text-white mb-8">CONFIRM IDENTITY</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                            {['hearts', 'diamonds', 'clubs', 'spades'].map(suit => (
                                <button
                                    key={suit}
                                    onClick={() => setSelectedSuit(suit)}
                                    className={`w-32 h-40 rounded-2xl border-2 flex flex-col items-center justify-center gap-4 transition-all ${selectedSuit === suit
                                        ? 'bg-rose-600 border-rose-500 scale-105 shadow-[0_0_30px_rgba(225,29,72,0.5)]'
                                        : 'bg-white/5 border-white/10 hover:border-white/30'
                                        }`}
                                >
                                    <div className={`text-4xl ${selectedSuit === suit ? 'text-white' : 'text-white/50'}`}>
                                        {suit === 'hearts' && '♥'} {suit === 'diamonds' && '♦'}
                                        {suit === 'clubs' && '♣'} {suit === 'spades' && '♠'}
                                    </div>
                                    <div className="text-xs font-mono uppercase tracking-widest">{suit}</div>
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center justify-center gap-4">
                            <button
                                onClick={handleVote}
                                disabled={hasSubmitted || !selectedSuit}
                                className={`px-12 py-4 rounded-full font-bold uppercase tracking-widest text-lg transition-all ${hasSubmitted ? 'bg-green-500 text-black cursor-not-allowed shadow-[0_0_20px_rgba(34,197,94,0.4)]' : !selectedSuit ? 'bg-white/10 text-white/20 cursor-not-allowed' : 'bg-white text-black hover:bg-gray-200 shadow-xl active:scale-95'}`}
                            >
                                {hasSubmitted ? 'CONFIRMED' : 'INITIALIZE'}
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
                    </div>
                )}

                {gameState.phase === 'end' && (
                    <div className="text-center">
                        <div className={`relative p-6 sm:p-12 mb-8 bg-black/50 border-y-2 backdrop-blur-md ${myPlayer?.status === 'eliminated' ? 'border-red-600' : 'border-rose-500'}`}>
                            <h2 className={`text-3xl sm:text-6xl font-black mb-2 uppercase break-words ${myPlayer?.status === 'eliminated' ? 'text-red-600' : 'text-rose-500'}`}>
                                {myPlayer?.role === 'master'
                                    ? (myPlayer.status === 'survived' ? 'VICTORY' : 'DEFEAT')
                                    : (myPlayer?.status === 'survived' ? 'VICTORY' : 'TERMINATED')
                                }
                            </h2>
                            <h3 className={`text-xl font-mono tracking-[0.5em] mb-8 uppercase ${myPlayer?.status === 'eliminated' ? 'text-red-600' : 'text-rose-500'}`}>
                                {myPlayer?.role === 'master'
                                    ? (myPlayer.status === 'survived' ? 'SUBJECTS ELIMINATED' : 'SYSTEM FAILURE')
                                    : (myPlayer?.status === 'survived' ? 'MASTER DEFEATED' : 'MASTER VICTORY')
                                }
                            </h3>
                            <div className={`text-5xl font-black flex justify-center items-center gap-4 ${myPlayer?.status === 'eliminated' ? 'text-red-600' : 'text-rose-500'}`}>
                                <Heart className="w-16 h-16 fill-current" /> {myPlayer?.score}
                            </div>
                        </div>
                        <button onClick={() => window.location.href = '/home'} className={`px-16 py-4 bg-transparent font-bold uppercase border transition-all ${myPlayer?.status === 'eliminated' ? 'text-red-600 border-red-600 hover:bg-red-600 hover:text-white' : 'text-rose-500 border-rose-500 hover:bg-pink-500 hover:text-white'}`}>Return Home</button>
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
                                        <span className="text-white/40 text-[9px]">Channel: {myPlayer.groupId} | Limit: {gameState?.chat_counts?.[myPlayer.id] || 0}/10</span>
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
                                            <div className="w-1 h-1 bg-rose-500 rounded-full animate-ping" />
                                            Establishing connection...
                                        </div>
                                    ) : messages.slice().reverse().map((msg, i) => (
                                        <div key={i} className={`flex flex-col ${msg.userId === (user?.id || user?.uid) ? 'items-end' : 'items-start'}`}>
                                            <span className="text-[9px] text-white/30 mb-1 px-1">{playerIdMap[msg.userId] || 'Agent'}</span>
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
