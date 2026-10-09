import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env?.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Supabase client, or null when not configured. The whole app works offline/local-only
 * without it; accounts and sync switch on once `.env` has the project URL + anon key.
 */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;
export const backendEnabled = supabase !== null;

/** Show "Continue with Google" only once the provider is enabled in Supabase (VITE_AUTH_GOOGLE=true). */
export const googleEnabled = backendEnabled && import.meta.env?.VITE_AUTH_GOOGLE === "true";
