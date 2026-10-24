import { validateGstin } from "@/lib/identifiers/gstin";

// Live feedback under the input: derived facts when valid, the failing check when not
export function GstinHint({ value }: { value: string }) {
  if (!value.trim()) return null;
  const result = validateGstin(value);
  if (!result.ok) {
    return (
      <p role="alert" className="text-sm text-red-700">
        ✖ {result.message}
      </p>
    );
  }
  const { pan, stateName, entityType } = result.value;
  return (
    <p className="text-sm text-green-800">
      ✓ Valid GSTIN · PAN <span className="font-mono">{pan}</span> · {stateName} · {entityType}
    </p>
  );
}
