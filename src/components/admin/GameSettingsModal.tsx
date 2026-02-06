// Game Settings Modal with Delete Confirmation
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye, RotateCcw, Trash2, Save, ChevronLeft, ChevronRight, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { generateGameId } from '../../utils/gameId';

interface GameSettingsModalProps {
    onClose: () => void;
}

interface GameSession {
    id: string;
    status: string;
    current_round: number;
    total_rounds: number;
    created_at: string;
    saved_at: string | null;
}

interface RoundScore {
    player_email: string;
    round_1: number;
    round_2: number;
    round_3: number;
    round_4: number;
    round_5: number;
    round_6: number;
    total_points: number;
}

interface Toast {
    message: string;
    type: 'success' | 'error' | 'info';
}

export const GameSettingsModal = ({ onClose }: GameSettingsModalProps) => {
    const [games, setGames] = useState<GameSession[]>([]);
    const [selectedGame, setSelectedGame] = useState<string | null>(null);
    const [scores, setScores] = useState<RoundScore[]>([]);
    const [showScores, setShowScores] = useState(false);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [toast, setToast] = useState<Toast | null>(null);
    const [gameToDelete, setGameToDelete] = useState<string | null>(null);
    const itemsPerPage = 10;

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    useEffect(() => {
        fetchGames();
    }, []);

    const fetchGames = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('clubs_game_sessions')
            .select('*')
            .order('created_at', { ascending: false });

        if (data) {
            setGames(data);
        }
        setLoading(false);
    };

    const handleViewScores = async (gameId: string) => {
        setLoading(true);
        const { data } = await supabase
            .from('clubs_round_points')
            .select('*')
            .eq('game_id', gameId)
            .order('total_points', { ascending: false });

        if (data) {
            setScores(data);
            setSelectedGame(gameId);
            setShowScores(true);
        }
        setLoading(false);
    };

    // Real-time scores useEffect
    useEffect(() => {
        if (!showScores || !selectedGame) return;

        const channel = supabase.channel(`scores_${selectedGame}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'clubs_round_points',
                filter: `game_id=eq.${selectedGame}`
            }, async () => {
                const { data } = await supabase
                    .from('clubs_round_points')
                    .select('*')
                    .eq('game_id', selectedGame)
                    .order('total_points', { ascending: false });
                if (data) {
                    console.log('[ADMIN] Real-time scores updated:', data);
                    setScores(data);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [showScores, selectedGame]);

    const handleReset = async (gameId: string) => {
        if (!confirm('⚠️ RESET GAME\n\nRevert all Visa points for this game?')) return;

        setLoading(true);
        try {
            const { data: pointsData } = await supabase
                .from('clubs_round_points')
                .select('player_email, total_points')
                .eq('game_id', gameId);

            if (pointsData) {
                for (const player of pointsData) {
                    await supabase.rpc('adjust_visa_points', {
                        p_email: player.player_email,
                        p_adjustment: -player.total_points
                    });
                }

                await supabase.from('clubs_round_points').delete().eq('game_id', gameId);
                await supabase.from('clubs_game_sessions').update({
                    status: 'deleted',
                    saved_at: new Date().toISOString()
                }).eq('id', gameId);

                setGames(prev => prev.map(g =>
                    g.id === gameId ? { ...g, status: 'deleted' } : g
                ));

                showToast('Game reset complete', 'success');
            }
        } catch (error) {
            showToast('Reset failed', 'error');
        }
        setLoading(false);
    };

    const handleDelete = async (gameId: string) => {
        setLoading(true);

        try {
            // Step 1: Clear foreign key reference if this is the active game
            const { error: statusError } = await supabase
                .from('clubs_game_status')
                .update({ active_game_id: null })
                .eq('active_game_id', gameId);

            if (statusError) {
                console.error('Error clearing active_game_id:', statusError);
                showToast(`Failed to clear reference: ${statusError.message}`, 'error');
                setLoading(false);
                return;
            }

            // Step 2: Delete related round points
            const { error: pointsError } = await supabase
                .from('clubs_round_points')
                .delete()
                .eq('game_id', gameId);

            if (pointsError) {
                console.error('Error deleting round points:', pointsError);
                showToast(`Failed to delete round points: ${pointsError.message}`, 'error');
                setLoading(false);
                return;
            }

            // Step 3: Delete the game session
            const { error: sessionError } = await supabase
                .from('clubs_game_sessions')
                .delete()
                .eq('id', gameId);

            if (sessionError) {
                console.error('Error deleting game session:', sessionError);
                showToast(`Delete failed: ${sessionError.message}`, 'error');
                fetchGames(); // Reload on error
            } else {
                // Optimistic update - remove from UI
                setGames(prev => prev.filter(g => g.id !== gameId));
                showToast('Game deleted successfully', 'success');
            }
        } catch (error) {
            console.error('Unexpected error during deletion:', error);
            showToast('Delete failed: Unexpected error', 'error');
            fetchGames();
        }

        setLoading(false);
        setGameToDelete(null); // Close the modal
    };

    const handleSave = async (gameId: string) => {
        if (!confirm('💾 SAVE & NEW GAME\n\nFinalize this session and start fresh?')) return;

        setLoading(true);
        try {
            await supabase.from('clubs_game_sessions').update({
                status: 'saved',
                saved_at: new Date().toISOString()
            }).eq('id', gameId);

            const newGameId = generateGameId();
            await supabase.from('clubs_game_sessions').insert({
                id: newGameId,
                status: 'active',
                current_round: 0,
                total_rounds: 6
            });

            await supabase.from('clubs_game_status').update({
                active_game_id: newGameId,
                current_round: 0,
                system_start: false
            }).eq('id', 'clubs_king');

            const channel = supabase.channel('clubs_admin_reset');
            await channel.send({
                type: 'broadcast',
                event: 'force_exit',
                payload: { reason: 'game_saved', new_game_id: newGameId }
            });

            showToast(`Game saved! New: ${newGameId}`, 'success');
            fetchGames();
        } catch (error) {
            showToast('Save failed', 'error');
        }
        setLoading(false);
    };

    const paginatedGames = games.slice(page * itemsPerPage, (page + 1) * itemsPerPage);
    const totalPages = Math.ceil(games.length / itemsPerPage);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 sm:p-8"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                transition={{ type: "spring", damping: 25 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-gradient-to-br from-[#0a0a0f] via-[#0f0f15] to-[#0a0a0f] border-2 border-green-500/40 rounded-2xl w-full max-w-7xl h-[90vh] flex flex-col shadow-[0_0_80px_rgba(34,197,94,0.3)] overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b-2 border-green-500/30 bg-gradient-to-r from-green-500/5 to-transparent">
                    <div>
                        <h2 className="text-3xl sm:text-4xl font-cinzel font-bold text-white uppercase tracking-wider flex items-center gap-3">
                            <span className="text-green-400">◈</span> Game History & Controls
                        </h2>
                        <p className="text-xs sm:text-sm text-gray-400 font-mono mt-1 uppercase tracking-widest">Session Management & Analytics</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 hover:bg-red-500/20 border border-transparent hover:border-red-500/50 rounded-xl transition-all duration-300 group"
                    >
                        <X size={24} className="text-gray-400 group-hover:text-red-400 transition-colors" />
                    </button>
                </div>

                {/* Main Content */}
                {showScores ? (
                    // Scores View
                    <div className="flex-1 overflow-auto p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-mono text-green-400 uppercase tracking-wider">Game: {selectedGame}</h3>
                            <button
                                onClick={() => setShowScores(false)}
                                className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/20 hover:border-green-500/50 text-white font-mono text-xs uppercase rounded-lg transition-all"
                            >
                                ← Back to Games
                            </button>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-green-500/20">
                            <table className="w-full text-sm font-mono border-collapse">
                                <thead>
                                    <tr className="bg-green-500/10 border-b-2 border-green-500/30">
                                        <th className="text-left py-4 px-6 text-green-400 uppercase font-bold">Email</th>
                                        <th className="text-right py-4 px-4 text-green-400 uppercase font-bold">R1</th>
                                        <th className="text-right py-4 px-4 text-green-400 uppercase font-bold">R2</th>
                                        <th className="text-right py-4 px-4 text-green-400 uppercase font-bold">R3</th>
                                        <th className="text-right py-4 px-4 text-green-400 uppercase font-bold">R4</th>
                                        <th className="text-right py-4 px-4 text-green-400 uppercase font-bold">R5</th>
                                        <th className="text-right py-4 px-4 text-green-400 uppercase font-bold">R6</th>
                                        <th className="text-right py-4 px-6 text-green-400 uppercase font-bold text-lg">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {scores.map((score, idx) => (
                                        <tr key={idx} className="border-b border-white/5 hover:bg-green-500/5 transition-colors">
                                            <td className="py-4 px-6 text-white">{score.player_email}</td>
                                            <td className={`text-right py-4 px-4 ${score.round_1 > 0 ? 'text-green-400 font-bold' : score.round_1 < 0 ? 'text-red-400' : 'text-gray-600'}`}>
                                                {score.round_1 || '-'}
                                            </td>
                                            <td className={`text-right py-4 px-4 ${score.round_2 > 0 ? 'text-green-400 font-bold' : score.round_2 < 0 ? 'text-red-400' : 'text-gray-600'}`}>
                                                {score.round_2 || '-'}
                                            </td>
                                            <td className={`text-right py-4 px-4 ${score.round_3 > 0 ? 'text-green-400 font-bold' : score.round_3 < 0 ? 'text-red-400' : 'text-gray-600'}`}>
                                                {score.round_3 || '-'}
                                            </td>
                                            <td className={`text-right py-4 px-4 ${score.round_4 > 0 ? 'text-green-400 font-bold' : score.round_4 < 0 ? 'text-red-400' : 'text-gray-600'}`}>
                                                {score.round_4 || '-'}
                                            </td>
                                            <td className={`text-right py-4 px-4 ${score.round_5 > 0 ? 'text-green-400 font-bold' : score.round_5 < 0 ? 'text-red-400' : 'text-gray-600'}`}>
                                                {score.round_5 || '-'}
                                            </td>
                                            <td className={`text-right py-4 px-4 ${score.round_6 > 0 ? 'text-green-400 font-bold' : score.round_6 < 0 ? 'text-red-400' : 'text-gray-600'}`}>
                                                {score.round_6 || '-'}
                                            </td>
                                            <td className={`text-right py-4 px-6 font-black text-lg ${score.total_points > 0 ? 'text-green-400' : score.total_points < 0 ? 'text-red-400' : 'text-white'}`}>
                                                {score.total_points > 0 ? '+' : ''}{score.total_points}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    // Games Table
                    <div className="flex-1 overflow-auto">
                        {games.length === 0 ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-center p-12">
                                    <div className="text-6xl mb-4">🎮</div>
                                    <p className="text-3xl font-mono text-gray-400 uppercase mb-3">No Games Yet</p>
                                    <p className="text-sm text-gray-600 font-mono">Start a game to see history here</p>
                                </div>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm font-mono border-collapse">
                                    <thead className="sticky top-0 bg-gradient-to-r from-[#0a0a0f] via-[#0f0f15] to-[#0a0a0f] border-b-2 border-green-500/40 backdrop-blur-sm">
                                        <tr>
                                            <th className="text-left py-5 px-6 text-green-400 uppercase font-bold tracking-wider">Game ID</th>
                                            <th className="text-center py-5 px-6 text-green-400 uppercase font-bold tracking-wider">Status</th>
                                            <th className="text-center py-5 px-6 text-green-400 uppercase font-bold tracking-wider">Round</th>
                                            <th className="text-center py-5 px-6 text-green-400 uppercase font-bold tracking-wider">Created</th>
                                            <th className="text-center py-5 px-6 text-green-400 uppercase font-bold tracking-wider">Saved</th>
                                            <th className="text-center py-5 px-6 text-green-400 uppercase font-bold tracking-wider">Controls</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <AnimatePresence mode="popLayout">
                                            {paginatedGames.map((game) => (
                                                <motion.tr
                                                    key={game.id}
                                                    initial={{ opacity: 0, y: -10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, x: -100, height: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="border-b border-white/10 hover:bg-gradient-to-r hover:from-green-500/5 hover:to-transparent transition-all"
                                                >
                                                    <td className="py-5 px-6 text-cyan-400 font-bold tracking-wider">{game.id}</td>
                                                    <td className="py-5 px-6 text-center">
                                                        <span className={`px-4 py-1.5 rounded-full text-xs uppercase font-bold tracking-wider ${game.status === 'active' ? 'bg-green-500/20 text-green-400 border-2 border-green-500/60 shadow-[0_0_15px_rgba(34,197,94,0.3)]' :
                                                            game.status === 'saved' ? 'bg-blue-500/20 text-blue-400 border-2 border-blue-500/60' :
                                                                'bg-red-500/20 text-red-400 border-2 border-red-500/60'
                                                            }`}>
                                                            {game.status}
                                                        </span>
                                                    </td>
                                                    <td className="py-5 px-6 text-center text-white font-bold text-base">
                                                        {game.current_round}/{game.total_rounds}
                                                    </td>
                                                    <td className="py-5 px-6 text-center text-gray-400">
                                                        {new Date(game.created_at).toLocaleDateString()}
                                                    </td>
                                                    <td className="py-5 px-6 text-center text-gray-400">
                                                        {game.saved_at ? new Date(game.saved_at).toLocaleDateString() : '-'}
                                                    </td>
                                                    <td className="py-5 px-6">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                onClick={() => handleViewScores(game.id)}
                                                                className="p-2.5 bg-blue-500/10 hover:bg-blue-500/25 border border-blue-500/40 hover:border-blue-400 text-blue-400 hover:text-blue-300 rounded-lg transition-all hover:scale-110 hover:shadow-[0_0_15px_rgba(59,130,246,0.4)]"
                                                                title="View Scores"
                                                            >
                                                                <Eye size={18} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleReset(game.id)}
                                                                disabled={game.status !== 'active'}
                                                                className="p-2.5 bg-yellow-500/10 hover:bg-yellow-500/25 border border-yellow-500/40 hover:border-yellow-400 text-yellow-400 hover:text-yellow-300 rounded-lg transition-all hover:scale-110 disabled:opacity-20 disabled:cursor-not-allowed hover:shadow-[0_0_15px_rgba(234,179,8,0.4)]"
                                                                title="Reset Game"
                                                            >
                                                                <RotateCcw size={18} />
                                                            </button>
                                                            <button
                                                                onClick={() => setGameToDelete(game.id)}
                                                                className="p-2.5 bg-red-500/10 hover:bg-red-500/25 border border-red-500/40 hover:border-red-400 text-red-400 hover:text-red-300 rounded-lg transition-all hover:scale-110 hover:shadow-[0_0_15px_rgba(239,68,68,0.4)]"
                                                                title="Delete Game"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleSave(game.id)}
                                                                disabled={game.status !== 'active'}
                                                                className="p-2.5 bg-green-500/10 hover:bg-green-500/25 border border-green-500/40 hover:border-green-400 text-green-400 hover:text-green-300 rounded-lg transition-all hover:scale-110 disabled:opacity-20 disabled:cursor-not-allowed hover:shadow-[0_0_15px_rgba(34,197,94,0.4)]"
                                                                title="Save & New"
                                                            >
                                                                <Save size={18} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </AnimatePresence>
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Footer with Pagination */}
                {!showScores && games.length > 0 && (
                    <div className="p-5 border-t-2 border-green-500/30 bg-gradient-to-r from-green-500/5 to-transparent flex items-center justify-between">
                        <div className="text-sm text-gray-400 font-mono">
                            Showing <span className="text-green-400 font-bold">{page * itemsPerPage + 1}-{Math.min((page + 1) * itemsPerPage, games.length)}</span> of <span className="text-green-400 font-bold">{games.length}</span> games
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                disabled={page === 0}
                                className="p-2.5 bg-white/5 hover:bg-green-500/20 border border-white/20 hover:border-green-500/50 rounded-lg disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronLeft size={20} className="text-white" />
                            </button>
                            <span className="text-white font-mono text-sm px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                                Page <span className="text-green-400 font-bold">{page + 1}</span> / {totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                disabled={page >= totalPages - 1}
                                className="p-2.5 bg-white/5 hover:bg-green-500/20 border border-white/20 hover:border-green-500/50 rounded-lg disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronRight size={20} className="text-white" />
                            </button>
                        </div>
                    </div>
                )}

                {loading && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center rounded-2xl z-50">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-16 w-16 border-4 border-green-500 border-t-transparent mb-4 mx-auto"></div>
                            <div className="text-white font-mono text-lg uppercase tracking-wider">Processing...</div>
                        </div>
                    </div>
                )}

                {/* Toast Notification */}
                <AnimatePresence>
                    {toast && (
                        <motion.div
                            initial={{ opacity: 0, y: -50 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -50 }}
                            className="absolute top-6 right-6 z-[9999]"
                        >
                            <div className={`flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl border-2 font-mono ${toast.type === 'success' ? 'bg-green-500/20 border-green-500 text-green-400' :
                                toast.type === 'error' ? 'bg-red-500/20 border-red-500 text-red-400' :
                                    'bg-blue-500/20 border-blue-500 text-blue-400'
                                }`}>
                                {toast.type === 'success' && <CheckCircle size={20} />}
                                {toast.type === 'error' && <AlertCircle size={20} />}
                                {toast.type === 'info' && <Info size={20} />}
                                <span className="font-bold uppercase tracking-wide">{toast.message}</span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Delete Confirmation Modal */}
                <AnimatePresence>
                    {gameToDelete && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center z-[9999] rounded-2xl p-4"
                            onClick={() => setGameToDelete(null)}
                        >
                            <motion.div
                                initial={{ scale: 0.9, y: 20, opacity: 0 }}
                                animate={{ scale: 1, y: 0, opacity: 1 }}
                                exit={{ scale: 0.9, y: 20, opacity: 0 }}
                                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                                onClick={(e) => e.stopPropagation()}
                                className="relative bg-[#fcfaf2] border-[12px] border-[#d4af37] rounded-[2rem] p-10 max-w-md w-full shadow-[0_0_100px_rgba(212,175,55,0.3),inset_0_0_40px_rgba(0,0,0,0.1)] overflow-hidden"
                            >
                                {/* Card Corner Symbols */}
                                <div className="absolute top-4 left-4 flex flex-col items-center leading-none">
                                    <span className="text-2xl font-bold text-red-700">A</span>
                                    <span className="text-xl text-red-700">♦</span>
                                </div>
                                <div className="absolute top-4 right-4 flex flex-col items-center leading-none">
                                    <span className="text-2xl font-bold text-black">A</span>
                                    <span className="text-xl text-black">♠</span>
                                </div>
                                <div className="absolute bottom-4 left-4 flex flex-col items-center leading-none rotate-180">
                                    <span className="text-2xl font-bold text-black font-serif">A</span>
                                    <span className="text-xl text-black">♣</span>
                                </div>
                                <div className="absolute bottom-4 right-4 flex flex-col items-center leading-none rotate-180">
                                    <span className="text-2xl font-bold text-red-700">A</span>
                                    <span className="text-xl text-red-700">♥</span>
                                </div>

                                {/* Ornate Internal Frame */}
                                <div className="absolute inset-4 border border-[#d4af37]/30 rounded-[1.5rem] pointer-events-none" />

                                <div className="relative z-10 text-center space-y-6">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-16 h-16 rounded-full bg-red-700/10 border-2 border-red-700/30 flex items-center justify-center shadow-inner">
                                            <Trash2 size={32} className="text-red-700" />
                                        </div>
                                        <h3 className="text-3xl font-cinzel font-black text-gray-900 uppercase tracking-tighter">Terminate</h3>
                                        <div className="h-0.5 w-24 bg-gradient-to-r from-transparent via-[#d4af37] to-transparent" />
                                    </div>

                                    <div className="space-y-4">
                                        <p className="text-gray-800 font-serif text-lg leading-tight p-4 border-y border-[#d4af37]/20">
                                            Permanently remove game <br />
                                            <span className="text-red-700 font-black text-xl tracking-widest">{gameToDelete}</span>?
                                        </p>
                                        <div className="bg-[#f5f2e8] rounded-xl p-4 border border-[#d4af37]/20 flex items-start gap-3 shadow-sm">
                                            <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
                                            <p className="text-[#5c4d26] font-mono text-[10px] text-left uppercase leading-relaxed">
                                                Warning: This action is irreversible. All session data within this protocol will be purged from the archive.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex gap-4 pt-4">
                                        <button
                                            onClick={() => setGameToDelete(null)}
                                            className="flex-1 px-6 py-4 bg-white hover:bg-gray-100 border-2 border-gray-200 text-gray-600 font-black font-mono text-xs uppercase rounded-xl transition-all active:scale-95 shadow-md"
                                        >
                                            RETAIN
                                        </button>
                                        <button
                                            onClick={() => handleDelete(gameToDelete)}
                                            className="flex-1 px-6 py-4 bg-red-700 hover:bg-red-800 border-2 border-red-900 text-white font-black font-mono text-xs uppercase rounded-xl transition-all active:scale-95 shadow-[0_4px_15px_rgba(185,28,28,0.4)]"
                                        >
                                            PURGE
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </motion.div>
    );
};
