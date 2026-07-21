// CACHE BUSTER V2: FORCING VITE TO RECOMPILE
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, User, Activity, Shield, LogOut, Database, Clock, Spade, Club, Diamond, Heart, Grid, Radio, AlertTriangle, Upload, FileText, Download, Trash2, RotateCcw, CheckSquare, Square, Crown, Menu, X, ArrowLeft, Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Settings, PieChart as PieChartIcon, BarChart3, MessageSquare } from 'lucide-react';
import Papa from 'papaparse';

import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseKey, getAccessToken } from '../supabaseClient';
import { PlayerCardModal } from './PlayerCardModal';
import { MiniChart } from './ui/mini-chart';
import { PieChart } from './ui/pie-chart';
import { Line, LineChart, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';

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

const getAdminAuthClient = () => {
    return createClient('https://ssirmxujmdhdhmnqxfxi.supabase.co', 'sb_publishable_8aNc7iJaeXfRI2jOwHccrQ_dFMYz6fT', {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false,

            storageKey: 'borderland-admin-v2',
            lock: async (_name: string, ...args: any[]) => {
                // Bypass navigator.locks entirely to prevent Vite HMR deadlocks
                const acquire = args.pop();
                if (typeof acquire === 'function') {
                    return await acquire();
                }
            }
        }
    });
};

import { PlayerCache } from '../lib/playerCache';
import { VisaManagement } from './admin/VisaManagement';

import { HeartsGameMaster } from './games/HeartsGameMaster';
import { SpadesGameMaster } from './games/SpadesGameMaster';
import { ClubsGameMaster } from './games/ClubsGameMaster';
import { GameSettingsModal } from './admin/GameSettingsModal';
import { HeartsGameSettingsModal } from './admin/HeartsGameSettingsModal';
import { generateGameId } from '../utils/gameId';
import { TravelCard } from './ui/card-7';

interface AdminDashboardProps {
    onLogout: () => void;
}

