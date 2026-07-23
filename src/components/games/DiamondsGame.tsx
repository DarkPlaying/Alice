import React, { useState, useEffect, useRef } from 'react';
import { supabase, supabaseUrl, supabaseKey, getAccessToken } from '../../supabaseClient';
import type { DiamondsGameState, DiamondsPlayer, DiamondsCard, DiamondsPhase } from '../../game/diamonds';
import { getCardImagePath } from '../../game/diamonds';
import { generateDiamondsDeck } from '../../game/diamonds/actions/dealing';
import { dealHands } from '../../game/diamonds/actions/dealing';
import { Swords, Skull, Timer, CheckCircle2, AlertTriangle, X, Activity, Scan, Info, HelpCircle, Shield, Syringe, Biohazard, User, ChevronRight, Check, Gem, Crown, FastForward } from 'lucide-react';


import { motion, AnimatePresence } from 'framer-motion';
import { PlayerCardModal } from '../PlayerCardModal';
import { DemoDiamondsGame } from './DemoDiamondsGame';

const GAME_ID = 'diamonds_king';

export const DiamondsGame: React.FC<{ user: any; onClose?: () => void }> = ({ user, onClose }) => {
    if (user?.role === 'demo') {
        return <DemoDiamondsGame user={user} onClose={onClose} />;
    }

    const [gameState, setGameState] = useState<DiamondsGameState | null>(null);
    const [myHand, setMyHand] = useState<DiamondsCard[]>([]);
    const [mySlots, setMySlots] = useState<(DiamondsCard | null)[]>([null, null, null, null, null]);
    const [myPlayer, setMyPlayer] = useState<DiamondsPlayer | null>(null);
    const [showPlayerCard, setShowPlayerCard] = useState(false);
    const [isProhibited, setIsProhibited] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [timeLeft, setTimeLeft] = useState(0); // Client-side countdown
    const [showResetOverlay, setShowResetOverlay] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [hasPicked, setHasPicked] = useState(false);
    const [showRulesModal, setShowRulesModal] = useState(false);
    const [opponentSlots, setOpponentSlots] = useState<{ playerId: string, username: string, slots: DiamondsCard[] }[]>([]);
    const [playerIdMap, setPlayerIdMap] = useState<Record<string, string>>({});
    const [selectedSteal, setSelectedSteal] = useState<{ targetId: string, card: DiamondsCard } | null>(null);
    const [skipVideos, setSkipVideos] = useState(() => typeof window !== 'undefined' && localStorage.getItem('skipVideos') === 'true');
    const [opponentHandCounts, setOpponentHandCounts] = useState<Record<string, number>>({});
    const [detectorActive, setDetectorActive] = useState(false);
    const [hasPlayedEndVideo, setHasPlayedEndVideo] = useState(false);

    const [pointsPage, setPointsPage] = useState(0);
    const [isScrolled, setIsScrolled] = useState(false);

    const [powerUsage, setPowerUsage] = useState({
        hasUsedRefresh: typeof window !== 'undefined' && localStorage.getItem(`diamonds_refresh_used_${user?.id}`) === 'true',
        hasUsedDetector: typeof window !== 'undefined' && localStorage.getItem(`diamonds_detector_used_${user?.id}`) === 'true',
        hasUsedFiveSlots: false
    });
    const [protocolToasts, setProtocolToasts] = useState<{ id: string, message: string, type: 'info' | 'error' | 'success' }[]>([]);
    const [alertModal, setAlertModal] = useState<{ title: string; message: string } | null>(null);

    const triggerAlert = (title: string, message: string) => {
        setAlertModal({ title, message });
    };

    const addToast = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
        const id = Math.random().toString(36).substring(2, 9);
        setProtocolToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setProtocolToasts(prev => prev.filter(t => t.id !== id)), 4000);
    };

    // Drag and Drop refs
    const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
    const handScrollerRef = useRef<HTMLDivElement | null>(null);

    // Refs
    const gameStateRef = useRef<DiamondsGameState | null>(null);
    const isProcessingRef = useRef(false);
    const roundRef = useRef(0); // This is the local UI ref for slot reset
    const systemStartRef = useRef<boolean | null>(null);

    // Sync Ref for transition logic
    useEffect(() => {
        gameStateRef.current = gameState;
    }, [gameState]);

    // End Game Video Logic
    useEffect(() => {
        if (gameState?.phase === 'end' && !hasPlayedEndVideo) {
            window.dispatchEvent(new CustomEvent('play-end-video'));
            setHasPlayedEndVideo(true);
        }
    }, [gameState?.phase, hasPlayedEndVideo]);

    // Wheel-to-Scroll Logic for Deployment Hand
    useEffect(() => {
        const scroller = handScrollerRef.current;
        if (!scroller) return;

        const handleWheel = (e: WheelEvent) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                scroller.scrollLeft += e.deltaY;
            }
        };

        scroller.addEventListener('wheel', handleWheel, { passive: false });
        return () => scroller.removeEventListener('wheel', handleWheel);
    }, [gameState?.phase]);

    // Reset Detector Power UI between rounds
    useEffect(() => {
        if (gameState?.current_round) {
            setDetectorActive(false);
            setOpponentHandCounts({});
        }
    }, [gameState?.current_round]);

    const isMaster = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'master' || user?.username?.toLowerCase() === 'admin' || user?.username?.toLowerCase() === 'sanjay';
    const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.username?.toLowerCase() === 'admin' || user?.username?.toLowerCase() === 'sanjay';
    const isMasterRole = user?.role?.toLowerCase() === 'master';

    // Log roles once
    useEffect(() => {
        if (user) {
            console.log(`[DIAMONDS_ENGINE] User Context:`, {
                username: user.username,
                role: user.role,
                isAdmin,
                isMaster,
                isMasterRole
            });
        }
    }, [user, isAdmin, isMaster, isMasterRole]);

    // Debug tracking for assets
    useEffect(() => {
        const available = myHand.filter(c => !mySlots.some(s => s?.id === c.id));
        console.log(`[DIAMONDS_DEBUG] Phase: ${gameState?.phase}, Total: ${myHand.length}, Available: ${available.length}`);
    }, [gameState?.phase, myHand, mySlots]);

    // Fetch Player ID Mapping from Supabase (Consistent Anonymity)
    useEffect(() => {
        const fetchPlayerIds = async () => {
            try {
                const { data, error } = await supabase.from('profiles').select('*');
                if (error) throw error;
                const usersList = data || [];

                usersList.sort((a: any, b: any) => {
                    const isMasterA = a.role === 'master' || a.role === 'admin' || a.username === 'admin';
                    const isMasterB = b.role === 'master' || b.role === 'admin' || b.username === 'admin';
                    if (isMasterA && !isMasterB) return -1;
                    if (!isMasterA && isMasterB) return 1;
                    const timeA = new Date(a.created_at || 0).getTime();
                    const timeB = new Date(b.created_at || 0).getTime();
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
                console.error('Error fetching player IDs (Supabase):', error);
            }
        };
        fetchPlayerIds();
    }, []);

    // Engine Tracking
    const phaseRef = useRef<DiamondsPhase>('idle');
    const phaseStartedAtRef = useRef<string | null>(null);
    const phaseDurationRef = useRef(0);

    // Sync Refs for logic consistency
    useEffect(() => {
        if (gameState) {
            phaseRef.current = gameState.phase;
            phaseStartedAtRef.current = gameState.phase_started_at || null;
            phaseDurationRef.current = gameState.phase_duration_sec || 0;
        }
    }, [gameState]);

    useEffect(() => {
        if (isMasterRole) {
            setIsProhibited(true);
        }
    }, [isMasterRole]);

    // Distributed Heartbeat Keeper: If paused, the engine needs to "slide" the start time forward
    // to preserve the remaining time. Only one client does this.
    useEffect(() => {
        if (!gameState?.is_paused || isProcessingRef.current) return;

        const keepAlivePause = async () => {
            // Election: only one browser updates to move the start time forward by 2s
            const now = new Date().toISOString();
            const nextStart = new Date(new Date(gameState.phase_started_at!).getTime() + 2000).toISOString();

            const { count } = await supabase.from('diamonds_game_state')
                .update({ phase_started_at: nextStart, updated_at: now }, { count: 'exact' })
                .eq('id', GAME_ID)
                .eq('is_paused', true)
                .eq('phase_started_at', gameState.phase_started_at);

            if (count && count > 0) {
                console.log("[DIAMONDS_ENGINE] Pause Keeper: Sliding start time forward to freeze timer.");
            }
        };

        const interval = setInterval(keepAlivePause, 2000);
        return () => clearInterval(interval);
    }, [gameState?.is_paused, gameState?.phase_started_at]);

    const PHASE_TIMINGS: Record<DiamondsPhase, number> = {
        idle: 0,
        briefing: 10,
        shuffle: 5,
        dealing: 5,
        slotting: 80,
        evaluation: 10,
        picking: 10,
        scoring: 30,
        end: 0
    };
    const MAX_ROUNDS = 5;





    // [DIAMONDS_ENGINE] transitionTo and handlePhaseTimeout logic has been moved to DiamondsGameMaster.tsx

    // Timer Sync Effect
    useEffect(() => {
        const syncTimer = () => {
            if (!gameState?.phase_started_at) return;

            // PAUSE LOGIC: Freeze UI timer if game is paused
            if (gameState.is_paused) {
                if (gameState.phase_duration_sec !== undefined) setTimeLeft(gameState.phase_duration_sec);
                return;
            }

            let dStr = gameState.phase_started_at.replace(' ', 'T');
            if (dStr.match(/[+-]\d{2}$/)) dStr += ':00';
            if (!dStr.endsWith('Z') && !dStr.match(/[+-]\d{2}:?\d{2}$/)) dStr += 'Z';
            const start = new Date(dStr).getTime();
            const duration = gameState.phase_duration_sec || 0;
            const now = Date.now();
            const elapsed = Math.floor((now - start) / 1000);
            const remaining = Math.max(0, duration - elapsed);
            setTimeLeft(remaining);

            // Timer reaches 0. Waiting for GameMaster to transition.
            if (remaining <= 0) {
                if (!isProcessingRef.current) {
                    console.log('[DIAMONDS_ENGINE] Timer at 0s. Waiting for GameMaster to transition...');
                }
            }
        };

        syncTimer(); // Immediate sync
        const interval = setInterval(syncTimer, 100);
        return () => clearInterval(interval);
    }, [gameState?.phase_started_at, gameState?.phase_duration_sec, gameState?.phase, gameState?.is_paused, user, gameState?.current_round, isMaster]);

    const findMyParticipant = (participants: any[], userObj: any) => {
        if (!userObj || !participants || participants.length === 0) return null;
        const uid = userObj.id ? String(userObj.id).toLowerCase() : '';
        const uname = userObj.username ? String(userObj.username).toLowerCase() : '';

        const exact = participants.find((p: any) => {
            const pid = p.id ? String(p.id).toLowerCase() : '';
            const puname = p.username ? String(p.username).toLowerCase() : '';
            if (uid && pid && pid === uid) return true;
            if (uname && puname && puname === uname) return true;
            return false;
        });
        if (exact) return exact;

        const soft = participants.find((p: any) => {
            const pid = p.id ? String(p.id).toLowerCase() : '';
            const puname = p.username ? String(p.username).toLowerCase() : '';
            if (uid && pid && (pid.includes(uid) || uid.includes(pid))) return true;
            if (uname && puname && (puname.includes(uname) || uname.includes(puname))) return true;
            return false;
        });

        return soft || null;
    };

    // Supabase Realtime Sync (Centralized Source of Truth)
    useEffect(() => {
        if (!user) return;

        const handleUpdate = (data: any) => {
            if (!data) return;

            // Prevent reverting to an older state due to read replica lag
            if (data.phase_started_at && phaseStartedAtRef.current) {
                let dStr = data.phase_started_at.replace(' ', 'T');
                if (dStr.match(/[+-]\d{2}$/)) dStr += ':00';
                if (!dStr.endsWith('Z') && !dStr.match(/[+-]\d{2}:?\d{2}$/)) dStr += 'Z';
                const fetchedStart = new Date(dStr);
                const currentStart = new Date(phaseStartedAtRef.current);
                if (fetchedStart.getTime() < currentStart.getTime()) {
                    return; // Ignore stale data
                }
            }

            console.log("[DIAMONDS_PLAYER] Game State Received:", data.phase, data.current_round);
            if (gameState?.phase !== data.phase) {
                if (['evaluation', 'picking', 'scoring'].includes(data.phase)) {
                    fetchMySlots(data);
                }
            }
            setGameState(data);
            setIsLoading(false);

            if (data.system_start === false && systemStartRef.current === true) {
                setShowResetOverlay(true);
                setTimeout(() => {
                    if (onClose) onClose();
                }, 2500);
            }
            systemStartRef.current = data.system_start;

            const participants = data.participants || [];
            const me = findMyParticipant(participants, user);

            if (me) {
                const meAny = me as any;
                const realPoints = user?.visa_points ?? user?.points ?? user?.visaDays ?? meAny.visa_points ?? meAny.points ?? meAny.visaDays;
                if (realPoints !== undefined && realPoints !== null && realPoints > 0) {
                    if (me.score === undefined || me.score === 1000 || me.score === 0) {
                        me.score = realPoints;
                    }
                } else if (me.score === undefined || me.score === 0) {
                    me.score = 1000;
                }
                setMyPlayer(me);
                fetchMyHand(me);
                const isActivelySlotting = data.phase === 'slotting' && !isLocked;
                if (!isActivelySlotting) {
                    fetchMySlots(data, me);
                }
            }

            // 2s POLLING FALLBACK Sync often happens faster than state updates can reflect in fetchOpponentSlots
            if (data.phase === 'picking') {
                fetchOpponentSlots(data, me);
            }

            if (data.current_round !== roundRef.current || data.phase === 'shuffle') {
                // Reset slots locally
                setMySlots([null, null, null, null, null]);
                setIsLocked(false);
                setHasPicked(false);
                setOpponentSlots([]); // Clear opponent slots on new round
                handAssignedRoundRef.current = -1;
                roundRef.current = data.current_round;
            }

            // CRITICAL: Explicit UI Reset on Idle/Briefing/Reset
            if (data.phase === 'idle' || data.phase === 'briefing' || data.system_start === false) {
                setMySlots([null, null, null, null, null]);
                setIsLocked(false);
                setHasPicked(false);
                setOpponentSlots([]);
                setMyHand([]);
            }

            // Auto-clear slots if we are back in slotting and they are locked from previous round (rare sync edge case)
            if (data.phase === 'slotting' && isLocked && data.current_round !== roundRef.current) {
                console.log("[DIAMONDS_SYNC] Unlocking slots for new round.");
                setIsLocked(false);
                setMySlots([null, null, null, null, null]);
            }
        };

        const fetchInitial = async () => {
            try {
                const accessToken = await getAccessToken();
                const response = await fetch(`${supabaseUrl}/rest/v1/diamonds_game_state?id=eq.${GAME_ID}&select=*`, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'apikey': supabaseKey,
                        'Accept': 'application/vnd.pgrst.object+json'
                    },
                    cache: 'no-store'
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data) {
                        const rawState = Array.isArray(data) ? data[0] : data;
                        handleUpdate(rawState);
                    }
                } else {
                    setIsLoading(false);
                }
            } catch (err) {
                console.error('[DIAMONDS_PLAYER] fetchInitial error:', err);
                setIsLoading(false);
            }
        };

        fetchInitial();
        fetchMyParticipantStatus();

        // 1s POLLING FALLBACK (Resilient Sync like Spades)
        const pollInterval = setInterval(() => {
            if (!document.hidden) {
                fetchInitial();
                fetchMyParticipantStatus();
            }
        }, 1000);

        const channel = supabase
            .channel(`diamonds_state_sync_${GAME_ID}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'diamonds_game_state',
                filter: `id=eq.${GAME_ID}`
            }, (payload) => {
                handleUpdate(payload.new);
            })
            .subscribe();

        const broadcastChannel = supabase.channel('diamonds_king_game')
            .on('broadcast', { event: 'force_exit' }, (payload: any) => {
                console.log('!!! FORCE EXIT DETECTED !!!', payload);
                if (onClose) onClose();
                else window.location.href = '/home/card';
            })
            .subscribe();

        fetchMyHand();
        fetchMySlots();

        return () => {
            supabase.removeChannel(channel);
            supabase.removeChannel(broadcastChannel);
            clearInterval(pollInterval);
        };
    }, [user, onClose]);



    // SAFETY BRIDGE: Prevent "Ghost Cards" in slots
    useEffect(() => {
        if (!myHand || myHand.length === 0) return;
        if (gameState?.phase !== 'slotting') return;

        const staleIndices = mySlots.map((s, i) => {
            if (!s) return -1;
            const existsInHand = myHand.some(h => 
                h.id === s.id || 
                (h.rank === s.rank && h.suit === s.suit && h.specialType === s.specialType)
            );
            return existsInHand ? -1 : i;
        }).filter(idx => idx !== -1);

        if (staleIndices.length > 0) {
            console.warn(`[DIAMONDS_SAFETY] Detected ${staleIndices.length} STALE cards in slots! Clearing...`);
            const nextSlots = [...mySlots];
            staleIndices.forEach(idx => nextSlots[idx] = null);
            setMySlots(nextSlots);
        }
    }, [myHand, gameState?.phase]);

    // Toast notification when Zombie is destroyed/neutralized by Shotgun or Injection
    const notifiedEffectsRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        if (!gameState?.round_data?.effects) return;
        if (!['evaluation', 'scoring', 'picking'].includes(gameState?.phase || '')) return;

        const myId = user?.id;
        const myUname = user?.username?.toLowerCase();
        const effects = gameState.round_data.effects || [];

        effects.forEach((e: any) => {
            const isMine = e.playerId === myId || (myUname && e.playerId?.toLowerCase() === myUname);
            if (!isMine) return;

            const effectKey = `${gameState.current_round}_${e.desc}`;
            if (notifiedEffectsRef.current.has(effectKey)) return;

            if (e.desc?.includes('ZOMBIE DESTROYED IN HAND') || e.desc?.includes('BY SHOTGUN')) {
                notifiedEffectsRef.current.add(effectKey);
                addToast("YOUR ZOMBIE CARD WAS DESTROYED BY AN OPPONENT'S SHOTGUN!", "error");
            } else if (e.desc?.includes('BY INJECTION')) {
                notifiedEffectsRef.current.add(effectKey);
                addToast("YOUR ZOMBIE WAS CURED BY AN OPPONENT'S INJECTION!", "info");
            } else if (e.desc?.includes('SHOTGUN BONUS')) {
                notifiedEffectsRef.current.add(effectKey);
                addToast("SHOTGUN BONUS ACTIVATED! OPPONENT ZOMBIE DESTROYED (+100 CR)", "success");
            }
        });
    }, [gameState?.phase, gameState?.current_round, gameState?.round_data]);

    // Helper: Create a fresh 8-card tactical hand for player fallback (7 standard + 1 special)
    const generateFreshHandForPlayer = (playerId: string): DiamondsCard[] => {
        const suits = ['spades', 'hearts', 'clubs', 'diamonds'];
        const cards: DiamondsCard[] = [];
        const ranks = ['4', '7', '9', '10', 'J', 'Q', 'K', 'A'];
        const values = [4, 7, 9, 10, 11, 12, 13, 14];

        for (let i = 0; i < 7; i++) {
            const rankIdx = i % ranks.length;
            cards.push({
                id: `card_${playerId}_std_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
                type: 'standard',
                rank: ranks[rankIdx],
                suit: suits[i % 4],
                value: values[rankIdx]
            });
        }

        const specials: Array<'zombie' | 'shotgun' | 'injection'> = ['zombie', 'injection', 'shotgun'];
        const chosenSpecial = specials[Math.floor(Math.random() * specials.length)];

        cards.push({
            id: `card_${playerId}_${chosenSpecial}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            type: 'special',
            specialType: chosenSpecial,
            suit: 'special',
            value: 0,
            metadata: { usesRemaining: chosenSpecial === 'zombie' ? 2 : 1 }
        });

        return cards;
    };

    const hasAssignedCardsRef = useRef<Record<number, boolean>>({});

    // ROUND 1 / SLOTTING SAFEGUARD: If player has 0 cards, auto-assign cards again!
    useEffect(() => {
        if (!gameState) return;
        const round = gameState.current_round || 1;

        if (['slotting', 'dealing'].includes(gameState.phase) && (!myHand || myHand.length === 0)) {
            if (hasAssignedCardsRef.current[round]) return; // Eliminate infinite state refresh loop!

            const me = findMyParticipant(gameState.participants || [], user);

            if (me) {
                hasAssignedCardsRef.current[round] = true;
                console.log("[DIAMONDS_SAFEGUARD] Player has 0 cards in slotting/dealing! Auto-assigning fresh cards...");
                const newCards = (me.cards && me.cards.length > 0) ? me.cards : generateFreshHandForPlayer(me.id || user?.id || 'player');
                setMyHand(newCards);
                if (!me.cards || me.cards.length === 0) {
                    syncMyPlayerToState({
                        ...me,
                        cards: newCards
                    });
                }
            }
        }
    }, [gameState?.phase, gameState?.current_round, myHand.length, user?.id, user?.username]);

    const myHandRef = useRef<DiamondsCard[]>([]);
    useEffect(() => {
        myHandRef.current = myHand;
    }, [myHand]);

    const handAssignedRoundRef = useRef<number>(-1);

    const fetchMyParticipantStatus = async () => {
        if (!user) return;

        const participant = findMyParticipant(gameState?.participants || [], user);
        if (participant) {
            setMyPlayer(participant);
        }
    };

    const fetchMyHand = (passedMe?: DiamondsPlayer) => {
        const me = passedMe || myPlayer;
        const currentRound = gameStateRef.current?.current_round || 1;

        if (me) {
            // Keep cards constant once assigned for the round
            if (myHandRef.current && myHandRef.current.length > 0 && handAssignedRoundRef.current === currentRound) {
                return;
            }

            if (me.cards && me.cards.length > 0) {
                setMyHand(me.cards);
                myHandRef.current = me.cards;
                handAssignedRoundRef.current = currentRound;
            } else if (['slotting', 'dealing'].includes(gameStateRef.current?.phase || '')) {
                if (hasAssignedCardsRef.current[currentRound]) return;
                hasAssignedCardsRef.current[currentRound] = true;

                console.log("[DIAMONDS_PLAYER] Participant has 0 cards! Auto-assigning hand...");
                const newCards = generateFreshHandForPlayer(me.id || user?.id || 'player');
                setMyHand(newCards);
                myHandRef.current = newCards;
                handAssignedRoundRef.current = currentRound;
                syncMyPlayerToState({
                    ...me,
                    cards: newCards
                });
            }
        }
    };

    const fetchMySlots = (_passedState?: DiamondsGameState, passedMe?: DiamondsPlayer) => {
        const me = passedMe || myPlayer;
        if (me && me.slots) {
            const newSlots = me.slots || [null, null, null, null, null];
            setMySlots(prev => JSON.stringify(prev) === JSON.stringify(newSlots) ? prev : newSlots);
        }
    };

    const fetchOpponentSlots = async (passedState?: DiamondsGameState, passedMe?: DiamondsPlayer) => {
        const state = passedState || gameState;
        const me = passedMe || myPlayer;

        if (!state || !me?.groupId) {
            console.log("[DIAMONDS_PICKING] Skipping fetch: State/Me missing or no groupId", { state: !!state, me: !!me });
            return;
        }

        // 1. Get all group members except me
        const groupOccupants = (state.participants || []).filter(p =>
            p.groupId === me.groupId &&
            p.id !== user?.id &&
            p.status !== 'eliminated'
        );

        const others = groupOccupants.map(p => {
            return {
                playerId: p.id,
                username: p.username || 'Opponent',
                slots: (p.slots as DiamondsCard[] || []).filter(c => c !== null)
            };
        });

        console.log("[DIAMONDS_PICKING] Using persisted slots for opponents:", others.length, others);
        setOpponentSlots(others);
    };

    const handleStealCard = (targetId: string, card: DiamondsCard) => {
        if (!user || !gameState || hasPicked) return;
        setSelectedSteal({ targetId, card });
    };

    const handlePickingDragEnd = (_: any, info: any, targetId: string, card: DiamondsCard) => {
        if (!user || !gameState || hasPicked) return;
        setSelectedSteal({ targetId, card });

        // If dropped downwards towards confirmation zone, select card
        if (info.offset.y > 30 || info.point.y > window.innerHeight - 350) {
            setSelectedSteal({ targetId, card });
        }
    };

    const executeSteal = async () => {
        if (!selectedSteal || !user || !gameStateRef.current?.participants) return;
        const { targetId, card } = selectedSteal;

        // Instantly mark as picked locally
        setHasPicked(true);

        try {
            const currentParticipants = gameStateRef.current.participants || [];
            const myUname = user?.username?.toLowerCase();

            const newParticipants = currentParticipants.map(p => {
                const isTarget = p.id === targetId || (targetId && p.username?.toLowerCase() === targetId.toLowerCase());
                const isMe = p.id === user.id || (myUname && p.username?.toLowerCase() === myUname);

                if (isTarget) {
                    // Remove stolen card from victim's hand
                    const updatedCards = (p.cards || []).filter(c => c.id !== card.id);
                    return { ...p, cards: updatedCards };
                }

                if (isMe) {
                    // Add stolen card to thief's hand
                    const hasCard = (p.cards || []).some(c => c.id === card.id);
                    const updatedCards = hasCard ? (p.cards || []) : [...(p.cards || []), card];
                    setMyHand(updatedCards);
                    return { ...p, cards: updatedCards };
                }

                return p;
            });

            setGameState(prev => prev ? { ...prev, participants: newParticipants } : null);

            const token = await getAccessToken();
            await fetch(`${supabaseUrl}/rest/v1/diamonds_game_state?id=eq.${GAME_ID}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'apikey': supabaseKey,
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ participants: newParticipants })
            });

            setSelectedSteal(null);
            setOpponentSlots([]);
            console.log(`[DIAMONDS_UI] Extraction Complete: ${card.id} transferred to ${user.username}.`);
        } catch (err) {
            console.error("Extraction failed:", err);
        }
    };


    // Helper: Sync player changes (slots, cards, power usage) to diamonds_game_state via REST API
    const syncMyPlayerToState = async (updatedPlayer: DiamondsPlayer) => {
        if (!user?.id || !gameStateRef.current?.participants) return;

        const currentParticipants = gameStateRef.current.participants || [];
        const newParticipants = currentParticipants.map(p => p.id === updatedPlayer.id ? updatedPlayer : p);

        setGameState(prev => prev ? { ...prev, participants: newParticipants } : null);
        setMyPlayer(updatedPlayer);

        try {
            const token = await getAccessToken();
            await fetch(`${supabaseUrl}/rest/v1/diamonds_game_state?id=eq.${GAME_ID}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'apikey': supabaseKey,
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ participants: newParticipants })
            });
        } catch (e) {
            console.error('[DIAMONDS_PLAYER] Failed to sync player state:', e);
        }
    };

    // --- Interactions ---
    const handleSlotCard = (card: DiamondsCard, slotIndex: number) => {
        if (gameState?.phase !== 'slotting' || isLocked) return;

        // Check Zombie Limit (Max 2 uses per game)
        if (card.specialType === 'zombie') {
            const uses = myPlayer?.zombieUses || 0;
            if (uses >= 2) {
                triggerAlert("ZOMBIE PROTOCOL LIMIT", "CRITICAL: ZOMBIE PROTOCOL LIMIT REACHED (MAX 2 USES PER COMPONENT)");
                return;
            }
        }

        const newSlots = [...mySlots];
        // Remove from existing if present
        const existingSlotIdx = newSlots.findIndex(s => s?.id === card.id);
        if (existingSlotIdx !== -1) newSlots[existingSlotIdx] = null;

        newSlots[slotIndex] = card;

        const projectedSlottedCount = newSlots.filter(s => s !== null).length;
        if (projectedSlottedCount === 5 && (powerUsage.hasUsedFiveSlots || myPlayer?.hasUsedFiveSlots)) {
            triggerAlert("OVERLOAD PRINCIPLE", "Full 5-Slot Deployment can only be used ONCE per game session!");
            return;
        }

        setMySlots(newSlots);

        if (myPlayer) {
            syncMyPlayerToState({
                ...myPlayer,
                slots: newSlots
            });
        }
    };

    const handleUnslotCard = (index: number) => {
        if (gameState?.phase !== 'slotting' || isLocked) return;
        const newSlots = [...mySlots];
        newSlots[index] = null;
        setMySlots(newSlots);

        if (myPlayer) {
            syncMyPlayerToState({
                ...myPlayer,
                slots: newSlots
            });
        }
    };

    const handleDragEnd = (e: any, info: any, card: DiamondsCard) => {
        if (gameState?.phase !== 'slotting' || isLocked) return;

        // Extract pointer coordinates with full event fallback
        const px = info?.point?.x ?? e?.clientX ?? e?.changedTouches?.[0]?.clientX ?? e?.touches?.[0]?.clientX ?? 0;
        const py = info?.point?.y ?? e?.clientY ?? e?.changedTouches?.[0]?.clientY ?? e?.touches?.[0]?.clientY ?? 0;

        let targetSlotIndex = -1;
        const validRefs = (slotRefs.current || []).filter((r): r is HTMLDivElement => r !== null);

        // 1. Direct Hit Check with 40px Horizontal & 60px Vertical Padding
        validRefs.forEach((ref, idx) => {
            const rect = ref.getBoundingClientRect();
            if (
                px >= (rect.left - 40) &&
                px <= (rect.right + 40) &&
                py >= (rect.top - 60) &&
                py <= (rect.bottom + 60)
            ) {
                targetSlotIndex = idx;
            }
        });

        // 2. Distance-Based Match (Radius up to 180px)
        if (targetSlotIndex === -1) {
            let minDistance = Infinity;
            validRefs.forEach((ref, idx) => {
                const rect = ref.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const dist = Math.hypot(px - centerX, py - centerY);
                if (dist < minDistance && dist < 180) {
                    minDistance = dist;
                    targetSlotIndex = idx;
                }
            });
        }

        // 3. Upward Drag Fallback: If dragged upwards towards slot area
        if (targetSlotIndex === -1 && validRefs.length > 0 && validRefs[0]) {
            const firstRect = validRefs[0].getBoundingClientRect();
            const slotAreaBottom = firstRect.bottom + 120;
            const offsetUp = info?.offset?.y && info.offset.y < -20;

            if (py <= slotAreaBottom || offsetUp) {
                let minXDist = Infinity;
                validRefs.forEach((ref, idx) => {
                    if (!ref) return;
                    const rect = ref.getBoundingClientRect();
                    const centerX = rect.left + rect.width / 2;
                    const xDist = Math.abs(px - centerX);
                    if (xDist < minXDist) {
                        minXDist = xDist;
                        targetSlotIndex = idx;
                    }
                });
            }
        }

        if (targetSlotIndex !== -1) {
            handleSlotCard(card, targetSlotIndex);
        }
    };

    const handleConfirmSlots = async () => {
        if (!user?.id || !gameState || isLocked) return;

        const slottedCount = mySlots.filter(s => s !== null).length;
        if (slottedCount === 0) {
            triggerAlert("DEPLOYMENT REQUIREMENT", "MUST DEPLOY AT LEAST 1 ASSET FOR BATTLE");
            return;
        }

        if (slottedCount === 5) {
            if (powerUsage.hasUsedFiveSlots) {
                triggerAlert("OVERLOAD PRINCIPLE", "CRITICAL: FULL ARRAY ALREADY DEPLOYED ONCE. YOU ALREADY USED 5 SLOTTED. REDUCE DEPLOYMENT ARRAY.");
                return;
            }
        }

        console.log("[DIAMONDS_PLAYER] Confirming Slots:", mySlots);
        setIsLocked(true);
        if (slottedCount === 5) {
            setPowerUsage(prev => ({ ...prev, hasUsedFiveSlots: true }));
        }

        if (myPlayer) {
            syncMyPlayerToState({
                ...myPlayer,
                slots: mySlots,
                hasUsedFiveSlots: slottedCount === 5 ? true : myPlayer.hasUsedFiveSlots
            });
        }
    };

    const handleRefreshHand = async () => {
        if (!user || gameState?.phase !== 'slotting' || isLocked) return;
        if (powerUsage.hasUsedRefresh) {
            addToast("PROTOCOL ERROR: REFRESH CAPABILITIES DEPLETED", "error");
            return;
        }

        const standardCards = myHand.filter(c => c.type === 'standard');
        const specialCards = myHand.filter(c => c.type === 'special');

        if (standardCards.length === 0) {
            addToast("PROTOCOL ERROR: AT LEAST ONE NORMAL CARD REQUIRED FOR REFRESH", "error");
            return;
        }

        setIsLoading(true);

        try {
            const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
            const newStandardHand: DiamondsCard[] = [];
            for (let i = 0; i < standardCards.length; i++) {
                const val = Math.floor(Math.random() * 13) + 2;
                const suit = suits[Math.floor(Math.random() * 4)];
                newStandardHand.push({
                    id: `ref_${Date.now()}_${i}`, type: 'standard',
                    rank: val === 11 ? 'J' : val === 12 ? 'Q' : val === 13 ? 'K' : val === 14 ? 'A' : val.toString(),
                    suit, value: val
                });
            }

            const newHand = [...specialCards, ...newStandardHand];
            setPowerUsage(prev => ({ ...prev, hasUsedRefresh: true }));
            if (typeof window !== 'undefined') {
                localStorage.setItem(`diamonds_refresh_used_${user?.id}`, 'true');
            }
            setMyHand(newHand);
            setMySlots([null, null, null, null, null]);

            if (myPlayer) {
                syncMyPlayerToState({
                    ...myPlayer,
                    cards: newHand,
                    slots: [null, null, null, null, null]
                });
            }

            addToast("ASSETS SHUFFLED & REGENERATED. SPECIAL PROTOCOLS PRESERVED.", "success");
        } catch (err) {
            console.error("Refresh failed:", err);
            addToast("PROTOCOL CARRIER LOST. REFRESH FAILED.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleUseDetector = async () => {
        if (!user || gameState?.phase !== 'slotting' || isLocked) return;
        if (powerUsage.hasUsedDetector || (typeof window !== 'undefined' && localStorage.getItem(`diamonds_detector_used_${user?.id}`) === 'true')) {
            addToast("PROTOCOL ERROR: DETECTOR CHARGE DEPLETED (1 USE PER TRIAL)", "error");
            return;
        }

        setIsLoading(true);

        try {
            const counts: Record<string, number> = {};
            (gameState?.participants || []).forEach(p => {
                counts[p.id] = (p.cards || []).length;
            });
            setOpponentHandCounts(counts);
            setDetectorActive(true);
            setPowerUsage(prev => ({ ...prev, hasUsedDetector: true }));
            if (typeof window !== 'undefined') {
                localStorage.setItem(`diamonds_detector_used_${user?.id}`, 'true');
            }

            addToast("SENSOR SWEEP COMPLETE. ASSET COUNTS ACQUIRED.", "success");
        } catch (err) {
            console.error("Detector failed:", err);
            addToast("SENSOR LINK INTERRUPTED.", "error");
        } finally {
            setIsLoading(false);
        }
    };


    if (isLoading) return (
        <div className="min-h-screen bg-transparent flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
                <p className="text-purple-500/50 font-mono text-sm tracking-widest animate-pulse">ESTABLISHING LINK...</p>
            </div>
        </div>
    );

    // --- RENDER ---
    return (
        <div
            className={`relative w-full h-full ${gameState?.phase === 'end' ? 'bg-black' : 'bg-transparent'} flex flex-col font-sans overflow-y-auto text-white selection:bg-purple-500/30`}
            onScroll={(e) => {
                const target = e.target as HTMLDivElement;
                setIsScrolled(target.scrollTop > 20);
            }}
        >
            {/* Background Texture - Using Hub atmosphere but keeping protocol noise */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>

            <header className={`fixed top-0 left-0 right-0 z-[100] border-b border-white/10 px-3 py-2 sm:px-8 sm:py-4 transition-all duration-300 ${gameState?.phase === 'end' ? 'bg-black' : isScrolled ? 'bg-black/95 backdrop-blur-2xl shadow-2xl' : 'bg-black/20 backdrop-blur-md'}`}>
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
                    {/* Left: Brand / Title */}
                    <div className="flex items-center gap-2 sm:gap-4">
                        <div className="hidden sm:flex flex-col border-r border-white/10 pr-4">
                            <span className="text-[10px] font-black text-white/40 tracking-[0.4em] uppercase leading-none mb-1">NETWORK</span>
                            <span className="text-xs font-black text-purple-500 uppercase tracking-widest leading-none">BORDERLAND</span>
                        </div>
                        <div className="flex flex-col">
                            <h2 className="text-[9px] sm:text-xs font-cinzel font-black text-purple-500 tracking-[0.2em] sm:tracking-[0.3em] uppercase leading-none mb-0.5 sm:mb-1">
                                DIAMONDS TRIAL
                            </h2>
                            <h1 className="text-xs sm:text-lg font-black font-oswald text-white tracking-widest uppercase leading-none">
                                LOGIC PROTOCOL
                            </h1>
                        </div>
                    </div>

                    {/* Right: Actions (Timer/Rules/Close) */}
                    <div className="flex items-center gap-1.5 sm:gap-3">
                        {/* TIMER AT RIGHT TOP */}
                        <div className="flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 bg-purple-950/40 border border-purple-500/30 rounded-lg shadow-sm">
                            <Timer size={12} className="text-purple-400 animate-pulse sm:w-3.5 sm:h-3.5" />
                            <span className="text-[11px] sm:text-sm font-black font-oswald tabular-nums text-purple-400">
                                {timeLeft}s
                            </span>
                        </div>

                        <button
                            onClick={() => {
                                const next = !skipVideos;
                                setSkipVideos(next);
                                if (typeof window !== 'undefined') {
                                    localStorage.setItem('skipVideos', String(next));
                                    window.dispatchEvent(new CustomEvent('skip-videos-toggled', { detail: next }));
                                }
                            }}
                            title="Toggle Skip Intro"
                            className={`p-1.5 sm:px-3 sm:py-1.5 border text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-widest transition-all rounded flex items-center justify-center ${skipVideos ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'border-white/20 bg-white/5 hover:bg-white/10 text-white/80'}`}
                        >
                            <FastForward size={14} className="sm:hidden text-green-400" />
                            <span className="hidden sm:inline">Skip Intro: {skipVideos ? 'ON' : 'OFF'}</span>
                        </button>

                        <button
                            onClick={() => setShowRulesModal(true)}
                            title="Rules"
                            className="p-1.5 sm:px-4 sm:py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded text-purple-500 transition-all active:scale-95 flex items-center gap-1.5"
                        >
                            <HelpCircle size={15} />
                            <span className="hidden sm:inline font-mono text-[11px] tracking-widest uppercase">RULES</span>
                        </button>

                        <button
                            onClick={() => setShowPlayerCard(true)}
                            title="Player Profile"
                            className="flex items-center gap-1.5 px-2 py-1.5 sm:px-3 sm:py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded transition-all active:scale-95 group"
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                            <span className="hidden sm:inline text-[10px] font-mono tracking-[0.2em] text-gray-300 uppercase group-hover:text-white transition-colors">
                                {user?.username?.toUpperCase() || 'PLAYER'}
                            </span>
                            <User size={14} className="text-gray-500 group-hover:text-purple-400 transition-colors" />
                        </button>
                    </div>
                </div>

                {/* Sub-Header HUD */}
                <div className="max-w-7xl mx-auto mt-2 pt-2 border-t border-white/10 flex items-center justify-around sm:justify-end sm:gap-6">
                    <div className="flex flex-col items-center sm:items-end">
                        <p className="text-[7px] sm:text-[9px] text-purple-300/40 font-mono uppercase tracking-[0.2em]">ROUND</p>
                        <p className="text-xs sm:text-xl font-black font-oswald text-white">
                            {gameState?.current_round || 1}<span className="text-purple-900 text-[9px] sm:text-sm">/5</span>
                        </p>
                    </div>

                    <div className="w-px h-5 bg-white/10 sm:hidden" />

                    <div className="flex flex-col items-center sm:items-end">
                        <p className="text-[7px] sm:text-[9px] text-purple-300/40 font-mono uppercase tracking-[0.2em]">TIMER</p>
                        <div className="flex items-center gap-1">
                            <Timer size={11} className="text-purple-500 animate-pulse sm:w-4 sm:h-4" />
                            <p className="text-xs sm:text-xl font-black font-oswald tabular-nums text-purple-500">
                                {timeLeft}s
                            </p>
                        </div>
                    </div>

                    <div className="w-px h-5 bg-white/10 sm:hidden" />

                    <div className="flex flex-col items-center sm:items-end bg-purple-500/10 px-2.5 py-0.5 sm:px-4 sm:py-1.5 rounded border border-purple-500/20">
                        <p className="text-[7px] sm:text-[9px] text-purple-400/70 font-mono uppercase tracking-[0.2em]">CREDITS</p>
                        <p className="text-xs sm:text-xl font-black font-oswald text-purple-400">
                            {(() => {
                                const pAny = myPlayer as any;
                                const baseVisa = user?.visa_points ?? user?.points ?? user?.visaDays ?? pAny?.visa_points ?? pAny?.points ?? pAny?.visaDays;
                                
                                if (myPlayer?.score !== undefined && myPlayer?.score !== null && myPlayer?.score > 0 && myPlayer?.score !== 1000) {
                                    return myPlayer.score;
                                }
                                
                                if (baseVisa !== undefined && baseVisa !== null && baseVisa > 0) {
                                    return baseVisa;
                                }
                                
                                return (myPlayer?.score && myPlayer.score > 0) ? myPlayer.score : 1000;
                            })()}
                        </p>
                    </div>
                </div>
            </header>

            {/* SYNOPSIS Modal (Rules) */}
            <AnimatePresence>
                {showRulesModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[2000] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6"
                        onClick={() => setShowRulesModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            className="max-w-md w-full bg-zinc-950 border border-purple-500/30 p-8 rounded-3xl shadow-[0_0_50px_rgba(168,85,247,0.2)]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
                                <h3 className="text-2xl font-black font-oswald tracking-widest text-purple-500 uppercase">TRIAL SYNOPSIS</h3>
                                <button onClick={() => setShowRulesModal(false)} className="text-white/40 hover:text-white transition-colors">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <p className="text-[10px] font-black font-mono text-purple-400 uppercase tracking-widest">Asset Hierarchy</p>
                                    <div className="grid grid-cols-1 gap-3">
                                        <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                                                <span className="text-xs font-black font-cinzel text-white">ZOMBIE</span>
                                            </div>
                                            <span className="text-[10px] font-mono text-white/40">VALUE = 999</span>
                                        </div>
                                        <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                                                <span className="text-xs font-black font-cinzel text-white">INJECTION</span>
                                            </div>
                                            <span className="text-[10px] font-mono text-white/40">CURES ZOMBIE SLOT (+200CR)</span>
                                        </div>
                                        <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
                                                <span className="text-xs font-black font-cinzel text-white">SHOTGUN</span>
                                            </div>
                                            <span className="text-[10px] font-mono text-white/40">KILLS ALL ZOMBIES (+100CR)</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <p className="text-[10px] font-black font-mono text-purple-400 uppercase tracking-widest">Protocol Values</p>
                                    <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                        <div className="grid grid-cols-2 gap-y-2 text-[10px] font-mono uppercase tracking-widest">
                                            <span className="text-white/40">VICTORY DELTA</span>
                                            <span className="text-right text-green-400 font-bold">+200 CR</span>
                                            <span className="text-white/40">CONFLICT LOSS</span>
                                            <span className="text-right text-red-400 font-bold">-100 CR</span>
                                            <span className="text-white/40">ELIMINATION</span>
                                            <span className="text-right text-red-600 font-extrabold">DECOMMISSIONED</span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setShowRulesModal(false)}
                                    className="w-full py-4 mt-4 bg-purple-600 hover:bg-purple-500 text-white font-black font-oswald uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95"
                                >
                                    ACKNOWLEDGE
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* RESET OVERLAY */}
            <AnimatePresence>
                {showResetOverlay && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[1000] bg-black backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center"
                    >
                        <AlertTriangle className="text-red-500 w-16 h-16 mb-4 animate-bounce" />
                        <h2 className="text-4xl font-black text-white tracking-widest mb-2 font-mono">SYSTEM RESET</h2>
                        <p className="text-red-500/70 font-mono text-sm tracking-[0.3em] animate-pulse">ADMIN FORCE PROTOCOL TERMINATION</p>
                        <div className="mt-8 flex items-center gap-2">
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                            <span className="text-[10px] text-gray-500 font-mono">RETURNING TO LOBBY...</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {gameState?.is_paused && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 w-screen h-screen z-[10000] bg-black/98 backdrop-blur-2xl flex items-center justify-center pointer-events-auto left-0 top-0"
                    >
                        <div className="text-center space-y-6 p-8">
                            <div className="relative inline-block">
                                <div className="absolute inset-0 bg-yellow-500/20 blur-3xl rounded-full animate-pulse" />
                                <h2 className="text-6xl lg:text-8xl font-black text-yellow-500 tracking-[0.2em] italic relative drop-shadow-[0_0_30px_rgba(234,179,8,0.5)]">
                                    SYSTEM PAUSED
                                </h2>
                            </div>
                            <p className="text-white/60 font-mono text-lg lg:text-xl uppercase tracking-[0.5em] animate-pulse">
                                AWAITING MASTER AUTHORIZATION
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* BRIEFING OVERLAY */}
            <AnimatePresence mode="wait">
                {gameState?.phase === 'briefing' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[1000] bg-[#050508]/98 backdrop-blur-2xl overflow-y-auto custom-scrollbar p-3 sm:p-6"
                    >
                        <div className="min-h-full w-full flex items-start justify-center">
                            {/* High-Tech Background Elements */}
                            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
                                <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(to_right,#16161a_1px,transparent_1px),linear-gradient(to_bottom,#16161a_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

                                {/* Global Scanner Sweep Effect */}
                                <motion.div
                                    animate={{ top: ["-10%", "110%"] }}
                                    transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                                    className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-transparent shadow-[0_0_20px_rgba(168,85,247,1)] z-[1001] opacity-50"
                                />

                                <motion.div
                                    animate={{ top: ["100%", "-20%"] }}
                                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                                    className="absolute left-0 right-0 h-40 bg-gradient-to-b from-transparent via-purple-500/10 to-transparent blur-3xl"
                                />
                            </div>

                            <div className="relative max-w-[1600px] w-full mx-auto space-y-4 sm:space-y-6 pt-2 sm:pt-4 pb-12 px-4 sm:px-6">
                                {/* Header Section */}
                                <motion.div
                                    initial={{ y: -30, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    className="text-center space-y-3 relative mb-6 sm:mb-8"
                                >
                                    {/* Decorative Ring */}
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none" />

                                    <div className="inline-flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 px-5 py-3 sm:py-2.5 rounded-xl border border-purple-400/30 bg-black/80 text-[9px] sm:text-[10px] font-black text-purple-300 uppercase tracking-[0.2em] sm:tracking-[0.3em] mb-3 backdrop-blur-md w-full max-w-xs sm:max-w-md sm:w-auto mx-auto shadow-[0_0_30px_rgba(168,85,247,0.15)]">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-ping shrink-0" />
                                            <span className="text-center">Security Update: Advanced Asset Protocol</span>
                                        </div>
                                        <span className="sm:ml-4 sm:pl-4 sm:border-l border-t sm:border-t-0 border-purple-500/30 pt-1.5 sm:pt-0 text-white animate-pulse">
                                            System Ready: {timeLeft}s
                                        </span>
                                    </div>

                                    <h1 className="font-cinzel text-3xl sm:text-5xl lg:text-6xl text-white uppercase tracking-tighter leading-none relative z-10 transition-all">
                                        LOGIC <span className="text-transparent bg-clip-text bg-gradient-to-b from-purple-300 via-purple-500 to-purple-800 drop-shadow-[0_0_20px_rgba(168,85,247,0.5)] animate-pulse">PROTOCOL</span>
                                        <motion.div
                                            animate={{ opacity: [0, 0.05, 0], x: [-5, 5, -2, 0] }}
                                            transition={{ duration: 0.2, repeat: Infinity, repeatDelay: 5 }}
                                            className="absolute inset-0 text-purple-500 blur-sm -z-10 select-none font-cinzel text-3xl sm:text-5xl lg:text-6xl"
                                        >
                                            LOGIC PROTOCOL
                                        </motion.div>
                                    </h1>

                                    <div className="flex items-center justify-center gap-3">
                                        <div className="h-px w-12 bg-gradient-to-r from-transparent to-purple-500/30" />
                                        <p className="text-purple-300/40 font-cinzel text-[10px] tracking-[0.4em] font-black uppercase">
                                            [CORE LOGIC STABILIZED] :: Authorized Blueprint
                                        </p>
                                        <div className="h-px w-12 bg-gradient-to-l from-transparent to-purple-500/30" />
                                    </div>
                                </motion.div>

                                {/* MAIN BRIEFING CONTENT GRID */}
                                <div className="flex flex-col xl:flex-row items-stretch justify-center gap-8 relative z-10">
                                    {/* LEFT: Array Constraints */}
                                    <motion.div
                                        initial={{ x: -50, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        transition={{ delay: 0.2 }}
                                        className="w-full xl:w-[280px] shrink-0 self-stretch"
                                    >
                                        <TerminalBox title="Array Constraints" icon={<Scan size={16} />}>
                                            <div className="overflow-hidden border border-purple-500/10 rounded-lg bg-black/40 h-full">
                                                <table className="w-full text-left font-cinzel text-[9px] sm:text-[10px] border-collapse h-full">
                                                    <thead>
                                                        <tr className="bg-purple-500/10 border-b border-purple-500/20">
                                                            <th className="px-2.5 py-3 text-purple-400 font-black uppercase tracking-widest border-r border-purple-500/10 text-[8px] sm:text-[9px]">Protocol</th>
                                                            <th className="px-2.5 py-3 text-purple-400 font-black uppercase tracking-widest text-[8px] sm:text-[9px]">Constraint</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-purple-500/10">
                                                        <tr className="hover:bg-purple-500/5 transition-colors">
                                                            <td className="px-2.5 py-3 text-purple-300/80 border-r border-purple-500/10 font-bold leading-tight text-[8px] sm:text-[9px]">VARIABLE DEPLOYMENT</td>
                                                            <td className="px-2.5 py-3 text-white/50 leading-tight text-[8px] sm:text-[9px]">1-5 ASSETS PER ROUND REQ.</td>
                                                        </tr>
                                                        <tr className="hover:bg-orange-500/5 transition-colors">
                                                            <td className="px-2.5 py-3 text-orange-400/80 border-r border-purple-500/10 font-bold uppercase leading-tight text-[8px] sm:text-[9px]">Overload Principle</td>
                                                            <td className="px-2.5 py-3 text-white/50 uppercase leading-tight text-[8px] sm:text-[9px]">ONE 5-CARD DEPLOYMENT SESSION.</td>
                                                        </tr>
                                                        <tr className="hover:bg-purple-500/5 transition-colors">
                                                            <td className="px-2.5 py-3 text-purple-300/80 border-r border-purple-500/10 font-bold uppercase leading-tight text-[8px] sm:text-[9px]">Asset Recovery</td>
                                                            <td className="px-2.5 py-3 text-white/50 uppercase leading-tight text-[8px] sm:text-[9px]">WINNERS STEAL 1 FROM DEFEATED.</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </TerminalBox>
                                    </motion.div>

                                    {/* CENTER COLUMN: Cards + Point Table */}
                                    <div className="flex-1 flex flex-col">
                                        {/* Asset Cards Grid */}
                                        <div className="flex flex-wrap lg:flex-nowrap justify-center items-stretch gap-4 pb-0">
                                            <BriefingCard
                                                title="ZOMBIE"
                                                id="28472A"
                                                desc="SUPREME VALUE (999). Guarantees slot victory unless neutralized by Shotgun or Injection."
                                                delay={0.1}
                                                color="purple"
                                            />
                                            <BriefingCard
                                                title="INJECTION"
                                                id="DVL291"
                                                desc="SLOT NEUTRALIZER. Cures an opponent's slotted Zombie card (Value becomes 0). Grants +200CR bonus."
                                                delay={0.2}
                                                color="green"
                                            />
                                            <BriefingCard
                                                title="SHOTGUN"
                                                id="A683BF"
                                                desc="GLOBAL ELIMINATION. Destroys all Zombies in opponent's hand and slots. Grants +100CR bonus per slotted Zombie."
                                                delay={0.3}
                                                color="orange"
                                            />
                                        </div>

                                        {/* Point Table Reference - Tightly packed */}
                                        <div className="mt-0">
                                            <TerminalBox title="Numeric Asset Reference Matrix" icon={<Activity size={16} />}>
                                                <div className="overflow-x-auto custom-scrollbar border border-purple-500/10 rounded-lg bg-black/60">
                                                    <div className="flex divide-x divide-purple-500/10 min-w-[340px] sm:min-w-0">
                                                        {[
                                                            { rank: '2-10', val: 'FACE VALUE' },
                                                            { rank: 'J', val: '11 PT' },
                                                            { rank: 'Q', val: '12 PT' },
                                                            { rank: 'K', val: '13 PT' },
                                                            { rank: 'A', val: '14 PT' }
                                                        ].map((item, idx) => (
                                                            <div key={idx} className="flex-1 flex flex-col items-center justify-center py-3 px-1.5 group hover:bg-purple-500/5 transition-all min-w-[60px]">
                                                                <span className="text-[6px] font-mono text-purple-500/40 mb-0.5 group-hover:text-purple-400 uppercase tracking-widest">ASSET_CLASS</span>
                                                                <span className="font-cinzel text-sm sm:text-lg text-white font-black mb-0.5">{item.rank}</span>
                                                                <div className="h-[1px] w-3 bg-purple-500/20 mb-1 group-hover:w-6 transition-all" />
                                                                <span className="text-[7px] sm:text-[8px] font-cinzel font-black text-white/60 group-hover:text-purple-400 whitespace-nowrap">{item.val}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </TerminalBox>
                                        </div>
                                    </div>

                                    {/* RIGHT: Conflict Summary */}
                                    <motion.div
                                        initial={{ x: 50, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        transition={{ delay: 0.2 }}
                                        className="w-full xl:w-[320px] shrink-0 self-stretch"
                                    >
                                        <TerminalBox title="Conflict Summary" icon={<Info size={16} />}>
                                            <div className="space-y-2.5 p-1.5 h-full flex flex-col">
                                                {[
                                                    { label: "WINNER", value: "SUM(ASSETS) > OPPONENT SUM", accent: "purple" },
                                                    { label: "ZOMBIE", value: "VALUE 999. OVERRIDES ALL SLOTS", accent: "purple" },
                                                    { label: "LIMITS", value: "EXACTLY 1 SPECIAL PER PLAYER", accent: "orange" },
                                                    { label: "SCORING", value: "SURVIVAL: +200CR | LOSS: -100CR", accent: "purple" }
                                                ].map((item, idx) => (
                                                    <div key={idx} className="flex items-center gap-3 bg-white/[0.02] border border-white/5 p-2.5 rounded-lg group hover:border-purple-500/30 transition-all flex-1">
                                                        <div className={`w-1 h-full bg-${item.accent === 'purple' ? 'purple-500' : 'orange-500'} rounded-full opacity-50 group-hover:opacity-100 transition-opacity`} />
                                                        <div className="flex-1">
                                                            <p className={`font-cinzel text-[8px] font-black uppercase tracking-[0.15em] text-${item.accent === 'purple' ? 'purple-400' : 'orange-400'} mb-0.5`}>{item.label}</p>
                                                            <p className="font-cinzel text-[9px] text-white/50 group-hover:text-white/80 transition-colors uppercase leading-tight">{item.value}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </TerminalBox>
                                    </motion.div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* WAITING / IDLE */}
            {
                gameState?.phase === 'idle' && (
                    <div className="absolute inset-0 z-40 bg-black/95 flex flex-col items-center justify-center">
                        <div className="p-12 border border-purple-500/20 bg-purple-900/5 rounded-2xl text-center space-y-6 backdrop-blur-md">
                            <div className="w-16 h-16 mx-auto border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
                            <div>
                                <h1 className="text-3xl font-bold text-white mb-2 tracking-widest font-mono uppercase">Logic Protocol Initializing...</h1>
                                <p className="text-purple-400/50 text-sm font-mono tracking-[0.2em] animate-pulse">SYNCHRONIZING DATA GRID...</p>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* ELIMINATED */}
            {
                myPlayer?.status === 'eliminated' && (
                    <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center">
                        <Skull size={64} className="text-red-600 mb-6 animate-pulse" />
                        <h1 className="text-6xl font-black text-red-600 tracking-tighter mix-blend-screen">ELIMINATED</h1>
                        <p className="text-red-500/50 mt-4 font-mono text-sm tracking-[0.5em] uppercase">Subject Decommissioned</p>
                    </div>
                )
            }

            {/* END GAME OVERLAY */}
            <AnimatePresence>
                {gameState?.phase === 'end' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="fixed inset-0 z-[6000] bg-black flex items-center justify-center p-4 sm:p-6 overflow-hidden text-center"
                    >
                        {/* Futuristic Cyber Background Atmosphere */}
                        <div className="absolute inset-0 bg-gradient-to-b from-purple-950/40 via-black to-black pointer-events-none" />
                        <div className="absolute inset-0 bg-[radial-gradient(#c084fc_1.3px,transparent_1.3px)] [background-size:26px_26px] opacity-35 pointer-events-none" />
                        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-600/20 blur-[130px] rounded-full pointer-events-none animate-pulse" />
                        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-indigo-600/15 blur-[150px] rounded-full pointer-events-none" />

                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                            className="max-w-3xl w-full space-y-6 py-8 px-6 sm:px-10 relative z-10 bg-black/90 border border-purple-500/40 rounded-3xl backdrop-blur-2xl shadow-[0_0_80px_rgba(168,85,247,0.3)] my-auto"
                        >
                            {/* Sci-Fi Frame HUD Brackets */}
                            <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-purple-500/70 rounded-tl-sm pointer-events-none" />
                            <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-purple-500/70 rounded-tr-sm pointer-events-none" />
                            <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-purple-500/70 rounded-bl-sm pointer-events-none" />
                            <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-purple-500/70 rounded-br-sm pointer-events-none" />

                            {/* Header Title Section */}
                            <div className="space-y-2.5">
                                <div className="inline-flex items-center justify-center gap-2.5 px-3.5 py-1 bg-purple-950/70 border border-purple-500/40 rounded-full shadow-[0_0_15px_rgba(168,85,247,0.25)]">
                                    <Gem size={14} className="text-purple-400 animate-pulse" />
                                    <span className="text-[9px] sm:text-[10px] font-mono text-purple-300 tracking-[0.3em] uppercase font-bold">
                                        PROTOCOL TRIAL COMPLETE
                                    </span>
                                    <Gem size={14} className="text-purple-400 animate-pulse" />
                                </div>

                                <motion.div
                                    animate={{
                                        textShadow: ["0 0 25px rgba(168,85,247,0.2)", "0 0 40px rgba(168,85,247,0.7)", "0 0 25px rgba(168,85,247,0.2)"]
                                    }}
                                    transition={{ duration: 3, repeat: Infinity }}
                                >
                                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black font-cinzel tracking-[0.15em] sm:tracking-[0.2em] uppercase italic bg-gradient-to-r from-purple-200 via-white to-purple-400 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(168,85,247,0.6)] leading-none">
                                        {myPlayer?.status === 'eliminated' ? 'TRIAL FAILED' : 'VICTORY ACHIEVED'}
                                    </h1>
                                </motion.div>

                                <div className="h-0.5 w-36 bg-gradient-to-r from-transparent via-purple-500 to-transparent mx-auto" />
                                <p className="text-purple-300/50 font-mono text-[8px] sm:text-[9px] tracking-[0.3em] uppercase font-semibold">
                                    DIAMONDS TRIAL :: OFFICIAL CLASSIFIED LEADERBOARD
                                </p>
                            </div>

                            {/* Leaderboard Cards Grid */}
                            {(() => {
                                const sorted = [...(gameState.participants || [])].sort((a, b) => (b.score || 0) - (a.score || 0));
                                const top2 = sorted.slice(0, 2);
                                const myRankIdx = sorted.findIndex(p => p.id === user?.id || (user?.username && p.username?.toLowerCase() === user.username.toLowerCase()));
                                const myRankPlayer = (myRankIdx >= 2 && sorted[myRankIdx]) ? sorted[myRankIdx] : null;

                                const displayList = myRankPlayer
                                    ? [...top2.map((p, idx) => ({ ...p, rankDisplay: idx + 1 })), { ...myRankPlayer, rankDisplay: myRankIdx + 1 }]
                                    : top2.map((p, idx) => ({ ...p, rankDisplay: idx + 1 }));

                                return (
                                    <div className={`grid grid-cols-1 ${displayList.length === 2 ? 'sm:grid-cols-2 max-w-xl' : 'sm:grid-cols-2 lg:grid-cols-3 max-w-3xl'} mx-auto gap-3 sm:gap-4 lg:gap-5 w-full`}>
                                        {displayList.map((p) => {
                                            const isTopWinner = p.rankDisplay === 1;
                                            const isMe = p.id === user?.id || (user?.username && p.username?.toLowerCase() === user.username.toLowerCase());
                                            return (
                                                <motion.div
                                                    key={p.id}
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    whileHover={{ y: -3, scale: 1.01 }}
                                                    className={`relative p-3.5 sm:p-5 border-2 transition-all duration-300 rounded-2xl backdrop-blur-xl flex flex-col items-center justify-between min-h-[135px] sm:min-h-[155px] shadow-xl overflow-hidden group/card ${isTopWinner
                                                        ? 'border-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.35)] bg-gradient-to-b from-purple-950/70 via-purple-900/20 to-black'
                                                        : isMe
                                                            ? 'border-purple-400/60 bg-gradient-to-b from-purple-900/20 via-black to-black shadow-[0_0_15px_rgba(168,85,247,0.15)]'
                                                            : 'border-white/10 bg-black/80 hover:border-purple-500/30'
                                                        }`}
                                                >
                                                    {/* Top Glow Accent Bar */}
                                                    <div className={`absolute top-0 left-0 right-0 h-[2px] ${isTopWinner ? 'bg-gradient-to-r from-transparent via-purple-400 to-transparent' : 'bg-white/10'}`} />

                                                    {isTopWinner && (
                                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 text-white font-black text-[8px] uppercase tracking-widest rounded-full shadow-[0_0_15px_#a855f7] flex items-center gap-1 border border-purple-300/50 z-20">
                                                            <Crown size={11} className="text-amber-300 fill-current animate-pulse" />
                                                            VICTOR
                                                        </div>
                                                    )}

                                                    <div className="flex items-center justify-between w-full pt-0.5">
                                                        <span className="text-[9px] sm:text-[10px] font-mono text-purple-400/80 font-bold uppercase tracking-widest">
                                                            RANK 0{p.rankDisplay}
                                                        </span>
                                                        {isMe && (
                                                            <span className="text-[7px] font-mono px-1.5 py-0.5 bg-purple-500/25 text-purple-200 border border-purple-400/40 rounded uppercase tracking-wider font-bold shadow-[0_0_8px_rgba(168,85,247,0.3)]">
                                                                YOU
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="my-1.5 sm:my-2 text-center flex flex-col items-center gap-1">
                                                        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border ${isTopWinner ? 'bg-amber-950/60 border-amber-400/70 text-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.3)]' : 'bg-white/5 border-white/10 text-white/60'}`}>
                                                            {isTopWinner ? (
                                                                <Crown size={15} className="text-amber-300 fill-amber-400/40 animate-pulse" />
                                                            ) : (
                                                                <User size={14} />
                                                            )}
                                                        </div>
                                                        <h3 className="text-sm sm:text-lg font-black text-white uppercase tracking-wider leading-tight truncate max-w-[140px] sm:max-w-[170px]">
                                                            {p.username || playerIdMap[p.id] || "PLAYER"}
                                                        </h3>
                                                    </div>

                                                    <div className="w-full pt-2 border-t border-white/10 flex items-center justify-between">
                                                        <span className="text-[8px] font-mono text-white/40 uppercase tracking-widest">VISA BALANCE</span>
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-base sm:text-xl font-black text-purple-400 font-oswald tracking-wide">{p.score || 0}</span>
                                                            <span className="text-[8px] font-mono text-purple-300/50 uppercase font-bold">CR</span>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}

                            {/* Return Button */}
                            <div className="pt-2 flex justify-center">
                                <button
                                    onClick={() => {
                                        localStorage.removeItem('diamonds_game_id');
                                        if (onClose) onClose();
                                        window.location.href = '/home/card';
                                    }}
                                    className="group relative px-10 py-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white font-black uppercase tracking-[0.3em] transition-all duration-300 rounded-xl shadow-[0_0_25px_rgba(168,85,247,0.4)] hover:shadow-[0_0_45px_rgba(168,85,247,0.7)] active:scale-95 border border-purple-300/40 flex items-center justify-center gap-2.5 text-xs font-mono"
                                >
                                    <span>Return to Home</span>
                                    <ChevronRight size={16} className="group-hover:translate-x-1.5 transition-transform text-purple-200" />
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>


            {/* PROHIBITED ACCESS OVERLAY */}
            <AnimatePresence>
                {isProhibited && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="fixed inset-0 z-[5000] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-8 text-center"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="max-w-md space-y-8"
                        >
                            <div className="relative inline-block">
                                <div className="absolute inset-0 bg-red-500/20 blur-3xl rounded-full animate-pulse" />
                                <Skull size={80} className="text-red-500 relative animate-bounce" />
                            </div>
                            <div className="space-y-4">
                                <h1 className="text-4xl font-black text-white tracking-[0.2em] uppercase font-mono">ACCESS REVOKED</h1>
                                <div className="h-1 w-24 bg-red-500 mx-auto rounded-full" />
                                <p className="text-red-400 font-mono text-sm tracking-widest leading-relaxed">
                                    MASTER ROLES ARE PROHIBITED FROM THIS TRIAL. <br />
                                    DECRYPTION INTERRUPTED.
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="px-12 py-4 bg-red-600/20 border border-red-500/50 text-red-500 font-black uppercase tracking-[0.3em] hover:bg-red-600/40 transition-all rounded-sm"
                            >
                                TERMINATE LINK
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* EVALUATION OVERLAY */}
            <AnimatePresence>
                {(gameState?.phase === 'evaluation') && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[2000] bg-black flex items-start justify-center pt-4 sm:pt-6 pb-6 px-4 overflow-y-auto custom-scrollbar"
                    >
                        <div className="max-w-md sm:max-w-lg w-full text-center space-y-3 py-1">
                            {(() => {
                                const myId = user?.id;
                                const myUname = user?.username?.toLowerCase();
                                const isWinner = gameState.round_data?.winners?.some((w: string) => w === myId || (myUname && w.toLowerCase() === myUname));
                                const myEffects = gameState.round_data?.effects?.filter((e: any) => e.playerId === myId || (myUname && e.playerId?.toLowerCase() === myUname)) || [];
                                
                                const battle = gameState.round_data?.results?.find((r: any) => {
                                    const matches = (id: string) => id && (id === myId || (myUname && id.toLowerCase() === myUname));
                                    return (
                                        r.winners?.some((w: string) => matches(w)) ||
                                        r.losers?.some((l: string) => matches(l)) ||
                                        r.eliminatedIds?.some((e: string) => matches(e)) ||
                                        matches(r.p1Id) || matches(r.p2Id) || matches(r.p3Id)
                                    );
                                });

                                const isP1 = battle?.p1Id === myId || (myUname && battle?.p1Id?.toLowerCase() === myUname);
                                const isP2 = battle?.p2Id === myId || (myUname && battle?.p2Id?.toLowerCase() === myUname);
                                const isP3 = battle?.p3Id === myId || (myUname && battle?.p3Id?.toLowerCase() === myUname);

                                let pYouKey = 'p1';
                                let pOpp1Key = 'p2';
                                if (isP2) { pYouKey = 'p2'; pOpp1Key = 'p1'; }
                                else if (isP3) { pYouKey = 'p3'; pOpp1Key = 'p1'; }

                                const p1Tot = battle ? (battle.p1Total || 0) : 0;
                                const p2Tot = battle ? (battle.p2Total || 0) : 0;
                                const p3Tot = battle ? (battle.p3Total || 0) : 0;
                                const hasP3 = Boolean(battle?.p3Id);

                                const totalsInBattle = hasP3 ? [p1Tot, p2Tot, p3Tot] : [p1Tot, p2Tot];
                                const maxScoreInBattle = Math.max(...totalsInBattle);

                                let youTotal = 0;
                                if (isP1) youTotal = p1Tot;
                                else if (isP2) youTotal = p2Tot;
                                else if (isP3) youTotal = p3Tot;

                                const allPlayersTied = totalsInBattle.every(t => t === totalsInBattle[0]);
                                const isTiedForHighest = (youTotal === maxScoreInBattle) && (totalsInBattle.filter(t => t === maxScoreInBattle).length > 1);

                                // Total draw happens ONLY when ALL players in the battle have identical totals (e.g. 0-0 or 3-way tie)
                                const isDraw = battle ? allPlayersTied : false;
                                const isZeroDraw = isDraw && totalsInBattle.every(t => t === 0);

                                // Victory if you have the max score and it's not a total 3-way draw (includes joint highest score ties!)
                                const isPureWin = battle ? (youTotal === maxScoreInBattle && !isDraw) : false;

                                const noCardsSubmitted = (mySlots || []).every(s => s === null) || (mySlots || []).filter(s => s !== null).length === 0;
                                const hasPenaltyEffect = myEffects.some((e: any) => e.type === 'infected' || e.desc?.toLowerCase().includes('penalty'));
                                const hasPenalty = !isPureWin && !isDraw && (noCardsSubmitted || hasPenaltyEffect);

                                const duelPoints = isPureWin ? 200 : (isDraw ? 0 : (hasPenalty ? -200 : -100));
                                const netAdjust = duelPoints;
                                const displayBalance = (myPlayer?.score ?? 1000);

                                const getConflictReason = () => {
                                    const effects = battle?.effects || [];
                                    const slotDetails = battle?.slotDetails || [];

                                    const myEffectsInBattle = effects.filter((e: any) => e.playerId === myId || (myUname && e.playerId?.toLowerCase() === myUname));
                                    const hasShotgunBonus = myEffectsInBattle.some((e: any) => e.desc?.includes('SHOTGUN BONUS'));
                                    const hasInjectionBonus = myEffectsInBattle.some((e: any) => e.desc?.includes('INJECTION BONUS'));
                                    const myZombieNeutralizedShotgun = myEffectsInBattle.some((e: any) => e.desc?.includes('BY SHOTGUN'));
                                    const myZombieNeutralizedInjection = myEffectsInBattle.some((e: any) => e.desc?.includes('BY INJECTION'));

                                    const allCardsInPlay = slotDetails.flatMap((s: any) => [s.p1Card, s.p2Card, s.p3Card].filter(Boolean));
                                    const zombieInPlay = allCardsInPlay.some((c: any) => c.specialType === 'zombie');
                                    const shotgunInPlay = allCardsInPlay.some((c: any) => c.specialType === 'shotgun');
                                    const injectionInPlay = allCardsInPlay.some((c: any) => c.specialType === 'injection');

                                    if (hasShotgunBonus) return "Zombie Removed by Gun / Shotgun (+100 CR)";
                                    if (hasInjectionBonus) return "Zombie Cured & Removed by Injection (+200 CR)";
                                    if (myZombieNeutralizedShotgun) return "Zombie Removed by Opponent Gun";
                                    if (myZombieNeutralizedInjection) return "Zombie Cured & Removed by Opponent Injection";
                                    if (zombieInPlay && (shotgunInPlay || injectionInPlay)) return "Special Collision (Zombie Removed by Anti-Special)";
                                    if (zombieInPlay && isPureWin) return "Active Zombie Supremacy (+999 pt)";

                                    if (isZeroDraw) {
                                        return "Both 0 Points / Standstill (0 CR)";
                                    } else if (isDraw) {
                                        return "3-Way Point Tie / Standstill (0 CR)";
                                    } else if (isPureWin) {
                                        if (isTiedForHighest) return "Joint Victory / Tied High Score (+200 CR)";
                                        return "Won by Higher Point Total (+200 CR)";
                                    } else if (hasPenalty) {
                                        if (noCardsSubmitted) return "Defeat + 0 Cards Penalty (-200 CR)";
                                        return "Duel Defeat + Penalty (-200 CR)";
                                    } else {
                                        if (totalsInBattle.filter(t => t === youTotal).length > 1) {
                                            return "Tied Defeat vs Higher Player (-100 CR)";
                                        }
                                        return "Lost by Lower Point Total (-100 CR)";
                                    }
                                };

                                const dynamicReason = getConflictReason();

                                return (
                                    <>
                                        <motion.div
                                            initial={{ scale: 0.8, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            className="space-y-2"
                                        >
                                            <h2 className={`text-xl sm:text-2xl font-black italic uppercase tracking-wider leading-none ${isPureWin ? 'text-purple-400' : isDraw ? 'text-yellow-400' : 'text-orange-500'}`}>
                                                {isPureWin ? "VICTORY" : isDraw ? "DRAW" : "DEFEAT"}
                                            </h2>
                                            <div className="flex flex-col items-center gap-1.5">
                                                <div className="h-px w-24 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                                                <p className="text-white/40 font-mono text-[9px] tracking-[0.3em] font-bold uppercase">ROUND {gameState.current_round} PROTOCOL SUMMARY</p>
                                                {/* LIVE RESULT TIMER */}
                                                <div className="flex items-center gap-1.5 px-3 py-1 bg-purple-500/10 border border-purple-500/30 rounded-full text-purple-300 font-mono text-[9px] sm:text-[10px] font-bold uppercase tracking-widest my-0.5">
                                                    <Timer size={12} className="animate-spin text-purple-400" />
                                                    <span>NEXT PHASE IN {timeLeft}s</span>
                                                </div>
                                                <div className="h-px w-24 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                                            </div>
                                        </motion.div>

                                        {/* Status Effects */}
                                        {myEffects.length > 0 && (
                                            <div className="flex flex-col gap-2">
                                                {myEffects.map((eff: any, idx: number) => (
                                                    <motion.div
                                                        key={idx}
                                                        initial={{ x: -20, opacity: 0 }}
                                                        animate={{ x: 0, opacity: 1 }}
                                                        transition={{ delay: 0.2 + idx * 0.1 }}
                                                        className={`flex items-center gap-3 px-4 py-2 rounded-lg border font-mono text-[10px] uppercase tracking-widest ${eff.type === 'infected' ? 'bg-purple-500/10 border-purple-500 text-purple-400' : 'bg-green-500/10 border-green-500 text-green-400'}`}
                                                    >
                                                        <Activity size={12} />
                                                        {eff.desc}
                                                    </motion.div>
                                                ))}
                                            </div>
                                        )}

                                        {/* CONFLICT ANALYSIS TABLE */}
                                        {battle && (() => {
                                            const is3Way = battle.slotDetails?.[0]?.p3Card !== undefined;

                                            // Dynamically map columns so Column 1 is ALWAYS "YOU"
                                            const isP1 = battle.p1Id === myId || (myUname && battle.p1Id?.toLowerCase() === myUname);
                                            const isP2 = battle.p2Id === myId || (myUname && battle.p2Id?.toLowerCase() === myUname);
                                            const isP3 = battle.p3Id === myId || (myUname && battle.p3Id?.toLowerCase() === myUname);

                                            let pYouKey = 'p1';
                                            let pOpp1Key = 'p2';
                                            let pOpp2Key = 'p3';
                                            let opp1Id = battle.p2Id;
                                            let opp2Id = battle.p3Id;

                                            if (isP2) {
                                                pYouKey = 'p2';
                                                pOpp1Key = 'p1';
                                                opp1Id = battle.p1Id;
                                            } else if (isP3) {
                                                pYouKey = 'p3';
                                                pOpp1Key = 'p1';
                                                pOpp2Key = 'p2';
                                                opp1Id = battle.p1Id;
                                                opp2Id = battle.p2Id;
                                            }

                                            const opp1Player = gameState.participants?.find(p => p.id === opp1Id || (opp1Id && p.username?.toLowerCase() === opp1Id.toLowerCase()));
                                            const opp2Player = gameState.participants?.find(p => p.id === opp2Id || (opp2Id && p.username?.toLowerCase() === opp2Id.toLowerCase()));

                                            const youTotal = battle[`${pYouKey}Total`] || 0;
                                            const opp1Total = battle[`${pOpp1Key}Total`] || 0;
                                            const opp2Total = battle[`${pOpp2Key}Total`] || 0;

                                            return (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: 0.4 }}
                                                    className="w-full bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden"
                                                >
                                                    <div className="bg-white/[0.05] px-4 py-2 border-b border-white/5 flex justify-between items-center">
                                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400">Conflict Analysis</span>
                                                        <div className="flex gap-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500/50" />
                                                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500/20" />
                                                        </div>
                                                    </div>

                                                    <table className="w-full text-[10px] font-mono border-collapse">
                                                        <thead>
                                                            <tr className="border-b border-white/10 text-gray-500 uppercase tracking-widest text-[8px]">
                                                                <th className="py-3 px-4 text-left font-normal uppercase">Slot</th>
                                                                <th className="py-3 px-4 text-center font-bold text-purple-400 uppercase">YOU</th>
                                                                <th className="py-3 px-4 text-center font-normal uppercase">
                                                                    {opp1Player?.username || "OPP 1"}
                                                                </th>
                                                                {is3Way && (
                                                                    <th className="py-3 px-4 text-center font-normal uppercase">
                                                                        {opp2Player?.username || "OPP 2"}
                                                                    </th>
                                                                )}
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-white/[0.03]">
                                                            {battle.slotDetails?.map((slot: any, sIdx: number) => {
                                                                const youCard = slot[`${pYouKey}Card`];
                                                                const youVal = slot[`${pYouKey}Val`] || 0;
                                                                const opp1Card = slot[`${pOpp1Key}Card`];
                                                                const opp1Val = slot[`${pOpp1Key}Val`] || 0;
                                                                const opp2Card = slot[`${pOpp2Key}Card`];
                                                                const opp2Val = slot[`${pOpp2Key}Val`] || 0;

                                                                return (
                                                                    <tr key={sIdx} className="hover:bg-white/[0.01] transition-colors">
                                                                        <td className="py-3 px-4 text-left text-white/20 font-light tracking-tighter">PKT-0{sIdx + 1}</td>
                                                                        <td className="py-3 px-4 text-center transition-all">
                                                                            <div className="flex flex-col">
                                                                                <span className="text-white font-black text-xs leading-none mb-0.5">
                                                                                    {youCard ? (youCard.specialType || `${youCard.rank}${youCard.suit?.charAt(0).toUpperCase()}`) : '-'}
                                                                                </span>
                                                                                <span className={`text-[8px] font-black leading-none ${youVal > 0 ? 'text-green-500' : 'text-red-500 opacity-60'}`}>{youVal >= 999 ? 'MAX' : `${youVal}pt`}</span>
                                                                            </div>
                                                                        </td>
                                                                        <td className="py-3 px-4 text-center">
                                                                            <div className="flex flex-col">
                                                                                <span className="text-white/40 font-bold text-xs leading-none mb-0.5">
                                                                                    {opp1Card ? (opp1Card.specialType || `${opp1Card.rank}${opp1Card.suit?.charAt(0).toUpperCase()}`) : '-'}
                                                                                </span>
                                                                                <span className={`text-[8px] font-bold leading-none ${opp1Val > 0 ? 'text-green-500' : 'text-red-500 opacity-40'}`}>{opp1Val >= 999 ? 'MAX' : `${opp1Val}pt`}</span>
                                                                            </div>
                                                                        </td>
                                                                        {is3Way && (
                                                                            <td className="py-3 px-4 text-center">
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-white/40 font-bold text-xs leading-none mb-0.5">
                                                                                        {opp2Card ? (opp2Card.specialType || `${opp2Card.rank}${opp2Card.suit?.charAt(0).toUpperCase()}`) : '-'}
                                                                                    </span>
                                                                                    <span className={`text-[8px] font-bold leading-none ${opp2Val > 0 ? 'text-green-500' : 'text-red-500 opacity-40'}`}>{opp2Val >= 999 ? 'MAX' : `${opp2Val}pt`}</span>
                                                                                </div>
                                                                            </td>
                                                                        )}
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                        <tfoot>
                                                            <tr className="bg-purple-500/10 font-mono">
                                                                <td className="py-4 px-4 text-left text-purple-400 font-black text-[9px] tracking-widest uppercase">TOTAL ROUND SCORE</td>
                                                                <td className="py-4 px-4 text-center text-purple-400 font-black text-base drop-shadow-[0_0_10px_rgba(168,85,247,0.3)]">{youTotal >= 999 ? 'MAX' : youTotal}</td>
                                                                <td className="py-4 px-4 text-center text-white/30 font-bold text-base">{opp1Total >= 999 ? 'MAX' : opp1Total}</td>
                                                                {is3Way && <td className="py-4 px-4 text-center text-white/10 font-bold text-base">{opp2Total >= 999 ? 'MAX' : opp2Total}</td>}
                                                            </tr>
                                                        </tfoot>
                                                    </table>
                                                </motion.div>
                                            );
                                        })()}

                                        <div className="flex flex-col gap-4 py-4 border-y border-white/10">
                                            <div className="flex justify-between items-center gap-2">
                                                <div className="text-left">
                                                    <p className="text-[9px] text-gray-500 uppercase mb-1 font-mono">Individual Duel</p>
                                                    <p className={`text-sm sm:text-base font-bold ${isPureWin ? 'text-purple-400' : isDraw ? 'text-yellow-400' : 'text-red-500'}`}>
                                                        {isPureWin ? "+200" : isDraw ? "0" : (hasPenalty ? "-200" : "-100")} <span className="text-[8px] opacity-40">CR</span>
                                                    </p>
                                                </div>
                                                <div className="text-center px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl max-w-[200px]">
                                                    <p className="text-[7px] text-purple-400/80 uppercase font-mono tracking-widest font-bold">Reason</p>
                                                    <p className="text-[9px] sm:text-[10px] text-purple-200 font-black uppercase tracking-wider leading-tight">
                                                        {dynamicReason}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[9px] text-gray-400 uppercase mb-1 font-bold tracking-widest font-mono">Net Visa Adjust</p>
                                                    <p className={`text-lg sm:text-xl font-black ${netAdjust > 0 ? 'text-green-400' : isDraw ? 'text-yellow-400' : 'text-red-400'}`}>
                                                        {netAdjust > 0 ? '+' : ''}{netAdjust}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center pt-2 border-t border-white/5">
                                                <span className="text-[9px] text-gray-500 uppercase tracking-widest">Protocol Balance</span>
                                                <span className="text-sm font-black text-white">{displayBalance} <span className="text-[9px] text-gray-600">CR</span></span>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* UI CLEANUP: Redundant Header Removed */}

            {/* MAIN GAME AREA */}
            <main className="flex-1 overflow-y-auto p-2 sm:p-4 pt-36 sm:pt-40 pb-56 relative z-10 flex flex-col items-center">

                {/* PHASE INDICATOR */}
                <div className="mb-4 text-center px-4" >
                    <motion.div
                        key={gameState?.phase}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-2"
                    >
                        {gameState?.phase !== 'dealing' && (
                            <>
                                <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-widest font-mono">
                                    {gameState?.phase === 'slotting' ? "DEPLOYMENT PHASE" :
                                        gameState?.phase === 'evaluation' ? "COMBAT RESOLUTION" :
                                            gameState?.phase === 'shuffle' ? "TABLE ASSIGNMENTS" :
                                                gameState?.phase?.toUpperCase()}
                                </h2>
                                <p className="text-purple-500/40 text-xs font-mono uppercase tracking-[0.3em]">
                                    {gameState?.phase === 'slotting' ? "ARRANGE YOUR 5-SLOT BATTLE ARRAY" :
                                        gameState?.phase === 'shuffle' ? "CONNECTING PARTICIPANTS TO BATTLE STATIONS" :
                                            "AWAITING SYSTEM UPDATE"}
                                </p>
                            </>
                        )}
                    </motion.div>

                    {/* POWERS & INTELLIGENCE UI - Deployment & Picking Phases */}
                    {(gameState?.phase === 'slotting' || gameState?.phase === 'picking') && (
                        <>
                            {/* PLAYER STATUS DISPLAY BOX (LEFT MIDDLE) */}
                            {/* Desktop Full View (1280px+) */}
                            <motion.div
                                initial={{ x: -100, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                className="hidden xl:flex fixed left-4 xl:left-8 top-1/2 -translate-y-1/2 z-40 w-52 xl:w-60 flex-col gap-3 px-4 py-6 bg-black/80 border border-white/10 rounded-2xl backdrop-blur-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] border-glow-purple"
                            >
                                <div className="flex items-center gap-2 pb-4 border-b border-white/10">
                                    <Activity size={16} className="text-purple-500 animate-pulse" />
                                    <h3 className="text-[10px] font-display font-black text-purple-400 uppercase tracking-[0.4em]">Tactical Table Intelligence</h3>
                                </div>

                                <div className="flex flex-col gap-2 overflow-y-auto max-h-[40vh] pr-2 custom-scrollbar">
                                    {(() => {
                                        const myGroup = gameState?.participants?.find(p => p.id === user?.id)?.groupId;
                                        const otherGroupMembers = (gameState?.participants || []).filter(p => p.groupId === myGroup && p.id !== user?.id);

                                        if (otherGroupMembers.length === 0) {
                                            return <span className="text-[8px] font-mono text-white/10 uppercase tracking-widest text-center py-4">Searching for unit traces...</span>;
                                        }

                                        return otherGroupMembers.map(opp => (
                                            <div key={opp.id} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex items-center justify-between group hover:border-purple-500/30 transition-all">
                                                <div className="flex flex-col">
                                                    <span className="text-white/80 font-display text-[10px] font-black uppercase tracking-tight">{playerIdMap[opp.id] || opp.username}</span>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        {opp.isZombie && (
                                                            <span className="text-[6px] font-black text-red-500 uppercase tracking-widest bg-red-500/10 px-1 py-0.5 rounded-sm">ZOMBIE</span>
                                                        )}
                                                        {opp.status === 'eliminated' && (
                                                            <span className="text-[6px] font-black text-orange-500 uppercase tracking-widest bg-orange-500/10 px-1 py-0.5 rounded-sm">OFFLINE</span>
                                                        )}
                                                    </div>
                                                </div>
                                                {detectorActive && opponentHandCounts[opp.id] !== undefined ? (
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-emerald-400 font-mono text-lg font-black leading-none">{opponentHandCounts[opp.id]}</span>
                                                        <span className="text-[6px] text-white/20 font-black uppercase tracking-widest">ASSETS</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-end opacity-40 group-hover:opacity-100 transition-opacity">
                                                        <Scan size={14} className="text-white/40 group-hover:text-purple-500" />
                                                        <span className="text-[6px] text-white/20 font-black uppercase tracking-[0.1em] mt-1">NO_UPLINK</span>
                                                    </div>
                                                )}
                                            </div>
                                        ));
                                    })()}
                                </div>

                                <div className="mt-2 pt-4 border-t border-white/5">
                                    <span className="text-[7px] font-mono text-white/10 uppercase tracking-[0.4em] animate-pulse">Scanning unit proximity...</span>
                                </div>
                            </motion.div>

                            {/* Mobile Icon Button for Table Intelligence (< 1280px) */}
                            <div className="xl:hidden fixed left-2 top-24 z-50">
                                <button
                                    onClick={() => {
                                        const myGroup = gameState?.participants?.find(p => p.id === user?.id || (user?.username && p.username?.toLowerCase() === user.username.toLowerCase()))?.groupId;
                                        const otherGroupMembers = (gameState?.participants || []).filter(p => p.groupId === myGroup && p.id !== user?.id);
                                        
                                        const infoLines = otherGroupMembers.map(opp => {
                                            const name = playerIdMap[opp.id] || opp.username || opp.id;
                                            const badges = [
                                                opp.isZombie ? 'ZOMBIE' : '',
                                                opp.status === 'eliminated' ? 'OFFLINE' : ''
                                            ].filter(Boolean).join(' | ');
                                            const badgeStr = badges ? ` [${badges}]` : '';

                                            if (detectorActive && opponentHandCounts[opp.id] !== undefined) {
                                                return `${name}${badgeStr}: ${opponentHandCounts[opp.id]} ASSETS`;
                                            } else {
                                                return `${name}${badgeStr}: NO UPLINK (Detector Required)`;
                                            }
                                        });

                                        const message = infoLines.length > 0 
                                            ? infoLines.join('\n\n') 
                                            : "Scanning unit proximity...\nNo opponent units detected in range.";

                                        triggerAlert("TACTICAL TABLE INTELLIGENCE", message);
                                    }}
                                    className="p-2 bg-black/80 border border-purple-500/40 rounded-full text-purple-400 shadow-lg backdrop-blur-md active:scale-95 transition-all"
                                    title="Unit Info"
                                >
                                    <Info size={16} />
                                </button>
                            </div>

                            {/* POWERS UI BOX (RIGHT MIDDLE - ICON ONLY ON SCREENS < 1280px) */}
                            <motion.div
                                initial={{ x: 50, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                className="fixed right-2 xl:right-4 top-24 xl:top-1/2 xl:-translate-y-1/2 z-50 flex flex-col gap-2 p-1.5 xl:p-3 bg-black/80 border border-purple-500/30 rounded-2xl backdrop-blur-md shadow-lg"
                            >
                                <div className="hidden xl:flex flex-col items-center gap-0.5 text-center pb-2 border-b border-white/10">
                                    <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest">TACTICAL ASSETS</span>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={handleRefreshHand}
                                        title="Refresh Array"
                                        disabled={gameState?.phase !== 'slotting' || powerUsage.hasUsedRefresh || isLocked}
                                        className={`group relative flex items-center justify-center p-2 xl:p-2.5 rounded-xl border transition-all duration-300 ${gameState?.phase !== 'slotting' || powerUsage.hasUsedRefresh || isLocked ? 'bg-white/5 border-white/5 opacity-40 cursor-not-allowed' : 'bg-purple-900/20 border-purple-500/30 hover:bg-purple-500 hover:border-purple-400 hover:shadow-[0_0_15px_#a855f7]'}`}
                                    >
                                        <Activity size={16} className={gameState?.phase !== 'slotting' || powerUsage.hasUsedRefresh || isLocked ? 'text-white/20' : 'text-purple-400 group-hover:text-black'} />
                                        <span className={`hidden xl:inline mt-1 text-[8px] font-black uppercase tracking-wider ${gameState?.phase !== 'slotting' || powerUsage.hasUsedRefresh || isLocked ? 'text-white/20' : 'text-purple-400 group-hover:text-black'}`}>
                                            {powerUsage.hasUsedRefresh ? "VOID" : "REFRESH"}
                                        </span>
                                    </button>

                                    <button
                                        onClick={handleUseDetector}
                                        title="Engage Detector"
                                        disabled={gameState?.phase !== 'slotting' || powerUsage.hasUsedDetector || isLocked}
                                        className={`group relative flex items-center justify-center p-2 xl:p-2.5 rounded-xl border transition-all duration-300 ${gameState?.phase !== 'slotting' || powerUsage.hasUsedDetector || isLocked ? 'bg-white/5 border-white/5 opacity-40 cursor-not-allowed' : 'bg-emerald-900/20 border-emerald-500/30 hover:bg-emerald-500 hover:border-emerald-400 hover:shadow-[0_0_15px_#10b981]'}`}
                                    >
                                        <Scan size={16} className={gameState?.phase !== 'slotting' || powerUsage.hasUsedDetector || isLocked ? 'text-white/20' : 'text-emerald-400 group-hover:text-black'} />
                                        <span className={`hidden xl:inline mt-1 text-[8px] font-black uppercase tracking-wider ${gameState?.phase !== 'slotting' || powerUsage.hasUsedDetector || isLocked ? 'text-white/20' : 'text-emerald-400 group-hover:text-black'}`}>
                                            {powerUsage.hasUsedDetector ? "DEPLETED" : "DETECTOR"}
                                        </span>
                                    </button>
                                </div>
                            </motion.div>
                        </>
                    )}
                </div >

                {/* SHUFFLE / TABLE VIEW - Personalized Only */}
                {
                    gameState?.phase === 'shuffle' && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="w-full max-w-2xl px-4"
                        >
                            {(() => {
                                const meInState = gameState.participants.find(p => p.id === user?.id || (user?.username && p.username?.toLowerCase() === user.username.toLowerCase()));
                                const myGroup = meInState?.groupId;
                                const groupMembers = myGroup ? gameState.participants.filter(p => p.groupId === myGroup && p.status === 'active') : [];

                                if (!myGroup) return (
                                    <div className="p-12 text-center bg-black/40 border border-white/5 rounded-[40px] backdrop-blur-xl">
                                        <div className="w-12 h-12 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mx-auto mb-6" />
                                        <p className="text-purple-500/40 font-mono text-sm tracking-[0.3em] uppercase">Recalibrating Table Vectors...</p>
                                    </div>
                                );

                                return (
                                    <div className="p-10 border border-purple-500/30 bg-purple-900/10 rounded-[3rem] backdrop-blur-xl relative overflow-hidden group hover:border-purple-500/50 transition-all duration-500">
                                        {/* Background Effects */}
                                        <div className="absolute inset-0 bg-[linear-gradient(to_right,#16161a_1px,transparent_1px),linear-gradient(to_bottom,#16161a_1px,transparent_1px)] bg-[size:20px_20px] opacity-10 pointer-events-none" />
                                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <Swords size={96} className="text-purple-500" />
                                        </div>

                                        <h3 className="text-purple-500 font-display text-xs tracking-[0.5em] mb-8 flex items-center gap-4">
                                            <div className="w-2.5 h-2.5 bg-purple-500 rounded-full animate-pulse shadow-[0_0_15px_#a855f7]" />
                                            PROTOCOL UNIT: {myGroup}
                                        </h3>

                                        <div className="space-y-6">
                                            {groupMembers.map(m => {
                                                const isMe = m.id === user?.id || (user?.username && m.username?.toLowerCase() === user.username.toLowerCase());
                                                return (
                                                    <div key={m.id} className="flex items-center gap-6 group/item">
                                                        <div className={`w-4 h-4 rounded-full transition-all duration-500 ${isMe ? 'bg-purple-400 shadow-[0_0_15px_#a855f7] scale-110' : 'bg-white/10'}`} />
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-3">
                                                                <span className={`font-display text-4xl leading-none uppercase tracking-tighter transition-colors ${isMe ? 'text-white font-black' : 'text-white/20'}`}>
                                                                    {(() => {
                                                                        if (isMe && user?.username && !user.username.startsWith('Player #') && !user.username.startsWith('#PLAYER_')) {
                                                                            return user.username;
                                                                        }
                                                                        if (m.username && !m.username.startsWith('Player #') && !m.username.startsWith('#PLAYER_')) {
                                                                            return m.username;
                                                                        }
                                                                        return m.username || 'AGENT';
                                                                    })()}
                                                                </span>
                                                                {isMe && (
                                                                    m.isZombie ? (
                                                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/20 border border-red-500/50 rounded-full">
                                                                            <Biohazard size={12} className="text-red-500" />
                                                                            <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">ZOMBIE</span>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 border border-emerald-500/50 rounded-full">
                                                                            <Shield size={12} className="text-emerald-500" />
                                                                            <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">SURVIVOR</span>
                                                                        </div>
                                                                    )
                                                                )}
                                                            </div>
                                                            {detectorActive && opponentHandCounts[m.id] !== undefined && !isMe && (
                                                                <span className="text-[10px] font-mono text-emerald-400/60 uppercase tracking-widest mt-1">
                                                                    Detected Assets: {opponentHandCounts[m.id]} Units
                                                                </span>
                                                            )}
                                                            {isMe && (
                                                                <span className="text-[10px] font-mono text-purple-500/60 tracking-[0.3em] uppercase mt-1">Target ID</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="mt-12 pt-8 border-t border-white/5">
                                            <span className="text-[10px] text-orange-500 font-black uppercase tracking-[0.4em] flex items-center gap-3">
                                                <AlertTriangle size={14} />
                                                {groupMembers.length === 3 ? "TRIPLE CONFLICT STANDBY" : "BATTLE PROTOCOL READY"}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })()}
                        </motion.div>
                    )
                }

                {/* DEALING VIEW */}
                {
                    gameState?.phase === 'dealing' && (
                        <div className="flex flex-col items-center gap-12 mt-4 w-full max-w-5xl">
                            <motion.div
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                className="bg-black/40 border border-white/10 p-8 sm:p-12 rounded-[40px] backdrop-blur-xl text-center w-full relative overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.5)]"
                            >
                                {/* Animated Background Pulse */}
                                <motion.div
                                    animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
                                    transition={{ duration: 3, repeat: Infinity }}
                                    className="absolute inset-0 bg-purple-500/5 blur-3xl rounded-full"
                                />

                                <div className="w-full relative z-10 flex flex-wrap items-center justify-center gap-2 sm:gap-6 px-2 py-4 max-w-full mx-auto">
                                    {(() => {
                                        const meInState = findMyParticipant(gameState.participants || [], user);
                                        const cardsToDisplay = (meInState?.cards && meInState.cards.length > 0) ? meInState.cards : (myHand.length > 0 ? myHand : generateFreshHandForPlayer(meInState?.id || user?.id || 'player'));

                                        if (cardsToDisplay.length === 0) {
                                            return (
                                                <div className="py-8 flex flex-col items-center justify-center gap-4">
                                                    <div className="w-10 h-10 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
                                                    <p className="text-purple-400 font-mono text-xs uppercase tracking-[0.3em] font-black">DISPENSING TACTICAL ASSETS...</p>
                                                </div>
                                            );
                                        }

                                        return (
                                            <AnimatePresence>
                                                {cardsToDisplay.map((card: any, idx: number) => (
                                                    <motion.div
                                                        key={card.id}
                                                        initial={{
                                                            opacity: 0,
                                                            scale: 0.2,
                                                            rotateX: 90,
                                                            rotateY: 90,
                                                            y: 100,
                                                            z: -500
                                                        }}
                                                        animate={{
                                                            opacity: 1,
                                                            scale: 1,
                                                            rotateX: 0,
                                                            rotateY: 0,
                                                            y: 0,
                                                            z: 0
                                                        }}
                                                        whileHover={{
                                                            scale: 1.1,
                                                            rotateY: 15,
                                                            rotateX: 5,
                                                            z: 50,
                                                            transition: { duration: 0.3 }
                                                        }}
                                                        transition={{
                                                            delay: idx * 0.15,
                                                            type: "spring",
                                                            stiffness: 80,
                                                            damping: 15
                                                        }}
                                                        className="perspective-1000 mb-6"
                                                    >
                                                        <div className="absolute -inset-2 bg-purple-500/10 blur-xl opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                                                        <CardVisual card={card} />
                                                    </motion.div>
                                                ))}
                                            </AnimatePresence>
                                        );
                                    })()}
                                </div>

                                {myHand.length === 5 && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 1 }}
                                        className="mt-6 flex items-center justify-center gap-3 text-purple-500 text-[10px] font-black tracking-[0.4em] uppercase relative z-10"
                                    >
                                        <CheckCircle2 size={16} className="animate-pulse" />
                                        SYSTEM AUTHORIZED :: PROCEED TO DEPLOYMENT
                                    </motion.div>
                                )}
                            </motion.div>
                        </div>
                    )
                }

                {/* BATTLE ARRAY (SLOTS) - Gated to relevant phases */}
                {
                    ['slotting', 'evaluation', 'picking', 'scoring'].includes(gameState?.phase || '') && (
                        <div className="mb-6 w-full max-w-5xl">
                            {/* SLOT DISPLAY (MY ARRAY) */}
                            <div className="flex justify-center gap-3 sm:gap-6">
                                {gameState?.phase === 'picking' ? null : (

                                    mySlots.map((slot, i) =>
                                        <motion.div
                                            key={`slot-${i}`}
                                            ref={el => { slotRefs.current[i] = el; }}
                                            initial={false}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className={`
                                            relative w-[52px] h-[78px] xs:w-16 xs:h-24 sm:w-24 sm:h-36 rounded-xl border-2 flex items-center justify-center transition-all duration-300 shrink-0
                                            ${slot
                                                    ? 'border-purple-500 bg-purple-900/20 shadow-[0_0_20px_rgba(168,85,247,0.2)]'
                                                    : 'border-white/10 bg-white/5 hover:border-white/20'
                                                }
                                            ${gameState?.phase === 'slotting' && !slot && !isLocked ? 'hover:bg-purple-500/10 hover:border-purple-500/50' : ''}
                                        `}
                                        >
                                            {slot ? (
                                                <>
                                                    <CardVisual card={slot} size="full" />
                                                    {gameState?.phase === 'slotting' && !isLocked && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleUnslotCard(i); }}
                                                            className="absolute -top-3 -right-3 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white shadow-[0_0_20px_rgba(220,38,38,0.5)] hover:bg-red-500 hover:scale-110 transition-all z-[60] animate-in zoom-in spin-in"
                                                        >
                                                            <X size={16} strokeWidth={3} />
                                                        </button>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center gap-1.5 opacity-10 group-hover:opacity-30 transition-opacity text-center w-full h-full">
                                                    <div className="w-6 h-6 rounded-full border border-purple-500/30 border-t-purple-500 animate-[spin_3s_linear_infinite]" />
                                                    <span className="text-[7px] font-black uppercase tracking-widest text-purple-500">Signal...</span>
                                                </div>
                                            )}
                                        </motion.div>
                                    )
                                )}
                            </div>

                            {/* TABLE INTELLIGENCE - Moved to HUD box */}

                            {/* PICKING VIEW */}
                            {gameState?.phase === 'picking' && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mt-8 space-y-10 w-full max-w-7xl mx-auto px-4"
                                >
                                    {(gameState.round_data?.winners?.includes(user?.id) || gameState.round_data?.winners?.includes(myPlayer?.id)) ? (
                                        /* WINNER VIEW */
                                        <div className={`
                                            ${opponentSlots.length === 1 ? 'flex justify-center' : 'grid grid-cols-1 lg:grid-cols-2'} 
                                            gap-6 w-full pr-4 scrollbar-thin scrollbar-thumb-black
                                        `}>


                                            {opponentSlots.map(opp => {
                                                const displaySlots = (opp.slots.length > 0)
                                                    ? opp.slots
                                                    : (gameState.round_data?.fallback_cards?.[opp.playerId] || []);

                                                if (displaySlots.length === 0) return null;

                                                return (
                                                    <div key={opp.playerId} className="relative group p-6 sm:p-8 border border-white/10 bg-black/40 rounded-[35px] backdrop-blur-xl hover:border-purple-500/40 transition-all duration-500 shadow-2xl overflow-hidden">
                                                        <div className="flex items-center gap-4 mb-6">
                                                            <div className="w-2 h-2 bg-purple-500 rounded-full shadow-[0_0_10px_#a855f7]" />
                                                            <h4 className="font-display text-purple-400 text-[10px] uppercase tracking-[0.4em] font-black">
                                                                {opp.username || playerIdMap[opp.playerId] || "AGENT"} :: Neutralized
                                                            </h4>
                                                        </div>
                                                        <div className="flex flex-wrap justify-center gap-4">
                                                            {/* USER REQUEST: Show non-special slotted cards (special cards cannot be picked) */}
                                                            {displaySlots.filter((s: any) => s !== null && s.type !== 'special' && !s.specialType).map((card: any) => {
                                                                const isSelected = selectedSteal?.card.id === card.id;
                                                                return (
                                                                    <motion.div
                                                                        key={card.id}
                                                                        drag={!hasPicked}
                                                                        dragSnapToOrigin
                                                                        dragElastic={0.2}
                                                                        whileDrag={{ scale: 1.15, zIndex: 100, boxShadow: "0 20px 40px rgba(168,85,247,0.5)" }}
                                                                        whileHover={!hasPicked ? { y: -10, scale: 1.05 } : {}}
                                                                        onDragEnd={(e, info) => handlePickingDragEnd(e, info, opp.playerId, card)}
                                                                        className={`relative group/card rounded-xl p-1 transition-all ${!hasPicked ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'} ${isSelected && !hasPicked ? 'bg-purple-500/20 ring-2 ring-purple-500 shadow-[0_0_20px_#a855f7]' : ''}`}
                                                                        onClick={() => !hasPicked && handleStealCard(opp.playerId, card)}
                                                                    >
                                                                        {isSelected && !hasPicked && (
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); setSelectedSteal(null); }}
                                                                                className="absolute -top-3 -right-3 w-8 h-8 bg-black border-2 border-purple-500 rounded-full flex items-center justify-center text-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.4)] hover:bg-purple-500 hover:text-white hover:scale-110 transition-all z-[60] animate-in zoom-in spin-in"
                                                                            >
                                                                                <X size={14} strokeWidth={3} />
                                                                            </button>
                                                                        )}
                                                                        <div>
                                                                            <CardVisual card={card} size="small" />
                                                                        </div>
                                                                        {!isSelected && !hasPicked && (
                                                                            <div className="absolute inset-x-0 -bottom-6 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-all">
                                                                                <div className="bg-purple-500 text-black px-4 py-1.5 rounded-full font-display font-black text-[8px] uppercase tracking-widest">
                                                                                    Select
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </motion.div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        /* LOSER / SPECTATOR VIEW BOX - SMALLER */
                                        <div className="flex flex-col items-center justify-center py-12 bg-black/40 border border-white/5 rounded-[40px] backdrop-blur-3xl w-full max-w-4xl mx-auto">
                                            <div className="mb-6 relative">
                                                <div className="absolute -inset-8 bg-purple-500/10 blur-3xl rounded-full" />
                                                <Biohazard size={48} className="text-purple-500/80 animate-pulse" />
                                            </div>
                                            <h3 className="font-display text-xl font-black text-white uppercase tracking-[0.3em] mb-2 text-center">Under Extraction</h3>
                                            <p className="text-purple-400/40 font-display text-[9px] uppercase tracking-widest mb-8 text-center px-8">Winners are harvesting assets from your tactical array</p>

                                            <div className="flex flex-wrap justify-center gap-4 px-4">
                                                {mySlots.map((c, i) => c && (
                                                    <div key={i} className="opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
                                                        <CardVisual card={c} size="small" />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {(gameState.round_data?.winners?.includes(user?.id) || gameState.round_data?.winners?.includes(myPlayer?.id)) && (
                                        <div className="flex flex-col items-center gap-4 pb-12">
                                            {hasPicked ? (
                                                <div className="flex flex-col items-center gap-4">
                                                    <div className="flex items-center gap-3 px-8 py-4 bg-purple-500 text-black rounded-full font-display font-black text-xs uppercase tracking-[0.3em] shadow-[0_0_30px_#a855f7]">
                                                        <CheckCircle2 size={18} />
                                                        Extraction Finalized
                                                    </div>
                                                    <span className="text-[9px] font-mono text-white/30 uppercase tracking-[0.4em] animate-pulse">Waiting for other survivors to conclude asset harvest...</span>
                                                </div>

                                            ) : (
                                                <div className="flex flex-col items-center gap-6">
                                                    {selectedSteal ? (
                                                        <div className="flex flex-col items-center gap-2 transition-all duration-500">
                                                            <button
                                                                onClick={() => executeSteal()}
                                                                className="flex items-center gap-3 px-8 py-4 bg-purple-500 text-black border-2 border-purple-500 rounded-full font-display font-black text-xs uppercase tracking-[0.3em] shadow-[0_0_20px_#a855f7] hover:scale-105 transition-all animate-pulse"
                                                            >
                                                                <Check size={18} strokeWidth={3} />
                                                                Confirm Extraction
                                                            </button>
                                                            <span className="text-[8px] font-mono text-purple-400 uppercase tracking-[0.4em]">Target Acquired</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-2 opacity-30 grayscale hover:opacity-100 transition-all duration-500">
                                                            <div className="flex items-center gap-3 px-8 py-4 border-2 border-purple-500/20 text-purple-500/40 rounded-full font-display font-black text-[10px] uppercase tracking-[0.3em] animate-pulse">
                                                                Select Asset for Immediate Extraction
                                                            </div>
                                                            <span className="text-[8px] font-mono text-white/10 uppercase tracking-[0.4em]">Protocol: Direct Uplink</span>
                                                        </div>
                                                    )}

                                                    <button
                                                        onClick={() => { setHasPicked(true); setOpponentSlots([]); }}
                                                        className="px-16 py-5 bg-white/[0.03] border border-white/5 rounded-full font-display text-[10px] font-black tracking-[0.5em] text-white/40 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all uppercase group"
                                                    >
                                                        <span className="flex items-center gap-4">
                                                            Pass Extraction
                                                            <X size={16} className="text-purple-500/50 group-hover:text-purple-500 group-hover:rotate-90 transition-all" />
                                                        </span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </div>
                    )
                }

                {/* HAND AREA - Gated to relevant phases */}
                {
                    ['slotting', 'evaluation', 'scoring'].includes(gameState?.phase || '') && gameState?.phase !== 'idle' && (
                        <div className="w-full mt-3 flex flex-col items-center">
                            {/* Label Section */}
                            <div className="w-full max-w-6xl px-4 flex items-center justify-center gap-6 mb-2">
                                <span className="text-[10px] font-display font-black text-white/20 uppercase tracking-[0.5em] flex items-center gap-3">
                                    <Swords size={14} className="text-purple-500/50" />
                                    Tactical Assets Available :: {myHand.filter(c => !mySlots.some(s => s?.id === c.id)).length}
                                </span>
                            </div>

                            {/* Cards Container - Vertical Wrapped Rows on Mobile, Centered Flex on Desktop */}
                            <div
                                ref={handScrollerRef}
                                className="w-full max-w-6xl mx-auto overflow-y-auto max-h-[45vh] sm:max-h-none sm:overflow-x-auto custom-scrollbar pb-6 pt-2 mt-1 relative z-[30] bg-black/5 pointer-events-auto px-2 sm:px-12"
                                style={{ WebkitOverflowScrolling: 'touch' }}
                            >
                                <div className="flex flex-wrap justify-center items-center gap-2.5 sm:gap-4 lg:gap-5 px-1 sm:px-4 py-2 w-full max-w-full sm:w-fit mx-auto">
                                    <AnimatePresence mode="popLayout">
                                        {myHand.map(card => {
                                            const isSlotted = mySlots.some(s => s?.id === card.id);
                                            if (isSlotted) return null;

                                            return (
                                                <motion.div
                                                    key={card.id}
                                                    drag={!isLocked && gameState?.phase === 'slotting'}
                                                    dragSnapToOrigin
                                                    dragListener={!isLocked}
                                                    onDragEnd={(e, info) => handleDragEnd(e, info, card)}
                                                    whileDrag={{ scale: 1.1, zIndex: 100, boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}
                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.5 }}
                                                    whileHover={{ y: -10, scale: 1.05, zIndex: 10 }}
                                                    className={`shrink-0 ${isLocked ? "opacity-50 grayscale cursor-not-allowed" : "cursor-grab active:cursor-grabbing"}`}
                                                    onClick={() => {
                                                        if (gameState?.phase !== 'slotting' || isLocked) return;
                                                        const emptyIdx = mySlots.findIndex(s => s === null);
                                                        if (emptyIdx !== -1) handleSlotCard(card, emptyIdx);
                                                    }}
                                                >
                                                    <CardVisual card={card} />
                                                </motion.div>
                                            );
                                        })}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* ACTION BUTTON */}
                <AnimatePresence>
                    {gameState?.phase === 'slotting' && (
                        <motion.div
                            initial={{ y: 100, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 100, opacity: 0 }}
                            className="fixed bottom-8 left-0 right-0 flex justify-center z-[500] pointer-events-none"
                        >
                            <div className="relative group/container pointer-events-auto">
                                <button
                                    onClick={handleConfirmSlots}
                                    disabled={isLocked || (mySlots.filter(s => s !== null).length === 5 && powerUsage.hasUsedFiveSlots)}
                                    className={`group relative px-6 py-3 sm:px-16 sm:py-5 font-black uppercase tracking-[0.12em] sm:tracking-[0.2em] text-xs sm:text-sm overflow-hidden transition-all duration-500 ${isLocked || (mySlots.filter(s => s !== null).length === 5 && powerUsage.hasUsedFiveSlots) ? 'bg-gray-800 cursor-not-allowed opacity-50' : 'bg-purple-600 hover:bg-purple-400 shadow-[0_0_30px_rgba(168,85,247,0.3)] hover:shadow-[0_0_50px_rgba(168,85,247,0.6)] text-black'}`}
                                    style={{ clipPath: 'polygon(10% 0, 100% 0, 90% 100%, 0% 100%)' }}
                                >
                                    {/* Scanner Sweep Effect */}
                                    <motion.div
                                        animate={{ left: ["-100%", "200%"] }}
                                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                        className="absolute top-0 bottom-0 w-8 bg-white/40 blur-xl skew-x-12 pointer-events-none"
                                    />

                                    <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                                    <span className="relative flex items-center gap-4">
                                        {isLocked ? "ASSETS LOCKED" : (mySlots.filter(s => s !== null).length === 5 && powerUsage.hasUsedFiveSlots) ? "5-SLOT LIMIT REACHED" : "AUTHORIZE DEPLOYMENT"}
                                        {isLocked || (mySlots.filter(s => s !== null).length === 5 && powerUsage.hasUsedFiveSlots) ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
                                    </span>
                                </button>

                                {isLocked && (
                                    <button
                                        onClick={() => setIsLocked(false)}
                                        className="absolute -top-3 -right-3 w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-white shadow-[0_0_20px_rgba(220,38,38,0.6)] hover:bg-red-500 hover:scale-110 transition-all z-[60] group/undo border-2 border-white/20"
                                        title="OVERRIDE LOCK"
                                    >
                                        <X size={20} className="group-hover/undo:rotate-90 transition-transform" />
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main >
            {
                showPlayerCard && (
                    <PlayerCardModal
                        user={user}
                        onClose={() => setShowPlayerCard(false)}
                    />
                )
            }

            {/* HIGH-TECH ALERT MODAL CARD */}
            <AnimatePresence>
                {alertModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[5000] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-6"
                        onClick={() => setAlertModal(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.85, y: 30, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ scale: 0.85, y: 30, opacity: 0 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="max-w-[92vw] sm:max-w-md w-full bg-zinc-950 border border-purple-500/40 p-5 sm:p-8 rounded-[24px] sm:rounded-[32px] shadow-[0_0_60px_rgba(168,85,247,0.3)] text-center relative overflow-hidden space-y-4 sm:space-y-6 max-h-[85vh] flex flex-col justify-between"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Background ambient glow */}
                            <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

                            {/* Top Diamond Icon */}
                            <div className="relative inline-block shrink-0">
                                <div className="absolute inset-0 bg-purple-500/20 blur-2xl rounded-full animate-pulse" />
                                <div className="w-10 h-10 sm:w-14 sm:h-14 bg-purple-950/60 border border-purple-500/40 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                                    <Gem size={22} className="text-purple-400 sm:w-7 sm:h-7" />
                                </div>
                            </div>

                            {/* Title & Message */}
                            <div className="space-y-2 sm:space-y-3 overflow-y-auto custom-scrollbar px-1 max-h-[50vh]">
                                <h2 className="text-xs sm:text-base font-black font-cinzel text-white uppercase tracking-[0.2em] sm:tracking-[0.25em] drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]">
                                    {alertModal.title}
                                </h2>
                                <div className="h-px w-16 bg-gradient-to-r from-transparent via-purple-500/40 to-transparent mx-auto" />
                                <p className="text-gray-300 font-mono text-[11px] sm:text-xs leading-relaxed uppercase tracking-wider whitespace-pre-line pt-1">
                                    {alertModal.message}
                                </p>
                            </div>

                            {/* Confirm Button */}
                            <button
                                onClick={() => setAlertModal(null)}
                                className="w-full py-3 sm:py-4 bg-gradient-to-r from-purple-900/40 via-purple-700/40 to-purple-900/40 hover:from-purple-600 hover:to-purple-500 border border-purple-500/50 text-purple-200 hover:text-black font-mono font-black uppercase tracking-[0.2em] sm:tracking-[0.25em] rounded-xl sm:rounded-2xl transition-all duration-300 shadow-lg active:scale-95 text-[10px] sm:text-xs shrink-0"
                            >
                                + ACKNOWLEDGE
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* HOLOGRAPHIC TOAST SYSTEM */}
            <div className="fixed bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 z-[10000] flex flex-col gap-2.5 pointer-events-none w-[92vw] max-w-sm sm:max-w-lg px-2 items-center">
                <AnimatePresence>
                    {protocolToasts.map(toast => (
                        <motion.div
                            key={toast.id}
                            initial={{ opacity: 0, y: 20, scale: 0.9, filter: 'blur(10px)' }}
                            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, scale: 0.8, filter: 'blur(10px)' }}
                            className={`w-full px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-xl border backdrop-blur-3xl flex items-center gap-3 sm:gap-4 shadow-[0_0_30px_rgba(0,0,0,0.95)] bg-zinc-950 ${toast.type === 'error' ? 'border-red-500 text-red-100' :
                                toast.type === 'success' ? 'border-emerald-500/80 text-emerald-300' :
                                    'border-purple-500/80 text-purple-300'
                                }`}
                            style={{ clipPath: 'polygon(3% 0, 100% 0, 97% 100%, 0% 100%)' }}
                        >
                            <div className={`w-1.5 h-6 sm:h-8 shrink-0 ${toast.type === 'error' ? 'bg-red-500' : toast.type === 'success' ? 'bg-emerald-500' : 'bg-purple-500'} animate-pulse shadow-[0_0_15px_currentColor]`} />
                            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                <span className="text-[7px] sm:text-[8px] font-mono opacity-50 uppercase tracking-[0.3em]">Protocol Notification</span>
                                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider font-mono leading-tight break-words text-left">
                                    {toast.message}
                                </span>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div >
    );
};

const BriefingCard: React.FC<{ title: string; desc: string; delay: number; id?: string; color?: 'purple' | 'green' | 'orange' | 'cyan' | 'red' }> = ({ title, desc, delay, id, color = 'cyan' }) => {
    const colorClasses = {
        cyan: 'from-purple-500/10 to-indigo-500/10 border-purple-500/20 text-purple-500',
        purple: 'from-purple-500/10 to-indigo-500/10 border-purple-500/20 text-purple-500',
        green: 'from-emerald-500/10 to-teal-500/10 border-emerald-500/20 text-emerald-500',
        orange: 'from-orange-500/10 to-red-500/10 border-orange-500/20 text-orange-500',
        red: 'from-red-500/10 to-rose-500/10 border-red-500/20 text-red-500'
    };

    const mainColorMap = {
        cyan: 'purple',
        purple: 'purple',
        green: 'emerald',
        orange: 'orange',
        red: 'red'
    };

    const mainColor = mainColorMap[color as keyof typeof mainColorMap];

    return (
        <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay }}
            whileHover={{ y: -5, scale: 1.01 }}
            className="w-full sm:w-48 xl:w-56 group relative"
        >
            <div className={`relative p-4 sm:p-6 border ${colorClasses[color as keyof typeof colorClasses]} bg-black/90 backdrop-blur-xl group-hover:bg-black/80 transition-all flex flex-col items-center justify-center min-h-[220px] sm:min-h-[320px] shadow-2xl rounded-xl sm:rounded-none`}
            >
                {/* Visual tech line across top */}
                <div className={`absolute top-0 left-0 right-0 h-[1px] bg-${mainColor}-500/30 opacity-20 group-hover:opacity-100 transition-opacity`} />

                {/* ID Label */}
                <div className="absolute top-3 left-4 right-4 sm:top-4 sm:left-6 sm:right-6 flex items-center justify-between opacity-40 group-hover:opacity-100 transition-opacity">
                    <span className="text-[6px] font-black uppercase tracking-[0.2em] font-mono text-white">X-RAY STREAM</span>
                    <span className="text-[7px] font-mono text-white tracking-widest leading-none">
                        {id || Math.random().toString(16).substring(2, 8).toUpperCase()}
                    </span>
                </div>

                {/* Central Iconography */}
                <div className="relative mb-3 sm:mb-8 mt-3 sm:mt-0 group-hover:scale-110 transition-transform duration-500">
                    <div className={`absolute inset-0 bg-${mainColor}-500/10 blur-xl rounded-full scale-125`} />
                    <div className={`relative p-2.5 sm:p-4 border border-white/5 bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]} rounded-xl`}>
                        {color === 'purple' && <Biohazard size={20} className="text-purple-400 sm:w-6 sm:h-6" />}
                        {color === 'red' && <Biohazard size={20} className="text-red-400 sm:w-6 sm:h-6" />}
                        {color === 'green' && <Syringe size={20} className="text-emerald-400 sm:w-6 sm:h-6" />}
                        {color === 'orange' && <Skull size={20} className="text-orange-400 sm:w-6 sm:h-6" />}
                        {color === 'cyan' && <Shield size={20} className="text-purple-400 sm:w-6 sm:h-6" />}
                    </div>
                </div>

                <h4 className={`font-cinzel text-xs sm:text-sm uppercase tracking-[0.15em] mb-1.5 sm:mb-2.5 text-white text-center leading-none`}>
                    {title}
                </h4>

                <div className={`h-[1px] w-6 bg-${mainColor}-500/40 mb-2 sm:mb-3.5 rounded-full`} />

                <p className="text-[9px] sm:text-[10px] font-cinzel text-gray-400 group-hover:text-white/80 leading-relaxed font-semibold uppercase tracking-[0.04em] text-center px-1">
                    {desc}
                </p>

                {/* Technical lines at bottom */}
                <div className="absolute bottom-3 left-4 right-4 sm:bottom-4 sm:left-6 sm:right-6 flex items-center gap-1 opacity-20 group-hover:opacity-100 transition-opacity">
                    <div className={`flex-1 h-[1px] bg-${mainColor}-500/30`} />
                    <div className={`w-1 h-1 rounded-full bg-${mainColor}-400`} />
                    <div className={`w-1 h-1 rounded-full bg-${mainColor}-400/50`} />
                </div>
            </div>
        </motion.div>
    );
};

const TerminalBox: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
    <div className="relative group flex flex-col h-full rounded-2xl border border-white/5 bg-[#0a0a0f]/50 backdrop-blur-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-2">
                <span className="text-purple-500">{icon}</span>
                <span className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">{title}</span>
            </div>
            <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
            </div>
        </div>
        <div className="p-6 flex-1">
            {children}
        </div>
    </div>
);

// --- VISUAL COMPONENTS ---

function CardVisual({ card, size = 'default' }: { card: DiamondsCard; size?: 'default' | 'small' | 'mini' | 'full' }) {
    const imgSrc = getCardImagePath(card);

    // Special Cards
    if (card.type === 'special') {
        let borderColor = 'border-gray-500';
        let glow = '';

        if (card.specialType === 'zombie') {
            borderColor = 'border-purple-500';
            glow = 'shadow-[0_0_30px_rgba(168,85,247,0.3)]';
        }
        if (card.specialType === 'injection') {
            borderColor = 'border-green-500';
            glow = 'shadow-[0_0_30px_rgba(34,197,94,0.3)]';
        }
        if (card.specialType === 'shotgun') {
            borderColor = 'border-orange-500';
            glow = 'shadow-[0_0_30px_rgba(249,115,22,0.3)]';
        }

        const sizeClasses = size === 'mini' ? 'w-14 h-20' : size === 'small' ? 'w-20 h-28' : size === 'full' ? 'w-full h-full' : 'w-20 h-28 sm:w-24 sm:h-36';
        return (
            <div className={`${sizeClasses} rounded-2xl border-2 ${borderColor} ${glow} flex flex-col items-center justify-center relative overflow-hidden bg-black group`}>

                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent z-10 opacity-30" />
                <img
                    src={imgSrc}
                    alt={card.specialType}
                    className="w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 shadow-[inset_0_0_40px_rgba(0,0,0,0.8)] pointer-events-none" />
            </div>
        );
    }

    // Standard Cards
    const sizeClasses = size === 'mini' ? 'w-14 h-20' : size === 'small' ? 'w-20 h-28' : size === 'full' ? 'w-full h-full' : 'w-20 h-28 sm:w-24 sm:h-36';
    return (
        <div className={`${sizeClasses} rounded-2xl border border-white/20 flex flex-col items-center justify-center relative overflow-hidden bg-white shadow-2xl group transition-all duration-300 hover:shadow-purple-500/20`}>
            <img
                src={imgSrc}
                alt={`${card.rank} of ${card.suit}`}
                className="w-full h-full object-cover transform transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 border-2 border-black/5 rounded-xl pointer-events-none" />
        </div>
    );
}
