import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Shield, Upload, FileText, Download, Trash2, RotateCcw, CheckSquare, Square, X, ChevronUp, ChevronDown, Crown, Radio, Activity, Pencil } from 'lucide-react';
import Papa from 'papaparse';
import { createClient } from '@supabase/supabase-js';
import { supabase, supabaseUrl, supabaseKey } from '../../supabaseClient';
import { PlayerCache } from '../../lib/playerCache';
import { PlayerCardModal } from '../PlayerCardModal';

const getAdminAuthClient = () => {
    return createClient('https://ssirmxujmdhdhmnqxfxi.supabase.co', 'sb_publishable_8aNc7iJaeXfRI2jOwHccrQ_dFMYz6fT', {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false,
            storageKey: 'borderland-admin-v2',
            lock: async (name: string, ...args: any[]) => {
                // Bypass navigator.locks entirely to prevent Vite HMR deadlocks
                const acquire = args.pop();
                if (typeof acquire === 'function') {
                    return await acquire();
                }
            }
        }
    });
};

interface VisaManagementProps {
    players: any[];
    activeView: 'players' | 'masters';
    onRefreshRequest: () => void;
    setPlayers: React.Dispatch<React.SetStateAction<any[]>>;
    onHistoryRequest?: (player: any) => void;
}

