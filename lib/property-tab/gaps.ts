export type GapType = "missing_photo" | "missing_data" | "unconfirmed";

export interface ReportGap {
  id: string;
  gapType: GapType;
  area: string;           // machine key, e.g. "west_wall"
  label: string;          // human readable, e.g. "West wall exterior"
  description: string;    // "Not visible in any listing photo"
  inAgentLetter: boolean;
  inLimLetter: boolean;
  resolved: boolean;
  resolvedAt?: string;
}

export const DEMO_GAPS: ReportGap[] = [
  {
    id: "gap_foundation",
    gapType: "missing_photo",
    area: "foundation",
    label: "Foundation / subfloor",
    description: "Subfloor access not shown in any listing photo. Cannot assess pile condition, subfloor moisture, or ground clearance.",
    inAgentLetter: true,
    inLimLetter: true,
    resolved: false,
  },
  {
    id: "gap_west_wall",
    gapType: "missing_photo",
    area: "west_wall",
    label: "West wall exterior",
    description: "West elevation not photographed. Cladding condition on west face cannot be assessed.",
    inAgentLetter: true,
    inLimLetter: false,
    resolved: false,
  },
  {
    id: "gap_switchboard",
    gapType: "missing_photo",
    area: "electrical_board",
    label: "Electrical switchboard",
    description: "Switchboard not shown in listing. Cannot confirm modern breakers or identify rewirable fuses.",
    inAgentLetter: true,
    inLimLetter: true,
    resolved: false,
  },
  {
    id: "gap_build_year",
    gapType: "missing_data",
    area: "build_year",
    label: "Build year confirmation",
    description: "Build year estimated as c.1975 from architectural style — not confirmed in listing.",
    inAgentLetter: true,
    inLimLetter: false,
    resolved: false,
  },
];
