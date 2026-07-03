import { createClient } from "@/services/supabase/server";
import { createRepositories } from "@/services/repositories";
import { StudentsTable } from "@/features/students/components/students-table";

export default async function StudentsPage() {
  const supabase = await createClient();
  const repos = createRepositories(supabase);
  const students = await repos.customers.listPipeline();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">Students / CRM</h1>
        <p className="text-sm text-secondary/50">{students.length} customers</p>
      </div>
      <StudentsTable students={students} />
    </div>
  );
}
