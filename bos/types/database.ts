// CEO Agent recommended action — same shape the agent-orchestrator writes
// into agent_workflow_runs.recommended_actions. `action` is optional and
// only present when the recommendation can be executed by the system;
// advisory recommendations omit it.
export interface AgentRecommendedAction {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  action?: {
    type: "create_task" | "send_notification" | "send_line" | "create_schedule";
    payload: Record<string, unknown>;
  };
}

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

export type CourseHours = 10 | 20 | 40 | 80;

export type LessonEventType = "normal" | "final";

export type BookingStatus = "pending" | "confirmed" | "rescheduled" | "cancelled" | "completed";

export type AttendanceStatus = "unconfirmed" | "confirmed" | "declined";

export type ConversationChannel = "line" | "web" | "phone" | "walk_in" | "internal" | "messenger";

export type MessageSender = "customer" | "ai" | "owner";

export type NotificationType =
  | "lesson_today"
  | "conflict_booking"
  | "customer_near_end_course"
  | "payment_reminder"
  | "ai_needs_review"
  | "new_customer"
  | "system_alert"
  | "payment_received"
  | "attendance_declined"
  | "slip_matched"
  | "slip_unmatched"
  | "post_trial"
  | "renewal_offer"
  | "monthly_report"
  | "payroll_report"
  | "reactivation"
  | "review_request"
  | "referral_created"
  | "lesson_summary"
  | "waitlist_offer"
  | "kb_auto_learned"
  | "ai_budget_exceeded"
  | "drip_sent"
  | "voice_transcript"
  | "winback_draft"
  | "event_notify";

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

export type ArticleStatus = "draft" | "published";

export interface ArticleFaqItem {
  question: string;
  answer: string;
}

export type TransactionType = "income" | "expense";

export type SocialPlatform = "facebook" | "instagram" | "tiktok" | "youtube" | "line" | "x" | "website";

export type SocialPostStatus = "queued" | "posting" | "success" | "failed";

export type ApprovalType = "cancel_paid_lesson" | "ad_campaign_spend" | "ai_drafted_message" | "bulk_sales_status_change";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type SystemEventSeverity = "info" | "warning" | "error";

export type AdCampaignStatus = "draft" | "pending_approval" | "approved" | "rejected";

