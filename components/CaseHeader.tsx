import { ReplayBadge } from "@/components/ReplayBadge";
import { ScoreRing } from "@/components/ScoreRing";
import { Badge } from "@/components/ui/badge";
import type { CaseView } from "@/lib/client/schemas";

export function CaseHeader({ view }: { view: CaseView }) {
  const { subject } = view;
  return (
    <header className="flex flex-wrap items-center justify-between gap-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{subject.legalName}</h1>
          {view.mode === "demo" && <ReplayBadge />}
          {view.isProvisional && <Badge tone="medium">Provisional</Badge>}
        </div>
        <p className="font-mono text-sm text-muted-foreground">
          {[subject.gstin, subject.pan, subject.cin].filter(Boolean).join(" · ")}
        </p>
        {view.recommendation && <p className="font-medium">{view.recommendation}</p>}
        {view.coverage !== null && (
          <p className="text-sm text-muted-foreground">
            {Math.round(view.coverage * 100)}% of risk areas verified
          </p>
        )}
      </div>
      {view.score !== null && view.grade && (
        <ScoreRing
          score={view.score}
          grade={view.grade}
          provisional={Boolean(view.isProvisional)}
        />
      )}
    </header>
  );
}
