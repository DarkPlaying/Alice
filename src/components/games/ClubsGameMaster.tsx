import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, supabaseUrl, supabaseKey, getAccessToken } from '../../supabaseClient';

import { Timer, FileText } from 'lucide-react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Loader } from '../Loader';
import { ClubsPointsTable } from './ClubsPointsTable';


interface ClubsGameMasterProps {
    onComplete: (score: number) => void;
    onFail: (score: number) => void;
    user?: any;
    onProfileClick?: () => void;
    isEngine?: boolean;
}

interface Card {
    id: string;
    suit: 'clubs' | 'diamonds' | 'hearts' | 'spades';
    rank: string;
    playerRole: 'angel' | 'demon' | null;
    masterRole: 'angel' | 'demon' | null;
    isRevealed: boolean;
    isRemoved: boolean;
}


const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q']; // No King

// Helper: Generate Clubs 24 Cards (Set 1: A-Q, Set 2: A-Q)
const generateRandomDeck = () => {
    // Set 1: Clubs A-Q
    const set1: Card[] = RANKS.map(rank => ({
        id: `clubs-${rank}-1`,
        suit: 'clubs',
        rank,
        playerRole: null,
        masterRole: null,
        isRevealed: false,
        isRemoved: false
    }));

    // Set 2: Clubs A-Q
    const set2: Card[] = RANKS.map(rank => ({
        id: `clubs-${rank}-2`,
        suit: 'clubs',
        rank,
        playerRole: null,
        masterRole: null,
        isRevealed: false,
        isRemoved: false
    }));

    // Shuffle each set independently
    const shuffle = (deck: Card[]) => {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    };

    const shuffledSet1 = shuffle(set1);
    const shuffledSet2 = shuffle(set2);

    // Return combined (Set 1 active first, Set 2 reserve)
    return [...shuffledSet1, ...shuffledSet2];
};