export const AdminDashboard = ({ onLogout }: AdminDashboardProps) => {
    const navigate = useNavigate();

    // Platform data for line chart (sample data)
    const platformData = [
        { date: '2024-04-01', orders: 222, response: 150, revenue: 8.2, customers: 420 },
        { date: '2024-04-02', orders: 97, response: 180, revenue: 4.5, customers: 290 },
        { date: '2024-04-03', orders: 167, response: 120, revenue: 6.8, customers: 380 },
        { date: '2024-04-04', orders: 242, response: 260, revenue: 9.1, customers: 520 },
        { date: '2024-04-05', orders: 301, response: 340, revenue: 11.2, customers: 620 },
        { date: '2024-04-06', orders: 59, response: 110, revenue: 2.8, customers: 180 },
        { date: '2024-04-07', orders: 261, response: 190, revenue: 9.8, customers: 510 },
        { date: '2024-04-08', orders: 327, response: 350, revenue: 12.1, customers: 650 },
        { date: '2024-04-09', orders: 89, response: 150, revenue: 3.8, customers: 220 },
        { date: '2024-04-10', orders: 195, response: 165, revenue: 7.2, customers: 390 },
        { date: '2024-04-11', orders: 224, response: 170, revenue: 8.5, customers: 450 },
        { date: '2024-04-12', orders: 387, response: 290, revenue: 13.8, customers: 710 },
        { date: '2024-04-13', orders: 215, response: 250, revenue: 8.2, customers: 430 },
        { date: '2024-04-14', orders: 75, response: 130, revenue: 3.1, customers: 190 },
        { date: '2024-04-15', orders: 122, response: 180, revenue: 5.1, customers: 300 },
        { date: '2024-04-16', orders: 197, response: 160, revenue: 7.5, customers: 390 },
        { date: '2024-04-17', orders: 473, response: 380, revenue: 17.2, customers: 890 },
        { date: '2024-04-18', orders: 338, response: 400, revenue: 12.9, customers: 670 },
    ];

    // Generate line chart data from profiles (visa points over time by creation date)
    const generateLineChartData = () => {
        const allPlayers = players.filter(p => p.role === 'player' && p.created_at);
        const dailyStats: Record<string, { visa_points: number; wins: number; losses: number; count: number }> = {};

        allPlayers.forEach(p => {
            const date = new Date(p.created_at).toISOString().split('T')[0];
            if (!dailyStats[date]) {
                dailyStats[date] = { visa_points: 0, wins: 0, losses: 0, count: 0 };
            }
            dailyStats[date].visa_points += p.visa_points ?? 0;
            dailyStats[date].wins += p.wins ?? 0;
            dailyStats[date].losses += p.losses ?? 0;
            dailyStats[date].count += 1;
        });

        return Object.entries(dailyStats)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-14) // Last 14 days
            .map(([date, stats]) => ({
                date,
                visa_points: Math.round(stats.visa_points / stats.count),
                wins: stats.wins,
                losses: stats.losses,
                players: stats.count,
            }));
    };

    // Game-specific default view modes
    const getViewMode = (suitId: string): 'chat' | 'bar' | 'pie' | 'line' => {
        switch (suitId) {
            case 'spades': return 'line';
            case 'clubs': return 'chat';
            case 'diamonds': return 'pie';
            case 'hearts': return 'bar';
            default: return 'chat';
        }
    };

    // Track view mode overrides per suit
    const [viewModeOverrides, setViewModeOverrides] = useState<Record<string, 'chat' | 'bar' | 'pie' | 'line'>>({});
    const setViewMode = (suitId: string, mode: 'chat' | 'bar' | 'pie' | 'line') => {
        setViewModeOverrides(prev => ({ ...prev, [suitId]: mode }));
    };
    const getEffectiveViewMode = (suitId: string): 'chat' | 'bar' | 'pie' | 'line' => {
        return viewModeOverrides[suitId] || getViewMode(suitId);
    };
    const navigateToView = (view: typeof activeView) => {
        if (['spades', 'clubs', 'diamonds', 'hearts'].includes(activeView)) {
            setViewModeOverrides(prev => {
                const next = { ...prev };
                delete next[activeView];
                return next;
            });
        }
        setActiveView(view);
    };

    // Player chart navigation (7 players per page)
    const [chartPlayerPage, setChartPlayerPage] = useState<Record<string, number>>({});
    const PLAYERS_PER_CHART_PAGE = 7;

    const getChartPlayerPage = (suitId: string) => chartPlayerPage[suitId] || 0;
    const setChartPlayerPageFn = (suitId: string, page: number) => {
        setChartPlayerPage(prev => ({ ...prev, [suitId]: page }));
    };

    // Selected pie segment info per suit
    const [selectedPieInfo, setSelectedPieInfo] = useState<Record<string, { label: string; value: number; color: string; total: number } | null>>({});

    const [secondsLeft, setSecondsLeft] = useState(2712); // 45:12
    const [jitter, setJitter] = useState(0);
    const [networkPing, setNetworkPing] = useState<number | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [adminSettings, setAdminSettings] = useState<any>(null);
    const [showAdminCard, setShowAdminCard] = useState(false);
    const [systemLogs, setSystemLogs] = useState<string[]>([
        `[${new Date(Date.now() - 90000).toLocaleTimeString()}] CRITICAL: Arena Hearts security handshake established`,
        `[${new Date(Date.now() - 80000).toLocaleTimeString()}] Laser grid calibration sequence: OK`,
        `[${new Date(Date.now() - 70000).toLocaleTimeString()}] VISA validation engine active`,
        `[${new Date(Date.now() - 60000).toLocaleTimeString()}] WARNING: Player 492 pulse elevated`,
        `[${new Date(Date.now() - 50000).toLocaleTimeString()}] System check complete. Grid stable.`,
        `[${new Date(Date.now() - 40000).toLocaleTimeString()}] Arena Spades participant count synced`,
        `[${new Date(Date.now() - 30000).toLocaleTimeString()}] Bio-metric override authorized for Sector 7`,
        `[${new Date(Date.now() - 20000).toLocaleTimeString()}] Network latency within operational limits (12ms)`,
        `[${new Date(Date.now() - 10000).toLocaleTimeString()}] Admin session heartbeat: DETECTED`,
        `[${new Date().toLocaleTimeString()}] Ready for deployment. All systems NOMINAL.`
    ]);
    const [activeView, setActiveView] = useState<'dashboard' | 'players' | 'masters' | 'spades' | 'clubs' | 'diamonds' | 'hearts'>('dashboard');
    const [roundMonitorPage, setRoundMonitorPage] = useState<Record<string, number>>({});
    const [players, setPlayers] = useState<any[]>([]);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [customDialog, setCustomDialog] = useState<{
        title: string;
        message: string;
        type: 'alert' | 'confirm' | 'confirm_three_options' | 'prompt';
        resolve: (val: any) => void;
        defaultValue?: string;
    } | null>(null);

    const [promptValue, setPromptValue] = useState('');

    const sectionMotionDefaults = {
        initial: { opacity: 0, y: 30 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -20, transition: { duration: 0.15, ease: 'easeIn' as const } },
        transition: { duration: 0.4, ease: 'easeOut' as const },
    } as const;

    const suitHexColor = (id: string) =>
        id === 'clubs' ? '#22c55e' : id === 'spades' ? '#3b82f6' : id === 'diamonds' ? '#a855f7' : '#ef4444';

    const sectionRise = {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.28, ease: 'easeOut' as const },
    } as const;

    // Real-time System Logs for player activity
    useEffect(() => {
        const fetchInitialLogs = async () => {
            try {
                const { data, error } = await supabase
                    .from('system_logs')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(30);

                if (error) {
                    console.error("[ADMIN] Log Fetch Error:", error);
                    return;
                }

                if (data && data.length > 0) {
                    const dbLogs = data.map(log => `[${new Date(log.created_at).toLocaleTimeString()}] ${log.message}`);
                    setSystemLogs(prev => {
                        // Merge and keep total count under 50
                        const combined = [...dbLogs, ...prev];
                        return Array.from(new Set(combined)).slice(0, 50);
                    });
                }
            } catch (err) {
                console.warn("[ADMIN] Could not reach system_logs table.");
            }
        };

        fetchInitialLogs();

        // 1. Database Table Listener
        const dbChannel = supabase.channel('system_logs_db')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'system_logs' }, (payload) => {
                const newLog = payload.new as any;
                const time = new Date(newLog.created_at).toLocaleTimeString();
                const msg = `[${time}] ${newLog.message}`;
                setSystemLogs(prev => [msg, ...prev].slice(0, 50));
            })
            .subscribe();

        // 2. Direct Broadcast Fallback (Instant, doesn't wait for DB replication)
        const broadcastChannel = supabase.channel('admin_signals')
            .on('broadcast', { event: 'player_entry' }, (payload) => {
                const time = new Date().toLocaleTimeString();
                const msg = `[${time}] ${payload.payload.message}`;
                setSystemLogs(prev => [msg, ...prev].slice(0, 50));
            })
            .subscribe();

        // 3. Profiles Listener (Wins/Losses)
        const profileChannel = supabase.channel('profile_updates')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
                const newData = payload.new as any;
                const oldData = payload.old as any;
                if (!newData.username) return;

                const time = new Date().toLocaleTimeString();
                let msg = "";
                if (newData.visa_points !== oldData.visa_points) msg = `[${time}] Player "${newData.username}" visa updated: ${newData.visa_points}`;
                else if (newData.wins !== oldData.wins) msg = `[${time}] Player "${newData.username}" RECORDED A VICTORY`;
                else if (newData.losses !== oldData.losses) msg = `[${time}] Player "${newData.username}" recorded a casualty (LOSS)`;

                if (msg) setSystemLogs(prev => [msg, ...prev].slice(0, 50));
            })
            .subscribe();

        return () => {
            supabase.removeChannel(dbChannel);
            supabase.removeChannel(broadcastChannel);
            supabase.removeChannel(profileChannel);
        };
    }, []);

    const sectionFloat = {
        initial: { opacity: 0, scale: 0.96, y: 10 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.98, y: 5, transition: { duration: 0.05, ease: 'easeIn' as const } },
        transition: { type: 'spring' as const, damping: 24, stiffness: 280 },
    } as const;

    const getPlayerElementKey = (player: any, index: number, prefix = 'player') => {
        const baseId = player.user_id || player.id || player.username;
        return `${prefix}-${baseId ? String(baseId) : index}`;
    };

    const getStableKey = (base: any, fallback: string) => {
        const rawKey = base ?? '';
        const asString = String(rawKey).trim();
        return asString || fallback;
    };

    const showAlert = (title: string, message: string): Promise<void> => {
        return new Promise((resolve) => {
            setCustomDialog({ title, message, type: 'alert', resolve });
        });
    };

    const showConfirm = (title: string, message: string): Promise<boolean> => {
        return new Promise((resolve) => {
            setCustomDialog({ title, message, type: 'confirm', resolve });
        });
    };

    const showConfirmThreeOptions = (title: string, message: string): Promise<'ok' | 'cancel' | 'alt'> => {
        return new Promise((resolve) => {
            setCustomDialog({ title, message, type: 'confirm_three_options', resolve });
        });
    };

    const showPrompt = (title: string, message: string, defaultValue = ''): Promise<string | null> => {
        setPromptValue(defaultValue);
        return new Promise((resolve) => {
            setCustomDialog({ title, message, type: 'prompt', resolve, defaultValue });
        });
    };

    // Keep seconds left counting down
    useEffect(() => {
        const timer = setInterval(() => {
            setSecondsLeft(prev => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Real-time clock
    useEffect(() => {
        const clock = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(clock);
    }, []);

    // Network ping (measure round-trip to Supabase)
    useEffect(() => {
        const measurePing = async () => {
            const start = performance.now();
            try {
                await supabase.from('profiles').select('id').limit(1).maybeSingle();
                setNetworkPing(Math.round(performance.now() - start));
            } catch {
                setNetworkPing(null);
            }
        };
        measurePing();
        const pingInterval = setInterval(measurePing, 10000);
        return () => clearInterval(pingInterval);
    }, []);

    // Jitter for system metrics
    useEffect(() => {
        const interval = setInterval(() => {
            setJitter((Math.random() * 0.2 - 0.1));
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    // Load admin settings and subscribe in real-time
    useEffect(() => {
        const fetchSettings = async () => {
            const { data } = await supabase.from('profiles').select('*').eq('id', '00000000-0000-0000-0000-000000000000').maybeSingle();
            if (data) {
                setAdminSettings(data);
            } else {
                const { data: newRow } = await supabase.from('profiles').insert({
                    id: '00000000-0000-0000-0000-000000000000',
                    username: 'admin_settings',
                    email: 'admin_settings@borderland.app',
                    role: 'admin',
                    visa_points: 0
                }).select().maybeSingle();
                if (newRow) setAdminSettings(newRow);
            }
        };
        fetchSettings();

        const channel = supabase.channel('settings_realtime')
            .on('postgres_changes', { event: '*', filter: "id=eq.00000000-0000-0000-0000-000000000000", schema: 'public', table: 'profiles' }, (payload) => {
                setAdminSettings(payload.new);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Generate live logins logs by others in real-time



    const handleEmergencyPurgeToggle = async () => {
        try {
            const isPurged = adminSettings?.role === 'maintenance';
            // Show confirmation FIRST before any async work (prevents perceived delay)
            if (!isPurged) {
                const confirmed = await showConfirm('EMERGENCY PURGE', 'Activate maintenance lockdown? All players will be frozen immediately. Use RESUME to restore access.');
                if (!confirmed) return;
            }

            const nextStatus = isPurged ? 'admin' : 'maintenance';

            const { error: settingsError } = await supabase
                .from('profiles')
                .update({ role: nextStatus })
                .eq('id', '00000000-0000-0000-0000-000000000000');

            if (settingsError) throw settingsError;

            // Optimistically update the UI
            setAdminSettings((prev: any) => ({ ...prev, role: nextStatus }));

            if (!isPurged) {
                // ACTIVATE maintenance — broadcast to all players, do NOT touch visa_points
                await supabase.channel('admin-broadcast').send({
                    type: 'broadcast',
                    event: 'maintenance',
                    payload: { active: true, message: 'System maintenance in progress. Please stand by.' }
                });
            } else {
                // DEACTIVATE maintenance — broadcast resume
                await supabase.channel('admin-broadcast').send({
                    type: 'broadcast',
                    event: 'maintenance',
                    payload: { active: false, message: 'System is back online.' }
                });
                showAlert("MAINTENANCE MODE CLEARED", "System is back online. All player data is intact.");
            }
        } catch (err: any) {
            console.error("Maintenance toggle error:", err);
            showAlert("COMMAND REJECTED", "Failed to broadcast maintenance override.");
        }
    };

    const handleSendBroadcast = async (msg: string) => {
        if (!msg.trim()) return;
        try {
            // Update the admin_settings row so players can pick it up via postgres_changes
            const { error } = await supabase
                .from('profiles')
                .update({
                    email: `broadcast:${msg}:${Date.now()}` // encode message in email field as trigger
                })
                .eq('id', '00000000-0000-0000-0000-000000000000');
            if (error) throw error;

            // Also fire a Supabase Realtime broadcast for instant delivery
            await supabase.channel('admin-broadcast').send({
                type: 'broadcast',
                event: 'admin_message',
                payload: { message: msg, timestamp: Date.now() }
            });

            showAlert("BROADCAST TRANSMITTED", `Message delivered to all active sessions: "${msg}"`);
        } catch (err) {
            console.error("Broadcast transmission error:", err);
            showAlert("TRANSMISSION ERROR", "Failed to deliver broadcast message.");
        }
    };

    // Derived dashboard stats
    const activePlayersCount = players.filter(p => p.role === 'player' && p.visa_points !== null && p.visa_points !== undefined && p.visa_points >= 0).length;

    // Casualties = % of players with bottom-half (lowest) average points
    const allPlayerPoints = players
        .filter(p => p.role === 'player' && p.visa_points !== null && p.visa_points !== undefined)
        .map(p => p.visa_points as number);
    const maxPoints = allPlayerPoints.length > 0 ? Math.max(...allPlayerPoints) : 1;
    const bottomHalfAvg = allPlayerPoints.length > 0
        ? (allPlayerPoints.filter(v => v <= maxPoints / 2).length / allPlayerPoints.length * 100)
        : 0;
    const casualtyValue = bottomHalfAvg.toFixed(1) + '%';

    // Sys. Integrity = % of players with top-half (highest) average points
    const topHalfAvg = allPlayerPoints.length > 0
        ? (allPlayerPoints.filter(v => v > maxPoints / 2).length / allPlayerPoints.length * 100)
        : 98.2 + jitter;
    const sysIntegrity = topHalfAvg.toFixed(1) + '%';

    // Time Remaining = current realtime clock
    const timeRemainingDisplay = currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const getGamePlayerCount = (gameKey: string) => {
        return players.filter(p =>
            p.role === 'player' &&
            p.visa_points !== null && p.visa_points !== undefined && p.visa_points >= 0 &&
            p.waiting_for_game &&
            p.waiting_for_game.toLowerCase().includes(gameKey)
        ).length;
    };

    const dashboardStats = [
        { label: 'Active Players', value: activePlayersCount.toString(), icon: Users, color: 'text-cyan-400' },
        { label: 'Casualties', value: casualtyValue, icon: Activity, color: 'text-red-500' },
        { label: 'Sys. Integrity', value: sysIntegrity, icon: Shield, color: 'text-green-400' },
        { label: 'Time Remaining', value: timeRemainingDisplay, icon: Clock, color: 'text-yellow-400' },
    ];


    // ... suits definition ...
    const suits = [
        { name: 'SPADES', type: 'Physical', id: 'spades', icon: Spade, color: 'text-blue-400', dotColor: 'bg-blue-400', status: 'Active', description: "Strength, endurance, and physical agility are tested." },
        { name: 'CLUBS', type: 'Team', id: 'clubs', icon: Club, color: 'text-green-400', dotColor: 'bg-green-400', status: 'Stable', description: "Cooperation and balancing individual vs group needs." },
        { name: 'DIAMONDS', type: 'Intellect', id: 'diamonds', icon: Diamond, color: 'text-purple-400', dotColor: 'bg-purple-400', status: 'Analyzing', description: "Logic, mathematics, and strategy are essential." },
        { name: 'HEARTS', type: 'Psychological', id: 'hearts', icon: Heart, color: 'text-red-500', dotColor: 'bg-red-500', status: 'Critical', description: "Trust, betrayal, and emotional manipulation." },
    ];

    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
    const fileInputRef = useRef<HTMLInputElement>(null);

    // DELETION & UNDO STATE
    const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
    const [deletedBackup, setDeletedBackup] = useState<any[]>([]);
    const [lastActionType, setLastActionType] = useState<'delete' | 'create'>('delete');
    const [showUndo, setShowUndo] = useState(false);
    const [isPurging, setIsPurging] = useState(false); // Visual effect state

    // TOAST STATE
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToast({ message, type });
        // Auto-dismiss
        setTimeout(() => setToast(null), 4000);
    };

    // TRACKING STATE
    const [trackingPlayer, setTrackingPlayer] = useState<any | null>(null);
    const [clubsIDMap, setClubsIDMap] = useState<Record<string, string>>({});





    // MOBILE STATE
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [sidebarToggleRotation, setSidebarToggleRotation] = useState(0);

    // CLUBS STATE
    const [clubsMessages, setClubsMessages] = useState<any[]>([]);

    // Unified ID Generation: First-Speaker gets #PLAYER_001, etc.
    // Unified ID Generation: Firebase 'players' list is Trusted Source -> Chat Backfill
    useEffect(() => {
        const map: Record<string, string> = {};
        let maxId = 0;

        // 1. Map from Official Firebase Players List (Preserves legacy order/IDs)
        if (players.length > 0) {
            players.forEach((p, index) => {
                const pid = `#PLAYER_${(index + 1).toString().padStart(3, '0')}`;
                maxId = index + 1;

                if (p.username) {
                    const name = p.username.trim();
                    // console.log("MAPPING_FB_ID:", name, pid);
                    map[name] = pid;
                    map[name.toLowerCase()] = pid;
                }
                // Map by Firebase ID too if available
                if (p.id) map[p.id] = pid;
            });
        }

        // 2. Backfill from Chat History (for users not in Firebase list)
        if (clubsMessages.length > 0) {
            // Sort by time
            const sorted = [...clubsMessages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

            sorted.forEach(m => {
                const name = m.user_name?.trim();
                if (name) {
                    const nameLower = name.toLowerCase();
                    if (!map[name] && !map[nameLower]) {
                        maxId++;
                        const pid = `#PLAYER_${maxId.toString().padStart(3, '0')}`;
                        // console.log("MAPPING_CHAT_BACKFILL:", name, pid);
                        map[name] = pid;
                        map[nameLower] = pid;
                    }
                }
            });
        }

        setClubsIDMap(map);
    }, [players, clubsMessages]);

    const [clubsCommsMode, setClubsCommsMode] = useState<'player' | 'master' | 'all'>('all');
    const [clubsSearchQuery, setClubsSearchQuery] = useState('');
    const [clubsFilterUserId, setClubsFilterUserId] = useState<string | null>(null);
    const [clubsGameStatus, setClubsGameStatus] = useState<any>({
        current_round: 0,
        votes_submitted: 0,
        is_active: false,
        is_paused: false,
        system_start: false
    });
    const [showStartModal, setShowStartModal] = useState(false);
    const [selectedSuitForModal, setSelectedSuitForModal] = useState<string | null>(null);
    const [waitingPlayers, setWaitingPlayers] = useState<any[]>([]);
    const [bannedPlayers, setBannedPlayers] = useState<any[]>([]);
    const bannedPlayersRef = useRef<any[]>([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);


    // GAME SETTINGS MODAL STATE
    const [showGameSettings, setShowGameSettings] = useState(false);
    const [showHeartsGameSettings, setShowHeartsGameSettings] = useState(false);
    const lobbyChannelRef = useRef<any>(null);
    const clubsControlChannelRef = useRef<any>(null);
    const diamondsControlChannelRef = useRef<any>(null);

    // HEARTS STATE
    const [heartsMessages, setHeartsMessages] = useState<any[]>([]);
    const [heartsSearchQuery, setHeartsSearchQuery] = useState('');
    const [heartsGameStatus, setHeartsGameStatus] = useState<any>({
        current_round: 0,
        is_active: false,
        is_paused: false,
        system_start: false
    });

    // Sync Hearts Status (Global for Headless)
    useEffect(() => {
        const channel = supabase.channel('admin_hearts_cx')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'hearts_game_state', filter: 'id=eq.hearts_main' }, (payload) => {
                setHeartsGameStatus((prev: any) => {
                    // Stale data protection
                    if (payload.new.phase_started_at && prev.phase_started_at) {
                        let newDStr = payload.new.phase_started_at.replace(' ', 'T');
                        if (newDStr.match(/[+-]\d{2}$/)) newDStr += ':00';

                        if (!newDStr.endsWith('Z') && !newDStr.match(/[+-]\d{2}:?\d{2}$/)) newDStr += 'Z';

                        let oldDStr = prev.phase_started_at.replace(' ', 'T');
                        if (oldDStr.match(/[+-]\d{2}$/)) oldDStr += ':00';

                        if (!oldDStr.endsWith('Z') && !oldDStr.match(/[+-]\d{2}:?\d{2}$/)) oldDStr += 'Z';

                        if (new Date(newDStr).getTime() < new Date(oldDStr).getTime()) {
                            return prev;
                        }
                    }
                    return { ...prev, ...payload.new };
                });
            })
            .subscribe();

        let isFetchingHearts = false;
        const fetchHeartsState = async () => {
            if (isFetchingHearts) return;
            isFetchingHearts = true;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            try {
                const accessToken = await getAccessToken();
                const response = await fetch(`${supabaseUrl}/rest/v1/hearts_game_state?id=eq.hearts_main&select=*`, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'apikey': supabaseKey,
                        'Accept': 'application/vnd.pgrst.object+json'
                    },
                    cache: 'no-store',
                    signal: controller.signal
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data && Object.keys(data).length > 0) {
                        setHeartsGameStatus((prev: any) => {
                            if (data.phase_started_at && prev.phase_started_at) {
                                let newDStr = data.phase_started_at.replace(' ', 'T');
                                if (newDStr.match(/[+-]\d{2}$/)) newDStr += ':00';

                                if (!newDStr.endsWith('Z') && !newDStr.match(/[+-]\d{2}:?\d{2}$/)) newDStr += 'Z';

                                let oldDStr = prev.phase_started_at.replace(' ', 'T');
                                if (oldDStr.match(/[+-]\d{2}$/)) oldDStr += ':00';

                                if (!oldDStr.endsWith('Z') && !oldDStr.match(/[+-]\d{2}:?\d{2}$/)) oldDStr += 'Z';

                                if (new Date(newDStr).getTime() < new Date(oldDStr).getTime()) {
                                    return prev;
                                }
                            }
                            return data;
                        });
                    }
                }
            } catch (err) {
                // Ignore
            } finally {
                clearTimeout(timeoutId);
                isFetchingHearts = false;
            }
        };

        fetchHeartsState();
        const pollInterval = setInterval(fetchHeartsState, 15000);

        return () => {
            clearInterval(pollInterval);
            supabase.removeChannel(channel);
        };
    }, []);

    // SPADES STATE
    const [spadesMessages, setSpadesMessages] = useState<any[]>([]);
    const [spadesSearchQuery, setSpadesSearchQuery] = useState('');
    const [spadesGameStatus, setSpadesGameStatus] = useState<any>({
        current_round: 0,
        is_active: false,
        is_paused: false,
        system_start: false
    });
    const [showEliminatedModal, setShowEliminatedModal] = useState<string | null>(null);


    const getEliminatedPlayers = () => {
        if (!showEliminatedModal) return [];
        if (showEliminatedModal === 'spades') {
            return Object.values(spadesGameStatus?.players || {}).filter((p: any) => !p.cards || p.cards.length === 0);
        }
        if (showEliminatedModal === 'clubs') {
            return Object.values(clubsGameStatus?.players || {}).filter((p: any) => p.status === 'eliminated' || p.eliminated);
        }
        if (showEliminatedModal === 'diamonds') {
            return Object.values(diamondsGameStatus?.players || {}).filter((p: any) => p.status === 'eliminated' || p.eliminated || p.visa_points <= 0);
        }
        if (showEliminatedModal === 'hearts') {
            return Object.values(heartsGameStatus?.players || {}).filter((p: any) => p.status === 'eliminated' || p.eliminated || p.health <= 0);
        }
        return [];
    };

    // Listen for Spades Updates (Global for Headless)
    useEffect(() => {
        const channel = supabase.channel('admin_spades_cx')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'spades_game_state', filter: 'id=eq.spades_main' }, (payload) => {
                setSpadesGameStatus((prev: any) => ({ ...prev, ...payload.new }));
            })
            .subscribe();

        // Initial Fetch
        let isFetchingSpades = false;
        const fetchSpadesState = async () => {
            if (isFetchingSpades) return;
            isFetchingSpades = true;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            try {
                const accessToken = await getAccessToken();
                const response = await fetch(`${supabaseUrl}/rest/v1/spades_game_state?id=eq.spades_main&select=*`, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'apikey': supabaseKey,
                        'Accept': 'application/vnd.pgrst.object+json'
                    },
                    signal: controller.signal
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.id) {
                        setSpadesGameStatus((prev: any) => {
                            if (prev.phase_started_at && data.phase_started_at) {
                                let prevDStr = prev.phase_started_at.replace(' ', 'T');
                                if (prevDStr.match(/[+-]\d{2}$/)) prevDStr += ':00';

                                if (!prevDStr.endsWith('Z') && !prevDStr.match(/[+-]\d{2}:?\d{2}$/)) prevDStr += 'Z';
                                let newDStr = data.phase_started_at.replace(' ', 'T');
                                if (newDStr.match(/[+-]\d{2}$/)) newDStr += ':00';

                                if (!newDStr.endsWith('Z') && !newDStr.match(/[+-]\d{2}:?\d{2}$/)) newDStr += 'Z';

                                if (new Date(newDStr).getTime() < new Date(prevDStr).getTime()) {
                                    return prev; // Ignore stale polling data
                                }
                            }
                            return data;
                        });
                    }
                }
            } catch (err) {
                // Ignore abort errors
            } finally {
                clearTimeout(timeoutId);
                isFetchingSpades = false;
            }
        };
        fetchSpadesState();

        // Polling Fallback (Every 15s) to handle Realtime drops/lag
        const pollInterval = setInterval(fetchSpadesState, 15000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(pollInterval);
        };
    }, []);

    // SPADES: Local Countdown Timer Effect
    const [spadesTimerDisplay, setSpadesTimerDisplay] = useState('0:00');
    useEffect(() => {
        if (!spadesGameStatus.is_active || !spadesGameStatus.phase_started_at || !spadesGameStatus.phase_duration_sec) {
            setSpadesTimerDisplay('0:00');
            return;
        }

        const interval = setInterval(() => {
            if (spadesGameStatus.is_paused) {
                const remaining = spadesGameStatus.phase_duration_sec;
                const fmt = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
                setSpadesTimerDisplay(fmt);
                return;
            }

            const now = new Date();
            let dStr = spadesGameStatus.phase_started_at.replace(' ', 'T');
            if (dStr.match(/[+-]\d{2}$/)) dStr += ':00';

            if (!dStr.endsWith('Z') && !dStr.match(/[+-]\d{2}:?\d{2}$/)) dStr += 'Z';
            const startedAt = new Date(dStr);
            const elapsed = Math.floor((now.getTime() - startedAt.getTime()) / 1000);
            const remaining = Math.max(0, spadesGameStatus.phase_duration_sec - elapsed);

            const fmt = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
            setSpadesTimerDisplay(fmt);
        }, 100); // 100ms for accurate visual sync

        return () => clearInterval(interval);
    }, [spadesGameStatus]);

    // HEARTS: Local Countdown Timer Effect
    const [heartsTimerDisplay, setHeartsTimerDisplay] = useState('0:00');
    useEffect(() => {
        if (!heartsGameStatus?.system_start || heartsGameStatus.phase === 'idle' || !heartsGameStatus.phase_started_at || !heartsGameStatus.phase_duration_sec) {
            setHeartsTimerDisplay('0:00');
            return;
        }

        const interval = setInterval(() => {
            if (heartsGameStatus.is_paused) {
                const remaining = heartsGameStatus.phase_duration_sec;
                const fmt = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
                setHeartsTimerDisplay(fmt);
                return;
            }

            const now = new Date();
            let dStr = heartsGameStatus.phase_started_at.replace(' ', 'T');
            if (dStr.match(/[+-]\d{2}$/)) dStr += ':00';

            if (!dStr.endsWith('Z') && !dStr.match(/[+-]\d{2}:?\d{2}$/)) dStr += 'Z';
            const startedAt = new Date(dStr);
            const elapsed = Math.floor((now.getTime() - startedAt.getTime()) / 1000);
            const remaining = Math.max(0, heartsGameStatus.phase_duration_sec - elapsed);

            const fmt = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
            setHeartsTimerDisplay(fmt);
        }, 100);

        return () => clearInterval(interval);
    }, [heartsGameStatus]);


    // CLUBS: Local Countdown Timer Effect
    const [clubsTimerDisplay, setClubsTimerDisplay] = useState('0:00');
    useEffect(() => {
        if (!clubsGameStatus?.system_start) {
            setClubsTimerDisplay('0:00');
            return;
        }

        if (clubsGameStatus?.is_paused) {
            const remaining = clubsGameStatus.round_data?.paused_remaining_sec || 0;
            const fmt = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
            setClubsTimerDisplay(fmt);
            return;
        }

        const phaseExpirySource = clubsGameStatus?.phase_expiry || clubsGameStatus?.round_data?.phase_expiry;
        if (!phaseExpirySource) {
            setClubsTimerDisplay('0:00');
            return;
        }

        const interval = setInterval(() => {
            const now = new Date();
            let dStr = phaseExpirySource.replace(' ', 'T');
            if (dStr.match(/[+-]\d{2}$/)) dStr += ':00';

            if (!dStr.endsWith('Z') && !dStr.match(/[+-]\d{2}:?\d{2}$/)) dStr += 'Z';
            const expiry = new Date(dStr);
            const remaining = Math.max(0, Math.floor((expiry.getTime() - now.getTime()) / 1000));

            const fmt = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
            setClubsTimerDisplay(fmt);
        }, 500);

        return () => clearInterval(interval);
    }, [clubsGameStatus]);

    // DIAMONDS STATE
    const [diamondsMessages, setDiamondsMessages] = useState<any[]>([]);
    const [diamondsSearchQuery, setDiamondsSearchQuery] = useState('');
    const [diamondsGameStatus, setDiamondsGameStatus] = useState<any>({
        current_round: 0,
        is_active: false,
        is_paused: false,
        system_start: false
    });

    // DIAMONDS: Local Countdown Timer Effect
    const [diamondsTimerDisplay, setDiamondsTimerDisplay] = useState('0:00');
    useEffect(() => {
        if (!diamondsGameStatus?.system_start || !diamondsGameStatus.phase_started_at || !diamondsGameStatus.phase_duration_sec) {
            setDiamondsTimerDisplay('0:00');
            return;
        }

        const interval = setInterval(() => {
            if (diamondsGameStatus.is_paused) {
                const remaining = diamondsGameStatus.phase_duration_sec;
                const fmt = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
                setDiamondsTimerDisplay(fmt);
                return;
            }

            const now = new Date();
            let dStr = diamondsGameStatus.phase_started_at.replace(' ', 'T');
            if (dStr.match(/[+-]\d{2}$/)) dStr += ':00';

            if (!dStr.endsWith('Z') && !dStr.match(/[+-]\d{2}:?\d{2}$/)) dStr += 'Z';
            const startedAt = new Date(dStr);
            const elapsed = Math.floor((now.getTime() - startedAt.getTime()) / 1000);
            const remaining = Math.max(0, diamondsGameStatus.phase_duration_sec - elapsed);

            const fmt = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
            setDiamondsTimerDisplay(fmt);
        }, 100);

        return () => clearInterval(interval);
    }, [diamondsGameStatus]);


    // Sync Diamonds (Global)
    useEffect(() => {
        let isFetchingDiamonds = false;
        const fetchDiamondsStatus = async () => {
            if (isFetchingDiamonds) return;
            isFetchingDiamonds = true;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            try {
                const accessToken = await getAccessToken();
                const response = await fetch(`${supabaseUrl}/rest/v1/diamonds_game_state?id=eq.diamonds_king&select=*`, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'apikey': supabaseKey,
                        'Accept': 'application/vnd.pgrst.object+json'
                    },
                    cache: 'no-store',
                    signal: controller.signal
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data && Object.keys(data).length > 0) {
                        setDiamondsGameStatus((prev: any) => {
                            if (data.phase_started_at && prev.phase_started_at) {
                                let newDStr = data.phase_started_at.replace(' ', 'T');
                                if (newDStr.match(/[+-]\d{2}$/)) newDStr += ':00';

                                if (!newDStr.endsWith('Z') && !newDStr.match(/[+-]\d{2}:?\d{2}$/)) newDStr += 'Z';

                                let oldDStr = prev.phase_started_at.replace(' ', 'T');
                                if (oldDStr.match(/[+-]\d{2}$/)) oldDStr += ':00';

                                if (!oldDStr.endsWith('Z') && !oldDStr.match(/[+-]\d{2}:?\d{2}$/)) oldDStr += 'Z';

                                if (new Date(newDStr).getTime() < new Date(oldDStr).getTime()) {
                                    return prev;
                                }
                            }
                            return data;
                        });
                    }
                }
            } catch (err) {
                // Ignore
            } finally {
                clearTimeout(timeoutId);
                isFetchingDiamonds = false;
            }
        };
        fetchDiamondsStatus();

        const channel = supabase.channel('admin_diamonds_cx')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'diamonds_game_state', filter: 'id=eq.diamonds_king' }, (payload) => {
                setDiamondsGameStatus((prev: any) => {
                    if (payload.new.phase_started_at && prev.phase_started_at) {
                        let newDStr = payload.new.phase_started_at.replace(' ', 'T');
                        if (newDStr.match(/[+-]\d{2}$/)) newDStr += ':00';

                        if (!newDStr.endsWith('Z') && !newDStr.match(/[+-]\d{2}:?\d{2}$/)) newDStr += 'Z';

                        let oldDStr = prev.phase_started_at.replace(' ', 'T');
                        if (oldDStr.match(/[+-]\d{2}$/)) oldDStr += ':00';

                        if (!oldDStr.endsWith('Z') && !oldDStr.match(/[+-]\d{2}:?\d{2}$/)) oldDStr += 'Z';

                        if (new Date(newDStr).getTime() < new Date(oldDStr).getTime()) {
                            return prev;
                        }
                    }
                    return { ...prev, ...payload.new };
                });
            })
            .subscribe();

        // Polling fallback every 15s to catch missed updates
        const interval = setInterval(fetchDiamondsStatus, 15000);

        // Persistent Broadcast Channel for Diamonds (Force Exit)
        const broadcastChannel = supabase.channel('diamonds_king_game');
        broadcastChannel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('[ADMIN] Connected to diamonds_king_game broadcast channel');
                diamondsControlChannelRef.current = broadcastChannel;
            }
        });

        return () => {
            supabase.removeChannel(channel);
            clearInterval(interval);
            if (diamondsControlChannelRef.current) {
                supabase.removeChannel(diamondsControlChannelRef.current);
                diamondsControlChannelRef.current = null;
            }
        };
    }, []);


    // Unified Waiting List Listener (Supabase Realtime + Firestore Backup)
    useEffect(() => {

        console.log("[ADMIN] Initializing Hybrid Presence Monitor...");
        const channel = supabase.channel('clubs_lobby', {
            config: {
                presence: {
                    key: 'admin'
                }
            }
        });
        lobbyChannelRef.current = channel;

        // We use refs to store the separate lists so we can merge them without race conditions
        const realtimeUsersRef = { current: [] as any[] };
        const firestoreUsersRef = { current: [] as any[] };

        // Helper to merge and set state
        const mergeAndSet = () => {
            const allUsers = [...realtimeUsersRef.current, ...firestoreUsersRef.current];

            // De-duplicate by user_id
            const uniqueUsers = Array.from(new Map(allUsers.map(u => [u.user_id || u.username, u])).values());

            // Filter out old entries (timeout: 5 mins) to keep list fresh? optional.
            // For now, raw list.

            console.log("[ADMIN] HYBRID MERGE:", {
                realtime: realtimeUsersRef.current.length,
                firestore: firestoreUsersRef.current.length,
                total: uniqueUsers.length
            });

            setWaitingPlayers(uniqueUsers);
        };

        // 1. Supabase Realtime Handler
        const updateRealtime = () => {
            const newState = channel.presenceState();
            const raw: any[] = [];
            for (const key in newState) {
                raw.push(...newState[key]);
            }
            const validRaw: any[] = [];
            for (const u of raw) {
                if (bannedPlayersRef.current.some(b => b.user_id === u.user_id)) {
                    // Auto-kick banned players
                    channel.send({
                        type: 'broadcast',
                        event: 'player_kick',
                        payload: { userId: u.user_id, username: u.username }
                    });
                } else {
                    validRaw.push(u);
                }
            }

            realtimeUsersRef.current = validRaw.map((u: any) => ({
                user_id: u.user_id,
                username: u.username,
                role: u.role,
                entered_at: u.entered_at,
                game_type: u.game_type?.toString().toLowerCase(),
                source: 'realtime'
            }));
            mergeAndSet();
        };

        channel
            .on('presence', { event: 'sync' }, updateRealtime)
            .on('presence', { event: 'join' }, updateRealtime)
            .on('presence', { event: 'leave' }, updateRealtime)
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log("[ADMIN] Realtime Subscribed.");
                    updateRealtime();
                }
            });



        return () => {
            console.log("[ADMIN] Cleaning up monitors...");
            supabase.removeChannel(channel);

            lobbyChannelRef.current = null;
            setWaitingPlayers([]);
        };
    }, []);

    const handleKickPlayer = async (userId: string, username: string) => {
        const ok = await showConfirm('REMOVE FROM QUEUE', `Remove "${username}" from the deployment queue?`);
        if (!ok) return;

        try {
            // 1. Clear Firestore status (Persistence)
            if (userId) {
                await supabase.from('profiles').update({ waiting_for_game: null }).eq('id', userId);
            }

            // Add to local banned list
            const newBanned = { user_id: userId, username };
            if (!bannedPlayersRef.current.some(p => p.user_id === userId)) {
                bannedPlayersRef.current = [...bannedPlayersRef.current, newBanned];
                setBannedPlayers(bannedPlayersRef.current);
            }

            // 2. Broadcast Transient Kick (Realtime)
            if (lobbyChannelRef.current) {
                await lobbyChannelRef.current.send({
                    type: 'broadcast',
                    event: 'player_kick',
                    payload: { userId, username }
                });
            }
            showToast(`REMOVED ${username} FROM QUEUE`, 'info');
        } catch (err) {
            console.error("Kick error:", err);
            showToast("FAILED TO REMOVE PLAYER", 'error');
        }
    };

    const handleGlobalPurgeQueue = async () => {
        const ok = await showConfirm('PURGE ALL QUEUES', 'This will clear all arena queues for ALL players. This action cannot be undone.');
        if (!ok) return;

        try {
            const { data, error } = await supabase.from('profiles').update({ waiting_for_game: null }).neq('waiting_for_game', null).select();
            if (error) throw error;
            if (!data || data.length === 0) {
                showToast("QUEUE IS ALREADY EMPTY", 'info');
                return;
            }
            const snapshot = { size: data.length };
            showToast(`PURGED ${snapshot.size} QUEUE ENTRIES`, 'success');

            // Force Realtime broadcast to everyone
            if (lobbyChannelRef.current) {
                await lobbyChannelRef.current.send({
                    type: 'broadcast',
                    event: 'force_exit',
                    payload: { reason: 'queue_purged' }
                });
            }
        } catch (err) {
            console.error("Purge error:", err);
            showToast("PURGE FAILED", 'error');
        }
    };


    // Sync Game Status
    useEffect(() => {
        if (activeView !== 'clubs') return;

        let isFetchingClubs = false;
        const fetchStatus = async () => {
            if (isFetchingClubs) return;
            isFetchingClubs = true;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            try {
                const accessToken = await getAccessToken();
                const response = await fetch(`${supabaseUrl}/rest/v1/clubs_game_status?id=eq.clubs_king&select=*`, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'apikey': supabaseKey,
                        'Accept': 'application/vnd.pgrst.object+json'
                    },
                    signal: controller.signal
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.id) {
                        setClubsGameStatus((prev: any) => {
                            if (prev.phase_expiry && data.phase_expiry) {
                                let prevDStr = prev.phase_expiry.replace(' ', 'T');
                                if (prevDStr.match(/[+-]\d{2}$/)) prevDStr += ':00';

                                if (!prevDStr.endsWith('Z') && !prevDStr.match(/[+-]\d{2}:?\d{2}$/)) prevDStr += 'Z';
                                let newDStr = data.phase_expiry.replace(' ', 'T');
                                if (newDStr.match(/[+-]\d{2}$/)) newDStr += ':00';

                                if (!newDStr.endsWith('Z') && !newDStr.match(/[+-]\d{2}:?\d{2}$/)) newDStr += 'Z';

                                if (new Date(newDStr).getTime() < new Date(prevDStr).getTime()) {
                                    return prev; // Ignore stale polling data
                                }
                            }
                            return data;
                        });
                    }
                }
            } catch (err) {
                // Ignore
            } finally {
                clearTimeout(timeoutId);
                isFetchingClubs = false;
            }
        };
        fetchStatus();

        // Autorefresh fallback (15s) to prevent state staleness
        const syncInterval = setInterval(fetchStatus, 15000);

        const channel = supabase
            .channel('admin_status_sync')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'clubs_game_status', filter: 'id=eq.clubs_king' }, (payload) => {
                setClubsGameStatus(payload.new);
            })
            .subscribe();

        // Persistent Broadcast Channel
        const broadcastChannel = supabase.channel('clubs_king_game');
        broadcastChannel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('[ADMIN] Connected to clubs_king_game broadcast channel');
                clubsControlChannelRef.current = broadcastChannel;
            }
        });

        return () => {
            supabase.removeChannel(channel);
            supabase.removeChannel(broadcastChannel);
            clubsControlChannelRef.current = null;
            clearInterval(syncInterval);
        };
    }, [activeView]);

    useEffect(() => {
        if (activeView !== 'clubs') return;

        // Fetch existing messages
        const fetchClubsChat = async () => {
            try {
                let query = supabase
                    .from('messages')
                    .select('*')
                    .eq('game_id', 'clubs_king');

                if (clubsCommsMode !== 'all') {
                    query.eq('channel', clubsCommsMode);
                }

                const { data, error } = await query
                    .order('created_at', { ascending: false })
                    .limit(100);

                if (error) {
                    console.error("ADMIN_COMMS_FETCH_ERROR:", error);
                    return;
                }
                if (data) {
                    // Removed excessive console.log to reduce noise
                    setClubsMessages(data);
                }
            } catch (err) {
                console.error("FETCH_EXCEPTION:", err);
                // Silently fail - don't break the UI
            }
        };

        fetchClubsChat();

        // Subscribe to new messages
        const channel = supabase
            .channel('admin_clubs_monitor')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'messages',
                filter: `game_id=eq.clubs_king` // Realtime filters are simple, we filter channel in JS below
            }, (payload) => {
                try {
                    if (payload.eventType === 'INSERT') {
                        // Filter channel in client for simplicity in Admin view
                        if (clubsCommsMode === 'all' || payload.new.channel === clubsCommsMode) {
                            setClubsMessages(prev => {
                                if (prev.some(m => m.id === payload.new.id)) return prev;
                                return [payload.new, ...prev];
                            });
                        }
                    } else if (payload.eventType === 'DELETE') {
                        setClubsMessages(prev => prev.filter(m => m.id !== payload.old.id));
                    }
                } catch (err) {
                    console.error("REALTIME_CALLBACK_ERROR:", err);
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [activeView, clubsCommsMode]);


    useEffect(() => {
        if (activeView !== 'hearts') return;

        // Subscribe to chat only - status sync is now global
        const fetchHeartsChat = async () => {
            try {
                let query = supabase
                    .from('messages')
                    .select('*')
                    .eq('game_id', 'hearts_main');

                const { data, error } = await query
                    .order('created_at', { ascending: false })
                    .limit(100);

                if (data) setHeartsMessages(data);
                if (error) console.error("HEARTS_CHAT_FETCH_ERROR:", error);
            } catch (err) {
                console.error("HEARTS_FETCH_EXCEPTION:", err);
            }
        };

        fetchHeartsChat();

        const channel = supabase
            .channel('admin_hearts_monitor')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'messages',
                filter: `game_id=eq.hearts_main`
            }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setHeartsMessages(prev => [payload.new, ...prev]);
                } else if (payload.eventType === 'DELETE') {
                    setHeartsMessages(prev => prev.filter(m => m.id !== payload.old.id));
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [activeView]);





    // SPADES SYNC - status sync
    useEffect(() => {
        if (activeView !== 'spades') return;

        const fetchChat = async () => {
            const { data } = await supabase
                .from('messages')
                .select('*')
                .eq('game_id', 'spades_main')
                .order('created_at', { ascending: false })
                .limit(100);
            if (data) setSpadesMessages(data);
        };
        fetchChat();

        const channel = supabase.channel('admin_spades_monitor')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: 'game_id=eq.spades_main' }, (payload: any) => {
                if (payload.eventType === 'INSERT') setSpadesMessages((prev) => [payload.new, ...prev]);
                else if (payload.eventType === 'DELETE') setSpadesMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'spades_game_state', filter: 'id=eq.spades_main' }, (payload: any) => {
                if (payload.new) {
                    setSpadesGameStatus((prev: any) => ({ ...prev, ...payload.new }));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeView]);

    // DIAMONDS SYNC - chat sync
    useEffect(() => {
        if (activeView !== 'diamonds') return;

        const fetchChat = async () => {
            const { data } = await supabase
                .from('messages')
                .select('*')
                .eq('game_id', 'diamonds_king')
                .order('created_at', { ascending: false })
                .limit(100);
            if (data) setDiamondsMessages(data);
        };
        fetchChat();

        const channel = supabase.channel('admin_diamonds_monitor')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: 'game_id=eq.diamonds_king' }, (payload: any) => {
                if (payload.eventType === 'INSERT') setDiamondsMessages((prev) => [payload.new, ...prev]);
                else if (payload.eventType === 'DELETE') setDiamondsMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [activeView]);

    const handleDeleteMessage = async (msgId: string, suitId: string) => {
        // Optimistic UI updates
        if (suitId === 'clubs') setClubsMessages(prev => prev.filter(m => m.id !== msgId));
        else if (suitId === 'hearts') setHeartsMessages(prev => prev.filter(m => m.id !== msgId));
        else if (suitId === 'spades') setSpadesMessages(prev => prev.filter(m => m.id !== msgId));
        else if (suitId === 'diamonds') setDiamondsMessages(prev => prev.filter(m => m.id !== msgId));

        const { error } = await supabase.from('messages').delete().eq('id', msgId);
        if (error) {
            console.error("ADMIN_DELETE_ERROR:", error);
            showToast("SYSTEM ERROR: UNABLE TO PURGE TRANSCRIPT.", 'error');
        }
    };

    const handlePurgeAllMessages = async (suitId: string) => {
        const gameId = suitId === 'hearts' ? 'hearts_main' : suitId === 'spades' ? 'spades_main' : suitId === 'diamonds' ? 'diamonds_king' : 'clubs_king';

        const ok = await showConfirm('PURGE TRANSCRIPTS', `This will permanently erase ALL ${suitId.toUpperCase()} transcripts. This cannot be undone.`);
        if (!ok) return;

        let query = supabase.from('messages').delete().eq('game_id', gameId);

        // Special handling for Clubs comms modes if needed
        if (suitId === 'clubs' && clubsCommsMode !== 'all') {
            query = query.eq('channel', clubsCommsMode);
        }

        const { error } = await query;

        if (!error) {
            if (suitId === 'clubs') setClubsMessages([]);
            else if (suitId === 'hearts') setHeartsMessages([]);
            else if (suitId === 'spades') setSpadesMessages([]);
            else if (suitId === 'diamonds') setDiamondsMessages([]);
            showToast(`${suitId.toUpperCase()} TRANSCRIPTS PURGED.`, 'success');
        } else {
            console.error("ADMIN_PURGE_ERROR:", error);
            showToast("PURGE FAILED.", 'error');
        }
    };

    const handleSelect = (id: string) => {
        // Prevent selecting System Admin
        const player = players.find(p => p.id === id);
        if (player && (player.username === 'admin' || player.role === 'admin')) return;

        if (selectedPlayers.includes(id)) {
            setSelectedPlayers(prev => prev.filter(pId => pId !== id));
        } else {
            setSelectedPlayers(prev => [...prev, id]);
        }
    };

    const handleSelectAll = () => {
        // Select based on current view visibility, BUT EXCLUDE MASTERS
        const visiblePlayers = players.filter(p => {
            const isAuthorized = activeView === 'masters'
                ? (p.role === 'master' || p.role === 'admin' || p.username === 'admin')
                : (p.username === 'admin' || p.role === 'player');
            // Allow selecting anyone EXCEPT System Admin
            return isAuthorized && !(p.username === 'admin' || p.role === 'admin');
        });
        const visibleIds = visiblePlayers.map(p => p.id);

        const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedPlayers.includes(id));

        if (allSelected) {
            setSelectedPlayers([]); // Deselect all
        } else {
            setSelectedPlayers(visibleIds);
        }
    };

    const handleDelete = async (idsToDelete: string[] = selectedPlayers) => {
        // Filter out admin just in case
        const safeIds = idsToDelete.filter(id => {
            const player = players.find(p => p.id === id);
            // Protect ONLY System Admin/Architect
            return player && !(player.username === 'admin' || player.role === 'admin');
        });

        if (safeIds.length === 0) {
            alert("SYSTEM ALERT: CANNOT DELETE SYSTEM ARCHITECT OR NO TARGETS SELECTED.");
            return;
        }

        // 1. Backup Data
        const backupNodes = players.filter(p => safeIds.includes(p.id));
        setDeletedBackup(backupNodes);

        // 2. Perform Deletion
        try {
            const { error } = await supabase.from('profiles').delete().in('id', safeIds);
            if (error) throw error;

            // Optimistic update to immediately reflect deletion in UI (in case Realtime is off)
            setPlayers(prev => prev.filter(p => !safeIds.includes(p.id)));

            // 3. Setup Undo
            setLastActionType('delete');
            setShowUndo(true);
            setSelectedPlayers([]); // Clear selection

        } catch (error) {
            console.error("Deletion failed:", error);
            alert("DELETION FAILED: SYSTEM ERROR");
        }
    };

    const handleUndo = async () => {
        if (!deletedBackup.length) return;

        try {
            if (lastActionType === 'delete') {
                const { error } = await supabase.from('profiles').insert(deletedBackup);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('profiles').delete().in('id', deletedBackup.map(u => u.id));
                if (error) throw error;
                alert("BATCH UPLOAD REVERTED. IDENTITIES PURGED.");
            }
            setShowUndo(false);
            setDeletedBackup([]);
        } catch (error) {
            console.error("Undo action failed:", error);
            alert("UNDO FAILED: LINK BROKEN.");
        }
    };



    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setUploadProgress({ current: 0, total: 0 });

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const users = results.data as { username: string; password: string }[];
                setUploadProgress({ current: 0, total: users.length });

                let successCount = 0;
                let failCount = 0;
                const createdPlayersTmp: any[] = [];

                const adminAuthClient = getAdminAuthClient();
                for (let i = 0; i < users.length; i++) {
                    const user = users[i];
                    try {
                        if (!user.username || !user.password) continue;

                        const sanitizedUsername = user.username.trim().toLowerCase().replace(/\s+/g, '');
                        const email = sanitizedUsername.includes('@') ? sanitizedUsername : `${sanitizedUsername}@borderland.app`;

                        const { data, error } = await adminAuthClient.auth.signUp({ email, password: user.password });
                        if (error) throw error;

                        // Direct REST call to bypass any client lock issues
                        const res = await fetch(`${supabaseUrl}/rest/v1/profiles`, {
                            method: 'POST',
                            headers: {
                                'apikey': supabaseKey,
                                'Authorization': `Bearer ${supabaseKey}`,
                                'Content-Type': 'application/json',
                                'Prefer': 'resolution=merge-duplicates'
                            },
                            body: JSON.stringify({
                                id: data.user?.id,
                                email: email,
                                username: user.username.split('@')[0],
                                role: activeView === 'masters' ? 'master' : 'player',
                                visa_points: 500
                            })
                        });

                        if (!res.ok) {
                            const errData = await res.json();
                            throw new Error("Profile creation failed: " + (errData.message || res.statusText));
                        }

                        createdPlayersTmp.push({ id: data.user?.id });
                        successCount++;
                    } catch (err) {
                        console.error(`Failed to create ${user.username}:`, err);
                        failCount++;
                    }
                    setUploadProgress(prev => ({ ...prev, current: i + 1 }));
                }
                setIsUploading(false);
                setCreateError(`BATCH COMPLETE: ${successCount} ISSUED, ${failCount} FAILED.`);
                if (fileInputRef.current) fileInputRef.current.value = '';

                // Force UI to refresh instantly
                if (successCount > 0) {
                    PlayerCache.clear();
                    setRefreshTrigger(prev => prev + 1);
                }

                // Setup Undo
                if (createdPlayersTmp.length > 0) {
                    setDeletedBackup(createdPlayersTmp);
                    setLastActionType('create');
                    setShowUndo(true);

                    // Auto-dismiss undo after 10s
                    setTimeout(() => setShowUndo(false), 10000);
                }
            }
        });
    };

    const handleCreatePlayer = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);
        setCreateError('');

        try {
            if (newPassword.length < 6) throw new Error("PASSWORD MUST BE AT LEAST 6 CHARACTERS.");

            const sanitizedUsername = newUsername.trim().toLowerCase().replace(/\s+/g, '');
            const email = sanitizedUsername.includes('@') ? sanitizedUsername : `${sanitizedUsername}@borderland.app`;

            const adminAuthClient = getAdminAuthClient();
            console.log("[ADMIN] Calling signUp...");
            const { data, error } = await adminAuthClient.auth.signUp({ email, password: newPassword });
            console.log("[ADMIN] signUp finished! Error:", error?.message, "User:", data?.user?.id);
            if (error) throw error;

            console.log("[ADMIN] Calling direct fetch upsert...");

            const res = await fetch(`${supabaseUrl}/rest/v1/profiles`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates'
                },
                body: JSON.stringify({
                    id: data.user?.id,
                    email: email,
                    username: sanitizedUsername.split('@')[0],
                    role: activeView === 'masters' ? 'master' : 'player',
                    visa_points: 500
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                console.error("[ADMIN] Upsert Error:", errData);
                throw new Error("Profile creation failed: " + (errData.message || res.statusText));
            }

            console.log("[ADMIN] upsert finished!");

            setNewUsername('');
            setNewPassword('');
            setShowCreateForm(false);

            // Force UI to refresh instantly
            PlayerCache.clear();
            setRefreshTrigger(prev => prev + 1);
            console.log("[ADMIN] Form cleared and list refreshed.");

            setDeletedBackup([{ id: data.user?.id }]);
            setLastActionType('create');
            setShowUndo(true);
            setTimeout(() => setShowUndo(false), 10000);
        } catch (err: any) {
            console.error("Creation Error:", err);
            setCreateError(err.message || "SYSTEM ERROR");
        } finally {
            setIsCreating(false);
        }
    };


    // Real-time User Listener with Smart Caching
    useEffect(() => {
        // 1. Try cache first (instant load)
        const cached = PlayerCache.get();
        if (cached) {
            console.log('[ADMIN] Using cached player data');
            setPlayers(cached);
        }

        const fetchProfiles = async () => {
            const { data, error } = await supabase.from('profiles').select('*');
            if (!error && data) {
                const playersData = data.sort((a: any, b: any) => {
                    const isMasterA = a.role === 'master' || a.role === 'admin' || a.username === 'admin';
                    const isMasterB = b.role === 'master' || b.role === 'admin' || b.username === 'admin';
                    if (isMasterA && !isMasterB) return -1;
                    if (!isMasterA && isMasterB) return 1;
                    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
                });
                setPlayers(playersData);
                PlayerCache.set(playersData);
            }
        };

        fetchProfiles();
        const channel = supabase.channel('public:profiles_admin')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload: any) => {
                if (payload.eventType === 'INSERT') {
                    setPlayers(prev => {
                        const newPlayers = [payload.new, ...prev].sort((a: any, b: any) => {
                            const isMasterA = a.role === 'master' || a.role === 'admin' || a.username === 'admin';
                            const isMasterB = b.role === 'master' || b.role === 'admin' || b.username === 'admin';
                            if (isMasterA && !isMasterB) return -1;
                            if (!isMasterA && isMasterB) return 1;
                            return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
                        });
                        PlayerCache.set(newPlayers);
                        return newPlayers;
                    });
                } else if (payload.eventType === 'UPDATE') {
                    setPlayers(prev => {
                        const newPlayers = prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p);
                        PlayerCache.set(newPlayers);
                        return newPlayers;
                    });
                } else if (payload.eventType === 'DELETE') {
                    setPlayers(prev => {
                        const newPlayers = prev.filter(p => p.id !== payload.old.id);
                        PlayerCache.set(newPlayers);
                        return newPlayers;
                    });
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeView, refreshTrigger]);

    // Clear selection when view changes
    useEffect(() => {
        setSelectedPlayers([]);
    }, [activeView]);

    const downloadSampleCsv = () => {
        const isMaster = activeView === 'masters';
        const headers = "username,password";
        const row = isMaster ? "master1,master_pass123" : "player1,player_pass123";
        const csvContent = `data:text/csv;charset=utf-8,${headers}\n${row}`;
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", isMaster ? "master_template.csv" : "visa_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadManifest = () => {
        const visibleUsers = players.filter(p =>
            activeView === 'masters'
                ? (p.role === 'master' || p.role === 'admin' || p.username === 'admin')
                : (p.username === 'admin' || p.role === 'player')
        );

        if (visibleUsers.length === 0) {
            alert("SYSTEM ERROR: NO DATA TO EXPORT.");
            return;
        }

        const headers = ["Username", "Email", "Role", "Status", "Entry Time"];
        const rows = visibleUsers.map(u => {
            const isSystem = u.username === 'admin' || u.role === 'admin';
            const isMasterFlag = isSystem || u.role === 'master';
            return [
                u.username || 'Unknown',
                u.email || 'N/A',
                isSystem ? 'system' : isMasterFlag ? 'master' : 'player',
                isSystem ? 'secure' : u.status || 'alive',
                new Date(u.created_at || Date.now()).toLocaleString()
            ];
        });

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${activeView}_manifest_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="min-h-[111.12vh] bg-black text-white font-sans block lg:flex relative overflow-hidden" style={{ zoom: 0.9 }}>
            <AnimatePresence>
                {['dashboard', 'players', 'masters'].includes(activeView) && (
                    <motion.div
                        key="admin-bg-image"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="absolute inset-0 pointer-events-none z-0"
                    >
                        <div className="absolute inset-0 bg-cover bg-center opacity-50" style={{ backgroundImage: "url('/admin bg.jpg')" }} />
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,100,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,100,0.03)_1px,transparent_1px)] bg-[size:40px_40px] mix-blend-overlay" />
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)]" />
                    </motion.div>
                )}
            </AnimatePresence>
            <AnimatePresence>
                {['spades', 'clubs', 'diamonds', 'hearts'].includes(activeView) && (
                    <motion.div
                        key="admin-bg-image"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="absolute inset-0 pointer-events-none z-0"
                    >
                        <div className="absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: "url('/admin bg.jpg')" }} />
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,100,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,100,0.03)_1px,transparent_1px)] bg-[size:40px_40px] mix-blend-overlay" />
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)]" />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Mobile Backdrop */}
            <AnimatePresence>
                {isSidebarOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsSidebarOpen(false)}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
                    />
                )}
            </AnimatePresence>

            {/* SYSTEM PURGE OVERLAY */}
            <AnimatePresence>
                {isPurging && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-red-950/90 backdrop-blur-md flex flex-col items-center justify-center pointer-events-none"
                    >
                        <AlertTriangle size={120} className="text-red-500 animate-pulse mb-8" />
                        <h2 className="text-6xl font-black text-red-500 tracking-[0.5em] glitch-text uppercase text-center">
                            SYSTEM PURGE
                        </h2>
                        <div className="mt-8 flex flex-col items-center gap-2">
                            <p className="font-mono text-red-400 uppercase tracking-widest text-xl">RESETTING ALL PROTOCOLS</p>
                            <div className="w-64 h-1 bg-red-900/50 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ x: '-100%' }}
                                    animate={{ x: '100%' }}
                                    transition={{ duration: 1.5, ease: "linear", repeat: Infinity }}
                                    className="w-full h-full bg-red-500"
                                />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            {/* LEft SIDEBAR */}
            <aside className={`
                border-r border-white/10 bg-transparent backdrop-blur-2xl flex flex-col gap-8 h-[111.12vh] z-40 overflow-y-auto admin-scrollbar transition-all duration-300
                ${isSidebarCollapsed ? 'w-[72px] p-3' : 'w-80 p-6'}
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                fixed lg:sticky top-0 left-0 lg:left-auto
            `}>
                {isSidebarCollapsed ? (
                    <div className="flex flex-col items-center gap-4">
                        <img src="/suit_assets/2.png" alt="Logo" className="h-6 w-auto shrink-0" />
                        <motion.button
                            onClick={() => { setIsSidebarCollapsed(!isSidebarCollapsed); setSidebarToggleRotation(prev => prev + 90); }}
                            className="p-2 rounded bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                            title="Expand Sidebar"
                            animate={{ rotate: sidebarToggleRotation }}
                            transition={{ duration: 0.4, type: 'spring', stiffness: 250, damping: 15 }}
                            whileTap={{ scale: 0.85 }}
                        >
                            <Menu size={18} />
                        </motion.button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <img src="/suit_assets/2.png" alt="Logo" className="h-7 w-auto shrink-0" />
                        <h1 className="font-display font-bold text-sm sm:text-base tracking-wider text-gray-400 whitespace-nowrap">
                            Admin Panel For Alice
                        </h1>
                        <motion.button
                            onClick={() => { setIsSidebarCollapsed(!isSidebarCollapsed); setSidebarToggleRotation(prev => prev + 90); }}
                            className="ml-auto p-2 rounded bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                            title="Collapse Sidebar"
                            animate={{ rotate: sidebarToggleRotation }}
                            transition={{ duration: 0.4, type: 'spring', stiffness: 250, damping: 15 }}
                            whileTap={{ scale: 0.85 }}
                        >
                            <X size={18} />
                        </motion.button>
                    </div>
                )}

                {/* Navigation */}
                <nav className={`${isSidebarCollapsed ? 'space-y-2' : 'space-y-2'}`}>
                    {[
                        { id: 'dashboard', icon: Activity, label: 'DASHBOARD', activeColor: 'text-red-500', activeBg: 'bg-red-500/10', activeBorder: 'border-red-500/20' },
                        { id: 'players', icon: Users, label: 'PLAYERS', activeColor: 'text-green-500', activeBg: 'bg-green-500/10', activeBorder: 'border-green-500/20' },
                        { id: 'masters', icon: Crown, label: 'MASTERS', activeColor: 'text-yellow-500', activeBg: 'bg-yellow-500/10', activeBorder: 'border-yellow-500/20' },
                    ].map((item, itemIdx) => (
                        <motion.button
                            key={`nav-${getStableKey(item.id, String(itemIdx))}`}
                            onClick={() => { navigateToView(item.id as any); setSelectedPlayers([]); setIsSidebarOpen(false); }}
                            title={item.label}
                            whileTap={{ scale: 0.97 }}
                            className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3 rounded text-base tracking-wider border transition-colors duration-200 ${activeView === item.id ? `${item.activeBg} ${item.activeColor} ${item.activeBorder}` : 'text-gray-400 hover:bg-white/5 hover:text-white border-transparent'}`}
                        >
                            <item.icon size={18} />
                            {!isSidebarCollapsed && item.label}
                        </motion.button>
                    ))}
                </nav>

                {/* Suits Section */}
                <div className={isSidebarCollapsed ? 'space-y-2' : 'space-y-4'}>
                    {!isSidebarCollapsed && <h3 className="text-xs font-bold text-gray-500 tracking-widest uppercase">Suit Protocols</h3>}
                    <div className={isSidebarCollapsed ? 'space-y-2' : 'grid gap-3'}>
                        {suits.map((suit, i) => (
                            <motion.button
                                key={getStableKey(suit.id, `suit-${i}`)}
                                onClick={() => { navigateToView(suit.id as any); setIsSidebarOpen(false); }}
                                whileHover={isSidebarCollapsed ? {} : { x: 4 }}
                                whileTap={{ scale: 0.97 }}
                                title={`${suit.name} — ${suit.type}`}
                                className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} p-3 border rounded-lg transition-colors duration-200 w-full ${isSidebarCollapsed ? '' : 'text-left'} ${activeView === suit.id ? 'bg-white/10 border-white/40' : 'bg-white/5 border-white/5 hover:border-white/20'}`}
                            >
                                <suit.icon className={`w-5 h-5 ${suit.color}`} />
                                {!isSidebarCollapsed && (
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center">
                                            <span className="text-base font-bold tracking-wider">{suit.name}</span>
                                            <span className={`w-2 h-2 rounded-full shadow-[0_0_6px_var(--dot-glow)] animate-pulse ${suit.dotColor}`} />
                                        </div>
                                        <div className="text-xs text-gray-500 uppercase">{suit.type}</div>
                                    </div>
                                )}
                            </motion.button>
                        ))}
                    </div>
                </div>

                {/* Broadcast Message */}
                <button
                    onClick={async () => {
                        const msg = await showPrompt('BROADCAST MESSAGE', 'system message to transmit to all players:', '');
                        if (msg) handleSendBroadcast(msg);
                    }}
                    title="Broadcast"
                    className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3 bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500 hover:text-white rounded-lg text-sm font-bold uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_10px_rgba(59,130,246,0.1)]`}
                >
                    <Radio size={18} />
                    {!isSidebarCollapsed && 'BROADCAST'}
                </button>

                {/* Admin Profile */}
                <div className="flex flex-col gap-1">
                    <button
                        onClick={() => setShowAdminCard(true)}
                        title={adminSettings?.username?.toUpperCase() || 'ADMIN_SETTINGS'}
                        className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} gap-2 px-2 py-2.5 sm:px-3 sm:py-3 bg-white/5 border border-white/10 rounded text-[9px] sm:text-[12px] hover:bg-white/10 transition-all cursor-pointer`}
                    >
                        <User size={18} className="text-gray-400 shrink-0" />
                        {!isSidebarCollapsed && (
                            <>
                                <span className="text-white font-bold">{adminSettings?.username?.toUpperCase() || 'ADMIN_SETTINGS'}</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                            </>
                        )}
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="w-full lg:flex-1 p-4 lg:p-8 h-[111.12vh] overflow-y-auto relative z-10 admin-scrollbar">

                {/* Header */}
                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8 lg:mb-12 border-b border-white/10 pb-6">
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="lg:hidden p-2 bg-white/5 rounded border border-white/10 text-gray-400 hover:text-white transition-colors"
                        >
                            <Menu size={20} />
                        </button>
                        <div>
                            <h2 className="text-xl lg:text-2xl font-bold tracking-widest text-white mb-1 flex items-center gap-2">
                                {activeView === 'dashboard' ? (
                                    <>
                                        <Activity size={24} className="text-cyan-400" />
                                        DASHBOARD OVERVIEW
                                    </>
                                ) : activeView === 'players' ? (
                                    <>
                                        <Users size={24} className="text-green-400" />
                                        PLAYER DATABASE
                                    </>
                                ) : activeView === 'masters' ? (
                                    <>
                                        <Shield size={24} className="text-yellow-400" />
                                        GAME MASTERS
                                    </>
                                ) : activeView === 'clubs' ? (
                                    <>
                                        <span className="text-3xl text-green-400 font-bold">♣</span>
                                        CLUBS PROTOCOL
                                    </>
                                ) : activeView === 'spades' ? (
                                    <>
                                        <span className="text-3xl text-blue-400 font-bold">♠</span>
                                        SPADES PROTOCOL
                                    </>
                                ) : activeView === 'diamonds' ? (
                                    <>
                                        <span className="text-3xl text-purple-400 font-bold">♦</span>
                                        DIAMONDS PROTOCOL
                                    </>
                                ) : activeView === 'hearts' ? (
                                    <>
                                        <span className="text-4xl text-red-500 font-bold">♥</span>
                                        HEARTS PROTOCOL
                                    </>
                                ) : (
                                    `PROTOCOL: ${String(activeView).toUpperCase()}`
                                )}
                            </h2>
                            <p className="text-[10px] text-gray-500 tracking-[0.2em] uppercase">
                                {activeView === 'dashboard' ? 'Monitoring System Status' : activeView === 'players' ? 'Visa Management' : activeView === 'masters' ? 'Admin Access Control' : `Active Game Management`}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 text-[9px] sm:text-[14px] lg:text-[15px] font-mono text-gray-400 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-white/5 pt-3 sm:pt-0">
                        {activeView === 'clubs' && (
                            <div className="flex items-center gap-4 border-r border-white/10 pr-4 mr-2">
                                <span className="flex items-center gap-2">
                                    <span className="text-xl font-bold text-green-500">♣</span>
                                    <span className={clubsGameStatus.is_active ? (clubsGameStatus.is_paused ? 'text-green-500' : 'text-green-500') : 'text-green-500'}>
                                        {clubsGameStatus.is_active ? (clubsGameStatus.is_paused ? 'HALTED' : 'ACTIVE') : 'IDLE'}
                                    </span>
                                </span>
                                <span className="text-gray-600">|</span>
                                <span className="text-green-400">ROUND {clubsGameStatus.current_round}/6</span>
                                <span className="text-gray-600">|</span>
                                <span className="text-green-400">{waitingPlayers.length} QUEUED</span>
                            </div>
                        )}
                        {activeView === 'spades' && (
                            <div className="flex items-center gap-2 border-r border-white/10 pr-4 mr-2">
                                <span className="flex items-center gap-2">
                                    <span className="text-xl font-bold text-blue-500">♠</span>
                                    <span className={spadesGameStatus.is_active ? (spadesGameStatus.is_paused ? 'text-yellow-400' : 'text-blue-500') : 'text-blue-500'}>
                                        {spadesGameStatus.is_active ? (spadesGameStatus.is_paused ? 'HALTED' : 'ACTIVE') : 'IDLE'}
                                    </span>
                                </span>
                                <span className="text-gray-600">|</span>
                                <span className="text-blue-400 uppercase">{spadesTimerDisplay}</span>
                            </div>
                        )}
                        {activeView === 'diamonds' && (
                            <div className="flex items-center gap-2 border-r border-white/10 pr-4 mr-2">
                                <span className="flex items-center gap-2">
                                    <span className="text-xl font-bold text-purple-500">♦</span>
                                    <span className={diamondsGameStatus.is_active ? (diamondsGameStatus.is_paused ? 'text-yellow-400' : 'text-purple-500') : 'text-purple-500'}>
                                        {diamondsGameStatus.is_active ? (diamondsGameStatus.is_paused ? 'HALTED' : 'ACTIVE') : 'IDLE'}
                                    </span>
                                </span>
                                <span className="text-gray-600">|</span>
                                <span className="text-purple-400">ROUND {diamondsGameStatus.current_round}/5</span>
                            </div>
                        )}
                        {activeView === 'hearts' && (
                            <div className="flex items-center gap-2 border-r border-white/10 pr-4 mr-2">
                                <span className="flex items-center gap-2">
                                    <span className="text-xl font-bold text-red-500">♥</span>
                                    <span className={heartsGameStatus.is_active ? (heartsGameStatus.is_paused ? 'text-yellow-400' : 'text-red-500') : 'text-red-500'}>
                                        {heartsGameStatus.is_active ? (heartsGameStatus.is_paused ? 'HALTED' : 'ACTIVE') : 'IDLE'}
                                    </span>
                                </span>
                            </div>
                        )}
                        {/* Header Command Buttons */}
                        <div className="flex items-center flex-wrap justify-center sm:justify-end gap-1.5 sm:gap-2 ml-1 sm:ml-2 border-l border-white/10 pl-2 sm:pl-4 w-full sm:w-auto">
                            <span className="flex items-center gap-1.5 text-[8px] sm:text-[12px] lg:text-[13px] font-mono">
                                <span className={`w-2 h-2 rounded-full animate-pulse ${networkPing === null ? 'bg-gray-500' :
                                    networkPing < 300 ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' :
                                        networkPing < 700 ? 'bg-yellow-500 shadow-[0_0_8px_#eab308]' :
                                            'bg-red-500 shadow-[0_0_8px_#ef4444]'
                                    }`} />
                                {networkPing !== null ? `${networkPing}ms` : '...'}
                            </span>


                            <button
                                onClick={() => navigate('/home')}
                                title="Back to Home"
                                className="flex items-center gap-1.5 px-2 sm:px-4 py-1 sm:py-2 bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500 hover:text-white rounded text-[9px] sm:text-[12px] font-bold uppercase tracking-widest transition-all cursor-pointer whitespace-nowrap shadow-[0_0_10px_rgba(6,182,212,0.1)]"
                            >
                                <ArrowLeft size={11} className="sm:size-3" />
                                <span>BACK</span>
                            </button>
                            <button
                                onClick={handleEmergencyPurgeToggle}
                                title={adminSettings?.role === 'maintenance' ? 'Resume System' : 'Emergency Purge'}
                                className={`flex items-center gap-1.5 px-2 xl:px-4 py-1 sm:py-2 rounded text-[9px] sm:text-[12px] font-bold uppercase tracking-widest transition-all cursor-pointer whitespace-nowrap ${adminSettings?.role === 'maintenance'
                                    ? 'bg-green-500/20 text-green-400 border border-green-500/40 hover:bg-green-500/30 shadow-[0_0_12px_rgba(34,197,94,0.15)]'
                                    : 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500 hover:text-white shadow-[0_0_10px_rgba(239,68,68,0.15)]'
                                    }`}
                            >
                                <AlertTriangle size={16} className="sm:size-5" />
                                <span className="hidden xl:inline">{adminSettings?.role === 'maintenance' ? 'RESUME' : 'EMERGENCY PURGE'}</span>
                            </button>
                            <button
                                onClick={onLogout}
                                title="Log Out"
                                className="flex items-center gap-1.5 px-2 sm:px-4 py-1 sm:py-2 bg-slate-500/15 text-slate-400 border border-slate-500/30 hover:bg-slate-500 hover:text-white rounded text-[9px] sm:text-[12px] font-bold uppercase tracking-widest transition-all cursor-pointer whitespace-nowrap"
                            >
                                <LogOut size={11} className="sm:size-3" />
                                <span>LOG OUT</span>
                            </button>
                        </div>
                    </div>
                </header>

                <AnimatePresence mode="wait">
                    {activeView === 'dashboard' && (
                        <motion.div
                            key="dashboard"
                            initial={sectionMotionDefaults.initial}
                            animate={sectionMotionDefaults.animate}
                            exit={sectionMotionDefaults.exit}
                            transition={sectionMotionDefaults.transition}
                        >
                            {/* Stats Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                                {dashboardStats.map((stat, i) => (
                                    <motion.div
                                        key={getStableKey(stat.label, `dashboard-stat-${i}`)}
                                        initial={sectionRise.initial}
                                        animate={sectionRise.animate}
                                        transition={{ ...sectionRise.transition, delay: i * 0.08 }}
                                        className="bg-black/40 border border-white/10 p-6 rounded-lg backdrop-blur-sm relative overflow-hidden group"
                                    >
                                        <div className={`absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity ${stat.color}`}>
                                            <stat.icon size={48} />
                                        </div>
                                        <h3 className="text-gray-400 text-xs uppercase tracking-widest mb-2">{stat.label}</h3>
                                        <p className={`text-3xl font-mono font-bold ${stat.color} drop-shadow-lg`}>{stat.value}</p>
                                    </motion.div>
                                ))}
                            </div>

                            {/* Main Dashboard Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 min-h-0">
                                {/* Four Arena Status Grid */}
                                <div className="lg:col-span-2 bg-black/40 border border-white/10 rounded-xl p-6 flex flex-col">
                                    <div className="flex items-center gap-2 mb-6 text-cyan-400">
                                        <Grid size={18} />
                                        <h2 className="font-bold tracking-widest uppercase">GAME PROTOCOL STATUS</h2>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                                        {[
                                            {
                                                suit: 'Spades',
                                                icon: Spade,
                                                color: 'text-blue-400',
                                                borderColor: 'border-blue-500/20',
                                                glowColor: 'shadow-[0_0_20px_rgba(59,130,246,0.05)]',
                                                difficulty: 'Extreme',
                                                type: 'Physical',
                                                active: !!spadesGameStatus?.system_start,
                                                players: getGamePlayerCount('spades'),
                                                gameState: spadesGameStatus?.is_active ? (spadesGameStatus?.is_paused ? 'PAUSED' : 'ACTIVE') : 'IDLE',
                                                currentPhase: 'ROUND ' + (spadesGameStatus?.current_round || 1),
                                                round: spadesGameStatus?.current_round || 0,
                                                totalRounds: 5,
                                                extra: `${spadesGameStatus?.players?.length || 0} registered`
                                            },
                                            {
                                                suit: 'Clubs',
                                                icon: Club,
                                                color: 'text-green-400',
                                                borderColor: 'border-green-500/20',
                                                glowColor: 'shadow-[0_0_20px_rgba(34,197,94,0.05)]',
                                                difficulty: 'Very Hard',
                                                type: 'Team',
                                                active: !!clubsGameStatus?.system_start,
                                                players: getGamePlayerCount('clubs'),
                                                gameState: clubsGameStatus?.system_start ? (clubsGameStatus?.is_paused ? 'PAUSED' : 'ACTIVE') : 'IDLE',
                                                currentPhase: `ROUND ${clubsGameStatus?.current_round || 0}/6`,
                                                round: clubsGameStatus?.current_round || 0,
                                                totalRounds: 6,
                                                extra: `${clubsGameStatus?.votes_submitted || 0} votes cast`
                                            },
                                            {
                                                suit: 'Diamonds',
                                                icon: Diamond,
                                                color: 'text-purple-400',
                                                borderColor: 'border-purple-500/20',
                                                glowColor: 'shadow-[0_0_20px_rgba(168,85,247,0.05)]',
                                                difficulty: 'Hard',
                                                type: 'Intellect',
                                                active: !!diamondsGameStatus?.system_start,
                                                players: getGamePlayerCount('diamonds'),
                                                gameState: diamondsGameStatus?.is_active ? (diamondsGameStatus?.is_paused ? 'PAUSED' : 'ACTIVE') : 'IDLE',
                                                currentPhase: (diamondsGameStatus?.phase || 'IDLE').toUpperCase(),
                                                round: diamondsGameStatus?.current_round || 0,
                                                totalRounds: 5,
                                                extra: `${diamondsGameStatus?.participants?.length || 0} participants`
                                            },
                                            {
                                                suit: 'Hearts',
                                                icon: Heart,
                                                color: 'text-red-500',
                                                borderColor: 'border-red-500/20',
                                                glowColor: 'shadow-[0_0_20px_rgba(239,68,68,0.05)]',
                                                difficulty: 'Hope-less',
                                                type: 'Psychological',
                                                active: !!heartsGameStatus?.system_start,
                                                players: getGamePlayerCount('hearts'),
                                                gameState: heartsGameStatus?.system_start ? (heartsGameStatus?.is_paused ? 'PAUSED' : 'ACTIVE') : 'IDLE',
                                                currentPhase: (heartsGameStatus?.phase || 'IDLE').toUpperCase(),
                                                round: heartsGameStatus?.current_round || 0,
                                                totalRounds: 7,
                                                extra: `phase ${heartsGameStatus?.phase || 'idle'}`
                                            }
                                        ].map((arena, arenaIdx) => (
                                            <div
                                                key={`arena-${getStableKey(arena.suit, String(arenaIdx))}`}
                                                className={`bg-black/80 border ${arena.borderColor} p-4 rounded-lg flex flex-col hover:border-white/20 transition-all relative group overflow-hidden ${arena.glowColor}`}
                                            >
                                                {/* Header */}
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="flex items-center gap-2.5">
                                                        <arena.icon className={`w-5 h-5 ${arena.color}`} />
                                                        <div>
                                                            <h3 className="font-bold tracking-wider text-sm text-white uppercase">{arena.suit}</h3>
                                                            <span className="text-[9px] text-gray-500 tracking-widest uppercase">{arena.type} · {arena.difficulty}</span>
                                                        </div>
                                                    </div>
                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-mono tracking-widest ${arena.active ? (arena.gameState === 'PAUSED' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20') : 'border'}`} style={!arena.active ? { color: suitHexColor(arena.suit.toLowerCase()), borderColor: `${suitHexColor(arena.suit.toLowerCase())}40` } : undefined}>
                                                        {arena.gameState}
                                                    </span>
                                                </div>

                                                {/* Stats Grid */}
                                                <div className="grid grid-cols-2 gap-2 mb-3 flex-1">
                                                    <div className="bg-white/3 rounded p-2 border border-white/5">
                                                        <p className="text-[8px] text-gray-600 uppercase tracking-widest mb-0.5">Phase</p>
                                                        <p className={`text-[11px] font-mono font-bold ${arena.active ? arena.color : 'text-gray-500'}`}>{arena.currentPhase}</p>
                                                    </div>
                                                    <div className="bg-white/3 rounded p-2 border border-white/5">
                                                        <p className="text-[8px] text-gray-600 uppercase tracking-widest mb-0.5">Progress</p>
                                                        <p className="text-[11px] font-mono font-bold text-white">{arena.round}/{arena.totalRounds}</p>
                                                    </div>
                                                    <div className="bg-white/3 rounded p-2 border border-white/5">
                                                        <p className="text-[8px] text-gray-600 uppercase tracking-widest mb-0.5">Players</p>
                                                        <p className="text-[11px] font-mono font-bold text-white">{arena.players}</p>
                                                    </div>
                                                    <div className="bg-white/3 rounded p-2 border border-white/5">
                                                        <p className="text-[8px] text-gray-600 uppercase tracking-widest mb-0.5">Status</p>
                                                        <p className="text-[11px] font-mono font-bold text-gray-400 truncate">{arena.extra}</p>
                                                    </div>
                                                </div>

                                                {/* Progress bar */}
                                                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full transition-all duration-700 ${arena.active ? `bg-gradient-to-r ${arena.color === 'text-blue-400' ? 'from-blue-600 to-blue-400' : arena.color === 'text-green-400' ? 'from-green-600 to-green-400' : arena.color === 'text-purple-400' ? 'from-purple-600 to-purple-400' : 'from-red-600 to-red-400'}` : 'bg-white/10'}`}
                                                        style={{ width: arena.totalRounds > 0 ? `${Math.min(100, (arena.round / arena.totalRounds) * 100)}%` : '0%' }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* System Logs */}
                                <div className="bg-black/40 border border-white/10 rounded-xl p-6 relative overflow-hidden">
                                    <div className="flex items-center gap-2 mb-6 text-blue-400">
                                        <Database size={18} />
                                        <h2 className="font-bold tracking-widest">SYSTEM LOGS</h2>
                                    </div>
                                    <div className="max-h-[450px] overflow-y-auto pr-2 admin-scrollbar">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="sticky top-0 bg-[#0a0a0a] z-10">
                                                <tr className="border-b border-white/10">
                                                    <th className="py-2 px-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest w-24">Timestamp</th>
                                                    <th className="py-2 px-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Protocol Signal / Message</th>
                                                    <th className="py-2 px-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest w-16 text-right">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5 font-mono text-[10px]">
                                                {systemLogs.map((log, i) => {
                                                    const timeMatch = log.match(/^\[(.*?)\]/);
                                                    const time = timeMatch ? timeMatch[1] : '';
                                                    const message = log.replace(/^\[.*?\]\s*/, '');
                                                    const isWarning = /warning|critical/i.test(log);
                                                    return (
                                                        <tr key={getStableKey(`${time}-${message.slice(0, 50)}`, `system-log-${i}`)} className="group hover:bg-white/[0.02] transition-colors">
                                                            <td className="py-2 px-1 text-gray-500">[{time}]</td>
                                                            <td className={`py-2 px-1 ${isWarning ? 'text-red-400' : 'text-green-400'}`}>
                                                                {message}
                                                            </td>
                                                            <td className="py-2 px-1 text-right">
                                                                <span className={`inline-block w-1.5 h-1.5 rounded-full ${isWarning ? 'bg-red-500 animate-pulse' : 'bg-green-500 opacity-50'}`} />
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {(activeView === 'players' || activeView === 'masters') && (
                        <motion.div
                            key={activeView}
                            initial={sectionMotionDefaults.initial}
                            animate={sectionMotionDefaults.animate}
                            exit={sectionMotionDefaults.exit}
                            transition={{ ...sectionMotionDefaults.transition, duration: 0.22 }}
                        >
                            <VisaManagement
                                players={players}
                                activeView={activeView as 'players' | 'masters'}
                                onRefreshRequest={() => setRefreshTrigger(prev => prev + 1)}
                                setPlayers={setPlayers}
                                onHistoryRequest={(player) => {
                                    setActiveView('clubs');
                                    setClubsCommsMode(player.role === 'master' ? 'master' : 'player');
                                    setClubsFilterUserId(player.id);
                                }}
                            />
                        </motion.div>
                    )}


                </AnimatePresence>

                {/* GENERAL TOAST */}
                <AnimatePresence key="toast-presence">
                    {toast && (
                        <motion.div
                            initial={sectionMotionDefaults.initial}
                            animate={sectionMotionDefaults.animate}
                            exit={sectionMotionDefaults.exit}
                            transition={sectionMotionDefaults.transition}
                            className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-4 rounded-lg flex items-center gap-4 z-[60] shadow-[0_0_30px_rgba(0,0,0,0.8)] backdrop-blur-md border ${toast.type === 'error' ? 'bg-red-950/90 border-red-500 text-red-100' : toast.type === 'success' ? 'bg-green-950/90 border-green-500 text-green-100' : 'bg-gray-900/90 border-white/20 text-white'}`}
                        >
                            <div className={`p-2 rounded-full ${toast.type === 'error' ? 'bg-red-500/20' : toast.type === 'success' ? 'bg-green-500/20' : 'bg-white/10'}`}>
                                {toast.type === 'error' ? <AlertTriangle size={20} className="text-red-500" /> : toast.type === 'success' ? <CheckSquare size={20} className="text-green-500" /> : <Radio size={20} className="text-white" />}
                            </div>
                            <div className="flex flex-col">
                                <span className="font-display font-bold tracking-widest text-sm uppercase">
                                    {toast.type === 'error' ? 'SYSTEM ERROR' : toast.type === 'success' ? 'COMMAND EXECUTED' : 'SYSTEM NOTICE'}
                                </span>
                                <span className="text-xs font-mono opacity-80 uppercase tracking-wider">
                                    {toast.message}
                                </span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* UNDO TOAST (PERMANENT) */}
                <AnimatePresence key="undo-presence">
                    {showUndo && (
                        <motion.div
                            initial={sectionMotionDefaults.initial}
                            animate={sectionMotionDefaults.animate}
                            exit={sectionMotionDefaults.exit}
                            transition={sectionMotionDefaults.transition}
                            className="fixed bottom-8 right-8 bg-[#0a0a0a] border border-white/20 p-4 rounded-lg flex items-center gap-4 z-50 shadow-2xl"
                        >
                            <div className="flex flex-col">
                                <span className="text-white text-sm font-bold tracking-wider">
                                    {lastActionType === 'delete' ? 'VISAS TERMINATED' : 'BATCH INJECTION COMPLETE'}
                                </span>
                                <span className="text-gray-400 text-[10px] uppercase">
                                    {lastActionType === 'delete' ? 'Data cached for restoration' : 'Sync signal established'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleUndo}
                                    className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded text-xs font-bold uppercase hover:bg-gray-200 transition-colors"
                                >
                                    <RotateCcw size={14} />
                                    UNDO
                                </button>
                                <button
                                    onClick={() => {
                                        setShowUndo(false);
                                        setDeletedBackup([]); // Clear backup on manual dismiss
                                    }}
                                    className="p-2 hover:bg-white/10 rounded text-gray-500 hover:text-white transition-colors"
                                >
                                    <LogOut size={14} />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>


                {/* TRACKING MODAL */}
                <AnimatePresence key="tracking-presence">
                    {trackingPlayer && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                className="bg-[#050508] border border-white/20 w-full max-w-lg rounded-xl overflow-hidden shadow-2xl relative"
                            >
                                {/* Modal Header */}
                                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                                    <h3 className="text-xl font-display font-bold tracking-widest flex items-center gap-3">
                                        <Activity className={trackingPlayer.isSystem ? "text-red-500" : trackingPlayer.isMaster ? "text-yellow-500" : "text-green-500"} size={24} />
                                        {trackingPlayer.isSystem ? 'GAME MASTER TARGET ACQUIRED' : trackingPlayer.isMaster ? 'MASTER TARGET ACQUIRED' : 'PLAYER TARGET ACQUIRED'}
                                    </h3>
                                    <button
                                        onClick={() => setTrackingPlayer(null)}
                                        className="text-gray-500 hover:text-white transition-colors"
                                    >
                                        <LogOut className="rotate-180" size={20} />
                                    </button>
                                </div>

                                {/* Modal Body */}
                                <div className="p-8 space-y-6 font-mono text-sm">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-[10px] text-gray-500 uppercase tracking-widest block mb-1">Subject ID</label>
                                                <p className="text-[#ff0050] text-lg font-bold">{trackingPlayer.displayId}</p>
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-500 uppercase tracking-widest block mb-1">Identity</label>
                                                <p className="text-white text-lg">{trackingPlayer.username || 'UNKNOWN'}</p>
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-500 uppercase tracking-widest block mb-1">Contact Channel</label>
                                                <p className="text-gray-400 text-xs truncate">{trackingPlayer.email}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-[10px] text-gray-500 uppercase tracking-widest block mb-1">Passcode Data</label>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-gray-500 tracking-[0.3em]">••••••••••</p>
                                                    <span className="text-[9px] bg-red-500/10 text-red-500 px-1.5 rounded border border-red-500/20">ENCRYPTED</span>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-500 uppercase tracking-widest block mb-1">Visa Status</label>
                                                <div className={`flex items-center gap-2 ${trackingPlayer.isSystem ? 'text-red-500' : trackingPlayer.isMaster ? 'text-yellow-500' : 'text-green-500'}`}>
                                                    <span className={`w-2 h-2 rounded-full animate-pulse ${trackingPlayer.isSystem ? 'bg-red-500' : trackingPlayer.isMaster ? 'bg-yellow-500' : 'bg-green-500'}`} />
                                                    {`ACTIVE • ${trackingPlayer.visaDays || 0} DAYS REMAINING`}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Stats Simulation */}
                                    <div className="border-t border-white/10 pt-6 mt-6">
                                        <h4 className="text-xs text-gray-500 uppercase tracking-widest mb-4">Performance Metrics</h4>
                                        <div className="grid grid-cols-3 gap-4 text-center">
                                            <div className="bg-white/5 rounded p-3 border border-white/10">
                                                <div className="text-2xl font-bold text-yellow-500 mb-1">{trackingPlayer.points || 0}</div>
                                                <div className="text-[9px] text-gray-500 uppercase tracking-wider">Points</div>
                                            </div>
                                            <div className="bg-white/5 rounded p-3 border border-white/10">
                                                <div className="text-2xl font-bold text-green-500 mb-1">{trackingPlayer.wins || 0}</div>
                                                <div className="text-[9px] text-gray-500 uppercase tracking-wider">Games Cleared</div>
                                            </div>
                                            <div className="bg-white/5 rounded p-3 border border-white/10">
                                                <div className="text-2xl font-bold text-red-500 mb-1">{trackingPlayer.losses || 0}</div>
                                                <div className="text-[9px] text-gray-500 uppercase tracking-wider">Failures</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer Code */}
                                    <div className="text-[10px] text-gray-600 font-mono text-center pt-4 opacity-50">
                                        SERVER NODE: TOKYO_03 // CONNECTION SECURE
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}


                    {/* Suits View */}
                    {
                        suits.map(suit => {
                            if (suit.id !== activeView) return null;
                            return (
                                <motion.div
                                    key={suit.id}
                                    initial={sectionMotionDefaults.initial}
                                    animate={sectionMotionDefaults.animate}
                                    exit={sectionMotionDefaults.exit}
                                    transition={sectionMotionDefaults.transition}
                                    className="space-y-8"
                                >
                                    {/* Suit Hero */}
                                    <div className="bg-black/40 border border-white/10 rounded-xl p-6 sm:p-12 flex flex-col sm:flex-row items-center gap-6 sm:gap-12 relative overflow-hidden">
                                        <div className={`absolute top-0 right-0 p-12 opacity-10 ${suit.color} hidden sm:block pointer-events-none z-0`}>
                                            <suit.icon size={400} />
                                        </div>
                                        <div className={`p-6 sm:p-8 bg-white/5 rounded-full ${suit.color} relative z-10 pointer-events-none`}>
                                            <suit.icon size={32} className="sm:hidden" />
                                            <suit.icon size={64} className="hidden sm:block" />
                                        </div>
                                        <div className="relative z-10 text-center sm:text-left">
                                            <h2 className={`font-display font-bold tracking-widest mb-1 ${suit.id === 'diamonds' ? 'text-2xl sm:text-4xl' : 'text-3xl sm:text-5xl'}`}>{suit.name}</h2>
                                            <h3 className={`font-mono tracking-wider mb-3 ${suit.color} ${suit.id === 'diamonds' ? 'text-sm sm:text-base' : 'text-base sm:text-xl'}`}>{suit.type}</h3>
                                            <p className="text-gray-400 max-w-xl text-[13px] sm:text-base leading-relaxed">{suit.description}</p>
                                        </div>

                                        {suit.id === 'clubs' && (
                                            <div className="w-full xl:w-auto xl:ml-auto flex flex-col xl:flex-row items-center gap-4 sm:gap-6 relative z-20">
                                                <div className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6 text-center backdrop-blur-md w-full sm:w-64 shrink-0 flex flex-col justify-center h-auto sm:h-[110px] relative overflow-hidden">
                                                    <div className="absolute inset-0 bg-green-500/5 mix-blend-overlay pointer-events-none" />

                                                    <div className="flex justify-between items-end mb-2 relative z-10">
                                                        <div className="text-left">
                                                            <p className="text-[9px] text-green-300/60 uppercase tracking-[0.2em] font-bold mb-0.5">Phase</p>
                                                            <div className="text-lg sm:text-xl xl:text-lg 2xl:text-xl font-display font-black uppercase leading-none tracking-wider truncate max-w-[130px] sm:max-w-none" style={{
                                                                color: (() => {
                                                                    const p = (clubsGameStatus?.gameState || clubsGameStatus?.phase || 'IDLE').toLowerCase();
                                                                    if (p === 'setup_phase1' || p === 'briefing' || p === 'idle') return '#22c55e';
                                                                    return clubsGameStatus?.system_start ? (clubsGameStatus?.is_paused ? '#eab308' : '#22c55e') : '#22c55e';
                                                                })()
                                                            }}>
                                                                {(() => {
                                                                    const p = (clubsGameStatus?.gameState || clubsGameStatus?.phase || 'IDLE').toLowerCase();
                                                                    if (p === 'setup_phase1') return 'SETUP';
                                                                    if (p === 'selection_reveal') return 'REVEAL';
                                                                    if (p === 'playing_phase' || p === 'playing') return 'PLAYING';
                                                                    if (p === 'round_reveal') return 'ROUND';
                                                                    return p.replace('_', ' ');
                                                                })()}
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[9px] text-green-300/60 uppercase tracking-[0.2em] font-bold mb-0.5">Timer</p>
                                                            <div className="text-xl sm:text-2xl xl:text-xl 2xl:text-2xl font-mono font-bold text-white tracking-widest leading-none shadow-green-500/50 drop-shadow-md">
                                                                {clubsTimerDisplay}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden relative z-10 mt-auto">
                                                        <div className="h-full bg-gradient-to-r from-green-600 to-green-400 transition-all duration-1000 shadow-[0_0_10px_#22c55e]" style={{ width: clubsGameStatus?.system_start ? '100%' : '0%' }} />
                                                    </div>
                                                </div>

                                                <div className="flex flex-col gap-2 w-full sm:min-w-0 max-w-full">
                                                    <p className="text-[9px] font-mono text-gray-500 uppercase tracking-[0.2em] mb-1 text-center">Trial Command Unit</p>
                                                    <div className="flex flex-wrap items-stretch gap-2 w-full">
                                                        <button
                                                            onClick={() => {
                                                                if (clubsGameStatus?.system_start) {
                                                                    showToast("Clubs is already active. Use GATE RESET to restart.", "info");
                                                                    return;
                                                                }
                                                                setSelectedSuitForModal('clubs');
                                                                setShowStartModal(true);
                                                            }}
                                                            className={`group flex-1 px-2 py-2 sm:px-4 sm:py-3 ${clubsGameStatus?.system_start ? 'bg-green-500/30 cursor-not-allowed text-white/50' : 'bg-green-500 hover:shadow-[0_0_20px_rgba(34,197,94,0.5)]'} text-black text-[8px] sm:text-[9px] lg:text-[9px] font-black uppercase rounded shadow-[0_0_10px_rgba(34,197,94,0.2)] transition-all flex items-center justify-center gap-0.5 sm:gap-1`}
                                                        >
                                                            {clubsGameStatus?.system_start ? 'ACTIVE' : 'START'} <Radio size={8} className="sm:size-[10px] lg:size-[12px]" />
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                const currentPaused = clubsGameStatus.is_paused;
                                                                let updatePayload: any = {};
                                                                if (!currentPaused) {
                                                                    const now = new Date();
                                                                    const expiry = new Date(clubsGameStatus.phase_expiry || now);
                                                                    const remaining = Math.max(0, Math.floor((expiry.getTime() - now.getTime()) / 1000));
                                                                    updatePayload = { is_paused: true, round_data: { ...(clubsGameStatus.round_data || {}), paused_remaining_sec: remaining } };
                                                                } else {
                                                                    const remaining = clubsGameStatus.round_data?.paused_remaining_sec || 0;
                                                                    const newExpiry = new Date(Date.now() + remaining * 1000).toISOString();
                                                                    const newRoundData = { ...(clubsGameStatus.round_data || {}) };
                                                                    delete newRoundData.paused_remaining_sec;
                                                                    updatePayload = { is_paused: false, phase_expiry: newExpiry, round_data: newRoundData };
                                                                }
                                                                const accessToken = await getAccessToken();
                                                                const response = await fetch(`${supabaseUrl}/rest/v1/clubs_game_status?id=eq.clubs_king`, {
                                                                    method: 'PATCH',
                                                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}`, 'apikey': supabaseKey, 'Prefer': 'return=minimal' },
                                                                    body: JSON.stringify(updatePayload)
                                                                });
                                                                if (!response.ok) { showToast("ERROR: UNABLE TO TOGGLE PROTOCOL STATE.", 'error'); }
                                                                else { showToast(!currentPaused ? "PROTOCOL PAUSED." : "PROTOCOL RESUMED.", 'success'); }
                                                            }}
                                                            className={`flex-1 px-2 py-2 sm:px-4 sm:py-3 border text-[8px] sm:text-[9px] lg:text-[9px] font-black uppercase rounded transition-all flex items-center justify-center gap-0.5 sm:gap-1 ${clubsGameStatus.is_paused ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20 hover:bg-yellow-500 hover:text-black' : 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500 hover:text-white'}`}
                                                        >
                                                            {clubsGameStatus.is_paused ? <Radio size={10} className="sm:size-[10px] lg:size-[12px] animate-spin" /> : <AlertTriangle size={8} className="sm:size-[10px] lg:size-[12px]" />}
                                                            {clubsGameStatus.is_paused ? 'RESUME' : 'HALT'}
                                                        </button>
                                                        <button
                                                            onClick={() => setShowEliminatedModal('clubs')}
                                                            className="flex-1 px-2 py-2 sm:px-4 sm:py-3 bg-slate-700/50 text-slate-300 border border-slate-600/50 text-[8px] sm:text-[9px] lg:text-[9px] font-black uppercase rounded hover:bg-slate-600 hover:text-white transition-all flex items-center justify-center gap-0.5 sm:gap-1"
                                                        >
                                                            <Users size={8} className="sm:size-[10px] lg:size-[12px]" /> ELIMINATED
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                const confirmed = await showConfirm('RESET CLUBS PROTOCOL', 'This will eject ALL players, reset scores, and clear all game data. This cannot be undone.');
                                                                if (!confirmed) return;
                                                                const keepPoints = await showConfirm('PRESERVE SCORES', 'Do you want players to KEEP their currently earned points?\n\nClick Confirm to KEEP points, or Cancel to WIPE and revert to starting balance.');
                                                                try {
                                                                    console.log('=== CLUBS RESET INITIATED ===');
                                                                    const accessToken = await getAccessToken();
                                                                    try {
                                                                        const scoreRes = await fetch(`${supabaseUrl}/rest/v1/clubs_game_status?id=eq.clubs_king&select=scores`, {
                                                                            headers: { 'Authorization': `Bearer ${accessToken}`, 'apikey': supabaseKey, 'Accept': 'application/vnd.pgrst.object+json' }
                                                                        });
                                                                        if (scoreRes.ok) {
                                                                            const statusData = await scoreRes.json();
                                                                            const currentScores = statusData?.scores || {};
                                                                            const startScores = currentScores.start || {};
                                                                            const endedScores = currentScores.current || {};
                                                                            const uids = Object.keys(startScores);
                                                                            const updates = uids.map(async (uid) => {
                                                                                const targetScore = keepPoints ? (endedScores[uid] !== undefined ? Number(endedScores[uid]) : Number(startScores[uid])) : Number(startScores[uid]);
                                                                                if (!isNaN(targetScore)) {
                                                                                    return fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${uid}`, {
                                                                                        method: 'PATCH',
                                                                                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}`, 'apikey': supabaseKey, 'Prefer': 'return=minimal' },
                                                                                        body: JSON.stringify({ visa_points: targetScore })
                                                                                    });
                                                                                }
                                                                            });
                                                                            await Promise.all(updates);
                                                                            showToast(keepPoints ? "CLUBS PLAYER SCORES SAVED TO PROFILES." : "CLUBS PLAYER SCORES REVERTED TO START.", 'success');
                                                                        }
                                                                    } catch (scoreErr) { console.error("CLUBS_SCORE_SAVE_ERROR:", scoreErr); showToast("WARNING: SCORE SAVE/REVERT FAILED.", 'error'); }
                                                                    const response = await fetch(`${supabaseUrl}/rest/v1/clubs_game_status?id=eq.clubs_king`, {
                                                                        method: 'PATCH',
                                                                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}`, 'apikey': supabaseKey, 'Prefer': 'return=minimal' },
                                                                        body: JSON.stringify({ system_start: false, is_paused: false, current_round: 0, votes_submitted: 0, is_active: false, player_score: 0, master_score: 0, removed_cards_p: [], removed_cards_m: [], scores: { current: {}, history: {}, high_player: { score: 0, uid: '-' }, high_master: { score: 0, uid: '-' } }, round_data: { force_reset: Date.now() }, gameState: 'idle', phase_expiry: null })
                                                                    });
                                                                    if (!response.ok) { showToast(`ERROR: ${await response.text()}`, 'error'); return; }
                                                                    console.log('Database reset successful');
                                                                    if (clubsControlChannelRef.current) {
                                                                        await clubsControlChannelRef.current.send({ type: 'broadcast', event: 'force_exit', payload: { reason: 'ADMIN_RESET', timestamp: Date.now() } });
                                                                    } else {
                                                                        const tempChannel = supabase.channel('clubs_king_game');
                                                                        tempChannel.subscribe(async (status) => {
                                                                            if (status === 'SUBSCRIBED') { await tempChannel.send({ type: 'broadcast', event: 'force_exit', payload: { reason: 'ADMIN_RESET', timestamp: Date.now() } }); supabase.removeChannel(tempChannel); }
                                                                        });
                                                                    }
                                                                    showToast("SYSTEM RESET. ALL PLAYERS EJECTED.", 'success');
                                                                    setIsPurging(true);
                                                                    setTimeout(() => setIsPurging(false), 2500);
                                                                } catch (err: any) { console.error("RESET_CATCH_ERROR:", err); showToast(`CRITICAL ERROR: ${err.message || 'Unknown'}`, 'error'); }
                                                            }}
                                                            className="flex-1 px-2 py-2 sm:px-4 sm:py-3 bg-white/5 text-gray-400 border border-white/10 text-[8px] sm:text-[9px] lg:text-[9px] font-black uppercase rounded hover:bg-white/10 transition-all flex items-center justify-center gap-0.5 sm:gap-1"
                                                        >
                                                            <RotateCcw size={8} className="sm:size-[10px] lg:size-[12px]" /> GATE RESET
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {suit.id === 'spades' && (
                                            <div className="w-full xl:w-auto xl:ml-auto flex flex-col xl:flex-row items-center gap-4 sm:gap-6 relative z-20 self-center">
                                                <div className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6 text-center backdrop-blur-md w-full sm:w-64 shrink-0 flex flex-col justify-center h-auto sm:h-[110px] relative overflow-hidden">
                                                    <div className="absolute inset-0 bg-blue-500/5 mix-blend-overlay pointer-events-none" />

                                                    <div className="flex justify-between items-end mb-2 relative z-10">
                                                        <div className="text-left">
                                                            <p className="text-[9px] text-blue-300/60 uppercase tracking-[0.2em] font-bold mb-0.5">Phase</p>
                                                            <div className="text-lg sm:text-xl xl:text-lg 2xl:text-xl font-display font-black uppercase leading-none tracking-wider truncate max-w-[130px] sm:max-w-none" style={{ color: spadesGameStatus?.system_start ? (spadesGameStatus?.is_paused ? '#eab308' : '#3b82f6') : '#3b82f6' }}>
                                                                {spadesGameStatus?.is_active && spadesGameStatus?.phase ? spadesGameStatus.phase.replace('_', ' ') : 'IDLE'}
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[9px] text-blue-300/60 uppercase tracking-[0.2em] font-bold mb-0.5">Timer</p>
                                                            <div className="text-xl sm:text-2xl xl:text-xl 2xl:text-2xl font-mono font-bold text-white tracking-widest leading-none shadow-blue-500/50 drop-shadow-md">
                                                                {spadesTimerDisplay}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden relative z-10">
                                                        <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-1000 shadow-[0_0_10px_#3b82f6]" style={{ width: spadesGameStatus.is_active ? '100%' : '0%' }} />
                                                    </div>
                                                </div>

                                                <div className="flex flex-col gap-2 w-full sm:min-w-0 max-w-full">
                                                    <p className="text-[9px] font-mono text-gray-500 uppercase tracking-[0.2em] mb-1 text-center">Spades Command Unit</p>
                                                    <div className="flex flex-wrap items-stretch gap-2 w-full">
                                                        <button
                                                            onClick={() => {
                                                                if (spadesGameStatus?.system_start) {
                                                                    showToast("Spades is already active. Use GATE RESET to restart.", "info");
                                                                    return;
                                                                }
                                                                setSelectedSuitForModal('spades');
                                                                setShowStartModal(true);
                                                            }}
                                                            className={`group flex-1 px-2 py-2 sm:px-4 sm:py-3 ${spadesGameStatus?.system_start ? 'bg-blue-600/50 cursor-not-allowed text-white/50' : 'bg-blue-600 hover:shadow-[0_0_20px_rgba(37,99,235,0.5)] text-white'} text-[8px] sm:text-[9px] lg:text-[9px] font-black uppercase rounded shadow-[0_0_10px_rgba(37,99,235,0.2)] transition-all flex items-center justify-center gap-0.5 sm:gap-1`}
                                                        >
                                                            {spadesGameStatus?.system_start ? 'ACTIVE' : 'START'} <Radio size={8} className="sm:size-[10px] lg:size-[12px]" />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                (async () => {
                                                                    try {
                                                                        const accessToken = await getAccessToken();
                                                                        const fetchRes = await fetch(`${supabaseUrl}/rest/v1/spades_game_state?id=eq.spades_main&select=is_paused,phase_started_at,phase_duration_sec`, {
                                                                            headers: { 'Authorization': `Bearer ${accessToken}`, 'apikey': supabaseKey, 'Accept': 'application/vnd.pgrst.object+json' }
                                                                        });
                                                                        if (!fetchRes.ok) return;
                                                                        const data = await fetchRes.json();
                                                                        const currentPaused = data?.is_paused;
                                                                        const phaseStartedAt = data?.phase_started_at;
                                                                        const currentDuration = data?.phase_duration_sec || 0;
                                                                        let updatePayload: any = {};
                                                                        if (!currentPaused) {
                                                                            const now = new Date();
                                                                            const start = phaseStartedAt ? new Date(phaseStartedAt) : new Date();
                                                                            const elapsed = Math.floor((now.getTime() - start.getTime()) / 1000);
                                                                            updatePayload = { is_paused: true, phase_duration_sec: Math.max(0, currentDuration - elapsed) };
                                                                        } else {
                                                                            updatePayload = { is_paused: false, phase_started_at: new Date().toISOString() };
                                                                        }
                                                                        const updateRes = await fetch(`${supabaseUrl}/rest/v1/spades_game_state?id=eq.spades_main`, {
                                                                            method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}`, 'apikey': supabaseKey, 'Prefer': 'return=minimal' },
                                                                            body: JSON.stringify(updatePayload)
                                                                        });
                                                                        if (updateRes.ok) {
                                                                            showToast(!currentPaused ? "SPADES PAUSED" : "SPADES RESUMED", 'info');
                                                                            setSpadesGameStatus((prev: any) => ({ ...prev, ...updatePayload }));
                                                                        }
                                                                    } catch (err) { console.error("HALT ERROR:", err); }
                                                                })();
                                                            }}
                                                            className={`flex-1 px-2 py-2 sm:px-4 sm:py-3 border text-[8px] sm:text-[9px] lg:text-[9px] font-black uppercase rounded transition-all flex items-center justify-center gap-0.5 sm:gap-1 ${spadesGameStatus.is_paused ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20 hover:bg-yellow-500 hover:text-black' : 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500 hover:text-white'}`}
                                                        >
                                                            <AlertTriangle size={8} className="sm:size-[10px] lg:size-[12px]" /> {spadesGameStatus.is_paused ? 'RESUME' : 'HALT'}
                                                        </button>
                                                        <button
                                                            onClick={() => setShowEliminatedModal('spades')}
                                                            className="flex-1 px-2 py-2 sm:px-4 sm:py-3 bg-slate-700/50 text-slate-300 border border-slate-600/50 text-[8px] sm:text-[9px] lg:text-[9px] font-black uppercase rounded hover:bg-slate-600 hover:text-white transition-all flex items-center justify-center gap-0.5 sm:gap-1"
                                                        >
                                                            <Users size={8} className="sm:size-[10px] lg:size-[12px]" /> ELIMINATED
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                const confirmed = await showConfirm('RESET SPADES PROTOCOL', 'This will wipe the current Spades game. All in-game progress will be lost.');
                                                                if (!confirmed) return;
                                                                const keepPoints = await showConfirm('PRESERVE SCORES', 'Do you want players to KEEP their currently earned points?\n\nConfirm = KEEP points. Cancel = WIPE and revert to starting balance.');
                                                                try {
                                                                    const accessToken = await getAccessToken();
                                                                    const fetchRes = await fetch(`${supabaseUrl}/rest/v1/spades_game_state?id=eq.spades_main&select=players`, {
                                                                        headers: { 'Authorization': `Bearer ${accessToken}`, 'apikey': supabaseKey, 'Accept': 'application/vnd.pgrst.object+json' }
                                                                    });
                                                                    if (fetchRes.ok) {
                                                                        let data = await fetchRes.json();
                                                                        const currentState = Array.isArray(data) ? data[0] : data;
                                                                        if (currentState && currentState.players) {
                                                                            const updates = Object.values(currentState.players).map(async (p: any) => {
                                                                                if (p.id) {
                                                                                    const targetScore = keepPoints ? (p.score !== undefined ? p.score : p.start_score) : (p.start_score !== undefined ? p.start_score : p.score);
                                                                                    if (targetScore !== undefined) {
                                                                                        return fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${p.id}`, {
                                                                                            method: 'PATCH',
                                                                                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}`, 'apikey': supabaseKey, 'Prefer': 'return=minimal' },
                                                                                            body: JSON.stringify({ visa_points: targetScore })
                                                                                        });
                                                                                    }
                                                                                }
                                                                                return Promise.resolve();
                                                                            });
                                                                            await Promise.all(updates);
                                                                            showToast(keepPoints ? "PLAYER SCORES SAVED." : "PLAYER SCORES REVERTED TO START.", 'success');
                                                                        }
                                                                    }
                                                                } catch (err) { console.error("SCORE_SAVE_ERROR:", err); showToast("WARNING: SCORE SAVE/REVERT FAILED.", 'error'); }
                                                                console.log('[ADMIN] Executing GATE RESET for Spades. Wiping state and clearing player list.');
                                                                const resetData: any = { system_start: false, is_active: false, is_paused: false, phase: 'idle', current_round: 0, players: {}, round_data: {}, timer_display: '00:00' };
                                                                const accessToken = await getAccessToken();
                                                                const response = await fetch(`${supabaseUrl}/rest/v1/spades_game_state?id=eq.spades_main`, {
                                                                    method: 'PATCH',
                                                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}`, 'apikey': supabaseKey, 'Prefer': 'return=minimal' },
                                                                    body: JSON.stringify(resetData)
                                                                });
                                                                if (response.ok) { setSpadesGameStatus((prev: any) => ({ ...prev, ...resetData })); showToast("SPADES RESTARTED FOR ALL PLAYERS.", 'success'); }
                                                                else { console.error("SPADES_RESET_ERROR:", await response.text()); showToast("ERROR: UNABLE TO RESTART SPADES.", 'error'); }
                                                            }}
                                                            className="flex-1 px-2 py-2 sm:px-4 sm:py-3 bg-white/5 text-gray-400 border border-white/10 text-[8px] sm:text-[9px] lg:text-[9px] font-black uppercase rounded hover:bg-white/10 transition-all flex items-center justify-center gap-0.5 sm:gap-1"
                                                        >
                                                            <RotateCcw size={8} className="sm:size-[10px] lg:size-[12px]" /> GATE RESET
                                                        </button>
                                                    </div>


                                                </div>
                                            </div>
                                        )}

                                        {suit.id === 'diamonds' && (
                                            <div className="w-full xl:w-auto xl:ml-auto flex flex-col xl:flex-row items-center gap-4 sm:gap-6 relative z-20">
                                                <div className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6 text-center backdrop-blur-md w-full sm:w-64 shrink-0 flex flex-col justify-center h-auto sm:h-[110px] relative overflow-hidden">
                                                    <div className="absolute inset-0 bg-purple-500/5 mix-blend-overlay pointer-events-none" />

                                                    <div className="flex justify-between items-end mb-2 relative z-10">
                                                        <div className="text-left">
                                                            <p className="text-[9px] text-purple-300/60 uppercase tracking-[0.2em] font-bold mb-0.5">Phase</p>
                                                            <div className="text-lg sm:text-xl xl:text-lg 2xl:text-xl font-display font-black uppercase leading-none tracking-wider truncate max-w-[130px] sm:max-w-none" style={{ color: diamondsGameStatus?.system_start ? (diamondsGameStatus?.is_paused ? '#eab308' : '#a855f7') : '#a855f7' }}>
                                                                {diamondsGameStatus.is_active ? (diamondsGameStatus.phase || 'SYNCED') : 'IDLE'}
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[9px] text-purple-300/60 uppercase tracking-[0.2em] font-bold mb-0.5">Timer</p>
                                                            <div className="text-xl sm:text-2xl xl:text-xl 2xl:text-2xl font-mono font-bold text-white tracking-widest leading-none shadow-purple-500/50 drop-shadow-md">
                                                                {diamondsTimerDisplay}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden relative z-10">
                                                        <div className="h-full bg-gradient-to-r from-purple-500 to-fuchsia-500 transition-all duration-1000 shadow-[0_0_10px_#a855f7]" style={{ width: diamondsGameStatus.is_active ? '100%' : '0%' }} />
                                                    </div>
                                                </div>

                                                <div className="flex flex-col gap-2 w-full sm:min-w-0 max-w-full justify-center">
                                                    <p className="text-[9px] font-mono text-gray-500 uppercase tracking-[0.2em] mb-1 text-center">Diamonds Command Unit</p>
                                                    <div className="flex flex-wrap items-stretch gap-2 w-full">
                                                        <button
                                                            onClick={() => {
                                                                if (diamondsGameStatus?.system_start) {
                                                                    showToast("Diamonds is already active. Use GATE RESET to restart.", "info");
                                                                    return;
                                                                }
                                                                setSelectedSuitForModal('diamonds');
                                                                setShowStartModal(true);
                                                            }}
                                                            className={`group flex-1 px-2 py-2 sm:px-4 sm:py-3 ${diamondsGameStatus?.system_start ? 'bg-purple-500/30 cursor-not-allowed' : 'bg-purple-500 hover:shadow-[0_0_20px_rgba(168,85,247,0.5)]'} text-black text-[8px] sm:text-[9px] lg:text-[9px] font-black uppercase rounded shadow-[0_0_10px_rgba(168,85,247,0.2)] transition-all flex items-center justify-center gap-0.5 sm:gap-1`}
                                                        >
                                                            {diamondsGameStatus?.system_start ? 'ACTIVE' : 'START'} <Radio size={8} className="sm:size-[10px] lg:size-[12px]" />
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                const { data, error: fetchError } = await supabase.from('diamonds_game_state').select('is_paused, phase_started_at, phase_duration_sec').eq('id', 'diamonds_king').single();
                                                                if (fetchError) { showToast(`SYNC ERROR: ${fetchError.message}`, 'error'); return; }
                                                                const currentPaused = data?.is_paused;
                                                                const phaseStartedAt = data?.phase_started_at;
                                                                const currentDuration = data?.phase_duration_sec || 0;
                                                                let updatePayload: any = {};
                                                                if (!currentPaused) {
                                                                    const now = new Date();
                                                                    const start = phaseStartedAt ? new Date(phaseStartedAt) : new Date();
                                                                    const elapsed = Math.floor((now.getTime() - start.getTime()) / 1000);
                                                                    updatePayload = { is_paused: true, phase_duration_sec: Math.max(0, currentDuration - elapsed) };
                                                                } else {
                                                                    updatePayload = { is_paused: false, phase_started_at: new Date().toISOString() };
                                                                }
                                                                const { error } = await supabase.from('diamonds_game_state').update(updatePayload).eq('id', 'diamonds_king');
                                                                if (error) { showToast(`ERROR: ${error.message}`, 'error'); }
                                                                else { showToast(!currentPaused ? "DIAMONDS HALTED." : "DIAMONDS RESUMED.", 'info'); }
                                                            }}
                                                            className={`flex-1 px-2 py-2 sm:px-4 sm:py-3 border text-[8px] sm:text-[9px] lg:text-[9px] font-black uppercase rounded transition-all flex items-center justify-center gap-0.5 sm:gap-1 ${diamondsGameStatus.is_paused ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500 hover:text-white'}`}
                                                        >
                                                            <AlertTriangle size={8} className="sm:size-[10px] lg:size-[12px]" /> {diamondsGameStatus.is_paused ? 'RESUME' : 'HALT'}
                                                        </button>
                                                        <button
                                                            onClick={() => setShowEliminatedModal('diamonds')}
                                                            className="flex-1 px-2 py-2 sm:px-4 sm:py-3 bg-slate-700/50 text-slate-300 border border-slate-600/50 text-[8px] sm:text-[9px] lg:text-[9px] font-black uppercase rounded hover:bg-slate-600 hover:text-white transition-all flex items-center justify-center gap-0.5 sm:gap-1"
                                                        >
                                                            <Users size={8} className="sm:size-[10px] lg:size-[12px]" /> ELIMINATED
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                const confirmed = await showConfirm('RESET DIAMONDS PROTOCOL', 'This will wipe the current Diamonds game state. All in-game progress will be lost.');
                                                                if (!confirmed) return;
                                                                const { error: sbError } = await supabase.from('diamonds_game_state').upsert({
                                                                    id: 'diamonds_king', system_start: false, is_paused: false, current_round: 0, phase: 'idle', participants: [], updated_at: new Date().toISOString()
                                                                });
                                                                if (sbError) { showToast("RESET FAILED: DATABASE REJECTION.", 'error'); return; }
                                                                if (diamondsControlChannelRef.current) {
                                                                    await diamondsControlChannelRef.current.send({ type: 'broadcast', event: 'force_exit', payload: { reason: 'ADMIN_RESET', timestamp: Date.now() } });
                                                                }
                                                                showToast("DIAMONDS RESET (PLAYERS EJECTED).", 'success');
                                                            }}
                                                            className="flex-1 px-2 py-2 sm:px-4 sm:py-3 bg-white/5 text-gray-400 border border-white/10 text-[8px] sm:text-[9px] lg:text-[9px] font-black uppercase rounded hover:bg-white/10 transition-all flex items-center justify-center gap-0.5 sm:gap-1"
                                                        >
                                                            <RotateCcw size={8} className="sm:size-[10px] lg:size-[12px]" /> GATE RESET
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {suit.id === 'hearts' && (
                                            <div className="w-full xl:w-auto xl:ml-auto flex flex-col xl:flex-row items-center gap-4 sm:gap-6 relative z-20 self-center">
                                                <div className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6 text-center backdrop-blur-md w-full sm:w-64 shrink-0 flex flex-col justify-center h-auto sm:h-[110px] relative overflow-hidden">
                                                    <div className="absolute inset-0 bg-red-500/5 mix-blend-overlay pointer-events-none" />

                                                    <div className="flex justify-between items-end mb-2 relative z-10">
                                                        <div className="text-left">
                                                            <p className="text-[9px] text-red-300/60 uppercase tracking-[0.2em] font-bold mb-0.5">Phase</p>
                                                            <div className="text-lg sm:text-xl xl:text-lg 2xl:text-xl font-display font-black uppercase leading-none tracking-wider truncate max-w-[130px] sm:max-w-none" style={{ color: heartsGameStatus?.system_start ? (heartsGameStatus?.is_paused ? '#eab308' : '#ef4444') : '#ef4444' }}>
                                                                {heartsGameStatus.phase || 'IDLE'}
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[9px] text-red-300/60 uppercase tracking-[0.2em] font-bold mb-0.5">Timer</p>
                                                            <div className="text-xl sm:text-2xl xl:text-xl 2xl:text-2xl font-mono font-bold text-white tracking-widest leading-none shadow-red-500/50 drop-shadow-md">
                                                                {heartsTimerDisplay}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden relative z-10">
                                                        <div className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-1000 shadow-[0_0_10px_#ef4444]" style={{ width: heartsGameStatus.phase !== 'idle' ? '100%' : '0%' }} />
                                                    </div>
                                                </div>

                                                <div className="flex flex-col gap-2 w-full sm:min-w-0 max-w-full justify-center">
                                                    <p className="text-[9px] font-mono text-gray-500 uppercase tracking-[0.2em] mb-1 text-center">Hearts Command Unit</p>
                                                    <div className="flex flex-wrap items-stretch gap-2 w-full">
                                                        <button
                                                            onClick={() => {
                                                                if (heartsGameStatus?.system_start) {
                                                                    showToast("Hearts is already active. Use GATE RESET to restart.", "info");
                                                                    return;
                                                                }
                                                                setSelectedSuitForModal('hearts');
                                                                setShowStartModal(true);
                                                            }}
                                                            className={`group flex-1 px-2 py-2 sm:px-4 sm:py-3 ${heartsGameStatus?.system_start ? 'bg-red-600/50 cursor-not-allowed text-white/50' : 'bg-red-600 hover:shadow-[0_0_20px_rgba(220,38,38,0.5)] text-white'} text-[8px] sm:text-[9px] lg:text-[9px] font-black uppercase rounded shadow-[0_0_10px_rgba(220,38,38,0.2)] transition-all flex items-center justify-center gap-0.5 sm:gap-1`}
                                                        >
                                                            {heartsGameStatus?.system_start ? 'ACTIVE' : 'START'} <Radio size={8} className="sm:size-[10px] lg:size-[12px]" />
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                const { data } = await supabase.from('hearts_game_state').select('*').eq('id', 'hearts_main').single();
                                                                const currentPaused = data?.is_paused;
                                                                const currentDuration = data?.phase_duration_sec || 0;
                                                                const phaseStartedAt = data?.phase_started_at;
                                                                let updatePayload: any = {};
                                                                if (!currentPaused) {
                                                                    const now = new Date();
                                                                    const start = phaseStartedAt ? new Date(phaseStartedAt) : new Date();
                                                                    const elapsed = Math.floor((now.getTime() - start.getTime()) / 1000);
                                                                    updatePayload = { is_paused: true, phase_duration_sec: Math.max(0, currentDuration - elapsed) };
                                                                } else {
                                                                    updatePayload = { is_paused: false, phase_started_at: new Date().toISOString() };
                                                                }
                                                                await supabase.from('hearts_game_state').update(updatePayload).eq('id', 'hearts_main');
                                                                showToast(!currentPaused ? "PROTOCOL HALTED." : "PROTOCOL RESUMED.", 'info');
                                                            }}
                                                            className={`flex-1 px-2 py-2 sm:px-4 sm:py-3 border text-[8px] sm:text-[9px] lg:text-[9px] font-black uppercase rounded transition-all flex items-center justify-center gap-0.5 sm:gap-1 ${heartsGameStatus.is_paused ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20 hover:bg-yellow-500 hover:text-black' : 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500 hover:text-white'}`}
                                                        >
                                                            {heartsGameStatus.is_paused ? <Radio size={10} className="sm:size-[10px] lg:size-[12px] animate-spin" /> : <AlertTriangle size={8} className="sm:size-[10px] lg:size-[12px]" />} {heartsGameStatus.is_paused ? 'RESUME' : 'HALT'}
                                                        </button>
                                                        <button
                                                            onClick={() => setShowEliminatedModal('hearts')}
                                                            className="flex-1 px-2 py-2 sm:px-4 sm:py-3 bg-slate-700/50 text-slate-300 border border-slate-600/50 text-[8px] sm:text-[9px] lg:text-[9px] font-black uppercase rounded hover:bg-slate-600 hover:text-white transition-all flex items-center justify-center gap-0.5 sm:gap-1"
                                                        >
                                                            <Users size={8} className="sm:size-[10px] lg:size-[12px]" /> ELIMINATED
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                const confirmed = await showConfirm('TOTAL RESET — HEARTS', 'This will wipe ALL sessions, clear round scores, and eject all players. This cannot be undone.');
                                                                if (!confirmed) return;
                                                                const keepPoints = await showConfirm('PRESERVE SCORES', 'Do you want players to KEEP their currently earned points?\n\nConfirm = KEEP points. Cancel = WIPE and revert to starting balance.');
                                                                try {
                                                                    const accessToken = await getAccessToken();
                                                                    const fetchRes = await fetch(`${supabaseUrl}/rest/v1/hearts_game_state?id=eq.hearts_main&select=participants`, {
                                                                        headers: { 'Authorization': `Bearer ${accessToken}`, 'apikey': supabaseKey, 'Accept': 'application/vnd.pgrst.object+json' }
                                                                    });
                                                                    if (fetchRes.ok) {
                                                                        let data = await fetchRes.json();
                                                                        const currentState = Array.isArray(data) ? data[0] : data;
                                                                        if (currentState && currentState.participants) {
                                                                            const updates = currentState.participants.map(async (p: any) => {
                                                                                if (p.id) {
                                                                                    const targetScore = keepPoints ? (p.score !== undefined ? p.score : p.start_score) : (p.start_score !== undefined ? p.start_score : p.score);
                                                                                    if (targetScore !== undefined) {
                                                                                        return fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${p.id}`, {
                                                                                            method: 'PATCH',
                                                                                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}`, 'apikey': supabaseKey, 'Prefer': 'return=minimal' },
                                                                                            body: JSON.stringify({ visa_points: targetScore })
                                                                                        });
                                                                                    }
                                                                                }
                                                                                return Promise.resolve();
                                                                            });
                                                                            await Promise.all(updates);
                                                                            showToast(keepPoints ? "PLAYER SCORES SAVED." : "PLAYER SCORES REVERTED TO START.", 'success');
                                                                        }
                                                                    }
                                                                } catch (err) { console.error("SCORE_SAVE_ERROR:", err); showToast("WARNING: SCORE SAVE/REVERT FAILED.", 'error'); }
                                                                console.log("=== HEARTS PROTOCOL PURGE INITIATED ===");
                                                                await supabase.from('hearts_eliminated').delete().eq('game_id', 'hearts_main');
                                                                await supabase.from('hearts_guesses').delete().eq('game_id', 'hearts_main');
                                                                await supabase.from('hearts_round_points').delete().neq('id', 0);
                                                                await supabase.from('hearts_game_sessions').delete().neq('id', 'dummy');
                                                                const resetData: any = { phase: 'idle', current_round: 0, system_start: false, is_paused: false, active_game_id: null, participants: [], groups: {}, pairs: {}, guesses: {}, chat_counts: {}, eliminated: [], winners: [] };
                                                                const { error } = await supabase.from('hearts_game_state').update(resetData).eq('id', 'hearts_main');
                                                                await supabase.from('messages').delete().eq('game_id', 'hearts_main');
                                                                if (error) { showToast("PURGE FAILED: DATABASE REJECTION.", 'error'); }
                                                                else { setHeartsGameStatus((prev: any) => ({ ...prev, ...resetData })); showToast("HEARTS PROTOCOL PURGED. READY FOR NEW SESSION.", 'success'); }
                                                            }}
                                                            className="flex-1 px-2 py-2 sm:px-4 sm:py-3 bg-white/5 text-gray-400 border border-white/10 text-[8px] sm:text-[9px] lg:text-[9px] font-black uppercase rounded hover:bg-white/10 transition-all flex items-center justify-center gap-0.5 sm:gap-1"
                                                        >
                                                            <RotateCcw size={8} className="sm:size-[10px] lg:size-[12px]" /> GATE RESET
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Active Games & Communication Intelligence */}
                                    <div className="flex flex-wrap lg:flex-nowrap gap-8 items-start">
                                        {/* Left: Round Monitor (Paginated) */}
                                        <div className="w-full lg:w-[420px] flex flex-col gap-5 shrink-0 h-full">
                                            <div className="flex justify-between items-center">
                                                <h3 className="text-sm font-bold text-gray-400 tracking-widest uppercase flex items-center gap-2">
                                                    <Activity size={16} /> {suit.id === 'hearts' ? 'PHASE MONITOR' : 'ROUND MONITOR'}
                                                </h3>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => setRoundMonitorPage(prev => ({ ...prev, [suit.id]: Math.max(0, (prev[suit.id] || 0) - 1) }))}
                                                        disabled={!(roundMonitorPage[suit.id] > 0)}
                                                        className={`p-1.5 rounded bg-white/5 border border-white/10 ${roundMonitorPage[suit.id] > 0 ? 'hover:bg-white/10 text-white cursor-pointer' : 'opacity-30 cursor-not-allowed'}`}
                                                    >
                                                        <ChevronLeft size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => setRoundMonitorPage(prev => ({ ...prev, [suit.id]: (prev[suit.id] || 0) + 1 }))}
                                                        disabled={(() => {
                                                            const totalRounds = suit.id === 'hearts' ? 7 : (suit.id === 'clubs' ? 6 : 5);
                                                            return (roundMonitorPage[suit.id] || 0) >= Math.ceil(totalRounds / 4) - 1;
                                                        })()}
                                                        className={`p-1.5 rounded bg-white/5 border border-white/10 ${(() => {
                                                            const totalRounds = suit.id === 'hearts' ? 7 : (suit.id === 'clubs' ? 6 : 5);
                                                            return (roundMonitorPage[suit.id] || 0) < Math.ceil(totalRounds / 4) - 1;
                                                        })() ? 'hover:bg-white/10 text-white cursor-pointer' : 'opacity-30 cursor-not-allowed'}`}
                                                    >
                                                        <ChevronRight size={14} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-3 flex-1">
                                                {suit.id === 'hearts' ? (
                                                    ['idle', 'phase1', 'phase2', 'phase3', 'phase4', 'reveal', 'end'].map((phaseName, i) => {
                                                        const isCurrent = (heartsGameStatus as any).phase === phaseName;
                                                        return (
                                                            <div key={phaseName} className={`bg-white/5 border rounded-lg p-5 min-h-[120px] transition-all group flex-1 flex flex-col justify-center gap-2 ${isCurrent ? `border-red-500/50 bg-red-500/5` : 'border-white/10 hover:border-white/20'}`}>
                                                                <div className="flex justify-between items-center">
                                                                    <span className={`text-xs font-mono font-bold tracking-widest ${isCurrent ? `text-red-500` : 'text-gray-500'}`}>
                                                                        PHASE_{i.toString().padStart(2, '0')}
                                                                    </span>
                                                                    <div className={`px-2 py-0.5 rounded text-[9px] font-bold ${isCurrent ? (heartsGameStatus.system_start ? (heartsGameStatus.is_paused ? 'PAUSED' : 'ACTIVE') : 'bg-gray-500 text-white') : 'bg-white/5 text-gray-600'}`}>
                                                                        {isCurrent ? (heartsGameStatus.system_start ? (heartsGameStatus.is_paused ? 'PAUSED' : 'ACTIVE') : 'STANDBY') : 'LOCKED'}
                                                                    </div>
                                                                </div>
                                                                <h4 className="text-lg font-display font-bold text-white tracking-wider uppercase">{phaseName}</h4>
                                                            </div>
                                                        );
                                                    }).slice((roundMonitorPage[suit.id] || 0) * 4, ((roundMonitorPage[suit.id] || 0) + 1) * 4)
                                                ) : (
                                                    // MODIFIED: Show 6 Rounds for Clubs, 5 for Spades and Diamonds
                                                    [1, 2, 3, 4, 5, 6].slice(0, suit.id === 'clubs' ? 6 : 5).map(roundNum => {
                                                        const gameStatus = suit.id === 'clubs' ? clubsGameStatus : suit.id === 'spades' ? spadesGameStatus : diamondsGameStatus;
                                                        // For Spades: Active if current matches roundNum AND is_active is true (or ignored because Spades always active if started)
                                                        // Spades uses 'system_start' which is mapped to 'is_active' in state
                                                        const isCurrentRound = roundNum === gameStatus.current_round && gameStatus.system_start;
                                                        const isCompleted = roundNum < gameStatus.current_round;

                                                        return (
                                                            <div key={roundNum} className={`bg-white/5 border rounded-lg p-5 min-h-[120px] transition-all group flex-1 flex flex-col justify-center gap-2 ${isCurrentRound ? (suit.id === 'spades' ? 'border-blue-500/50 bg-blue-500/5' : suit.id === 'diamonds' ? 'border-purple-400/50 bg-purple-400/5' : 'border-green-500/50 bg-green-500/5') : 'border-white/10 hover:border-white/20'}`}>
                                                                <div className="flex justify-between items-center">
                                                                    <span className={`text-xs font-mono font-bold tracking-widest ${isCurrentRound ? (suit.id === 'spades' ? 'text-blue-500' : suit.id === 'diamonds' ? 'text-purple-400' : 'text-green-500') : 'text-gray-500'}`}>
                                                                        PHASE_{roundNum.toString().padStart(2, '0')}
                                                                    </span>
                                                                    <div className={`px-2 py-0.5 rounded text-[7px] font-bold ${isCurrentRound ? `${suit.id === 'spades' ? 'bg-blue-500' : suit.id === 'diamonds' ? 'bg-purple-400' : 'bg-green-500'} text-black animate-pulse` : isCompleted ? 'bg-white/10 text-gray-400' : 'bg-white/5 text-gray-600'}`}>
                                                                        {isCurrentRound ? (gameStatus.is_paused ? 'PAUSED' : (gameStatus.phase?.toUpperCase() || 'ACTIVE')) : isCompleted ? 'CLEARED' : 'LOCKED'}
                                                                    </div>
                                                                </div>

                                                                <div>
                                                                    <h4 className="text-lg font-display font-bold text-white tracking-wider">ROUND {roundNum}</h4>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <div className={`h-full transition-all duration-1000 ${isCurrentRound ? (suit.id === 'spades' ? 'bg-blue-500' : suit.id === 'diamonds' ? 'bg-purple-400' : 'bg-green-500') : isCompleted ? 'bg-white/20 w-full' : 'w-0'}`}
                                                                            style={{ width: isCurrentRound ? `${Math.min(100, ((gameStatus.votes_submitted || 0) / 10) * 100)}%` : (isCompleted ? '100%' : '0%') }}
                                                                        />
                                                                        <span className="text-[px] font-mono text-gray-500 uppercase tracking-tighter">
                                                                            {isCurrentRound ? `${gameStatus.votes_submitted || 0} VOTES CAST` : isCompleted ? 'SYNC DONE' : 'WAITING'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    }).slice((roundMonitorPage[suit.id] || 0) * 4, ((roundMonitorPage[suit.id] || 0) + 1) * 4)
                                                )}
                                            </div>
                                        </div>

                                        {/* Right: Communication Intelligence (Chat) */}
                                        <div className="flex-1 w-full space-y-6 min-w-0">
                                            <div className="flex justify-between items-center mb-6">
                                                <h3 className="text-sm font-bold tracking-widest uppercase flex items-center gap-2" style={{ color: suit.id === 'clubs' ? '#22c55e' : suit.id === 'spades' ? '#3b82f6' : suit.id === 'diamonds' ? '#a855f7' : '#ef4444' }}>
                                                    <Radio size={16} className="animate-pulse" /> COM INTELLIGENCE
                                                    {(suit.id === 'clubs' ? clubsFilterUserId : null) && (
                                                        <button
                                                            onClick={() => suit.id === 'clubs' ? setClubsFilterUserId(null) : null}
                                                            className="ml-4 px-2 py-0.5 bg-green-500 text-black text-[9px] font-black rounded hover:bg-green-400 transition-all flex items-center gap-1"
                                                        >
                                                            HISTORY <X size={10} />
                                                        </button>
                                                    )}
                                                </h3>
                                                <button
                                                    onClick={() => {
                                                        const current = getEffectiveViewMode(suit.id);
                                                        const modes = suit.id === 'clubs' ? ['chat', 'bar', 'pie', 'line'] : ['bar', 'pie', 'line'];
                                                        const idx = modes.indexOf(current);
                                                        const next = modes[(idx + 1) % modes.length] as 'chat' | 'bar' | 'pie' | 'line';
                                                        setViewMode(suit.id, next);
                                                    }}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all hover:bg-white/10"
                                                    style={{
                                                        borderColor: `${suit.id === 'clubs' ? '#22c55e' : suit.id === 'spades' ? '#3b82f6' : suit.id === 'diamonds' ? '#a855f7' : '#ef4444'}40`,
                                                        color: suit.id === 'clubs' ? '#22c55e' : suit.id === 'spades' ? '#3b82f6' : suit.id === 'diamonds' ? '#a855f7' : '#ef4444',
                                                    }}
                                                >
                                                    {getEffectiveViewMode(suit.id) === 'chat' ? <><BarChart3 size={14} /> CHARTS</> : getEffectiveViewMode(suit.id) === 'bar' ? <><PieChartIcon size={14} /> PIE</> : getEffectiveViewMode(suit.id) === 'pie' ? <><Activity size={14} /> LINE</> : suit.id === 'clubs' ? <><MessageSquare size={14} /> CHAT</> : <><BarChart3 size={14} /> CHARTS</>}
                                                </button>

                                                <div className="flex flex-col xl:flex-row items-end xl:items-center gap-3">
                                                    {/* Mode Switcher */}
                                                    {suit.id === 'clubs' && (
                                                        <div className="flex bg-white/5 p-1 rounded-lg border border-white/10 shrink-0">
                                                            <button
                                                                onClick={() => setClubsCommsMode('all')}
                                                                className={`px-2.5 py-1 sm:px-4 sm:py-1.5 rounded text-[10px] sm:text-[11px] font-bold transition-all ${clubsCommsMode === 'all' ? 'bg-white/20 text-white' : 'text-gray-500 hover:text-gray-400'}`}                       >
                                                                ALL
                                                            </button>
                                                            <button
                                                                onClick={() => setClubsCommsMode('player')}
                                                                className={`px-2.5 py-1 sm:px-4 sm:py-1.5 rounded text-[10px] sm:text-[11px] font-bold transition-all ${clubsCommsMode === 'player' ? 'bg-green-500 text-black' : 'text-gray-500 hover:text-gray-400'}`}       >
                                                                PLAYERS
                                                            </button>
                                                            <button
                                                                onClick={() => setClubsCommsMode('master')}
                                                                className={`px-2.5 py-1 sm:px-4 sm:py-1.5 rounded text-[10px] sm:text-[11px] font-bold transition-all ${clubsCommsMode === 'master' ? 'bg-red-500 text-white' : 'text-gray-500 hover:text-gray-400'}`}    >
                                                                MASTERS
                                                            </button>
                                                        </div>
                                                    )}

                                                    <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                                                        {suit.id === 'clubs' && (
                                                            <button
                                                                onClick={() => {
                                                                    setActiveView('dashboard');
                                                                    setTimeout(() => setActiveView('clubs'), 10);
                                                                }}
                                                                className="p-1.5 sm:p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors text-gray-500 hover:text-green-500 shrink-0"
                                                                title="Force Resync"
                                                            >
                                                                <RotateCcw size={16} />
                                                            </button>
                                                        )}

                                                        {suit.id === 'clubs' && (
                                                            <button
                                                                onClick={async () => {
                                                                    const ok = await showConfirm('FORCE GLOBAL REFRESH', 'This will clear the cache for ALL users and re-download player IDs. Proceed?');
                                                                    if (!ok) return;

                                                                    // Clear local cache
                                                                    PlayerCache.clear();

                                                                    // Broadcast to all clients via Supabase
                                                                    await supabase.channel('global_admin').send({
                                                                        type: 'broadcast',
                                                                        event: 'cache_invalidate',
                                                                        payload: { timestamp: Date.now() }
                                                                    });

                                                                    // Force local re-fetch
                                                                    window.location.reload();

                                                                    showToast('PLAYER CACHE PURGED GLOBALLY', 'success');
                                                                }}
                                                                className="p-1.5 sm:p-2 bg-red-500/10 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors text-red-500 hover:text-red-400 shrink-0"
                                                                title="Force Refresh Player Cache (Global)"
                                                            >
                                                                <Database size={16} />
                                                            </button>
                                                        )}

                                                        <div className="flex-1 sm:flex-none flex items-center bg-white/5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border border-white/10 shadow-inner whitespace-nowrap">
                                                            <span className="text-[10px] sm:text-xs text-gray-500 font-mono font-bold uppercase tracking-widest mr-2">BARS:</span>
                                                            <span className="text-white text-sm sm:text-lg font-black tracking-tighter">
                                                                {(() => {
                                                                    const mode = getEffectiveViewMode(suit.id);
                                                                    const allPlayerProfiles = players.filter((p: any) => p.role === 'player');
                                                                    const gamePlayers = allPlayerProfiles.filter((p: any) => p.game_type?.toLowerCase() === suit.id);
                                                                    const displayPlayers = gamePlayers.length > 0 ? gamePlayers : allPlayerProfiles;
                                                                    if (mode === 'pie') return displayPlayers.length;
                                                                    if (mode === 'bar') return Math.min(PLAYERS_PER_CHART_PAGE, Math.max(0, displayPlayers.length - getChartPlayerPage(suit.id) * PLAYERS_PER_CHART_PAGE));
                                                                    if (mode === 'line') return Math.min(PLAYERS_PER_CHART_PAGE, Math.max(0, allPlayerProfiles.filter((p: any) => (p.visa_points ?? 0) > 0).length - getChartPlayerPage(suit.id) * PLAYERS_PER_CHART_PAGE));
                                                                    return 0;
                                                                })()}
                                                            </span>
                                                        </div>

                                                        <button
                                                            onClick={() => handlePurgeAllMessages(suit.id)}
                                                            className="px-3 sm:px-4 py-1.5 sm:py-2 bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/30 rounded text-[10px] sm:text-[11px] font-black tracking-widest transition-all uppercase" >
                                                            <span className="hidden sm:inline">PURGE DATA</span>
                                                            <span className="sm:hidden">PURGE</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {getEffectiveViewMode(suit.id) === 'chat' ? (
                                                <div className="bg-black/40 border border-white/10 rounded-xl overflow-hidden backdrop-blur-sm flex flex-col h-[400px] lg:h-[500px]">
                                                    {/* Search Bar */}
                                                    <div className="p-3 border-b border-white/5 bg-white/[0.02] flex items-center gap-3">
                                                        <Search size={14} className="text-gray-500" />
                                                        <input
                                                            type="text"
                                                            value={suit.id === 'clubs' ? clubsSearchQuery : suit.id === 'hearts' ? heartsSearchQuery : suit.id === 'spades' ? spadesSearchQuery : diamondsSearchQuery}
                                                            onChange={(e) => suit.id === 'clubs' ? setClubsSearchQuery(e.target.value) : suit.id === 'hearts' ? setHeartsSearchQuery(e.target.value) : suit.id === 'spades' ? setSpadesSearchQuery(e.target.value) : setDiamondsSearchQuery(e.target.value)}
                                                            placeholder="Search transcripts..."
                                                            className="bg-transparent border-none outline-none text-sm font-mono text-white placeholder:text-white/10 w-full"
                                                        />
                                                    </div>

                                                    <div className="flex-1 overflow-y-auto p-4 space-y-3 admin-scrollbar">
                                                        {(suit.id === 'clubs' ? clubsMessages : suit.id === 'hearts' ? heartsMessages : suit.id === 'spades' ? spadesMessages : diamondsMessages).filter(m => {
                                                            const query = suit.id === 'clubs' ? clubsSearchQuery : suit.id === 'hearts' ? heartsSearchQuery : suit.id === 'spades' ? spadesSearchQuery : diamondsSearchQuery;
                                                            const matchesSearch = !query ||
                                                                m.content?.toLowerCase().includes(query.toLowerCase()) ||
                                                                m.user_name?.toLowerCase().includes(query.toLowerCase());
                                                            const matchesUser = suit.id === 'clubs' ? (!clubsFilterUserId || m.user_id === clubsFilterUserId) : true; // Hearts doesn't have user filter
                                                            const matchesMode = suit.id === 'clubs' ? (clubsCommsMode === 'all' || m.channel === clubsCommsMode) : true; // Hearts doesn't have comms mode
                                                            return matchesSearch && matchesUser && matchesMode && !m.is_system;
                                                        }).length === 0 ? (
                                                            <div className="h-full flex flex-col items-center justify-center gap-4 text-gray-600 font-mono text-xs uppercase tracking-[0.2em] text-center p-8">
                                                                <Database size={32} className="opacity-20 mb-2" />
                                                                <div className="space-y-1">
                                                                    <p>{(suit.id === 'clubs' ? clubsSearchQuery || clubsFilterUserId : heartsSearchQuery) ? 'No transcripts match criteria' : 'Awaiting Signal Broadcast...'}</p>
                                                                    {suit.id === 'clubs' && clubsFilterUserId && (
                                                                        <button
                                                                            onClick={() => setClubsFilterUserId(null)}
                                                                            className="text-[10px] text-green-500 hover:text-green-400 font-black uppercase tracking-widest"
                                                                        >
                                                                            [ RESET USER FILTER ]
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            (suit.id === 'clubs' ? clubsMessages : suit.id === 'hearts' ? heartsMessages : suit.id === 'spades' ? spadesMessages : diamondsMessages).filter(m => {
                                                                const query = suit.id === 'clubs' ? clubsSearchQuery : suit.id === 'hearts' ? heartsSearchQuery : suit.id === 'spades' ? spadesSearchQuery : diamondsSearchQuery;
                                                                const matchesSearch = !query ||
                                                                    m.content?.toLowerCase().includes(query.toLowerCase()) ||
                                                                    m.user_name?.toLowerCase().includes(query.toLowerCase());
                                                                const matchesUser = suit.id === 'clubs' ? (!clubsFilterUserId || m.user_id === clubsFilterUserId) : true;
                                                                const matchesMode = suit.id === 'clubs' ? (clubsCommsMode === 'all' || m.channel === clubsCommsMode) : true;
                                                                return matchesSearch && matchesUser && matchesMode && !m.is_system;
                                                            }).map((msg, idx) => (
                                                                <div key={getStableKey(msg.id, `${suit.id}-msg-${idx}-${msg.user_id || msg.user_name || String(msg.content || '').slice(0, 20)}`)} className="group border-b border-white/5 pb-3">
                                                                    <div className="flex justify-between items-start mb-1">
                                                                        <div className="flex items-center gap-2">
                                                                            {suit.id === 'clubs' ? (
                                                                                <button
                                                                                    onClick={() => {
                                                                                        const cleanName = msg.user_name?.trim();
                                                                                        const cleanNameLower = cleanName?.toLowerCase();
                                                                                        const mappedId = clubsIDMap[cleanName] || clubsIDMap[cleanNameLower]; // Lookup by name since IDMap is name-keyed

                                                                                        if (msg.user_id) {
                                                                                            // Set tracking with partial data + correct ID
                                                                                            setTrackingPlayer({
                                                                                                id: msg.user_id,
                                                                                                name: msg.user_name || 'UNKNOWN',
                                                                                                displayId: mappedId || 'UNKNOWN'
                                                                                            });
                                                                                            setClubsFilterUserId(msg.user_id);
                                                                                        }
                                                                                    }}
                                                                                    className={`text-xs font-bold tracking-widest uppercase px-1.5 py-0.5 rounded ${msg.is_system
                                                                                        ? 'bg-red-500 text-white'
                                                                                        : (players.find(p => p.id === msg.user_id)?.role === 'master')
                                                                                            ? 'text-yellow-500 hover:bg-yellow-500/10'
                                                                                            : 'text-cyan-400 hover:bg-cyan-400/10'
                                                                                        }`}
                                                                                >
                                                                                    {(() => {
                                                                                        const cleanName = msg.user_name?.trim();
                                                                                        const cleanNameLower = cleanName?.toLowerCase();
                                                                                        // Source: Supabase Profile Map (Matches Player View)
                                                                                        const mapped = clubsIDMap[msg.user_id] || (cleanName ? clubsIDMap[cleanName] : undefined) || (cleanNameLower ? clubsIDMap[cleanNameLower] : undefined);

                                                                                        const name = msg.user_name || 'UNKNOWN';

                                                                                        if (mapped && name.includes(mapped)) return name;
                                                                                        return mapped ? `${mapped} [${name}]` : name;
                                                                                    })()}
                                                                                </button>
                                                                            ) : (
                                                                                <span className={`text-xs font-bold tracking-widest uppercase px-1.5 py-0.5 rounded ${msg.channel === 'master' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-cyan-500/10 text-cyan-400'}`}>
                                                                                    {msg.user_name}
                                                                                </span>
                                                                            )}
                                                                            <span className="text-xs text-gray-500 font-mono">
                                                                                {new Date(msg.created_at).toLocaleTimeString()}
                                                                            </span>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => handleDeleteMessage(msg.id, suit.id)}
                                                                            className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-500 transition-all p-1"
                                                                            title="Purge Transcript"
                                                                        >
                                                                            <Trash2 size={12} />
                                                                        </button>
                                                                    </div>
                                                                    <p className={`text-base font-mono break-words leading-relaxed tracking-wide ${msg.is_system ? 'text-gray-500 italic text-sm' : 'text-gray-100'}`}>
                                                                        {msg.content}
                                                                    </p>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                    <div className="p-3 bg-white/5 border-t border-white/10 text-[9px] text-gray-500 font-mono flex justify-between">
                                                        <span>ENCRYPTION: AES-256-GCM</span>
                                                        <span>SIGNAL INTENSITY: 98%</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="bg-black/40 border border-white/10 rounded-xl p-6 flex flex-col h-[400px] lg:h-[500px] overflow-y-auto admin-scrollbar">
                                                    {(() => {
                                                        const suitColor = suit.id === 'clubs' ? '#22c55e' : suit.id === 'spades' ? '#3b82f6' : suit.id === 'diamonds' ? '#a855f7' : '#ef4444';
                                                        const suitGlow = suit.id === 'clubs' ? 'rgba(34,197,94,' : suit.id === 'spades' ? 'rgba(59,130,246,' : suit.id === 'diamonds' ? 'rgba(168,85,247,' : 'rgba(239,68,68,';

                                                        // Filter profiles to this game's players (show all players if none assigned to this game)
                                                        const allPlayerProfiles = players.filter(p => p.role === 'player');
                                                        const gamePlayers = allPlayerProfiles.filter(p =>
                                                            p.game_type?.toLowerCase() === suit.id
                                                        );
                                                        // If no players assigned to this game, show all players
                                                        const displayPlayers = gamePlayers.length > 0 ? gamePlayers : allPlayerProfiles;
                                                        const totalRegistered = allPlayerProfiles.length;
                                                        const gameCount = displayPlayers.length;
                                                        const maxVisa = totalRegistered > 0 ? Math.max(...allPlayerProfiles.filter(p => p.visa_points != null).map(p => p.visa_points as number), 1) : 1;

                                                        // Bar chart: profiles stats
                                                        const withWins = displayPlayers.filter(p => (p.wins ?? 0) > 0).length;
                                                        const withLosses = displayPlayers.filter(p => (p.losses ?? 0) > 0).length;
                                                        const avgVisa = gameCount > 0 ? Math.round(displayPlayers.reduce((a, p) => a + (p.visa_points ?? 0), 0) / gameCount) : 0;
                                                        const avgWins = gameCount > 0 ? (displayPlayers.reduce((a, p) => a + (p.wins ?? 0), 0) / gameCount) : 0;
                                                        const avgLosses = gameCount > 0 ? (displayPlayers.reduce((a, p) => a + (p.losses ?? 0), 0) / gameCount) : 0;

                                                        // Pie outer: per-player segments (defined below)

                                                        // Suit-specific color palettes
                                                        const suitPalettes: Record<string, { outer: string[]; inner: string[]; glow: string }> = {
                                                            clubs: {
                                                                outer: ['#166534', '#15803d', '#22c55e', '#86efac'],
                                                                inner: ['#166534', '#22c55e', '#4ade80'],
                                                                glow: 'rgba(34,197,94,',
                                                            },
                                                            spades: {
                                                                outer: ['#1e3a8a', '#1e40af', '#3b82f6', '#93c5fd'],
                                                                inner: ['#1e3a8a', '#3b82f6', '#60a5fa'],
                                                                glow: 'rgba(59,130,246,',
                                                            },
                                                            diamonds: {
                                                                outer: ['#6b21a8', '#7e22ce', '#a855f7', '#d8b4fe'],
                                                                inner: ['#6b21a8', '#a855f7', '#c084fc'],
                                                                glow: 'rgba(168,85,247,',
                                                            },
                                                            hearts: {
                                                                outer: ['#991b1b', '#dc2626', '#ef4444', '#fca5a5'],
                                                                inner: ['#991b1b', '#ef4444', '#f87171'],
                                                                glow: 'rgba(239,68,68,',
                                                            },
                                                        };
                                                        const palette = suitPalettes[suit.id] || suitPalettes.clubs;

                                                        // Pie outer: per-player, sized by visa_points, ordered by updated_at (most recent first)
                                                        const piePlayers = [...displayPlayers]
                                                            .sort((a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime());

                                                        const pieSegments = piePlayers.map((p, i) => ({
                                                            label: p.username || `Player ${i + 1}`,
                                                            value: Math.max(1, p.visa_points ?? 0),
                                                            color: palette.outer[i % palette.outer.length],
                                                            glowColor: `${palette.glow}0.7)`,
                                                        })).filter(s => s.value > 0);

                                                        // Pie inner: total wins vs total losses across all players
                                                        const totalWins = allPlayerProfiles.reduce((a, p) => a + (p.wins ?? 0), 0);
                                                        const totalLosses = allPlayerProfiles.reduce((a, p) => a + (p.losses ?? 0), 0);

                                                        const innerSegments = [
                                                            { label: 'WINS', value: totalWins, color: palette.inner[0], glowColor: `${palette.glow}0.8)` },
                                                            { label: 'LOSSES', value: totalLosses, color: palette.inner[1], glowColor: `${palette.glow}0.6)` },
                                                        ].filter(s => s.value > 0);

                                                        // Get all players sorted by visa_points (top) then created_at
                                                        const allSortedPlayers = allPlayerProfiles
                                                            .filter(p => (p.visa_points ?? 0) > 0)
                                                            .sort((a, b) => (b.visa_points ?? 0) - (a.visa_points ?? 0));

                                                        const totalPlayers = allSortedPlayers.length;
                                                        const totalPages = Math.max(
                                                            Math.ceil(totalPlayers / PLAYERS_PER_CHART_PAGE),
                                                            Math.ceil(displayPlayers.length / PLAYERS_PER_CHART_PAGE)
                                                        );
                                                        const currentPage = getChartPlayerPage(suit.id);
                                                        const paginatedPlayers = allSortedPlayers.slice(
                                                            currentPage * PLAYERS_PER_CHART_PAGE,
                                                            (currentPage + 1) * PLAYERS_PER_CHART_PAGE
                                                        );

                                                        // Line chart data - 7 players by rank
                                                        const lineChartData = paginatedPlayers.map((p, index) => ({
                                                            rank: currentPage * PLAYERS_PER_CHART_PAGE + index + 1,
                                                            name: p.username || `Player ${index + 1}`,
                                                            visa_points: p.visa_points ?? 0,
                                                            wins: p.wins ?? 0,
                                                            losses: p.losses ?? 0,
                                                        }));

                                                        // Bar chart data - per player, arranged by name, 7 per page (shows each player's updated_at)
                                                        const barPlayers = [...displayPlayers]
                                                            .sort((a, b) => (a.username || '').localeCompare(b.username || ''));

                                                        const barTotalPages = Math.ceil(barPlayers.length / PLAYERS_PER_CHART_PAGE);
                                                        const barStart = currentPage * PLAYERS_PER_CHART_PAGE;
                                                        const barPagePlayers = barPlayers.slice(barStart, barStart + PLAYERS_PER_CHART_PAGE);

                                                        const barData = barPagePlayers.map((p, i) => ({
                                                            label: p.username || `Player ${i + 1}`,
                                                            value: Math.max(0, p.visa_points ?? 0),
                                                            color: palette.outer[(barStart + i) % palette.outer.length],
                                                            updatedAt: p.updated_at ? new Date(p.updated_at).toLocaleString() : '—',
                                                        }));

                                                        // Player list for tooltip
                                                        const playerNames = paginatedPlayers.map((p, i) => `#${currentPage * PLAYERS_PER_CHART_PAGE + i + 1} ${p.username || 'Unknown'}`).join(' | ');

                                                        return (
                                                            <div className="flex flex-col items-center justify-center h-full gap-4">
                                                                <div className="w-full flex items-center justify-between mb-2 min-h-[48px]">
                                                                    <h4 className="text-sm font-bold tracking-widest uppercase text-gray-400 flex items-center gap-2">
                                                                        {getEffectiveViewMode(suit.id) === 'bar' ? <BarChart3 size={16} className="text-gray-500" /> : getEffectiveViewMode(suit.id) === 'pie' ? <PieChartIcon size={16} className="text-gray-500" /> : getEffectiveViewMode(suit.id) === 'line' ? <Activity size={16} className="text-gray-500" /> : <Radio size={16} className="text-gray-500" />}
                                                                        PLAYER ANALYTICS
                                                                    </h4>
                                                                    {getEffectiveViewMode(suit.id) === 'pie' && selectedPieInfo[suit.id] && (
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-2xl font-black" style={{ color: selectedPieInfo[suit.id]!.color }}>
                                                                                {selectedPieInfo[suit.id]!.value}
                                                                            </span>
                                                                            <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">
                                                                                {selectedPieInfo[suit.id]!.label}
                                                                            </span>
                                                                            <span className="text-sm font-bold text-gray-500">
                                                                                ({selectedPieInfo[suit.id]!.total > 0 ? ((selectedPieInfo[suit.id]!.value / selectedPieInfo[suit.id]!.total) * 100).toFixed(1) : 0}%)
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                    {totalPages > 1 && getEffectiveViewMode(suit.id) !== 'pie' && (
                                                                        <div className="flex items-center gap-2">
                                                                            <button
                                                                                onClick={() => setChartPlayerPageFn(suit.id, Math.max(0, currentPage - 1))}
                                                                                disabled={currentPage === 0}
                                                                                className="p-1.5 bg-white/5 border border-white/10 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                                                                title="Previous 7 Players"
                                                                            >
                                                                                <ChevronLeft size={14} className="text-gray-400" />
                                                                            </button>
                                                                            <span className="text-[10px] font-mono text-gray-500 px-2">
                                                                                {currentPage + 1} / {totalPages}
                                                                            </span>
                                                                            <button
                                                                                onClick={() => setChartPlayerPageFn(suit.id, Math.min(totalPages - 1, currentPage + 1))}
                                                                                disabled={currentPage >= totalPages - 1}
                                                                                className="p-1.5 bg-white/5 border border-white/10 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                                                                title="Next 7 Players"
                                                                            >
                                                                                <ChevronRight size={14} className="text-gray-400" />
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {getEffectiveViewMode(suit.id) === 'bar' ? (
                                                                    <div className="w-full">
                                                                        <MiniChart data={barData} color={suitColor} glowColor={`${suitGlow}0.5)`} />
                                                                    </div>
                                                                ) : getEffectiveViewMode(suit.id) === 'pie' ? (
                                                                    <PieChart segments={pieSegments} innerSegments={innerSegments} size={320} thickness={18} onSelect={(seg, total) => setSelectedPieInfo(prev => ({ ...prev, [suit.id]: seg ? { ...seg, total } : null }))} />
                                                                ) : getEffectiveViewMode(suit.id) === 'line' ? (
                                                                    <div className="w-full h-full max-h-[300px]">
                                                                        <ResponsiveContainer width="100%" height="100%">
                                                                            <LineChart data={lineChartData.length > 0 ? lineChartData : platformData as any} margin={{ top: 20, right: 20, left: 5, bottom: 20 }}>
                                                                                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                                                                                <XAxis
                                                                                    dataKey="rank"
                                                                                    axisLine={false}
                                                                                    tickLine={false}
                                                                                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                                                                                    tickMargin={10}
                                                                                    tickFormatter={(value) => `#${value}`}
                                                                                />
                                                                                <YAxis
                                                                                    axisLine={false}
                                                                                    tickLine={false}
                                                                                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                                                                                    tickMargin={10}
                                                                                    tickCount={6}
                                                                                />
                                                                                <Tooltip
                                                                                    contentStyle={{
                                                                                        backgroundColor: '#1a1a1a',
                                                                                        border: '1px solid #333',
                                                                                        borderRadius: '8px',
                                                                                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                                                                        color: '#fff',
                                                                                    }}
                                                                                    cursor={{ strokeDasharray: '3 3', stroke: '#666' }}
                                                                                />
                                                                                <Line
                                                                                    type="monotone"
                                                                                    dataKey="visa_points"
                                                                                    stroke={suitColor}
                                                                                    strokeWidth={2}
                                                                                    dot={false}
                                                                                    activeDot={{
                                                                                        r: 6,
                                                                                        fill: suitColor,
                                                                                        stroke: 'white',
                                                                                        strokeWidth: 2,
                                                                                    }}
                                                                                />
                                                                            </LineChart>
                                                                        </ResponsiveContainer>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                                                        <Radio size={32} className="opacity-20 mb-2" />
                                                                        <p className="text-xs font-mono uppercase tracking-widest">Awaiting Signal...</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div >
                            );
                        })
                    }

                    {/* START GAME WAITING LIST WINDOW */}
                    <AnimatePresence key="start-presence">
                        {showStartModal && (
                            <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 bg-black/80 backdrop-blur-sm">
                                <motion.div
                                    initial={sectionFloat.initial}
                                    animate={sectionFloat.animate}
                                    exit={sectionFloat.exit}
                                    transition={sectionFloat.transition}
                                    className={`w-full max-w-[95vw] sm:max-w-2xl bg-[#050508]/90 backdrop-blur-xl border rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[80vh] ${selectedSuitForModal === 'hearts' ? 'border-red-500/30' : selectedSuitForModal === 'spades' ? 'border-blue-500/30' : selectedSuitForModal === 'diamonds' ? 'border-purple-500/30' : 'border-green-500/30'}`}
                                >
                                    {/* Header */}
                                    <div className="p-3 sm:p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                                        <div>
                                            <h3 className="text-xl font-display font-bold text-white tracking-widest flex items-center gap-3">
                                                <Users className={selectedSuitForModal === 'hearts' ? 'text-red-500' : selectedSuitForModal === 'spades' ? 'text-blue-500' : selectedSuitForModal === 'diamonds' ? 'text-purple-400' : 'text-green-500'} size={24} />
                                                WAITING LIST ({selectedSuitForModal?.toUpperCase()})
                                            </h3>
                                            <p className={`text-[10px] font-mono uppercase tracking-[0.2em] mt-1 ${selectedSuitForModal === 'hearts' ? 'text-red-500' : selectedSuitForModal === 'spades' ? 'text-blue-500' : selectedSuitForModal === 'diamonds' ? 'text-purple-400' : 'text-green-500'}`}>
                                                Active Player Roster // Ready for Deployment
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setShowStartModal(false)}
                                            className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-500 hover:text-white"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>

                                    {/* List */}
                                    <div className="flex-1 overflow-y-auto p-0 admin-scrollbar">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-white/[0.02] sticky top-0 z-10 backdrop-blur-md">
                                                <tr>
                                                    <th className="p-2 sm:p-4 text-[8px] sm:text-[9px] lg:text-[9px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/10 hidden sm:table-cell">ID</th>
                                                    <th className="p-2 sm:p-4 text-[8px] sm:text-[9px] lg:text-[9px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/10">Player Name</th>
                                                    <th className="p-2 sm:p-4 text-[8px] sm:text-[9px] lg:text-[9px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/10 hidden sm:table-cell">Status</th>
                                                    <th className="p-2 sm:p-4 text-[8px] sm:text-[9px] lg:text-[9px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/10 hidden sm:table-cell">Visa</th>
                                                    <th className="p-2 sm:p-4 text-[8px] sm:text-[9px] lg:text-[9px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/10 text-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {waitingPlayers.length > 0 ? (
                                                    waitingPlayers
                                                        .filter(player => {
                                                            const modalSuit = (selectedSuitForModal || '').toLowerCase();
                                                            const pType = (player.game_type || '').toLowerCase();

                                                            if (!modalSuit) return true;

                                                            // Legacy fallback
                                                            if (!pType) return modalSuit === 'clubs';

                                                            return pType === modalSuit;
                                                        })
                                                        .map((player, idx) => {
                                                            const dbUser = players.find(p => p.username === player.username || p.id === player.user_id);
                                                            return (
                                                                <tr key={getPlayerElementKey(player, idx, 'waiting')} className="hover:bg-white/[0.02] transition-colors">
                                                                    <td className={`p-2 sm:p-4 font-mono text-xs font-bold hidden sm:table-cell ${selectedSuitForModal === 'hearts' ? 'text-red-500' : selectedSuitForModal === 'spades' ? 'text-blue-500' : selectedSuitForModal === 'diamonds' ? 'text-purple-400' : 'text-green-500'}`}>
                                                                        {clubsIDMap[player.username] || clubsIDMap[player.username?.toLowerCase()] || `#UNK_${(player.user_id || '????').slice(0, 4)}`}
                                                                    </td>
                                                                    <td className="p-2 sm:p-4 font-mono text-xs text-gray-300">
                                                                        {player.username}
                                                                    </td>
                                                                    <td className="p-2 sm:p-4 hidden sm:table-cell">
                                                                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider ${selectedSuitForModal === 'hearts' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                                                            selectedSuitForModal === 'spades' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                                                                selectedSuitForModal === 'diamonds' ? 'bg-purple-400/10 text-purple-400 border-purple-400/20' :
                                                                                    'bg-green-500/10 text-green-500 border-green-500/20'
                                                                            }`}>
                                                                            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${selectedSuitForModal === 'hearts' ? 'bg-red-500' :
                                                                                selectedSuitForModal === 'spades' ? 'bg-blue-500' :
                                                                                    selectedSuitForModal === 'diamonds' ? 'bg-purple-400' :
                                                                                        'bg-green-500'
                                                                                }`} />
                                                                            READY
                                                                        </span>
                                                                    </td>
                                                                    <td className="p-4 font-mono text-xs text-gray-500">
                                                                        {dbUser?.visaDays || '???'} Days
                                                                    </td>
                                                                    <td className="p-4 text-right">
                                                                        <button
                                                                            onClick={() => handleKickPlayer(player.user_id, player.username)}
                                                                            className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                                                            title="Remove from Queue"
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                ) : (
                                                    <tr>
                                                        <td colSpan={4} className="p-8 text-center text-gray-500 font-mono text-xs uppercase tracking-widest">
                                                            Running Scan... No Active Players Detected.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {bannedPlayers.length > 0 && (
                                        <div className="border-t border-red-500/20 bg-red-900/10 max-h-48 overflow-y-auto">
                                            <div className="p-4 border-b border-red-500/20 sticky top-0 bg-red-950/90 backdrop-blur">
                                                <h4 className="text-red-500 font-bold font-mono text-xs uppercase tracking-widest flex items-center gap-2">
                                                    BANNED CANDIDATES
                                                </h4>
                                            </div>
                                            <table className="w-full text-left border-collapse">
                                                <tbody>
                                                    {bannedPlayers.map((player, idx) => (
                                                        <tr key={getPlayerElementKey(player, idx, 'banned')} className="border-b border-red-500/10 last:border-0 hover:bg-red-500/5 transition-colors">
                                                            <td className="p-4 text-gray-500 font-mono text-xs w-1/4 truncate">{player.user_id?.slice(0, 10) ?? 'UNKNOWN'}...</td>
                                                            <td className="p-4 text-white font-mono text-sm w-1/3 truncate">{player.username}</td>
                                                            <td className="p-4 text-center w-1/4">
                                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/20 text-red-500 text-[10px] uppercase font-bold tracking-wider border border-red-500/30">
                                                                    BANNED
                                                                </span>
                                                            </td>
                                                            <td className="p-4 text-right w-1/4">
                                                                <button
                                                                    onClick={() => {
                                                                        bannedPlayersRef.current = bannedPlayersRef.current.filter(p => p.user_id !== player.user_id);
                                                                        setBannedPlayers(bannedPlayersRef.current);
                                                                    }}
                                                                    className="text-gray-400 hover:text-green-400 transition-colors text-xs font-bold uppercase tracking-widest"
                                                                    title="RESTORE PLAYER"
                                                                >
                                                                    RESTORE
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {/* Footer / Actions */}
                                    <div className="p-6 border-t border-white/10 bg-black/40 flex flex-col gap-4">
                                        {(!selectedSuitForModal || selectedSuitForModal.toLowerCase() === 'clubs') && (() => {
                                            const finalFiltered = waitingPlayers.filter(p => !selectedSuitForModal || (p.game_type?.toLowerCase() === selectedSuitForModal?.toLowerCase()) || (!p.game_type && selectedSuitForModal === 'clubs'));
                                            const hasPlayer = finalFiltered.some(p => p.role === 'player' || !p.role);
                                            const hasMaster = finalFiltered.some(p => p.role === 'master' || p.role === 'admin' || p.username === 'admin');

                                            if (hasPlayer && hasMaster) return null;

                                            return (
                                                <div className="w-full bg-red-500/10 border border-red-500/30 rounded p-2 text-center animate-pulse">
                                                    <span className="text-[9px] font-mono font-bold text-red-500 tracking-widest uppercase">
                                                        ⚠️ WARNING: CLUBS PROTOCOL REQUIRES AT LEAST 1 PLAYER AND 1 MASTER TO INITIATE
                                                    </span>
                                                </div>
                                            );
                                        })()}
                                        {(selectedSuitForModal?.toLowerCase() === 'hearts') && (() => {
                                            const finalFiltered = waitingPlayers.filter(p => p.game_type?.toLowerCase() === 'hearts');
                                            const hasPlayer = finalFiltered.some(p => p.role === 'player' || !p.role);
                                            const hasMaster = finalFiltered.some(p => p.role === 'master' || p.role === 'admin' || p.username === 'admin');

                                            if (hasPlayer && hasMaster) return null;

                                            return (
                                                <div className="w-full bg-red-500/10 border border-red-500/30 rounded p-2 text-center animate-pulse mb-2">
                                                    <span className="text-[9px] font-mono font-bold text-red-500 tracking-widest uppercase">
                                                        ⚠️ WARNING: HEARTS PROTOCOL REQUIRES AT LEAST 1 PLAYER AND 1 MASTER TO INITIATE
                                                    </span>
                                                </div>
                                            );
                                        })()}
                                        {(selectedSuitForModal?.toLowerCase() === 'spades') && (() => {
                                            const finalFiltered = waitingPlayers.filter(p => p.game_type?.toLowerCase() === 'spades');
                                            const playersCount = finalFiltered.filter(p => p.role !== 'master' && p.role !== 'admin' && p.username !== 'admin').length;
                                            if (playersCount >= 2) return null;
                                            return (
                                                <div className="w-full bg-red-500/10 border border-red-500/30 rounded p-2 text-center animate-pulse mb-2">
                                                    <span className="text-[9px] font-mono font-bold text-red-500 tracking-widest uppercase">
                                                        ⚠️ WARNING: SPADES PROTOCOL REQUIRES AT LEAST 2 PLAYERS TO INITIATE
                                                    </span>
                                                </div>
                                            );
                                        })()}
                                        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center w-full gap-3 sm:gap-4">
                                            <div className="text-[10px] sm:text-xs font-mono text-gray-500 text-center sm:text-left">
                                                <span className="text-white font-bold">
                                                    {waitingPlayers.filter(p => !selectedSuitForModal || (p.game_type?.toLowerCase() === selectedSuitForModal?.toLowerCase()) || (!p.game_type && selectedSuitForModal === 'clubs')).length}
                                                </span> CANDIDATES READY
                                            </div>
                                            <div className="flex items-center gap-2 sm:gap-3">
                                                <button
                                                    onClick={handleGlobalPurgeQueue}
                                                    className="px-3 sm:px-6 py-2.5 sm:py-3 rounded-lg border border-red-500/30 bg-red-500/10 text-[10px] sm:text-xs font-bold text-red-500 uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all mr-auto"
                                                >
                                                    Global Purge
                                                </button>
                                                <button
                                                    onClick={() => setShowStartModal(false)}
                                                    className="px-3 sm:px-6 py-2.5 sm:py-3 rounded-lg border border-white/10 text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest hover:bg-white/5 hover:text-white transition-all"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        // Filter again for action
                                                        const finalFiltered = waitingPlayers.filter(p => !selectedSuitForModal || (p.game_type?.toLowerCase() === selectedSuitForModal?.toLowerCase()) || (!p.game_type && selectedSuitForModal === 'clubs'));
                                                        // FIXED: Filter out Masters and Admins from the scoring whitelist (allowed_players)
                                                        // This ensures they don't appear in the "Top Player" ranking.
                                                        const allowedIds = finalFiltered
                                                            .filter(p => p.role !== 'master' && p.role !== 'admin' && p.username !== 'admin')
                                                            .map(p => p.user_id)
                                                            .filter(Boolean);

                                                        if (selectedSuitForModal?.toLowerCase() === 'spades' && allowedIds.length < 2) {
                                                            showToast("FAILURE: SPADES REQUIRES AT LEAST 2 PLAYERS.", 'error');
                                                            return;
                                                        }

                                                        const suit = selectedSuitForModal || 'clubs';
                                                        const suitKey = suit === 'hearts' ? 'hearts_main' : suit === 'spades' ? 'spades_main' : suit === 'diamonds' ? 'diamonds_king' : 'clubs_king';

                                                        console.log(`Saving Allowed Players for ${suit} to Supabase:`, allowedIds);

                                                        // 1. Save Allowed Players to Supabase
                                                        try {
                                                            console.log("=> STEP 1: Attempting to save allowed_players...");
                                                            const accessToken = await getAccessToken();
                                                            const fetchRes = await fetch(`${supabaseUrl}/rest/v1/${suit === 'spades' ? 'spades_game_state' : 'clubs_game_status'}?id=eq.${suitKey}`, {
                                                                method: 'PATCH',
                                                                headers: {
                                                                    'Content-Type': 'application/json',
                                                                    'Authorization': `Bearer ${accessToken}`,
                                                                    'apikey': supabaseKey,
                                                                    'Prefer': 'return=minimal'
                                                                },
                                                                body: JSON.stringify({ allowed_players: allowedIds })
                                                            });
                                                            if (!fetchRes.ok) {
                                                                console.warn("Failed to save allowed players:", await fetchRes.text());
                                                            }
                                                        } catch (err) {
                                                            console.warn("Failed to save allowed players (Network or Timeout):", err);
                                                        }

                                                        console.log("=> STEP 2: Moving past allowed players block.");

                                                        if (suit === 'diamonds') {
                                                        }

                                                        console.log("=> STEP 3: Checking restrictions...");
                                                        const isHearts = suit === 'hearts';
                                                        const isSpades = suit === 'spades';

                                                        if (isSpades) {
                                                            const invalidPlayers = finalFiltered.filter(p => p.role === 'master' || p.role === 'admin');
                                                            if (invalidPlayers.length > 0) {
                                                                const names = invalidPlayers.map(p => p.username).join(', ');
                                                                showToast(`FAILURE: SPADES IS PLAYER-ONLY. REMOVE: ${names}`, 'error');
                                                                return;
                                                            }
                                                        }

                                                        if (suit === 'clubs') {
                                                            const hasPlayer = finalFiltered.some(p => p.role === 'player' || !p.role);
                                                            const hasMaster = finalFiltered.some(p => p.role === 'master' || p.role === 'admin' || p.username === 'admin');

                                                            if (!hasPlayer || !hasMaster) {
                                                                showToast("FAILURE: CLUBS REQUIRES AT LEAST 1 PLAYER AND 1 MASTER.", 'error');
                                                                return;
                                                            }
                                                        }

                                                        if (suit === 'hearts') {
                                                            const hasPlayer = finalFiltered.some(p => p.role === 'player' || !p.role);
                                                            const hasMaster = finalFiltered.some(p => p.role === 'master' || p.role === 'admin' || p.username === 'admin');

                                                            if (!hasPlayer || !hasMaster) {
                                                                showToast("FAILURE: HEARTS REQUIRES AT LEAST 1 PLAYER AND 1 MASTER.", 'error');
                                                                return;
                                                            }
                                                        }

                                                        console.log("=> STEP 4: Restrictions passed. Building updateData.");
                                                        const currentTable = isHearts ? 'hearts_game_state' : isSpades ? 'spades_game_state' : suit === 'diamonds' ? 'diamonds_game_state' : 'clubs_game_status';

                                                        const updateData: any = {
                                                            system_start: true,
                                                            is_paused: false
                                                        };

                                                        if (!isHearts) {
                                                            updateData.is_active = true;
                                                            updateData.allowed_players = allowedIds;
                                                        }


                                                        if (suit === 'clubs' || suit === 'hearts' || suit === 'spades' || suit === 'diamonds') {
                                                            const now = new Date();
                                                            updateData.current_round = 1;

                                                            if (isSpades) {
                                                                updateData.phase = 'briefing';
                                                                updateData.phase_started_at = now.toISOString();
                                                                updateData.phase_duration_sec = 60;

                                                                let profilesData: any[] = [];
                                                                try {
                                                                    const accessToken = await getAccessToken();
                                                                    const allParticipantIds = finalFiltered.map(p => p.user_id).filter(Boolean);
                                                                    const profileRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=in.(${allParticipantIds.join(',')})&select=id,visa_points`, {
                                                                        headers: {
                                                                            'Authorization': `Bearer ${accessToken}`,
                                                                            'apikey': supabaseKey,
                                                                            'Accept': 'application/json'
                                                                        }
                                                                    });
                                                                    if (profileRes.ok) {
                                                                        const rawData = await profileRes.json();
                                                                        profilesData = Array.isArray(rawData) ? rawData : [rawData];
                                                                    } else {
                                                                        console.warn("Failed to fetch visa points, defaulting to 1000:", await profileRes.text());
                                                                    }
                                                                } catch (err) {
                                                                    console.warn("Exception fetching visa points:", err);
                                                                }

                                                                const visaMap: Record<string, number> = {};
                                                                profilesData?.forEach((p: any) => {
                                                                    if (p.id) visaMap[p.id] = p.visa_points;
                                                                });

                                                                const spadesPlayers: Record<string, any> = {};
                                                                for (const p of finalFiltered) {
                                                                    if (p.user_id) {
                                                                        const startingScore = visaMap[p.user_id] ?? 1000;
                                                                        spadesPlayers[p.user_id] = {
                                                                            id: p.user_id,
                                                                            username: p.username || `PLAYER${p.user_id.slice(0, 4)}`,
                                                                            score: startingScore,
                                                                            start_score: startingScore,
                                                                            cards: [],
                                                                            bid: 0,
                                                                            status: 'active'
                                                                        };
                                                                    }
                                                                }
                                                                updateData.players = spadesPlayers;
                                                                updateData.round_data = {};
                                                            } else if (isHearts) {
                                                                const masters = finalFiltered.filter(p => p.role === 'master');
                                                                const players = finalFiltered.filter(p => p.role === 'player' || !p.role || p.role === 'admin');

                                                                if (masters.length < 1 || players.length < 1) {
                                                                    setShowStartModal(false);
                                                                    showToast("FAILURE: HEARTS REQUIRES 1 MASTER + 1 PLAYER.", 'error');
                                                                    return;
                                                                }

                                                                updateData.phase = 'briefing';
                                                                updateData.phase_started_at = now.toISOString();
                                                                updateData.phase_duration_sec = 60;

                                                                let profilesData: any[] = [];
                                                                try {
                                                                    const accessToken = await getAccessToken();
                                                                    const allParticipantIds = finalFiltered.map(p => p.user_id).filter(Boolean);
                                                                    const profileRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=in.(${allParticipantIds.join(',')})&select=id,visa_points`, {
                                                                        headers: {
                                                                            'Authorization': `Bearer ${accessToken}`,
                                                                            'apikey': supabaseKey,
                                                                            'Accept': 'application/json'
                                                                        }
                                                                    });
                                                                    if (profileRes.ok) {
                                                                        const rawData = await profileRes.json();
                                                                        profilesData = Array.isArray(rawData) ? rawData : [rawData];
                                                                    }
                                                                } catch (err) {
                                                                    console.warn("Exception fetching visa points for Hearts:", err);
                                                                }

                                                                const visaMap: Record<string, number> = {};
                                                                profilesData?.forEach((p: any) => {
                                                                    if (p.id) visaMap[p.id] = p.visa_points ?? 1000;
                                                                });

                                                                updateData.participants = finalFiltered.map(p => {
                                                                    const startingScore = p.user_id && visaMap[p.user_id] !== undefined ? visaMap[p.user_id] : 1000;
                                                                    return {
                                                                        id: p.user_id,
                                                                        name: p.username || 'Unknown',
                                                                        role: p.role || 'player',
                                                                        status: 'active',
                                                                        score: startingScore,
                                                                        start_score: startingScore,
                                                                        last_total_score: startingScore,
                                                                        eye_of_truth_uses: p.role === 'master' ? 2 : 1
                                                                    };
                                                                });
                                                            } else if (suit === 'clubs') {
                                                                updateData.gameState = 'idle';
                                                                updateData.round_data = {
                                                                    master_selection: null,
                                                                    player_selection: null
                                                                };

                                                                // VISA SCORE INJECTION FOR CLUBS
                                                                try {
                                                                    const accessToken = await getAccessToken();
                                                                    const allParticipantIds = finalFiltered.map(p => p.user_id).filter(Boolean);
                                                                    const profileRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=in.(${allParticipantIds.join(',')})&select=id,visa_points`, {
                                                                        headers: {
                                                                            'Authorization': `Bearer ${accessToken}`,
                                                                            'apikey': supabaseKey,
                                                                            'Accept': 'application/json'
                                                                        }
                                                                    });
                                                                    let profilesData: any[] = [];
                                                                    if (profileRes.ok) {
                                                                        const rawData = await profileRes.json();
                                                                        profilesData = Array.isArray(rawData) ? rawData : [rawData];
                                                                    }

                                                                    const startScores: Record<string, number> = {};
                                                                    Array.isArray(profilesData) && profilesData.forEach((p: any) => {
                                                                        if (p.id) startScores[p.id] = p.visa_points || 0;
                                                                    });

                                                                    updateData.scores = {
                                                                        start: startScores,
                                                                        current: { ...startScores },
                                                                        history: {},
                                                                        high_player: { score: 0, uid: null },
                                                                        high_master: { score: 0, uid: null }
                                                                    };
                                                                    console.log("Injecting Visa Scores for Clubs:", startScores);
                                                                } catch (err) {
                                                                    console.warn("=> STEP 5 ERROR: Failed to inject Visa Scores:", err);
                                                                }

                                                                console.log("=> STEP 6: Creating Game Session...");
                                                                try {
                                                                    const newGameId = generateGameId();
                                                                    const accessToken = await getAccessToken();
                                                                    const sessionRes = await fetch(`${supabaseUrl}/rest/v1/clubs_game_sessions`, {
                                                                        method: 'POST',
                                                                        headers: {
                                                                            'Content-Type': 'application/json',
                                                                            'Authorization': `Bearer ${accessToken}`,
                                                                            'apikey': supabaseKey,
                                                                            'Prefer': 'return=minimal'
                                                                        },
                                                                        body: JSON.stringify({
                                                                            id: newGameId,
                                                                            status: 'active',
                                                                            current_round: 1,
                                                                            total_rounds: 6
                                                                        })
                                                                    });

                                                                    if (!sessionRes.ok) {
                                                                        console.warn("[GAME TRACKING] Failed to create session:", await sessionRes.text());
                                                                    } else {
                                                                        updateData.active_game_id = newGameId;
                                                                        console.log(`[GAME TRACKING] Created session: ${newGameId}`);
                                                                    }
                                                                } catch (trackErr) {
                                                                    console.warn("[GAME TRACKING] Failed to create session exception:", trackErr);
                                                                }
                                                            } else if (suit === 'diamonds') {
                                                                updateData.phase = 'idle';
                                                                updateData.current_round = 1;
                                                                updateData.system_start = true;
                                                                updateData.phase_started_at = now.toISOString();
                                                                updateData.phase_duration_sec = 0;
                                                                updateData.updated_at = now.toISOString();
                                                            }
                                                        }

                                                        console.log("=> STEP 7: Executing final game start update on", currentTable);
                                                        try {
                                                            const accessToken = await getAccessToken();
                                                            const fetchRes = await fetch(`${supabaseUrl}/rest/v1/${currentTable}?id=eq.${suitKey}`, {
                                                                method: 'PATCH',
                                                                headers: {
                                                                    'Content-Type': 'application/json',
                                                                    'Authorization': `Bearer ${accessToken}`,
                                                                    'apikey': supabaseKey,
                                                                    'Prefer': 'return=minimal'
                                                                },
                                                                body: JSON.stringify(updateData)
                                                            });

                                                            if (!fetchRes.ok) {
                                                                const errText = await fetchRes.text();
                                                                console.warn("Retrying start without allowed_players (Schema Mismatch)");
                                                                delete updateData.allowed_players;

                                                                if (isSpades && errText.includes('phase_started_at')) {
                                                                    delete updateData.phase_started_at;
                                                                    delete updateData.phase_duration_sec;
                                                                    delete updateData.paused_remaining_sec;
                                                                }
                                                                const retryRes = await fetch(`${supabaseUrl}/rest/v1/${currentTable}?id=eq.${suitKey}`, {
                                                                    method: 'PATCH',
                                                                    headers: {
                                                                        'Content-Type': 'application/json',
                                                                        'Authorization': `Bearer ${accessToken}`,
                                                                        'apikey': supabaseKey,
                                                                        'Prefer': 'return=minimal'
                                                                    },
                                                                    body: JSON.stringify(updateData)
                                                                });
                                                                if (!retryRes.ok) {
                                                                    showToast(`START ERROR: ${await retryRes.text()}`, 'error');
                                                                } else {
                                                                    showToast(`${suit.toUpperCase()} PROTOCOL INITIATED (Whitelist Disabled)`, 'info');
                                                                    setShowStartModal(false);
                                                                }
                                                            } else {
                                                                showToast(`${suit.toUpperCase()} PROTOCOL INITIATED.`, 'success');
                                                                setShowStartModal(false);
                                                            }
                                                        } catch (err: any) {
                                                            console.warn("=> STEP 7 ERROR (Network):", err);
                                                            showToast(`START ERROR: ${err.message}`, 'error');
                                                        }
                                                    }}
                                                    className={`px-3 sm:px-6 py-2.5 sm:py-3 rounded-lg text-black text-[10px] sm:text-xs font-black uppercase tracking-widest hover:scale-105 transition-all flex items-center gap-2 ${selectedSuitForModal === 'hearts' ? 'bg-red-500 hover:bg-red-400 shadow-[0_0_20px_rgba(239,68,68,0.3)]' : selectedSuitForModal === 'spades' ? 'bg-blue-500 hover:bg-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.3)]' : selectedSuitForModal === 'diamonds' ? 'bg-purple-500 hover:bg-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.3)]' : 'bg-green-500 hover:bg-green-400 shadow-[0_0_20px_rgba(34,197,94,0.3)]'}`}
                                                >
                                                    INITIATE PROTOCOL <Radio size={14} className="animate-pulse" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        )
                        }
                    </AnimatePresence>
                </AnimatePresence>
            </main >
            {/* HEADLESS GAME LOOPS (To ensure timers run even if Master is not on Game Page) */}
            {/* SPADES: DISABLED (Moved to Peer-to-Peer Host in SpadesGame.tsx) */}
            {
                heartsGameStatus?.system_start && (
                    <div className="hidden pointer-events-none opacity-0 h-0 w-0 overflow-hidden">
                        <HeartsGameMaster
                            onComplete={() => console.log("Hearts Complete (Headless)")}
                            user={{ id: 'system-architect', username: 'SYSTEM ARCHITECT', role: 'admin' }}
                        />
                    </div>
                )
            }

            {/* CLUBS HEADLESS ENGINE */}
            {
                clubsGameStatus?.system_start && (
                    <div className="hidden pointer-events-none opacity-0 h-0 w-0 overflow-hidden">
                        <ClubsGameMaster
                            isEngine={true}
                            onComplete={() => console.log("Clubs Complete (Headless)")}
                            user={{ id: 'system-architect', username: 'SYSTEM ARCHITECT', role: 'admin' }}
                            onFail={() => { }}
                        />
                    </div>
                )
            }

            {/* SPADES HEADLESS ENGINE */}
            {
                spadesGameStatus?.system_start && (
                    <div className="hidden pointer-events-none opacity-0 h-0 w-0 overflow-hidden">
                        <SpadesGameMaster isEngine={true} />
                    </div>
                )
            }

            {/* Game Settings Modal */}
            <AnimatePresence mode="wait">
                {showGameSettings && (
                    <GameSettingsModal onClose={() => setShowGameSettings(false)} />
                )}
                {showHeartsGameSettings && (
                    <HeartsGameSettingsModal onClose={() => setShowHeartsGameSettings(false)} />
                )}
                {customDialog && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/70 backdrop-blur-md"
                        onClick={() => {
                            if (customDialog.type === 'alert') {
                                customDialog.resolve(undefined);
                                setCustomDialog(null);
                            }
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.92, y: 16, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ scale: 0.92, y: 16, opacity: 0 }}
                            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative w-full max-w-sm overflow-hidden rounded-xl border border-white/15 bg-[#0a0a10] shadow-[0_0_80px_rgba(0,0,0,0.9)] backdrop-blur-sm"
                        >

                            {/* Inner content */}
                            <div className="px-8 pt-8 pb-8 flex flex-col items-center text-center">

                                {/* Decorative suit symbol or Joker image */}
                                {(() => {
                                    const t = (customDialog.title || '').toLowerCase();
                                    const isSpades = t.includes('spades');
                                    const isClubs = t.includes('clubs');
                                    const isDiamonds = t.includes('diamonds');
                                    const isHearts = t.includes('hearts');
                                    if (isSpades) return <div className="text-5xl leading-none mb-5 select-none text-blue-400/70">♠</div>;
                                    if (isClubs) return <div className="text-5xl leading-none mb-5 select-none text-green-400/70">♣</div>;
                                    if (isDiamonds) return <div className="text-5xl leading-none mb-5 select-none text-purple-400/70">♦</div>;
                                    if (isHearts) return <div className="text-5xl leading-none mb-5 select-none text-red-500/70">♥</div>;
                                    // Joker fallback
                                    return <img src="/suit_assets/joker.png" alt="Joker" className="w-12 h-12 object-contain mb-5 opacity-70" />;
                                })()}

                                {/* Title */}
                                {(() => {
                                    const t = (customDialog.title || '').toLowerCase();
                                    const colorClass = t.includes('spades') ? 'text-blue-300'
                                        : t.includes('clubs') ? 'text-green-300'
                                            : t.includes('diamonds') ? 'text-purple-300'
                                                : t.includes('hearts') ? 'text-red-400'
                                                    : customDialog.type === 'alert' ? 'text-red-400'
                                                        : customDialog.type === 'prompt' ? 'text-blue-300'
                                                            : 'text-white';
                                    return (
                                        <h3 style={{ fontFamily: "'Cinzel', serif" }} className={`text-base font-bold tracking-[0.15em] mb-3 leading-snug uppercase ${colorClass}`}>
                                            {customDialog.title}
                                        </h3>
                                    );
                                })()}

                                {/* Divider */}
                                <div className="w-12 h-px bg-white/10 mb-4" />

                                {/* Message */}
                                <p className="text-gray-400 text-[13px] leading-relaxed mb-6 whitespace-pre-line font-mono tracking-wide">
                                    {customDialog.message}
                                </p>

                                {/* Prompt input — card-based broadcast composer */}
                                {customDialog.type === 'prompt' && (
                                    <div className="w-full mb-6">
                                        <div className="bg-[#0a0a0f] border border-white/10 rounded-xl overflow-hidden focus-within:border-blue-500/40 focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.08)] transition-all">
                                            {/* Card header */}
                                            <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-white/5">
                                                <span className="text-[11px] font-mono text-white-400/70 uppercase tracking-[0.25em]">System Message</span>
                                                <span className="ml-auto text-[10px] font-mono text-gray-600">{promptValue.length}/200</span>
                                            </div>
                                            {/* Textarea */}
                                            <textarea
                                                value={promptValue}
                                                onChange={(e) => setPromptValue(e.target.value.slice(0, 200))}
                                                rows={3}
                                                className="w-full bg-transparent px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none font-mono resize-none"
                                                placeholder="Type your broadcast message here..."
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault();
                                                        customDialog.resolve(promptValue);
                                                        setCustomDialog(null);
                                                    }
                                                    if (e.key === 'Escape') {
                                                        customDialog.resolve(null);
                                                        setCustomDialog(null);
                                                    }
                                                }}
                                            />
                                            {/* Card footer hint */}

                                        </div>
                                    </div>
                                )}

                                {/* Buttons */}
                                <div className={`w-full flex gap-3 ${customDialog.type === 'alert' ? 'justify-center' : 'flex-col sm:flex-row'}`}>
                                    {/* ALERT */}
                                    {customDialog.type === 'alert' && (
                                        <button
                                            onClick={() => { customDialog.resolve(undefined); setCustomDialog(null); }}
                                            className="flex-1 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/40 hover:border-red-400 text-red-400 text-[11px] font-mono font-bold uppercase tracking-[0.2em] rounded-lg transition-all active:scale-95"
                                        >
                                            ♦ Acknowledged
                                        </button>
                                    )}

                                    {/* CONFIRM */}
                                    {customDialog.type === 'confirm' && (
                                        <>
                                            <button
                                                onClick={() => { customDialog.resolve(false); setCustomDialog(null); }}
                                                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-gray-400 text-[11px] font-mono font-bold uppercase tracking-[0.15em] rounded-lg transition-all active:scale-95"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => { customDialog.resolve(true); setCustomDialog(null); }}
                                                className="flex-1 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/40 hover:border-red-400 text-red-400 text-[11px] font-mono font-bold uppercase tracking-[0.15em] rounded-lg transition-all active:scale-95"
                                            >
                                                ♦ Confirm
                                            </button>
                                        </>
                                    )}

                                    {/* THREE OPTIONS */}
                                    {customDialog.type === 'confirm_three_options' && (
                                        <div className="w-full flex flex-col gap-2">
                                            <button
                                                onClick={() => { customDialog.resolve('ok'); setCustomDialog(null); }}
                                                className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/40 hover:border-red-400 text-red-400 text-[11px] font-mono font-bold uppercase tracking-[0.15em] rounded-lg transition-all active:scale-95"
                                            >
                                                Keep Points
                                            </button>
                                            <button
                                                onClick={() => { customDialog.resolve('cancel'); setCustomDialog(null); }}
                                                className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-gray-400 text-[11px] font-mono font-bold uppercase tracking-[0.15em] rounded-lg transition-all active:scale-95"
                                            >
                                                Wipe Points
                                            </button>
                                            <button
                                                onClick={() => { customDialog.resolve('alt'); setCustomDialog(null); }}
                                                className="w-full py-2 text-gray-500 hover:text-gray-300 text-[10px] font-mono tracking-[0.2em] uppercase transition-colors"
                                            >
                                                Abort
                                            </button>
                                        </div>
                                    )}

                                    {/* PROMPT */}
                                    {customDialog.type === 'prompt' && (
                                        <>
                                            <button
                                                onClick={() => { customDialog.resolve(null); setCustomDialog(null); }}
                                                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-gray-400 text-[11px] font-mono font-bold uppercase tracking-[0.15em] rounded-lg transition-all active:scale-95"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => { customDialog.resolve(promptValue); setCustomDialog(null); }}
                                                className="flex-1 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 hover:border-blue-400 text-blue-300 text-[11px] font-mono font-bold uppercase tracking-[0.15em] rounded-lg transition-all active:scale-95"
                                            >
                                                ♠ Transmit
                                            </button>
                                        </>
                                    )}
                                </div>

                            </div>

                            {/* Bottom dim glow */}
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-px bg-white/5" />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {
                showAdminCard && adminSettings && (
                    <PlayerCardModal
                        user={adminSettings}
                        onClose={() => setShowAdminCard(false)}
                    />
                )
            }

            {/* Eliminated Players Modal */}
            {
                showEliminatedModal && (() => {
                    const suitColors: Record<string, { shape: string; color: string; border: string; bg: string; shadow: string; hoverBorder: string; textLight: string }> = {
                        clubs: { shape: '♣', color: 'green', border: 'border-green-500/30', bg: 'bg-green-500/5', shadow: 'shadow-green-500/10', hoverBorder: 'hover:border-green-500/20', textLight: 'text-green-400' },
                        spades: { shape: '♠', color: 'blue', border: 'border-blue-500/30', bg: 'bg-blue-500/5', shadow: 'shadow-blue-500/10', hoverBorder: 'hover:border-blue-500/20', textLight: 'text-blue-400' },
                        diamonds: { shape: '♦', color: 'purple', border: 'border-purple-500/30', bg: 'bg-purple-500/5', shadow: 'shadow-purple-500/10', hoverBorder: 'hover:border-purple-500/20', textLight: 'text-purple-400' },
                        hearts: { shape: '♥', color: 'red', border: 'border-red-500/30', bg: 'bg-red-500/5', shadow: 'shadow-red-500/10', hoverBorder: 'hover:border-red-500/20', textLight: 'text-red-400' },
                    };
                    const s = suitColors[showEliminatedModal] || suitColors.hearts;
                    return (
                        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setShowEliminatedModal(null)}>
                            <motion.div
                                initial={sectionFloat.initial}
                                animate={sectionFloat.animate}
                                exit={sectionFloat.exit}
                                transition={sectionFloat.transition}
                                className={`bg-[#0a0a0f] ${s.border} rounded-xl w-[95vw] max-w-md shadow-2xl ${s.shadow}`}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className={`flex items-center justify-between px-5 py-3.5 border-b border-white/10 ${s.bg} rounded-t-xl`}>
                                    <div className="flex items-center gap-2.5">
                                        <span className={`text-xl font-bold ${s.textLight}`}>{s.shape}</span>
                                        <span className={`text-sm font-bold ${s.textLight} uppercase tracking-widest`}>{showEliminatedModal.toUpperCase()} — Eliminated</span>
                                    </div>
                                    <button onClick={() => setShowEliminatedModal(null)} className="text-gray-500 hover:text-white transition-colors text-lg leading-none">&times;</button>
                                </div>
                                <div className="p-5 max-h-[50vh] overflow-y-auto admin-scrollbar">
                                    {getEliminatedPlayers().length === 0 ? (
                                        <div className="text-center text-gray-600 py-10 text-xs uppercase tracking-[0.3em] font-mono">No eliminated players</div>
                                    ) : (
                                        <div className="space-y-2">
                                            {getEliminatedPlayers().map((player: any, idx: number) => (
                                                <div key={getPlayerElementKey(player, idx, 'eliminated')} className={`flex items-center gap-3 p-3 bg-white/[0.03] border border-white/[0.06] rounded-lg ${s.hoverBorder} transition-all`}>
                                                    <div className={`w-8 h-8 rounded-full ${s.bg} border ${s.border} flex items-center justify-center ${s.textLight} text-[10px] font-bold font-mono shrink-0`}>
                                                        {(idx + 1).toString().padStart(2, '0')}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs font-bold text-white truncate">{player.username || player.id || 'UNKNOWN'}</div>
                                                        <div className="text-[9px] text-gray-600 font-mono truncate">{player.id || '—'}</div>
                                                    </div>
                                                    <div className={`text-[9px] font-mono ${s.textLight}/70 uppercase shrink-0`}>
                                                        {player.eliminated_at ? new Date(player.eliminated_at).toLocaleTimeString() : 'ELIMINATED'}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="flex justify-between items-center px-5 py-3.5 border-t border-white/10 bg-white/[0.02] rounded-b-xl">
                                    <span className="text-[10px] text-gray-600 font-mono uppercase">Total: {getEliminatedPlayers().length} player(s)</span>
                                    <button
                                        onClick={() => setShowEliminatedModal(null)}
                                        className="px-5 py-2 bg-white/5 border border-white/10 rounded text-xs font-bold uppercase tracking-widest text-gray-400 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
                                    >
                                        Close
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    );
                })()
            }

        </div >
    );
};





