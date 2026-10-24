import { Card } from "@/components/ui/card";
import type { CaseView } from "@/lib/client/schemas";

const LABEL: Record<string, string> = {
  STATUTORY: "GST compliance",
  CORPORATE: "Company standing",
  LEGAL: "Cases & insolvency",
  ADVERSE: "Adverse media",
  LEGITIMACY: "Legitimacy",
};

export function CategoryBreakdown({ rows }: { rows: CaseView["categoryBreakdown"] }) {
  return (
    <Card className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Category breakdown
      </h2>
      <ul className="space-y-3">
        {rows.map(({ category, cap, applied }) => (
          <li key={category} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>{LABEL[category] ?? category}</span>
              <span className="font-mono">
                −{applied} / {cap}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100" role="presentation">
              <div
                className="h-2 rounded-full bg-teal-700"
                style={{ width: `${(applied / cap) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
