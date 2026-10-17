import { requireUser } from "@/lib/auth";
import { recommendationsFor, roundState, setupProgress, studentForUser } from "@/lib/market";
import { PageHeader } from "@/components/ui";
import SetupFlow from "@/components/student/SetupFlow";

export const metadata = { title: "Your application" };

export default async function SetupPage() {
  const user = await requireUser("student");
  const st = await studentForUser(user.id);
  const p = await setupProgress(st.id);
  const recs = p.analysed ? await recommendationsFor(st.id) : [];
  const r = await roundState();
  const live = st.status !== "setup";
  return (
    <>
      <PageHeader
        title={live ? "Your application" : `Welcome, ${user.name.split(" ")[0]}`}
        description={live ? "Universities can see this application. Documents are locked; you can still change your priorities." : "Four steps and universities can start making you offers. You can stop and come back at any time."}
      />
      <SetupFlow
        live={live}
        cycleClosed={r.closed}
        docs={p.documents.map((d) => ({ id: d.id, kind: d.kind, fileName: d.fileName, sizeBytes: d.sizeBytes }))}
        profile={p.student.profile ?? null}
        preferences={p.student.preferences ?? null}
        paid={p.paid}
        recommendations={recs}
      />
    </>
  );
}
