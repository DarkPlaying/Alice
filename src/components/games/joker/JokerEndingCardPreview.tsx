import React, { useState } from 'react';
import { Flame, Home } from 'lucide-react';

export const JokerEndingCardPreview: React.FC = () => {
    const [viewMode, setViewMode] = useState<'escaped' | 'eliminated'>('escaped');

    const sampleLeaderboard = [
        { rank: 1, name: 'SANJAY', score: 4099, status: viewMode === 'escaped' ? 'escaped' : 'eliminated', isMe: true },
        { rank: 2, name: 'AGENT_K', score: 2850, status: 'eliminated', isMe: false },
        { rank: 3, name: 'MAZE_RUNNER', score: 1900, status: 'eliminated', isMe: false },
        { rank: 4, name: 'CYBER_VIPER', score: 1200, status: 'eliminated', isMe: false }
    ];

    const winner = sampleLeaderboard[0];
    const isWinnerEscaped = winner.status === 'escaped';

    return (
        <div className="min-h-screen bg-[#050508] text-slate-100 font-mono flex flex-col items-center justify-start p-4 sm:p-8 select-none overflow-y-auto relative">
            
            {/* Dynamic CSS Keyframes for Firing WHITE Flame Animation */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes whiteFireFlicker {
                    0% { transform: scale(1) translateY(0) rotate(-4deg); filter: drop-shadow(0 4px 24px rgba(255, 255, 255, 0.95)); }
                    25% { transform: scale(1.15) translateY(-5px) rotate(-8deg); filter: drop-shadow(0 8px 36px rgba(255, 255, 255, 1)); }
                    50% { transform: scale(0.92) translateY(2px) rotate(-1deg); filter: drop-shadow(0 2px 24px rgba(240, 240, 255, 0.9)); }
                    75% { transform: scale(1.12) translateY(-3px) rotate(-6deg); filter: drop-shadow(0 6px 32px rgba(255, 255, 255, 0.95)); }
                    100% { transform: scale(1) translateY(0) rotate(-4deg); filter: drop-shadow(0 4px 24px rgba(255, 255, 255, 0.95)); }
                }

                @keyframes whiteHeatPulse {
                    0%, 100% { transform: scale(0.9); opacity: 0.5; }
                    50% { transform: scale(1.4); opacity: 0.95; }
                }
            `}} />

            {/* Top Navigation & View Switcher */}
            <header className="w-full max-w-4xl flex flex-col sm:flex-row items-center justify-between gap-4 mb-8 pb-4 border-b border-slate-800">
                <div>
                    <span className="text-[10px] font-black text-white/80 uppercase tracking-[0.2em] block">GAME ENDING CARD PREVIEW</span>
                    <h1 className="font-cinzel text-xl sm:text-2xl font-black text-white uppercase tracking-widest">
                        JOKER :: TRIAL CONCLUDED
                    </h1>
                </div>

                {/* View Switcher: Winner Escaped vs Eliminated */}
                <div className="flex items-center gap-1.5 bg-[#0e101a] p-1.5 border border-slate-800 rounded-full shadow-inner">
                    <button
                        onClick={() => setViewMode('escaped')}
                        className={`px-4 py-2 rounded-full text-xs font-black tracking-wider transition-all flex items-center gap-2 cursor-pointer ${viewMode === 'escaped' ? 'bg-white text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'}`}
                    >
                        <span>WINNER ESCAPED</span>
                    </button>
                    <button
                        onClick={() => setViewMode('eliminated')}
                        className={`px-4 py-2 rounded-full text-xs font-black tracking-wider transition-all flex items-center gap-2 cursor-pointer ${viewMode === 'eliminated' ? 'bg-red-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                    >
                        <span>ALL ELIMINATED</span>
                    </button>
                </div>
            </header>

            {/* MAIN SHOWCASE CARD */}
            <main className="w-full max-w-3xl my-auto py-4">

                <div className="relative w-full mt-6">

                    {/* 3D FLOATING WHITE FIRING FLAME AT TOP CENTER */}
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center pointer-events-none">
                        <div className="relative flex items-center justify-center">
                            <div className="absolute w-16 h-16 rounded-full blur-xl animate-[whiteHeatPulse_2s_infinite] bg-white/70" />

                            <Flame
                                size={58}
                                className="text-white fill-slate-100 transform transition-all duration-300 animate-[whiteFireFlicker_1.2s_infinite_alternate_ease-in-out]"
                            />
                        </div>
                    </div>

                    {/* Outer Card Container */}
                    <div className="w-full bg-[#0e101a] rounded-3xl sm:rounded-[36px] p-5 sm:p-8 pt-12 text-white shadow-[0_25px_60px_rgba(0,0,0,0.85)] border border-slate-800 relative overflow-hidden flex flex-col items-center">
                        
                        {/* Background Grid Overlay */}
                        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2133_1px,transparent_1px),linear-gradient(to_bottom,#1f2133_1px,transparent_1px)] bg-[size:24px_24px] opacity-30 pointer-events-none" />

                        {/* Top Status Header Row */}
                        <div className="w-full flex justify-between items-center border-b border-slate-800/80 pb-3 mb-6 relative z-10">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">
                                JOKER TRIAL FINAL RESULTS
                            </span>
                            <span className={`px-3 py-1 bg-slate-900 border rounded-full text-xs font-black font-mono uppercase tracking-wider ${isWinnerEscaped ? 'border-emerald-500/50 text-emerald-400' : 'border-red-500/50 text-red-400'}`}>
                                {isWinnerEscaped ? 'VICTORY ESCAPE' : 'TRIAL ELIMINATION'}
                            </span>
                        </div>

                        {/* LEFT & RIGHT SPLIT CONTENT LAYOUT */}
                        <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-center relative z-10">
                            
                            {/* LEFT COLUMN: Place Number #1 & Champion Graphic */}
                            <div className="md:col-span-5 flex flex-col items-center justify-center p-6 bg-[#141624] border border-slate-800/80 rounded-3xl shadow-inner min-h-[220px]">
                                <div className="relative group flex flex-col items-center text-center">
                                    <div className="absolute inset-0 bg-white/20 rounded-full blur-2xl group-hover:blur-3xl transition-all" />
                                    
                                    {/* Place Number #1 Badge Box (GLOW GREEN IF WIN, GLOW RED IF ELIMINATED) */}
                                    <div className={`relative p-5 rounded-2xl transform hover:scale-105 transition-all flex flex-col items-center min-w-[150px] ${
                                        isWinnerEscaped
                                            ? 'bg-[#041a12] border-2 border-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.5)] text-emerald-300'
                                            : 'bg-[#1c080e] border-2 border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.5)] text-red-300'
                                    }`}>
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-2 shadow-inner ${
                                            isWinnerEscaped
                                                ? 'bg-emerald-950 border border-emerald-400/80 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.6)]'
                                                : 'bg-red-950 border border-red-500/80 text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.6)]'
                                        }`}>
                                            <span className="font-cinzel text-2xl font-black">#1</span>
                                        </div>
                                        <span className={`text-[9px] font-black tracking-[0.2em] uppercase font-mono ${
                                            isWinnerEscaped ? 'text-emerald-400' : 'text-red-400'
                                        }`}>
                                            STAGE CHAMPION
                                        </span>
                                        <h3 className="font-cinzel text-lg sm:text-xl font-black text-white uppercase tracking-wider mt-1">
                                            {winner.name}
                                        </h3>
                                    </div>

                                    <span className={`text-[10px] font-black tracking-[0.15em] uppercase font-mono block mt-3 px-3 py-1 rounded-full border ${isWinnerEscaped ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300' : 'bg-red-950/60 border-red-500/50 text-red-400'}`}>
                                        {isWinnerEscaped ? 'ESCAPED (+1000 PTS)' : 'ELIMINATED (-200 PTS)'}
                                    </span>
                                </div>
                            </div>

                            {/* RIGHT COLUMN: Title, Subtitle, Leaderboard List & Single Return Button */}
                            <div className="md:col-span-7 flex flex-col items-start text-left space-y-4 w-full">
                                
                                {/* Main Title */}
                                <div className="space-y-1">
                                    <h2 className="font-cinzel text-2xl sm:text-3xl font-black uppercase tracking-[0.15em] text-white">
                                        {isWinnerEscaped ? 'JOKER TRIAL VICTORY!' : 'PROTOCOL CONCLUDED'}
                                    </h2>
                                    <div className="w-20 h-0.5 bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                                </div>

                                {/* Subtitle Message */}
                                <p className="text-xs text-slate-300 font-mono leading-relaxed">
                                    {isWinnerEscaped ? (
                                        <>Player <strong className="text-white font-bold">{winner.name}</strong> successfully navigated the 14-round maze to reach Exit Gate G3.</>
                                    ) : (
                                        <>All candidates failed to reach exit gates within 14 rounds of rotated maze trials.</>
                                    )}
                                </p>

                                {/* Leaderboard Rankings Section with Place Numbers */}
                                <div className="w-full bg-[#161826] border border-slate-800 rounded-2xl p-3.5 space-y-2">
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-800/60">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                                            RANKING // CANDIDATE SCORES
                                        </span>
                                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                                            FINAL CREDITS
                                        </span>
                                    </div>

                                    <div className="space-y-1.5">
                                        {sampleLeaderboard.map((item) => (
                                            <div
                                                key={item.rank}
                                                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-mono transition-all ${
                                                    item.rank === 1
                                                        ? 'bg-white/10 border border-white/30 text-white font-bold shadow-sm'
                                                        : 'bg-[#0e101a] text-slate-300 border border-slate-800/80'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0 ${
                                                        item.rank === 1 ? 'bg-white text-slate-950' : 'bg-slate-800 text-slate-400'
                                                    }`}>
                                                        #{item.rank}
                                                    </span>
                                                    <span className="font-bold tracking-wider">{item.name}</span>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                                                        item.status === 'escaped' ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/40' : 'bg-red-950/80 text-red-400 border border-red-500/40'
                                                    }`}>
                                                        {item.status}
                                                    </span>
                                                    <span className="font-black text-white min-w-[65px] text-right">
                                                        {item.score} PTS
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* ONLY RETURN TO LOBBY BUTTON (FULL WIDTH) */}
                                <div className="w-full pt-1">
                                    <button className="w-full py-3 bg-white hover:bg-slate-100 text-slate-950 font-mono font-black text-xs uppercase tracking-widest rounded-full flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(255,255,255,0.4)] cursor-pointer transform hover:scale-[1.01]">
                                        <Home size={15} />
                                        <span>RETURN TO LOBBY</span>
                                    </button>
                                </div>

                            </div>

                        </div>

                    </div>
                </div>
            </main>

            {/* Footer Direct Route Indicator */}
            <footer className="mt-6 text-center text-xs text-slate-500 font-mono">
                Previewing Route: <code className="bg-[#121422] border border-slate-800 text-white px-2.5 py-1 rounded font-bold">http://localhost:5173/home/card/joker/ending</code>
            </footer>
        </div>
    );
};
