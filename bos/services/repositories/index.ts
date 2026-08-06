import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { CustomersRepository } from "./customers.repository";
import { CoursesRepository } from "./courses.repository";
import { BookingsRepository } from "./bookings.repository";
import { SalesRepository } from "./sales.repository";
import { NotificationsRepository } from "./notifications.repository";
import { ConversationsRepository } from "./conversations.repository";
import { KnowledgeRepository } from "./knowledge.repository";
import { TeachersRepository } from "./teachers.repository";
import { AuditRepository } from "./audit.repository";
import { IntegrationsRepository } from "./integrations.repository";
import { ArticlesRepository } from "./articles.repository";
import { TransactionsRepository } from "./transactions.repository";
import { GeneratedImagesRepository } from "./generated-images.repository";
import { VideoScriptsRepository } from "./video-scripts.repository";
import { VoiceoverScriptsRepository } from "./voiceover-scripts.repository";
import { SystemEventsRepository } from "./system-events.repository";
import { LegalDocumentsRepository } from "./legal-documents.repository";
import { BusinessSnapshotRepository } from "./business-snapshot.repository";
import { GoogleCalendarConnectionsRepository } from "./google-calendar-connections.repository";
import { VideoClipsRepository } from "./video-clips.repository";
import { StrategyRepository } from "./strategy.repository";
import { SalesChatExamplesRepository } from "./sales-chat-examples.repository";
import { MarketingChannelsRepository } from "./marketing-channels.repository";
import { AgentSchedulesRepository } from "./agent-schedules.repository";
import { SocialTrendsRepository } from "./social-trends.repository";
import { CourseArticlesRepository } from "./course-articles.repository";
import { ReferencePhotosRepository } from "./reference-photos.repository";

/**
 * Dependency-injection container: build once per request with the
 * appropriate Supabase client (RLS-scoped or service-role) and pass down,
 * rather than each repository re-creating its own client.
 */
export function createRepositories(db: SupabaseClient<Database>) {
  return {
    customers: new CustomersRepository(db),
    courses: new CoursesRepository(db),
    bookings: new BookingsRepository(db),
    sales: new SalesRepository(db),
    notifications: new NotificationsRepository(db),
    conversations: new ConversationsRepository(db),
    knowledge: new KnowledgeRepository(db),
    teachers: new TeachersRepository(db),
    audit: new AuditRepository(db),
    integrations: new IntegrationsRepository(db),
    articles: new ArticlesRepository(db),
    transactions: new TransactionsRepository(db),
    generatedImages: new GeneratedImagesRepository(db),
    videoScripts: new VideoScriptsRepository(db),
    voiceoverScripts: new VoiceoverScriptsRepository(db),
    systemEvents: new SystemEventsRepository(db),
    legalDocuments: new LegalDocumentsRepository(db),
    businessSnapshot: new BusinessSnapshotRepository(db),
    googleCalendarConnections: new GoogleCalendarConnectionsRepository(db),
    videoClips: new VideoClipsRepository(db),
    strategy: new StrategyRepository(db),
    salesChatExamples: new SalesChatExamplesRepository(db),
    marketingChannels: new MarketingChannelsRepository(db),
    agentSchedules: new AgentSchedulesRepository(db),
    socialTrends: new SocialTrendsRepository(db),
    courseArticles: new CourseArticlesRepository(db),
    referencePhotos: new ReferencePhotosRepository(db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
