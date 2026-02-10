// Hearts Game Settings Modal with Delete Confirmation
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye, RotateCcw, Trash2, Save, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../../supabaseClient';

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
    total_points: number;
}

interface Toast {
    message: string;
    type: 'success' | 'error' | 'info';
}

export const HeartsGameSettingsModal = ({ onClose }: GameSettingsModalProps) => {
    const [games, setGames] = useState<GameSession[]>([]);
    const [selectedGame, setSelectedGame] = useState<string | null>(null);
    const [scores, setScores] = useState<RoundScore[]>([]);
    const [showScores, setShowScores] = useState(false);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [_toast, setToast] = useState<Toast | null>(null);
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
            .from('hearts_game_sessions')
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
            .from('hearts_round_points')
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

    const handleReset = async (gameId: string) => {
        if (!confirm('⚠️ RESET GAME\n\nRevert all Visa points for this game?')) return;

        setLoading(true);
        try {
            const { data: pointsData } = await supabase
                .from('hearts_round_points')
                .select('player_email, total_points')
                .eq('game_id', gameId);

            if (pointsData) {
                for (const player of pointsData) {
                    await supabase.rpc('adjust_visa_points', {
                        p_email: player.player_email,
                        p_adjustment: -player.total_points
                    });
                }

                await supabase.from('hearts_round_points').delete().eq('game_id', gameId);
                await supabase.from('hearts_game_sessions').update({
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
            // Step 1: Clear reference if active and PERFORM DEEP RESET
            await supabase.from('hearts_game_state').update({
                active_game_id: null,
                current_round: 0,
                system_start: false,
                phase: 'idle',
                participants: [],
                groups: {},
                cards: {},
                guesses: {},
                eliminated: [],
                winners: [],
                chat_counts: {}
            }).eq('active_game_id', gameId);
            // Step 2: Delete points
            await supabase.from('hearts_round_points').delete().eq('game_id', gameId);
            // Step 3: Delete session
            const { error } = await supabase.from('hearts_game_sessions').delete().eq('id', gameId);

            if (error) {
                showToast(`Delete failed: ${error.message}`, 'error');
            } else {
                setGames(prev => prev.filter(g => g.id !== gameId));
                showToast('Game deleted successfully', 'success');
            }
        } catch (error) {
            showToast('Delete failed', 'error');
        }
        setLoading(false);
        setGameToDelete(null);
    };

    const handleSave = async (gameId: string) => {
        if (!confirm('💾 SAVE & NEW GAME\n\nFinalize this session and start fresh?')) return;

        setLoading(true);
        try {
            await supabase.from('hearts_game_sessions').update({
                status: 'saved',
                saved_at: new Date().toISOString()
            }).eq('id', gameId);

            const generate18DigitId = () => {
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                let result = 'HRTS-';
                for (let i = 0; i < 13; i++) {
                    result += chars.charAt(Math.floor(Math.random() * chars.length));
                }
                return result;
            };

            const newGameId = generate18DigitId();
            await supabase.from('hearts_game_sessions').insert({
                id: newGameId,
                status: 'active',
                current_round: 0,
                total_rounds: 5
            });

            await supabase.from('hearts_game_state').update({
                active_game_id: newGameId,
                current_round: 0,
                system_start: false,
                phase: 'idle',
                participants: [],
                groups: {},
                cards: {},
                guesses: {},
                eliminated: [],
                winners: [],
                chat_counts: {}
            }).eq('id', 'hearts_main');

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
                className="bg-gradient-to-br from-[#0a0a0f] via-[#0f0f15] to-[#0a0a0f] border-2 border-red-500/40 rounded-2xl w-full max-w-7xl h-[90vh] flex flex-col shadow-[0_0_80px_rgba(239,68,68,0.3)] overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b-2 border-red-500/30 bg-gradient-to-r from-red-500/5 to-transparent">
                    <div>
                        <h2 className="text-3xl sm:text-4xl font-display font-bold text-white uppercase tracking-wider flex items-center gap-3">
                            <span className="text-red-400">◈</span> Hearts Game Management
                        </h2>
                        <p className="text-xs sm:text-sm text-gray-400 font-mono mt-1 uppercase tracking-widest">Protocol Archive & Controls</p>
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
                    <div className="flex-1 overflow-auto p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-mono text-red-400 uppercase tracking-wider">Game: {selectedGame}</h3>
                            <button onClick={() => setShowScores(false)} className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/20 hover:border-red-500/50 text-white font-mono text-xs uppercase rounded-lg transition-all">
                                ← Back to Games
                            </button>
                        </div>
                        <div className="overflow-x-auto rounded-xl border border-red-500/20">
                            <table className="w-full text-sm font-mono border-collapse">
                                <thead>
                                    <tr className="bg-red-500/10 border-b-2 border-red-500/30">
                                        <th className="text-left py-4 px-6 text-red-400 uppercase font-bold">Player</th>
                                        <th className="text-right py-4 px-4 text-red-400 uppercase font-bold">R1</th>
                                        <th className="text-right py-4 px-4 text-red-400 uppercase font-bold">R2</th>
                                        <th className="text-right py-4 px-4 text-red-400 uppercase font-bold">R3</th>
                                        <th className="text-right py-4 px-4 text-red-400 uppercase font-bold">R4</th>
                                        <th className="text-right py-4 px-4 text-red-400 uppercase font-bold">R5</th>
                                        <th className="text-right py-4 px-6 text-red-400 uppercase font-bold text-lg">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {scores.map((score, idx) => (
                                        <tr key={idx} className="border-b border-white/5 hover:bg-red-500/5 transition-colors">
                                            <td className="py-4 px-6 text-white">{score.player_email}</td>
                                            {[1, 2, 3, 4, 5].map(r => {
                                                const val = (score as any)[`round_${r}`];
                                                return (
                                                    <td key={r} className={`text-right py-4 px-4 ${val > 0 ? 'text-green-400 font-bold' : val < 0 ? 'text-red-400' : 'text-gray-600'}`}>
                                                        {val || '-'}
                                                    </td>
                                                );
                                            })}
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
                    <div className="flex-1 overflow-auto">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm font-mono border-collapse">
                                <thead className="sticky top-0 bg-[#0a0a0f] border-b-2 border-red-500/40 backdrop-blur-sm">
                                    <tr>
                                        <th className="text-left py-5 px-6 text-red-400 uppercase font-bold tracking-wider">Session ID</th>
                                        <th className="text-center py-5 px-6 text-red-400 uppercase font-bold tracking-wider">Status</th>
                                        <th className="text-center py-5 px-6 text-red-400 uppercase font-bold tracking-wider">Round</th>
                                        <th className="text-center py-5 px-6 text-red-400 uppercase font-bold tracking-wider">Created</th>
                                        <th className="text-center py-5 px-6 text-red-400 uppercase font-bold tracking-wider">Controls</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <AnimatePresence mode="popLayout">
                                        {paginatedGames.map((game) => (
                                            <motion.tr key={game.id} className="border-b border-white/10 hover:bg-red-500/5 transition-all">
                                                <td className="py-5 px-6 text-red-400 font-bold tracking-wider">{game.id}</td>
                                                <td className="py-5 px-6 text-center">
                                                    <span className={`px-4 py-1.5 rounded-full text-xs uppercase font-bold tracking-wider ${game.status === 'active' ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-red-500/20 text-red-400 border border-red-500/50'}`}>
                                                        {game.status}
                                                    </span>
                                                </td>
                                                <td className="py-5 px-6 text-center text-white">{game.current_round}/{game.total_rounds}</td>
                                                <td className="py-5 px-6 text-center text-gray-400">{new Date(game.created_at).toLocaleDateString()}</td>
                                                <td className="py-5 px-6">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button onClick={() => handleViewScores(game.id)} className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg transition-all" title="View Scores"><Eye size={16} /></button>
                                                        <button onClick={() => handleReset(game.id)} disabled={game.status !== 'active'} className="p-2 bg-yellow-500/10 hover:bg-yellow-500/25 border border-yellow-500/40 text-yellow-400 rounded-lg transition-all disabled:opacity-20" title="Reset Session"><RotateCcw size={16} /></button>
                                                        <button onClick={() => setGameToDelete(game.id)} className="p-2 bg-red-500/10 hover:bg-red-500/25 border border-red-500/40 text-red-400 rounded-lg transition-all" title="Delete Session"><Trash2 size={16} /></button>
                                                        <button onClick={() => handleSave(game.id)} disabled={game.status !== 'active'} className="p-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg transition-all disabled:opacity-20" title="Save & New"><Save size={16} /></button>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Footer with Pagination */}
                {!showScores && games.length > 0 && (
                    <div className="p-5 border-t-2 border-red-500/30 flex items-center justify-between">
                        <div className="text-sm text-gray-400 font-mono">
                            Page <span className="text-red-400 font-bold">{page + 1}/{totalPages}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-2 bg-white/5 hover:bg-red-500/20 border border-white/10 rounded-lg disabled:opacity-20 transition-all"><ChevronLeft size={20} className="text-white" /></button>
                            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-2 bg-white/5 hover:bg-red-500/20 border border-white/10 rounded-lg disabled:opacity-20 transition-all"><ChevronRight size={20} className="text-white" /></button>
                        </div>
                    </div>
                )}

                {loading && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center rounded-2xl z-50">
                        <div className="animate-spin rounded-full h-16 w-16 border-4 border-red-500 border-t-transparent mb-4"></div>
                    </div>
                )}

                {/* Delete Confirmation Overlay */}
                <AnimatePresence>
                    {gameToDelete && (
                        <div className="absolute inset-0 bg-black/95 flex items-center justify-center z-[300] cursor-pointer" onClick={() => setGameToDelete(null)}>
                            <div className="bg-[#0a0a0f] border-2 border-red-500 p-8 rounded-2xl max-w-md text-center relative cursor-default" onClick={e => e.stopPropagation()}>
                                <button
                                    onClick={() => setGameToDelete(null)}
                                    className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full text-gray-500 hover:text-white transition-all"
                                >
                                    <X size={20} />
                                </button>
                                <Trash2 size={48} className="text-red-500 mx-auto mb-4" />
                                <h3 className="text-2xl font-bold text-white mb-2 uppercase">Terminate Session?</h3>
                                <p className="text-gray-400 mb-6 font-mono text-sm leading-relaxed">This will permanently purge session data <span className="text-red-500 font-bold">{gameToDelete}</span> from the protocol archives.</p>
                                <div className="flex gap-4">
                                    <button onClick={() => setGameToDelete(null)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-lg transition-all uppercase text-xs">Retain</button>
                                    <button onClick={() => handleDelete(gameToDelete)} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-all uppercase text-xs">Purge</button>
                                </div>
                            </div>
                        </div>
                    )}
                </AnimatePresence>
            </motion.div>
        </motion.div>
    );
};