export type LegalDocumentType = "enrollment_contract" | "parental_consent";

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
          line_user_id: string | null;
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
          practice_frequency: string | null;
          parent_name: string | null;
          parent_phone: string | null;
          sales_status: SalesStatus;
          lead_source: string | null;
          notes: string | null;
          last_contact_at: string | null;
          lead_score: number;
          last_reactivation_at: string | null;
          renewal_offer_sent_at: string | null;
          review_asked_at: string | null;
          referral_code: string | null;
          messenger_psid: string | null;
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
          attendance_status: AttendanceStatus;
          attendance_confirmed_at: string | null;
          attendance_reminded_at: string | null;
          is_trial: boolean;
          post_trial_feedback_sent_at: string | null;
          post_trial_offer_sent_at: string | null;
          waitlist_offered_at: string | null;
          reschedule_offered_at: string | null;
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
          lost_reason: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["sales_status_history"]["Row"]> & {
          customer_id: string;
          to_status: SalesStatus;
        };
        Update: Partial<Database["public"]["Tables"]["sales_status_history"]["Row"]>;
        Relationships: [];
      };
      content_calendar: {
        Row: {
          id: string;
          kind: "article" | "short" | "social" | "ad";
          title: string;
          body: string | null;
          platform: string | null;
          planned_date: string | null;
          status: "draft" | "approved" | "published" | "skipped";
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["content_calendar"]["Row"]> & {
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["content_calendar"]["Row"]>;
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
          follow_up_count: number;
          trial_offer_sent: boolean;
          last_stage: string | null;
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
      kb_drafts: {
        Row: {
          id: string;
          question: string;
          draft_answer: string;
          source_conversation_id: string | null;
          status: "pending" | "approved" | "rejected";
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["kb_drafts"]["Row"]> & {
          question: string;
          draft_answer: string;
        };
        Update: Partial<Database["public"]["Tables"]["kb_drafts"]["Row"]>;
        Relationships: [];
      };
      knowledge_documents: {
        Row: {
          id: string;
          title: string;
          source_type: KnowledgeSourceType;
          file_path: string | null;
          raw_text: string | null;
          auto_generated: boolean;
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
      articles: {
        Row: {
          id: string;
          title: string;
          slug: string;
          target_keyword: string;
          meta_description: string;
          content: string;
          faq: ArticleFaqItem[];
          internal_link_ideas: string[];
          language: string;
          status: ArticleStatus;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["articles"]["Row"]> & {
          title: string;
          slug: string;
          target_keyword: string;
          meta_description: string;
          content: string;
        };
        Update: Partial<Database["public"]["Tables"]["articles"]["Row"]>;
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          type: TransactionType;
          category: string;
          amount: number;
          description: string | null;
          transaction_date: string;
          payment_method: string | null;
          customer_id: string | null;
          course_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["transactions"]["Row"]> & {
          type: TransactionType;
          category: string;
          amount: number;
        };
        Update: Partial<Database["public"]["Tables"]["transactions"]["Row"]>;
        Relationships: [];
      };
      business_snapshot: {
        Row: {
          id: string;
          active_students: number | null;
          teaching_hours_per_week: number | null;
          avg_monthly_hours: number | null;
          sales_policy: string | null;
          cac: number | null;
          ltv_min: number | null;
          ltv_max: number | null;
          note: string | null;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["business_snapshot"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["business_snapshot"]["Row"]>;
        Relationships: [];
      };
      generated_images: {
        Row: {
          id: string;
          prompt: string;
          mime_type: string;
          image_base64: string;
          drive_file_id: string | null;
          drive_view_url: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["generated_images"]["Row"]> & {
          prompt: string;
          mime_type: string;
          image_base64: string;
        };
        Update: Partial<Database["public"]["Tables"]["generated_images"]["Row"]>;
        Relationships: [];
      };
      video_clips: {
        Row: {
          id: string;
          source_image_id: string | null;
          status: "processing" | "done" | "error";
          provider: "veo" | "seedance-2" | "seedance-2-fast" | "luma-ray-2" | "runway-gen4-turbo";
          operation_name: string | null;
          duration_seconds: number;
          mime_type: string | null;
          video_base64: string | null;
          error_message: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["video_clips"]["Row"]> & {
          duration_seconds: number;
        };
        Update: Partial<Database["public"]["Tables"]["video_clips"]["Row"]>;
        Relationships: [];
      };
      video_scripts: {
        Row: {
          id: string;
          topic: string;
          hook: string;
          script: string;
          caption: string;
          hashtags: string[];
          language: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["video_scripts"]["Row"]> & {
          topic: string;
          hook: string;
          script: string;
          caption: string;
        };
        Update: Partial<Database["public"]["Tables"]["video_scripts"]["Row"]>;
        Relationships: [];
      };
      voice_call_logs: {
        Row: {
          id: string;
          call_id: string | null;
          direction: string;
          phone: string | null;
          customer_id: string | null;
          status: string | null;
          summary: string | null;
          transcript_url: string | null;
          recording_url: string | null;
          amount: number | null;
          payment_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["voice_call_logs"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["voice_call_logs"]["Row"]>;
        Relationships: [];
      };
      voiceover_scripts: {
        Row: {
          id: string;
          topic: string;
          script: string;
          language: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["voiceover_scripts"]["Row"]> & {
          topic: string;
          script: string;
        };
        Update: Partial<Database["public"]["Tables"]["voiceover_scripts"]["Row"]>;
        Relationships: [];
      };
      social_accounts: {
        Row: {
          id: string;
          user_id: string;
          platform: "facebook" | "instagram" | "tiktok" | "youtube" | "line" | "x";
          account_name: string;
          access_token: string;
          refresh_token: string | null;
          token_expires_at: string | null;
          metadata: Record<string, unknown>;
          connected_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["social_accounts"]["Row"]> & {
          user_id: string;
          platform: "facebook" | "instagram" | "tiktok" | "youtube" | "line" | "x";
          account_name: string;
          access_token: string;
        };
        Update: Partial<Database["public"]["Tables"]["social_accounts"]["Row"]>;
        Relationships: [];
      };
      social_posts: {
        Row: {
          id: string;
          user_id: string;
          content: string;
          platforms: string[];
          media_urls: string[];
          posted_at: string | null;
          status: "queued" | "posting" | "success" | "failed";
          error_message: string | null;
          external_ids: Record<string, unknown>;
          content_calendar_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["social_posts"]["Row"]> & {
          user_id: string;
          content: string;
          platforms: string[];
        };
        Update: Partial<Database["public"]["Tables"]["social_posts"]["Row"]>;
        Relationships: [];
      };
      approval_requests: {
        Row: {
          id: string;
          type: ApprovalType;
          payload: Record<string, unknown>;
          reason: string | null;
          status: ApprovalStatus;
          requested_by: string;
          resolved_by: string | null;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["approval_requests"]["Row"]> & {
          type: ApprovalType;
          payload: Record<string, unknown>;
        };
        Update: Partial<Database["public"]["Tables"]["approval_requests"]["Row"]>;
        Relationships: [];
      };
      system_events: {
        Row: {
          id: string;
          source: string;
          severity: SystemEventSeverity;
          message: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["system_events"]["Row"]> & {
          source: string;
          severity: SystemEventSeverity;
          message: string;
        };
        Update: Partial<Database["public"]["Tables"]["system_events"]["Row"]>;
        Relationships: [];
      };
      ad_campaigns: {
        Row: {
          id: string;
          platform: string;
          objective: string;
          target_audience: string | null;
          budget_suggestion: string | null;
          ad_copy: string;
          creative_brief: string | null;
          status: AdCampaignStatus;
          created_by: string | null;
          approved_by: string | null;
          approved_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["ad_campaigns"]["Row"]> & {
          platform: string;
          objective: string;
          ad_copy: string;
        };
        Update: Partial<Database["public"]["Tables"]["ad_campaigns"]["Row"]>;
        Relationships: [];
      };
      legal_documents: {
        Row: {
          id: string;
          type: LegalDocumentType;
          customer_id: string | null;
          content: string;
          variables: Record<string, unknown>;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["legal_documents"]["Row"]> & {
          type: LegalDocumentType;
          content: string;
        };
        Update: Partial<Database["public"]["Tables"]["legal_documents"]["Row"]>;
        Relationships: [];
      };
      google_calendar_connections: {
        Row: {
          id: string;
          label: string;
          google_account_email: string | null;
          calendar_id: string;
          refresh_token: string;
          color: string;
          connected_at: string;
          created_by: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["google_calendar_connections"]["Row"]> & {
          label: string;
          refresh_token: string;
        };
        Update: Partial<Database["public"]["Tables"]["google_calendar_connections"]["Row"]>;
        Relationships: [];
      };
      strategy_sessions: {
        Row: {
          id: string;
          title: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["strategy_sessions"]["Row"]> & { title: string };
        Update: Partial<Database["public"]["Tables"]["strategy_sessions"]["Row"]>;
        Relationships: [];
      };
      strategy_messages: {
        Row: {
          id: string;
          session_id: string;
          role: "user" | "ai";
          model: string | null;
          content: string;
          pinned: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["strategy_messages"]["Row"]> & {
          session_id: string;
          role: "user" | "ai";
          content: string;
        };
        Update: Partial<Database["public"]["Tables"]["strategy_messages"]["Row"]>;
        Relationships: [];
      };
      sales_chat_examples: {
        Row: {
          id: string;
          extracted_turns: { speaker: "customer" | "owner"; text: string }[];
          confirmed: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["sales_chat_examples"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["sales_chat_examples"]["Row"]>;
        Relationships: [];
      };
      marketing_channel_manual_stats: {
        Row: {
          id: string;
          channel: "tiktok" | "x" | "instagram";
          followers: number;
          note: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["marketing_channel_manual_stats"]["Row"]> & {
          channel: "tiktok" | "x" | "instagram";
        };
        Update: Partial<Database["public"]["Tables"]["marketing_channel_manual_stats"]["Row"]>;
        Relationships: [];
      };
      marketing_metric_snapshots: {
        Row: {
          id: string;
          channel: "website" | "youtube" | "facebook" | "tiktok" | "instagram" | "x";
          metric: "followers" | "likes" | "views" | "shares" | "comments" | "saves" | "reposts";
          value: number;
          source: "auto" | "manual";
          captured_at: string;
          created_by: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["marketing_metric_snapshots"]["Row"]> & {
          channel: "website" | "youtube" | "facebook" | "tiktok" | "instagram" | "x";
          metric: "followers" | "likes" | "views" | "shares" | "comments" | "saves" | "reposts";
          value: number;
          source: "auto" | "manual";
        };
        Update: Partial<Database["public"]["Tables"]["marketing_metric_snapshots"]["Row"]>;
        Relationships: [];
      };
      agent_schedules: {
        Row: {
          id: string;
          label: string;
          instruction: string;
          recurrence_type: "once" | "daily" | "every_n_days" | "weekly" | "monthly";
          interval_days: number | null;
          day_of_week: number | null;
          day_of_month: number | null;
          time_of_day: string;
          run_once_at: string | null;
          active: boolean;
          next_run_at: string;
          last_run_at: string | null;
          last_run_status: "success" | "error" | null;
          last_run_result: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["agent_schedules"]["Row"]> & {
          label: string;
          instruction: string;
          recurrence_type: "once" | "daily" | "every_n_days" | "weekly" | "monthly";
          time_of_day: string;
          next_run_at: string;
        };
        Update: Partial<Database["public"]["Tables"]["agent_schedules"]["Row"]>;
        Relationships: [];
      };
      attendance_reminder_schedules: {
        Row: {
          id: string;
          customer_id: string;
          day_of_week: number;
          time_of_day: string;
          active: boolean;
          next_occurrence_at: string;
          last_reminded_occurrence: string | null;
          attendance_status: AttendanceStatus;
          attendance_confirmed_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["attendance_reminder_schedules"]["Row"]> & {
          customer_id: string;
          day_of_week: number;
          time_of_day: string;
          next_occurrence_at: string;
        };
        Update: Partial<Database["public"]["Tables"]["attendance_reminder_schedules"]["Row"]>;
        Relationships: [];
      };
      automation_rules: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          trigger_type:
            | "customer_created"
            | "sales_status_changed"
            | "booking_created"
            | "booking_cancelled"
            | "course_ending_soon"
            | "course_expired"
            | "customer_inactive"
            | "booking_starting_soon"
            | "revenue_drop"
            | "cash_flow_risk";
          trigger_config: Record<string, unknown>;
          conditions: { field: string; operator: string; value: unknown }[];
          actions: { type: string; config: Record<string, unknown> }[];
          enabled: boolean;
          is_template: boolean;
          consecutive_failures: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["automation_rules"]["Row"]> & {
          name: string;
          trigger_type: Database["public"]["Tables"]["automation_rules"]["Row"]["trigger_type"];
        };
        Update: Partial<Database["public"]["Tables"]["automation_rules"]["Row"]>;
        Relationships: [];
      };
      automation_runs: {
        Row: {
          id: string;
          rule_id: string;
          event_id: string | null;
          entity_type: string | null;
          entity_id: string | null;
          status: "success" | "failed" | "skipped";
          actions_result: { type: string; ok: boolean; detail?: string }[];
          error: string | null;
          started_at: string;
          finished_at: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          status: "open" | "done" | "cancelled";
          priority: "low" | "medium" | "high";
          due_at: string | null;
          customer_id: string | null;
          assigned_to: string | null;
          created_by: string | null;
          automation_rule_id: string | null;
          source_workflow_run_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tasks"]["Row"]> & { title: string };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Row"]>;
        Relationships: [];
      };
      agent_workflow_runs: {
        Row: {
          id: string;
          goal: string;
          status: "running" | "completed" | "failed";
          final_report: string | null;
          recommended_actions: AgentRecommendedAction[] | null;
          feedback: "useful" | "not_useful" | null;
          created_by: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["agent_workflow_runs"]["Row"]> & { goal: string };
        Update: Partial<Database["public"]["Tables"]["agent_workflow_runs"]["Row"]>;
        Relationships: [];
      };
      agent_actions: {
        Row: {
          id: string;
          workflow_run_id: string;
          title: string;
          description: string;
          priority: "low" | "medium" | "high";
          action_type: "create_task" | "send_notification" | "send_line" | "create_schedule";
          action_payload: Record<string, unknown>;
          status: "pending_approval" | "approved" | "rejected" | "executed" | "auto_executed" | "failed";
          result: string | null;
          created_at: string;
          executed_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["agent_actions"]["Row"]> & {
          workflow_run_id: string;
          title: string;
          description: string;
          action_type: "create_task" | "send_notification" | "send_line" | "create_schedule";
          action_payload: Record<string, unknown>;
        };
        Update: Partial<Database["public"]["Tables"]["agent_actions"]["Row"]>;
        Relationships: [];
      };
      agent_event_trigger_log: {
        Row: {
          id: string;
          trigger_type: string;
          detail: string | null;
          workflow_run_id: string | null;
          triggered_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["agent_event_trigger_log"]["Row"]> & { trigger_type: string };
        Update: Partial<Database["public"]["Tables"]["agent_event_trigger_log"]["Row"]>;
        Relationships: [];
      };
      agent_task_runs: {
        Row: {
          id: string;
          workflow_run_id: string;
          agent_id: string;
          question: string;
          status: "success" | "failed";
          output: string | null;
          error: string | null;
          started_at: string;
          finished_at: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      ai_reports: {
        Row: {
          id: string;
          report_type: "daily_briefing" | "weekly_business_report" | "student_progress" | "sales_followup_draft";
          entity_type: string | null;
          entity_id: string | null;
          title: string;
          content: string;
          data: Record<string, unknown>;
          model: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      line_webhook_events: {
        Row: {
          event_id: string;
          received_at: string;
        };
        Insert: { event_id: string; received_at?: string };
        Update: never;
        Relationships: [];
      };
      ai_usage_log: {
        Row: {
          id: string;
          model: string;
          prompt_tokens: number;
          completion_tokens: number;
          source: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      receipts: {
        Row: {
          id: string;
          receipt_number: string;
          transaction_id: string;
          customer_id: string;
          course_id: string | null;
          amount: number;
          issued_at: string;
          drive_file_id: string | null;
          drive_file_url: string | null;
          sent_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      social_trend_manual_items: {
        Row: {
          id: string;
          platform: "tiktok" | "instagram" | "facebook" | "wechat" | "alipay" | "xiaohongshu";
          rank: number;
          topic: string;
          detail: string | null;
          created_at: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["social_trend_manual_items"]["Row"]> & {
          platform: "tiktok" | "instagram" | "facebook" | "wechat" | "alipay" | "xiaohongshu";
          topic: string;
        };
        Update: Partial<Database["public"]["Tables"]["social_trend_manual_items"]["Row"]>;
        Relationships: [];
      };
      course_articles: {
        Row: {
          id: string;
          module_title: string;
          topic: string;
          title: string;
          summary: string | null;
          content: string;
          sources: { title: string; url: string }[];
          language: string;
          status: "draft" | "published";
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["course_articles"]["Row"]> & {
          module_title: string;
          topic: string;
          title: string;
          content: string;
        };
        Update: Partial<Database["public"]["Tables"]["course_articles"]["Row"]>;
        Relationships: [];
      };
      reference_photos: {
        Row: {
          id: string;
          label: string;
          mime_type: string;
          image_base64: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["reference_photos"]["Row"]> & {
          label: string;
          mime_type: string;
          image_base64: string;
        };
        Update: Partial<Database["public"]["Tables"]["reference_photos"]["Row"]>;
        Relationships: [];
      };
      competitor_analyses: {
        Row: {
          id: string;
          summary: string;
          competitors: {
            name: string;
            type: "direct" | "indirect";
            category: string;
            marketingChannels: string[];
            notes: string;
          }[];
          strategies: { approach: "compete" | "avoid"; title: string; description: string }[];
          sources: { title: string; url: string }[];
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["competitor_analyses"]["Row"]> & {
          summary: string;
        };
        Update: Partial<Database["public"]["Tables"]["competitor_analyses"]["Row"]>;
        Relationships: [];
      };
      system_backups: {
        Row: {
          id: string;
          taken_at: string;
          tables: Record<string, unknown[]>;
          row_counts: Record<string, number>;
          verified: boolean;
          verify_detail: string | null;
          status: "success" | "error";
          error_detail: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["system_backups"]["Row"]> & {
          tables: Record<string, unknown[]>;
          row_counts: Record<string, number>;
        };
        Update: Partial<Database["public"]["Tables"]["system_backups"]["Row"]>;
        Relationships: [];
      };
      app_ad_kits: {
        Row: {
          id: string;
          app_url: string;
          app_name: string;
          summary: string;
          top_features: { title: string; description: string; imagePrompt: string }[];
          article_markdown: string;
          video_concepts: { type: "feature_highlight" | "testimonial_review"; script: string; videoPrompt: string }[];
          image_ids: string[];
          video_clip_ids: string[];
          sources: { title: string; url: string }[];
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["app_ad_kits"]["Row"]> & {
          app_url: string;
          app_name: string;
          summary: string;
          article_markdown: string;
        };
        Update: Partial<Database["public"]["Tables"]["app_ad_kits"]["Row"]>;
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          customer_id: string;
          course_id: string | null;
          amount: number;
          promptpay_target: string;
          promptpay_payload: string;
          qr_base64: string | null;
          qr_url: string | null;
          reference_code: string;
          note: string | null;
          status: "pending" | "paid" | "cancelled";
          confirmed_by: string | null;
          paid_at: string | null;
          slip_image_url: string | null;
          slip_verified_at: string | null;
          last_reminded_at: string | null;
          remind_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["payments"]["Row"]> & {
          customer_id: string;
          amount: number;
          promptpay_target: string;
          promptpay_payload: string;
          reference_code: string;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Row"]>;
        Relationships: [];
      };
      transfer_slips: {
        Row: {
          id: string;
          customer_id: string | null;
          payment_id: string | null;
          image_url: string | null;
          extracted_amount: number | null;
          extracted_reference: string | null;
          extracted_date: string | null;
          confidence: number | null;
          match_status: "pending" | "matched" | "unmatched" | "not_a_slip";
          raw_extraction: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["transfer_slips"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["transfer_slips"]["Row"]>;
        Relationships: [];
      };
      lesson_notes: {
        Row: {
          id: string;
          booking_id: string | null;
          customer_id: string;
          teacher_id: string | null;
          summary: string;
          homework: string | null;
          raw_input: string | null;
          created_by: string | null;
          sent_to_customer: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["lesson_notes"]["Row"]> & { customer_id: string; summary: string };
        Update: Partial<Database["public"]["Tables"]["lesson_notes"]["Row"]>;
        Relationships: [];
      };
      waitlist: {
        Row: {
          id: string;
          customer_id: string;
          teacher_id: string | null;
          preferred_day: number | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["waitlist"]["Row"]> & { customer_id: string };
        Update: Partial<Database["public"]["Tables"]["waitlist"]["Row"]>;
        Relationships: [];
      };
      reactivation_log: {
        Row: {
          id: string;
          customer_id: string;
          message: string | null;
          sent_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["reactivation_log"]["Row"]> & { customer_id: string };
        Update: Partial<Database["public"]["Tables"]["reactivation_log"]["Row"]>;
        Relationships: [];
      };
      drip_campaigns: {
        Row: {
          id: string;
          name: string;
          segment: Record<string, unknown>;
          message_template: string;
          interval_days: number;
          active: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["drip_campaigns"]["Row"]> & { name: string; message_template: string };
        Update: Partial<Database["public"]["Tables"]["drip_campaigns"]["Row"]>;
        Relationships: [];
      };
      drip_sends: {
        Row: {
          id: string;
          campaign_id: string;
          customer_id: string;
          sent_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["drip_sends"]["Row"]> & { campaign_id: string; customer_id: string };
        Update: Partial<Database["public"]["Tables"]["drip_sends"]["Row"]>;
        Relationships: [];
      };
      referrals: {
        Row: {
          id: string;
          referrer_customer_id: string;
          referral_code: string;
          referred_customer_id: string | null;
          reward_granted: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["referrals"]["Row"]> & { referrer_customer_id: string; referral_code: string };
        Update: Partial<Database["public"]["Tables"]["referrals"]["Row"]>;
        Relationships: [];
      };
      teacher_rates: {
        Row: {
          teacher_id: string;
          rate_per_hour: number;
          active: boolean;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["teacher_rates"]["Row"]> & { teacher_id: string; rate_per_hour: number };
        Update: Partial<Database["public"]["Tables"]["teacher_rates"]["Row"]>;
        Relationships: [];
      };
      ad_spend_entries: {
        Row: {
          id: string;
          platform: string;
          amount: number;
          spend_date: string;
          campaign_name: string | null;
          note: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["ad_spend_entries"]["Row"]> & { platform: string; amount: number };
        Update: Partial<Database["public"]["Tables"]["ad_spend_entries"]["Row"]>;
        Relationships: [];
      };
      ai_evals: {
        Row: {
          id: string;
          message_id: string | null;
          conversation_id: string | null;
          channel: string | null;
          reply_text: string;
          score: number;
          reason: string | null;
          model: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["ai_evals"]["Row"]> & { reply_text: string; score: number };
        Update: Partial<Database["public"]["Tables"]["ai_evals"]["Row"]>;
        Relationships: [];
      };
      company_policies: {
        Row: {
          id: string;
          title: string;
          content: string;
          tags: string[];
          source_type: "manual" | "approval" | "kb";
          active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["company_policies"]["Row"]> & { title: string; content: string };
        Update: Partial<Database["public"]["Tables"]["company_policies"]["Row"]>;
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          title: string;
          event_type: "recital" | "exam" | "competition" | "workshop" | "other";
          start_time: string;
          end_time: string | null;
          location: string | null;
          description: string | null;
          status: "draft" | "open" | "closed";
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["events"]["Row"]> & { title: string; start_time: string };
        Update: Partial<Database["public"]["Tables"]["events"]["Row"]>;
        Relationships: [];
      };
      event_participants: {
        Row: {
          id: string;
          event_id: string;
          customer_id: string;
          piece: string | null;
          status: "invited" | "confirmed" | "declined";
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["event_participants"]["Row"]> & { event_id: string; customer_id: string };
        Update: Partial<Database["public"]["Tables"]["event_participants"]["Row"]>;
        Relationships: [];
      };
      winback_campaigns: {
        Row: {
          id: string;
          customer_id: string;
          offer_text: string;
          offer_amount: number | null;
          status: "pending" | "approved" | "rejected" | "sent" | "converted" | "dismissed";
          payment_id: string | null;
          created_by: string | null;
          created_at: string;
          sent_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["winback_campaigns"]["Row"]> & { customer_id: string; offer_text: string };
        Update: Partial<Database["public"]["Tables"]["winback_campaigns"]["Row"]>;
        Relationships: [];
      };
      kb_learning_log: {
        Row: {
          id: string;
          question_hash: string;
          customer_id: string | null;
          question: string;
          answer: string;
          document_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["kb_learning_log"]["Row"]> & { question_hash: string; question: string; answer: string };
        Update: Partial<Database["public"]["Tables"]["kb_learning_log"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      match_knowledge_chunks: {
        Args: { query_embedding: string; match_count: number; min_similarity: number };
        Returns: { id: string; document_id: string; content: string; similarity: number }[];
      };
      data_health_report: {
        Args: Record<string, never>;
        Returns: {
          category: string;
          severity: "critical" | "warning" | "info";
          description: string;
          entity_type: string;
          entity_id: string | null;
          suggested_fix: string;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];

export type SocialAccount = Tables<"social_accounts">;
export type SocialPost = Tables<"social_posts">;
