import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { LandingPage } from './components/LandingPage';
import { CardSelection } from './components/CardSelection';
import { GameContainer } from './components/GameContainer';
import { LoginPage } from './components/LoginPage';
import { AdminDashboard } from './components/AdminDashboard';
import { GameStatusGuard } from './components/GameStatusGuard';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setIsLoggedIn(true);
            // MERGE AUTH DATA: Ensure critical fields like uid/email are present (ID last to overwrite matches)
            const finalUser = { ...userData, uid: user.uid, email: user.email, id: user.uid };
            console.log("APP: User Login Success:", finalUser);
            setUser(finalUser);
            setIsAdmin(userData.role === 'admin' || userData.username === 'admin');
          } else {
            console.error("DATA CORRUPTION: USER PROFILE MISSING");
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
      setTimeout(() => {
        setIsLoading(false);
      }, 3000);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsAdmin(false);
      setIsLoggedIn(false);
      setUser(null);
      navigate('/login');
    } catch (error) {
      console.error("LOGOUT ERROR", error);
    }
  };

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
                onLogin={() => {
                  setIsLoggedIn(true);
                  navigate('/home');
                }}
                onAdminLogin={() => {
                  setIsAdmin(true);
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
