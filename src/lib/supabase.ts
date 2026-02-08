import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;
let serverStub: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (typeof window === "undefined") {
    // During prerender/SSR we do not need a real client for browser-only flows.
    if (!serverStub) {
      serverStub = {} as SupabaseClient;
    }
    return serverStub;
  }

  if (browserClient) return browserClient;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // In the browser we require real env values; otherwise requests fail with DNS/fetch errors.
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase client misconfigured: missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  browserClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return browserClient;
}
