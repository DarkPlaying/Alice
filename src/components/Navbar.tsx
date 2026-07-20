import { PlayerCardModal } from './PlayerCardModal';
import { useState } from 'react';
import { LayoutDashboard, X, List } from 'lucide-react';
import { useNavigate } from 'react-router-dom';


interface NavbarProps {
    onLoginClick?: () => void;
    isLoggedIn?: boolean;
    onLogoutClick?: () => void;
    userInfo?: any;
    isAdmin?: boolean;
}

export const Navbar = ({ onLoginClick, isLoggedIn, onLogoutClick, userInfo, isAdmin }: NavbarProps) => {
    const [showPlayerCard, setShowPlayerCard] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const navigate = useNavigate();

    const isSystemArchitect = userInfo?.username === 'admin' || userInfo?.role === 'admin';
    const isGameMaster = userInfo?.role === 'master';
    const isElevated = isSystemArchitect || isGameMaster;

    return (
        <>
            <nav className={`fixed top-0 left-0 w-full z-50 transition-colors duration-300 border-b border-white/10 ${isMenuOpen ? 'bg-black' : 'bg-black/80 backdrop-blur-md'}`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
                    {/* Logo */}
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="text-sm sm:text-base md:text-lg font-display font-bold tracking-widest text-white">
                            BORDER<span className="text-[#ff0050]">LAND</span>
                        </span>
                        <div className="flex gap-0.5 sm:gap-1 text-xs sm:text-sm md:text-base text-[#ff0050] select-none">
                            <span>♠</span><span>♥</span><span>♦</span><span>♣</span>
                        </div>
                    </div>

                    {/* Links */}
                    <div className="hidden md:flex items-center gap-4 lg:gap-8">
                        {['GAMES', 'PROTOCOL', 'LEADERBOARD', 'RULES'].map((link) => (
                            <a
                                key={link}
                                href={`#${link.toLowerCase()}`}
                                className="text-[10px] lg:text-xs font-mono font-bold text-gray-400 hover:text-white transition-colors tracking-widest"
                            >
                                {link}
                            </a>
                        ))}
                    </div>

                    {/* Status Pill or Login Button */}
                    {isLoggedIn ? (
                        <div className="flex items-center gap-2 sm:gap-4 lg:gap-6">
                            <button
                                onClick={() => setShowPlayerCard(true)}
                                className="hidden md:flex items-center gap-2 px-2.5 lg:px-4 py-1.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                            >
                                <div className={`w-1.5 h-1.5 rounded-full ${isElevated ? 'bg-yellow-500 shadow-[0_0_8px_#eab308]' : 'bg-green-500 shadow-[0_0_8px_#22c55e]'} animate-pulse`}></div>
                                <span className="text-[9px] lg:text-[10px] font-mono tracking-widest text-gray-300">
                                    {isElevated ? (isSystemArchitect ? 'ARCHITECT' : 'MASTER') : 'PLAYER'}: <span className="text-white">{userInfo?.username || 'UNKNOWN'}</span>
                                </span>
                            </button>
                            {isAdmin && (
                                <button
                                    onClick={() => navigate('/admin')}
                                    className="hidden md:flex items-center gap-1.5 px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500 hover:text-black transition-all duration-300 font-display font-bold text-[10px] lg:text-xs tracking-widest uppercase hover:shadow-[0_0_15px_#eab308]"
                                >
                                    <LayoutDashboard size={12} className="lg:w-3.5 lg:h-3.5" />
                                    DASHBOARD
                                </button>
                            )}
                            <button
                                onClick={onLogoutClick}
                                className="hidden md:flex items-center gap-2 px-4 lg:px-6 py-1.5 lg:py-2 rounded-lg border border-red-500/50 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-300 font-display font-bold text-[10px] lg:text-xs tracking-widest uppercase hover:shadow-[0_0_15px_#ef4444]"
                            >
                                LOGOUT
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={onLoginClick}
                            className="hidden md:flex items-center gap-2 px-4 lg:px-6 py-1.5 lg:py-2 rounded-lg border border-[#ff0050]/50 bg-[#ff0050]/10 text-[#ff0050] hover:bg-[#ff0050] hover:text-white transition-all duration-300 font-display font-bold text-[10px] lg:text-xs tracking-widest uppercase hover:shadow-[0_0_15px_#ff0050]"
                        >
                            LOGIN
                        </button>
                    )}

                    {/* Mobile Menu Toggle */}
                    <button
                        className="md:hidden text-white p-2 transition-transform duration-300 active:scale-90"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                    >
                        {isMenuOpen ? <X size={20} /> : <List size={20} />}
                    </button>
                </div>

                {/* Mobile Menu Overlay */}
                <div className={`md:hidden fixed inset-x-0 top-16 bg-black/95 backdrop-blur-lg border-b border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.8)] transition-all duration-300 overflow-y-auto max-h-[calc(100vh-4rem)] z-50 ${isMenuOpen ? 'opacity-100 translate-y-0 visible' : 'opacity-0 -translate-y-4 invisible pointer-events-none'}`}>
                    <div className="flex flex-col p-6 gap-5">
                        {['GAMES', 'PROTOCOL', 'LEADERBOARD', 'RULES'].map((link, i) => (
                            <a
                                key={link}
                                href={`#${link.toLowerCase()}`}
                                onClick={() => setIsMenuOpen(false)}
                                className="group/nav flex items-center justify-between text-sm font-mono font-bold text-gray-400 hover:text-white transition-colors tracking-widest py-2.5 border-b border-white/5"
                            >
                                <span className="flex items-center gap-2">
                                    <span className="text-[#ff0050] opacity-0 group-hover/nav:opacity-100 transition-opacity">►</span>
                                    {link}
                                </span>
                                <span className="text-[10px] text-gray-600 font-mono">0{i+1}</span>
                            </a>
                        ))}

                        <div className="h-px bg-white/10 my-1" />

                        {isLoggedIn ? (
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => { setShowPlayerCard(true); setIsMenuOpen(false); }}
                                    className="flex items-center justify-between px-4 py-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 active:bg-white/15 transition-all text-left cursor-pointer"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className={`w-2 h-2 rounded-full ${isElevated ? 'bg-yellow-500 shadow-[0_0_8px_#eab308]' : 'bg-green-500 shadow-[0_0_8px_#22c55e]'} animate-pulse`}></div>
                                        <span className="text-[10px] font-mono tracking-widest text-gray-300 uppercase">
                                            {isElevated ? (isSystemArchitect ? 'ARCHITECT' : 'MASTER') : 'PLAYER'} CARD
                                        </span>
                                    </div>
                                    <span className="text-[10px] font-bold text-white font-mono">{userInfo?.username || 'UNKNOWN'}</span>
                                </button>
                                {isAdmin && (
                                    <button
                                        onClick={() => { navigate('/admin'); setIsMenuOpen(false); }}
                                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-yellow-500/50 bg-yellow-500/10 text-yellow-500 font-display font-bold text-[10px] tracking-widest uppercase hover:bg-yellow-500 hover:text-black transition-all cursor-pointer"
                                    >
                                        <LayoutDashboard size={14} />
                                        ADMIN DASHBOARD
                                    </button>
                                )}
                                <button
                                    onClick={() => { onLogoutClick?.(); setIsMenuOpen(false); }}
                                    className="flex items-center justify-center px-4 py-3 rounded-lg border border-red-500/50 bg-red-500/10 text-red-500 font-display font-bold text-[10px] tracking-widest uppercase hover:bg-red-500 hover:text-white transition-all cursor-pointer"
                                >
                                    LOGOUT
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => { onLoginClick?.(); setIsMenuOpen(false); }}
                                className="flex items-center justify-center px-4 py-3 rounded-lg border border-[#ff0050]/50 bg-[#ff0050]/10 text-[#ff0050] font-display font-bold text-[10px] tracking-widest uppercase hover:bg-[#ff0050] hover:text-white transition-all cursor-pointer"
                            >
                                LOGIN
                            </button>
                        )}
                    </div>
                </div>
            </nav>
            {showPlayerCard && (
                <PlayerCardModal
                    user={userInfo}
                    onClose={() => setShowPlayerCard(false)}
                />
            )}
        </>
    );
};
