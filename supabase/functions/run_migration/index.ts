import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Execute the migration SQL directly using raw query
    const { error } = await supabase
      .from('_supabase_migration_temp')
      .select('*')
      .limit(1)
      .then(async () => {
        // Try to create the function using raw SQL
        const createFunctionSQL = `
          CREATE OR REPLACE FUNCTION public.set_session_id(session_id TEXT)
          RETURNS VOID
          LANGUAGE plpgsql
          SECURITY DEFINER
          SET search_path = public
          AS $$
          BEGIN
            PERFORM set_config('app.session_id', session_id, false);
          END;
          $$;
        `;
        
        // This won't work directly, let me try a different approach
        return { error: { message: 'Direct SQL execution not available' } };
      })

    if (error) {
      console.error('Migration error:', error)
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Migration applied successfully' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
