// Matches fixtures/score_reference.py so BIZ-02 agrees with the reference on every fixture.
export function nameTokens(name: string): Set<string> {
  const expanded = name
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/pvt/g, "private")
    .replace(/ltd/g, "limited");
  return new Set(
    expanded
      .replace(/[^a-z0-9 ]/g, " ")
      .split(" ")
      .filter(Boolean),
  );
}

function isSubset(a: Set<string>, b: Set<string>): boolean {
  return [...a].every((token) => b.has(token));
}

// A name that is a token subset of the other (e.g. a trade name inside the legal name) is a full match;
// otherwise Dice overlap. Empty names are treated as a match rather than evidence of a mismatch.
export function nameSimilarity(a: string, b: string): number {
  const tokensA = nameTokens(a);
  const tokensB = nameTokens(b);
  if (tokensA.size === 0 || tokensB.size === 0) return 1;
  if (isSubset(tokensA, tokensB) || isSubset(tokensB, tokensA)) return 1;
  const shared = [...tokensA].filter((token) => tokensB.has(token)).length;
  return (2 * shared) / (tokensA.size + tokensB.size);
}
