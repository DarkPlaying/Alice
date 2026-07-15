# ClubsGame.tsx Structure

```
40: const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q'];
42: export const ClubsGame = ({ onComplete, onFail, user, onProfileClick }: ClubsGameProps) => {
44: const isMaster = user?.role?.toLowerCase() === 'master' || user?.role?.toLowerCase() === 'admin';
50: // Game Flow State
59: // Refs for synchronization stability
60: const roundRef = useRef(round);
61: const gameStateRef = useRef(gameState);
62: useEffect(() => { roundRef.current = round; }, [round]);
63: useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
65: // Selection & Voting
73: const MAX_VOTES = 2;
75: // Enhanced Score Tracking
81: // Points Table State
84: // Hint Cards State (Tactical Intel)
87: useEffect(() => {
89: const targets = masterSelection;
90: const otherCards = cards.filter(c =>
96: // True Random Decoy Selection (Shuffle then Pick)
97: const shuffledOthers = [...otherCards].sort(() => Math.random() - 0.5);
98: const randoms = shuffledOthers.slice(0, 2);
100: const combinedIds = [
106: // True Random Display Order
107: const finalHintList = [...combinedIds].sort(() => Math.random() - 0.5);
114: // Player ID Mapping (UID → #PLAYER_XXX)
117: const allowedPlayersRef = useRef<string[]>([]);
118: useEffect(() => { allowedPlayersRef.current = allowedPlayers; }, [allowedPlayers]);
120: // Chat
123: const chatEndRef = useRef<HTMLDivElement>(null);
124: const channelRef = useRef<RealtimeChannel | null>(null);
127: // Identification
130: // TOAST STATE
133: const showToast = useCallback((message: string, type: 'success' | 'warning' | 'error' | 'info' = 'info') => {
138: // Initialize Board Logic
139: const initializeBoard = useCallback((_currentRound: number, currentCards: Card[]) => {
140: const expectedSuffix = _currentRound >= 4 ? '-2' : '-1';
142: // Check if current cards match the expected set (Set 1 vs Set 2)
153: // Fallback: Generate cards based on Round
154: // Rounds 1-3: Set 1 (-1)
155: // Rounds 4-6: Set 2 (-2)
156: const suffix = _currentRound >= 4 ? '-2' : '-1';
169: // --- SCORE INTEGRITY CHECK (Watcher) ---
170: // Fixes the issue where a player syncs with a default 0 score from the Master/DB
171: // but actually has a different score in their profile.
172: const hasCorrectedScoreRef = useRef(false);
174: useEffect(() => {
175: const syncPlayerScore = async () => {
191: // Fetch latest status to get current scores object
193: const currentScores = latestStatus?.scores || { current: {}, history: {}, start: {} };
194: const myUid = (user?.id as string) || '';
198: const newScores = {
204: // Update game's status in database
222: // Helper: Update Detailed Scores
223: const updateScoreState = useCallback((status: any) => {
224: // --- 1. Hydrate Allowed Players List (Whitelist) ---
230: const currentScores = status.scores.current;
232: const myUid = (user?.id as string) || '';
234: // Get my own score - TOTAL ACCUMULATED POINTS
236: const current = Number(currentScores[myUid]) || 0;
243: // Calculate Tops
244: let maxPScore = -Infinity;
245: let maxPId = '';
246: let maxMScore = -Infinity;
248: // USE WHITELIST for Player Identification
249: const playerIds = new Set((status.allowed_players || allowedPlayersRef.current || []).map((id: any) => String(id)));
258: const s = Number(currentScores[uid]) || 0;
259: const isPlayer = playerIds.has(uid);
264: // This is a PLAYER
270: // This is a MASTER or non-whitelisted user
281: // Use calculated scores (trust our whitelist-based calculation)
282: // Only fall back to DB if we have no score data at all
287: // No player scores found, try DB fallback
288: const dbHighP = status.scores?.high_player;
296: const dbHighM = status.scores?.high_master;
300: // Fallback if no scores object
302: const ps = Number(status.player_score) || 0;
312: // --- SELF-PERSISTENCE (BACKUP) ---
313: // Ensure player score is saved to profile when game ends.
314: const hasPersistedRef = useRef(false);
316: useEffect(() => {
317: // Only run if game is over (won/lost) and we haven't persisted yet
326: const saveScore = async () => {
329: // Fetch FRESH Visa Points using EMAIL (profiles table uses email as key)
330: // Profile fetch remaining for safety, but data unused in absolute paste
342: // freshVisa removed (unused in absolute pasting logic)
345: // Fetch the START score from game status to calculate delta
352: // Fetch the final calculated score from the Master's update
353: const finalScoresObj = gameStatus?.scores || {};
354: const finalCurrentScores = finalScoresObj.current || {};
355: // startScoresObj removed
357: const myUid = (user?.id as string) || '';
358: const myGameTotal = Number(finalCurrentScores[myUid]) || myScore;
360: // PASTE LOGIC: The new balance IS the final absolute game score (HUD value).
361: const newTotal = myGameTotal;
388: // Reset persistence lock if game restarts
394: // --- SELECTION HYDRATION (Prevent Overwrite) ---
395: // Only load selection from DB if we haven't touched it yet (or on fresh load).
396: const hasHydratedSelectionRef = useRef(false);
397: // Reset hydration flag on round change
398: useEffect(() => {
402: const phase1VotesRef = useRef(phase1Votes);
403: useEffect(() => { phase1VotesRef.current = phase1Votes; }, [phase1Votes]);
405: useEffect(() => {
406: // Hydrate from phase1Votes (which comes from DB)
407: const myId = (user?.id as string) || user?.username || 'PLAYER';
409: // Only hydrate if local selection is empty to be safe
418: // Fetch Player IDs from profiles table
419: useEffect(() => {
420: const fetchPlayerIds = async () => {
426: // Sort users to match Admin Dashboard logic
428: // 1. Force Admin/Game Master to ALWAYS be the first element
429: const isMasterA = a.role === 'master' || a.role === 'admin' || a.username === 'admin';
430: const isMasterB = b.role === 'master' || b.role === 'admin' || b.username === 'admin';
435: // 2. Sort remaining players by Join Date (Oldest to Newest)
436: const timeA = a.createdAt?.seconds || a.createdAt?.toMillis?.() || 0;
437: const timeB = b.createdAt?.seconds || b.createdAt?.toMillis?.() || 0;
442: const mapping: Record<string, string> = {};
446: const globalId = (index + 1).toString().padStart(3, '0');
447: const pid = `#PLAYER_${globalId}`;
448: const displayName = u.username || u.email?.split('@')[0] || pid;
464: // Initial Load
465: useEffect(() => {
466: const verifyAccessAndSync = async () => {
470: // Fixed: Calculate detailed scores on initial load
473: // CRITICAL: Check for force reset on initial load
480: // Sync State (Move up for timer logic)
481: const serverState = statusData.gameState || 'setup_phase1';
484: // Sync Fix: Check round_data if column is null
485: const phaseExpirySource = statusData.phase_expiry || statusData.round_data?.phase_expiry;
489: // Fallback check matching Master
490: let expiryDate = null;
491: const now = new Date();
504: // Sync removed cards
505: const removed = statusData.removed_cards_p || [];
507: let init: Card[] = [];
509: // Load from DB if available (Random 26 Deck Mode)
513: // Fallback
520: // Sync Player Selection (Fix for Reloading)
525: // Sync Master Locked status (if Master has selected)
530: // Sync Player Selection (Consensus)
534: // Sync Master Selection
549: // (Redundant useEffect removed: state clearing is handled by postgres_changes round sync)
550: // Realtime Management
551: useEffect(() => {
552: const fetchMessages = async () => {
562: const chronologicalMessages = [...data].reverse();
575: const channel = supabase.channel('clubs_king_game', {
582: const newMsg = payload.new;
595: const status = payload.new;
597: // CRITICAL: Check for force reset
606: // Sync Fix: Check round_data if column is null, fallback to local default
607: const phaseExpirySource = status.phase_expiry !== undefined ? status.phase_expiry : status.round_data?.phase_expiry;
608: let expiryDate: Date | null = null;
613: // Explicitly cleared in database
618: const now = new Date();
628: // Force immediate update of timeLeft
629: const now = new Date();
630: const diff = Math.floor((expiryDate.getTime() - now.getTime()) / 1000);
634: // Sync Game State
638: // FALLBACK: If we entered evaluation (round_reveal) but missed the broadcast
639: // Ensure results are hydrated if available in DB
646: // Sync Round
649: // FORCE RESET Local State on Round Change
650: // setIsSubmitted(false); // Variable removed
651: // DON'T reset selection if player_selection exists in DB (auto-selected cards)
662: const init = initializeBoard(status.current_round, prev);
663: const removed = status.removed_cards_p || [];
667: // Reset
671: // Enhanced Score Tracking
674: // Sync Selections (Individual)
677: const selections = status.round_data.phase1_selections;
680: // Sync MY selection from DB on load (if exists)
681: // CRITICAL FIX: Only overwrite local selection if it's empty (fresh load)
682: // This prevents DB latency from reverting my active choices while I'm clicking.
684: // Note: Logic moved to dedicated hydration effect (hasHydratedSelectionRef)
685: // This block now only syncs phase1Votes which is correct.
689: // Sync Final Consensus (Overrides individual)
690: // IMPORTANT: Always sync player_selection from DB, especially during selection_reveal
703: // Sync In-Game Votes (Late Joiner Fix)
707: // Optional: If empty in DB and empty locally, keep empty
711: // Real-time Deck Sync & Removal
713: let activeDeck = prev;
717: const removed = status.removed_cards_p || [];
725: // REMOVED: timer_sync listener - was causing glitches
726: // Each client now calculates their own countdown from phaseExpiry
728: const payload = p.payload;
732: // Sync scores from broadcast - PREFER currentScores map for accuracy
733: // myId removed (unused)
737: // Use the centralized helper to update Detailed Scores (HUD)
743: // setScore removed (causes ReferenceError)
745: // Fallback to generic player score (legacy)
747: // setScore removed (causes ReferenceError)
752: const payload = p.payload || {};
753: const finalScores = payload.finalScores;
755: const myUid = (user?.id as string) || '';
756: const scoresMap = finalScores as Record<string, number>;
757: const myFinalScore = scoresMap[myUid] !== undefined ? Number(scoresMap[myUid]) : myScore;
764: // Players see other players' votes
774: // Players usually shouldn't see Master's live hunting?
785: return () => { supabase.removeChannel(channel); };
788: // Force Sync Selection on Phase Change to Player Selection
789: useEffect(() => {
790: const syncSelection = async () => {
791: // If we are in a locked phase, we MUST have the global consensus
802: // Chat Auto-Scroll
803: useEffect(() => {
807: // Timer Logic
808: useEffect(() => {
811: const timer = setInterval(() => {
815: const now = new Date();
816: const diff = Math.floor((phaseExpiry.getTime() - now.getTime()) / 1000);
822: return () => clearInterval(timer);
826: // Actions
827: const handleCardClick = async (cardId: string) => {
835: // PHASE 1: SELECTION (Consensus)
838: const card = cards.find(c => c.id === cardId);
841: // Optimistic Update (No Side Effects in Setter)
842: let next = { ...selection }; // Use current selection
843: const isAngel = selection.angel === cardId;
844: const isDemon = selection.demon === cardId;
856: // Both are filled, overwrite Angel
863: // Execute Side Effects Async
868: // PHASE 2: VOTING (Hunting)
871: const card = cards.find(c => c.id === cardId);
874: // Toggle Vote
875: let newVotes = [...myVote];
884: // Broadcast Vote
885: const myId = (user?.id as string) || user?.username || 'PLAYER';
894: // Note: Votes are ephemeral and counted by Master, but we should also rely on server state if possible.
895: // For this implementation, we broadcast and let Master/Server aggregate.
896: // Locally we update display immediately.
902: // If we reach here, gameState doesn't match any phase
906: // --- SELF-PERSISTENCE (BACKUP) ---
907: // In case Master fails, Player persists their own score on Win/Loss
909: const submitPhase1Selection = async (sel: { angel: string | null; demon: string | null }) => {
911: const myId = (user?.id as string) || user?.username || 'PLAYER';
922: const sendMessage = async (e?: React.FormEvent) => {
926: const senderName = user?.username || 'PLAYER';
927: const tempContent = inputMessage;
942: // Optionally revert proper optimistically or show toast
953: return (
954: <div className="relative w-full h-full bg-[#050508] flex flex-col font-sans overflow-hidden">
959: <div className="text-center space-y-4">
992: <div className="max-w-4xl mx-auto text-center space-y-4 sm:space-y-8 p-4 sm:p-8 pt-20 sm:pt-8">
996: <div className="h-0.5 sm:h-1 w-32 sm:w-64 mx-auto bg-gradient-to-r from-transparent via-green-500 to-transparent" />
997: <div className="space-y-4 sm:space-y-6 text-white/80 font-mono">
1019: <div className="px-4 py-3 sm:px-8 sm:py-2 border-b border-white/5 flex flex-col sm:flex-row justify-center items-center bg-white/[0.01] z-[110] gap-4 sm:gap-0 relative">
1029: <div className="flex items-center gap-4 sm:gap-8 w-full sm:w-auto justify-center">
1030: <div className="flex items-center gap-4 sm:gap-8 border-l-0 sm:border-l border-white/10 pl-0 sm:pl-8 w-full justify-around sm:justify-start">
1032: <div className="text-center min-w-[40px]">
1037: <div className="w-px h-6 bg-white/10" />
1040: <div className="text-center min-w-[70px] sm:min-w-[100px]">
1042: <div className="flex flex-col items-center leading-none">
1048: <div className="w-px h-6 bg-white/10" />
1051: <div className="text-center min-w-[40px]">
1056: <div className="w-px h-6 bg-white/10" />
1059: <div className="text-center min-w-[40px]">
1064: <div className="w-px h-6 bg-white/10" />
1067: <div className="text-center min-w-[60px]">
1069: <div className="flex items-center justify-center gap-1">
1079: <div className="flex-1 flex flex-col sm:flex-row overflow-hidden relative z-10">
1082: <div className="flex-1 overflow-y-auto p-4 sm:p-8 scrollbar-hide relative bg-black/40">
1086: <div className="max-w-6xl mx-auto mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 sm:gap-0 px-4 sm:px-0">
1087: <div className="space-y-1 w-full sm:w-auto">
1088: <div className="flex items-center justify-between sm:justify-start gap-4">
1098: <div className="sm:hidden flex items-center gap-2 bg-red-600/20 px-3 py-1.5 rounded border border-red-500/30 shadow-[0_0_15px_rgba(220,38,38,0.2)]">
1114: <div className="flex flex-wrap items-center gap-2 sm:gap-4">
1115: <div className={`relative px-3 py-2 sm:px-4 sm:py-3 rounded-lg border transition-all duration-300 ${selection.angel ? 'border-yellow-500/50 bg-yellow-500/10 shadow-[0_0_15px_rgba(234,179,8,0.1)]' : 'border-white/5 bg-white/[0.02]'} text-center min-w-[80px] sm:min-w-[100px]`}>
1116: <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-yellow-500/30 to-transparent" />
1121: <div className={`relative px-3 py-2 sm:px-4 sm:py-3 rounded-lg border transition-all duration-300 ${selection.demon ? 'border-red-500/50 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'border-white/5 bg-white/[0.02]'} text-center min-w-[80px] sm:min-w-[100px]`}>
1122: <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />
1128: <div className="hidden sm:block h-8 w-px bg-white/5 mx-2" />
1130: <div className={`px-3 py-2 sm:px-4 sm:py-3 rounded-lg border transition-all duration-300 ${masterLocked ? 'border-red-500/30 bg-red-500/5 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'border-white/5 bg-white/[0.02]'} text-center min-w-[100px] sm:min-w-[120px]`}>
1132: <div className="flex items-center justify-center gap-2">
1147: <div className="flex justify-center mb-8 px-4">
1155: <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-500/10 to-transparent h-[200%] -translate-y-full group-hover:animate-scan-slow pointer-events-none" />
1157: <div className="flex items-center justify-between w-full z-10 px-2">
1158: <div className="flex items-center gap-2">
1159: <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)] animate-pulse" />
1165: <div className="flex gap-3 z-10">
1167: const card = cards.find(c => c.id === hId);
1168: const rank = card?.rank || '?';
1169: const suit = card?.suit || 'clubs';
1170: const symbol = suit === 'hearts' ? '♥' : suit === 'diamonds' ? '♦' : suit === 'spades' ? '♠' : '♣';
1171: const color = (suit === 'hearts' || suit === 'diamonds') ? 'text-red-500' : 'text-white';
1173: return (
1174: <div key={hId} className="w-12 h-16 rounded-xl bg-white/[0.04] border border-white/10 flex flex-col items-center justify-center shadow-2xl transition-all duration-500 hover:border-purple-500/60 hover:bg-white/[0.08] hover:scale-110 group/card">
1182: <div className="w-full h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />
1184: <div className="flex flex-col items-center gap-1 z-10">
1194: <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-4 max-w-6xl mx-auto">
1198: const isSelectedAngel = selection.angel === card.id;
1199: const isSelectedDemon = selection.demon === card.id;
1200: const isMasterAngel = masterSelection.angel === card.id;
1201: const isMasterDemon = masterSelection.demon === card.id;
1202: const isVoted = myVote.includes(card.id);
1204: // Visual State
1205: let ringColor = 'border-white/10 opacity-60 hover:opacity-100';
1206: let glow = '';
1208: // Dim others during reveal
1209: // Dim if NOT selected by anyone
1210: const isDimmed = gameState === 'selection_reveal' && !isSelectedAngel && !isSelectedDemon && !isMasterAngel && !isMasterDemon;
1216: // Phase 1 Visuals (Identity) - Angel/Demon glow overrides dimming
1225: // MASTER REVEAL HIGHLIGHTS (Overrides Player)
1226: // MASTER REVEAL HIGHLIGHTS (Overrides Player)
1227: // User Request: Reveal only in card_reveal (after voting)
1233: // Phase 2 Visuals (Voting) - Only for non-identity cards or if we want hybrid
1240: // Phase 3 Visuals (Revealed)
1242: // Show Master's Roles & Player Roles
1249: return (
1269: <div className="absolute inset-0 flex items-center justify-center bg-green-500/10 backdrop-blur-[1px]">
1270: <div className="bg-green-500 text-black text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1">
1276: <div className="absolute top-2 right-2 z-30">
1278: const myId = (user?.id as string) || user?.username || 'PLAYER';
1279: const effectiveVotes = { ...globalVotes, [myId]: myVote };
1280: const count = Object.values(effectiveVotes).filter(votes => votes.includes(card.id)).length;
1283: <div className="w-5 h-5 rounded-full bg-blue-500 text-white font-bold flex items-center justify-center text-[10px] shadow-lg border border-white/20">
1295: <div className="absolute top-2 right-2 flex flex-col gap-1 items-end z-30">
1298: const myId = (user?.id as string) || user?.username || 'PLAYER';
1299: const effectiveVotes = { ...phase1Votes, [myId]: selection };
1300: const angelCount = Object.values(effectiveVotes).filter(v => v.angel === card.id).length;
1303: <div className="px-1.5 py-0.5 rounded bg-yellow-500 text-black font-bold text-[8px] shadow-lg border border-white/20 min-w-[16px] text-center">
1311: const myId = (user?.id as string) || user?.username || 'PLAYER';
1312: const effectiveVotes = { ...phase1Votes, [myId]: selection };
1313: const demonCount = Object.values(effectiveVotes).filter(v => v.demon === card.id).length;
1316: <div className="px-1.5 py-0.5 rounded bg-red-600 text-white font-bold text-[8px] shadow-lg border border-white/20 min-w-[16px] text-center">
1327: <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1">
1347: <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-16 lg:gap-20 max-w-full scale-[0.65] sm:scale-85 lg:scale-90 origin-top sm:origin-center lg:origin-center pb-24 lg:pb-0 mt-8 sm:mt-0">
1349: <div className="space-y-8 sm:space-y-6 flex flex-col items-center">
1351: <div className="flex gap-4 sm:gap-4 justify-center">
1354: const card = cards.find(c => c.id === masterSelection?.angel);
1356: return (
1357: <div className="relative w-32 sm:w-40 aspect-[2/3] rounded-xl border-2 sm:border-4 border-yellow-500 shadow-[0_0_40px_rgba(234,179,8,0.4)]">
1359: <div className="absolute -bottom-3 sm:-bottom-4 left-1/2 -translate-x-1/2 bg-yellow-500 text-black px-3 sm:px-4 py-1 font-black text-[10px] sm:text-xs uppercase tracking-widest rounded-full whitespace-nowrap shadow-xl">MASTER ANGEL</div>
1365: const card = cards.find(c => c.id === masterSelection?.demon);
1367: return (
1368: <div className="relative w-32 sm:w-40 aspect-[2/3] rounded-xl border-2 sm:border-4 border-red-600 shadow-[0_0_40px_rgba(220,38,38,0.4)]">
1370: <div className="absolute -bottom-3 sm:-bottom-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-3 sm:px-4 py-1 font-black text-[10px] sm:text-xs uppercase tracking-widest rounded-full whitespace-nowrap shadow-xl">MASTER DEMON</div>
1378: <div className="hidden sm:block h-64 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent" />
1379: <div className="sm:hidden w-64 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-12" />
1382: <div className="flex flex-col items-center gap-8 sm:gap-6">
1384: <div className="flex gap-2 sm:gap-6 justify-center">
1387: const card = cards.find(c => c.id === selection.angel);
1389: return (
1390: <div className="relative w-28 sm:w-40 aspect-[2/3] rounded-xl border-2 sm:border-4 border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.4)]">
1392: <div className="absolute -bottom-3 sm:-bottom-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-2 sm:px-4 py-0.5 sm:py-1 font-black text-[10px] sm:text-xs uppercase tracking-widest rounded-full whitespace-nowrap">YOUR ANGEL</div>
1398: const card = cards.find(c => c.id === selection.demon);
1400: return (
1401: <div className="relative w-28 sm:w-40 aspect-[2/3] rounded-xl border-2 sm:border-4 border-purple-600 shadow-[0_0_30px_rgba(147,51,234,0.4)]">
1403: <div className="absolute -bottom-3 sm:-bottom-4 left-1/2 -translate-x-1/2 bg-purple-600 text-white px-2 sm:px-4 py-0.5 sm:py-1 font-black text-[10px] sm:text-xs uppercase tracking-widest rounded-full whitespace-nowrap">YOUR DEMON</div>
1411: <div className="absolute bottom-12 text-center text-white/40 font-mono animate-pulse">
1427: <div className="max-w-4xl mx-auto space-y-6">
1428: <div className="flex items-center justify-between border-b border-white/10 pb-4">
1432: <div className="space-y-3">
1441: <div className="space-y-1">
1445: <div className="text-right">
1456: <div className="pt-6 border-t border-white/5 flex justify-between items-end">
1457: <div className="space-y-1">
1461: <div className="text-right">
1473: <div className="hidden sm:flex sm:w-80 sm:h-full bg-[#0A0A0E] sm:border-l border-white/10 flex-col">
1474: <div className="p-3 border-b border-white/10 bg-[#0F0F13]">
1477: <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
1479: <div className="text-center mt-10 opacity-30">
1484: <div key={msg.id} className="relative group">
1485: <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-white/20 group-hover:bg-green-500/50 transition-colors" />
1486: <div className="pl-3 py-1">
1496: <div ref={chatEndRef} />
1499: <div className="relative">
1512: <div className="p-3 border-t border-white/10 bg-[#050508] font-mono">
1514: <div className="space-y-1">
1534: <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white">
1550: <div className="p-4 pt-6 pb-4 border-b border-white/10 bg-black/90 backdrop-blur-md flex items-center justify-between sticky top-0 z-10">
1561: <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
1563: <div key={msg.id} className={`flex flex-col ${msg.user === user?.username ? 'items-end' : 'items-start'}`}>
1564: <div className={`px-4 py-2 rounded-xl text-xs font-mono max-w-[90%] ${msg.user === user?.username ? 'bg-green-600/20 border border-green-600/50 text-green-100' : 'bg-white/10 border border-white/20 text-gray-200'}`}>
1572: <div ref={chatEndRef} />
1606: <div className="max-w-4xl w-full mx-4 text-center space-y-6 pb-20 sm:pb-32">
1609: const playerWins = topPlayerScore > topMasterScore;
1610: const masterWins = topMasterScore > topPlayerScore;
1611: return (
1614: <div className="space-y-2">
1618: <div className={`h-1 w-64 mx-auto bg-gradient-to-r ${playerWins ? 'from-transparent via-green-500 to-transparent' : masterWins ? 'from-transparent via-red-500 to-transparent' : 'from-transparent via-white to-transparent'} opacity-70`} />
1627: <div className="flex flex-col sm:grid sm:grid-cols-3 gap-4 sm:gap-6 w-full max-w-4xl px-4 sm:px-0 scrollbar-hide">
1629: <div className={`p-4 sm:p-8 rounded-xl border-2 ${playerWins ? 'border-green-500 bg-green-500/10 shadow-[0_0_30px_rgba(34,197,94,0.3)]' : 'border-white/20 bg-white/5'}`}>
1639: <div className="p-4 sm:p-8 rounded-xl border-2 border-blue-500 bg-blue-500/10">
1649: <div className={`p-4 sm:p-8 rounded-xl border-2 ${masterWins ? 'border-red-500 bg-red-500/10 shadow-[0_0_30px_rgba(239,68,68,0.3)]' : 'border-white/20 bg-white/5'}`}>
1660: <div className="bg-white/5 border-2 border-white/10 rounded-xl p-6">
1662: <div className="grid grid-cols-3 gap-4 text-center">
1663: <div>
1667: <div>
1671: <div>
1702: <div className="text-center space-y-6 max-w-md px-8">
1703: <div className="mx-auto w-24 h-24 rounded-full border-4 border-red-500 flex items-center justify-center animate-pulse">
1708: <div className="space-y-2">
1712: <div className="h-px w-48 mx-auto bg-gradient-to-r from-transparent via-red-500 to-transparent" />
1714: <div className="space-y-3">
1725: <div className="pt-4">
1740: <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

```

# ClubsGameMaster.tsx Structure

```
31: const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q']; // No King
33: // Helper: Generate Clubs 24 Cards (Set 1: A-Q, Set 2: A-Q)
34: const generateRandomDeck = () => {
35: // Set 1: Clubs A-Q
36: const set1: Card[] = RANKS.map(rank => ({
46: // Set 2: Clubs A-Q
47: const set2: Card[] = RANKS.map(rank => ({
57: // Shuffle each set independently
58: const shuffle = (deck: Card[]) => {
60: const j = Math.floor(Math.random() * (i + 1));
66: const shuffledSet1 = shuffle(set1);
67: const shuffledSet2 = shuffle(set2);
69: // Return combined (Set 1 active first, Set 2 reserve)
73: export const ClubsGameMaster = ({ onComplete, user, isEngine = false }: ClubsGameMasterProps) => {
75: const gameStateRef = useRef(gameState);
76: useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
82: // Detailed Score Tracking
88: // Points Table State
96: const sendMessage = async (e?: React.FormEvent) => {
99: const senderName = user?.username || 'MASTER';
100: const tempContent = inputMessage;
121: // Selection & Voting
127: // Individual Master Voting
134: const MAX_ROUNDS = 6; // 6 Rounds * 4 Cards/Round = 24 Cards
135: const channelRef = useRef<RealtimeChannel | null>(null);
136: const chatEndRef = useRef<HTMLDivElement>(null);
138: const isProcessing = useRef(false);
140: // Score Refs (for Timer access)
141: const playerScoreRef = useRef(playerScore);
143: const masterScoreRef = useRef(masterScore);
146: // Vote Refs
147: const playersVotesRef = useRef<Record<string, string[]>>({});
149: const masterVotesRef = useRef<Record<string, string[]>>({});
152: // Helper: Identify if a UID belongs to a Master
153: const isMasterUid = (uid: string) => {
155: const upper = uid.toUpperCase();
164: // Player ID Mapping (UID → #PLAYER_XXX)
167: // Hint Cards State
170: useEffect(() => {
172: const targets = playerSelection;
173: const otherCards = cards.filter(c =>
179: // True Random Decoy Selection (Shuffle then Pick)
180: const shuffledOthers = [...otherCards].sort(() => Math.random() - 0.5);
181: const randoms = shuffledOthers.slice(0, 2);
183: const combinedIds = [
189: // True Random Display Order
190: const finalHintList = [...combinedIds].sort(() => Math.random() - 0.5);
195: // Only re-run if round or selection changes, NOT on every render/timer tick
198: // Fetch Player ID Mapping from Firestore
199: useEffect(() => {
200: const fetchPlayerIds = async () => {
206: // Sort users: Admins first, then by Join Date
208: const isMasterA = a.role === 'master' || a.role === 'admin' || a.username === 'admin' || a.username?.toLowerCase().includes('architect');
209: const isMasterB = b.role === 'master' || b.role === 'admin' || b.username === 'admin' || b.username?.toLowerCase().includes('architect');
214: const timeA = a.createdAt?.seconds || a.createdAt?.toMillis?.() || 0;
215: const timeB = b.createdAt?.seconds || b.createdAt?.toMillis?.() || 0;
219: const mapping: Record<string, string> = {};
221: const pid = `#PLAYER_${(index + 1).toString().padStart(3, '0')} `;
222: const displayName = user.username || user.email?.split('@')[0] || pid;
237: // --- SCORE INTEGRITY CHECK (Master) ---
238: // Fixes the issue where Master syncs with a default 0 score from the DB
239: // but actually has a different score in their profile.
240: const hasCorrectedScoreRef = useRef(false);
242: useEffect(() => {
243: const checkIntegrity = async () => {
246: // Only run if we haven't corrected yet
250: // Check if current start scores are missing or 0
257: const startScores = latestState?.scores?.start || {};
258: const currentStartScore = Number(startScores[user.uid] || 0);
273: // Force update the DB with correct start AND current scores
274: const newStartScores = { ...startScores, [user.uid]: profile.visa_points };
275: const currentScores = latestState?.scores?.current || {};
276: const newCurrentScores = { ...currentScores, [user.uid]: profile.visa_points };
301: // Run check after a short delay to ensure auth is ready and initial sync happened
302: const timer = setTimeout(checkIntegrity, 2000);
303: return () => clearTimeout(timer);
306: // Timer Sync
309: // Detailed Score Helper
310: const updateDetailedScores = useCallback((status: any) => {
312: const currentScores = status.scores.current;
314: // Update All Scores for Points Table
317: // const myUid = (user?.id as string) || ''; // Unused variable removed
319: // Update My Score (as Master)
320: const myUId = user?.uid || user?.id || user?.id;
327: // Calculate Tops
328: let maxPScore = -Infinity;
329: let maxPId = '';
330: let maxMScore = -Infinity;
332: // USE WHITELIST for Player Identification
333: const playerIds = new Set(status.allowed_players?.map((id: any) => String(id)) || []);
343: const s = typeof score === 'number' ? score : 0;
344: const isPlayer = playerIds.has(uid);
349: // This is a PLAYER
355: // This is a MASTER or non-whitelisted user
366: // Use calculated scores (trust our whitelist-based calculation)
367: // Only fall back to DB if we have no score data at all
372: // No player scores found, try DB fallback
373: const dbHighP = status.scores?.high_player;
381: const dbHighM = status.scores?.high_master;
385: // Fallback
392: // --- SELF-PERSISTENCE (BACKUP) FOR MASTER ---
393: // Ensure master score is saved to profile when game ends.
394: const hasPersistedRef = useRef(false);
396: // --- FINAL PERSISTENCE (Self-Sync) ---
397: // Mirrors the Player component logic for guaranteed absolute pasting.
398: useEffect(() => {
400: const syncMyProfileScore = async () => {
406: // Fetch finalized totals from database
408: const finalScores = gameStatus?.scores || {};
409: const currentScores = finalScores.current || {};
410: const mUid = user?.uid || user?.id || user?.id;
412: // Absolute Total reached in game (including bonuses)
413: const myFinalTotal = Number(currentScores[mUid || '']) || myScore;
428: // Master Score Initialization - Sync from Profile if 0
429: const hasSyncedScoreRef = useRef(false);
430: useEffect(() => {
431: const syncMasterScore = async () => {
447: // Fetch latest status to get current scores object
449: const currentScores = latestStatus?.scores || { current: {}, history: {}, start: {} };
450: const myUid = (user?.id as string) || 'MASTER';
452: const newScores = {
458: // Update game's status in database
475: // Initial Board Setup
476: const initializeBoard = useCallback((_currentRound: number, currentCards: Card[]) => {
477: const expectedSuffix = _currentRound >= 4 ? '-2' : '-1';
481: // Fallback: Generate based on Round
482: const suffix = _currentRound >= 4 ? '-2' : '-1';
495: // Load Initial State - Fetch Player IDs
496: useEffect(() => {
497: const fetchPlayerIds = async () => {
503: // Sort users to match Admin Dashboard logic
505: // 1. Force Admin/Game Master to ALWAYS be the first element
506: const isMasterA = a.role === 'master' || a.role === 'admin' || a.username === 'admin';
507: const isMasterB = b.role === 'master' || b.role === 'admin' || b.username === 'admin';
512: // 2. Sort remaining players by Join Date (Oldest to Newest)
513: const timeA = a.createdAt?.seconds || a.createdAt?.toMillis?.() || 0;
514: const timeB = b.createdAt?.seconds || b.createdAt?.toMillis?.() || 0;
519: const mapping: Record<string, string> = {};
520: let mCount = 1;
521: let pCount = 1;
524: const isMaster = u.role === 'master' || u.role === 'admin' || u.username === 'admin' || u.username?.toLowerCase().includes('architect');
526: const mid = `#MASTER_${mCount.toString().padStart(3, '0')} `;
531: const pid = `#PLAYER_${pCount.toString().padStart(3, '0')} `;
547: // --- SYNC PLAYER START SCORES (Ensure Game Score = Visa Balance) ---
548: const hasSyncedPlayersRef = useRef(false);
549: useEffect(() => {
550: const syncPlayerScores = async () => {
554: // Check if we need to sync (if start scores are empty or missing for players)
556: const currentStart = statusData?.scores?.start || {};
557: const playerIds: string[] = statusData?.allowed_players?.map((p: any) => String(p)) || [];
559: // Filter IDs that need syncing (not in start scores) -- OR force sync if it looks like 0
560: const idsToSync = playerIds.filter(id => currentStart[id] === undefined || currentStart[id] === 0);
567: // 1. Get Emails from Users
574: const emails = usersData.map(u => u.email);
575: // 2. Get Visa Points from Profiles
582: const newStart = { ...currentStart };
583: const newCurrent = { ...(statusData?.scores?.current || {}) };
584: let updated = false;
587: const profile = profilesData.find(p => p.email === user.email);
589: const points = profile.visa_points || 1000; // Default 1000 if null
590: // Only update if current game score is 0 (to avoid overwriting progress)
591: // OR if we are in early rounds/setup
595: // Initialize current if it's 0/undefined, otherwise keep the delta logic (current = start + delta)
596: // Ideally, if we change start, we should adjust current to maintain the same DELTA?
597: // User Request implies: Game Score SHOULD MATCH Profile.
598: // So we set Current = Points (assuming no gameplay happened yet, or we resync balance)
599: // If mid-game, this is risky. But for "Fix this", we assume the current game score is 'wrong' (0-based).
603: // If they have a score (e.g. 870), and start was 0.
604: // We want to shift the baseline.
605: // Old: Start 0, Current 870. Delta +870.
606: // New: Start 1000. Current ??
607: // If we want Final to be 870. Current must be 870.
608: // New Start 1000. New Current 870. Delta -130.
609: // This effectively "corrects" the Delta history too? No, history is just log.
610: // We just leave Current as is (870) and update Start (1000).
611: // Future Deltas will be calculated from 1000 -> 870.
642: useEffect(() => {
643: const fetchState = async () => {
646: const resolvedState = data.gameState || 'setup_phase1';
653: // CRITICAL: Check for force reset on initial load
660: // Check round_data first if column is missing (Sync Fix)
661: const phaseExpirySource = data.phase_expiry || data.round_data?.phase_expiry;
664: const expiry = new Date(phaseExpirySource);
666: const now = new Date();
667: const diff = Math.floor((expiry.getTime() - now.getTime()) / 1000);
670: // Fallback check using resolvedState
671: let expiryDate = null;
672: const now = new Date();
682: const diff = Math.floor((expiryDate.getTime() - now.getTime()) / 1000);
687: const removed = data.removed_cards_m || [];
691: // Load Active Deck if exists
693: const loadedDeck = data.round_data.decks.active;
710: // RECOVERY: If game is active but no deck exists in DB
713: const fullDeck = generateRandomDeck();
714: const activeDeck = fullDeck.slice(0, 12);
715: const reserveDeck = fullDeck.slice(12, 24);
718: // Update DB
719: const nextRoundData = { ...(data.round_data || {}), decks: { active: activeDeck, reserve: reserveDeck } };
727: // AUTO-START: If system_start is true but gameState is idle, start the game
731: // Generate Random Deck
732: const fullDeck = generateRandomDeck();
733: const activeDeck = fullDeck.slice(0, 12);
734: const reserveDeck = fullDeck.slice(12, 24);
736: const now = new Date();
737: const expiry = new Date(now.getTime() + 60000);  // 60s briefing
761: // Timer & Auto-Advance Logic
762: useEffect(() => {
765: const timer = setInterval(() => {
766: // Don't countdown if game is paused
770: const now = new Date();
771: const diff = Math.floor((phaseExpiry.getTime() - now.getTime()) / 1000);
772: const secondsLeft = Math.max(0, diff);
776: // Admin Engine ONLY: Advance phase when time is up
786: return () => clearInterval(timer);
789: // Subscriptions
790: useEffect(() => {
791: const fetchMessages = async () => {
797: const channel = supabase.channel('clubs_king_game', {
804: const status = payload.new;
807: // CRITICAL: Check for force reset
815: // AUTO-START FROM REALTIME (If admin initiates while master is on page)
818: const fullDeck = generateRandomDeck();
819: const activeDeck = fullDeck.slice(0, 12);
820: const reserveDeck = fullDeck.slice(12, 24);
821: const now = new Date();
822: const expiry = new Date(now.getTime() + 60000);
840: const phaseExpirySource = status.phase_expiry !== undefined ? status.phase_expiry : status.round_data?.phase_expiry;
841: let expiryDate: Date | null = null;
850: const now = new Date();
860: const now = new Date();
861: const diff = Math.floor((expiryDate.getTime() - now.getTime()) / 1000);
867: // Prevent regression: Only update if server round is >= local round
872: const ps = typeof status.player_score === 'number' ? status.player_score : parseInt(status.player_score);
876: const ms = typeof status.master_score === 'number' ? status.master_score : parseInt(status.master_score);
898: // --- SYNC DETAILED SCORES (HUD) ---
900: const currentScores = status.scores.current || {};
901: const mUid = user?.uid || user?.id || user?.id;
903: // Update local Master score
908: // Update Top Scores
945: // Master acts as the central authority to persist these to avoid race conditions
946: // We fetch current, merge, and write back.
947: // Since only Master does this (and we assume 1 master or they race less frequently), it's safer.
949: // Update local state immediately for UI responsiveness
953: const currentData = data?.round_data || {};
954: const currentSelections = currentData.phase1_selections || {};
956: // Only update if changed to save writes? No, safety first.
971: // Players can't see this yet, but we store it if needed
975: // Sync other masters
980: return () => { supabase.removeChannel(channel); };
983: // Chat Auto-Scroll
984: useEffect(() => {
989: // --- ACTION HANDLERS ---
991: const handleCardClick = (cardId: string) => {
993: const card = cards.find(c => c.id === cardId);
997: const isAngel = prev.angel === cardId;
998: const isDemon = prev.demon === cardId;
999: let next = { ...prev };
1013: const card = cards.find(c => c.id === cardId);
1016: // INDIVIDUAL VOTING LOGIC
1017: const myId = (user?.id as string) || 'MASTER'; // Use Auth ID or Fallback
1018: const currentVotes = masterVotes[myId] || [];
1019: let newVotes = [...currentVotes];
1028: const updatedMap = { ...masterVotes, [myId]: newVotes };
1031: // Broadcast Master Vote
1040: const updateMasterSelection = async (sel: any) => {
1042: const currentData = data?.round_data || {};
1054: const now = new Date();
1057: const duration = 60;
1058: const expiry = new Date(now.getTime() + duration * 1000);
1078: // FETCH & AUTO-FILL SELECTIONS
1080: let rData = currentStatus?.round_data || {};
1081: const dbRemoved = currentStatus?.removed_cards_m || [];
1082: let pSel = rData.player_selection || { angel: null, demon: null };
1083: const mSel = rData.master_selection || mySelection || { angel: null, demon: null };
1089: // Helper to get random unpicked card - STRICT VALIDATION
1090: const getAvailableCard = (excludeIds: (string | null)[]) => {
1091: // 1. Get truly removed cards from DB state (Combine ALL removal sources)
1092: const effectivelyRemoved = new Set([
1099: // 2. Filter available cards
1100: const validCards = cards.filter(c =>
1111: const picked = validCards[Math.floor(Math.random() * validCards.length)].id;
1116: // NEW: Calculate Top Votes from Individual Selections
1117: const pSelections = rData.phase1_selections || {};
1118: const angelVotes: Record<string, number> = {};
1119: const demonVotes: Record<string, number> = {};
1126: // Helper to get top card id (with tie-breaking)
1127: const getTopCard = (votesMap: Record<string, number>, excludeIds: (string | null)[]) => {
1128: let maxVotes = -1;
1129: let candidates: string[] = [];
1142: // Tie-Breaker: Randomly pick one of the top voted cards
1148: // Determine Locked Selections
1149: // First lock Angel, then Demon (excluding Angel)
1150: let lockedAngel = getTopCard(angelVotes, []);
1151: let lockedDemon = getTopCard(demonVotes, [lockedAngel]);
1153: // Fallback: If no votes or invalid, pick random available
1155: // If still null (e.g. no available cards?? unlikely), just keep null or try again
1158: // Final Check to ensure we have selections
1163: // Auto-Pick for Master (unchanged)
1170: // NEW: Assign Marks (Roles) to the card objects
1171: const updatedActiveDeck = cards.map(c => {
1172: let playerRole = null;
1173: let masterRole = null;
1183: // Update Round Data with Calculated Locks AND Updated Deck
1194: // NEW: Go to Selection Reveal (Interim Phase)
1195: const duration = 10;
1196: const expiry = new Date(now.getTime() + duration * 1000);
1208: // NEW: Go to Hunter Play
1209: const duration = 60;
1210: const expiry = new Date(now.getTime() + duration * 1000);
1221: const duration = 12; // 12s Card Reveal Animation
1222: const expiry = new Date(now.getTime() + duration * 1000);
1224: // Add a timeout to prevent hanging the game loop if network/supabase stalls
1225: const updatePromise = supabase.from('clubs_game_status').update({
1230: const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve({ error: new Error('TIMEOUT') }), 5000));
1232: const result: any = await Promise.race([updatePromise, timeoutPromise]);
1244: const nextRound = round + 1;
1246: // GAME COMPLETE - Apply final bonus based on top player vs top master
1248: const finalScores = finalData?.scores || { current: {}, history: {} };
1249: const finalCurrent = finalScores.current || {};
1251: // NEW: Identify Players using allowed_players array from DB status
1253: const playerIds = new Set(statusData?.allowed_players?.map((id: any) => String(id)) || []);
1255: // Find highest player and master scores
1256: let maxPlayerScore = -Infinity;
1257: let maxMasterScore = -Infinity;
1260: const numScore = typeof score === 'number' ? score : 0;
1261: const isPlayer = playerIds.has(uid);
1262: const isMasterId = uid === 'MASTER' || uid.includes('MASTER') || uid.startsWith('master_');
1264: // Standardized Role Check
1272: // Handle edge cases
1276: // Determine final bonus - MATCHING PLAYER VIEW (500 pts)
1277: const playersWon = maxPlayerScore > maxMasterScore;
1278: const mastersWon = maxMasterScore > maxPlayerScore;
1280: const adjustedCurrent: Record<string, number> = {};
1282: const numScore = typeof score === 'number' ? score : 0;
1283: const isMaster = isMasterUid(uid);
1285: // Apply win/loss bonus (+500/-500)
1295: const playerScoresEnd = Object.entries(adjustedCurrent).filter(([k]) => !isMasterUid(k)).map(([, v]) => v);
1296: const masterScoresEnd = Object.entries(adjustedCurrent).filter(([k]) => isMasterUid(k)).map(([, v]) => v);
1298: const newLegacyPScore = playerScoresEnd.length > 0 ? Math.max(...playerScoresEnd) : 0;
1299: const newLegacyMScore = masterScoresEnd.length > 0 ? Math.max(...masterScoresEnd) : 0;
1301: // UPDATED: Identify the TOP IDs again from the adjusted total list for final HUD sync
1302: let topPlayerIdEnd = 'TBD';
1303: let topMasterIdEnd = 'MASTER';
1306: const score = Number(s) || 0;
1314: // Sync local HUD immediately
1315: const mUid = user?.uid || user?.id || user?.id;
1324: const persistClubsStats = async () => {
1326: const playersWon = maxPlayerScore > maxMasterScore;
1327: const masterWon = maxMasterScore > maxPlayerScore;
1328: // AUTHORITATIVE LOOP: Update ALL participants who have game entries (Master included)
1329: const participantIds = Object.keys(adjustedCurrent);
1342: const userEmail = userData.email;
1344: const finalTotalScore = adjustedCurrent[uid] || 0;
1354: const targetEmail = profile.email || userEmail;
1355: const isTie = maxPlayerScore === maxMasterScore;
1356: const isMaster = (userData.role === 'master' || userData.role === 'admin' || profile.role === 'master');
1357: let isWin = false;
1363: const currentWins = profile.wins || 0;
1364: const currentLosses = profile.losses || 0;
1404: const duration = 60;
1405: const expiry = new Date(now.getTime() + duration * 1000);
1407: let nextRoundData = currentStatus?.round_data || {};
1409: const pSel = nextRoundData.player_selection || { angel: null, demon: null };
1410: const mSel = nextRoundData.master_selection || { angel: null, demon: null };
1411: const cardsToRemove = [mSel.angel, mSel.demon, pSel.angel, pSel.demon].filter(Boolean);
1412: const prevRemovedP = currentStatus.removed_cards_p || [];
1413: const prevRemovedM = currentStatus.removed_cards_m || [];
1415: // FIXED: Accumulate removed cards properly
1416: const finalRemovedP = Array.from(new Set([...prevRemovedP, ...cardsToRemove]));
1417: const finalRemovedM = Array.from(new Set([...prevRemovedM, ...cardsToRemove]));
1461: const now = new Date();
1462: const duration = 10; // 10s Eval
1463: const expiry = new Date(now.getTime() + duration * 1000);
1466: const rData = data.round_data || {};
1468: let activeGameId = data.active_game_id;
1472: // 1. Try to find an existing active session
1485: // 2. If no session exists, CREATE ONE
1506: // Update the game status with whatever we found/created
1512: const pSel = rData.player_selection || { angel: null, demon: null };
1513: const mSel = rData.master_selection || { angel: null, demon: null };
1514: const currentScores = data.scores || { current: {}, history: {} };
1516: // Use Refs for latest values
1517: const currentPVotesMap = playersVotesRef.current;
1518: const currentMVotesMap = masterVotesRef.current;
1520: const mUid = user?.uid || user?.id || user?.id;
1522: const allParticipants = new Set<string>();
1531: const participantIds = Array.from(allParticipants);
1532: const roundScores: Record<string, number> = {};
1533: const resList: any[] = [];
1534: const masterIds = new Set(Object.keys(currentMVotesMap));
1542: const angelReward = 300 - ((round - 1) * 50);
1544: const voteCount: Record<string, number> = {};
1551: const sortedCards = Object.entries(voteCount).sort((a, b) => b[1] - a[1]);
1552: const topVotedCards: string[] = [];
1561: let score = 0;
1562: const reasons: string[] = [];
1563: const isMaster = isMasterUid(uid);
1564: const votes = isMaster ? currentMVotesMap[uid] : currentPVotesMap[uid];
1572: const targetRole = isMaster ? pSel : mSel;
1594: const newHistory = { ...currentScores.history };
1595: const newCurrent = { ...currentScores.current };
1598: const delta = roundScores[uid] || 0;
1599: const baseline = Number(currentScores.start?.[uid] || 0);
1600: const currentTotal = newCurrent[uid] !== undefined ? Number(newCurrent[uid]) : baseline;
1608: // Calculate Top Scores from NEW TOTALS
1609: let maxPScore = -Infinity;
1610: let maxMScore = -Infinity;
1611: let topPId = '';
1614: const isMaster = isMasterUid(uid);
1615: const score = Number(s) || 0;
1629: const highPlayer = { score: maxPScore, uid: topPId || 'TBD' };
1630: const highMaster = { score: maxMScore, uid: mUid || 'MASTER' };
1632: const playerScoresList = Object.entries(newCurrent).filter(([k]) => !isMasterUid(k)).map(([, v]) => v as number);
1633: const masterScoresList = Object.entries(newCurrent).filter(([k]) => isMasterUid(k)).map(([, v]) => v as number);
1635: const newLegacyPScore = playerScoresList.length > 0 ? Math.max(...playerScoresList) : 0;
1636: const newLegacyMScore = masterScoresList.length > 0 ? Math.max(...masterScoresList) : 0;
1657: // --- PERSIST ROUND SCORES ---
1658: // NOTE: The legacy RPC upsert_round_points was removed because it conflicts
1659: // with the generated column "total_points" in the database.
1660: // We now rely exclusively on the clubs_round_scores history table below.
1662: // --- SAVE ROUND SCORES TO HISTORY TABLE ---
1665: const roundScoreRecords = [];
1669: // Skip system IDs
1672: const pointsEarned = roundScores[uid] || 0;
1673: const totalScore = newCurrent[uid] || 0;
1675: // Fetch email for this user
1676: let userEmail = null;
1680: // Query 'profiles' table instead of 'users' (auth.users is restricted and 'users' view may not exist)
1704: // Batch insert all round scores
1722: // BROADCAST RESULTS (Critical for Player View)
1725: // Use 'round_reveal' to match the gameState - ensure ClubsGame.tsx listens for this!
1730: // Fix for HUD not updating: Send the RAW points for the specific player to handle locally if needed
1735: // Local Updates
1758: return (
1759: <div className="relative w-full h-full bg-[#050508] flex flex-col font-sans overflow-hidden">
1761: <div className={`px-4 py-3 sm:px-8 sm:py-2 border-b border-white/5 flex flex-col sm:flex-row justify-center items-center bg-white/[0.01] z-[110] gap-4 sm:gap-0 relative`}>
1772: <div className="flex items-center gap-4 sm:gap-8 w-full sm:w-auto justify-center">
1773: <div className="flex items-center gap-4 sm:gap-8 border-l-0 sm:border-l border-white/10 pl-0 sm:pl-8 w-full justify-around sm:justify-start">
1775: <div className="text-center min-w-[40px]">
1780: <div className="w-px h-6 bg-white/10" />
1783: <div className="text-center min-w-[70px] sm:min-w-[100px]">
1785: <div className="flex flex-col items-center leading-none">
1791: <div className="w-px h-6 bg-white/10" />
1794: <div className="text-center min-w-[40px]">
1799: <div className="w-px h-6 bg-white/10" />
1802: <div className="text-center min-w-[40px]">
1807: <div className="w-px h-6 bg-white/10" />
1810: <div className="text-center min-w-[60px]">
1812: <div className="flex items-center justify-center gap-1">
1822: <div className="flex-1 flex flex-col sm:flex-row overflow-hidden relative z-10">
1825: <div className="flex-1 overflow-y-auto p-4 sm:p-8 scrollbar-hide relative bg-black/40">
1828: <div className="max-w-6xl mx-auto mb-8 flex justify-between items-end">
1829: <div className="space-y-1">
1853: <div className="flex items-center gap-2">
1854: <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
1857: <div className="flex gap-2">
1859: const card = cards.find(c => c.id === hId);
1860: const rank = card?.rank || '?';
1861: const suit = card?.suit || 'clubs';
1862: const symbol = suit === 'hearts' ? '♥' : suit === 'diamonds' ? '♦' : suit === 'spades' ? '♠' : '♣';
1863: const color = (suit === 'hearts' || suit === 'diamonds') ? 'text-red-500' : 'text-white';
1865: return (
1866: <div key={hId} className="w-10 h-10 sm:w-12 sm:h-12 rounded bg-white/5 border border-white/10 flex flex-col items-center justify-center shadow-lg group hover:border-purple-500/50 transition-all">
1880: <div className="flex items-center gap-4">
1881: <div className={`relative px-4 py-3 rounded-lg border transition-all duration-300 ${mySelection.angel ? 'border-yellow-500/50 bg-yellow-500/10 shadow-[0_0_15px_rgba(234,179,8,0.1)]' : 'border-white/5 bg-white/[0.02]'} text-center min-w-[100px]`}>
1882: <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-yellow-500/30 to-transparent" />
1888: <div className={`relative px-4 py-3 rounded-lg border transition-all duration-300 ${mySelection.demon ? 'border-red-500/50 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'border-white/5 bg-white/[0.02]'} text-center min-w-[100px]`}>
1889: <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />
1895: <div className="h-8 w-px bg-white/5 mx-2" />
1897: <div className={`px-4 py-3 rounded-lg border transition-all duration-300 ${Object.keys(phase1Selections).length > 0 || (playerSelection.angel && playerSelection.demon) ? 'border-green-500/30 bg-green-500/5 shadow-[0_0_15px_rgba(34,197,94,0.1)]' : 'border-white/5 bg-white/[0.02]'} text-center min-w-[120px]`}>
1899: <div className="flex items-center justify-center gap-2">
1900: <div className={`w-1.5 h-1.5 rounded-full ${Object.keys(phase1Selections).length > 0 || (playerSelection.angel && playerSelection.demon) ? 'bg-green-500' : 'bg-white/10 animate-pulse'}`} />
1914: const now = new Date();
1915: const expiry = new Date(now.getTime() + 60000); // 60s for setup
1917: // FORCE NEW DECK GENERATION
1918: const fullDeck = generateRandomDeck();
1919: const activeDeck = fullDeck.slice(0, 12);
1920: const reserveDeck = fullDeck.slice(12, 24);
1922: // -----------------------------------------------------
1923: // ROBUST SCORE INITIALIZATION (Case-Insensitive)
1924: // -----------------------------------------------------
1927: const allowedIds = statusData?.allowed_players || [];
1929: let initialStartScores: Record<string, number> = {};
1932: // 1. Fetch Emails
1934: const idEmailMap: Record<string, string> = {};
1935: const emails: string[] = [];
1937: // 2. Build Maps
1947: // 3. Fetch Profiles & Map (Case-Insensitive)
1949: const orFilter = emails.map(e => `email.ilike.${e} `).join(',');
1953: const emailPoints: Record<string, number> = {};
1959: const lower = email.toLowerCase();
1968: // -----------------------------------------------------
1979: // Clear previous selections if any
1983: // Reset scores and removed cards on fresh start
2005: // Clear local vote state to prevent stale triggers
2025: <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-4 max-w-6xl mx-auto">
2029: const isMyAngel = mySelection.angel === card.id;
2030: const isMyDemon = mySelection.demon === card.id;
2031: const isPlayerAngel = playerSelection.angel === card.id;
2032: const isPlayerDemon = playerSelection.demon === card.id;
2033: const myId = (user?.id as string) || 'MASTER';
2034: const myVotes = masterVotes[myId] || [];
2035: const isVoted = gameState === 'playing' && myVotes.includes(card.id);
2037: let borderColor = 'border-white/10 opacity-60 hover:opacity-100';
2038: let glow = '';
2040: // Dim others during reveal
2045: // Big 4 Dimming (Card Reveal)
2054: // PLAYER REVEAL HIGHLIGHTS (In Master View) - MOVED TO CARD REVEAL AND ROUND RESULTS
2060: return (
2061: <div
2080: <div className="absolute top-2 right-2 flex flex-col gap-1 items-end z-20">
2083: <div className="px-1.5 py-0.5 rounded bg-green-500 text-black font-bold text-[8px] shadow-lg border border-white/20 min-w-[16px] text-center">
2092: <div className="absolute top-2 right-2 flex flex-col gap-1 items-end z-20">
2095: <div className="px-1.5 py-0.5 rounded bg-yellow-500 text-black font-bold text-[8px] shadow-lg border border-white/20 min-w-[16px] text-center">
2101: <div className="px-1.5 py-0.5 rounded bg-red-600 text-white font-bold text-[8px] shadow-lg border border-white/20 min-w-[16px] text-center">
2124: <div className="flex items-center gap-12">
2126: <div className="flex flex-col items-center gap-6">
2128: <div className="flex gap-6">
2131: const card = cards.find(c => c.id === mySelection.angel);
2133: return (
2134: <div className="relative w-48 aspect-[2/3] rounded-xl border-4 border-yellow-500 shadow-[0_0_50px_rgba(234,179,8,0.5)]">
2136: <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-yellow-500 text-black px-4 py-1 font-black text-xs uppercase tracking-widest rounded-full whitespace-nowrap">MY ANGEL</div>
2142: const card = cards.find(c => c.id === mySelection.demon);
2144: return (
2145: <div className="relative w-48 aspect-[2/3] rounded-xl border-4 border-red-600 shadow-[0_0_50px_rgba(220,38,38,0.5)]">
2147: <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-1 font-black text-xs uppercase tracking-widest rounded-full whitespace-nowrap">MY DEMON</div>
2155: <div className="h-64 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent" />
2158: <div className="flex flex-col items-center gap-6">
2160: <div className="flex gap-6">
2163: const card = cards.find(c => c.id === playerSelection.angel);
2165: return (
2166: <div className="relative w-48 aspect-[2/3] rounded-xl border-4 border-blue-500 shadow-[0_0_50px_rgba(59,130,246,0.5)]">
2168: <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-1 font-black text-xs uppercase tracking-widest rounded-full whitespace-nowrap">PLAYER ANGEL</div>
2174: const card = cards.find(c => c.id === playerSelection.demon);
2176: return (
2177: <div className="relative w-48 aspect-[2/3] rounded-xl border-4 border-purple-600 shadow-[0_0_50px_rgba(147,51,234,0.5)]">
2179: <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-purple-600 text-white px-4 py-1 font-black text-xs uppercase tracking-widest rounded-full whitespace-nowrap">PLAYER DEMON</div>
2187: <div className="absolute bottom-12 text-center text-white/40 font-mono animate-pulse">
2195: <div className="w-full sm:w-80 h-[30vh] sm:h-full border-t sm:border-t-0 sm:border-l border-white/10 flex flex-col bg-[#0A0A0E]">
2197: <div className="flex-1 flex flex-col min-h-0 bg-[#0A0A0E] border-b border-white/5">
2198: <div className="p-3 border-b border-white/10 bg-[#0F0F13]">
2201: <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-black scrollbar-track-transparent">
2203: <div className="text-center mt-10 opacity-30">
2208: <div key={msg.id} className="relative group">
2209: <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-white/20 group-hover:bg-cyan-500/50 transition-colors" />
2210: <div className="pl-3 py-1">
2218: <div ref={chatEndRef} />
2224: <div className="relative">
2237: <div className="p-4 border-t border-white/10 bg-black/40">
2238: <div className="flex flex-col gap-2">
2239: <div className="text-[10px] uppercase tracking-widest text-white/30">SYSTEM STATUS</div>
2240: <div className="text-xs font-mono text-cyan-500/80">
2243: <div className="text-xs font-mono text-white/40">
2261: <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[200] flex items-center justify-center">
2262: <div className="max-w-4xl w-full mx-4 text-center space-y-8">
2265: const playerWins = topPlayerScore > topMasterScore;
2266: const masterWins = topMasterScore > topPlayerScore;
2268: return (
2271: <div className="space-y-4">
2275: <div className={`h-1 w-96 mx-auto bg-gradient-to-r ${playerWins ? 'from-transparent via-green-500 to-transparent' : masterWins ? 'from-transparent via-red-500 to-transparent' : 'from-transparent via-white to-transparent'} opacity-70`} />
2284: <div className="flex flex-col sm:grid sm:grid-cols-3 gap-3 sm:gap-6 w-full max-w-4xl px-4 sm:px-0">
2286: <div className={`p-4 sm:p-8 rounded-xl border-2 ${playerWins ? 'border-green-500 bg-green-500/10 shadow-[0_0_30px_rgba(34,197,94,0.3)]' : 'border-white/20 bg-white/5'}`}>
2296: <div className="p-4 sm:p-8 rounded-xl border-2 border-blue-500 bg-blue-500/10">
2306: <div className={`p-4 sm:p-8 rounded-xl border-2 ${masterWins ? 'border-red-500 bg-red-500/10 shadow-[0_0_30px_rgba(239,68,68,0.3)]' : 'border-white/20 bg-white/5'}`}>
2317: <div className="bg-white/5 border border-white/10 rounded-xl p-6">
2319: <div className="grid grid-cols-3 gap-4 text-center">
2320: <div>
2324: <div>
2328: <div>
2357: <div className="fixed inset-0 bg-black/98 backdrop-blur-lg z-[2000] flex items-center justify-center animate-in fade-in duration-300">
2358: <div className="text-center space-y-6 max-w-md px-8">
2360: <div className="mx-auto w-24 h-24 rounded-full border-4 border-red-500 flex items-center justify-center animate-pulse">
2367: <div className="space-y-2">
2371: <div className="h-px w-48 mx-auto bg-gradient-to-r from-transparent via-red-500 to-transparent" />
2375: <div className="space-y-3">
2388: <div className="pt-4">
2402: <div className="fixed bottom-0 right-0 p-2 bg-black/80 text-[8px] font-mono text-green-500 pointer-events-none z-[9999]">

```
