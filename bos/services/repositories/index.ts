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
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
