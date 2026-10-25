import {
  fetchBasic,
  fetchProfile,
  fetchReturns,
  GstApiError,
  type GstReturnEntry,
} from "@/lib/gstinapi/client";
import { dueGstr3bPeriods, financialYearOf } from "./gst-periods";
import { GST_SEARCH_URL } from "./gst";
import { GstOutput, parseWith, type GstData } from "./schemas";
import type { AdapterResult, SourceAdapter } from "./types";

const PERIODS = 12;

type GstReturns = Extract<GstData, { status: "ok" }>["returns"];

// A period with no filed record counts as not filed, but only for monthly filers: quarterly (QRMP)
// filers file GSTR-3B once a quarter, so the missing months would be false alarms.
function returnsFor(periods: string[], entries: GstReturnEntry[]): GstReturns {
  return periods.map((period) => {
    const filed = entries.find(
      (e) =>
        e.return_type === "GSTR-3B" && e.return_period === period && e.filing_status === "Filed",
    );
    return filed
      ? { period, form: "GSTR-3B" as const, status: "Filed" as const, filedDate: filed.filing_date }
      : { period, form: "GSTR-3B" as const, status: "Not Filed" as const, filedDate: null };
  });
}

async function loadReturns(gstin: string, periods: string[]): Promise<GstReturnEntry[]> {
  const years = [...new Set(periods.map(financialYearOf))];
  return (await Promise.all(years.map((fy) => fetchReturns(gstin, fy)))).flat();
}

function failure(err: unknown): AdapterResult<GstData> {
  const message = err instanceof Error ? err.message.slice(0, 300) : "GST API call failed";
  if (err instanceof GstApiError && err.httpStatus === 404) {
    return { status: "not_found", normalized: { status: "not_found" }, isReplay: false };
  }
  return { status: "failed", error: message, isReplay: false };
}

// Registration data and, when the account allows it, the filing history. A free account is limited to
// the basic lookup, so it still gets status and age rules but no filing rules.
async function loadGst(gstin: string, now: Date, emit: (text: string) => void) {
  try {
    const { profile, unavailable } = await fetchProfile(gstin);
    const monthly =
      profile.filing_frequency === "Monthly" && !unavailable.includes("filing_frequency");
    let returns: GstReturns = [];
    if (monthly) {
      emit("Reading the GSTR-3B filing history");
      const periods = dueGstr3bPeriods(now, PERIODS);
      returns = returnsFor(periods, await loadReturns(gstin, periods));
    }
    return { fields: { ...profile, cancellation_date: null }, returns, plan: "complete" as const };
  } catch (err) {
    if (!(err instanceof GstApiError) || err.httpStatus !== 403) throw err;
    emit("Credit pack not active: using the basic GSTIN lookup without filing history");
    return { fields: await fetchBasic(gstin), returns: [] as GstReturns, plan: "basic" as const };
  }
}

// Licensed-API tier for GST: no CAPTCHA, so live GST works without an analyst in the loop
export const gstApiAdapter: SourceAdapter<GstData> = {
  id: "gst",
  label: "GST taxpayer data (licensed API)",
  requires: [["gstin"]],
  tier: "licensed_api",
  async run(input, ctx) {
    const gstin = input.gstin as string;
    try {
      ctx.emitProgress("Looking up the GSTIN with the licensed GST API");
      const { fields, returns, plan } = await loadGst(gstin, ctx.now, ctx.emitProgress);
      const raw = {
        status: "ok",
        legalName: fields.legal_name,
        tradeName: fields.trade_name,
        gstin,
        registrationStatus: fields.status,
        registrationDate: fields.registration_date,
        cancellationDate: fields.cancellation_date,
        constitution: fields.business_constitution ?? null,
        taxpayerType: fields.taxpayer_type,
        stateJurisdiction: null,
        centreJurisdiction: null,
        businessActivities: [],
        principalPlace: fields.address,
        returns,
      };
      return {
        status: "succeeded",
        normalized: parseWith(GstOutput, raw, "GST API output"),
        rawOutput: { provider: "gstinapi.in", plan, fields },
        evidenceUrl: GST_SEARCH_URL,
        isReplay: false,
      };
    } catch (err) {
      if (ctx.signal.aborted) throw err;
      return failure(err);
    }
  },
};
