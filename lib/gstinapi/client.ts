// The only module that talks to gstinapi.in, a licensed GST data provider (docs: gstinapi.in/docs).
import { z } from "zod";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

const BASE_URL = "https://www.gstinapi.in";
const TIMEOUT_MS = 25_000;

const nullableString = z.string().nullable();

const CompleteResponse = z.object({
  success: z.literal(true),
  profile: z.object({
    legal_name: nullableString,
    trade_name: nullableString,
    registration_date: nullableString,
    business_constitution: nullableString,
    status: nullableString,
    taxpayer_type: nullableString,
    address: nullableString,
    filing_frequency: z.enum(["Monthly", "Quarterly"]).nullable(),
  }),
  unavailable: z.array(z.string()).default([]),
});

// Free accounts can only use this basic lookup (registration data, no filing history)
const BasicResponse = z.object({
  success: z.literal(true),
  data: z.object({
    legal_name: nullableString,
    trade_name: nullableString,
    registration_date: nullableString,
    cancellation_date: nullableString,
    status: nullableString,
    taxpayer_type: nullableString,
    address: nullableString,
    business_constitution: nullableString.optional(),
  }),
});

const ReturnsResponse = z.object({
  success: z.literal(true),
  returns: z.array(
    z.object({
      return_type: z.string(),
      return_period: z.string(),
      filing_status: z.string(),
      filing_date: nullableString,
    }),
  ),
});

export type GstProfile = z.output<typeof CompleteResponse>;
export type GstReturnEntry = z.output<typeof ReturnsResponse>["returns"][number];

// The provider's own error codes, kept so the adapter can tell "not registered" from "out of credits"
export class GstApiError extends AppError {
  constructor(
    readonly httpStatus: number,
    message: string,
  ) {
    super("upstream_unavailable", message, { httpStatus });
  }
}

async function call(path: string): Promise<unknown> {
  const key = env().GSTINAPI_API_KEY;
  if (!key) throw new AppError("upstream_unavailable", "GSTINAPI_API_KEY is not configured");
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "x-api-key": key },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) {
    // The key is never part of the message
    throw new GstApiError(
      res.status,
      `GSTIN API returned HTTP ${res.status}: ${json?.error ?? "no detail"}`,
    );
  }
  return json;
}

export type GstBasic = z.output<typeof BasicResponse>["data"];

export async function fetchBasic(gstin: string): Promise<GstBasic> {
  return BasicResponse.parse(await call(`/v1/gstin/${encodeURIComponent(gstin)}`)).data;
}

// One call (2 credits) for registration data and filing frequency
export async function fetchProfile(gstin: string): Promise<GstProfile> {
  return CompleteResponse.parse(await call(`/v1/gstin/${encodeURIComponent(gstin)}/complete`));
}

// One call (1 credit) per financial year, formatted like "2025-26"
export async function fetchReturns(gstin: string, fy: string): Promise<GstReturnEntry[]> {
  const json = await call(`/v1/gstin/${encodeURIComponent(gstin)}/returns?fy=${fy}`);
  return ReturnsResponse.parse(json).returns;
}
