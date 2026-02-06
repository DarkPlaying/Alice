import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, LogOut } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface PlayerCardModalProps {
    user: any;
    onClose: () => void;
    currentGameScore?: number;  // Optional: current score in active game
}

export const PlayerCardModal = ({ user, onClose, currentGameScore }: PlayerCardModalProps) => {
    // Determine user role properties


    // Generate some display values if they don't exist
    // In a real app, these would come from the user profile
    const displayId = user?.displayId || `#PLAYER_${user?.uid?.substring(0, 3).toUpperCase() || '000'}`;
    const identity = user?.username || user?.email?.split('@')[0].toUpperCase() || 'UNKNOWN SUBJ';

    // Local state for fetched stats
    // Use currentGameScore if in active game, otherwise fetch from database
    const [stats, setStats] = useState({
        points: currentGameScore ?? user?.visa_points ?? 1000,
        wins: user?.wins ?? 0,
        losses: user?.losses ?? 0,
        visaDays: currentGameScore ?? user?.visa_points ?? 1000
    });

    useEffect(() => {
        const fetchStats = async () => {
            // If we have currentGameScore, we still want to fetch the latest profile stats (Wins/Losses)
            // so we DO NOT return early anymore.
            if (currentGameScore !== undefined) {
                setStats(prev => ({
                    ...prev,
                    points: currentGameScore,
                    visaDays: currentGameScore
                }));
                // Continue to fetch profile for background stats...
            }

            const userEmail = user?.email;
            const username = user?.username || user?.email?.split('@')[0];

            if (!userEmail) {
                console.warn('[PROFILE] No email found');
                return;
            }

            try {
                // 1. Try to fetch existing profile first
                let { data: existingData, error: fetchError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('email', userEmail)
                    .single();

                if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "Row not found"
                    console.warn('[PROFILE] Fetch error:', fetchError.message);
                }

                // 2. If not found, create it
                if (!existingData) {
                    console.log('[PROFILE] Profile not found, creating new...');
                    const { data: newData, error: insertError } = await supabase
                        .from('profiles')
                        .insert([{
                            email: userEmail,
                            username: username,
                            visa_points: 1000,
                            wins: 0,
                            losses: 0
                        }])
                        .select()
                        .single();

                    if (insertError) {
                        console.warn('[PROFILE] Creation failed (likely race condition):', insertError.message);
                        // Retry fetch one last time
                        const { data: retryData } = await supabase
                            .from('profiles')
                            .select('*')
                            .eq('email', userEmail)
                            .single();
                        existingData = retryData;
                    } else {
                        existingData = newData;
                    }
                }

                if (existingData) {
                    console.log('[PROFILE] Profile loaded:', existingData);
                }

                // Then fetch current values by email
                console.log('[PROFILE] Fetching stats for email:', userEmail);
                const { data, error } = await supabase
                    .from('profiles')
                    .select('visa_points, wins, losses, username')
                    .eq('email', userEmail)
                    .single();

                if (data) {
                    console.log('[PROFILE] Fetched data:', data);
                    console.log('[PROFILE] Setting visa_points:', data.visa_points);
                    setStats({
                        points: data.visa_points ?? 1000,
                        wins: data.wins ?? 0,
                        losses: data.losses ?? 0,
                        visaDays: data.visa_points ?? 1000
                    });
                } else if (error) {
                    console.error("[PROFILE] Error fetching stats:", error);
                }
            } catch (err) {
                console.error("[PROFILE] Error in fetchStats:", err);
            }
        };

        fetchStats();

        // Realtime Subscription by email
        const userEmail = user?.email;
        if (userEmail) {
            const channel = supabase
                .channel(`profile_updates_${userEmail}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'profiles',
                        filter: `email=eq.${userEmail}`
                    },
                    (payload) => {
                        console.log('[REALTIME] Profile Update received!', payload.new);
                        const newData = payload.new;
                        setStats({
                            points: newData.visa_points ?? 1000,
                            wins: newData.wins ?? 0,
                            losses: newData.losses ?? 0,
                            visaDays: newData.visa_points ?? 1000
                        });
                    }
                )
                .subscribe((status) => {
                    console.log('[REALTIME] Subscription status:', status);
                });

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [user]);

    const { points, wins, losses, visaDays } = stats;


    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-[#050508] border border-white/20 w-full max-w-lg rounded-xl overflow-hidden shadow-2xl relative"
                >
                    {/* Header Code - No Change */}
                    <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                        <div className="flex items-center gap-3">
                            <Activity className="w-5 h-5 text-green-500" />
                            <h2 className="text-xl font-bold tracking-widest text-white">PLAYER PROFILE</h2>
                        </div>
                        <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
                            <LogOut className="w-5 h-5 rotate-180" />
                        </button>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Identity Section */}
                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-1">
                                <label className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">Subject ID</label>
                                <div className="text-lg font-bold text-red-500 font-mono tracking-wider">#{displayId}</div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">Passcode Data</label>
                                <div className="flex items-center gap-2">
                                    <div className="flex gap-1">
                                        {[...Array(8)].map((_, i) => (
                                            <div key={i} className="w-1 h-1 bg-gray-600 rounded-full" />
                                        ))}
                                    </div>
                                    <span className="text-[10px] bg-red-900/40 text-red-400 px-1 py-0.5 rounded border border-red-500/20">ENCRYPTED</span>
                                </div>
                            </div>
                        </div>

                        {/* Player Info */}
                        <div className="grid grid-cols-2 gap-8 pt-4 border-t border-white/5">
                            <div className="space-y-1">
                                <label className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">Identity</label>
                                <div className="text-xl font-medium text-white">{identity}</div>
                                <div className="text-xs text-gray-500 font-mono mt-1">{user?.email}</div>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">Visa Status</label>
                                    <div className="flex items-center gap-2 text-xs font-mono">
                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                        <span className="text-green-500">ACTIVE • {visaDays} DAYS</span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">Role Classification</label>
                                    <div className="text-green-500 font-bold tracking-wider text-sm">CITIZEN</div>
                                </div>
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="space-y-2 pt-4 border-t border-white/5">
                            <label className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">Performance Metrics</label>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-yellow-500/10 rounded p-3 border border-yellow-500/20 flex flex-col items-center justify-center">
                                    <div className="text-2xl font-bold text-yellow-500 mb-1">{points}</div>
                                    <div className="text-[9px] text-yellow-600/60 uppercase tracking-wider font-bold">Points</div>
                                </div>
                                <div className="bg-green-500/10 rounded p-3 border border-green-500/20 flex flex-col items-center justify-center">
                                    <div className="text-2xl font-bold text-green-500 mb-1">{wins}</div>
                                    <div className="text-[9px] text-green-600/60 uppercase tracking-wider font-bold">Games Cleared</div>
                                </div>
                                <div className="bg-red-500/10 rounded p-3 border border-red-500/20 flex flex-col items-center justify-center">
                                    <span className="text-2xl font-bold text-red-500">{losses}</span>
                                    <span className="text-[9px] text-red-600/60 uppercase tracking-wider font-bold">FAILURES</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-white/20">
                            <span>SERVER NODE: TOKYO_03</span>
                            <span>//</span>
                            <span>CONNECTION SECURE</span>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
