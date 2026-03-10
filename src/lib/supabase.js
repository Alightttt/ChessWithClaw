import { createClient } from '@supabase/supabase-js';

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const rawSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Clean up quotes or whitespace that might be accidentally included in Vercel env vars
const supabaseUrl = rawSupabaseUrl.replace(/^["']|["']$/g, '').trim();
const supabaseAnonKey = rawSupabaseAnonKey.replace(/^["']|["']$/g, '').trim();

let client = null;
let isConfigured = false;

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === 'your_supabase_project_url' || supabaseAnonKey === 'your_supabase_anon_key') {
  console.error('CRITICAL ERROR: Supabase credentials are missing or invalid in environment variables.');
  
  // Create a dummy client that explicitly throws errors to prevent silent failures
  const throwError = () => { throw new Error('Supabase is not configured. Please check your .env file.'); };
  
  client = {
    from: () => ({
      select: () => ({ eq: () => ({ single: throwError }) }),
      insert: () => ({ select: () => ({ single: throwError }) }),
      update: () => ({ eq: throwError })
    }),
    channel: () => ({
      on: () => ({ subscribe: () => ({}) })
    }),
    removeChannel: () => {}
  };
} else {
  try {
    const urlToUse = supabaseUrl.startsWith('http') ? supabaseUrl : `https://${supabaseUrl}`;
    client = createClient(urlToUse, supabaseAnonKey);
    isConfigured = true;
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
    const throwError = () => { throw new Error(`Supabase initialization failed: ${error.message}`); };
    client = {
      from: () => ({
        select: () => ({ eq: () => ({ single: throwError }) }),
        insert: () => ({ select: () => ({ single: throwError }) }),
        update: () => ({ eq: throwError })
      }),
      channel: () => ({
        on: () => ({ subscribe: () => ({}) })
      }),
      removeChannel: () => {}
    };
  }
}

export const hasSupabase = isConfigured;
export const supabase = client;

export const getSupabaseWithToken = (token) => {
  if (!isConfigured) return client;
  const urlToUse = supabaseUrl.startsWith('http') ? supabaseUrl : `https://${supabaseUrl}`;
  return createClient(urlToUse, supabaseAnonKey, {
    global: {
      headers: {
        'x-game-token': token || ''
      }
    }
  });
};
