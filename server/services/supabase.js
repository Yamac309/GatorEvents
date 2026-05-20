import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    '\n  Missing Supabase credentials — the server cannot start.\n\n' +
    '  Fix:\n' +
    '   1. Open  server/.env\n' +
    '   2. Set   SUPABASE_URL  and  SUPABASE_SERVICE_KEY\n' +
    '      (Supabase dashboard -> Project Settings -> API)\n' +
    '   3. Make sure you ran  supabase/schema.sql  in the Supabase SQL editor\n' +
    '   4. Stop this server (Ctrl+C) and run  npm run dev  again\n'
  );
  process.exit(1);
}

// Use the service key on the server to bypass row-level security
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
