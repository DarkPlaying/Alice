import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dweeanxonatdmlqfnsai.supabase.co';
const supabaseKey = 'sb_publishable_dIOrmzsUuKBS59t8uZwPEg_NTj17PaZ';

export const supabase = createClient(supabaseUrl, supabaseKey);
