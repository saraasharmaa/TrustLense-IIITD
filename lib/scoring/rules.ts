import type { AdapterId, Category } from "@/lib/types";

// Any change to rules, caps or thresholds bumps this and updates docs/07 and the tests together.
export const RULES_VERSION = "1.0.0";

export type ScoredCategory = Exclude<Category, "COVERAGE">;

export const SCORED_CATEGORIES: ScoredCategory[] = [
  "STATUTORY",
  "CORPORATE",
  "LEGAL",
  "ADVERSE",
  "LEGITIMACY",
];

export const CATEGORY_CAPS: Record<ScoredCategory, number> = {
  STATUTORY: 30,
  CORPORATE: 20,
  LEGAL: 25,
  ADVERSE: 15,
  LEGITIMACY: 10,
};

// Coverage looks only at the primary adapter of each category (docs/07 section 3)
export const PRIMARY_ADAPTER: Record<ScoredCategory, AdapterId> = {
  STATUTORY: "gst",
  CORPORATE: "mca",
  LEGAL: "legal",
  ADVERSE: "news",
  LEGITIMACY: "udyam",
};

export const CATEGORY_LABELS: Record<ScoredCategory, string> = {
  STATUTORY: "GST compliance",
  CORPORATE: "company standing",
  LEGAL: "court and insolvency records",
  ADVERSE: "adverse news and regulatory lists",
  LEGITIMACY: "business legitimacy",
};

// Within a group only the highest penalty counts. A rule missing here is its own group.
export const RULE_GROUPS: Record<string, string> = {
  "GST-01": "G-STATUS",
  "GST-02": "G-FILING",
  "GST-03": "G-FILING",
  "GST-04": "G-AGE",
  "MCA-01": "G-STATUS",
  "MCA-02": "G-FILING",
  "MCA-03": "G-DISQ",
  "MCA-04": "G-CAPITAL",
  "LEG-01": "G-INSOLV",
  "LEG-02": "G-CASES",
  "LEG-03": "G-CASES",
  "LEG-04": "G-CASES",
  "NEWS-01": "G-NEWS",
  "NEWS-02": "G-NEWS",
  "REG-01": "G-REG",
  "BIZ-01": "G-UDYAM",
  "BIZ-02": "G-NAME",
  "BIZ-03": "G-ADDR",
};

export function groupOf(ruleId: string): string {
  return RULE_GROUPS[ruleId] ?? ruleId;
}
