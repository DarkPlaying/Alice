import { useState, useEffect } from 'react';
import { Crown, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../supabaseClient';

interface PlayerData {
    rank: number;
    id: string; // Firebase player_id
    nickname: string; // username
    clears: number;
    score: number;
    suits: string[];
    status: string;
}

const getPlayerGrade = (score: number) => {
    if (score >= 2000) return { label: 'S', color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/5 shadow-[0_0_8px_rgba(234,179,8,0.2)]' };
    if (score >= 1500) return { label: 'A', color: 'text-[#ff0050] border-[#ff0050]/30 bg-[#ff0050]/5 shadow-[0_0_8px_rgba(255,0,80,0.2)]' };
    if (score >= 1000) return { label: 'B', color: 'text-purple-400 border-purple-500/30 bg-purple-500/5 shadow-[0_0_8px_rgba(192,132,252,0.2)]' };
    if (score >= 500) return { label: 'C', color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/5 shadow-[0_0_8px_rgba(34,211,238,0.2)]' };
    return { label: 'D', color: 'text-gray-400 border-white/10 bg-white/5' };
};

export const Leaderboard = () => {
    const [filter, setFilter] = useState('ALL');
    const [players, setPlayers] = useState<PlayerData[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const playersPerPage = 10;

    useEffect(() => {
        const fetchLeaderboardData = async () => {
            try {
                setLoading(true);

                // Fetch profiles from Supabase and establish ID mapping
                const { data: allProfiles, error: fetchError } = await supabase
                    .from('profiles')
                    .select('*');

                if (fetchError) throw fetchError;

                const sortedProfiles = [...(allProfiles || [])].sort((a: any, b: any) => {
                    const isMasterA = a.role === 'master' || a.role === 'admin' || a.username === 'admin';
                    const isMasterB = b.role === 'master' || b.role === 'admin' || b.username === 'admin';
                    if (isMasterA && !isMasterB) return -1;
                    if (!isMasterA && isMasterB) return 1;
                    const timeA = new Date(a.created_at || 0).getTime();
                    const timeB = new Date(b.created_at || 0).getTime();
                    return timeA - timeB;
                });

                const idMap: Record<string, string> = {};
                sortedProfiles.forEach((u: any, index) => {
                    const pid = `PLAYER${(index + 1).toString().padStart(3, '0')}`;
                    if (u.username) {
                        idMap[u.username.toLowerCase()] = pid;
                    }
                });

                // Sort again by visa_points for leaderboard
                const leaderboardProfiles = [...sortedProfiles].sort((a: any, b: any) => (b.visa_points || 0) - (a.visa_points || 0));

                // Merge data
                const mergedPlayers: PlayerData[] = leaderboardProfiles.map((profile, index) => {
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
    const indexOfLastPlayer = currentPage * playersPerPage;
    const indexOfFirstPlayer = indexOfLastPlayer - playersPerPage;
    const currentPlayers = players.slice(indexOfFirstPlayer, indexOfLastPlayer);
    const totalPages = Math.max(1, Math.ceil(players.length / playersPerPage));

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
                    className="bg-[#111] border border-white/10 rounded-lg overflow-hidden shadow-2xl w-full"
                >
                    <div className="w-full overflow-x-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
                        <div className="min-w-[650px] md:min-w-0 w-full">
                            {/* Header */}
                            <div className="grid grid-cols-12 bg-black/40 p-4 md:p-5 text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-white/5">
                                <div className="col-span-1">Rank</div>
                                <div className="col-span-3">Player</div>
                                <div className="col-span-2 text-center">Grade</div>
                                <div className="col-span-2 text-center">Clears</div>
                                <div className="col-span-2 text-center">Suits Cleared</div>
                                <div className="col-span-2 text-right">Visa / Score</div>
                            </div>

                            <div className="divide-y divide-white/5 font-mono text-xs md:text-sm">
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
                                    currentPlayers.map((row, index) => {
                                        const grade = getPlayerGrade(row.score);
                                        return (
                                            <motion.div
                                                key={row.nickname + row.id + index}
                                                initial={{ opacity: 0, x: -15 }}
                                                whileInView={{ opacity: 1, x: 0 }}
                                                viewport={{ once: true }}
                                                transition={{ duration: 0.4, delay: index * 0.05 }}
                                                className="grid grid-cols-12 p-4 md:p-5 hover:bg-white/[0.02] transition-colors items-center group"
                                            >
                                                <div className="col-span-1 text-gray-500 group-hover:text-white flex items-center">
                                                    {row.rank === 1 && <Crown size={12} className="inline text-yellow-500 mr-1 shrink-0" />}
                                                    #{row.rank}
                                                </div>
                                                <div className="col-span-3 text-gray-300 font-bold group-hover:text-white flex items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap">
                                                    <span className="truncate">{row.nickname || row.id}</span>
                                                    {row.rank === 1 && <span className="text-[8px] bg-yellow-500/10 text-yellow-500 px-1 py-0.5 rounded border border-yellow-500/20 whitespace-nowrap shrink-0">TOP</span>}
                                                </div>
                                                <div className="col-span-2 text-center flex justify-center">
                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] md:text-[10px] font-black border ${grade.color}`}>
                                                        {grade.label}
                                                    </span>
                                                </div>
                                                <div className="col-span-2 text-center text-gray-400">{row.clears}</div>
                                                <div className="col-span-2 text-center flex items-center justify-center gap-1 text-gray-500">
                                                    {getSuitsForRank(row.rank).map((s, i) => (
                                                        <span key={i} className={`
                                                            ${s === '♥' ? 'text-red-500' : ''}
                                                            ${s === '♦' ? 'text-cyan-400' : ''}
                                                            ${s === '♣' ? 'text-green-400' : ''}
                                                            ${s === '♠' ? 'text-purple-400' : ''}
                                                        `}>{s}</span>
                                                    ))}
                                                </div>
                                                <div className="col-span-2 text-right text-[#ff0050] font-bold">
                                                    {row.score}
                                                </div>
                                            </motion.div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Pagination Controls */}
                    {players.length > playersPerPage && (
                        <div className="flex items-center justify-between p-3 md:p-5 bg-black/40 border-t border-white/5 font-mono text-[10px] md:text-xs gap-2">
                            <button
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                                className="px-2.5 py-1.5 md:px-4 md:py-2 border border-white/10 hover:border-white/20 rounded disabled:opacity-30 disabled:pointer-events-none text-gray-400 hover:text-white transition-all cursor-pointer uppercase"
                            >
                                <span className="xs:hidden">◄</span>
                                <span className="hidden xs:inline">PREVIOUS</span>
                            </button>
                            <span className="text-gray-500 tracking-wider text-center">
                                PAGE {currentPage} / {totalPages}
                            </span>
                            <button
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                                className="px-2.5 py-1.5 md:px-4 md:py-2 border border-white/10 hover:border-white/20 rounded disabled:opacity-30 disabled:pointer-events-none text-gray-400 hover:text-white transition-all cursor-pointer uppercase"
                            >
                                <span className="hidden xs:inline">NEXT</span>
                                <span className="xs:hidden">►</span>
                            </button>
                        </div>
                    )}
                </motion.div>
            </div>
        </section >
    );
};
