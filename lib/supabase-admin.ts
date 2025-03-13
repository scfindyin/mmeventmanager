import { createClient } from '@supabase/supabase-js'

// Initialize the Supabase admin client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Only initialize the admin client if we have the service role key
export const supabaseAdmin = supabaseServiceRoleKey && supabaseUrl 
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null

// Log whether we have admin access or not
if (supabaseAdmin) {
  console.log('Supabase admin client initialized')
} else {
  console.log('No Supabase service role key provided, admin client not available')
}

