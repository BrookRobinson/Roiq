// Deterministic build-year risk flags — the ONLY things Tectara may infer without
// photos. These are era-based likelihoods (not condition scores) and must always
// be labelled "Inferred from build year — not visually confirmed".

export interface EraFlag {
  title: string;
  detail: string;
}

export function buildEraFlags(buildYear: number | null | undefined): EraFlag[] {
  if (!buildYear || buildYear < 1850 || buildYear > 2100) return [];
  const flags: EraFlag[] = [];

  if (buildYear >= 1994 && buildYear <= 2004) {
    flags.push({
      title: "Leaky-building era (1994–2004)",
      detail: "Weathertightness risk must be investigated before purchase. Likely monolithic cladding — a moisture-meter test is strongly recommended.",
    });
  }
  if (buildYear < 1978) {
    flags.push({
      title: "Wall insulation likely absent",
      detail: `Built c.${buildYear} (pre-1978) — walls very likely have no insulation. Budget for a retrofit.`,
    });
  }
  if (buildYear < 1970) {
    flags.push({
      title: "Possible old wiring",
      detail: `Built c.${buildYear} (pre-1970) — may have old rubber/cloth-sheathed wiring. An electrical inspection is advisable.`,
    });
  }
  if (buildYear < 2000) {
    flags.push({
      title: "Single glazing likely",
      detail: `Built c.${buildYear} (pre-2000) — likely single-glazed. Check for condensation; budget for double glazing.`,
    });
  }
  if (buildYear < 1990) {
    flags.push({
      title: "Possible asbestos",
      detail: `Built c.${buildYear} (pre-1990) — possible asbestos in linings, textured ceilings, soffits or vinyl. Test before any renovation.`,
    });
  }
  return flags;
}
