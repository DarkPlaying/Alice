import { createClient } from '@supabase/supabase-js';

export const chatClient = createClient('https://ssirmxujmdhdhmnqxfxi.supabase.co', 'sb_publishable_8aNc7iJaeXfRI2jOwHccrQ_dFMYz6fT', {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
        storageKey: 'borderland-admin-v2',
        lock: async (_name: string, ...args: any[]) => {
            const acquire = args.pop();
            if (typeof acquire === 'function') {
                return await acquire();
            }
        }
    }
});
