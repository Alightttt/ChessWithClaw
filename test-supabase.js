import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://qtrypzzcjebvfcihiynt.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0cnlwenpjamVidmZjaWhpeW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTI0OTc2MDAsImV4cCI6MjAyODA3MzYwMH0.1234567890');
async function test() {
  console.log('Starting insert...');
  try {
    const { data, error } = await supabase.from('games').insert([{ status: 'waiting' }]).select().single();
    console.log('Result:', { data, error });
  } catch (e) {
    console.log('Exception:', e.message);
  }
}
test();
