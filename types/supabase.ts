/**
 * Supabase / Postgres table typings for ChatShare.
 * Keep in sync with `supabase/migrations/`.
 */

export type ReportReason = "SPAM" | "PII" | "DANGER" | "OTHER";
export type ReportStatus = "PENDING" | "RESOLVED" | "DISMISSED";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          reputation_score: number;
          token_balance: number;
          timezone: string;
          last_token_reset: string | null;
          auto_unstar: boolean;
          is_admin: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          reputation_score?: number;
          token_balance?: number;
          timezone?: string;
          last_token_reset?: string | null;
          auto_unstar?: boolean;
          is_admin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string | null;
          reputation_score?: number;
          token_balance?: number;
          timezone?: string;
          last_token_reset?: string | null;
          auto_unstar?: boolean;
          is_admin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      threads: {
        Row: {
          id: string;
          author_id: string;
          title: string;
          content: Json;
          source_model: string | null;
          summary: string | null;
          tags: string[];
          is_public: boolean;
          status: string;
          total_tokens?: number;
          props_count: number;
          slop_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          title: string;
          content?: Json;
          source_model?: string | null;
          summary?: string | null;
          tags?: string[];
          is_public?: boolean;
          status?: string;
          total_tokens?: number;
          props_count?: number;
          slop_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          author_id?: string;
          title?: string;
          content?: Json;
          source_model?: string | null;
          summary?: string | null;
          tags?: string[];
          is_public?: boolean;
          status?: string;
          total_tokens?: number;
          props_count?: number;
          slop_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "threads_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      reports: {
        Row: {
          id: string;
          thread_id: string | null;
          reporter_id: string;
          reason: ReportReason;
          status: ReportStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          thread_id: string;
          reporter_id: string;
          reason: ReportReason;
          status?: ReportStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          thread_id?: string | null;
          reporter_id?: string;
          reason?: ReportReason;
          status?: ReportStatus;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reports_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "threads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

export type Report = Tables<"reports">;
export type ReportInsert = TablesInsert<"reports">;
export type ReportUpdate = TablesUpdate<"reports">;
