import { listDemoCompanies } from "@/lib/demo/fixtures";

export const dynamic = "force-static";

export function GET() {
  return Response.json({
    companies: listDemoCompanies().map(({ key, subject, expected }) => ({
      key,
      legalName: subject.legalName,
      gstin: subject.gstin,
      expectedGrade: expected.grade,
      synthetic: true,
    })),
  });
}
