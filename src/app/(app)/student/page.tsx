import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { studentForUser } from "@/lib/market";

export default async function StudentHome() {
  const user = await requireUser("student");
  const st = await studentForUser(user.id);
  redirect(st.status === "setup" ? "/student/setup" : "/student/offers");
}
