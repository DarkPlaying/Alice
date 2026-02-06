import { Navbar } from './Navbar';
import { Hero } from './Hero';
import { SurvivalProtocol } from './SurvivalProtocol';
import { GamesPanel } from './GamesPanel';
import { Rules } from './Rules';
import { Leaderboard } from './Leaderboard';
import { Footer } from './Footer';
import { FloatingCards } from './FloatingCards';
import { AboutGame } from './AboutGame';
import { useNavigate } from 'react-router-dom';

interface LandingPageProps {
    onLoginClick?: () => void;
    isLoggedIn?: boolean;
    onLogoutClick?: () => void;
    userInfo?: any;
    isAdmin?: boolean;
}

export function LandingPage({ onLoginClick, isLoggedIn, onLogoutClick, userInfo, isAdmin }: LandingPageProps) {
    const navigate = useNavigate();

    const handleStart = () => {
        navigate('/home/card');
    };

    return (
        <div className="bg-black min-h-screen text-white selection:bg-[#ff0050] selection:text-white font-sans relative">
            <FloatingCards />
            <Navbar
                onLoginClick={onLoginClick}
                isLoggedIn={isLoggedIn}
                onLogoutClick={onLogoutClick}
                userInfo={userInfo}
                isAdmin={isAdmin}
            />
            <Hero onStart={handleStart} userInfo={userInfo} />
            <AboutGame />
            <SurvivalProtocol />
            <GamesPanel />
            <Rules />
            <Leaderboard />
            <Footer />
        </div>
    );
}
