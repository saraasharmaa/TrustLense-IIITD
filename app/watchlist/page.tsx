import { AlertTimeline } from "@/components/AlertTimeline";
import { WatchTable } from "@/components/WatchTable";

export default function WatchlistPage() {
  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">Watchlist</h1>
        <WatchTable />
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Alerts</h2>
        <AlertTimeline />
      </section>
    </div>
  );
}
