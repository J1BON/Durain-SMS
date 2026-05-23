import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type Database = {
  public: {
    Tables: {
      site_users: {
        Row: { id: string; username: string; password: string; role: string };
        Insert: { id: string; username: string; password: string; role: string };
        Update: { id?: string; username?: string; password?: string; role?: string };
        Relationships: [];
      };
      sms_tracking: {
        Row: {
          id: string;
          user_id: string;
          username: string;
          phone_number: string;
          pid: string;
          country: string;
          assigned_at: number;
          received_sms: boolean;
          released: boolean;
          sms_code: string | null;
          updated_at: number | null;
        };
        Insert: {
          id: string;
          user_id: string;
          username: string;
          phone_number: string;
          pid: string;
          country: string;
          assigned_at: number;
          received_sms: boolean;
          released: boolean;
          sms_code?: string | null;
          updated_at?: number | null;
        };
        Update: {
          received_sms?: boolean;
          released?: boolean;
          sms_code?: string | null;
          updated_at?: number | null;
        };
        Relationships: [];
      };
      site_settings: {
        Row: { key: string; value: unknown };
        Insert: { key: string; value: unknown };
        Update: { key?: string; value?: unknown };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};

let _client: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env.local",
    );
  }
  _client = createClient<Database>(url, key, { auth: { persistSession: false } });
  return _client;
}