export const VisaManagement = ({ players, activeView, onRefreshRequest, setPlayers, onHistoryRequest }: VisaManagementProps) => {
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [visaSort, setVisaSort] = useState<'none'|'asc'|'desc'>('none');
    const [nameSort, setNameSort] = useState<'none'|'asc'|'desc'>('none');
    
    // Edit Visa Points state
    const [editingPointsId, setEditingPointsId] = useState<string | null>(null);
    const [tempPoints, setTempPoints] = useState<number>(0);
    const [hoveredPointsId, setHoveredPointsId] = useState<string | null>(null);
    const saveEditRef = useRef<(() => void) | null>(null);

    // Auto-cancel edit when player data changes (real-time Supabase update) or view changes
    useEffect(() => {
        setEditingPointsId(null);
    }, [activeView]);

    useEffect(() => {
        // Reset if the player being edited no longer exists in the list
        if (editingPointsId && !players.find(p => p.id === editingPointsId)) {
            setEditingPointsId(null);
        }
    }, [players, editingPointsId]);
    
    // Create / Batch State
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    
    // Multi Visa Issue State
    const [multiPrefix, setMultiPrefix] = useState('player');
    const [multiStart, setMultiStart] = useState(1);
    const [multiEnd, setMultiEnd] = useState(10);
    const [multiPasswordMode, setMultiPasswordMode] = useState<'default' | 'unique'>('default');
    const [multiDefaultPassword, setMultiDefaultPassword] = useState('pass123');
    const [isMultiCreating, setIsMultiCreating] = useState(false);

    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

    useEffect(() => {
        setMultiPrefix(activeView === 'masters' ? 'master' : 'player');
    }, [activeView]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Deletion & Undo State
    const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
    const [deletedBackup, setDeletedBackup] = useState<any[]>([]);
    const [lastActionType, setLastActionType] = useState<'delete' | 'create'>('delete');
    const [showUndo, setShowUndo] = useState(false);
    const [isPurging, setIsPurging] = useState(false);

    // Tracking
    const [trackingPlayer, setTrackingPlayer] = useState<any | null>(null);
    const [playerToDelete, setPlayerToDelete] = useState<any | null>(null);

    const handleSelectAll = () => {
        const filteredPlayers = players.filter(p => activeView === 'masters' ? (p.role === 'master') : (p.role === 'player' || !p.role));
        if (selectedPlayers.length === filteredPlayers.length) {
            setSelectedPlayers([]);
        } else {
            setSelectedPlayers(filteredPlayers.map(p => p.id));
        }
    };

    const handleSelect = (id: string) => {
        setSelectedPlayers(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
    };

    const handleDeletePlayers = async () => {
        if (selectedPlayers.length === 0) return;
        
        const safeIds = selectedPlayers.filter(id => {
            const player = players.find(p => p.id === id);
            return player && !(player.username === 'admin' || player.role === 'admin');
        });

        if (safeIds.length === 0) {
            setCreateError("SYSTEM ALERT: CANNOT DELETE SYSTEM ARCHITECT OR NO TARGETS SELECTED.");
            setTimeout(() => setCreateError(''), 4000);
            return;
        }

        const backupNodes = players.filter(p => safeIds.includes(p.id));
        setDeletedBackup(backupNodes);

        try {
            // Hard delete: Use direct fetch to bypass client lock deadlocks
            const res = await fetch(`${supabaseUrl}/rest/v1/rpc/delete_auth_users`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_ids: backupNodes.map((n: any) => n.id),
                    secret_token: 'borderland_admin_123'
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(`DB Deletion Failed: ${errData.message || res.statusText}`);
            }

            setPlayers(prev => prev.filter(p => !safeIds.includes(p.id)));
            setSelectedPlayers([]);
            PlayerCache.clear();
            onRefreshRequest();
        } catch (error: any) {
            console.error("Deletion failed:", error);
            setCreateError("DELETION FAILED: " + error.message);
            setTimeout(() => setCreateError(''), 4000);
        }
    };

    const handleSingleDelete = async (player: any) => {
        try {
            // Hard delete: Use direct fetch to bypass any client-side lock deadlocks
            const res = await fetch(`${supabaseUrl}/rest/v1/rpc/delete_auth_users`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_ids: [player.id],
                    secret_token: 'borderland_admin_123'
                })
            });
            
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(`DB Deletion Failed: ${errData.message || res.statusText}`);
            }
        
            // Instantly remove from UI
            setPlayers(prev => prev.filter(p => p.id !== player.id));
            setSelectedPlayers(prev => prev.filter(id => id !== player.id));
            PlayerCache.clear();
            onRefreshRequest();
            setPlayerToDelete(null);
        } catch (error: any) {
            console.error("Single deletion failed:", error);
            setCreateError("DELETION FAILED: " + error.message);
            setTimeout(() => setCreateError(''), 3000);
            setPlayerToDelete(null);
        }
    };

    const handleUndo = async () => {
        if (!deletedBackup.length) return;
        try {
            if (lastActionType === 'delete') {
                return; // Purges are permanent, undo is disabled for deletions
            } else {
                // Reverting a creation: We must hard delete them from auth.users AND profiles so they can be recreated later!
                const res = await fetch(`${supabaseUrl}/rest/v1/rpc/delete_auth_users`, {
                    method: 'POST',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        user_ids: deletedBackup.map((u: any) => u.id),
                        secret_token: 'borderland_admin_123'
                    })
                });
                
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.message || res.statusText);
                }
            }
            
            // Instantly remove reverted users from UI
            const deletedIds = deletedBackup.map(u => u.id);
            setPlayers(prev => prev.filter(p => !deletedIds.includes(p.id)));
            
            setShowUndo(false);
            setDeletedBackup([]);
            PlayerCache.clear();
            onRefreshRequest();
            setCreateError("CREATION REVERTED SUCCESSFULLY.");
            setTimeout(() => setCreateError(''), 3000);
        } catch (error: any) {
            console.error("Undo action failed:", error);
            setCreateError("UNDO FAILED: " + error.message);
            setTimeout(() => setCreateError(''), 3000);
        }
    };

    const handleDownloadTemplate = () => {
        const csvContent = "data:text/csv;charset=utf-8,username,password\nplayer1,pass123\nplayer2,pass123";
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "borderland_visa_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
                    
                    // Add delay to prevent Supabase rate limiting
                    if (i < users.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 800));
                    }
                    setUploadProgress(prev => ({ ...prev, current: i + 1 }));
                }
                
                setIsUploading(false);
                setCreateError(`BATCH COMPLETE: ${successCount} ISSUED, ${failCount} FAILED.`);
                if (fileInputRef.current) fileInputRef.current.value = '';

                if (successCount > 0) {
                    // Instantly update UI for real-time feel
                    setPlayers(prev => [...prev, ...createdPlayersTmp]);
                    PlayerCache.clear();
                    onRefreshRequest();
                }

                if (createdPlayersTmp.length > 0) {
                    setDeletedBackup(createdPlayersTmp);
                    setLastActionType('create');
                    setShowUndo(true);
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
            const { data, error } = await adminAuthClient.auth.signUp({ email, password: newPassword });
            if (error) throw error;
            
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
                throw new Error("Profile creation failed: " + (errData.message || res.statusText));
            }
            
            setNewUsername('');
            setNewPassword('');
            setShowCreateForm(false);

            // Instantly update UI for real-time feel
            const newPlayer = {
                id: data.user?.id,
                email: email,
                username: sanitizedUsername.split('@')[0],
                role: activeView === 'masters' ? 'master' : 'player',
                created_at: new Date().toISOString(),
                visa_points: 500
            };
            setPlayers(prev => [...prev, newPlayer]);

            PlayerCache.clear();
            onRefreshRequest();

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

    const generatePassword = () => Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-2);

    const handleMultiGenerateExcel = () => {
        let csvContent = "data:text/csv;charset=utf-8,username,password\n";
        for (let i = multiStart; i <= multiEnd; i++) {
            const user = `${multiPrefix}${i}`;
            const pass = multiPasswordMode === 'default' ? multiDefaultPassword : generatePassword();
            csvContent += `${user},${pass}\n`;
        }
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `borderland_visas_${multiPrefix}_${multiStart}_${multiEnd}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleMultiCreate = async () => {
        setIsMultiCreating(true);
        setCreateError("");
        const adminAuthClient = getAdminAuthClient();
        let newPlayers: any[] = [];
        let errors = 0;

        for (let i = multiStart; i <= multiEnd; i++) {
            const sanitizedUsername = `${multiPrefix}${i}`.trim().toLowerCase().replace(/\s+/g, '');
            const email = `${sanitizedUsername}@borderland.app`;
            const pass = multiPasswordMode === 'default' ? multiDefaultPassword : generatePassword();

            try {
                const { data, error } = await adminAuthClient.auth.signUp({ email, password: pass });
                if (error) throw error;
                
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
                        username: sanitizedUsername,
                        role: activeView === 'masters' ? 'master' : 'player',
                        visa_points: 500
                    })
                });
                
                if (!res.ok) throw new Error("Profile fail");

                newPlayers.push({
                    id: data.user?.id,
                    email: email,
                    username: sanitizedUsername,
                    role: activeView === 'masters' ? 'master' : 'player',
                    created_at: new Date().toISOString(),
                    visa_points: 500
                });
            } catch (err) {
                console.error("Multi Create Error for " + sanitizedUsername, err);
                errors++;
            }
        }
        
        if (newPlayers.length > 0) {
            setPlayers(prev => [...prev, ...newPlayers]);
            PlayerCache.clear();
            onRefreshRequest();
            setCreateError(`CREATED ${newPlayers.length} VISAS SUCCESSFULLY. ${errors > 0 ? `(${errors} ERRORS)` : ''}`);
        } else {
            setCreateError("MULTI CREATION FAILED ENTIRELY.");
        }
        
        setIsMultiCreating(false);
    };

    const purgePlayers = () => {
        setIsPurging(true);
        setTimeout(() => {
            setCreateError("EMERGENCY PURGE EXECUTED.");
            setTimeout(() => setCreateError(''), 4000);
            setIsPurging(false);
        }, 2000);
    };

    return (
        <div className="space-y-6 relative">
            {/* --- VISUAL PURGE EFFECT --- */}
            <AnimatePresence>
                {isPurging && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-red-900/40 mix-blend-screen"
                    >
                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
                        <motion.h1
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1.2, opacity: 1 }}
                            exit={{ scale: 1, opacity: 0 }}
                            transition={{ duration: 0.2, repeat: Infinity, repeatType: "reverse" }}
                            className="text-8xl font-black text-red-500 tracking-widest border-4 border-red-500 p-8 rotate-12"
                        >
                            PURGE ACTIVE
                        </motion.h1>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex justify-end items-center mb-8">
                <div className="flex items-center gap-4">
                    {/* UNDO BUTTON */}
                    <AnimatePresence>
                        {showUndo && (
                            <motion.button
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                onClick={handleUndo}
                                className="px-4 py-2 border border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10 flex items-center gap-2 transition-all font-mono text-sm"
                            >
                                <RotateCcw size={16} />
                                {lastActionType === 'delete' ? 'UNDO PURGE' : 'REVERT CREATION'}
                            </motion.button>
                        )}
                    </AnimatePresence>

                    {/* BULK DELETE BUTTON */}
                    <AnimatePresence>
                        {selectedPlayers.length > 0 && (
                            <motion.button
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                onClick={handleDeletePlayers}
                                className="px-4 py-2 bg-red-500/20 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white flex items-center gap-2 transition-all"
                            >
                                <Trash2 size={16} />
                                PURGE {selectedPlayers.length}
                            </motion.button>
                        )}
                    </AnimatePresence>


                    <input
                        type="file"
                        accept=".csv"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                    />
                    <button
                        onClick={() => handleDownloadTemplate()}
                        className="px-4 py-2 border border-white/20 hover:bg-white/5 transition-colors flex items-center gap-2 text-sm"
                    >
                        <Download size={16} />
                        GET MANIFEST
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="px-4 py-2 border border-white/20 hover:bg-white/5 transition-colors flex items-center gap-2 text-sm disabled:opacity-50"
                    >
                        {isUploading ? <RotateCcw className="animate-spin" size={16} /> : <Upload size={16} />}
                        {isUploading ? `${Math.round((uploadProgress.current / uploadProgress.total) * 100)}%` : 'BATCH INJECTION'}
                    </button>
                    <button
                        onClick={() => setShowCreateForm(!showCreateForm)}
                        className="px-4 py-2 bg-white text-black hover:bg-gray-200 transition-colors flex items-center gap-2 text-sm font-bold"
                    >
                        <Users size={16} />
                        ISSUE VISA
                    </button>
                </div>
            </div>

            <div className="flex gap-4 items-center">
                <h3 className="text-gray-500 text-sm tracking-widest uppercase">REGISTERED VISAS</h3>
                {createError && (
                    <span className={`text-xs font-mono ${createError.includes('COMPLETE') || createError.includes('SUCCESSFULLY') ? 'text-green-500' : 'text-red-500'}`}>
                        {createError}
                    </span>
                )}
            </div>

            {showCreateForm && (
                <div className="flex flex-col xl:flex-row gap-6 mb-6 items-start w-full">
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-6 border border-white/10 bg-black/40 rounded-lg flex-1 min-w-[300px]"
                    >
                        <h3 className="text-lg text-white font-mono mb-6 flex items-center gap-2">
                            <Users size={18} className="text-[#ff0033]" />
                            {activeView === 'masters' ? 'APPOINT NEW MASTER' : 'ISSUE VISA'}
                        </h3>
                        <form onSubmit={handleCreatePlayer} className="space-y-4">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1 tracking-widest">USERNAME / ALIAS</label>
                                <input
                                    type="text"
                                    value={newUsername}
                                    onChange={(e) => setNewUsername(e.target.value)}
                                    className="w-full bg-black/50 border border-white/20 rounded-md px-4 py-3 text-white focus:outline-none focus:border-[#ff0033] transition-colors"
                                    placeholder={activeView === 'masters' ? 'master1' : 'player1'}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1 tracking-widest">ACCESS KEY (PASSWORD)</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full bg-black/50 border border-white/20 rounded-md px-4 py-3 text-white focus:outline-none focus:border-[#ff0033] transition-colors"
                                    placeholder="******"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={isCreating}
                                className="w-full bg-[#ff0033] text-white py-3 rounded-md font-bold hover:bg-white hover:text-black transition-all disabled:opacity-50 tracking-widest mt-2 uppercase"
                            >
                                {isCreating ? 'PROCESSING...' : (activeView === 'masters' ? 'APPOINT MASTER' : 'ISSUE VISA')}
                            </button>
                        </form>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-6 border border-white/10 bg-black/40 rounded-lg flex-[2] min-w-[300px]"
                    >
                        <h3 className="text-lg text-white font-mono mb-6 flex items-center gap-2">
                            <Users size={18} className="text-[#ff0033]" />
                            MULTI VISA ISSUE
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
                            <div className="space-y-4 flex flex-col justify-start h-full">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1 tracking-widest">PREFIX NAME</label>
                                    <input
                                        type="text"
                                        value={multiPrefix}
                                        onChange={(e) => setMultiPrefix(e.target.value)}
                                        className="w-full bg-black/50 border border-white/20 rounded-md px-4 py-2 text-white focus:outline-none focus:border-[#ff0033] transition-colors"
                                        placeholder="player"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 mb-2 tracking-widest">PASSWORD GENERATION</label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 text-sm text-gray-300">
                                            <input type="radio" checked={multiPasswordMode === 'default'} onChange={() => setMultiPasswordMode('default')} className="text-[#ff0033]" />
                                            Default
                                        </label>
                                        <label className="flex items-center gap-2 text-sm text-gray-300">
                                            <input type="radio" checked={multiPasswordMode === 'unique'} onChange={() => setMultiPasswordMode('unique')} className="text-[#ff0033]" />
                                            Unique Random
                                        </label>
                                    </div>
                                </div>
                                {multiPasswordMode === 'default' && (
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1 tracking-widest">DEFAULT PASSWORD</label>
                                        <input
                                            type="text"
                                            value={multiDefaultPassword}
                                            onChange={(e) => setMultiDefaultPassword(e.target.value)}
                                            className="w-full bg-black/50 border border-white/20 rounded-md px-4 py-2 text-white focus:outline-none focus:border-[#ff0033] transition-colors"
                                            placeholder="pass123"
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col justify-end gap-4 h-full">
                                <div className="flex gap-4 mb-auto">
                                    <div className="flex-1">
                                        <label className="block text-xs text-gray-400 mb-1 tracking-widest">START COUNT</label>
                                        <input
                                            type="number"
                                            value={multiStart}
                                            onChange={(e) => setMultiStart(Number(e.target.value))}
                                            className="w-full bg-black/50 border border-white/20 rounded-md px-4 py-2 text-white focus:outline-none focus:border-[#ff0033] transition-colors"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs text-gray-400 mb-1 tracking-widest">END COUNT</label>
                                        <input
                                            type="number"
                                            value={multiEnd}
                                            onChange={(e) => setMultiEnd(Number(e.target.value))}
                                            className="w-full bg-black/50 border border-white/20 rounded-md px-4 py-2 text-white focus:outline-none focus:border-[#ff0033] transition-colors"
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={handleMultiCreate}
                                    disabled={isMultiCreating}
                                    className="w-full bg-[#ff0033] text-white py-3 rounded-md font-bold hover:bg-white hover:text-black transition-all disabled:opacity-50 tracking-widest uppercase flex items-center justify-center gap-2"
                                >
                                    {isMultiCreating ? <RotateCcw className="animate-spin" size={16} /> : <Upload size={16} />}
                                    GENERATE & INJECT
                                </button>
                                <button
                                    onClick={handleMultiGenerateExcel}
                                    className="w-full bg-transparent border border-[#ff0033] text-[#ff0033] py-3 rounded-md font-bold hover:bg-[#ff0033] hover:text-white transition-all tracking-widest uppercase flex items-center justify-center gap-2"
                                >
                                    <Download size={16} />
                                    GENERATE EXCEL (CSV)
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}

            <div className="bg-black/40 border border-white/10 rounded-lg overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-white/5 text-xs text-white/50 uppercase tracking-wider">
                        <tr>
                            <th className="p-4 border-b border-white/10 w-10">
                                <button
                                    onClick={handleSelectAll}
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    {selectedPlayers.length > 0 && selectedPlayers.length === players.filter(p => activeView === 'masters' ? (p.role === 'master') : (p.role === 'player' || !p.role)).length
                                        ? <CheckSquare size={16} />
                                        : <Square size={16} />}
                                </button>
                            </th>
                            <th 
                                className="p-4 border-b border-white/10 cursor-pointer hover:text-white transition-colors select-none"
                                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                            >
                                <div className="flex items-center gap-1">
                                    ID
                                    {sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </div>
                            </th>
                            <th className="p-4 border-b border-white/10 cursor-pointer hover:text-white transition-colors" onClick={() => {
                                setNameSort(prev => prev === 'none' ? 'asc' : prev === 'asc' ? 'desc' : 'none');
                                setVisaSort('none');
                            }}>
                                NAME {nameSort === 'asc' ? <ChevronUp size={12} className="inline ml-1" /> : nameSort === 'desc' ? <ChevronDown size={12} className="inline ml-1" /> : null}
                            </th>
                            <th className="p-4 border-b border-white/10">Entry Time</th>
                            <th className="p-4 border-b border-white/10">Status</th>
                            <th 
                                className="p-4 border-b border-white/10 cursor-pointer hover:text-white transition-colors select-none"
                                onClick={() => setVisaSort(prev => prev === 'none' ? 'desc' : prev === 'desc' ? 'asc' : 'none')}
                            >
                                <div className="flex items-center gap-1">
                                    VISA Pts
                                    {visaSort === 'asc' ? <ChevronUp size={14} /> : visaSort === 'desc' ? <ChevronDown size={14} /> : <span className="w-[14px]"></span>}
                                </div>
                            </th>
                            <th className="p-4 border-b border-white/10">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {players.filter(p =>
                            activeView === 'masters'
                                ? (p.role === 'master' || p.role === 'admin' || p.username === 'admin')
                                : (p.role !== 'master' && p.role !== 'admin' && p.username !== 'admin')
                        ).length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-gray-500">
                                    {activeView === 'masters' ? 'NO MASTERS APPOINTED' : 'NO PLAYERS DETECTED IN THE BORDERLAND'}
                                </td>
                            </tr>
                        ) : (
                            players
                                .filter(p =>
                                    activeView === 'masters'
                                        ? (p.role === 'master' || p.role === 'admin' || p.username === 'admin')
                                        : (p.role !== 'master' && p.role !== 'admin' && p.username !== 'admin')
                                )
                                .sort((a, b) => {
                                    if (nameSort !== 'none') {
                                        return nameSort === 'asc' 
                                            ? a.username.localeCompare(b.username, undefined, { numeric: true, sensitivity: 'base' }) 
                                            : b.username.localeCompare(a.username, undefined, { numeric: true, sensitivity: 'base' });
                                    }
                                    if (visaSort !== 'none') {
                                        return visaSort === 'asc' ? (a.visa_points || 0) - (b.visa_points || 0) : (b.visa_points || 0) - (a.visa_points || 0);
                                    }
                                    const indexA = players.findIndex(p => p.id === a.id);
                                    const indexB = players.findIndex(p => p.id === b.id);
                                    return sortOrder === 'asc' ? indexA - indexB : indexB - indexA;
                                })
                                .map((player) => {
                                    const isSystem = player.username === 'admin' || player.role === 'admin';
                                    const isMaster = isSystem || player.role === 'master';
                                    const isSelected = selectedPlayers.includes(player.id);
                                    
                                    const mainIndex = players.findIndex(p => p.id === player.id);
                                    const rowKey = player.id || player.email || `${player.username}-${mainIndex}`;
                                    const sequentialId = `#PLAYER_${(mainIndex + 1).toString().padStart(3, '0')}`;

                                    return (
                                        <tr key={rowKey} className={`transition-colors group ${isSelected ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                                            <td className="p-4">
                                                {!isSystem && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSelect(player.id)}
                                                        className={`transition-colors ${isSelected ? 'text-[#ff0050]' : 'text-gray-600 hover:text-gray-400'}`}
                                                    >
                                                        {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                                                    </button>
                                                )}
                                            </td>
                                            <td className="p-4 font-mono text-xs text-[#ff0050]">
                                                {isSystem ? '#SYS_ADMIN' : isMaster ? `#MASTER_${player.id.substring(0, 3)}` : sequentialId}
                                            </td>
                                            <td className="p-4 font-bold">
                                                <div className="flex items-center gap-2">
                                                    {player.username}
                                                    {isSystem && <Crown size={14} className="text-yellow-500" />}
                                                </div>
                                            </td>
                                            <td className="p-4 text-sm text-gray-400 font-mono">
                                                {new Date(player.created_at).toLocaleString()}
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 text-xs border rounded-sm flex items-center gap-2 w-max
                                                    ${((player.visa_points !== undefined && player.visa_points < 0) || player.status === 'eliminated' || player.status === 'dead') ? 'border-red-500/30 text-red-500 bg-red-500/10' :
                                                        player.status === 'winner' ? 'border-yellow-500/30 text-yellow-500 bg-yellow-500/10' :
                                                            'border-green-500/30 text-green-500 bg-green-500/10'}
                                                `}>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${((player.visa_points !== undefined && player.visa_points < 0) || player.status === 'eliminated' || player.status === 'dead') ? 'bg-red-500' :
                                                        player.status === 'winner' ? 'bg-yellow-500' : 'bg-green-500'
                                                        }`} />
                                                    {((player.visa_points !== undefined && player.visa_points < 0) || player.status === 'eliminated' || player.status === 'dead') ? 'DEAD' : (player.status?.toUpperCase() || 'ALIVE')}
                                                </span>
                                            </td>
                                            <td className="p-4 font-mono">
                                                {editingPointsId && editingPointsId === player.id ? (
                                                    <div className="flex items-center gap-2">
                                                        <input 
                                                            type="number" 
                                                            value={tempPoints}
                                                            onChange={(e) => setTempPoints(Number(e.target.value))}
                                                            autoFocus
                                                            onKeyDown={async (e) => {
                                                                if (e.key === 'Escape') {
                                                                    setEditingPointsId(null);
                                                                    setHoveredPointsId(null);
                                                                }
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    if (!player.id) {
                                                                        setEditingPointsId(null);
                                                                        setHoveredPointsId(null);
                                                                        return;
                                                                    }
                                                                    try {
                                                                        await supabase.from('profiles').update({ visa_points: tempPoints }).eq('id', player.id);
                                                                        setPlayers(prev => prev.map(p => p.id === player.id ? { ...p, visa_points: tempPoints } : p));
                                                                    } catch (err) {
                                                                        console.error(err);
                                                                    }
                                                                    setEditingPointsId(null);
                                                                    setHoveredPointsId(null);
                                                                }
                                                            }}
                                                            className="w-20 bg-black border border-[#ff0033] px-2 py-1 text-white text-xs rounded focus:outline-none"
                                                        />
                                                        <button 
                                                            type="button"
                                                            onClick={async () => {
                                                                if (!player.id) {
                                                                    setEditingPointsId(null);
                                                                    setHoveredPointsId(null);
                                                                    return;
                                                                }
                                                                try {
                                                                    await supabase.from('profiles').update({ visa_points: tempPoints }).eq('id', player.id);
                                                                    setPlayers(prev => prev.map(p => p.id === player.id ? { ...p, visa_points: tempPoints } : p));
                                                                } catch (err) {
                                                                    console.error(err);
                                                                }
                                                                setEditingPointsId(null);
                                                                setHoveredPointsId(null);
                                                            }}
                                                            className="text-green-500 hover:text-green-400 p-1"
                                                        >
                                                            <CheckSquare size={14} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setEditingPointsId(null);
                                                                setHoveredPointsId(null);
                                                            }}
                                                            className="text-red-500 hover:text-red-400 p-1"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div
                                                        className="flex items-center gap-2"
                                                        onMouseEnter={() => setHoveredPointsId(player.id)}
                                                        onMouseLeave={() => setHoveredPointsId(null)}
                                                    >
                                                        <span className="tabular-nums">{player.visa_points ?? 0}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setEditingPointsId(player.id);
                                                                setTempPoints(player.visa_points ?? 0);

                                                            }}
                                                            className={`transition-opacity text-gray-500 hover:text-[#ff0033] p-0.5 rounded ${
                                                                hoveredPointsId === player.id ? 'opacity-100' : 'opacity-0 pointer-events-none'
                                                            }`}
                                                            title="Edit points"
                                                        >
                                                            <Pencil size={11} />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const mainIndex = players.findIndex(p => p.id === player.id);
                                                            const sequentialId = `#PLAYER_${(mainIndex + 1).toString().padStart(3, '0')}`;
                                                            const isSystem = player.username === 'admin' || player.role === 'admin';
                                                            const isMaster = isSystem || player.role === 'master';

                                                            setTrackingPlayer({
                                                                ...player,
                                                                displayId: sequentialId,
                                                                isSystem,
                                                                isMaster
                                                            });
                                                        }}
                                                        className="p-1 border border-white/20 hover:bg-white hover:text-black transition-colors text-xs px-2"
                                                    >
                                                        TRACK
                                                    </button>
                                                    {!isSystem && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setPlayerToDelete(player)}
                                                            className="text-gray-500 hover:text-red-500 p-1.5 rounded transition-colors"
                                                            title="Terminate Visa"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                        )}
                    </tbody>
                </table>
            </div>

            {/* TRACKING MODAL */}
            <AnimatePresence>
                {trackingPlayer && (
                    <PlayerCardModal
                        user={trackingPlayer}
                        onClose={() => setTrackingPlayer(null)}
                    />
                )}

                {/* DELETE CONFIRMATION MODAL */}
                {playerToDelete && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-[#0a0a0a] border border-red-500/50 max-w-sm w-full p-6 text-center"
                        >
                            <Trash2 size={48} className="text-red-500 mx-auto mb-4 opacity-80" />
                            <h3 className="font-mono text-red-500 text-xl font-bold mb-2">CONFIRM PURGE</h3>
                            <p className="text-gray-400 text-sm mb-6">
                                You are about to permanently delete <span className="text-white font-bold">{playerToDelete.username}</span> from the Borderland. This action will revoke all access.
                            </p>
                            <div className="flex gap-4 justify-center">
                                <button
                                    onClick={() => setPlayerToDelete(null)}
                                    className="px-6 py-2 border border-white/20 text-gray-400 hover:text-white hover:border-white/50 transition-colors uppercase tracking-widest text-sm font-bold"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleSingleDelete(playerToDelete)}
                                    className="px-6 py-2 bg-red-500/20 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-colors uppercase tracking-widest text-sm font-bold"
                                >
                                    Confirm Purge
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
