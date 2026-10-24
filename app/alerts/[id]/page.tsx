import { AlertDetail } from "@/components/AlertDetail";

export default async function AlertPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AlertDetail alertId={id} />;
}
