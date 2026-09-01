export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          user_id: string
          email: string
          full_name: string
          first_name: string | null
          last_name: string | null
          role: string
          status: string
          zone_id: string | null
          phone: string | null
          affiliation: string | null
          department: string | null
          branch: string | null
          line_id: string | null
          budget_matching_fund: number
          budget_everysite: number
          used_matching_fund: number
          used_everysite: number
          pending_matching_fund: number
          pending_everysite: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          email: string
          full_name: string
          first_name?: string | null
          last_name?: string | null
          role?: string
          status?: string
          zone_id?: string | null
          phone?: string | null
          affiliation?: string | null
          department?: string | null
          branch?: string | null
          line_id?: string | null
          budget_matching_fund?: number
          budget_everysite?: number
          used_matching_fund?: number
          used_everysite?: number
          pending_matching_fund?: number
          pending_everysite?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          email?: string
          full_name?: string
          first_name?: string | null
          last_name?: string | null
          role?: string
          status?: string
          zone_id?: string | null
          phone?: string | null
          affiliation?: string | null
          department?: string | null
          branch?: string | null
          line_id?: string | null
          budget_matching_fund?: number
          budget_everysite?: number
          used_matching_fund?: number
          used_everysite?: number
          pending_matching_fund?: number
          pending_everysite?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      zones: {
        Row: {
          id: string
          name: string
          description: string | null
          sort_order: number | null
          total_budget: number
          used_budget: number
          remaining_budget: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          description?: string | null
          sort_order?: number | null
          total_budget?: number
          used_budget?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          sort_order?: number | null
          total_budget?: number
          used_budget?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      requests: {
        Row: {
          id: string
          requester_id: string
          zone_id: string | null
          title: string
          description: string | null
          amount: number
          status: string
          request_type: string | null
          size: string | null
          size_code: string | null
          requester_name: string | null
          requester_email: string | null
          department: string | null
          branch: string | null
          affiliation: string | null
          admin_notes: string | null
          zone_approver_notes: string | null
          final_notes: string | null
          rejected_reason: string | null
          pdf_url: string | null
          admin_at: string | null
          zone1_at: string | null
          zone2_at: string | null
          final_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          requester_id: string
          zone_id?: string | null
          title: string
          description?: string | null
          amount?: number
          status?: string
          request_type?: string | null
          size?: string | null
          size_code?: string | null
          requester_name?: string | null
          requester_email?: string | null
          department?: string | null
          branch?: string | null
          affiliation?: string | null
          admin_notes?: string | null
          zone_approver_notes?: string | null
          final_notes?: string | null
          rejected_reason?: string | null
          pdf_url?: string | null
          admin_at?: string | null
          zone1_at?: string | null
          zone2_at?: string | null
          final_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          requester_id?: string
          zone_id?: string | null
          title?: string
          description?: string | null
          amount?: number
          status?: string
          request_type?: string | null
          size?: string | null
          size_code?: string | null
          requester_name?: string | null
          requester_email?: string | null
          department?: string | null
          branch?: string | null
          affiliation?: string | null
          admin_notes?: string | null
          zone_approver_notes?: string | null
          final_notes?: string | null
          rejected_reason?: string | null
          pdf_url?: string | null
          admin_at?: string | null
          zone1_at?: string | null
          zone2_at?: string | null
          final_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      request_attachments: {
        Row: {
          id: string
          request_id: string
          file_name: string
          file_url: string
          file_type: string | null
          file_size: number | null
          created_at: string
        }
        Insert: {
          id?: string
          request_id: string
          file_name: string
          file_url: string
          file_type?: string | null
          file_size?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          request_id?: string
          file_name?: string
          file_url?: string
          file_type?: string | null
          file_size?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_attachments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          }
        ]
      }
      audit_logs: {
        Row: {
          id: string
          actor_id: string | null
          actor_name: string
          actor_role: string
          action: string
          target_type: string
          target_id: string | null
          detail: string | null
          created_at: string
        }
        Insert: {
          id?: string
          actor_id?: string | null
          actor_name: string
          actor_role: string
          action: string
          target_type: string
          target_id?: string | null
          detail?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          actor_id?: string | null
          actor_name?: string
          actor_role?: string
          action?: string
          target_type?: string
          target_id?: string | null
          detail?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      zones_public: {
        Row: {
          id: string | null
          name: string | null
          description: string | null
          sort_order: number | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          value: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          key: string
          value?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          key?: string
          value?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      generate_size_code: { Args: Record<string, never>; Returns: string }
      is_admin: { Args: Record<string, never>; Returns: boolean }
      is_approved: { Args: Record<string, never>; Returns: boolean }
      is_approver: { Args: Record<string, never>; Returns: boolean }
      my_role: { Args: Record<string, never>; Returns: string }
      my_status: { Args: Record<string, never>; Returns: string }
      my_profile_id: { Args: Record<string, never>; Returns: string }
      my_zone: { Args: Record<string, never>; Returns: string }
      transfer_matching_to_everysite: {
        Args: { p_amount: number }
        Returns: undefined
      }
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
