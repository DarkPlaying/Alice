import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';

interface GameStatusGuardProps {
    children: React.ReactNode;
    isAdmin?: boolean;
    isLoggedIn?: boolean;
}

/**
 * GameStatusGuard: Enforces mandatory game participation
 * - If game is active (system_start = true), automatically redirects players to game
 * - Prevents URL manipulation and unauthorized navigation
 * - Admin users are exempt from this enforcement
 */
export const GameStatusGuard = ({ children, isAdmin = false, isLoggedIn = false }: GameStatusGuardProps) => {
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        // Skip enforcement for Admin users or Non-logged in users
        if (isAdmin || !isLoggedIn) return;

        // Skip if already in the game
        if (location.pathname === '/home/card/clubs') return;

        const checkGameStatus = async () => {
            const { data } = await supabase
                .from('clubs_game_status')
                .select('*')
                .eq('id', 'clubs_king')
                .single();

            if (data && data.system_start) {
                // Check Access Control
                if (data.allowed_players && Array.isArray(data.allowed_players) && data.allowed_players.length > 0) {
                    // We need to import auth to get current UID
                    // Using dynamic import or assuming global auth availability if tricky, 
                    // but we can try to get it from props or assume the component is used where auth is ready.
                    // Given the file structure, let's try to import auth at top level.
                    // Converting this function to use imported auth.
                }

                // Moved logic to include auth check
                const { auth } = await import('../firebase');
                const currentUserId = auth.currentUser?.uid;

                // If allowed_players list exists, check if user is in it
                if (data.allowed_players && Array.isArray(data.allowed_players) && data.allowed_players.length > 0) {
                    if (!currentUserId || !data.allowed_players.includes(currentUserId)) {
                        console.log("⛔ ACCESS DENIED: User not in allowed_players list. Not redirecting.");
                        return; // Do not redirect - user is not approved
                    }
                }

                // Only redirect if:
                // 1. No allowed_players restriction (allowed_players is null/empty), OR
                // 2. User IS in the allowed_players list (we already checked above)
                console.log("🚨 FORCE_REDIRECT: Active game detected, redirecting to game...");
                navigate('/home/card/clubs', { replace: true });
            }
        };

        checkGameStatus();

        // Real-time listener for game status changes
        const channel = supabase
            .channel(`game_guard_${location.pathname}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'clubs_game_status',
                filter: 'id=eq.clubs_king'
            }, async (payload) => {
                const newData = payload.new;
                if (newData.system_start) {
                    // Check Access Control Real-time
                    const { auth } = await import('../firebase');
                    const currentUserId = auth.currentUser?.uid;

                    // If allowed_players list exists, check if user is in it
                    if (newData.allowed_players && Array.isArray(newData.allowed_players) && newData.allowed_players.length > 0) {
                        if (!currentUserId || !newData.allowed_players.includes(currentUserId)) {
                            console.log("⛔ ACCESS DENIED: User not in allowed_players list. Not redirecting.");
                            return; // Do not redirect - user is not approved
                        }
                    }

                    console.log("🚨 FORCE_REDIRECT: Game started, redirecting to game...");
                    navigate('/home/card/clubs', { replace: true });
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [isAdmin, isLoggedIn, location.pathname, navigate]);

    return <>{children}</>;
};
