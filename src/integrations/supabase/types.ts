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
      certificates: {
        Row: {
          certificate_number: string
          certificate_type: string
          certificate_url: string | null
          id: string
          issued_at: string
          kit_id: string | null
          learner_name: string
          program_id: string | null
          program_title: string
          score: number | null
          test_attempt_id: string | null
          user_id: string
        }
        Insert: {
          certificate_number: string
          certificate_type?: string
          certificate_url?: string | null
          id?: string
          issued_at?: string
          kit_id?: string | null
          learner_name: string
          program_id?: string | null
          program_title: string
          score?: number | null
          test_attempt_id?: string | null
          user_id: string
        }
        Update: {
          certificate_number?: string
          certificate_type?: string
          certificate_url?: string | null
          id?: string
          issued_at?: string
          kit_id?: string | null
          learner_name?: string
          program_id?: string | null
          program_title?: string
          score?: number | null
          test_attempt_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_test_attempt_id_fkey"
            columns: ["test_attempt_id"]
            isOneToOne: false
            referencedRelation: "test_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      content_blocks: {
        Row: {
          block_order: number
          block_type: Database["public"]["Enums"]["content_block_type"]
          code_language: string | null
          content: string | null
          created_at: string
          id: string
          image_url: string | null
          metadata: Json | null
          session_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          block_order?: number
          block_type?: Database["public"]["Enums"]["content_block_type"]
          code_language?: string | null
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          metadata?: Json | null
          session_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          block_order?: number
          block_type?: Database["public"]["Enums"]["content_block_type"]
          code_language?: string | null
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          metadata?: Json | null
          session_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_blocks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      kits: {
        Row: {
          category: Database["public"]["Enums"]["kit_category"]
          created_at: string
          deleted_at: string | null
          description: string | null
          difficulty_level:
            | Database["public"]["Enums"]["difficulty_level"]
            | null
          id: string
          image_url: string | null
          name: string
          total_sessions: number | null
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["kit_category"]
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          difficulty_level?:
            | Database["public"]["Enums"]["difficulty_level"]
            | null
          id?: string
          image_url?: string | null
          name: string
          total_sessions?: number | null
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["kit_category"]
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          difficulty_level?:
            | Database["public"]["Enums"]["difficulty_level"]
            | null
          id?: string
          image_url?: string | null
          name?: string
          total_sessions?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      personalized_content: {
        Row: {
          created_at: string
          id: string
          original_block_id: string
          personalized_text: string
          session_id: string
          skill_level: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          original_block_id: string
          personalized_text: string
          session_id: string
          skill_level: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          original_block_id?: string
          personalized_text?: string
          session_id?: string
          skill_level?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personalized_content_original_block_id_fkey"
            columns: ["original_block_id"]
            isOneToOne: false
            referencedRelation: "content_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personalized_content_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      program_tests: {
        Row: {
          created_at: string
          description: string | null
          id: string
          kit_id: string | null
          passing_score: number
          program_id: string | null
          questions: Json
          time_limit_mins: number | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          kit_id?: string | null
          passing_score?: number
          program_id?: string | null
          questions?: Json
          time_limit_mins?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          kit_id?: string | null
          passing_score?: number
          program_id?: string | null
          questions?: Json
          time_limit_mins?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_tests_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_tests_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          category: Database["public"]["Enums"]["content_category"] | null
          created_at: string
          description: string | null
          difficulty_level: string | null
          estimated_hours: number | null
          id: string
          image_url: string | null
          kit_id: string | null
          title: string
          total_sessions: number | null
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["content_category"] | null
          created_at?: string
          description?: string | null
          difficulty_level?: string | null
          estimated_hours?: number | null
          id?: string
          image_url?: string | null
          kit_id?: string | null
          title: string
          total_sessions?: number | null
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["content_category"] | null
          created_at?: string
          description?: string | null
          difficulty_level?: string | null
          estimated_hours?: number | null
          id?: string
          image_url?: string | null
          kit_id?: string | null
          title?: string
          total_sessions?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "kits"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          category: Database["public"]["Enums"]["content_category"] | null
          circuit_diagram_url: string | null
          code: string | null
          code_language: string | null
          components: Json | null
          created_at: string
          description: string | null
          difficulty_level:
            | Database["public"]["Enums"]["difficulty_level"]
            | null
          id: string
          image_url: string | null
          name: string
          simulation_url: string | null
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["content_category"] | null
          circuit_diagram_url?: string | null
          code?: string | null
          code_language?: string | null
          components?: Json | null
          created_at?: string
          description?: string | null
          difficulty_level?:
            | Database["public"]["Enums"]["difficulty_level"]
            | null
          id?: string
          image_url?: string | null
          name: string
          simulation_url?: string | null
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["content_category"] | null
          circuit_diagram_url?: string | null
          code?: string | null
          code_language?: string | null
          components?: Json | null
          created_at?: string
          description?: string | null
          difficulty_level?:
            | Database["public"]["Enums"]["difficulty_level"]
            | null
          id?: string
          image_url?: string | null
          name?: string
          simulation_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      session_progress: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          id: string
          last_accessed_at: string
          progress_percentage: number | null
          session_id: string
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          id?: string
          last_accessed_at?: string
          progress_percentage?: number | null
          session_id: string
          user_id: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          id?: string
          last_accessed_at?: string
          progress_percentage?: number | null
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_progress_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_quiz_attempts: {
        Row: {
          answers: Json
          completed_at: string | null
          created_at: string
          id: string
          passed: boolean
          program_id: string
          questions: Json
          score: number
          session_id: string
          total_questions: number
          user_id: string
        }
        Insert: {
          answers?: Json
          completed_at?: string | null
          created_at?: string
          id?: string
          passed?: boolean
          program_id: string
          questions?: Json
          score?: number
          session_id: string
          total_questions?: number
          user_id: string
        }
        Update: {
          answers?: Json
          completed_at?: string | null
          created_at?: string
          id?: string
          passed?: boolean
          program_id?: string
          questions?: Json
          score?: number
          session_id?: string
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_quiz_attempts_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_quiz_attempts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_quizzes: {
        Row: {
          created_at: string
          id: string
          passing_score: number
          questions: Json
          session_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          passing_score?: number
          questions?: Json
          session_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          passing_score?: number
          questions?: Json
          session_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_quizzes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          }
        ]
      }
      sessions: {
        Row: {
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          is_free: boolean | null
          program_id: string
          session_order: number
          simulation_url: string | null
          title: string
          updated_at: string
          xp_cost: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_free?: boolean | null
          program_id: string
          session_order?: number
          simulation_url?: string | null
          title: string
          updated_at?: string
          xp_cost?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_free?: boolean | null
          program_id?: string
          session_order?: number
          simulation_url?: string | null
          title?: string
          updated_at?: string
          xp_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      test_attempts: {
        Row: {
          answers: Json
          completed_at: string | null
          id: string
          passed: boolean
          score: number
          started_at: string
          test_id: string
          user_id: string
        }
        Insert: {
          answers?: Json
          completed_at?: string | null
          id?: string
          passed?: boolean
          score?: number
          started_at?: string
          test_id: string
          user_id: string
        }
        Update: {
          answers?: Json
          completed_at?: string | null
          id?: string
          passed?: boolean
          score?: number
          started_at?: string
          test_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_attempts_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "program_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      unlock_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          device_fingerprint: string | null
          expires_at: string | null
          id: string
          ip_address: string | null
          is_used: boolean | null
          kit_id: string | null
          program_id: string | null
          redeemed_at: string | null
          redeemed_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          device_fingerprint?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          is_used?: boolean | null
          kit_id?: string | null
          program_id?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          device_fingerprint?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          is_used?: boolean | null
          kit_id?: string | null
          program_id?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unlock_codes_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unlock_codes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_assessments: {
        Row: {
          answers: Json
          created_at: string
          id: string
          program_id: string
          skill_level: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          id?: string
          program_id: string
          skill_level?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: string
          program_id?: string
          skill_level?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_assessments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_program_access: {
        Row: {
          id: string
          program_id: string
          unlock_code_id: string | null
          unlocked_at: string
          user_id: string
        }
        Insert: {
          id?: string
          program_id: string
          unlock_code_id?: string | null
          unlocked_at?: string
          user_id: string
        }
        Update: {
          id?: string
          program_id?: string
          unlock_code_id?: string | null
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_program_access_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_program_access_unlock_code_id_fkey"
            columns: ["unlock_code_id"]
            isOneToOne: false
            referencedRelation: "unlock_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_devices: {
        Row: {
          created_at: string
          device_label: string | null
          fingerprint: string
          id: string
          ip_address: string | null
          is_revoked: boolean | null
          last_sign_in_at: string | null
          sign_in_count: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_label?: string | null
          fingerprint: string
          id?: string
          ip_address?: string | null
          is_revoked?: boolean | null
          last_sign_in_at?: string | null
          sign_in_count?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_label?: string | null
          fingerprint?: string
          id?: string
          ip_address?: string | null
          is_revoked?: boolean | null
          last_sign_in_at?: string | null
          sign_in_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      user_xp: {
        Row: {
          id: string
          user_id: string
          total_xp: number
          level: number
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          total_xp?: number
          level?: number
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          total_xp?: number
          level?: number
          updated_at?: string
        }
        Relationships: []
      }
      xp_transactions: {
        Row: {
          id: string
          user_id: string
          amount: number
          reason: string
          reference_type: string | null
          reference_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          reason: string
          reference_type?: string | null
          reference_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          amount?: number
          reason?: string
          reference_type?: string | null
          reference_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      user_streaks: {
        Row: {
          id: string
          user_id: string
          current_streak: number
          longest_streak: number
          last_activity_date: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          current_streak?: number
          longest_streak?: number
          last_activity_date?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          current_streak?: number
          longest_streak?: number
          last_activity_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      daily_logins: {
        Row: {
          id: string
          user_id: string
          login_date: string
          xp_awarded: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          login_date: string
          xp_awarded?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          login_date?: string
          xp_awarded?: number | null
          created_at?: string
        }
        Relationships: []
      }
      badges: {
        Row: {
          id: string
          name: string
          description: string | null
          icon: string | null
          xp_required: number | null
          criteria: Json | null
          is_active: boolean | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          icon?: string | null
          xp_required?: number | null
          criteria?: Json | null
          is_active?: boolean | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          icon?: string | null
          xp_required?: number | null
          criteria?: Json | null
          is_active?: boolean | null
          created_at?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          id: string
          user_id: string
          badge_id: string
          earned_at: string
        }
        Insert: {
          id?: string
          user_id: string
          badge_id: string
          earned_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          badge_id?: string
          earned_at?: string
        }
        Relationships: []
      }
      store_items: {
        Row: {
          id: string
          name: string
          description: string | null
          xp_cost: number
          image_url: string | null
          stock: number | null
          is_active: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          xp_cost: number
          image_url?: string | null
          stock?: number | null
          is_active?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          xp_cost?: number
          image_url?: string | null
          stock?: number | null
          is_active?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      redemptions: {
        Row: {
          id: string
          user_id: string
          item_id: string
          xp_spent: number
          status: string
          created_at: string
          fulfilled_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          item_id: string
          xp_spent: number
          status?: string
          created_at?: string
          fulfilled_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          item_id?: string
          xp_spent?: number
          status?: string
          created_at?: string
          fulfilled_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_instructor: { Args: { _user_id: string }; Returns: boolean }
      lookup_unlock_code: {
        Args: { p_code: string }
        Returns: {
          id: string
          program_id: string | null
          kit_id: string | null
          xp_reward: number | null
          is_used: boolean
          expires_at: string | null
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "instructor" | "learner"
      content_block_type:
        | "text"
        | "image"
        | "code"
        | "diagram"
        | "video"
        | "safety_note"
        | "tip"
        | "problem"
        | "solution"
        | "components"
        | "circuit_diagram"
        | "questions"
        | "feedback"
        | "introduction"
        | "simulation"
      content_category:
        | "robotics"
        | "iot"
        | "electronics"
        | "ai_ml"
        | "sensors"
        | "automation"
      difficulty_level: "beginner" | "intermediate" | "advanced"
      kit_category: "robotics" | "iot"
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
      app_role: ["admin", "instructor", "learner"],
      content_block_type: [
        "text",
        "image",
        "code",
        "diagram",
        "video",
        "safety_note",
        "tip",
        "problem",
        "solution",
        "components",
        "circuit_diagram",
        "questions",
        "feedback",
        "introduction",
        "simulation",
      ],
      content_category: [
        "robotics",
        "iot",
        "electronics",
        "ai_ml",
        "sensors",
        "automation",
      ],
      difficulty_level: ["beginner", "intermediate", "advanced"],
      kit_category: ["robotics", "iot"],
    },
  },
} as const
