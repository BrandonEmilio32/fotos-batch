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
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co";
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "missing-anon-key-for-build-time";

  browserClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return browserClient;
}
