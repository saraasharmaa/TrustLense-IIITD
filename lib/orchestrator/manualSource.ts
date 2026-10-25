import { z } from "zod";
import { GST_SEARCH_URL } from "@/lib/adapters/gst";
import { GstOutput, parseWith } from "@/lib/adapters/schemas";
import { AppError } from "@/lib/errors";
import type { AdapterId } from "@/lib/types";
import { emitEvent } from "./events";
import { finalizeCase } from "./runCase";
import {
  clearForRerun,
  createSourceRun,
  loadCase,
  loadKeptOutcomes,
  updateSourceRun,
} from "./store";
import { ADAPTER_ORDER } from "@/lib/adapters/registry";

export const ManualGstBody = z.object({
  registrationStatus: z.enum(["Active", "Provisional", "Suspended", "Cancelled"]),
  registrationDate: z.string().date().nullish(),
  legalName: z.string().min(1).max(200).nullish(),
});

// The GST portal asks for a CAPTCHA. An analyst can solve it in their own browser and type in what
// the portal shows; the report labels it as analyst-entered, never as agent-verified.
export async function enterGstManually(caseId: string, body: z.output<typeof ManualGstBody>) {
  const { case: c, subject } = await loadCase(caseId);
  if (c.mode !== "live") throw new AppError("conflict", "Manual entry is only for live checks");
  if (c.status === "queued" || c.status === "running")
    throw new AppError("conflict", "This case is still running");
  if (!subject.gstin) throw new AppError("invalid_input", "This company has no GSTIN");

  const normalized = parseWith(
    GstOutput,
    {
      status: "ok",
      legalName: body.legalName ?? null,
      tradeName: null,
      gstin: subject.gstin,
      registrationStatus: body.registrationStatus,
      registrationDate: body.registrationDate ?? null,
      cancellationDate: null,
      constitution: null,
      taxpayerType: null,
      stateJurisdiction: null,
      centreJurisdiction: null,
      businessActivities: [],
      principalPlace: null,
      // Return history is not entered, so the filing rules are skipped and coverage says so
      returns: [],
    },
    "manual GST entry",
  );

  await clearForRerun(caseId, ["gst"]);
  const sourceRunId = await createSourceRun(caseId, "gst", "running");
  await updateSourceRun(sourceRunId, {
    status: "succeeded",
    isManual: true,
    isReplay: false,
    durationMs: 0,
    attempt: 1,
    evidenceUrl: GST_SEARCH_URL,
    normalized,
    rawOutput: { enteredBy: "analyst", ...body },
  });
  await emitEvent(caseId, "source.completed", {
    adapter: "gst",
    status: "succeeded",
    durationMs: 0,
    summary: "gst: entered by analyst",
  });

  const outcomes = await loadKeptOutcomes(caseId);
  const requested = ADAPTER_ORDER.filter((id: AdapterId) => c.requestedSources.includes(id));
  await finalizeCase(
    caseId,
    requested,
    outcomes,
    Object.values(outcomes).map((o) => o.status),
  );
}
