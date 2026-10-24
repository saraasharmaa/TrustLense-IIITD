import { RecentChecks } from "@/components/RecentChecks";
import { StartCheckForm } from "@/components/StartCheckForm";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <section className="space-y-2">
        <h1 className="text-3xl font-semibold">Know your borrower in two minutes.</h1>
        <p className="text-muted-foreground">
          Checks across GST, MCA, courts and news, with evidence for every finding.
        </p>
      </section>
      <StartCheckForm />
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recent checks</h2>
        <RecentChecks />
      </section>
    </div>
  );
}
