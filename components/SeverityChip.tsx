import { Badge } from "@/components/ui/badge";
import { SEVERITY_LABEL } from "@/lib/client/labels";
import type { Severity } from "@/lib/types";

export function SeverityChip({ severity }: { severity: Severity }) {
  const { icon, text, tone } = SEVERITY_LABEL[severity];
  return (
    <Badge tone={tone}>
      <span aria-hidden>{icon}</span> {text}
    </Badge>
  );
}
