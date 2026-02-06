import { useState, useEffect } from 'react';
import { Crown, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../supabaseClient';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';

interface PlayerData {
    rank: number;
    id: string; // Firebase player_id
    nickname: string; // username
    clears: number;
    score: number;
    suits: string[];
    status: string;
}

export const Leaderboard = () => {
    const [filter, setFilter] = useState('ALL');
    const [players, setPlayers] = useState<PlayerData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLeaderboardData = async () => {
            try {
                setLoading(true);

                // 1. Fetch all users from Firebase to establish ID mapping
                const usersRef = collection(db, "users");
                const userSnapshot = await getDocs(usersRef);
                const allFirebaseUsers = userSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })).sort((a: any, b: any) => {
                    // Match AdminDashboard logic: admin first, then by createdAt
                    const isMasterA = a.role === 'master' || a.role === 'admin' || a.username === 'admin';
                    const isMasterB = b.role === 'master' || b.role === 'admin' || b.username === 'admin';
                    if (isMasterA && !isMasterB) return -1;
                    if (!isMasterA && isMasterB) return 1;
                    const timeA = a.createdAt?.seconds || a.createdAt?.toMillis?.() || 0;
                    const timeB = b.createdAt?.seconds || b.createdAt?.toMillis?.() || 0;
                    return timeA - timeB;
                });

                // Create Mapping: username -> Player ID
                const idMap: Record<string, string> = {};
                allFirebaseUsers.forEach((u: any, index) => {
                    const pid = `PLAYER${(index + 1).toString().padStart(3, '0')}`;
                    if (u.username) {
                        idMap[u.username.toLowerCase()] = pid;
                    }
                });

                // 2. Fetch profiles from Supabase
                const { data: profiles, error: pError } = await supabase
                    .from('profiles')
                    .select('*')
                    .order('visa_points', { ascending: false });

                if (pError) throw pError;

                // 3. Merge data
                const mergedPlayers: PlayerData[] = (profiles || []).map((profile, index) => {
                    const username = profile.username?.toLowerCase() || '';
                    const playerId = idMap[username] || `PLAYER_EXT`;

                    return {
                        rank: index + 1,
                        id: playerId,
                        nickname: profile.username,
                        clears: profile.wins || 0,
                        score: profile.visa_points || 0,
                        suits: [], // Could be expanded if suits_cleared exists
                        status: 'Active'
                    };
                });

                setPlayers(mergedPlayers);
            } catch (err) {
                console.error("LEADERBOARD_FETCH_ERROR:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboardData();
    }, []);

    // Placeholder suits for visual variety if real data isn't available
    const getSuitsForRank = (rank: number) => {
        if (rank === 1) return ['♥', '♦', '♣', '♠'];
        if (rank === 2) return ['♥', '♦', '♠'];
        if (rank === 3) return ['♦', '♣'];
        if (rank % 2 === 0) return ['♠'];
        return ['♣'];
    };
    return (
        <section id="leaderboard" className="py-24 relative z-20">
            <div className="max-w-6xl mx-auto px-6">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-12"
                >
                    <h2 className="text-3xl md:text-4xl font-display text-white mb-4 uppercase tracking-wider">
                        Global <span className="text-[#ff0050]">Rankings</span>
                    </h2>
                </motion.div>

                {/* Filters */}
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 }}
                    className="flex flex-wrap justify-center gap-4 mb-8"
                >
                    {['ALL'].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`
                    px-4 py-2 text-[10px] font-bold tracking-widest uppercase rounded border transition-colors
                    ${filter === f
                                    ? 'bg-[#ff0050] text-white border-[#ff0050]'
                                    : 'bg-transparent text-gray-500 border-white/10 hover:border-white/30 hover:text-white'}
                  `}
                        >
                            {f}
                        </button>
                    ))}
                </motion.div>

                {/* Table */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                    className="bg-[#111] border border-white/10 rounded-lg overflow-hidden shadow-2xl"
                >
                    {/* Header */}
                    <div className="grid grid-cols-12 bg-black/40 p-5 text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-white/5">
                        <div className="col-span-1 md:col-span-1">Rank</div>
                        <div className="col-span-4 md:col-span-4">Player ID</div>
                        <div className="col-span-2 text-center">Clears</div>
                        <div className="col-span-3 text-center hidden md:block">Suits Cleared</div>
                        <div className="col-span-3 md:col-span-2 text-right">Visa / Score</div>
                    </div>

                    <div className="divide-y divide-white/5 font-mono text-sm">
                        {loading ? (
                            <div className="p-20 flex flex-col items-center justify-center gap-4 text-gray-500">
                                <Loader2 className="animate-spin" size={24} />
                                <span className="text-[10px] tracking-[0.2em] uppercase">Synchronizing Rankings...</span>
                            </div>
                        ) : players.length === 0 ? (
                            <div className="p-20 text-center text-gray-500 text-xs tracking-widest">
                                NO DEPLOYMENT DATA FOUND
                            </div>
                        ) : (
                            players.map((row, index) => (
                                <div key={row.nickname + row.id + index} className="grid grid-cols-12 p-5 hover:bg-white/[0.02] transition-colors items-center group">
                                    <div className="col-span-1 md:col-span-1 text-gray-500 group-hover:text-white">
                                        {row.rank === 1 && <Crown size={14} className="inline text-yellow-500 mr-1" />}
                                        #{row.rank}
                                    </div>
                                    <div className="col-span-4 md:col-span-4 text-gray-300 font-bold group-hover:text-white flex items-center gap-2">
                                        {row.id}
                                        {row.rank === 1 && <span className="text-[9px] bg-yellow-500/10 text-yellow-500 px-1 py-0.5 rounded border border-yellow-500/20 whitespace-nowrap hidden lg:inline">TOP SURVIVOR</span>}
                                    </div>
                                    <div className="col-span-2 text-center text-gray-400">{row.clears}</div>
                                    <div className="col-span-3 text-center hidden md:flex items-center justify-center gap-2 text-gray-500">
                                        {getSuitsForRank(row.rank).map((s, i) => (
                                            <span key={i} className={`
                                                ${s === '♥' ? 'text-red-500' : ''}
                                                ${s === '♦' ? 'text-cyan-400' : ''}
                                                ${s === '♣' ? 'text-green-400' : ''}
                                                ${s === '♠' ? 'text-purple-400' : ''}
                                            `}>{s}</span>
                                        ))}
                                    </div>
                                    <div className="col-span-3 md:col-span-2 text-right text-[#ff0050] font-bold">
                                        {row.score}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </motion.div>
            </div>
        </section >
    );
};
