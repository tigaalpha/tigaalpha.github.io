export type UserRole = "owner" | "admin" | "teacher" | "staff";

export type SalesStatus =
  | "new_lead"
  | "contacted"
  | "qualified"
  | "interested"
  | "trial_booked"
  | "trial_completed"
  | "negotiating"
  | "waiting_decision"
  | "won"
  | "lost"
  | "renew_pending"
  | "renewed";

export type CourseHours = 20 | 40 | 80;

export type LessonEventType = "normal" | "final";

export type BookingStatus = "pending" | "confirmed" | "rescheduled" | "cancelled" | "completed";

export type ConversationChannel = "line" | "web" | "phone" | "walk_in";

export type MessageSender = "customer" | "ai" | "owner";

export type NotificationType =
  | "lesson_today"
  | "conflict_booking"
  | "customer_near_end_course"
  | "payment_reminder"
  | "ai_needs_review"
  | "new_customer";

export type KnowledgeSourceType =
  | "pricing"
  | "promotion"
  | "teachers"
  | "policies"
  | "faq"
  | "school_info"
  | "holiday"
  | "internal_sop"
  | "sales_script"
  | "objection_handling"
  | "rule"
  | "example"
  | "correction";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          role: UserRole;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string; full_name: string; role: UserRole };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      teachers: {
        Row: {
          id: string;
          name: string;
          bio: string | null;
          specialties: string[];
          color: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["teachers"]["Row"]> & { name: string };
        Update: Partial<Database["public"]["Tables"]["teachers"]["Row"]>;
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          name: string;
          phone: string | null;
          line_user_id: string | null;
          age: number | null;
          learning_goal: string | null;
          budget: string | null;
          experience_level: string | null;
          preferred_teacher_id: string | null;
          preferred_schedule: string | null;
          parent_name: string | null;
          parent_phone: string | null;
          sales_status: SalesStatus;
          lead_source: string | null;
          notes: string | null;
          last_contact_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["customers"]["Row"]> & { name: string };
        Update: Partial<Database["public"]["Tables"]["customers"]["Row"]>;
        Relationships: [];
      };
      courses: {
        Row: {
          id: string;
          customer_id: string;
          teacher_id: string | null;
          total_hours: CourseHours;
          current_hour: number;
          remaining_hour: number;
          price: number | null;
          started_at: string;
          renewed_from_course_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["courses"]["Row"]> & {
          customer_id: string;
          total_hours: CourseHours;
        };
        Update: Partial<Database["public"]["Tables"]["courses"]["Row"]>;
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          customer_id: string;
          course_id: string | null;
          teacher_id: string | null;
          google_event_id: string | null;
          title: string;
          lesson_type: LessonEventType;
          status: BookingStatus;
          start_time: string;
          end_time: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["bookings"]["Row"]> & {
          customer_id: string;
          title: string;
          start_time: string;
          end_time: string;
        };
        Update: Partial<Database["public"]["Tables"]["bookings"]["Row"]>;
        Relationships: [];
      };
      sales_status_history: {
        Row: {
          id: string;
          customer_id: string;
          from_status: SalesStatus | null;
          to_status: SalesStatus;
          note: string | null;
          changed_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["sales_status_history"]["Row"]> & {
          customer_id: string;
          to_status: SalesStatus;
        };
        Update: Partial<Database["public"]["Tables"]["sales_status_history"]["Row"]>;
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          customer_id: string | null;
          channel: ConversationChannel;
          line_user_id: string | null;
          summary: string | null;
          needs_review: boolean;
          last_followed_up_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["conversations"]["Row"]> & { channel: ConversationChannel };
        Update: Partial<Database["public"]["Tables"]["conversations"]["Row"]>;
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender: MessageSender;
          content: string;
          metadata: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["messages"]["Row"]> & {
          conversation_id: string;
          sender: MessageSender;
          content: string;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Row"]>;
        Relationships: [];
      };
      knowledge_documents: {
        Row: {
          id: string;
          title: string;
          source_type: KnowledgeSourceType;
          file_path: string | null;
          raw_text: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["knowledge_documents"]["Row"]> & {
          title: string;
          source_type: KnowledgeSourceType;
        };
        Update: Partial<Database["public"]["Tables"]["knowledge_documents"]["Row"]>;
        Relationships: [];
      };
      knowledge_chunks: {
        Row: {
          id: string;
          document_id: string;
          content: string;
          embedding: number[] | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["knowledge_chunks"]["Row"]> & {
          document_id: string;
          content: string;
        };
        Update: Partial<Database["public"]["Tables"]["knowledge_chunks"]["Row"]>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          type: NotificationType;
          title: string;
          body: string | null;
          customer_id: string | null;
          booking_id: string | null;
          read: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["notifications"]["Row"]> & {
          type: NotificationType;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Row"]>;
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          diff: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["audit_log"]["Row"]> & {
          action: string;
          entity_type: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_log"]["Row"]>;
        Relationships: [];
      };
      integration_settings: {
        Row: {
          key: string;
          value: string | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["integration_settings"]["Row"]> & { key: string };
        Update: Partial<Database["public"]["Tables"]["integration_settings"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      match_knowledge_chunks: {
        Args: { query_embedding: string; match_count: number; min_similarity: number };
        Returns: { id: string; document_id: string; content: string; similarity: number }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
