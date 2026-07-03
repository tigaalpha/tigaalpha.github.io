import { notFound } from "next/navigation";
import { createClient } from "@/services/supabase/server";
import { createRepositories } from "@/services/repositories";
import { StudentDetail } from "@/features/students/components/student-detail";

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const repos = createRepositories(supabase);

  const customer = await repos.customers.findById(id);
  if (!customer) notFound();

  const [courses, history] = await Promise.all([repos.courses.listForCustomer(id), repos.sales.history(id)]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">{customer.name}</h1>
        <p className="text-sm text-secondary/50">Customer profile</p>
      </div>
      <StudentDetail customer={customer} courses={courses} history={history} />
    </div>
  );
}
