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

// Wrapper for GameContainer to extract params
function GamePage({ onClose, isLoggedIn, onLogoutClick, userInfo }: { onClose: () => void; isLoggedIn: boolean; onLogoutClick: () => void; userInfo: any }) {
  const { gameId } = useParams();
  const formattedType = gameId ? gameId.charAt(0).toUpperCase() + gameId.slice(1) : '';

  // Forcefully eject to home if not logged in
  if (!isLoggedIn) {
    return <Navigate to="/home" replace />;
  }

  return <GameContainer type={formattedType} onClose={onClose} isLoggedIn={isLoggedIn} onLogoutClick={onLogoutClick} userInfo={userInfo} />;
}

function AppContent() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
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
      setTimeout(() => {
        setIsLoading(false);
      }, 1500); // reduced to 1.5s since it's already fast
    });
    return () => {
      clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, []);

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

  if (isLoading) {
    return <Loader />;
  }

  return (
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
          <GameStatusGuard isAdmin={isAdmin} isLoggedIn={isLoggedIn}>
            <CardSelection
              onCardSelect={(type) => navigate(`/home/card/${type.toLowerCase()}`)}
              onBack={() => navigate('/home')}
              isLoggedIn={isLoggedIn}
              onLogoutClick={handleLogout}
              userInfo={user}
            />
          </GameStatusGuard>
        }
      />
      <Route
        path="/home/card/:gameId"
        element={<GamePage onClose={() => navigate('/home/card')} isLoggedIn={isLoggedIn} onLogoutClick={handleLogout} userInfo={user} />}
      />
      <Route
        path="/admin"
        element={
          isAdmin ? <AdminDashboard onLogout={handleLogout} /> : <Navigate to="/login" replace />
        }
      />
    </Routes>
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
