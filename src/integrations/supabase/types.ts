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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          created_at: string
          id: string
          kind: string
          message: string
          resident_id: string | null
          resolved: boolean
          severity: Database["public"]["Enums"]["alert_severity"]
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          message: string
          resident_id?: string | null
          resolved?: boolean
          severity?: Database["public"]["Enums"]["alert_severity"]
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          message?: string
          resident_id?: string | null
          resolved?: boolean
          severity?: Database["public"]["Enums"]["alert_severity"]
        }
        Relationships: [
          {
            foreignKeyName: "alerts_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      care_plan_history: {
        Row: {
          care_plan_id: string
          changed_at: string
          changed_by: string | null
          content: string | null
          domain: string
          id: string
          last_review: string | null
          needs: string | null
          outcome: string | null
          resident_id: string
          risks: string | null
        }
        Insert: {
          care_plan_id: string
          changed_at?: string
          changed_by?: string | null
          content?: string | null
          domain: string
          id?: string
          last_review?: string | null
          needs?: string | null
          outcome?: string | null
          resident_id: string
          risks?: string | null
        }
        Update: {
          care_plan_id?: string
          changed_at?: string
          changed_by?: string | null
          content?: string | null
          domain?: string
          id?: string
          last_review?: string | null
          needs?: string | null
          outcome?: string | null
          resident_id?: string
          risks?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "care_plan_history_care_plan_id_fkey"
            columns: ["care_plan_id"]
            isOneToOne: false
            referencedRelation: "care_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      care_plans: {
        Row: {
          content: string | null
          created_at: string
          domain: Database["public"]["Enums"]["care_plan_domain"]
          id: string
          last_review: string | null
          needs: string | null
          outcome: string | null
          resident_id: string
          risks: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          domain: Database["public"]["Enums"]["care_plan_domain"]
          id?: string
          last_review?: string | null
          needs?: string | null
          outcome?: string | null
          resident_id: string
          risks?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          domain?: Database["public"]["Enums"]["care_plan_domain"]
          id?: string
          last_review?: string | null
          needs?: string | null
          outcome?: string | null
          resident_id?: string
          risks?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "care_plans_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      consents: {
        Row: {
          consent_type: string
          created_at: string
          date_given: string | null
          given_by: Database["public"]["Enums"]["consent_given_by"]
          given_by_name: string | null
          id: string
          notes: string | null
          resident_id: string
          review_date: string | null
          status: Database["public"]["Enums"]["consent_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          consent_type: string
          created_at?: string
          date_given?: string | null
          given_by?: Database["public"]["Enums"]["consent_given_by"]
          given_by_name?: string | null
          id?: string
          notes?: string | null
          resident_id: string
          review_date?: string | null
          status?: Database["public"]["Enums"]["consent_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          consent_type?: string
          created_at?: string
          date_given?: string | null
          given_by?: Database["public"]["Enums"]["consent_given_by"]
          given_by_name?: string | null
          id?: string
          notes?: string | null
          resident_id?: string
          review_date?: string | null
          status?: Database["public"]["Enums"]["consent_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consents_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_notes: {
        Row: {
          author_id: string
          content: string
          created_at: string
          domain: Database["public"]["Enums"]["care_plan_domain"] | null
          flags: string[] | null
          id: string
          resident_id: string
          risks: Database["public"]["Enums"]["risk_assessment_type"][] | null
          source: string
          status: Database["public"]["Enums"]["note_status"]
          transcript: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          domain?: Database["public"]["Enums"]["care_plan_domain"] | null
          flags?: string[] | null
          id?: string
          resident_id: string
          risks?: Database["public"]["Enums"]["risk_assessment_type"][] | null
          source?: string
          status?: Database["public"]["Enums"]["note_status"]
          transcript?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          domain?: Database["public"]["Enums"]["care_plan_domain"] | null
          flags?: string[] | null
          id?: string
          resident_id?: string
          risks?: Database["public"]["Enums"]["risk_assessment_type"][] | null
          source?: string
          status?: Database["public"]["Enums"]["note_status"]
          transcript?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_notes_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      family_members: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          relationship: string | null
          resident_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          relationship?: string | null
          resident_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          relationship?: string | null
          resident_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_members_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      mca_assessments: {
        Row: {
          assessment_date: string
          best_interests_decision: string | null
          can_communicate: boolean | null
          can_retain: boolean | null
          can_understand: boolean | null
          can_weigh: boolean | null
          created_at: string
          decision: string
          decision_maker: string | null
          has_capacity: boolean | null
          has_impairment: boolean | null
          id: string
          impairment_detail: string | null
          notes: string | null
          resident_id: string
          review_date: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assessment_date?: string
          best_interests_decision?: string | null
          can_communicate?: boolean | null
          can_retain?: boolean | null
          can_understand?: boolean | null
          can_weigh?: boolean | null
          created_at?: string
          decision: string
          decision_maker?: string | null
          has_capacity?: boolean | null
          has_impairment?: boolean | null
          id?: string
          impairment_detail?: string | null
          notes?: string | null
          resident_id: string
          review_date?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assessment_date?: string
          best_interests_decision?: string | null
          can_communicate?: boolean | null
          can_retain?: boolean | null
          can_understand?: boolean | null
          can_weigh?: boolean | null
          created_at?: string
          decision?: string
          decision_maker?: string | null
          has_capacity?: boolean | null
          has_impairment?: boolean | null
          id?: string
          impairment_detail?: string | null
          notes?: string | null
          resident_id?: string
          review_date?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mca_assessments_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      residents: {
        Row: {
          admission_date: string | null
          created_at: string
          date_of_birth: string | null
          full_name: string
          gp: Json | null
          id: string
          key_risks: Json | null
          next_of_kin: Json | null
          nhs_number: string | null
          notes: string | null
          photo_url: string | null
          room_number: string | null
          tag_id: string | null
          updated_at: string
        }
        Insert: {
          admission_date?: string | null
          created_at?: string
          date_of_birth?: string | null
          full_name: string
          gp?: Json | null
          id?: string
          key_risks?: Json | null
          next_of_kin?: Json | null
          nhs_number?: string | null
          notes?: string | null
          photo_url?: string | null
          room_number?: string | null
          tag_id?: string | null
          updated_at?: string
        }
        Update: {
          admission_date?: string | null
          created_at?: string
          date_of_birth?: string | null
          full_name?: string
          gp?: Json | null
          id?: string
          key_risks?: Json | null
          next_of_kin?: Json | null
          nhs_number?: string | null
          notes?: string | null
          photo_url?: string | null
          room_number?: string | null
          tag_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      risk_assessment_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          controls: string | null
          factors: string | null
          id: string
          level: string
          resident_id: string
          review_date: string | null
          risk_assessment_id: string
          type: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          controls?: string | null
          factors?: string | null
          id?: string
          level: string
          resident_id: string
          review_date?: string | null
          risk_assessment_id: string
          type: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          controls?: string | null
          factors?: string | null
          id?: string
          level?: string
          resident_id?: string
          review_date?: string | null
          risk_assessment_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_assessment_history_risk_assessment_id_fkey"
            columns: ["risk_assessment_id"]
            isOneToOne: false
            referencedRelation: "risk_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_assessments: {
        Row: {
          controls: string | null
          created_at: string
          factors: string | null
          id: string
          level: Database["public"]["Enums"]["risk_level"]
          resident_id: string
          review_date: string | null
          type: Database["public"]["Enums"]["risk_assessment_type"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          controls?: string | null
          created_at?: string
          factors?: string | null
          id?: string
          level?: Database["public"]["Enums"]["risk_level"]
          resident_id: string
          review_date?: string | null
          type: Database["public"]["Enums"]["risk_assessment_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          controls?: string | null
          created_at?: string
          factors?: string | null
          id?: string
          level?: Database["public"]["Enums"]["risk_level"]
          resident_id?: string
          review_date?: string | null
          type?: Database["public"]["Enums"]["risk_assessment_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_assessments_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
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
          role: Database["public"]["Enums"]["app_role"]
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
    }
    Enums: {
      alert_severity: "info" | "warning" | "critical"
      app_role: "carer" | "senior_carer" | "nurse" | "manager" | "admin"
      care_plan_domain:
        | "personal_care"
        | "mobility"
        | "nutrition"
        | "continence"
        | "skin_integrity"
        | "communication"
        | "mental_health"
        | "cognition"
        | "medication"
        | "breathing"
        | "sleep"
        | "safety"
        | "social"
        | "end_of_life"
      consent_given_by:
        | "resident"
        | "power_of_attorney"
        | "best_interests"
        | "next_of_kin"
      consent_status: "given" | "refused" | "withdrawn" | "pending"
      note_status: "draft" | "approved"
      risk_assessment_type:
        | "falls"
        | "pressure"
        | "nutrition"
        | "moving_handling"
        | "continence"
        | "medication"
        | "environmental"
        | "behavioural"
        | "mental_capacity"
        | "general"
      risk_level: "low" | "medium" | "high"
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
      alert_severity: ["info", "warning", "critical"],
      app_role: ["carer", "senior_carer", "nurse", "manager", "admin"],
      care_plan_domain: [
        "personal_care",
        "mobility",
        "nutrition",
        "continence",
        "skin_integrity",
        "communication",
        "mental_health",
        "cognition",
        "medication",
        "breathing",
        "sleep",
        "safety",
        "social",
        "end_of_life",
      ],
      consent_given_by: [
        "resident",
        "power_of_attorney",
        "best_interests",
        "next_of_kin",
      ],
      consent_status: ["given", "refused", "withdrawn", "pending"],
      note_status: ["draft", "approved"],
      risk_assessment_type: [
        "falls",
        "pressure",
        "nutrition",
        "moving_handling",
        "continence",
        "medication",
        "environmental",
        "behavioural",
        "mental_capacity",
        "general",
      ],
      risk_level: ["low", "medium", "high"],
    },
  },
} as const
