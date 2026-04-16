import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://yfazkcmyqinhxiptahla.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('SUPABASE_SERVICE_ROLE_KEY not set. Supabase storage admin operations will fail.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function generateDownloadUrl(path: string) {
  const { data, error } = await supabase.storage.from('workflows').createSignedUrl(path, 60);
  if (error) throw error;
  return data?.signedUrl;
}

export default supabase;
