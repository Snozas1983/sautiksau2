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
      availability_slots: {
        Row: {
          created_at: string
          date: string
          end_time: string
          id: string
          is_available: boolean
          start_time: string
        }
        Insert: {
          created_at?: string
          date: string
          end_time: string
          id?: string
          is_available?: boolean
          start_time: string
        }
        Update: {
          created_at?: string
          date?: string
          end_time?: string
          id?: string
          is_available?: boolean
          start_time?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          date: string | null
          end_time: string | null
          google_calendar_event_id: string | null
          google_calendar_source: boolean | null
          id: string
          is_system_booking: boolean
          manage_token: string | null
          promo_code: string | null
          service_id: string
          slot_id: string | null
          start_time: string | null
          status: string
          system_action_day: number | null
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          date?: string | null
          end_time?: string | null
          google_calendar_event_id?: string | null
          google_calendar_source?: boolean | null
          id?: string
          is_system_booking?: boolean
          manage_token?: string | null
          promo_code?: string | null
          service_id: string
          slot_id?: string | null
          start_time?: string | null
          status?: string
          system_action_day?: number | null
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          date?: string | null
          end_time?: string | null
          google_calendar_event_id?: string | null
          google_calendar_source?: boolean | null
          id?: string
          is_system_booking?: boolean
          manage_token?: string | null
          promo_code?: string | null
          service_id?: string
          slot_id?: string | null
          start_time?: string | null
          status?: string
          system_action_day?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "availability_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          blacklist_reason: string | null
          created_at: string
          email: string | null
          id: string
          is_blacklisted: boolean
          name: string | null
          no_show_count: number
          phone: string
          updated_at: string
        }
        Insert: {
          blacklist_reason?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_blacklisted?: boolean
          name?: string | null
          no_show_count?: number
          phone: string
          updated_at?: string
        }
        Update: {
          blacklist_reason?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_blacklisted?: boolean
          name?: string | null
          no_show_count?: number
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      google_calendar_tokens: {
        Row: {
          access_token: string
          calendar_id: string | null
          created_at: string
          expires_at: string
          id: string
          refresh_token: string
          updated_at: string
        }
        Insert: {
          access_token: string
          calendar_id?: string | null
          created_at?: string
          expires_at: string
          id?: string
          refresh_token: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          calendar_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          subject: string | null
          type: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          subject?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          subject?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string
          discount_percent: number
          id: string
          is_active: boolean
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string
          discount_percent: number
          id?: string
          is_active?: boolean
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          discount_percent?: number
          id?: string
          is_active?: boolean
          valid_until?: string | null
        }
        Relationships: []
      }
      schedule_exceptions: {
        Row: {
          created_at: string
          date: string | null
          day_of_week: number | null
          description: string | null
          end_date: string | null
          end_time: string
          exception_type: string
          id: string
          is_recurring: boolean
          start_time: string
        }
        Insert: {
          created_at?: string
          date?: string | null
          day_of_week?: number | null
          description?: string | null
          end_date?: string | null
          end_time: string
          exception_type: string
          id?: string
          is_recurring?: boolean
          start_time: string
        }
        Update: {
          created_at?: string
          date?: string | null
          day_of_week?: number | null
          description?: string | null
          end_date?: string | null
          end_time?: string
          exception_type?: string
          id?: string
          is_recurring?: boolean
          start_time?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          created_at: string
          description: string | null
          duration: number
          id: string
          is_active: boolean
          name: string
          preparation_time: number | null
          price: number
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration: number
          id?: string
          is_active?: boolean
          name: string
          preparation_time?: number | null
          price: number
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          duration?: number
          id?: string
          is_active?: boolean
          name?: string
          preparation_time?: number | null
          price?: number
          sort_order?: number | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
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
      [_ in never]: never
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
    Enums: {},
  },
} as const
