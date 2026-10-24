"use client";

import { AgentLanes } from "@/components/AgentLanes";
import { CaseHeader } from "@/components/CaseHeader";
import { CategoryBreakdown } from "@/components/CategoryBreakdown";
import { FindingsFeed } from "@/components/FindingsFeed";
import { FindingsList } from "@/components/FindingsList";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SourcesPanel } from "@/components/SourcesPanel";
import { SummaryCard } from "@/components/SummaryCard";
import { useCase } from "@/lib/client/use-case";

export function CaseScreen({ caseId }: { caseId: string }) {
  const { state, reload } = useCase(caseId);

  if (state.state === "loading") {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-16 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (state.state === "error") {
    return (
      <Card className="space-y-3">
        <p role="alert" className="text-red-700">
          Could not load this check: {state.message}
        </p>
        <Button variant="outline" onClick={() => void reload()}>
          Try again
        </Button>
      </Card>
    );
  }

  const { view, progress } = state;
  const done = view.status === "completed" || view.status === "partial" || view.status === "failed";
  const reported = done && view.score !== null;
  return (
    <div className="space-y-6">
      <CaseHeader view={view} />
      {view.status === "failed" && (
        <Card role="alert" className="border-red-300 bg-red-50 text-red-800">
          No source returned data, so there is no score for this check.
        </Card>
      )}
      {view.status === "partial" && (
        <Card className="border-amber-300 bg-amber-50 text-amber-900">
          Some sources could not be verified, so this report covers only part of the picture.
        </Card>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <AgentLanes runs={view.sourceRuns} progress={progress} caseDone={done} />
        {reported ? (
          <CategoryBreakdown rows={view.categoryBreakdown} />
        ) : (
          <FindingsFeed findings={view.findings} running={!done} />
        )}
      </div>
      {reported && (
        <>
          <SummaryCard narrative={view.narrative} />
          <FindingsList findings={view.findings} />
          <SourcesPanel runs={view.sourceRuns} />
        </>
      )}
    </div>
  );
}
