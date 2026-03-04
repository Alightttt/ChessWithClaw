import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

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
