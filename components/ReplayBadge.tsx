import { Badge } from "@/components/ui/badge";

export function ReplayBadge({ className }: { className?: string }) {
  return (
    <Badge
      tone="replay"
      className={className}
      title="Recorded or synthetic results, not a live check"
    >
      Replay / demo data
    </Badge>
  );
}
