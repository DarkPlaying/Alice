import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { LandingPage } from './components/LandingPage';
import { CardSelection } from './components/CardSelection';
import { GameContainer } from './components/GameContainer';
import { LoginPage } from './components/LoginPage';
import { AdminDashboard } from './components/AdminDashboard';
import { GameStatusGuard } from './components/GameStatusGuard';
import { supabase } from './supabaseClient';
import { Loader } from './components/Loader';
import { WaitlistCard } from './components/ui/card-6';

// Wrapper for authenticated routes with a warning overlay and 2s delay redirect to login
function RequireAuth({ children, isLoggedIn, isAdmin, isLoading }: { children: React.ReactNode; isLoggedIn: boolean; isAdmin: boolean; isLoading: boolean }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    if (!isLoggedIn) {
      const timer = setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isLoggedIn, navigate, isLoading]);

  if (isLoading) {
    return null;
  }

  if (!isLoggedIn) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[999] flex flex-col items-center justify-center text-center px-4 font-sans select-none">
        {/* Futuristic Laser grid background overlay */}
        <div className="absolute inset-0 opacity-20 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,3px_100%]" />
        
        <div className="relative z-10 p-8 border border-[#ff0050]/30 bg-black/80 rounded-2xl max-w-md w-full backdrop-blur-md shadow-[0_0_50px_rgba(255,0,80,0.15)] flex flex-col items-center gap-6">
          <div className="w-16 h-16 rounded-full border-2 border-[#ff0050] flex items-center justify-center text-[#ff0050] text-3xl animate-pulse font-mono">
            ⚠️
          </div>
          <div className="space-y-2">
            <h2 className="text-[#ff0050] font-display font-black tracking-widest text-lg uppercase">
              IDENTITY UNVERIFIED
            </h2>
            <p className="text-gray-400 font-mono text-xs tracking-wider leading-relaxed">
              SURVIVAL PROTOCOL REQUIRES AUTHENTICATION.
            </p>
          </div>
          <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
            <div className="h-full bg-[#ff0050] animate-[loadProgress_2s_linear]" style={{
              width: '100%',
            }} />
          </div>
          <p className="text-gray-500 font-mono text-[10px] tracking-[0.2em] uppercase animate-pulse">
            Redirecting to Login Protocol...
          </p>
        </div>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes loadProgress {
            from { width: 0%; }
            to { width: 100%; }
          }
        `}} />
      </div>
    );
  }

  return <>{children}</>;
}

// Wrapper for GameContainer to extract params
function GamePage({ onClose, isLoggedIn, onLogoutClick, userInfo, isAdmin }: { onClose: () => void; isLoggedIn: boolean; onLogoutClick: () => void; userInfo: any; isAdmin: boolean }) {
  const { gameId } = useParams();
  const formattedType = gameId ? gameId.charAt(0).toUpperCase() + gameId.slice(1) : '';

  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return <GameContainer type={formattedType} onClose={onClose} isLoggedIn={isLoggedIn} onLogoutClick={onLogoutClick} userInfo={userInfo} />;
}

function AppContent() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [maintenanceActive, setMaintenanceActive] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState<string | null>(null);
  const [showBroadcastOverlay, setShowBroadcastOverlay] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    console.log("LOCAL STORAGE DUMP ON BOOT:", localStorage.getItem('borderland-fresh-token-v2'));
    
    // Fallback: forcefully remove loader after 5s if auth state change doesn't fire
    const fallbackTimer = setTimeout(() => {
      setIsLoading(false);
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        try {
          const { data: userData, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', session.user.email)
            .single();

          if (userData && !error) {
            setIsLoggedIn(true);
            // MERGE AUTH DATA: Ensure critical fields like uid/email are present (ID last to overwrite matches)
            const finalUser = { ...userData, uid: session.user.id, email: session.user.email, id: session.user.id };
            console.log("APP: User Login Success:", finalUser);
            setUser(finalUser);
            setIsAdmin(userData.role === 'admin' || userData.username === 'admin' || userData.role === 'master');
          } else {
            console.error("DATA CORRUPTION: USER PROFILE MISSING", error);
            setIsLoggedIn(false);
            setUser(null);
            setIsAdmin(false);
          }
        } catch (error) {
          console.error("SECURITY BREACH: FAILED TO VERIFY ROLE", error);
          setIsLoggedIn(false);
          setUser(null);
          setIsAdmin(false);
        }
      } else {
        setIsLoggedIn(false);
        setUser(null);
        setIsAdmin(false);
      }
      clearTimeout(fallbackTimer);
      setIsLoading(false);
    });
    return () => {
      clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, []);

  // Listen to admin settings row for global maintenance mode and Realtime broadcasts
  useEffect(() => {
    const checkSettings = async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', '00000000-0000-0000-0000-000000000000').maybeSingle();
      if (data) {
        setMaintenanceActive(data.role === 'maintenance');
      }
    };
    checkSettings();

    // Postgres changes listener for maintenance mode toggle
    const pgChannel = supabase.channel('global_settings_listener')
      .on('postgres_changes', { event: 'UPDATE', filter: "id=eq.00000000-0000-0000-0000-000000000000", schema: 'public', table: 'profiles' }, (payload) => {
        const newSettings = payload.new as any;
        if (newSettings) {
          setMaintenanceActive(newSettings.role === 'maintenance');
          // Fallback: parse broadcast from email field if present
          if (newSettings.email && newSettings.email.startsWith('broadcast:')) {
            const parts = newSettings.email.split(':');
            const msg = parts.slice(1, -1).join(':');
            if (msg) {
              setBroadcastMessage(msg);
              setShowBroadcastOverlay(true);
            }
          }
        }
      })
      .subscribe();

    // Realtime broadcast channel — instant delivery to all connected clients
    const broadcastChannel = supabase.channel('admin-broadcast', {
      config: { broadcast: { self: false } }
    })
      .on('broadcast', { event: 'admin_message' }, (payload) => {
        const msg = payload.payload?.message;
        if (msg) {
          setBroadcastMessage(msg);
          setShowBroadcastOverlay(true);
        }
      })
      .on('broadcast', { event: 'maintenance' }, (payload) => {
        setMaintenanceActive(payload.payload?.active === true);
        if (payload.payload?.active) {
          setBroadcastMessage(null);
          setShowBroadcastOverlay(false);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(pgChannel);
      supabase.removeChannel(broadcastChannel);
    };
  }, []);

  // NOTE: Broadcast overlay is now dismissed by the user clicking, not auto-dismissed

  const handleLogout = async () => {
    try {
      // The custom lock function causes ANY Supabase Auth method (like signOut) to permanently hang the in-memory mutex.
      // We completely bypass it by clearing localStorage and doing a hard page reload to destroy the stuck mutex in memory!
      localStorage.removeItem('borderland-fresh-token-v2');
      window.location.href = '/login';
    } catch (error) {
      console.error("LOGOUT ERROR", error);
    }
  };

  useEffect(() => {
    // Check if user is running old cached code with the broken lock
    if ((window as any).__supabaseLocks && (window as any).__supabaseLocks.size > 0) {
      alert("WARNING: Your browser is running OLD cached code that causes the game to freeze. Please press Ctrl+Shift+R right now to Hard Refresh this tab!");
    }
  }, []);

  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route
          path="/home"
          element={
            <GameStatusGuard isAdmin={isAdmin} isLoggedIn={isLoggedIn}>
              <LandingPage
                onLoginClick={() => navigate('/login')}
                isLoggedIn={isLoggedIn}
                onLogoutClick={handleLogout}
                userInfo={user}
                isAdmin={isAdmin}
              />
            </GameStatusGuard>
          }
        />
        <Route
          path="/login"
          element={
            <GameStatusGuard isAdmin={isAdmin} isLoggedIn={isLoggedIn}>
              {isLoggedIn ? (
                <Navigate to="/home" replace />
              ) : (
                <LoginPage
                  onLogin={(loggedInUser) => {
                    setUser(loggedInUser);
                    setIsLoggedIn(true);
                    navigate('/home');
                  }}
                  onAdminLogin={(loggedInUser) => {
                    setUser(loggedInUser);
                    setIsAdmin(true);
                    setIsLoggedIn(true);
                    navigate('/home');
                  }}
                />
              )}
            </GameStatusGuard>
          }
        />
        <Route
          path="/home/card"
          element={
            <RequireAuth isLoggedIn={isLoggedIn} isAdmin={isAdmin} isLoading={isLoading}>
              {isAdmin ? (
                <Navigate to="/admin" replace />
              ) : (
                <GameStatusGuard isAdmin={isAdmin} isLoggedIn={isLoggedIn}>
                  {maintenanceActive && !isAdmin ? (
                    <div className="fixed inset-0 bg-black z-[9999] flex flex-col items-center justify-center text-center p-8 select-none">
                      <div className="w-20 h-20 rounded-full border border-red-600 flex items-center justify-center text-red-600 text-4xl animate-pulse mb-6">⚠️</div>
                      <h1 className="text-red-600 text-2xl font-display font-black tracking-widest mb-4 uppercase">WEBSITE UNDER MAINTENANCE</h1>
                      <p className="text-gray-400 font-mono text-sm tracking-wider max-w-md leading-relaxed uppercase">
                        THE SPECIALTY SELECTION TERMINAL IS CURRENTLY OFFLINE FOR SYSTEM UPKEEP.
                      </p>
                    </div>
                  ) : (
                    <CardSelection
                      onCardSelect={(type) => navigate(`/home/card/${type.toLowerCase()}`)}
                      onBack={() => navigate('/home')}
                      isLoggedIn={isLoggedIn}
                      onLogoutClick={handleLogout}
                      userInfo={user}
                    />
                  )}
                </GameStatusGuard>
              )}
            </RequireAuth>
          }
        />
        <Route
          path="/home/card/:gameId"
          element={
            <RequireAuth isLoggedIn={isLoggedIn} isAdmin={isAdmin} isLoading={isLoading}>
              {maintenanceActive && !isAdmin ? (
                  <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[9999] flex flex-col items-center justify-center text-center p-8 select-none">
                    <WaitlistCard
                        icon={<span className="text-4xl animate-pulse">⚠️</span>}
                        title="SYSTEM MAINTENANCE"
                        description="This arena is temporarily offline for system maintenance. Operations will resume shortly."
                    />
                  </div>
              ) : (
                <GamePage onClose={() => navigate('/home/card')} isLoggedIn={isLoggedIn} onLogoutClick={handleLogout} userInfo={user} isAdmin={isAdmin} />
              )}
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            isLoading ? null : (isAdmin ? <AdminDashboard onLogout={handleLogout} /> : <Navigate to="/login" replace />)
          }
        />
      </Routes>
      {isLoading && <Loader />}

      {/* Broadcast System Overlay - persistent until user dismisses */}
      {showBroadcastOverlay && broadcastMessage && !isAdmin && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-lg z-[99999] flex items-center justify-center p-6 select-none"
          onClick={() => setShowBroadcastOverlay(false)}
        >
          <div
            className="relative max-w-md w-full bg-[#0a0a10] border border-white/15 rounded-xl shadow-[0_0_80px_rgba(0,0,0,0.9)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Inner content */}
            <div className="px-8 pt-8 pb-8 flex flex-col items-center text-center">

              {/* Joker icon */}
              <img src="/suit_assets/joker.png" alt="System" className="w-12 h-12 object-contain mb-5 opacity-70" />

              {/* Title */}
              <h3
                style={{ fontFamily: "'Cinzel', serif" }}
                className="text-base font-bold tracking-[0.15em] mb-3 leading-snug uppercase text-blue-300"
              >
                System Broadcast
              </h3>

              {/* Divider */}
              <div className="w-12 h-px bg-white/10 mb-4" />

              {/* Message */}
              <p className="text-gray-300 text-[13px] leading-relaxed mb-6 whitespace-pre-wrap font-mono tracking-wide">
                {broadcastMessage}
              </p>

              {/* Button */}
              <button
                onClick={() => setShowBroadcastOverlay(false)}
                className="w-full py-2.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 hover:border-blue-400 text-blue-300 text-[11px] font-mono font-bold uppercase tracking-[0.15em] rounded-lg transition-all active:scale-95"
              >
                ♠ Acknowledged
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
