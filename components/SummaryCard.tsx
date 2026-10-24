import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { CaseView } from "@/lib/client/schemas";

type Narrative = NonNullable<CaseView["narrative"]>;

function Cited({ items }: { items: Narrative["keyRisks"] }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((item) => (
        <li key={item.findingIds.join(",") || item.text}>
          {item.text}{" "}
          {item.findingIds.map((id) => (
            <a
              key={id}
              href={`#finding-${id}`}
              className="ml-1 rounded bg-slate-100 px-1 font-mono text-xs hover:underline"
            >
              {id.slice(0, 8)}
            </a>
          ))}
        </li>
      ))}
    </ul>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

export function SummaryCard({ narrative }: { narrative: Narrative | null }) {
  if (!narrative) {
    return (
      <Card>
        <p className="text-sm text-muted-foreground">No summary is available for this check.</p>
      </Card>
    );
  }
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{narrative.headline}</h2>
        <Badge>{narrative.source === "llm" ? "AI-written summary" : "Template summary"}</Badge>
      </div>
      <p>{narrative.summary}</p>
      <div className="grid gap-4 text-sm md:grid-cols-2">
        {narrative.keyRisks.length > 0 && (
          <Section title="Key risks">
            <Cited items={narrative.keyRisks} />
          </Section>
        )}
        {narrative.strengths.length > 0 && (
          <Section title="Strengths">
            <Cited items={narrative.strengths} />
          </Section>
        )}
        {narrative.suggestedConditions.length > 0 && (
          <Section title="Suggested conditions">
            <ul className="list-disc space-y-1 pl-5">
              {narrative.suggestedConditions.map((c, i) => (
                <li key={`${i}-${c}`}>{c}</li>
              ))}
            </ul>
          </Section>
        )}
        {narrative.questionsForBorrower.length > 0 && (
          <Section title="Questions for the borrower">
            <ul className="list-disc space-y-1 pl-5">
              {narrative.questionsForBorrower.map((q, i) => (
                <li key={`${i}-${q}`}>{q}</li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </Card>
  );
}
