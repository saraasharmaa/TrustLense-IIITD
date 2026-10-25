// The only module that talks to Sandbox.co.in (docs: developer.sandbox.co.in): MCA company master data.
import { z } from "zod";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

const LIVE_URL = "https://api.sandbox.co.in";
const TIMEOUT_MS = 25_000;
// The access token is valid for 24 hours; refresh a little early
const TOKEN_TTL_MS = 23 * 3_600_000;

const nullableString = z.string().nullable().optional();

const MasterDataResponse = z.object({
  data: z.array(
    z.object({
      cin: z.string(),
      company_name: z.string(),
      company_status: nullableString,
      company_category: nullableString,
      company_class: nullableString,
      authorized_capital: z.number().nullable().optional(),
      paidup_capital: z.number().nullable().optional(),
      company_registration_date: nullableString,
      registered_office_address: nullableString,
    }),
  ),
});

export type MasterData = z.output<typeof MasterDataResponse>["data"][number];

export class SandboxError extends AppError {
  constructor(
    readonly httpStatus: number,
    message: string,
  ) {
    super("upstream_unavailable", message, { httpStatus });
  }
}

let cachedToken: { value: string; expiresAt: number } | undefined;

function credentials() {
  const { SANDBOX_API_KEY, SANDBOX_API_SECRET } = env();
  if (!SANDBOX_API_KEY || !SANDBOX_API_SECRET) {
    throw new AppError(
      "upstream_unavailable",
      "SANDBOX_API_KEY and SANDBOX_API_SECRET are required",
    );
  }
  // Test keys return made-up sample data, which must never be shown as a live check
  if (SANDBOX_API_KEY.includes("test")) {
    throw new AppError(
      "upstream_unavailable",
      "SANDBOX_API_KEY is a test key: it returns sample data, use a live key",
    );
  }
  return { key: SANDBOX_API_KEY, secret: SANDBOX_API_SECRET };
}

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  const { key, secret } = credentials();
  const res = await fetch(`${LIVE_URL}/authenticate`, {
    method: "POST",
    headers: { "x-api-key": key, "x-api-secret": secret, "x-api-version": "1.0" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = (await res.json().catch(() => null)) as {
    data?: { access_token?: string };
    message?: string;
  } | null;
  const token = json?.data?.access_token;
  if (!res.ok || !token) {
    throw new SandboxError(
      res.status,
      `Sandbox authentication failed (HTTP ${res.status}): ${json?.message ?? "no detail"}`,
    );
  }
  cachedToken = { value: token, expiresAt: Date.now() + TOKEN_TTL_MS };
  return token;
}

// Returns null when the CIN is unknown to MCA
export async function fetchCompanyMasterData(cin: string): Promise<MasterData | null> {
  const { key } = credentials();
  const res = await fetch(`${LIVE_URL}/kyc/mca/company/master-data`, {
    method: "POST",
    headers: {
      // The token goes in the Authorization header without a Bearer prefix
      Authorization: await accessToken(),
      "x-api-key": key,
      "x-api-version": "1.0.0",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ cin }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = (await res.json().catch(() => null)) as { message?: string } | null;
  if (res.status === 404) return null;
  if (!res.ok)
    throw new SandboxError(
      res.status,
      `Sandbox returned HTTP ${res.status}: ${json?.message ?? "no detail"}`,
    );
  return MasterDataResponse.parse(json).data[0] ?? null;
}