export const ClubsGameMaster = ({ onComplete, user, isEngine = false }: ClubsGameMasterProps) => {
    const [gameState, setGameState] = useState<'idle' | 'briefing' | 'setup' | 'setup_phase1' | 'selection_reveal' | 'playing' | 'card_reveal' | 'round_reveal' | 'won' | 'lost'>('idle');
    const gameStateRef = useRef(gameState);
    useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
    const [round, setRound] = useState(1);
    const [timeLeft, setTimeLeft] = useState(0);
    const [playerScore, setPlayerScore] = useState(0);
    const [masterScore, setMasterScore] = useState(0);

    // Detailed Score Tracking
    const [myScore, setMyScore] = useState(0);
    const [topPlayerScore, setTopPlayerScore] = useState(0);
    const [topPlayerId, setTopPlayerId] = useState<string | null>(null);
    const [topMasterScore, setTopMasterScore] = useState(0);
    const [topMasterId, setTopMasterId] = useState<string | null>(null);

    // Points Table State
    const [showPointsTable, setShowPointsTable] = useState(false);


    const [cards, setCards] = useState<Card[]>([]);
    const [messages, setMessages] = useState<any[]>([]);
    const [inputMessage, setInputMessage] = useState('');

    const sendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputMessage.trim()) return;
        const senderName = user?.username || 'MASTER';
        const tempContent = inputMessage;
        setInputMessage('');

        try {
            const { error } = await supabase.from('messages').insert({
                game_id: 'clubs_king',
                user_name: senderName,
                user_id: user?.id as string,
                content: tempContent,
                is_system: false,
                channel: 'master'
            });

            if (error) {
                console.error('Error sending message:', error);
            }
        } catch (err) {
            console.error('Exception sending message:', err);
        }
    };

    // Selection & Voting
    const [mySelection, setMySelection] = useState<{ angel: string | null; demon: string | null }>({ angel: null, demon: null });
    const [playerSelection, setPlayerSelection] = useState<{ angel: string | null; demon: string | null }>({ angel: null, demon: null }); // NEW
    const [playerLocked, setPlayerLocked] = useState(false);
    const [playersVotes, setPlayersVotes] = useState<Record<string, string[]>>({});

    // Individual Master Voting
    const [masterVotes, setMasterVotes] = useState<Record<string, string[]>>({});
    const [phase1Selections, setPhase1Selections] = useState<Record<string, any>>({});
    const [showResetOverlay, setShowResetOverlay] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [roundResults, setRoundResults] = useState<any[]>([]);

    // Phase Notification Banner
    const [phaseBanner, setPhaseBanner] = useState<string | null>(null);

    useEffect(() => {
        if (gameState === 'setup_phase1') {
            setPhaseBanner('ANGEL & DEMON SELECTION');
            const t = setTimeout(() => setPhaseBanner(null), 3000);
            return () => clearTimeout(t);
        } else if (gameState === 'playing') {
            setPhaseBanner('VOTING PHASE');
            const t = setTimeout(() => setPhaseBanner(null), 3000);
            return () => clearTimeout(t);
        } else {
            setPhaseBanner(null);
        }
    }, [gameState]);

    useEffect(() => {
        if (gameState === 'setup_phase1' || gameState === 'playing' || gameState === 'briefing') {
            console.log(`[CLUBS MASTER] Clearing local votes for phase: ${gameState}`);
            setPlayersVotes({});
            setMasterVotes({});
            playersVotesRef.current = {};
            masterVotesRef.current = {};
        }
    }, [round, gameState]);


    const MAX_ROUNDS = 6; // 6 Rounds * 4 Cards/Round = 24 Cards
    const channelRef = useRef<RealtimeChannel | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const isProcessing = useRef(false);
    const gameEnded = useRef(false);
    const lastProcessedPhase = useRef<{ gameState: string, round: number } | null>(null);

    // Score Refs (for Timer access)
    const playerScoreRef = useRef(playerScore);
    playerScoreRef.current = playerScore;
    const masterScoreRef = useRef(masterScore);
    masterScoreRef.current = masterScore;

    // Vote Refs
    const playersVotesRef = useRef<Record<string, string[]>>({});
    playersVotesRef.current = playersVotes;
    const masterVotesRef = useRef<Record<string, string[]>>({});
    masterVotesRef.current = masterVotes;
    const phase1SelectionsRef = useRef<Record<string, any>>({});
    phase1SelectionsRef.current = phase1Selections;

    const [allowedPlayers, setAllowedPlayers] = useState<string[]>([]);
    const [masterUids, setMasterUids] = useState<Set<string>>(new Set());
    const masterUidsRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        masterUidsRef.current = masterUids;
    }, [masterUids]);

    // Helper: Identify if a UID belongs to a Master
    const isMasterUid = (uid: string, allowedPlayersList?: string[]) => {
        if (!uid) return false;
        if (masterUidsRef.current.has(uid)) return true;
        const upper = uid.toUpperCase();
        if (
            upper === 'MASTER' ||
            upper.includes('MASTER') ||
            upper === 'SYSTEM_ARCHITECT' ||
            uid === user?.id ||
            uid === user?.uid
        ) {
            return true;
        }
        const listToUse = allowedPlayersList || allowedPlayers;
        if (listToUse && listToUse.length > 0) {
            return !listToUse.includes(uid);
        }
        return false;
    };

    // Player ID Mapping (UID → #PLAYER_XXX)
    const [playerIdMap, setPlayerIdMap] = useState<Record<string, string>>({});

    // Fetch names for Top Player and Top Master dynamically
    useEffect(() => {
        const uidsToFetch: string[] = [];
        if (topPlayerId && !playerIdMap[topPlayerId] && topPlayerId !== 'TBD' && topPlayerId !== 'MASTER') uidsToFetch.push(topPlayerId);
        if (topMasterId && !playerIdMap[topMasterId] && topMasterId !== 'TBD' && topMasterId !== 'MASTER') uidsToFetch.push(topMasterId);
        
        if (uidsToFetch.length > 0) {
            const fetchProfiles = async () => {
                const { data } = await supabase.from('profiles').select('id, username').in('id', uidsToFetch);
                if (data) {
                    setPlayerIdMap(prev => {
                        const next = { ...prev };
                        data.forEach(p => {
                            if (p.id && p.username) next[p.id] = p.username.toUpperCase();
                        });
                        return next;
                    });
                }
            };
            fetchProfiles();
        }
    }, [topPlayerId, topMasterId, playerIdMap]);

    // Hint Cards State
    const [hintCards, setHintCards] = useState<string[]>([]);

    useEffect(() => {
        if ((round === 1 || round === 4) && playerSelection && playerSelection.angel && playerSelection.demon) {
            const targets = playerSelection;
            const otherCards = cards.filter(c =>
                c.id !== targets.angel &&
                c.id !== targets.demon &&
                !c.isRemoved
            );

            // True Random Decoy Selection (Shuffle then Pick)
            const shuffledOthers = [...otherCards].sort(() => Math.random() - 0.5);
            const randoms = shuffledOthers.slice(0, 2);

            const combinedIds = [
                targets.angel!,
                targets.demon!,
                ...randoms.map(c => c.id)
            ];

            // True Random Display Order
            const finalHintList = [...combinedIds].sort(() => Math.random() - 0.5);
            setHintCards(finalHintList);
        } else {
            setHintCards([]);
        }
        // Only re-run if round or selection changes, NOT on every render/timer tick
    }, [round, playerSelection?.angel, playerSelection?.demon]);

    // Fetch Player ID Mapping from Firestore
    useEffect(() => {
        const fetchPlayerIds = async () => {
            try {
                const { data: users, error } = await supabase.from('profiles').select('*');
                if (error) throw error;
                if (!users) return;

                // Sort users: Admins first, then by Join Date
                users.sort((a: any, b: any) => {
                    const isMasterA = a.role === 'master' || a.role === 'admin' || a.username === 'admin' || a.username?.toLowerCase().includes('architect');
                    const isMasterB = b.role === 'master' || b.role === 'admin' || b.username === 'admin' || b.username?.toLowerCase().includes('architect');

                    if (isMasterA && !isMasterB) return -1;
                    if (!isMasterA && isMasterB) return 1;

                    const timeA = a.createdAt?.seconds || a.createdAt?.toMillis?.() || 0;
                    const timeB = b.createdAt?.seconds || b.createdAt?.toMillis?.() || 0;
                    return timeA - timeB;
                });

                const mapping: Record<string, string> = {};
                const mUids = new Set<string>();
                users.forEach((user: any, index: number) => {
                    const isM = user.role === 'master' || user.role === 'admin' || user.username === 'admin' || user.username?.toLowerCase().includes('architect');
                    if (isM) {
                        if (user.id) mUids.add(String(user.id));
                        if (user.uid) mUids.add(String(user.uid));
                    }
                    const pid = `#PLAYER_${(index + 1).toString().padStart(3, '0')} `;
                    const displayName = user.username || user.email?.split('@')[0] || pid;
                    if (user.id) mapping[user.id] = displayName;
                    if (user.uid) mapping[user.uid] = displayName;
                    if (user.username) mapping[user.username] = displayName;
                });
                console.log('[CLUBS MASTER] First UID sync - Master UIDs:', Array.from(mUids));
                setMasterUids(mUids);

                console.log('[CLUBS MASTER] Player ID Mapping Synchronized:', mapping);
                setPlayerIdMap(mapping);
            } catch (error) {
                console.error('[CLUBS MASTER] Error fetching Player ID Map:', error);
            }
        };
        fetchPlayerIds();
    }, []);

    // --- SCORE INTEGRITY CHECK (Master) ---
    // Fixes the issue where Master syncs with a default 0 score from the DB
    // but actually has a different score in their profile.
    const hasCorrectedScoreRef = useRef(false);

    useEffect(() => {
        const checkIntegrity = async () => {
            if (!user?.id) return;

            // Only run if we haven't corrected yet
            if (!hasCorrectedScoreRef.current) {
                console.log('[CLUBS MASTER] Verifying score integrity...');

                // Check if current start scores are missing or 0
                const { data: latestState } = await supabase
                    .from('clubs_game_status')
                    .select('scores')
                    .eq('id', 'clubs_king')
                    .single();

                const startScores = latestState?.scores?.start || {};
                const currentStartScore = Number(startScores[user.uid] || 0);

                if (currentStartScore === 0) {
                    console.log('[CLUBS MASTER] Start score is 0. Fetching from profile...');
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('visa_points')
                        .eq('email', user.email)
                        .single();

                    if (profile?.visa_points !== undefined && profile.visa_points !== 0) {
                        console.log(`[CLUBS MASTER] SYNCING SCORE: Game(0) -> Profile(${profile.visa_points})`);

                        hasCorrectedScoreRef.current = true;

                        // Force update the DB with correct start AND current scores
                        const newStartScores = { ...startScores, [user.uid]: profile.visa_points };
                        const currentScores = latestState?.scores?.current || {};
                        const newCurrentScores = { ...currentScores, [user.uid]: profile.visa_points };

                        await supabase
                            .from('clubs_game_status')
                            .update({
                                scores: {
                                    ...latestState?.scores,
                                    start: newStartScores,
                                    current: newCurrentScores
                                }
                            })
                            .eq('id', 'clubs_king');

                        console.log('[CLUBS MASTER] Score Synced & Start Score Recorded.');
                    } else {
                        console.log('[CLUBS MASTER] Profile score is also 0 or missing.');
                        hasCorrectedScoreRef.current = true; // Mark checked
                    }
                } else {
                    console.log('[CLUBS MASTER] Start score seems valid:', currentStartScore);
                    hasCorrectedScoreRef.current = true;
                }
            }
        };

        // Run check after a short delay to ensure auth is ready and initial sync happened
        const timer = setTimeout(checkIntegrity, 2000);
        return () => clearTimeout(timer);
    }, [round]);

    // Timer Sync
    const [phaseExpiry, setPhaseExpiry] = useState<Date | null>(null);

    // Detailed Score Helper
    const updateDetailedScores = useCallback((status: any) => {
        if (status.scores && status.scores.current) {
            const currentScores = status.scores.current;

            // Update All Scores for Points Table


            // const myUid = (user?.id as string) || ''; // Unused variable removed

            // Update My Score (as Master)
            const myUId = user?.uid || user?.id || user?.id;
            if (myUId && currentScores[myUId] !== undefined) {
                setMyScore(Number(currentScores[myUId]));
            } else {
                setMyScore(status.master_score || 0);
            }

            // Calculate Tops
            let maxPScore = -Infinity;
            let maxPId = '';
            let maxMScore = -Infinity;
            let maxMId = '';

            // USE WHITELIST for Player Identification
            const playerIds = new Set(status.allowed_players?.map((id: any) => String(id)) || []);
            if (status.allowed_players) {
                setAllowedPlayers(status.allowed_players.map((p: any) => String(p)));
            }

            console.log('[CLUBS MASTER updateDetailedScores] Debug Info:', {
                allowed_players: status.allowed_players,
                playerIds: Array.from(playerIds),
                currentScores,
                myUId
            });

            Object.entries(currentScores).forEach(([uid, score]) => {
                const s = typeof score === 'number' ? score : 0;
                const isPlayer = playerIds.has(uid);

                console.log(`  [CLUBS MASTER]UID: ${uid}, Score: ${s}, IsPlayer: ${isPlayer} `);

                if (isPlayer) {
                    // This is a PLAYER
                    if (s > maxPScore) {
                        maxPScore = s;
                        maxPId = uid;
                    }
                } else {
                    // This is a MASTER or non-whitelisted user
                    if (s > maxMScore) {
                        maxMScore = s;
                        maxMId = uid;
                    }
                }
            });

            console.log('[CLUBS MASTER] Calculated Top Scores:', {
                maxPScore,
                maxPId,
                maxMScore
            });

            // Use calculated scores (trust our whitelist-based calculation)
            // Only fall back to DB if we have no score data at all
            if (maxPScore !== -Infinity) {
                setTopPlayerScore(maxPScore);
                setTopPlayerId(maxPId);
            } else {
                // No player scores found, try DB fallback
                const dbHighP = status.scores?.high_player;
                setTopPlayerScore(dbHighP?.score ?? 0);
                setTopPlayerId(dbHighP?.uid ?? null);
            }

            if (maxMScore !== -Infinity) {
                setTopMasterScore(maxMScore);
                setTopMasterId(maxMId);
            } else {
                const dbHighM = status.scores?.high_master;
                setTopMasterScore(dbHighM?.score ?? 0);
                setTopMasterId(dbHighM?.uid ?? null);
            }
        } else {
            // Fallback
            setTopPlayerScore(status.player_score || 0);
            setTopMasterScore(status.master_score || 0);
            setTopMasterId(status.scores?.high_master?.uid || null);
            setMyScore(status.master_score || 0);
        }
    }, [user]);

    // --- SELF-PERSISTENCE (BACKUP) FOR MASTER ---
    // Ensure master score is saved to profile when game ends.
    const hasPersistedRef = useRef(false);

    // --- FINAL PERSISTENCE (Self-Sync) ---
    // Mirrors the Player component logic for guaranteed absolute pasting.
    useEffect(() => {
        if ((gameState === 'won' || gameState === 'lost') && !hasPersistedRef.current) {
            const syncMyProfileScore = async () => {
                if (!user?.email) return;
                console.log('[CLUBS MASTER] Triggering self-sync (Paste Logic)...');
                hasPersistedRef.current = true;

                try {
                    // Fetch finalized totals from database
                    const token = await getAccessToken();
                    const gameStatusRes = await fetch(`${supabaseUrl}/rest/v1/clubs_game_status?id=eq.clubs_king&select=scores`, {
                        headers: { 'Authorization': `Bearer ${token}`, 'apikey': supabaseKey }
                    });
                    
                    if (gameStatusRes.ok) {
                        const gameStatusData = await gameStatusRes.json();
                        const gameStatus = gameStatusData && gameStatusData.length > 0 ? gameStatusData[0] : null;
                        if (gameStatus) {
                            const finalScores = gameStatus?.scores || {};
                            const currentScores = finalScores.current || {};
                            const mUid = user?.uid || user?.id || user?.id;

                            // Absolute Total reached in game (including bonuses)
                            const myFinalTotal = Number(currentScores[mUid || '']) || myScore;

                            console.log(`[CLUBS MASTER] Pasting final score ${myFinalTotal} to profile ${user.email} `);

                            await supabase.from('profiles').update({ visa_points: myFinalTotal }).eq('email', user.email);
                            console.log('[CLUBS MASTER] ✅ Self-sync complete.');
                        }
                    }
                } catch (err) {
                    console.error('[CLUBS MASTER] Self-sync failed:', err);
                }
            };
            syncMyProfileScore();
        }
        if (gameState !== 'won' && gameState !== 'lost') hasPersistedRef.current = false;
    }, [gameState]);

    // Master Score Initialization - Sync from Profile if 0
    const hasSyncedScoreRef = useRef(false);
    useEffect(() => {
        const syncMasterScore = async () => {
            if (myScore === 0 && !hasSyncedScoreRef.current &&
                gameState !== 'idle' && gameState !== 'won' && gameState !== 'lost' &&
                user?.email) {
                console.log('[CLUBS MASTER] My score is 0, checking profile...');
                hasSyncedScoreRef.current = true;

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('visa_points')
                    .eq('email', user.email)
                    .single();

                if (profile?.visa_points !== undefined && profile.visa_points !== 0) {
                    console.log(`[CLUBS MASTER] Syncing score from profile: ${profile.visa_points} `);

                    // Fetch latest status to get current scores object
                    const token = await getAccessToken();
                    const latestStatusRes = await fetch(`${supabaseUrl}/rest/v1/clubs_game_status?id=eq.clubs_king&select=scores`, {
                        headers: { 'Authorization': `Bearer ${token}`, 'apikey': supabaseKey }
                    });
                    
                    if (latestStatusRes.ok) {
                        const latestStatusData = await latestStatusRes.json();
                        const latestStatus = latestStatusData && latestStatusData.length > 0 ? latestStatusData[0] : null;
                        if (latestStatus) {
                            const currentScores = latestStatus?.scores || { current: {}, history: {}, start: {} };
                            const myUid = user?.uid || user?.id || 'MASTER';

                            const newScores = {
                                ...currentScores,
                                start: { ...currentScores.start, [myUid]: profile.visa_points },
                                current: { ...currentScores.current, [myUid]: profile.visa_points }
                            };

                            // Update game's status in database
                            await fetch(`${supabaseUrl}/rest/v1/clubs_game_status?id=eq.clubs_king`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'apikey': supabaseKey, 'Prefer': 'return=minimal' },
                                body: JSON.stringify({
                                    master_score: profile.visa_points,
                                    scores: newScores
                                })
                            });

                            setMyScore(profile.visa_points);
                        }
                    }
                }
            }
        };

        syncMasterScore();
    }, [myScore, gameState]);

    // Initial Board Setup
    const initializeBoard = useCallback((_currentRound: number, currentCards: Card[]) => {
        const expectedSuffix = _currentRound >= 4 ? '-2' : '-1';

        if (currentCards.length > 0 && currentCards[0].id.endsWith(expectedSuffix)) return currentCards;

        // Fallback: Generate based on Round
        const suffix = _currentRound >= 4 ? '-2' : '-1';

        return RANKS.map(rank => ({
            id: `clubs-${rank}${suffix}`,
            suit: 'clubs' as const,
            rank,
            playerRole: null,
            masterRole: null,
            isRevealed: false,
            isRemoved: false
        }));
    }, []);

    // Load Initial State - Fetch Player IDs
    useEffect(() => {
        const fetchPlayerIds = async () => {
            try {
                const { data: users, error } = await supabase.from('profiles').select('*');
                if (error) throw error;
                if (!users) return;

                // Sort users to match Admin Dashboard logic
                users.sort((a: any, b: any) => {
                    // 1. Force Admin/Game Master to ALWAYS be the first element
                    const isMasterA = a.role === 'master' || a.role === 'admin' || a.username === 'admin';
                    const isMasterB = b.role === 'master' || b.role === 'admin' || b.username === 'admin';

                    if (isMasterA && !isMasterB) return -1;
                    if (!isMasterA && isMasterB) return 1;

                    // 2. Sort remaining players by Join Date (Oldest to Newest)
                    const timeA = a.createdAt?.seconds || a.createdAt?.toMillis?.() || 0;
                    const timeB = b.createdAt?.seconds || b.createdAt?.toMillis?.() || 0;

                    return timeA - timeB;
                });

                const mapping: Record<string, string> = {};
                const mUids = new Set<string>();
                let mCount = 1;
                let pCount = 1;

                users.forEach((u: any) => {
                    const isMaster = u.role === 'master' || u.role === 'admin' || u.username === 'admin' || u.username?.toLowerCase().includes('architect');
                    if (isMaster) {
                        if (u.id) mUids.add(String(u.id));
                        if (u.uid) mUids.add(String(u.uid));
                        const mid = `#MASTER_${mCount.toString().padStart(3, '0')} `;
                        if (u.id) mapping[u.id] = mid;
                        if (u.username) mapping[u.username] = mid;
                        mCount++;
                    } else {
                        const pid = `#PLAYER_${pCount.toString().padStart(3, '0')} `;
                        if (u.id) mapping[u.id] = pid;
                        if (u.username) mapping[u.username] = pid;
                        pCount++;
                    }
                });
                console.log('[CLUBS MASTER] Second UID sync - Master UIDs:', Array.from(mUids));
                setMasterUids(mUids);

                console.log('Role Standardisation (Master):', { mapping });
                setPlayerIdMap(mapping);
            } catch (error) {
                console.error('Error fetching player IDs:', error);
            }
        };
        fetchPlayerIds();
    }, []);

    // --- SYNC PLAYER START SCORES (Ensure Game Score = Visa Balance) ---
    const hasSyncedPlayersRef = useRef(false);
    useEffect(() => {
        const syncPlayerScores = async () => {
            if (!hasSyncedPlayersRef.current &&
                gameState !== 'idle' && gameState !== 'won' && gameState !== 'lost') {

                // Check if we need to sync (if start scores are empty or missing for players)
                try {
                    const token = await getAccessToken();
                    const statusDataRes = await fetch(`${supabaseUrl}/rest/v1/clubs_game_status?id=eq.clubs_king&select=scores,allowed_players`, {
                        headers: { 'Authorization': `Bearer ${token}`, 'apikey': supabaseKey }
                    });
                    let statusData = null;
                    if (statusDataRes.ok) {
                        const dataArray = await statusDataRes.json();
                        statusData = dataArray && dataArray.length > 0 ? dataArray[0] : null;
                    }
                    
                    if (statusData) {
                        const currentStart = statusData?.scores?.start || {};
                        const playerIds: string[] = statusData?.allowed_players?.map((p: any) => String(p)) || [];

                        // Filter IDs that need syncing (not in start scores) -- OR force sync if it looks like 0
                        const idsToSync = playerIds.filter(id => currentStart[id] === undefined || currentStart[id] === 0);

                        if (idsToSync.length > 0) {
                            console.log(`[SCORE SYNC] Found ${idsToSync.length} players needing start score sync...`);
                            hasSyncedPlayersRef.current = true;

                            // 1. Get Emails from Users
                            const { data: usersData } = await supabase
                                .from('profiles')
                                .select('id, email')
                                .in('id', idsToSync);

                            if (usersData && usersData.length > 0) {
                                const emails = usersData.map(u => u.email);
                                // 2. Get Visa Points from Profiles
                                const { data: profilesData } = await supabase
                                    .from('profiles')
                                    .select('email, visa_points')
                                    .in('email', emails);

                                if (profilesData) {
                                    const newStart = { ...currentStart };
                                    const newCurrent = { ...(statusData?.scores?.current || {}) };
                                    let updated = false;

                                    usersData.forEach(user => {
                                        const profile = profilesData.find(p => p.email === user.email);
                                        if (profile) {
                                            const points = profile.visa_points || 1000; // Default 1000 if null
                                            // Only update if current game score is 0 (to avoid overwriting progress)
                                            // OR if we are in early rounds/setup
                                            if (newStart[user.id] !== points) {
                                                newStart[user.id] = points;

                                                // Initialize current if it's 0/undefined, otherwise keep the delta logic (current = start + delta)
                                                // Ideally, if we change start, we should adjust current to maintain the same DELTA? 
                                                // User Request implies: Game Score SHOULD MATCH Profile. 
                                                // So we set Current = Points (assuming no gameplay happened yet, or we resync balance)
                                                // If mid-game, this is risky. But for "Fix this", we assume the current game score is 'wrong' (0-based).
                                                if (!newCurrent[user.id] || newCurrent[user.id] === 0) {
                                                    newCurrent[user.id] = points;
                                                } else {
                                                    // If they have a score (e.g. 870), and start was 0.
                                                    // We want to shift the baseline.
                                                    // Old: Start 0, Current 870. Delta +870.
                                                    // New: Start 1000. Current ??
                                                    // If we want Final to be 870. Current must be 870.
                                                    // New Start 1000. New Current 870. Delta -130.
                                                    // This effectively "corrects" the Delta history too? No, history is just log.
                                                    // We just leave Current as is (870) and update Start (1000).
                                                    // Future Deltas will be calculated from 1000 -> 870.
                                                }
                                                updated = true;
                                                console.log(`[SCORE SYNC] Synced ${user.email} -> Start: ${points} `);
                                            }
                                        }
                                    });

                                    if (updated) {
                                        const updateToken = await getAccessToken();
                                        await fetch(`${supabaseUrl}/rest/v1/clubs_game_status?id=eq.clubs_king`, {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${updateToken}`, 'apikey': supabaseKey, 'Prefer': 'return=minimal' },
                                            body: JSON.stringify({
                                                scores: {
                                                    ...(statusData?.scores || {}),
                                                    start: newStart,
                                                    current: newCurrent
                                                }
                                            })
                                        });
                                    }
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error('[SCORE SYNC ERROR]', err);
                }
            }
        };

        syncPlayerScores();
    }, [gameState]);



    useEffect(() => {
        const fetchState = async () => {
            const accessToken = await getAccessToken();
            const res = await fetch(`${supabaseUrl}/rest/v1/clubs_game_status?id=eq.clubs_king&select=*`, {
                headers: { 'Authorization': `Bearer ${accessToken}`, 'apikey': supabaseKey, 'Accept': 'application/vnd.pgrst.object+json' }
            });
            const data = await res.json();
            if (data && !data.error) {
                // CRITICAL: Check for system shutdown / reset
                if ((!data.system_start || data.round_data?.force_reset) && gameStateRef.current !== 'idle') {
                    console.log('!!! FORCE RESET DETECTED ON LOAD !!!');
                    setGameState('idle');
                    if (!isEngine) window.location.href = '/home/card';
                    return;
                }
                
                if (data.system_start) {
                    const resolvedState = data.gameState || 'setup_phase1';
                    setGameState(resolvedState);
                    setRound(data.current_round);
                    setPlayerScore(data.player_score);
                    setMasterScore(data.master_score);
                    updateDetailedScores(data);

                    // Check round_data first if column is missing (Sync Fix)
                    const phaseExpirySource = data.phase_expiry || data.round_data?.phase_expiry;

                    if (phaseExpirySource) {
                        setPhaseExpiry(new Date(phaseExpirySource));
                    } else {
                        // Start Engine Default (Only Engine initiates default timers if missing)
                        if (isEngine) {
                            let expiryDate = null;
                            const now = new Date();
                            if (resolvedState === 'briefing') expiryDate = new Date(now.getTime() + 20000);
                            else if (resolvedState === 'setup_phase1') expiryDate = new Date(now.getTime() + 60000);
                            else if (resolvedState === 'selection_reveal') expiryDate = new Date(now.getTime() + 10000);
                            else if (resolvedState === 'playing') expiryDate = new Date(now.getTime() + 120000);
                            else if (resolvedState === 'round_reveal') expiryDate = new Date(now.getTime() + 30000);

                            if (expiryDate) {
                                setPhaseExpiry(expiryDate);
                                // Also persist this newly generated expiry so players get it
                                const token = await getAccessToken();
                                await fetch(`${supabaseUrl}/rest/v1/clubs_game_status?id=eq.clubs_king`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'apikey': supabaseKey, 'Prefer': 'return=minimal' },
                                    body: JSON.stringify({ phase_expiry: expiryDate.toISOString() })
                                });
                            }
                        }
                    }
                }

                const removed = data.removed_cards_m || [];
                setCards(prev => prev.map(c => ({ ...c, isRemoved: removed.includes(c.id) })));

                if (data.round_data) {
                    // Load Active Deck if exists
                    if (data.round_data.decks?.active) {
                        const loadedDeck = data.round_data.decks.active;
                        setCards(loadedDeck.map((c: Card) => ({
                            ...c,
                            isRemoved: removed.includes(c.id)
                        })));
                    }
                    if (data.round_data.master_selection) setMySelection(data.round_data.master_selection);
                    if (data.round_data.phase1_selections) setPhase1Selections(data.round_data.phase1_selections);
                    if (data.round_data.player_selection) {
                        setPlayerSelection(data.round_data.player_selection);
                        setPlayerLocked(true);
                    }
                    const hM = data.round_data.hint_cards_m || data.round_data.hint_cards;
                    if (hM) setHintCards(hM);
                    if (data.gameState !== 'playing') {
                        if (data.round_data.player_votes) setPlayersVotes(data.round_data.player_votes);
                        if (data.round_data.master_votes) setMasterVotes(data.round_data.master_votes);
                    }
                    if (data.round_data.evaluation_results) setRoundResults(data.round_data.evaluation_results);
                }

                // RECOVERY: If game is active but no deck exists in DB
                if (data.system_start && (!data.round_data?.decks?.active || data.round_data.decks.active.length === 0)) {
                    console.warn('RECOVERY: System Started but No Deck Found. Generating...');
                    const fullDeck = generateRandomDeck();
                    const activeDeck = fullDeck.slice(0, 12);
                    const reserveDeck = fullDeck.slice(12, 24);

                    setCards(activeDeck);
                    // Update DB
                    const nextRoundData = { ...(data.round_data || {}), decks: { active: activeDeck, reserve: reserveDeck } };

                    const token = await getAccessToken();
                    await fetch(`${supabaseUrl}/rest/v1/clubs_game_status?id=eq.clubs_king`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'apikey': supabaseKey, 'Prefer': 'return=minimal' },
                        body: JSON.stringify({
                            round_data: nextRoundData,
                            gameState: data.gameState || 'setup_phase1'
                        })
                    });
                }

                // AUTO-START: If system_start is true but gameState is idle, start the game
                if (isEngine && data.system_start && (!data.gameState || data.gameState === 'idle') && (!data.round_data?.decks?.active)) {
                    console.log('⚠️ Auto-starting game (system_start=true but gameState=idle)');

                    // Generate Random Deck
                    const fullDeck = generateRandomDeck();
                    const activeDeck = fullDeck.slice(0, 12);
                    const reserveDeck = fullDeck.slice(12, 24);

                    const now = new Date();
                    const expiry = new Date(now.getTime() + 60000);  // 60s briefing

                    await new Promise(r => setTimeout(r, 1000)); // Delay to ensure Realtime doesn't batch or drop the state change

                    const token = await getAccessToken();
                    await fetch(`${supabaseUrl}/rest/v1/clubs_game_status?id=eq.clubs_king`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'apikey': supabaseKey, 'Prefer': 'return=minimal' },
                        body: JSON.stringify({
                            gameState: 'briefing',  // Start with briefing for Round 1
                            current_round: 1,
                            phase_expiry: expiry.toISOString(),
                            round_data: {
                                decks: { active: activeDeck, reserve: reserveDeck },
                                phase_expiry: expiry.toISOString() // Redundant but safe
                            }
                        })
                    });

                    setGameState('briefing');
                    setRound(1);
                    setPhaseExpiry(expiry);
                }
            }
        };
        fetchState();
        
        let isFetchingSync = false;
        const syncInterval = setInterval(async () => {
            if (isEngine || isFetchingSync) return;
            isFetchingSync = true;
            try {
                await fetchState();
            } finally {
                isFetchingSync = false;
            }
        }, 15000);
        
        return () => clearInterval(syncInterval);
    }, [initializeBoard, isEngine]);

    // Timer & Auto-Advance Logic
    useEffect(() => {
        if (gameState === 'won' || gameState === 'lost') return;

        const timer = setInterval(() => {
            // Don't countdown if game is paused
            if (isPaused) return;

            if (phaseExpiry) {
                const now = new Date();
                const diff = Math.floor((phaseExpiry.getTime() - now.getTime()) / 1000);
                const secondsLeft = Math.max(0, diff);

                setTimeLeft(secondsLeft);

                // Admin Engine ONLY: Advance phase when time is up
                if (isEngine && secondsLeft <= 0) {
                    if (!isProcessing.current) {
                        console.log("⏰ TIME'S UP! Advancing to next phase...", {
                            gameState,
                            round,
                            phaseExpiry: phaseExpiry.toISOString(),
                        }); 
                        advancePhase();
                    }
                }
            } else {
                setTimeLeft(0);
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [phaseExpiry, isPaused, isEngine, gameState, round]); // CRITICAL: Added gameState and round to dependencies

    // Subscriptions
    useEffect(() => {
        const fetchMessages = async () => {
            const { data } = await supabase.from('messages').select('*').eq('game_id', 'clubs_king').eq('channel', 'master').order('created_at', { ascending: false }).limit(50);
            if (data) setMessages([...data].reverse());
        };
        fetchMessages();

        const channel = supabase.channel('clubs_king_game', {
            config: { presence: { key: 'master' } }
        });
        channelRef.current = channel;

        channel
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'clubs_game_status', filter: 'id=eq.clubs_king' }, async (payload) => {
                const status = payload.new;
                updateDetailedScores(status);

                // CRITICAL: Check for force reset or system shutdown
                if (status.round_data?.force_reset || (!status.system_start && gameStateRef.current !== 'idle')) {
                    console.log('!!! FORCE RESET DETECTED IN DATABASE !!!');
                    setGameState('idle');
                    if (!isEngine) window.location.href = '/home/card';
                    return; // Exit early
                }

                // AUTO-START FROM REALTIME (If admin initiates while master is on page)
                if (isEngine && status.system_start && gameStateRef.current === 'idle') {
                    console.log('⚠️ Auto-starting game from realtime listener');
                    const fullDeck = generateRandomDeck();
                    const activeDeck = fullDeck.slice(0, 12);
                    const reserveDeck = fullDeck.slice(12, 24);
                    const now = new Date();

                    // Let briefing play out for 60 seconds
                    const expiry = new Date(now.getTime() + 60000);

                    // CRITICAL FIX: Save to local state so advancePhase doesn't see an empty deck!
                    setCards(activeDeck);

                    await new Promise(r => setTimeout(r, 1000)); // Delay to ensure Realtime doesn't batch or drop the state change

                    const token = await getAccessToken();
                    fetch(`${supabaseUrl}/rest/v1/clubs_game_status?id=eq.clubs_king`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'apikey': supabaseKey, 'Prefer': 'return=minimal' },
                        body: JSON.stringify({
                            gameState: 'briefing',
                            current_round: 1,
                            phase_expiry: expiry.toISOString(),
                            round_data: {
                                decks: { active: activeDeck, reserve: reserveDeck },
                                phase_expiry: expiry.toISOString()
                            }
                        })
                    });

                    setGameState('briefing');
                    setRound(1);
                    setPhaseExpiry(expiry);
                    return;
                }

                const phaseExpirySource = status.phase_expiry !== undefined ? status.phase_expiry : status.round_data?.phase_expiry;
                let expiryDate: Date | null = null;

                if (phaseExpirySource) {
                    expiryDate = new Date(phaseExpirySource);
                } else if (status.phase_expiry === null) {
                    expiryDate = null;
                    setPhaseExpiry(null);
                    setTimeLeft(0);
                } else if (!phaseExpiry && status.gameState) {
                    const now = new Date();
                    if (status.gameState === 'briefing') expiryDate = new Date(now.getTime() + 20000);
                    else if (status.gameState === 'setup_phase1') expiryDate = new Date(now.getTime() + 60000);
                    else if (status.gameState === 'selection_reveal') expiryDate = new Date(now.getTime() + 10000);
                    else if (status.gameState === 'playing') expiryDate = new Date(now.getTime() + 60000);
                    else if (status.gameState === 'round_reveal') expiryDate = new Date(now.getTime() + 10000);
                }

                if (expiryDate) {
                    setPhaseExpiry(expiryDate);
                    const now = new Date();
                    const diff = Math.floor((expiryDate.getTime() - now.getTime()) / 1000);
                    setTimeLeft(Math.max(0, diff));
                }

                if (status.gameState) setGameState(status.gameState);
                if (status.is_paused !== undefined) setIsPaused(status.is_paused);
                // Prevent regression: Only update if server round is >= local round
                if (status.current_round !== undefined && status.current_round >= round) {
                    setRound(status.current_round);
                }
                if (status.player_score !== undefined) {
                    const ps = typeof status.player_score === 'number' ? status.player_score : parseInt(status.player_score);
                    setPlayerScore(isNaN(ps) ? 0 : ps);
                }
                if (status.master_score !== undefined) {
                    const ms = typeof status.master_score === 'number' ? status.master_score : parseInt(status.master_score);
                    setMasterScore(isNaN(ms) ? 0 : ms);
                }

                if (status.removed_cards_m) {
                    setCards(prev => prev.map(c => ({ ...c, isRemoved: status.removed_cards_m.includes(c.id) })));
                }

                if (status.round_data) {
                    if (status.round_data.decks?.active) {
                        setCards(prev => {
                            const newDeck = status.round_data.decks.active;
                            const removed = status.removed_cards_m || [];
                            return newDeck.map((c: any) => ({ ...c, isRemoved: removed.includes(c.id) }));
                        });
                    }
                    if (status.round_data.phase1_selections) setPhase1Selections(status.round_data.phase1_selections);
                    if (status.round_data.player_selection) {
                        setPlayerSelection(status.round_data.player_selection);
                        setPlayerLocked(true);
                    }
                    if (status.round_data.master_selection) {
                        setMySelection(status.round_data.master_selection);
                    }
                    const hM = status.round_data.hint_cards_m || status.round_data.hint_cards;
                    if (hM) setHintCards(hM);
                    if (status.gameState !== 'playing') {
                        if (status.round_data.player_votes) setPlayersVotes(status.round_data.player_votes);
                        if (status.round_data.master_votes) setMasterVotes(status.round_data.master_votes);
                    }
                    if (status.round_data.evaluation_results) setRoundResults(status.round_data.evaluation_results);
                }

                // --- SYNC DETAILED SCORES (HUD) ---
                if (status.scores) {
                    const currentScores = status.scores.current || {};
                    const mUid = user?.uid || user?.id || user?.id;

                    // Update local Master score
                    if (mUid && currentScores[mUid] !== undefined) {
                        setMyScore(Number(currentScores[mUid]));
                    }

                    // Update Top Scores
                    if (status.scores.high_player) {
                        setTopPlayerScore(status.scores.high_player.score || 0);
                        setTopPlayerId(status.scores.high_player.uid || null);
                    }
                    if (status.scores?.high_master) {
                        setTopMasterScore(status.scores.high_master.score || 0);
                        setTopMasterId(status.scores.high_master.uid || null);
                    }
                }
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'game_id=eq.clubs_king' }, (payload) => {
                if (payload.new.channel === 'master') setMessages(prev => [...prev, payload.new]);
            })
            .on('broadcast', { event: 'force_exit' }, () => {
                console.log("FORCE EXIT RECEIVED");
                if (!isEngine) {
                    window.location.href = '/home/card';
                }
            })
            .on('broadcast', { event: 'vote_cast' }, (p: any) => {
                const { userId, votes, team } = p.payload;
                console.log('=== MASTER RECEIVED VOTE ===', { userId, votes, team });
                if (team === 'player' || team === 'participants') {
                    setPlayersVotes(prev => {
                        const newVotes = { ...prev, [userId]: votes };
                        playersVotesRef.current = newVotes; // Keep ref in sync
                        console.log('Player votes updated:', userId, votes);
                        return newVotes;
                    });
                }
            })
            .on('broadcast', { event: 'phase1_vote' }, async (p: any) => {
                const { userId, selection } = p.payload;
                console.log('=== MASTER RECEIVED PHASE 1 SELECTION ===', { userId, selection });

                // Update local state and ref immediately
                setPhase1Selections(prev => {
                    const newSelections = { ...prev, [userId]: selection };
                    phase1SelectionsRef.current = newSelections;
                    return newSelections;
                });
            })
            .on('broadcast', { event: 'master_vote' }, (p: any) => {
                const { votes } = p.payload;
                console.log('=== ENGINE RECEIVED MASTER VOTE ===', votes);
                setMasterVotes(votes);
                masterVotesRef.current = votes; // Keep ref in sync
            })
            .on('broadcast', { event: 'eval_debug' }, (p: any) => {
                console.log('%c[CLUBS EVAL DEBUG]', 'color: #00ff00; font-weight: bold; font-size: 14px;', p.payload);
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [playerLocked, isEngine]);

    // Chat Auto-Scroll
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);


    // --- ACTION HANDLERS ---

    const handleCardClick = (cardId: string) => {
        if (gameState === 'setup_phase1') {
            const card = cards.find(c => c.id === cardId);
            if (!card || card.isRemoved) return;

            setMySelection(prev => {
                const isAngel = prev.angel === cardId;
                const isDemon = prev.demon === cardId;
                let next = { ...prev };

                if (isAngel) next.angel = null;
                else if (isDemon) next.demon = null;
                else {
                    if (!next.angel) next.angel = cardId;
                    else if (!next.demon) next.demon = cardId;
                    else next.angel = cardId;
                }
                updateMasterSelection(next);
                return next;
            });
        }
        if (gameState === 'playing') {
            const card = cards.find(c => c.id === cardId);
            if (!card || card.isRemoved) return;

            // INDIVIDUAL VOTING LOGIC
            const myId = user?.uid || user?.id || 'MASTER'; // Use Auth ID or Fallback
            const currentVotes = masterVotes[myId] || [];
            let newVotes = [...currentVotes];

            if (newVotes.includes(cardId)) {
                newVotes = newVotes.filter(id => id !== cardId);
            } else {
                if (newVotes.length >= 2) return;
                newVotes.push(cardId);
            }

            const updatedMap = { ...masterVotes, [myId]: newVotes };
            setMasterVotes(updatedMap);

            // Broadcast Master Vote
            channelRef.current?.send({
                type: 'broadcast',
                event: 'master_vote',
                payload: { votes: updatedMap } // Send FULL map? Or just delta? Let's send full map for sync simplicity
            });

            // If running on Master player (not engine), save directly to DB as well for 100% reliability
            if (!isEngine) {
                updateMasterVotesInDb(updatedMap);
            }
        }
    };

    const updateMasterSelection = async (sel: any) => {
        const accessToken = await getAccessToken();
        const res = await fetch(`${supabaseUrl}/rest/v1/clubs_game_status?id=eq.clubs_king&select=round_data`, {
            headers: { 'Authorization': `Bearer ${accessToken}`, 'apikey': supabaseKey, 'Accept': 'application/vnd.pgrst.object+json' }
        });
        const currentDataRes = await res.json();
        const currentData = currentDataRes?.round_data || {};

        // CRITICAL FIX: Prevent overwriting round_data with stale deck state!
        if (currentData.decks?.active && cards.length > 0) {
            const dbDeckId = currentData.decks.active[0]?.id;
            const localDeckId = cards[0]?.id;
            if (dbDeckId !== localDeckId) {
                console.warn('⚠️ DB round_data is stale! Retrying master_selection update in 500ms...');
                setTimeout(() => updateMasterSelection(sel), 500);
                return;
            }
        }

        const patchRes = await fetch(`${supabaseUrl}/rest/v1/clubs_game_status?id=eq.clubs_king`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'apikey': supabaseKey,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ round_data: { ...currentData, master_selection: sel } })
        });
        if (patchRes.ok) {
            console.log('[CLUBS MASTER] Successfully saved master selection to DB:', sel);
        } else {
            console.error('[CLUBS MASTER] Failed to save master selection to DB:', patchRes.status, await patchRes.text());
        }
    };

    const updateMasterVotesInDb = async (updatedVotesMap: Record<string, string[]>) => {
        try {
            const accessToken = await getAccessToken();
            const res = await fetch(`${supabaseUrl}/rest/v1/clubs_game_status?id=eq.clubs_king&select=round_data`, {
                headers: { 'Authorization': `Bearer ${accessToken}`, 'apikey': supabaseKey, 'Accept': 'application/vnd.pgrst.object+json' }
            });
            const currentDataRes = await res.json();
            const currentData = currentDataRes?.round_data || {};

            // Merge updatedVotesMap into round_data.master_votes
            const existingMasterVotes = currentData.master_votes || {};
            const newMasterVotes = { ...existingMasterVotes, ...updatedVotesMap };

            const patchRes = await fetch(`${supabaseUrl}/rest/v1/clubs_game_status?id=eq.clubs_king`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                    'apikey': supabaseKey,
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ round_data: { ...currentData, master_votes: newMasterVotes } })
            });
            if (patchRes.ok) {
                console.log('[CLUBS MASTER] Successfully saved master votes to DB:', newMasterVotes);
            } else {
                console.error('[CLUBS MASTER] Failed to save master votes to DB:', patchRes.status, await patchRes.text());
            }
        } catch (err) {
            console.error('Error updating master votes in DB:', err);
        }
    };

    async function advancePhase() {
        if (gameEnded.current) return;
        if (isProcessing.current) return;
        if (lastProcessedPhase.current?.gameState === gameState && lastProcessedPhase.current?.round === round) return;

        isProcessing.current = true;
        console.log("ADVANCE PHASE TRIGGERED", gameState, round);

        try {
            const executePhase = async () => {
                const now = new Date();

                const doUpdate = async (payload: any) => {
                    const accessToken = await getAccessToken();
                    const res = await fetch(`${supabaseUrl}/rest/v1/clubs_game_status?id=eq.clubs_king`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${accessToken}`,
                            'apikey': supabaseKey,
                            'Prefer': 'return=minimal'
                        },
                        body: JSON.stringify(payload)
                    });
                    if (!res.ok) throw new Error("Supabase update failed: " + await res.text());
                };

                if (gameState === 'briefing') {
                    const duration = 60;
                    const expiry = new Date(now.getTime() + duration * 1000);
                    const accessToken = await getAccessToken();
                    const currentDataRes = await fetch(`${supabaseUrl}/rest/v1/clubs_game_status?id=eq.clubs_king&select=round_data`, {
                        headers: { 'Authorization': `Bearer ${accessToken}`, 'apikey': supabaseKey, 'Accept': 'application/vnd.pgrst.object+json' }
                    });
                    const currentData = await currentDataRes.json();
                    const preservedRoundData = currentData?.round_data || {};

                    await doUpdate({
                        gameState: 'setup_phase1',
                        current_round: 1,
                        phase_expiry: expiry.toISOString(),
                        round_data: {
                            ...preservedRoundData,
                            player_selection: { angel: null, demon: null },
                            master_selection: { angel: null, demon: null }
                        },
                        removed_cards_p: [],
                        removed_cards_m: []
                    });

                    setGameState('setup_phase1');
                    setPhaseExpiry(expiry);
                }
                else if (gameState === 'setup_phase1' || gameState === 'setup') {
                    console.log('🎬 PHASE 1 TRANSITION TRIGGERED');
                    console.log('Current time:', new Date().toISOString());
                    console.log('Phase expiry:', phaseExpiry?.toISOString());

                    // FETCH & AUTO-FILL SELECTIONS using REST API to prevent supabase-js lockups
                    const accessToken = await getAccessToken();
                    const statusRes = await fetch(`${supabaseUrl}/rest/v1/clubs_game_status?id=eq.clubs_king&select=round_data,removed_cards_m,removed_cards_p`, {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'apikey': supabaseKey,
                            'Accept': 'application/vnd.pgrst.object+json'
                        }
                    });
                    const currentStatus = await statusRes.json();
                    let rData = currentStatus?.round_data || {};
                    const dbRemoved = currentStatus?.removed_cards_m || [];
                    let pSel = rData.player_selection || { angel: null, demon: null };
                    const mSel = rData.master_selection || mySelection || { angel: null, demon: null };

                    console.log('Player selection before auto-pick:', pSel);
                    console.log('Master selection before auto-pick:', mSel);
                    console.log('DB Removed Cards:', dbRemoved);

                    // Helper to get random unpicked card - STRICT VALIDATION
                    const getAvailableCard = (excludeIds: (string | null)[]) => {
                        // 1. Get truly removed cards from DB state (Combine ALL removal sources)
                        const effectivelyRemoved = new Set([
                            ...(dbRemoved || []),
                            ...(currentStatus?.removed_cards_p || []),
                            ...(currentStatus?.removed_cards_m || []),
                            ...cards.filter(c => c.isRemoved).map(c => c.id)
                        ]);

                        // 2. Filter available cards
                        const validCards = cards.filter(c =>
                            !c.isRemoved &&
                            !effectivelyRemoved.has(c.id) &&
                            !excludeIds.includes(c.id)
                        );

                        if (validCards.length === 0) {
                            console.warn("[AUTO-PICK] No valid cards left! Returning null.");
                            return null;
                        }

                        const picked = validCards[Math.floor(Math.random() * validCards.length)].id;
                        console.log(`[AUTO - PICK] Selected ${picked} from ${validCards.length} candidates.`);
                        return picked;
                    };

                    // NEW: Calculate Top Votes from Individual Selections
                    // Read from local ref instead of database to avoid connection exhaustion during setup_phase1
                    const pSelections = phase1SelectionsRef.current || {};
                    const angelVotes: Record<string, number> = {};
                    const demonVotes: Record<string, number> = {};

                    Object.values(pSelections).forEach((sel: any) => {
                        if (sel.angel) angelVotes[sel.angel] = (angelVotes[sel.angel] || 0) + 1;
                        if (sel.demon) demonVotes[sel.demon] = (demonVotes[sel.demon] || 0) + 1;
                    });

                    // Helper to get top card id (with tie-breaking)
                    const getTopCard = (votesMap: Record<string, number>, excludeIds: (string | null)[]) => {
                        let maxVotes = -1;
                        let candidates: string[] = [];

                        Object.entries(votesMap).forEach(([cardId, count]) => {
                            if (excludeIds.includes(cardId)) return;
                            if (count > maxVotes) {
                                maxVotes = count;
                                candidates = [cardId];
                            } else if (count === maxVotes) {
                                candidates.push(cardId);
                            }
                        });

                        if (candidates.length > 0) {
                            // Tie-Breaker: Randomly pick one of the top voted cards
                            return candidates[Math.floor(Math.random() * candidates.length)];
                        }
                        return null;
                    };

                    // Determine Locked Selections
                    // First lock Angel, then Demon (excluding Angel)
                    let lockedAngel = getTopCard(angelVotes, []);
                    let lockedDemon = getTopCard(demonVotes, [lockedAngel]);

                    // Fallback: If no votes or invalid, pick random available
                    if (!lockedAngel) lockedAngel = getAvailableCard([lockedDemon, mSel.angel, mSel.demon]);
                    // If still null (e.g. no available cards?? unlikely), just keep null or try again
                    if (!lockedDemon) lockedDemon = getAvailableCard([lockedAngel, mSel.angel, mSel.demon]);

                    // Final Check to ensure we have selections
                    if (!lockedAngel) lockedAngel = getAvailableCard([lockedDemon, mSel.angel, mSel.demon]);

                    pSel = { angel: lockedAngel, demon: lockedDemon };

                    // Auto-Pick for Master (unchanged)
                    if (!mSel.angel) mSel.angel = getAvailableCard([mSel.demon]);
                    if (!mSel.demon) mSel.demon = getAvailableCard([mSel.angel]);

                    console.log('Final Locked Player Selection (Vote Based):', pSel);
                    console.log('Master selection after auto-pick:', mSel);

                    // NEW: Assign Marks (Roles) to the card objects
                    const updatedActiveDeck = cards.map(c => {
                        let playerRole = null;
                        let masterRole = null;
                        if (c.id === pSel.angel) playerRole = 'angel';
                        else if (c.id === pSel.demon) playerRole = 'demon';

                        if (c.id === mSel.angel) masterRole = 'angel';
                        else if (c.id === mSel.demon) masterRole = 'demon';

                        return { ...c, playerRole, masterRole };
                    });

                    // Generate Hint Cards centrally for Round 1 & 4
                    let hintCardsM: string[] = [];
                    let hintCardsP: string[] = [];
                    if (round === 1 || round === 4) {
                        if (mSel.angel && mSel.demon) {
                            const targets = mSel;
                            const otherCards = cards.filter(c => c.id !== targets.angel && c.id !== targets.demon && !c.isRemoved && !dbRemoved.includes(c.id));
                            const shuffledOthers = [...otherCards].sort(() => Math.random() - 0.5);
                            const randoms = shuffledOthers.slice(0, 2);
                            hintCardsP = [targets.angel, targets.demon, ...randoms.map(c => c.id)].sort(() => Math.random() - 0.5);
                        }
                        if (pSel.angel && pSel.demon) {
                            const targets = pSel;
                            const otherCards = cards.filter(c => c.id !== targets.angel && c.id !== targets.demon && !c.isRemoved && !dbRemoved.includes(c.id));
                            const shuffledOthers = [...otherCards].sort(() => Math.random() - 0.5);
                            const randoms = shuffledOthers.slice(0, 2);
                            hintCardsM = [targets.angel, targets.demon, ...randoms.map(c => c.id)].sort(() => Math.random() - 0.5);
                        }
                    }

                    // Update Round Data with Calculated Locks AND Updated Deck
                    rData = {
                        ...rData,
                        player_selection: pSel,
                        master_selection: mSel,
                        hint_cards: hintCardsP, // Fallback for players
                        hint_cards_p: hintCardsP,
                        hint_cards_m: hintCardsM,
                        decks: {
                            ...rData.decks,
                            active: updatedActiveDeck
                        }
                    };

                    // NEW: Go to Selection Reveal (Interim Phase)
                    const duration = 10;
                    const expiry = new Date(now.getTime() + duration * 1000);
                    console.log('⏭️ Transitioning to selection_reveal');

                    await doUpdate({
                        gameState: 'selection_reveal',
                        phase_expiry: expiry.toISOString(),
                        round_data: rData
                    });

                    setGameState('selection_reveal');
                    setPhaseExpiry(expiry);
                }
                else if (gameState === 'selection_reveal') {
                    // NEW: Go to Hunter Play
                    const duration = 60;
                    const expiry = new Date(now.getTime() + duration * 1000);

                    await doUpdate({
                        gameState: 'playing',
                        phase_expiry: expiry.toISOString()
                    });

                    setGameState('playing');
                    setPhaseExpiry(expiry);
                    setMasterVotes({});
                }
                else if (gameState === 'playing') {
                    const duration = 12; // 12s Card Reveal Animation
                    const expiry = new Date(now.getTime() + duration * 1000);

                    // FETCH latest round_data to avoid overwriting selections/decks
                    const accessToken = await getAccessToken();
                    const statusRes = await fetch(`${supabaseUrl}/rest/v1/clubs_game_status?id=eq.clubs_king&select=round_data`, {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'apikey': supabaseKey,
                            'Accept': 'application/vnd.pgrst.object+json'
                        }
                    });
                    const currentStatus = await statusRes.json();
                    const rData = currentStatus?.round_data || {};

                    console.log('Saving all collected votes to DB at playing -> card_reveal transition:', {
                        player_votes: playersVotesRef.current,
                        master_votes: masterVotesRef.current
                    });

                    // Merge DB votes with engine's broadcast refs key-by-key
                    const mergeVotes = (dbVotes: any, refVotes: any) => {
                        const merged = { ...(dbVotes || {}) };
                        if (refVotes) {
                            Object.entries(refVotes).forEach(([uid, votes]) => {
                                if (Array.isArray(votes) && votes.length > 0) {
                                    merged[uid] = votes;
                                }
                            });
                        }
                        return merged;
                    };

                    await doUpdate({
                        gameState: 'card_reveal',
                        phase_expiry: expiry.toISOString(),
                        round_data: {
                            ...rData,
                            player_votes: mergeVotes(rData.player_votes, playersVotesRef.current),
                            master_votes: mergeVotes(rData.master_votes, masterVotesRef.current)
                        }
                    });

                    setGameState('card_reveal');
                    setPhaseExpiry(expiry);
                }
                else if (gameState === 'card_reveal') {
                    await performEvaluation();
                }
                else if (gameState === 'round_reveal') {
                    const nextRound = round + 1;

                    const transitionPromise = (async () => {
                        if (nextRound > 6) { // MAX_ROUNDS
                            // GAME COMPLETE
                            gameEnded.current = true;
                            const accessToken = await getAccessToken();
                            const combinedRes = await fetch(`${supabaseUrl}/rest/v1/clubs_game_status?id=eq.clubs_king&select=scores,allowed_players`, {
                                headers: { 'Authorization': `Bearer ${accessToken}`, 'apikey': supabaseKey, 'Accept': 'application/vnd.pgrst.object+json' }
                            });
                            const combinedData = await combinedRes.json();
                            const finalScores = combinedData?.scores || { current: {}, history: {}, start: {} };
                            const finalCurrent = finalScores.current || {};
                            const playerIds = new Set<string>((combinedData?.allowed_players || []).map((id: any) => String(id)));
                            const playerIdsArr = Array.from(playerIds);

                            let maxPlayerScore = -Infinity;
                            let maxMasterScore = -Infinity;

                            Object.entries(finalCurrent).forEach(([uid, score]) => {
                                const numScore = typeof score === 'number' ? score : 0;
                                const isPlayer = playerIds.has(uid);
                                const isMasterId = uid === 'MASTER' || uid.includes('MASTER') || uid.startsWith('master_');

                                if (!isPlayer || isMasterId || uid === user?.uid || uid === user?.id) {
                                    if (numScore > maxMasterScore) maxMasterScore = numScore;
                                } else {
                                    if (numScore > maxPlayerScore) maxPlayerScore = numScore;
                                }
                            });

                            if (maxPlayerScore === -Infinity) maxPlayerScore = 0;
                            if (maxMasterScore === -Infinity) maxMasterScore = 0;

                            const playersWon = maxPlayerScore > maxMasterScore;
                            const mastersWon = maxMasterScore > maxPlayerScore;

                            const adjustedCurrent: Record<string, number> = {};
                            Object.entries(finalCurrent).forEach(([uid, score]) => {
                                const numScore = typeof score === 'number' ? score : 0;
                                const isMaster = isMasterUid(uid, playerIdsArr);
                                if (playersWon) {
                                    adjustedCurrent[uid] = numScore + (isMaster ? -500 : 500);
                                } else if (mastersWon) {
                                    adjustedCurrent[uid] = numScore + (isMaster ? 500 : -500);
                                } else {
                                    adjustedCurrent[uid] = numScore; // Tie
                                }
                            });

                            const playerScoresEnd = Object.entries(adjustedCurrent).filter(([k]) => !isMasterUid(k, playerIdsArr)).map(([, v]) => v);
                            const masterScoresEnd = Object.entries(adjustedCurrent).filter(([k]) => isMasterUid(k, playerIdsArr)).map(([, v]) => v);

                            const newLegacyPScore = playerScoresEnd.length > 0 ? Math.max(...playerScoresEnd) : 0;
                            const newLegacyMScore = masterScoresEnd.length > 0 ? Math.max(...masterScoresEnd) : 0;

                            let topPlayerIdEnd = 'TBD';
                            let topMasterIdEnd = 'MASTER';
                            Object.entries(adjustedCurrent).forEach(([uid, s]) => {
                                const score = Number(s) || 0;
                                if (isMasterUid(uid, playerIdsArr)) {
                                    if (score === newLegacyMScore) topMasterIdEnd = uid;
                                } else {
                                    if (score === newLegacyPScore) topPlayerIdEnd = uid;
                                }
                            });

                            const mUid = user?.uid || user?.id || user?.id;
                            if (mUid && adjustedCurrent[mUid] !== undefined) {
                                setMyScore(adjustedCurrent[mUid]);
                            }
                            setTopPlayerScore(newLegacyPScore);
                            setTopMasterScore(newLegacyMScore);
                            setTopPlayerId(topPlayerIdEnd);
                            setTopMasterId(topMasterIdEnd);

                            console.log('[CLUBS MASTER] Persisting stats...');
                            // Run persistClubsStats in background, do not await it here so it doesn't block phase transition
                            const persistClubsStats = async () => {
                                try {
                                    const participantIds = Object.keys(adjustedCurrent);
                                    if (participantIds.length > 0) {
                                        const token = await getAccessToken();
                                        const res = await fetch(`${supabaseUrl}/rest/v1/profiles?id=in.(${participantIds.join(',')})&select=id,email,wins,losses,visa_points`, {
                                            headers: { 'Authorization': `Bearer ${token}`, 'apikey': supabaseKey, 'Accept': 'application/json' }
                                        });
                                        if (res.ok) {
                                            const profilesData = await res.json();
                                            for (const profile of profilesData) {
                                                const uid = profile.id;
                                                if (!profile.email) continue;
                                                const initialScore = finalScores?.start?.[uid] || 0;
                                                const finalScore = adjustedCurrent[uid] || 0;
                                                const isWin = finalScore >= initialScore;
                                                
                                                await fetch(`${supabaseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(profile.email)}`, {
                                                    method: 'PATCH',
                                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'apikey': supabaseKey, 'Prefer': 'return=minimal' },
                                                    body: JSON.stringify({ 
                                                        visa_points: finalScore, 
                                                        wins: (profile.wins || 0) + (isWin ? 1 : 0), 
                                                        losses: (profile.losses || 0) + (isWin ? 0 : 1) 
                                                    })
                                                });
                                            }
                                        }
                                    }
                                } catch (e) { console.error(e); }
                            };
                            persistClubsStats();

                            try {
                                await doUpdate({
                                    gameState: 'won',
                                    player_score: newLegacyPScore,
                                    master_score: newLegacyMScore,
                                    scores: {
                                        ...finalScores,
                                        current: adjustedCurrent,
                                        high_player: { score: newLegacyPScore, uid: topPlayerIdEnd },
                                        high_master: { score: newLegacyMScore, uid: topMasterIdEnd }
                                    },
                                    phase_expiry: null
                                });
                            } catch (endError) {
                                console.error("[CRITICAL] Failed to update game state to 'won':", endError);
                            }

                            onComplete(newLegacyPScore);
                        } else {
                            const duration = 60;
                            const expiry = new Date(now.getTime() + duration * 1000);
                            const accessToken = await getAccessToken();
                            const statusRes = await fetch(`${supabaseUrl}/rest/v1/clubs_game_status?id=eq.clubs_king&select=*`, {
                                headers: { 'Authorization': `Bearer ${accessToken}`, 'apikey': supabaseKey, 'Accept': 'application/vnd.pgrst.object+json' }
                            });
                            const currentStatus = await statusRes.json();
                            let nextRoundData = currentStatus?.round_data || {};

                            const pSel = nextRoundData.player_selection || { angel: null, demon: null };
                            const mSel = nextRoundData.master_selection || { angel: null, demon: null };
                            const cardsToRemove = [mSel.angel, mSel.demon, pSel.angel, pSel.demon].filter(Boolean);
                            const prevRemovedP = currentStatus?.removed_cards_p || [];
                            const prevRemovedM = currentStatus?.removed_cards_m || [];

                            const finalRemovedP = Array.from(new Set([...prevRemovedP, ...cardsToRemove]));
                            const finalRemovedM = Array.from(new Set([...prevRemovedM, ...cardsToRemove]));

                            // CLEAR SELECTIONS FOR NEW ROUND
                            nextRoundData.player_selection = { angel: null, demon: null };
                            nextRoundData.master_selection = { angel: null, demon: null };

                            if (nextRoundData.decks && Array.isArray(nextRoundData.decks.reserve)) {
                                if (nextRound === 4) {
                                    console.log('=== DECK SCENARIO: SWAPPING TO SET 2 ===');
                                    if (nextRoundData.decks.reserve.length > 0) {
                                        nextRoundData.decks.active = nextRoundData.decks.reserve;
                                        nextRoundData.decks.reserve = [];
                                        setCards(nextRoundData.decks.active);
                                    }
                                }
                            }

                            await doUpdate({
                                gameState: 'setup_phase1',
                                current_round: nextRound,
                                round_data: nextRoundData,
                                phase_expiry: expiry.toISOString(),
                                removed_cards_p: finalRemovedP,
                                removed_cards_m: finalRemovedM
                            });

                            setRound(nextRound);
                            setGameState('setup_phase1');
                            setPhaseExpiry(expiry);
                            setMySelection({ angel: null, demon: null });
                            setPlayerLocked(false);
                            setMasterVotes({});
                            setPlayersVotes({});
                            setPhase1Selections({}); // Clear for next round
                        }
                    })();

                    await transitionPromise;
                }
            }; // End executePhase

            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Global Phase Transition Timeout')), 60000));
            await Promise.race([executePhase(), timeoutPromise]);

            lastProcessedPhase.current = { gameState, round };
        } catch (err) {
            console.error("ADVANCE PHASE ERROR:", err);
            const isTimeoutError = err instanceof Error && (
                err.message.includes('Global Phase Transition Timeout') ||
                err.message.includes('Global Fetch Timeout') ||
                err.message.toLowerCase().includes('timeout') ||
                err.name === 'AbortError' ||
                err.message.toLowerCase().includes('aborted')
            );
            
            if (isTimeoutError) {
                console.warn("[ADVANCE PHASE] Engine transition timed out globally. Will automatically retry on next tick.");
                lastProcessedPhase.current = null; // Clear so it can retry
                return;
            }
            if (!isEngine) {
                alert("SYSTEM ERROR: PHASE TRANSITION FAILED");
            } else {
                console.error("SYSTEM ERROR: PHASE TRANSITION FAILED");
            }
            setShowResetOverlay(true);
        } finally {
            isProcessing.current = false;
        }
    };

    async function performEvaluation() {
        console.log("[EVAL TRACE] 1. Starting performEvaluation...");
        try {
            const now = new Date();
            const duration = 10; // 10s Eval
            const expiry = new Date(now.getTime() + duration * 1000);

            console.log("[EVAL TRACE] 2. Fetching clubs_game_status (using fetch)...");
            const accessToken = await getAccessToken();
            const statusRes = await fetch(`${supabaseUrl}/rest/v1/clubs_game_status?id=eq.clubs_king&select=*`, {
                headers: { 'Authorization': `Bearer ${accessToken}`, 'apikey': supabaseKey, 'Accept': 'application/vnd.pgrst.object+json' }
            });
            const data = await statusRes.json();
            const rData = data?.round_data || {};

            let activeGameId = data.active_game_id;
            if (!activeGameId) {
                console.error("[CRITICAL] No active_game_id found! Attempting recovery...");

                console.log("[EVAL TRACE] 3. Fetching clubs_game_sessions...");
                // 1. Try to find an existing active session
                const latestSessionRes = await fetch(`${supabaseUrl}/rest/v1/clubs_game_sessions?status=eq.active&select=id&order=created_at.desc.nullslast&limit=1`, {
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'apikey': supabaseKey }
                });
                const latestSessionData = await latestSessionRes.json();
                const latestSession = latestSessionData && latestSessionData.length > 0 ? latestSessionData[0] : null;

                if (latestSession) {
                    activeGameId = latestSession.id;
                    console.log(`[RECOVERY] Found existing active session: ${activeGameId} `);
                } else {
                    // 2. If no session exists, CREATE ONE
                    console.warn("[RECOVERY] No active session found. Creating new session...");
                    const newSessionRes = await fetch(`${supabaseUrl}/rest/v1/clubs_game_sessions`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}`, 'apikey': supabaseKey, 'Prefer': 'return=representation' },
                        body: JSON.stringify([{
                            status: 'active',
                            total_rounds: 6,
                            current_round: round,
                            metadata: { created_via: 'auto_recovery' }
                        }])
                    });
                    
                    if (newSessionRes.ok) {
                        const newSessionData = await newSessionRes.json();
                        const newSession = newSessionData && newSessionData.length > 0 ? newSessionData[0] : null;
                        if (newSession) {
                            activeGameId = newSession.id;
                            console.log(`[RECOVERY] Created new session: ${activeGameId} `);
                        }
                    } else {
                        console.error("[RECOVERY FAILED] Could not create session:", await newSessionRes.text());
                    }
                }

                // Update the game status with whatever we found/created
                if (activeGameId) {
                    await fetch(`${supabaseUrl}/rest/v1/clubs_game_status?id=eq.clubs_king`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}`, 'apikey': supabaseKey, 'Prefer': 'return=minimal' },
                        body: JSON.stringify({ active_game_id: activeGameId })
                    });
                }
            }

            const pSel = rData.player_selection || { angel: null, demon: null };
            const mSel = rData.master_selection || { angel: null, demon: null };
            const currentScores = data.scores || { current: {}, history: {} };

            const currentPVotesMap = (rData.player_votes || {}) as Record<string, string[]>;
            const currentMVotesMap = (rData.master_votes || {}) as Record<string, string[]>;

            const mUid = user?.uid || user?.id || user?.id;

            const allParticipants = new Set<string>();
            if (data?.allowed_players && Array.isArray(data.allowed_players)) {
                data.allowed_players.forEach((uid: any) => { if (uid) allParticipants.add(String(uid)); });
            }
            if (currentScores?.start) {
                Object.keys(currentScores.start).forEach(uid => allParticipants.add(uid));
            }
            if (mUid) allParticipants.add(mUid);

            const participantIds = Array.from(allParticipants);
            const roundScores: Record<string, number> = {};
            const resList: any[] = [];
            const masterIds = new Set(Object.keys(currentMVotesMap));
            if (mUid) masterIds.add(mUid);
            if (user?.uid) masterIds.add(user.uid);
            if (user?.id) masterIds.add(user.id);
            masterIds.add('MASTER');
            masterIds.add('SYSTEM_ARCHITECT');

            console.log(`[CLUBS EVAL] Master IDs: `, Array.from(masterIds), "mUid:", mUid);

            const angelReward = 300 - ((round - 1) * 50);

            const voteCount: Record<string, number> = {};
            Object.values(currentPVotesMap).forEach((votes) => {
                votes.forEach((cardId) => {
                    voteCount[cardId] = (voteCount[cardId] || 0) + 1;
                });
            });

            const sortedCards = Object.entries(voteCount).sort((a, b) => b[1] - a[1]);
            const topVotedCards: string[] = [];
            if (sortedCards.length > 0) {
                topVotedCards.push(sortedCards[0][0]);
                if (sortedCards.length > 1 && sortedCards[1][1] > 0) {
                    topVotedCards.push(sortedCards[1][0]);
                }
            }

            const playerIdsArr = data?.allowed_players ? data.allowed_players.map((id: any) => String(id)) : [];

            participantIds.forEach(uid => {
                let score = 0;
                const reasons: string[] = [];
                const isMaster = isMasterUid(uid, playerIdsArr);
                const votes = isMaster ? currentMVotesMap[uid] : currentPVotesMap[uid];

                if (!votes || votes.length === 0) {
                    score = -30;
                    reasons.push('DID NOT VOTE');
                } else {
                    if (isMaster) {
                        // Master votes directly guess the Players' hidden cards (pSel)
                        votes.forEach((votedCardId) => {
                            if (votedCardId === pSel.angel) {
                                score += angelReward;
                                reasons.push('FOUND PLAYER ANGEL');
                            } else if (votedCardId === pSel.demon) {
                                score -= 50;
                                reasons.push('FOUND PLAYER DEMON');
                            }
                        });
                    } else {
                        // Players' votes (guesses of Master cards) are evaluated via consensus
                        topVotedCards.forEach((consensusCard) => {
                            if (votes.includes(consensusCard)) {
                                if (consensusCard === mSel.angel) {
                                    score += angelReward;
                                    reasons.push('CONSENSUS: FOUND ANGEL');
                                } else if (consensusCard === mSel.demon) {
                                    score -= 50;
                                    reasons.push('CONSENSUS: FOUND DEMON');
                                }
                            }
                        });
                    }
                    if (score === 0) reasons.push('NO TARGET ACQUIRED');
                }

                roundScores[uid] = score;
                resList.push({
                    targetId: uid,
                    team: isMaster ? 'master' : 'player',
                    change: score,
                    reason: reasons.join(' + ')
                });
            });

            const newHistory = { ...currentScores.history };
            const newCurrent = { ...currentScores.current };

            participantIds.forEach(uid => {
                const delta = roundScores[uid] || 0;
                const baseline = Number(currentScores.start?.[uid] || 0);
                const currentTotal = newCurrent[uid] !== undefined ? Number(newCurrent[uid]) : baseline;

                newCurrent[uid] = currentTotal + delta;

                if (!newHistory[uid]) newHistory[uid] = [];
                newHistory[uid].push({ round, score: delta, total: newCurrent[uid] });
            });

            // Calculate Top Scores from NEW TOTALS
            let maxPScore = -Infinity;
            let maxMScore = -Infinity;
            let topPId = '';

            Object.entries(newCurrent).forEach(([uid, s]) => {
                const isMaster = isMasterUid(uid, playerIdsArr);
                const score = Number(s) || 0;
                if (isMaster) {
                     if (score > maxMScore) maxMScore = score;
                } else {
                     if (score > maxPScore) {
                         maxPScore = score;
                         topPId = uid;
                     }
                }
            });

            if (maxPScore === -Infinity) maxPScore = 0;
            if (maxMScore === -Infinity) maxMScore = 0;

            const highPlayer = { score: maxPScore, uid: topPId || 'TBD' };
            const highMaster = { score: maxMScore, uid: mUid || 'MASTER' };

            const playerScoresList = Object.entries(newCurrent).filter(([k]) => !isMasterUid(k, playerIdsArr)).map(([, v]) => v as number);
            const masterScoresList = Object.entries(newCurrent).filter(([k]) => isMasterUid(k, playerIdsArr)).map(([, v]) => v as number);

            const newLegacyPScore = playerScoresList.length > 0 ? Math.max(...playerScoresList) : 0;
            const newLegacyMScore = masterScoresList.length > 0 ? Math.max(...masterScoresList) : 0;

            console.log("[EVAL TRACE] 4. Updating game status to round_reveal...");
            await fetch(`${supabaseUrl}/rest/v1/clubs_game_status?id=eq.clubs_king`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}`, 'apikey': supabaseKey, 'Prefer': 'return=minimal' },
                body: JSON.stringify({
                    gameState: 'round_reveal',
                    phase_expiry: expiry.toISOString(),
                    scores: {
                        start: currentScores.start,
                        current: newCurrent,
                        history: newHistory,
                        high_player: highPlayer,
                        high_master: highMaster
                    },
                    player_score: newLegacyPScore,
                    master_score: newLegacyMScore,
                    round_data: {
                        ...rData,
                        evaluation_results: resList,
                        top_votes: topVotedCards
                    }
                })
            });
            // --- PERSIST ROUND SCORES ---
            // NOTE: The legacy RPC upsert_round_points was removed because it conflicts
            // with the generated column "total_points" in the database. 
            // We now rely exclusively on the clubs_round_scores history table below.

            // --- SAVE ROUND SCORES TO HISTORY TABLE ---
            console.log(`[ROUND SCORES] Saving round ${round} scores to history table...`);
            try {
                const roundScoreRecords = [];

                // Batch fetch all player profiles
                const nonMasterUids = participantIds.filter(uid => !uid.includes('MASTER') && uid !== user?.uid && uid !== user?.id && uid !== 'SYSTEM_ARCHITECT');
                const profilesMap: Record<string, string> = {};

                if (nonMasterUids.length > 0) {
                    console.log("[EVAL TRACE] 5. Fetching player profiles...");
                    const profilesRes = await fetch(`${supabaseUrl}/rest/v1/profiles?select=id,email&id=in.(${nonMasterUids.join(',')})`, {
                        headers: { 'Authorization': `Bearer ${accessToken}`, 'apikey': supabaseKey }
                    });
                    if (profilesRes.ok) {
                        const profilesData = await profilesRes.json();
                        profilesData.forEach((p: any) => {
                            if (p.id && p.email) profilesMap[p.id] = p.email;
                        });
                    }
                }

                for (const uid of participantIds) {
                    try {
                        // Skip system IDs
                        if (uid === 'SYSTEM_ARCHITECT') continue;

                        const pointsEarned = roundScores[uid] || 0;
                        const totalScore = newCurrent[uid] || 0;

                        // Fetch email for this user
                        let userEmail = null;
                        if (uid.includes('MASTER') || uid === user?.uid || uid === user?.id) {
                            userEmail = user?.email;
                        } else {
                            // Find email in batch map
                            userEmail = profilesMap[uid] || null;
                        }

                        if (userEmail) {
                            roundScoreRecords.push({
                                game_id: 'clubs_king',
                                player_email: userEmail,
                                player_uid: uid,
                                round_number: round,
                                points_earned: pointsEarned,
                                total_score: totalScore
                            });
                        }
                    } catch (err) {
                        console.error(`[ROUND SCORES] Error preparing record for ${uid}: `, err);
                    }
                }

                // Batch insert all round scores
                if (roundScoreRecords.length > 0) {
                    console.log("[EVAL TRACE] 6. Upserting round scores...");
                    const upsertRes = await fetch(`${supabaseUrl}/rest/v1/clubs_round_scores?on_conflict=game_id,player_email,round_number`, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json', 
                            'Authorization': `Bearer ${accessToken}`, 
                            'apikey': supabaseKey, 
                            'Prefer': 'resolution=merge-duplicates' 
                        },
                        body: JSON.stringify(roundScoreRecords)
                    });

                    if (!upsertRes.ok) {
                        console.error('[ROUND SCORES] Error saving round scores:', await upsertRes.text());
                    } else {
                        console.log(`[ROUND SCORES] Successfully saved ${roundScoreRecords.length} round score records`);
                    }
                }
            } catch (roundScoreErr) {
                console.error('[ROUND SCORES] Critical error:', roundScoreErr);
            }

            console.log("[EVAL TRACE] 7. Broadcasting results...");
            // BROADCAST RESULTS (Critical for Player View)
            // NON-BLOCKING: We do not await this, so a broken WebSocket doesn't stall the entire Game Engine.
            Promise.resolve(channelRef.current?.send({
                type: 'broadcast',
                // Use 'round_reveal' to match the gameState - ensure ClubsGame.tsx listens for this!
                event: 'round_results',
                payload: {
                    playerAngel: pSel.angel, playerDemon: pSel.demon, masterAngel: mSel.angel, masterDemon: mSel.demon,
                    playerScore: newLegacyPScore, masterScore: newLegacyMScore, resList: resList,
                    // Fix for HUD not updating: Send the RAW points for the specific player to handle locally if needed
                    currentScores: newCurrent
                }
            })).catch(e => console.warn("Broadcast failed, likely due to disconnected socket:", e));

            // Local Updates
            console.log("[EVAL TRACE] 8. Local updates...");
            setGameState('round_reveal');
            setPhaseExpiry(expiry);
            setPlayerScore(newLegacyPScore);
            setMasterScore(newLegacyMScore);
            const currentMyUid = user?.uid || user?.id;
            if (currentMyUid) setMyScore(newCurrent[currentMyUid] || 0);
            setTopPlayerScore(newLegacyPScore);
            setTopPlayerId(topPId);
            setTopMasterScore(newLegacyMScore);
            setTopMasterId(mUid || 'MASTER');

            // Debug broadcast for the Master Player console
            Promise.resolve(channelRef.current?.send({
                type: 'broadcast',
                event: 'eval_debug',
                payload: {
                    round,
                    currentPVotesMap,
                    currentMVotesMap,
                    playerIdsArr,
                    participantIds,
                    topVotedCards,
                    resList
                }
            })).catch(e => console.warn("Debug broadcast failed:", e));

            console.log("=== EVALUATION COMPLETE ===");
        } catch (evalErr) {
            console.error("CRITICAL EVALUATION ERROR:", evalErr);
            if (!isEngine) {
                alert("SYSTEM ERROR DURING EVALUATION. CHECK CONSOLE.");
            } else {
                console.error("SYSTEM ERROR DURING EVALUATION.");
            }
        }
    };



    if ((!cards || cards.length === 0) && gameState !== 'idle') return <Loader />;

    if (isEngine) return null;

    return (
        <div className="relative w-full h-full bg-[#050508] flex flex-col font-sans overflow-hidden">
            {/* PHASE NOTIFICATION BANNER */}
            <AnimatePresence>
                {phaseBanner && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 50 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
                        className="absolute inset-0 z-[200] flex items-center justify-center pointer-events-none"
                    >
                        <div className="bg-black/80 border border-white/20 p-8 sm:p-12 rounded-xl backdrop-blur-md shadow-[0_0_50px_rgba(255,255,255,0.1)] text-center">
                            <p className="text-white/50 text-sm tracking-[0.3em] uppercase mb-2">PHASE INITIATED</p>
                            <h2 className="text-3xl sm:text-5xl font-mono text-white tracking-widest font-bold drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                                {phaseBanner}
                            </h2>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* HEADER HUB - Consolidated with Main Header */}
            <div className={`px-4 py-3 sm:px-8 sm:py-2 border-b border-white/5 flex flex-col sm:flex-row justify-center items-center bg-white/[0.01] z-[110] gap-4 sm:gap-0 relative`}>

                {/* POINTS TABLE BUTTON */}
                <button
                    onClick={() => setShowPointsTable(true)}
                    className="sm:absolute sm:left-4 sm:top-1/2 sm:-translate-y-1/2 flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/60 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-all mb-2 sm:mb-0"
                >
                    <FileText size={14} />
                    <span>Rules & Points</span>
                </button>

                <div className="flex items-center gap-4 sm:gap-8 w-full sm:w-auto justify-center">
                    <div className="flex items-center gap-4 sm:gap-8 border-l-0 sm:border-l border-white/10 pl-0 sm:pl-8 w-full justify-around sm:justify-start">
                        {/* ROUND */}
                        <div className="text-center min-w-[40px]">
                            <p className="text-[7px] text-white/30 uppercase tracking-widest mb-0.5">ROUND</p>
                            <p className="text-xs sm:text-lg font-mono font-bold text-white leading-none">{round}/6</p>
                        </div>

                        <div className="w-px h-6 bg-white/10" />

                        {/* TOP PLAYER */}
                        <div className="text-center min-w-[70px] sm:min-w-[100px]">
                            <p className="text-[7px] text-yellow-500/50 uppercase tracking-widest mb-0.5">TOP PLAYER</p>
                            <div className="flex flex-col items-center leading-none">
                                <p className="text-[7px] sm:text-[9px] font-bold text-yellow-500 mb-0.5 truncate max-w-[80px] sm:max-w-none">{topPlayerId && playerIdMap[topPlayerId] ? playerIdMap[topPlayerId] : (topPlayerId || '--')}</p>
                                <p className="text-xs sm:text-lg font-mono font-black text-white">{topPlayerScore}</p>
                            </div>
                        </div>

                        <div className="w-px h-6 bg-white/10" />

                        {/* TOP MASTER */}
                        <div className="text-center min-w-[40px]">
                            <p className="text-[7px] text-red-500/50 uppercase tracking-widest mb-0.5">TOP MASTER</p>
                            <div className="flex flex-col items-center leading-none">
                                <p className="text-[7px] sm:text-[9px] font-bold text-red-500 mb-0.5 truncate max-w-[80px] sm:max-w-none">{topMasterId && playerIdMap[topMasterId] ? playerIdMap[topMasterId] : (topMasterId || '--')}</p>
                                <p className="text-xs sm:text-lg font-mono font-bold text-white">{topMasterScore}</p>
                            </div>
                        </div>

                        <div className="w-px h-6 bg-white/10" />

                        {/* MY SCORE */}
                        <div className="text-center min-w-[40px]">
                            <p className="text-[7px] text-blue-500/50 uppercase tracking-widest mb-0.5">MY SCORE</p>
                            <p className="text-xs sm:text-lg font-mono font-bold text-white leading-none">{myScore}</p>
                        </div>

                        <div className="w-px h-6 bg-white/10" />

                        {/* TIMER */}
                        <div className="text-center min-w-[60px]">
                            <p className="text-[7px] text-red-500/50 uppercase tracking-widest mb-0.5">TIME</p>
                            <div className="flex items-center justify-center gap-1">
                                <Timer size={12} className="text-red-500" />
                                <p className="text-xs sm:text-lg font-mono font-black text-red-500 leading-none">{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* MAIN AREA */}
            <div className="flex-1 flex flex-col sm:flex-row overflow-hidden relative z-10">

                {/* GAME BOARD */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-8 scrollbar-hide relative bg-black/40">

                    {/* INFO HUD */}
                    <div className="max-w-6xl mx-auto mb-8 flex justify-between items-end">
                        <div className="space-y-1">
                            <h2 className="text-2xl font-cinzel font-bold text-white uppercase tracking-widest">
                                {gameState === 'playing' ? "HUNTING PHASE" :
                                    gameState === 'card_reveal' ? "CARD REVEAL" :
                                        gameState === 'selection_reveal' ? "CARD REVEAL" : "SETUP PHASE"}
                            </h2>
                            <p className="text-white/40 font-mono text-xs uppercase tracking-widest">
                                {gameState === 'setup_phase1' ? "SELECT YOUR HIDDEN AGENTS. PLAYER CONSENSUS PENDING." :
                                    gameState === 'selection_reveal' ? "REVEALING SELECTIONS..." :
                                        gameState === 'playing' ? "GUESS PLAYER'S CARDS. PLAYERS ARE VOTING." :
                                            gameState === 'card_reveal' ? "REVEALING SELECTIONS..." :
                                                gameState === 'round_reveal' ? "EVALUATING ROUND OUTCOME..." : "AWAITING ACTION..."}
                            </p>
                        </div>

                        {/* Hint Box for Round 1 & 4 */}
                        <AnimatePresence>
                            {(round === 1 || round === 4) && gameState === 'playing' && (
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="px-4 py-2 bg-purple-500/10 border border-purple-500/30 rounded-lg backdrop-blur-md shadow-[0_0_20px_rgba(168,85,247,0.15)] flex flex-col items-center gap-2"
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                                        <span className="text-[10px] font-black text-purple-400 tracking-[0.2em] uppercase">Tactical Intel</span>
                                    </div>
                                    <div className="flex gap-2">
                                        {hintCards.map(hId => {
                                            const card = cards.find(c => c.id === hId);
                                            const rank = card?.rank || '?';
                                            const suit = card?.suit || 'clubs';
                                            const symbol = suit === 'hearts' ? '♥' : suit === 'diamonds' ? '♦' : suit === 'spades' ? '♠' : '♣';
                                            const color = (suit === 'hearts' || suit === 'diamonds') ? 'text-red-500' : 'text-white';

                                            return (
                                                <div key={hId} className="w-10 h-10 sm:w-12 sm:h-12 rounded bg-white/5 border border-white/10 flex flex-col items-center justify-center shadow-lg group hover:border-purple-500/50 transition-all">
                                                    <span className={`text - sm sm: text - base font - black ${color} leading - none`}>{rank}</span>
                                                    <span className={`text - [10px] sm: text - xs ${color} opacity - 80`}>{symbol}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <p className="text-[7px] text-white/40 font-mono uppercase tracking-widest text-center mt-1">Player's heroes hidden in this set</p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Master Selection Display */}
                        {(gameState === 'setup_phase1' || gameState === 'setup' || gameState === 'selection_reveal') && (
                            <div className="flex items-center gap-4">
                                <div className={`relative px-4 py-3 rounded-lg border transition-all duration-300 ${mySelection.angel ? 'border-yellow-500/50 bg-yellow-500/10 shadow-[0_0_15px_rgba(234,179,8,0.1)]' : 'border-white/5 bg-white/[0.02]'} text-center min-w-[100px]`}>
                                    <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-yellow-500/30 to-transparent" />
                                    <p className="text-[8px] text-yellow-500/70 font-black uppercase tracking-[0.2em] mb-1">SECRET ANGEL</p>
                                    <p className="text-[6px] text-white/30 uppercase tracking-widest mb-1.5 leading-none">CONSENSUS TARGET</p>
                                    <p className="text-xl font-mono font-black text-white">{cards.find(c => c.id === mySelection.angel)?.rank || '-'}</p>
                                </div>

                                <div className={`relative px-4 py-3 rounded-lg border transition-all duration-300 ${mySelection.demon ? 'border-red-500/50 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'border-white/5 bg-white/[0.02]'} text-center min-w-[100px]`}>
                                    <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />
                                    <p className="text-[8px] text-red-500/70 font-black uppercase tracking-[0.2em] mb-1">SECRET DEMON</p>
                                    <p className="text-[6px] text-white/30 uppercase tracking-widest mb-1.5 leading-none">AVOIDANCE TARGET</p>
                                    <p className="text-xl font-mono font-black text-white">{cards.find(c => c.id === mySelection.demon)?.rank || '-'}</p>
                                </div>

                                <div className="h-8 w-px bg-white/5 mx-2" />

                                <div className={`px-4 py-3 rounded-lg border transition-all duration-300 ${Object.keys(phase1Selections).length > 0 || (playerSelection.angel && playerSelection.demon) ? 'border-green-500/30 bg-green-500/5 shadow-[0_0_15px_rgba(34,197,94,0.1)]' : 'border-white/5 bg-white/[0.02]'} text-center min-w-[120px]`}>
                                    <p className="text-[8px] text-white/30 font-black uppercase tracking-[0.2em] mb-1.5">PLAYER STATUS</p>
                                    <div className="flex items-center justify-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full ${Object.keys(phase1Selections).length > 0 || (playerSelection.angel && playerSelection.demon) ? 'bg-green-500' : 'bg-white/10 animate-pulse'}`} />
                                        <p className={`text-[10px] font-mono font-bold ${Object.keys(phase1Selections).length > 0 || (playerSelection.angel && playerSelection.demon) ? 'text-green-500' : 'text-white/40'}`}>
                                            {Object.keys(phase1Selections).length > 0 || (playerSelection.angel && playerSelection.demon) ? 'SYNC_LOCKED' : 'CALCULATING...'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* BRIEFING STATE */}
                        {gameState === 'briefing' && (
                            <div className="absolute inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center">
                                <div className="max-w-4xl mx-auto text-center space-y-8 p-8">
                                    <h1 className="text-4xl font-cinzel font-black text-white uppercase tracking-[0.2em]">
                                        Protocol Briefing
                                    </h1>
                                    <div className="h-1 w-64 mx-auto bg-gradient-to-r from-transparent via-green-500 to-transparent" />
                                    <div className="space-y-4 text-white/80 font-mono text-center">
                                        <p className="text-xl">Initializing Game Engine...</p>
                                        <p className="text-sm">Players are receiving mission parameters.</p>
                                        <p className="text-sm text-green-500 font-bold animate-pulse mt-4">AWAITING PHASE SHIFT...</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* START GAME BUTTON - Only show when idle */}
                        {gameState === 'idle' && (
                            <button
                                onClick={async () => {
                                    try {
                                        const now = new Date();
                                        const expiry = new Date(now.getTime() + 60000); // 60s for setup

                                        // FORCE NEW DECK GENERATION
                                        const fullDeck = generateRandomDeck();
                                        const activeDeck = fullDeck.slice(0, 12);
                                        const reserveDeck = fullDeck.slice(12, 24);

                                        // -----------------------------------------------------
                                        // ROBUST SCORE INITIALIZATION (Case-Insensitive)
                                        // -----------------------------------------------------
                                        console.log('[CLUBS MASTER] Initializing Scores...');
                                        const { data: statusData } = await supabase.from('clubs_game_status').select('allowed_players').eq('id', 'clubs_king').single();
                                        const allowedIds = statusData?.allowed_players || [];

                                        let initialStartScores: Record<string, number> = {};

                                        if (allowedIds.length > 0) {
                                            // 1. Fetch Emails
                                            const { data: userData } = await supabase.from('profiles').select('id, email').in('id', allowedIds);
                                            const idEmailMap: Record<string, string> = {};
                                            const emails: string[] = [];

                                            // 2. Build Maps
                                            if (userData) {
                                                userData.forEach((u: any) => {
                                                    if (u.email) {
                                                        idEmailMap[u.id] = u.email;
                                                        emails.push(u.email);
                                                    }
                                                });
                                            }

                                            // 3. Fetch Profiles & Map (Case-Insensitive)
                                            if (emails.length > 0) {
                                                const orFilter = emails.map(e => `email.ilike.${e} `).join(',');
                                                const { data: profileData } = await supabase.from('profiles').select('email, visa_points').or(orFilter);

                                                if (profileData) {
                                                    const emailPoints: Record<string, number> = {};
                                                    profileData.forEach((p: any) => {
                                                        if (p.email) emailPoints[p.email.toLowerCase()] = p.visa_points;
                                                    });

                                                    Object.entries(idEmailMap).forEach(([uid, email]) => {
                                                        const lower = email.toLowerCase();
                                                        if (emailPoints[lower] !== undefined) {
                                                            initialStartScores[uid] = emailPoints[lower];
                                                        }
                                                    });
                                                }
                                            }
                                        }
                                        console.log('[CLUBS MASTER] Captured Start Scores:', initialStartScores);
                                        // -----------------------------------------------------

                                        const { error } = await supabase
                                            .from('clubs_game_status')
                                            .update({
                                                system_start: true,
                                                gameState: 'briefing',  // Start with briefing for Round 1
                                                current_round: 1,
                                                phase_expiry: expiry.toISOString(),
                                                round_data: {
                                                    decks: { active: activeDeck, reserve: reserveDeck },
                                                    // Clear previous selections if any
                                                    player_selection: null,
                                                    master_selection: null
                                                },
                                                // Reset scores and removed cards on fresh start
                                                player_score: 0,
                                                master_score: 0,
                                                removed_cards_p: [],
                                                removed_cards_m: [],
                                                scores: { current: {}, history: {}, start: initialStartScores, high_player: { score: 0, uid: '-' }, high_master: { score: 0, uid: '-' } }
                                            })
                                            .eq('id', 'clubs_king');

                                        if (error) {
                                            console.error('Failed to start game:', error);
                                            alert('FAILED TO START GAME: ' + error.message);
                                        } else {
                                            console.log('✓ Game started successfully with NEW DECK');
                                            console.log('✓ Scores reset to 0');
                                            console.log('✓ Vote maps cleared');
                                            setGameState('setup_phase1');
                                            setRound(1);
                                            setPhaseExpiry(expiry);
                                            setCards(activeDeck);
                                            setPlayerScore(0);
                                            setMasterScore(0);
                                            // Clear local vote state to prevent stale triggers
                                            setPlayersVotes({});
                                            setMasterVotes({});
                                            setPhase1Selections({}); // Clear for fresh start
                                            playersVotesRef.current = {};
                                            masterVotesRef.current = {};
                                        }
                                    } catch (err: any) {
                                        console.error('START GAME ERROR:', err);
                                        alert('ERROR: ' + err.message);
                                    }
                                }}
                                className="px-8 py-3 bg-green-600 hover:bg-green-500 text-white font-bold uppercase tracking-widest text-sm rounded-lg transition-all"
                            >
                                ▶ START GAME
                            </button>
                        )}
                    </div>

                    {/* CARDS GRID */}
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-4 max-w-6xl mx-auto">
                        {cards.map((card) => {
                            if (card.isRemoved) return <div key={card.id} className="aspect-[2/3] opacity-0 pointer-events-none" />;

                            const isMyAngel = mySelection.angel === card.id;
                            const isMyDemon = mySelection.demon === card.id;
                            const isPlayerAngel = playerSelection.angel === card.id;
                            const isPlayerDemon = playerSelection.demon === card.id;
                            const myId = user?.uid || user?.id || 'MASTER';
                            const myVotes = masterVotes[myId] || [];
                            const isVoted = gameState === 'playing' && myVotes.includes(card.id);

                            let borderColor = 'border-white/10 opacity-60 hover:opacity-100';
                            let glow = '';

                            // Dim others during reveal
                            if (gameState === 'selection_reveal') {
                                if (!isMyAngel && !isMyDemon) borderColor = 'border-white/5 opacity-20';
                            }

                            // Big 4 Dimming (Card Reveal)
                            if (gameState === 'card_reveal') {
                                borderColor = 'border-white/5 opacity-10'; // Dim everything by default, overrides below
                            }

                            if (isMyAngel) { borderColor = 'border-yellow-500 opacity-100'; glow = 'shadow-[0_0_30px_rgba(234,179,8,0.3)]'; }
                            else if (isMyDemon) { borderColor = 'border-red-500 opacity-100'; glow = 'shadow-[0_0_30px_rgba(220,38,38,0.3)]'; }
                            else if (isVoted) { borderColor = 'border-green-500 opacity-100'; glow = 'shadow-[0_0_30px_rgba(34,197,94,0.3)]'; }

                            // PLAYER REVEAL HIGHLIGHTS (In Master View) - MOVED TO CARD REVEAL AND ROUND RESULTS
                            if (gameState === 'card_reveal' || gameState === 'round_reveal') {
                                if (isPlayerAngel) { borderColor = 'border-blue-500 opacity-100'; glow = 'shadow-[0_0_30px_rgba(59,130,246,0.6)]'; }
                                else if (isPlayerDemon) { borderColor = 'border-purple-600 opacity-100'; glow = 'shadow-[0_0_30px_rgba(147,51,234,0.6)]'; }
                            }

                            return (
                                <div
                                    key={card.id}
                                    onClick={() => handleCardClick(card.id)}
                                    className={`relative aspect-[2/3] bg-[#0A0A0F] rounded-xl border-2 transition-all duration-300 cursor-pointer overflow-hidden group ${borderColor} ${glow}`}
                                >
                                    <img
                                        src={`/borderland_cards/${card.suit.charAt(0).toUpperCase() + card.suit.slice(1)}_${card.rank}.png`}
                                        className="absolute inset-0 w-full h-full object-cover rounded-xl"
                                        alt={`${card.rank} of ${card.suit}`}
                                    />

                                    {isMyAngel && <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] bg-yellow-500 text-black font-black px-3 py-1 rounded-full uppercase tracking-widest z-20 whitespace-nowrap shadow-[0_0_15px_rgba(234,179,8,0.5)] border border-yellow-400">MY ANGEL</div>}
                                    {isMyDemon && <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] bg-red-600 text-white font-black px-3 py-1 rounded-full uppercase tracking-widest z-20 whitespace-nowrap shadow-[0_0_15px_rgba(220,38,38,0.5)] border border-red-500">MY DEMON</div>}



                                    {isVoted && <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[10px] bg-green-500 text-black font-black px-3 py-1 rounded-full uppercase tracking-widest z-20 whitespace-nowrap shadow-[0_0_15px_rgba(34,197,94,0.5)] border border-green-400">VOTED</div>}

                                    {gameState === 'playing' && (
                                        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end z-20">
                                            {/* Master Self Count (Green) */}
                                            {isVoted && (
                                                <div className="px-1.5 py-0.5 rounded bg-green-500 text-black font-bold text-[8px] shadow-lg border border-white/20 min-w-[16px] text-center">
                                                    1
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Phase 1 Master Self Counters */}
                                    {(gameState === 'setup' || gameState === 'setup_phase1') && (
                                        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end z-20">
                                            {/* Master Angel Count */}
                                            {isMyAngel && (
                                                <div className="px-1.5 py-0.5 rounded bg-yellow-500 text-black font-bold text-[8px] shadow-lg border border-white/20 min-w-[16px] text-center">
                                                    A:1
                                                </div>
                                            )}
                                            {/* Master Demon Count */}
                                            {isMyDemon && (
                                                <div className="px-1.5 py-0.5 rounded bg-red-600 text-white font-bold text-[8px] shadow-lg border border-white/20 min-w-[16px] text-center">
                                                    D:1
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

            {/* CARD REVEAL: SHOW ANGEL & DEMON */}
            <AnimatePresence>
                {gameState === 'card_reveal' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="fixed inset-0 bg-black flex flex-col items-center justify-start lg:justify-center z-[300] overflow-y-auto p-4 pt-32 sm:pt-12 lg:pt-0">
                        {/* Card Display Section */}
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-16 lg:gap-20 max-w-full scale-[0.65] sm:scale-85 lg:scale-90 origin-top sm:origin-center lg:origin-center pb-24 lg:pb-0 mt-8 sm:mt-0">
                            {/* Master's Selected Cards */}
                            <div className="space-y-8 sm:space-y-6 flex flex-col items-center">
                                <h3 className="text-xl sm:text-xl font-mono font-bold uppercase tracking-[0.5em] text-center text-yellow-500/90 drop-shadow-[0_0_10px_rgba(234,179,8,0.3)]">MASTER</h3>
                                <div className="flex gap-4 sm:gap-4 justify-center">
                                    {/* MASTER ANGEL */}
                                    {(() => {
                                        const card = cards.find(c => c.id === mySelection.angel);
                                        if (!card) return null;
                                        return (
                                            <div className="relative w-32 sm:w-40 aspect-[2/3] rounded-xl border-2 sm:border-4 border-yellow-500 shadow-[0_0_40px_rgba(234,179,8,0.4)]">
                                                <img src={`/borderland_cards/${card.suit.charAt(0).toUpperCase() + card.suit.slice(1)}_${card.rank}.png`} className="w-full h-full object-cover rounded-lg" />
                                                <div className="absolute -bottom-3 sm:-bottom-4 left-1/2 -translate-x-1/2 bg-yellow-500 text-black px-3 sm:px-4 py-1 font-black text-[10px] sm:text-xs uppercase tracking-widest rounded-full whitespace-nowrap shadow-xl">MY ANGEL</div>
                                            </div>
                                        );
                                    })()}
                                    {/* MASTER DEMON */}
                                    {(() => {
                                        const card = cards.find(c => c.id === mySelection.demon);
                                        if (!card) return null;
                                        return (
                                            <div className="relative w-32 sm:w-40 aspect-[2/3] rounded-xl border-2 sm:border-4 border-red-600 shadow-[0_0_40px_rgba(220,38,38,0.4)]">
                                                <img src={`/borderland_cards/${card.suit.charAt(0).toUpperCase() + card.suit.slice(1)}_${card.rank}.png`} className="w-full h-full object-cover rounded-lg" />
                                                <div className="absolute -bottom-3 sm:-bottom-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-3 sm:px-4 py-1 font-black text-[10px] sm:text-xs uppercase tracking-widest rounded-full whitespace-nowrap shadow-xl">MY DEMON</div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* VS SEPARATOR */}
                            <div className="hidden sm:block h-64 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent" />
                            <div className="sm:hidden w-64 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-12" />

                            {/* PLAYER SIDE */}
                            <div className="flex flex-col items-center gap-8 sm:gap-6">
                                <h3 className="text-xl sm:text-xl font-bold font-mono tracking-[0.5em] border-b border-blue-500/20 pb-3 text-blue-500/70 uppercase">PLAYERS</h3>
                                <div className="flex gap-2 sm:gap-6 justify-center">
                                    {/* PLAYER ANGEL */}
                                    {(() => {
                                        const card = cards.find(c => c.id === playerSelection.angel);
                                        if (!card) return null;
                                        return (
                                            <div className="relative w-28 sm:w-40 aspect-[2/3] rounded-xl border-2 sm:border-4 border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.4)]">
                                                <img src={`/borderland_cards/${card.suit.charAt(0).toUpperCase() + card.suit.slice(1)}_${card.rank}.png`} className="w-full h-full object-cover rounded-lg" />
                                                <div className="absolute -bottom-3 sm:-bottom-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-2 sm:px-4 py-0.5 sm:py-1 font-black text-[10px] sm:text-xs uppercase tracking-widest rounded-full whitespace-nowrap">PLAYER ANGEL</div>
                                            </div>
                                        );
                                    })()}
                                    {/* PLAYER DEMON */}
                                    {(() => {
                                        const card = cards.find(c => c.id === playerSelection.demon);
                                        if (!card) return null;
                                        return (
                                            <div className="relative w-28 sm:w-40 aspect-[2/3] rounded-xl border-2 sm:border-4 border-purple-600 shadow-[0_0_30px_rgba(147,51,234,0.4)]">
                                                <img src={`/borderland_cards/${card.suit.charAt(0).toUpperCase() + card.suit.slice(1)}_${card.rank}.png`} className="w-full h-full object-cover rounded-lg" />
                                                <div className="absolute -bottom-3 sm:-bottom-4 left-1/2 -translate-x-1/2 bg-purple-600 text-white px-2 sm:px-4 py-0.5 sm:py-1 font-black text-[10px] sm:text-xs uppercase tracking-widest rounded-full whitespace-nowrap">PLAYER DEMON</div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>

                        <div className="absolute bottom-12 text-center text-white/40 font-mono animate-pulse">
                            CALCULATING ROUND OUTCOME...
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

                {/* SIDEBAR (Bottom on mobile, Right on desktop) */}
                <div className="w-full sm:w-80 h-[30vh] sm:h-full border-t sm:border-t-0 sm:border-l border-white/10 flex flex-col bg-[#0A0A0E]">
                    {/* Chat */}
                    <div className="flex-1 flex flex-col min-h-0 bg-[#0A0A0E] border-b border-white/5">
                        <div className="p-3 border-b border-white/10 bg-[#0F0F13]">
                            <h3 className="text-[10px] font-black tracking-[0.2em] text-white/50 uppercase">PLAYER COMMS INTERCEPT</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-black scrollbar-track-transparent">
                            {messages.length === 0 && (
                                <div className="text-center mt-10 opacity-30">
                                    <p className="text-xs uppercase tracking-widest font-mono">Channel Silent...</p>
                                </div>
                            )}
                            {messages.map((msg) => (
                                <div key={msg.id} className="relative group">
                                    <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-white/20 group-hover:bg-cyan-500/50 transition-colors" />
                                    <div className="pl-3 py-1">
                                        <p className="text-[10px] font-black text-white/40 mb-1">
                                            {msg.user_id === user?.id ? '#MASTER' : (msg.user_name || playerIdMap[msg.user_id] || (msg.user_id || 'SYS').slice(0, 8)).toUpperCase()}
                                        </p>
                                        <p className="text-xs text-white/80 font-mono leading-relaxed">{msg.content || msg.text}</p>
                                    </div>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                    </div>

                    {/* Chat Input */}
                    <form onSubmit={sendMessage} className="p-3 border-t border-white/10 bg-[#0F0F13]">
                        <div className="relative">
                            <input
                                type="text"
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                placeholder="Transmission..."
                                className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-xs font-mono text-cyan-500 placeholder:text-white/20 focus:outline-none focus:border-cyan-500/50 uppercase tracking-widest"
                            />
                            <button type="submit" className="hidden" />
                        </div>
                    </form>

                    {/* Status Footer */}
                    <div className="p-4 border-t border-white/10 bg-black/40">
                        <div className="flex flex-col gap-2">
                            <div className="text-[10px] uppercase tracking-widest text-white/30">SYSTEM STATUS</div>
                            <div className="text-xs font-mono text-cyan-500/80">
                                ROUND {round} ARCHITECTURE SYNC COMPLETE.
                            </div>
                            <div className="text-xs font-mono text-white/40">
                                AUTO-SEQUENCE INITIATED.
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* POINTS TABLE MODAL */}
            <ClubsPointsTable
                isOpen={showPointsTable}
                onClose={() => setShowPointsTable(false)}
                currentRound={round}
            />

            {/* GAME OVER OVERLAY */}
            {
                gameState === 'won' && (
                    <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[200] flex items-center justify-center">
                        <div className="max-w-4xl w-full mx-4 text-center space-y-8">
                            {/* Determine Winner */}
                            {(() => {
                                const playerWins = topPlayerScore > topMasterScore;
                                const masterWins = topMasterScore > topPlayerScore;

                                return (
                                    <>
                                        {/* Victory/Defeat Banner */}
                                        <div className="space-y-4">
                                            <h1 className={`text-7xl font-cinzel font-black uppercase tracking-widest ${playerWins ? 'text-green-500' : masterWins ? 'text-red-500' : 'text-white'}`}>
                                                {playerWins ? 'PLAYERS PREVAILED' : masterWins ? 'MASTERS TRIUMPH' : 'PERFECT EQUILIBRIUM'}
                                            </h1>
                                            <div className={`h-1 w-96 mx-auto bg-gradient-to-r ${playerWins ? 'from-transparent via-green-500 to-transparent' : masterWins ? 'from-transparent via-red-500 to-transparent' : 'from-transparent via-white to-transparent'} opacity-70`} />
                                            <p className="text-lg font-mono text-white/60 uppercase tracking-wider">
                                                {playerWins ? 'Collective intelligence triumphed. The Borderland acknowledges their skill.' :
                                                    masterWins ? 'The Masters\' deception proved superior. Players failed the trial.' :
                                                        'Both sides demonstrated equal mastery. A rare occurrence.'}
                                            </p>
                                        </div>

                                        {/* Score Display - STACKED ON MOBILE TO PREVENT OVERLAP */}
                                        <div className="flex flex-col sm:grid sm:grid-cols-3 gap-3 sm:gap-6 w-full max-w-4xl px-4 sm:px-0">
                                            {/* Top Player */}
                                            <div className={`p-4 sm:p-8 rounded-xl border-2 ${playerWins ? 'border-green-500 bg-green-500/10 shadow-[0_0_30px_rgba(34,197,94,0.3)]' : 'border-white/20 bg-white/5'}`}>
                                                <p className="text-[10px] sm:text-xs text-white/40 uppercase tracking-widest mb-1 sm:mb-3 font-mono">TOP PLAYER</p>
                                                <p className="text-[10px] sm:text-sm font-mono text-yellow-500 mb-0.5 sm:mb-2 truncate">
                                                    {topPlayerId ? (playerIdMap[topPlayerId] || topPlayerId.slice(0, 8) + '...') : '--'}
                                                </p>
                                                <p className="text-3xl sm:text-6xl font-black font-mono text-white leading-none">{topPlayerScore}</p>
                                                {playerWins && <p className="mt-2 sm:mt-3 text-[9px] sm:text-xs text-green-500 uppercase tracking-wider font-bold">★ VICTOR ★</p>}
                                            </div>

                                            {/* My Score (Master) */}
                                            <div className="p-4 sm:p-8 rounded-xl border-2 border-blue-500 bg-blue-500/10">
                                                <p className="text-[10px] sm:text-xs text-white/40 uppercase tracking-widest mb-1 sm:mb-3 font-mono">MY SCORE</p>
                                                <p className="text-[10px] sm:text-sm font-mono text-blue-400 mb-0.5 sm:mb-2">
                                                    MASTER (YOU)
                                                </p>
                                                <p className="text-3xl sm:text-6xl font-black font-mono text-white leading-none">{myScore}</p>
                                                <p className="mt-2 sm:mt-3 text-[9px] sm:text-xs text-blue-400 uppercase tracking-wider">YOUR PERFORMANCE</p>
                                            </div>

                                            {/* Top Master */}
                                            <div className={`p-4 sm:p-8 rounded-xl border-2 ${masterWins ? 'border-red-500 bg-red-500/10 shadow-[0_0_30px_rgba(239,68,68,0.3)]' : 'border-white/20 bg-white/5'}`}>
                                                <p className="text-[10px] sm:text-xs text-white/40 uppercase tracking-widest mb-1 sm:mb-3 font-mono">TOP MASTER</p>
                                                <p className="text-[10px] sm:text-sm font-mono text-red-500 mb-0.5 sm:mb-2">
                                                    {(topMasterScore > 0 && topMasterScore === myScore) ? 'YOU' : '[IDENTITY CONCEALED]'}
                                                </p>
                                                <p className="text-3xl sm:text-6xl font-black font-mono text-white leading-none">{topMasterScore}</p>
                                                {masterWins && <p className="mt-2 sm:mt-3 text-[9px] sm:text-xs text-red-500 uppercase tracking-wider font-bold">★ VICTOR ★</p>}
                                            </div>
                                        </div>

                                        {/* Game Stats */}
                                        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                                            <p className="text-xs text-white/30 uppercase tracking-widest mb-4 font-mono">TRIAL COMPLETE</p>
                                            <div className="grid grid-cols-3 gap-4 text-center">
                                                <div>
                                                    <p className="text-2xl font-mono font-bold text-white">6/6</p>
                                                    <p className="text-[10px] text-white/40 uppercase tracking-wider">ROUNDS</p>
                                                </div>
                                                <div>
                                                    <p className="text-2xl font-mono font-bold text-green-500">♣ KING</p>
                                                    <p className="text-[10px] text-white/40 uppercase tracking-wider">DIFFICULTY</p>
                                                </div>
                                                <div>
                                                    <p className="text-2xl font-mono font-bold text-white">{playerWins ? '+' : masterWins ? '-' : '±'}{Math.abs(topPlayerScore - topMasterScore)}</p>
                                                    <p className="text-[10px] text-white/40 uppercase tracking-wider">MARGIN</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Return Button */}
                                        <button
                                            onClick={() => { if (!isEngine) window.location.href = '/home/card'; }}
                                            className="px-16 py-5 bg-white/10 hover:bg-white/20 border-2 border-white/30 hover:border-white/50 text-white font-black uppercase tracking-widest text-base rounded-lg transition-all duration-300 hover:scale-105 font-mono shadow-lg"
                                        >
                                            RETURN TO LOBBY
                                        </button>

                                        <p className="text-xs text-white/20 font-mono uppercase tracking-widest">
                                            GAME ID: CLUBS_KING • ROUND: 6/6
                                        </p>
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                )
            }

            {/* RESET OVERRIDE OVERLAY */}
            {
                showResetOverlay && (
                    <div className="fixed inset-0 bg-black/98 backdrop-blur-lg z-[2000] flex items-center justify-center animate-in fade-in duration-300">
                        <div className="text-center space-y-6 max-w-md px-8">
                            {/* Warning Icon */}
                            <div className="mx-auto w-24 h-24 rounded-full border-4 border-red-500 flex items-center justify-center animate-pulse">
                                <svg className="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>

                            {/* Title */}
                            <div className="space-y-2">
                                <h1 className="text-4xl font-cinzel font-bold text-red-500 uppercase tracking-widest">
                                    SYSTEM OVERRIDE
                                </h1>
                                <div className="h-px w-48 mx-auto bg-gradient-to-r from-transparent via-red-500 to-transparent" />
                            </div>

                            {/* Message */}
                            <div className="space-y-3">
                                <p className="text-xl font-bold text-white uppercase tracking-wider">
                                    PROTOCOL TERMINATED
                                </p>
                                <p className="text-sm text-white/60 font-mono">
                                    Game Master Reset Initiated
                                </p>
                                <p className="text-xs text-white/40 font-mono">
                                    Awaiting confirmation
                                </p>
                            </div>

                            {/* Button */}
                            <div className="pt-4">
                                <button
                                    onClick={() => { if (!isEngine) window.location.href = '/home/card'; }}
                                    className="px-8 py-3 bg-red-500/10 border border-red-500 hover:bg-red-500 hover:text-black text-red-500 font-bold font-mono tracking-widest transition-all uppercase"
                                >
                                    RETURN TO LOBBY
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* DEBUG OVERLAY */}
            <div className="fixed bottom-0 right-0 p-2 bg-black/80 text-[8px] font-mono text-green-500 pointer-events-none z-[9999]">
                <p>STATE: {gameState}</p>
                <p>ROUND: {round}</p>
                <p>EXPIRY: {phaseExpiry?.toISOString() || 'NULL'}</p>
                <p>TIMELEFT: {timeLeft}</p>
            </div>
        </div >
    );
};
