export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      bytecode_fingerprints: {
        Row: {
          confidence: number
          created_at: string
          description: string | null
          fingerprint_id: string
          is_active: boolean | null
          selectors: string[]
          standard: string
          updated_at: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          description?: string | null
          fingerprint_id: string
          is_active?: boolean | null
          selectors: string[]
          standard?: string
          updated_at?: string
        }
        Update: {
          confidence?: number
          created_at?: string
          description?: string | null
          fingerprint_id?: string
          is_active?: boolean | null
          selectors?: string[]
          standard?: string
          updated_at?: string
        }
        Relationships: []
      }
      creator_profiles: {
        Row: {
          address: string
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          farcaster_fid: number | null
          farcaster_handle: string | null
          followers: number | null
          id: string
          updated_at: string
        }
        Insert: {
          address: string
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          farcaster_fid?: number | null
          farcaster_handle?: string | null
          followers?: number | null
          id?: string
          updated_at?: string
        }
        Update: {
          address?: string
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          farcaster_fid?: number | null
          farcaster_handle?: string | null
          followers?: number | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      token_detections: {
        Row: {
          address: string
          block_number: number | null
          chain: string
          code_hash: string | null
          detected_at: string
          factory_address: string | null
          id: string
          log_index: number | null
          matched_fingerprint: string | null
          processed: boolean | null
          raw_data: Json | null
          source: Database["public"]["Enums"]["token_source"]
          tx_hash: string | null
        }
        Insert: {
          address: string
          block_number?: number | null
          chain?: string
          code_hash?: string | null
          detected_at?: string
          factory_address?: string | null
          id?: string
          log_index?: number | null
          matched_fingerprint?: string | null
          processed?: boolean | null
          raw_data?: Json | null
          source: Database["public"]["Enums"]["token_source"]
          tx_hash?: string | null
        }
        Update: {
          address?: string
          block_number?: number | null
          chain?: string
          code_hash?: string | null
          detected_at?: string
          factory_address?: string | null
          id?: string
          log_index?: number | null
          matched_fingerprint?: string | null
          processed?: boolean | null
          raw_data?: Json | null
          source?: Database["public"]["Enums"]["token_source"]
          tx_hash?: string | null
        }
        Relationships: []
      }
      token_history: {
        Row: {
          holders: number | null
          id: string
          liquidity: number | null
          price: number | null
          timestamp: string
          token_address: string
          volume: number | null
        }
        Insert: {
          holders?: number | null
          id?: string
          liquidity?: number | null
          price?: number | null
          timestamp?: string
          token_address: string
          volume?: number | null
        }
        Update: {
          holders?: number | null
          id?: string
          liquidity?: number | null
          price?: number | null
          timestamp?: string
          token_address?: string
          volume?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "token_history_token_address_fkey"
            columns: ["token_address"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["address"]
          },
        ]
      }
      token_provenance: {
        Row: {
          block_number: number | null
          chain: string
          created_at: string
          detected_at: string
          factory_address: string | null
          id: string
          is_primary: boolean | null
          log_index: number | null
          metadata: Json | null
          source: Database["public"]["Enums"]["token_source"]
          token_address: string
          tx_hash: string | null
        }
        Insert: {
          block_number?: number | null
          chain?: string
          created_at?: string
          detected_at?: string
          factory_address?: string | null
          id?: string
          is_primary?: boolean | null
          log_index?: number | null
          metadata?: Json | null
          source: Database["public"]["Enums"]["token_source"]
          token_address: string
          tx_hash?: string | null
        }
        Update: {
          block_number?: number | null
          chain?: string
          created_at?: string
          detected_at?: string
          factory_address?: string | null
          id?: string
          is_primary?: boolean | null
          log_index?: number | null
          metadata?: Json | null
          source?: Database["public"]["Enums"]["token_source"]
          token_address?: string
          tx_hash?: string | null
        }
        Relationships: []
      }
      token_stage_history: {
        Row: {
          chain: string
          created_at: string
          from_stage: Database["public"]["Enums"]["token_stage"] | null
          id: string
          reason: string | null
          stats_snapshot: Json | null
          to_stage: Database["public"]["Enums"]["token_stage"]
          token_address: string
          triggered_by: Database["public"]["Enums"]["token_source"] | null
        }
        Insert: {
          chain?: string
          created_at?: string
          from_stage?: Database["public"]["Enums"]["token_stage"] | null
          id?: string
          reason?: string | null
          stats_snapshot?: Json | null
          to_stage: Database["public"]["Enums"]["token_stage"]
          token_address: string
          triggered_by?: Database["public"]["Enums"]["token_source"] | null
        }
        Update: {
          chain?: string
          created_at?: string
          from_stage?: Database["public"]["Enums"]["token_stage"] | null
          id?: string
          reason?: string | null
          stats_snapshot?: Json | null
          to_stage?: Database["public"]["Enums"]["token_stage"]
          token_address?: string
          triggered_by?: Database["public"]["Enums"]["token_source"] | null
        }
        Relationships: []
      }
      token_stats: {
        Row: {
          holders: number | null
          id: string
          liquidity: number | null
          liquidity_dex: number | null
          liquidity_estimated: number | null
          liquidity_source: string | null
          market_cap: number | null
          price: number | null
          price_change_24h: number | null
          token_address: string
          updated_at: string
          volume_24h: number | null
        }
        Insert: {
          holders?: number | null
          id?: string
          liquidity?: number | null
          liquidity_dex?: number | null
          liquidity_estimated?: number | null
          liquidity_source?: string | null
          market_cap?: number | null
          price?: number | null
          price_change_24h?: number | null
          token_address: string
          updated_at?: string
          volume_24h?: number | null
        }
        Update: {
          holders?: number | null
          id?: string
          liquidity?: number | null
          liquidity_dex?: number | null
          liquidity_estimated?: number | null
          liquidity_source?: string | null
          market_cap?: number | null
          price?: number | null
          price_change_24h?: number | null
          token_address?: string
          updated_at?: string
          volume_24h?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "token_stats_token_address_fkey"
            columns: ["token_address"]
            isOneToOne: true
            referencedRelation: "tokens"
            referencedColumns: ["address"]
          },
        ]
      }
      tokens: {
        Row: {
          address: string
          chain: string
          created_at: string
          creation_block: number | null
          creation_log_index: number | null
          creation_tx_hash: string | null
          creator_address: string | null
          decimals: number
          factory_address: string | null
          first_seen_at: string | null
          id: string
          launch_timestamp: string
          logo_url: string | null
          metadata_uri: string | null
          name: string
          platform: Database["public"]["Enums"]["token_platform"]
          source: Database["public"]["Enums"]["token_source"]
          symbol: string
          token_stage: Database["public"]["Enums"]["token_stage"]
          total_supply: number | null
          updated_at: string
        }
        Insert: {
          address: string
          chain?: string
          created_at?: string
          creation_block?: number | null
          creation_log_index?: number | null
          creation_tx_hash?: string | null
          creator_address?: string | null
          decimals?: number
          factory_address?: string | null
          first_seen_at?: string | null
          id?: string
          launch_timestamp?: string
          logo_url?: string | null
          metadata_uri?: string | null
          name: string
          platform?: Database["public"]["Enums"]["token_platform"]
          source?: Database["public"]["Enums"]["token_source"]
          symbol: string
          token_stage?: Database["public"]["Enums"]["token_stage"]
          total_supply?: number | null
          updated_at?: string
        }
        Update: {
          address?: string
          chain?: string
          created_at?: string
          creation_block?: number | null
          creation_log_index?: number | null
          creation_tx_hash?: string | null
          creator_address?: string | null
          decimals?: number
          factory_address?: string | null
          first_seen_at?: string | null
          id?: string
          launch_timestamp?: string
          logo_url?: string | null
          metadata_uri?: string | null
          name?: string
          platform?: Database["public"]["Enums"]["token_platform"]
          source?: Database["public"]["Enums"]["token_source"]
          symbol?: string
          token_stage?: Database["public"]["Enums"]["token_stage"]
          total_supply?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: string
          chain: string
          created_at: string
          id: string
          payment_amount: string
          payment_token: string
          token_address: string
          token_name: string | null
          token_symbol: string
          tx_hash: string
          type: string
          wallet_address: string
        }
        Insert: {
          amount: string
          chain?: string
          created_at?: string
          id?: string
          payment_amount: string
          payment_token: string
          token_address: string
          token_name?: string | null
          token_symbol: string
          tx_hash: string
          type: string
          wallet_address: string
        }
        Update: {
          amount?: string
          chain?: string
          created_at?: string
          id?: string
          payment_amount?: string
          payment_token?: string
          token_address?: string
          token_name?: string | null
          token_symbol?: string
          tx_hash?: string
          type?: string
          wallet_address?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          ens_name: string | null
          id: string
          last_seen_at: string | null
          updated_at: string
          wallet_address: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          ens_name?: string | null
          id?: string
          last_seen_at?: string | null
          updated_at?: string
          wallet_address: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          ens_name?: string | null
          id?: string
          last_seen_at?: string | null
          updated_at?: string
          wallet_address?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      token_platform: "Zora" | "Clanker" | "Flaunch" | "Mint Club" | "Custom"
      token_source:
        | "zora_ws"
        | "zora_backfill"
        | "dex"
        | "bytecode_scan"
        | "manual"
      token_stage:
        | "created"
        | "discovered"
        | "priced"
        | "liquid"
        | "traded"
        | "dead"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      token_platform: ["Zora", "Clanker", "Flaunch", "Mint Club", "Custom"],
      token_source: [
        "zora_ws",
        "zora_backfill",
        "dex",
        "bytecode_scan",
        "manual",
      ],
      token_stage: [
        "created",
        "discovered",
        "priced",
        "liquid",
        "traded",
        "dead",
      ],
    },
  },
} as const
