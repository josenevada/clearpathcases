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
      case_extracted_data: {
        Row: {
          case_id: string
          confidence: string | null
          conflict_detected: boolean | null
          conflict_sources: string[] | null
          extracted_at: string | null
          field_key: string
          field_label: string
          field_value: string | null
          form_reference: string
          id: string
          manually_overridden: boolean | null
          notes: string | null
          override_at: string | null
          override_by: string | null
          override_value: string | null
          section_label: string
          source_document_name: string | null
          source_file_id: string | null
        }
        Insert: {
          case_id: string
          confidence?: string | null
          conflict_detected?: boolean | null
          conflict_sources?: string[] | null
          extracted_at?: string | null
          field_key: string
          field_label: string
          field_value?: string | null
          form_reference: string
          id?: string
          manually_overridden?: boolean | null
          notes?: string | null
          override_at?: string | null
          override_by?: string | null
          override_value?: string | null
          section_label: string
          source_document_name?: string | null
          source_file_id?: string | null
        }
        Update: {
          case_id?: string
          confidence?: string | null
          conflict_detected?: boolean | null
          conflict_sources?: string[] | null
          extracted_at?: string | null
          field_key?: string
          field_label?: string
          field_value?: string | null
          form_reference?: string
          id?: string
          manually_overridden?: boolean | null
          notes?: string | null
          override_at?: string | null
          override_by?: string | null
          override_value?: string | null
          section_label?: string
          source_document_name?: string | null
          source_file_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_extracted_data_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_extracted_data_override_by_fkey"
            columns: ["override_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_extracted_data_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "files"
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
          closed_at: string | null
          court_case_number: string | null
          created_at: string | null
          district: string | null
          filing_deadline: string
          firm_id: string | null
          id: string
          last_client_activity: string | null
          meeting_date: string | null
          ready_to_file: boolean | null
          retention_delete_scheduled_at: string | null
          retention_notified_at: string | null
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
          closed_at?: string | null
          court_case_number?: string | null
          created_at?: string | null
          district?: string | null
          filing_deadline: string
          firm_id?: string | null
          id?: string
          last_client_activity?: string | null
          meeting_date?: string | null
          ready_to_file?: boolean | null
          retention_delete_scheduled_at?: string | null
          retention_notified_at?: string | null
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
          closed_at?: string | null
          court_case_number?: string | null
          created_at?: string | null
          district?: string | null
          filing_deadline?: string
          firm_id?: string | null
          id?: string
          last_client_activity?: string | null
          meeting_date?: string | null
          ready_to_file?: boolean | null
          retention_delete_scheduled_at?: string | null
          retention_notified_at?: string | null
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
      document_validation_feedback: {
        Row: {
          additional_notes: string | null
          ai_result: string
          case_id: string
          correct_document_type: string | null
          created_at: string | null
          expected_document_type: string
          file_id: string
          id: string
          paralegal_feedback: string
          paralegal_id: string | null
        }
        Insert: {
          additional_notes?: string | null
          ai_result: string
          case_id: string
          correct_document_type?: string | null
          created_at?: string | null
          expected_document_type: string
          file_id: string
          id?: string
          paralegal_feedback: string
          paralegal_id?: string | null
        }
        Update: {
          additional_notes?: string | null
          ai_result?: string
          case_id?: string
          correct_document_type?: string | null
          created_at?: string | null
          expected_document_type?: string
          file_id?: string
          id?: string
          paralegal_feedback?: string
          paralegal_id?: string | null
        }
        Relationships: []
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
      form_extraction_runs: {
        Row: {
          case_id: string
          completed_at: string | null
          conflicts_detected: number | null
          error_message: string | null
          fields_extracted: number | null
          fields_high_confidence: number | null
          fields_low_confidence: number | null
          fields_medium_confidence: number | null
          id: string
          started_at: string | null
          status: string | null
          trigger_type: string | null
          triggered_by: string | null
        }
        Insert: {
          case_id: string
          completed_at?: string | null
          conflicts_detected?: number | null
          error_message?: string | null
          fields_extracted?: number | null
          fields_high_confidence?: number | null
          fields_low_confidence?: number | null
          fields_medium_confidence?: number | null
          id?: string
          started_at?: string | null
          status?: string | null
          trigger_type?: string | null
          triggered_by?: string | null
        }
        Update: {
          case_id?: string
          completed_at?: string | null
          conflicts_detected?: number | null
          error_message?: string | null
          fields_extracted?: number | null
          fields_high_confidence?: number | null
          fields_low_confidence?: number | null
          fields_medium_confidence?: number | null
          id?: string
          started_at?: string | null
          status?: string | null
          trigger_type?: string | null
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_extraction_runs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_extraction_runs_triggered_by_fkey"
            columns: ["triggered_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_federal_forms: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          case_id: string
          form_code: string
          form_title: string
          generated_at: string | null
          id: string
          included_in_packet: boolean | null
          storage_path: string
          version: number | null
          watermark_status: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          case_id: string
          form_code: string
          form_title: string
          generated_at?: string | null
          id?: string
          included_in_packet?: boolean | null
          storage_path: string
          version?: number | null
          watermark_status?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          case_id?: string
          form_code?: string
          form_title?: string
          generated_at?: string | null
          id?: string
          included_in_packet?: boolean | null
          storage_path?: string
          version?: number | null
          watermark_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_federal_forms_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_federal_forms_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      means_test_calculations: {
        Row: {
          annualized_income: number | null
          attorney_notes: string | null
          attorney_reviewed: boolean | null
          attorney_reviewed_at: string | null
          attorney_reviewed_by: string | null
          below_median: boolean | null
          calculation_window_end: string | null
          calculation_window_start: string | null
          case_id: string
          ch13_recommended: boolean | null
          client_state: string | null
          created_at: string | null
          eligibility_notes: string | null
          eligibility_result: string | null
          filing_date: string | null
          household_size: number | null
          id: string
          local_standard_housing: number | null
          local_standard_utilities: number | null
          local_standard_vehicle_operation: number | null
          local_standard_vehicle_ownership: number | null
          monthly_disposable_income: number | null
          monthly_gross_wages: number | null
          monthly_interest_dividends: number | null
          monthly_net_business: number | null
          monthly_other_income: number | null
          monthly_pension_retirement: number | null
          monthly_rental_income: number | null
          monthly_social_security: number | null
          monthly_unemployment: number | null
          national_standard_food_clothing: number | null
          national_standard_healthcare: number | null
          other_necessary_expenses: number | null
          presumption_arises: boolean | null
          priority_debt_payments: number | null
          secured_debt_payments: number | null
          state_median_income: number | null
          total_allowed_deductions: number | null
          total_current_monthly_income: number | null
          updated_at: string | null
        }
        Insert: {
          annualized_income?: number | null
          attorney_notes?: string | null
          attorney_reviewed?: boolean | null
          attorney_reviewed_at?: string | null
          attorney_reviewed_by?: string | null
          below_median?: boolean | null
          calculation_window_end?: string | null
          calculation_window_start?: string | null
          case_id: string
          ch13_recommended?: boolean | null
          client_state?: string | null
          created_at?: string | null
          eligibility_notes?: string | null
          eligibility_result?: string | null
          filing_date?: string | null
          household_size?: number | null
          id?: string
          local_standard_housing?: number | null
          local_standard_utilities?: number | null
          local_standard_vehicle_operation?: number | null
          local_standard_vehicle_ownership?: number | null
          monthly_disposable_income?: number | null
          monthly_gross_wages?: number | null
          monthly_interest_dividends?: number | null
          monthly_net_business?: number | null
          monthly_other_income?: number | null
          monthly_pension_retirement?: number | null
          monthly_rental_income?: number | null
          monthly_social_security?: number | null
          monthly_unemployment?: number | null
          national_standard_food_clothing?: number | null
          national_standard_healthcare?: number | null
          other_necessary_expenses?: number | null
          presumption_arises?: boolean | null
          priority_debt_payments?: number | null
          secured_debt_payments?: number | null
          state_median_income?: number | null
          total_allowed_deductions?: number | null
          total_current_monthly_income?: number | null
          updated_at?: string | null
        }
        Update: {
          annualized_income?: number | null
          attorney_notes?: string | null
          attorney_reviewed?: boolean | null
          attorney_reviewed_at?: string | null
          attorney_reviewed_by?: string | null
          below_median?: boolean | null
          calculation_window_end?: string | null
          calculation_window_start?: string | null
          case_id?: string
          ch13_recommended?: boolean | null
          client_state?: string | null
          created_at?: string | null
          eligibility_notes?: string | null
          eligibility_result?: string | null
          filing_date?: string | null
          household_size?: number | null
          id?: string
          local_standard_housing?: number | null
          local_standard_utilities?: number | null
          local_standard_vehicle_operation?: number | null
          local_standard_vehicle_ownership?: number | null
          monthly_disposable_income?: number | null
          monthly_gross_wages?: number | null
          monthly_interest_dividends?: number | null
          monthly_net_business?: number | null
          monthly_other_income?: number | null
          monthly_pension_retirement?: number | null
          monthly_rental_income?: number | null
          monthly_social_security?: number | null
          monthly_unemployment?: number | null
          national_standard_food_clothing?: number | null
          national_standard_healthcare?: number | null
          other_necessary_expenses?: number | null
          presumption_arises?: boolean | null
          priority_debt_payments?: number | null
          secured_debt_payments?: number | null
          state_median_income?: number | null
          total_allowed_deductions?: number | null
          total_current_monthly_income?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "means_test_calculations_attorney_reviewed_by_fkey"
            columns: ["attorney_reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "means_test_calculations_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      means_test_income_months: {
        Row: {
          business_income: number | null
          calculation_id: string
          created_at: string | null
          flagged_missing: boolean | null
          has_coverage: boolean | null
          id: string
          month_label: string
          month_year: string
          other_income: number | null
          source_documents: string[] | null
          total_month: number | null
          wages: number | null
        }
        Insert: {
          business_income?: number | null
          calculation_id: string
          created_at?: string | null
          flagged_missing?: boolean | null
          has_coverage?: boolean | null
          id?: string
          month_label: string
          month_year: string
          other_income?: number | null
          source_documents?: string[] | null
          total_month?: number | null
          wages?: number | null
        }
        Update: {
          business_income?: number | null
          calculation_id?: string
          created_at?: string | null
          flagged_missing?: boolean | null
          has_coverage?: boolean | null
          id?: string
          month_label?: string
          month_year?: string
          other_income?: number | null
          source_documents?: string[] | null
          total_month?: number | null
          wages?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "means_test_income_months_calculation_id_fkey"
            columns: ["calculation_id"]
            isOneToOne: false
            referencedRelation: "means_test_calculations"
            referencedColumns: ["id"]
          },
        ]
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
      packet_history: {
        Row: {
          case_id: string
          chapter: string | null
          created_at: string
          district: string | null
          document_count: number
          generated_at: string
          generated_by: string | null
          id: string
          ssn_redactions_count: number | null
          storage_path: string | null
        }
        Insert: {
          case_id: string
          chapter?: string | null
          created_at?: string
          district?: string | null
          document_count?: number
          generated_at?: string
          generated_by?: string | null
          id?: string
          ssn_redactions_count?: number | null
          storage_path?: string | null
        }
        Update: {
          case_id?: string
          chapter?: string | null
          created_at?: string
          district?: string | null
          document_count?: number
          generated_at?: string
          generated_by?: string | null
          id?: string
          ssn_redactions_count?: number | null
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "packet_history_case_id_fkey"
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
