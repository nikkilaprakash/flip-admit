import { requireUser } from "@/lib/auth";
import { PageHeader, Panel } from "@/components/ui";
import CourseForm from "@/components/university/CourseForm";

export const metadata = { title: "Add a course" };
export default async function NewCourse() {
  await requireUser("university");
  return (
    <>
      <PageHeader title="Add a course" description="Seats default to 100. You can change anything except level, length and tuition after offers go out." />
      <Panel className="max-w-3xl p-6 sm:p-8"><CourseForm /></Panel>
    </>
  );
}
