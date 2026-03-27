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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          actor_name: string | null
          actor_role: string | null
          case_id: string
          created_at: string | null
          description: string | null
          event_type: string
          id: string
          item_id: string | null
        }
        Insert: {
          actor_name?: string | null
          actor_role?: string | null
          case_id: string
          created_at?: string | null
          description?: string | null
          event_type: string
          id?: string
          item_id?: string | null
        }
        Update: {
          actor_name?: string | null
          actor_role?: string | null
          case_id?: string
          created_at?: string | null
          description?: string | null
          event_type?: string
          id?: string
          item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      attorney_notes: {
        Row: {
          case_id: string
          content: string | null
          id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          case_id: string
          content?: string | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          case_id?: string
          content?: string | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attorney_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          assigned_attorney: string | null
          assigned_attorney_id: string | null
          assigned_paralegal: string | null
          assigned_paralegal_id: string | null
          case_code: string | null
          chapter_type: string
          client_dob: string | null
          client_email: string
          client_name: string
          client_phone: string | null
          created_at: string | null
          filing_deadline: string
          firm_id: string | null
          id: string
          last_client_activity: string | null
          ready_to_file: boolean | null
          status: string
          urgency: string | null
          wizard_step: number | null
        }
        Insert: {
          assigned_attorney?: string | null
          assigned_attorney_id?: string | null
          assigned_paralegal?: string | null
          assigned_paralegal_id?: string | null
          case_code?: string | null
          chapter_type: string
          client_dob?: string | null
          client_email: string
          client_name: string
          client_phone?: string | null
          created_at?: string | null
          filing_deadline: string
          firm_id?: string | null
          id?: string
          last_client_activity?: string | null
          ready_to_file?: boolean | null
          status?: string
          urgency?: string | null
          wizard_step?: number | null
        }
        Update: {
          assigned_attorney?: string | null
          assigned_attorney_id?: string | null
          assigned_paralegal?: string | null
          assigned_paralegal_id?: string | null
          case_code?: string | null
          chapter_type?: string
          client_dob?: string | null
          client_email?: string
          client_name?: string
          client_phone?: string | null
          created_at?: string | null
          filing_deadline?: string
          firm_id?: string | null
          id?: string
          last_client_activity?: string | null
          ready_to_file?: boolean | null
          status?: string
          urgency?: string | null
          wizard_step?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cases_assigned_attorney_id_fkey"
            columns: ["assigned_attorney_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_assigned_paralegal_id_fkey"
            columns: ["assigned_paralegal_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          attorney_note: string | null
          case_id: string
          category: string
          completed: boolean | null
          correction_details: string | null
          correction_reason: string | null
          correction_requested_at: string | null
          correction_requested_by: string | null
          correction_status: string | null
          correction_target_file_id: string | null
          description: string | null
          flagged_for_attorney: boolean | null
          id: string
          input_type: string | null
          label: string
          not_applicable: boolean | null
          not_applicable_at: string | null
          not_applicable_marked_by: string | null
          not_applicable_reason: string | null
          required: boolean | null
          resubmitted_at: string | null
          sort_order: number | null
          text_value: Json | null
          why_we_need_this: string | null
        }
        Insert: {
          attorney_note?: string | null
          case_id: string
          category: string
          completed?: boolean | null
          correction_details?: string | null
          correction_reason?: string | null
          correction_requested_at?: string | null
          correction_requested_by?: string | null
          correction_status?: string | null
          correction_target_file_id?: string | null
          description?: string | null
          flagged_for_attorney?: boolean | null
          id?: string
          input_type?: string | null
          label: string
          not_applicable?: boolean | null
          not_applicable_at?: string | null
          not_applicable_marked_by?: string | null
          not_applicable_reason?: string | null
          required?: boolean | null
          resubmitted_at?: string | null
          sort_order?: number | null
          text_value?: Json | null
          why_we_need_this?: string | null
        }
        Update: {
          attorney_note?: string | null
          case_id?: string
          category?: string
          completed?: boolean | null
          correction_details?: string | null
          correction_reason?: string | null
          correction_requested_at?: string | null
          correction_requested_by?: string | null
          correction_status?: string | null
          correction_target_file_id?: string | null
          description?: string | null
          flagged_for_attorney?: boolean | null
          id?: string
          input_type?: string | null
          label?: string
          not_applicable?: boolean | null
          not_applicable_at?: string | null
          not_applicable_marked_by?: string | null
          not_applicable_reason?: string | null
          required?: boolean | null
          resubmitted_at?: string | null
          sort_order?: number | null
          text_value?: Json | null
          why_we_need_this?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      checkpoints: {
        Row: {
          case_id: string
          checkpoint_type: string
          completed_at: string | null
          confirmed_by: string | null
          id: string
        }
        Insert: {
          case_id: string
          checkpoint_type: string
          completed_at?: string | null
          confirmed_by?: string | null
          id?: string
        }
        Update: {
          case_id?: string
          checkpoint_type?: string
          completed_at?: string | null
          confirmed_by?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkpoints_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      client_info: {
        Row: {
          avg_monthly_income: number | null
          business_name: string | null
          business_type: string | null
          case_id: string
          created_at: string | null
          current_address: string | null
          date_last_employment: string | null
          date_of_birth: string | null
          email: string | null
          employer_address: string | null
          employer_name: string | null
          employment_status: string | null
          expense_food: number | null
          expense_insurance: number | null
          expense_other: number | null
          expense_rent: number | null
          expense_transportation: number | null
          expense_utilities: number | null
          full_legal_name: string | null
          household_size: number | null
          id: string
          job_title: string | null
          last_employer_name: string | null
          marital_status: string | null
          monthly_gross_income: number | null
          num_dependents: number | null
          other_expenses_description: string | null
          pay_frequency: string | null
          phone: string | null
          ssn_encrypted: string | null
          updated_at: string | null
        }
        Insert: {
          avg_monthly_income?: number | null
          business_name?: string | null
          business_type?: string | null
          case_id: string
          created_at?: string | null
          current_address?: string | null
          date_last_employment?: string | null
          date_of_birth?: string | null
          email?: string | null
          employer_address?: string | null
          employer_name?: string | null
          employment_status?: string | null
          expense_food?: number | null
          expense_insurance?: number | null
          expense_other?: number | null
          expense_rent?: number | null
          expense_transportation?: number | null
          expense_utilities?: number | null
          full_legal_name?: string | null
          household_size?: number | null
          id?: string
          job_title?: string | null
          last_employer_name?: string | null
          marital_status?: string | null
          monthly_gross_income?: number | null
          num_dependents?: number | null
          other_expenses_description?: string | null
          pay_frequency?: string | null
          phone?: string | null
          ssn_encrypted?: string | null
          updated_at?: string | null
        }
        Update: {
          avg_monthly_income?: number | null
          business_name?: string | null
          business_type?: string | null
          case_id?: string
          created_at?: string | null
          current_address?: string | null
          date_last_employment?: string | null
          date_of_birth?: string | null
          email?: string | null
          employer_address?: string | null
          employer_name?: string | null
          employment_status?: string | null
          expense_food?: number | null
          expense_insurance?: number | null
          expense_other?: number | null
          expense_rent?: number | null
          expense_transportation?: number | null
          expense_utilities?: number | null
          full_legal_name?: string | null
          household_size?: number | null
          id?: string
          job_title?: string | null
          last_employer_name?: string | null
          marital_status?: string | null
          monthly_gross_income?: number | null
          num_dependents?: number | null
          other_expenses_description?: string | null
          pay_frequency?: string | null
          phone?: string | null
          ssn_encrypted?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_info_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          case_id: string
          checklist_item_id: string
          data_url: string | null
          file_name: string
          id: string
          review_note: string | null
          review_status: string | null
          storage_path: string | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          case_id: string
          checklist_item_id: string
          data_url?: string | null
          file_name: string
          id?: string
          review_note?: string | null
          review_status?: string | null
          storage_path?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          case_id?: string
          checklist_item_id?: string
          data_url?: string | null
          file_name?: string
          id?: string
          review_note?: string | null
          review_status?: string | null
          storage_path?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "files_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
        ]
      }
      firms: {
        Row: {
          created_at: string | null
          default_attorney: string | null
          default_paralegal: string | null
          id: string
          name: string
          phone: string | null
          plan_name: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          slug: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          trial_ends_at: string | null
        }
        Insert: {
          created_at?: string | null
          default_attorney?: string | null
          default_paralegal?: string | null
          id?: string
          name?: string
          phone?: string | null
          plan_name?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          slug?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
        }
        Update: {
          created_at?: string | null
          default_attorney?: string | null
          default_paralegal?: string | null
          id?: string
          name?: string
          phone?: string | null
          plan_name?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          slug?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
        }
        Relationships: []
      }
      notes: {
        Row: {
          author_name: string | null
          author_role: string | null
          case_id: string
          content: string | null
          created_at: string | null
          id: string
          visibility: string | null
        }
        Insert: {
          author_name?: string | null
          author_role?: string | null
          case_id: string
          content?: string | null
          created_at?: string | null
          id?: string
          visibility?: string | null
        }
        Update: {
          author_name?: string | null
          author_role?: string | null
          case_id?: string
          content?: string | null
          created_at?: string | null
          id?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          accepted_at: string | null
          email: string
          firm_id: string
          id: string
          invited_at: string | null
          invited_by: string | null
          personal_message: string | null
          role: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          email: string
          firm_id: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          personal_message?: string | null
          role?: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          email?: string
          firm_id?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          personal_message?: string | null
          role?: string
          status?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          firm_id: string | null
          full_name: string
          id: string
          last_sign_in: string | null
          role: string
        }
        Insert: {
          created_at?: string | null
          email: string
          firm_id?: string | null
          full_name: string
          id?: string
          last_sign_in?: string | null
          role: string
        }
        Update: {
          created_at?: string | null
          email?: string
          firm_id?: string | null
          full_name?: string
          id?: string
          last_sign_in?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_firm_case_ids: { Args: never; Returns: string[] }
      get_user_firm_id: { Args: never; Returns: string }
      is_super_admin: { Args: never; Returns: boolean }
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
