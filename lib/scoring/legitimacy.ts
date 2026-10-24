import type { SourceOutcomes } from "@/lib/adapters/types";
import { nameSimilarity } from "@/lib/identifiers/names";
import { stateNameInText } from "@/lib/identifiers/states";
import type { Evidence, Finding } from "@/lib/types";
import { makeFinding, readSource, subjectKey } from "./finding";

const NAME_MATCH_THRESHOLD = 0.85;

interface NamedSource {
  name: string;
  evidence: Evidence;
}

function udyamFinding(outcomes: SourceOutcomes, key: string): Finding[] {
  const udyam = readSource("udyam", outcomes);
  if (udyam?.data.status !== "not_found") return [];
  return [
    makeFinding({
      ruleId: "BIZ-01",
      category: "LEGITIMACY",
      severity: "low",
      title: "Udyam not found",
      detail: "BIZ-01: no Udyam registration was found for this business. Rule: → −4.",
      penalty: 4,
      fingerprint: `BIZ-01:${key}`,
      evidence: [udyam.evidence("No Udyam record found")],
    }),
  ];
}

function namedSources(outcomes: SourceOutcomes): NamedSource[] {
  const named: NamedSource[] = [];
  const gst = readSource("gst", outcomes);
  if (gst?.data.status === "ok" && gst.data.legalName) {
    named.push({
      name: gst.data.legalName,
      evidence: gst.evidence(`GST legal name: ${gst.data.legalName}`),
    });
  }
  const mca = readSource("mca", outcomes);
  if (mca?.data.status === "ok" && mca.data.companyName) {
    named.push({
      name: mca.data.companyName,
      evidence: mca.evidence(`MCA company name: ${mca.data.companyName}`),
    });
  }
  const udyam = readSource("udyam", outcomes);
  if (udyam?.data.status === "ok" && udyam.data.enterpriseName) {
    named.push({
      name: udyam.data.enterpriseName,
      evidence: udyam.evidence(`Udyam enterprise name: ${udyam.data.enterpriseName}`),
    });
  }
  return named;
}

// Like the reference, every other source is compared against the first one that has a name
function nameFinding(outcomes: SourceOutcomes, key: string): Finding[] {
  const [first, ...others] = namedSources(outcomes);
  if (!first || others.length === 0) return [];
  const lowest = Math.min(...others.map((o) => nameSimilarity(first.name, o.name)));
  if (lowest >= NAME_MATCH_THRESHOLD) return [];
  return [
    makeFinding({
      ruleId: "BIZ-02",
      category: "LEGITIMACY",
      severity: "medium",
      title: "Name mismatch",
      detail: `BIZ-02: business names differ across sources (lowest similarity ${lowest.toFixed(2)}, threshold 0.85). Rule: → −5.`,
      penalty: 5,
      fingerprint: `BIZ-02:${key}`,
      evidence: [first, ...others].map((s) => s.evidence),
    }),
  ];
}

function addressFinding(outcomes: SourceOutcomes, key: string): Finding[] {
  const gst = readSource("gst", outcomes);
  const mca = readSource("mca", outcomes);
  if (gst?.data.status !== "ok" || mca?.data.status !== "ok") return [];
  const gstPlace = gst.data.principalPlace;
  const mcaAddress = mca.data.registeredAddress;
  const gstState = gstPlace ? stateNameInText(gstPlace) : null;
  const mcaState = mcaAddress ? stateNameInText(mcaAddress) : null;
  if (!gstPlace || !mcaAddress || !gstState || !mcaState || gstState === mcaState) return [];
  return [
    makeFinding({
      ruleId: "BIZ-03",
      category: "LEGITIMACY",
      severity: "medium",
      title: "Registered address state differs",
      detail: `BIZ-03: GST principal place is in ${gstState} but the MCA registered address is in ${mcaState}. Rule: → −5.`,
      penalty: 5,
      fingerprint: `BIZ-03:${key}`,
      evidence: [
        gst.evidence(`GST principal place: ${gstPlace}`),
        mca.evidence(`MCA registered address: ${mcaAddress}`),
      ],
    }),
  ];
}

export function legitimacyFindings(outcomes: SourceOutcomes): Finding[] {
  const key = subjectKey(outcomes);
  return [
    ...udyamFinding(outcomes, key),
    ...nameFinding(outcomes, key),
    ...addressFinding(outcomes, key),
  ];
}
