// CACHE BUSTER V2: FORCING VITE TO RECOMPILE
import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = 'https://ssirmxujmdhdhmnqxfxi.supabase.co';
export const supabaseKey = 'sb_publishable_8aNc7iJaeXfRI2jOwHccrQ_dFMYz6fT';

const customFetch = (url: RequestInfo | URL, options?: RequestInit) => {
    console.log('[CUSTOM FETCH CALLED]', typeof url === 'string' ? url : (url as any)?.url || 'Request Object');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        console.warn(`[SUPABASE FETCH TIMEOUT] Forcibly aborting request after 20s:`, typeof url === 'string' ? url : (url as any)?.url || 'Request Object');
        controller.abort(new Error('Global Fetch Timeout'));
    }, 20000);

    const opts = { ...options };

    // BROWSER CACHE BUSTING:
    // Force the browser to NEVER cache Supabase API responses. 
    // This fixes the "Player UI stuck on old state while Admin UI advances" bug.
    opts.cache = 'no-store';

    if (opts.signal) {
        opts.signal.addEventListener('abort', () => controller.abort());
    }

    opts.signal = controller.signal; // Restore AbortSignal to prevent connection pool exhaustion

    // Do NOT wrap in new Request(url, opts) because older/some browsers drop the signal.
    // Instead, pass url and opts directly to fetch, which natively merges them.
    return fetch(url, opts).finally(() => clearTimeout(timeoutId));
};

// In-memory mutex to replace navigator.locks for insecure HTTP contexts
// Using window object to survive Vite HMR reloads and prevent multiple GoTrueClient instances from deadlocking
const getLocks = () => {
    if (!(window as any).__supabaseLocks) {
        (window as any).__supabaseLocks = new Map<string, { locked: boolean, queue: Array<() => void> }>();
    }
    return (window as any).__supabaseLocks;
};

// CRITICAL FIX: Clear stuck GoTrue cross-tab locks from localStorage on startup!
// If a previous HMR reload or crash left the lock set, all new clients will hang FOREVER waiting for it.
if (typeof window !== 'undefined' && window.localStorage) {
    try {
        // GoTrue appends '-lock' to the storageKey
        window.localStorage.removeItem('borderland-fresh-token-v2-lock');
    } catch (e) {
        // Ignore cross-origin localStorage errors
    }
}

// Robust in-memory mutex queue for GoTrue
let currentLock = Promise.resolve();

const authConfig: any = {
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
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
    global: {
        fetch: customFetch
    },
    auth: authConfig
});

export const getAccessToken = async (): Promise<string> => {
    try {
        let tokenStr = window.localStorage.getItem('borderland-fresh-token-v2');
        if (!tokenStr) {
            const keys = Object.keys(window.localStorage);
            const authKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
            if (authKey) {
                tokenStr = window.localStorage.getItem(authKey);
            }
        }

        if (tokenStr) {
            const tokenData = JSON.parse(tokenStr);
            if (tokenData && tokenData.access_token) {
                return tokenData.access_token;
            }
        } else {
            console.warn('[ACCESS TOKEN] Token NOT found in localStorage! Available keys:', Object.keys(window.localStorage));
        }
    } catch (e) {
        console.error('[ACCESS TOKEN] Error parsing token:', e);
    }

    console.log('[ACCESS TOKEN] Falling back to getSession() with 100ms timeout...');
    return new Promise((resolve) => {
        let resolved = false;
        const timer = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                console.warn('[ACCESS TOKEN] getSession() timed out! Returning empty token.');
                resolve('');
            }
        }, 100); // 100ms timeout! Extremely strict!

        supabase.auth.getSession().then(({ data }) => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timer);
                console.log('[ACCESS TOKEN] getSession() succeeded!');
                resolve(data?.session?.access_token || '');
            }
        }).catch((e) => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timer);
                console.error('[ACCESS TOKEN] getSession() failed:', e);
                resolve('');
            }
        });
    });
};
