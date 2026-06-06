// Canonical category / sub-item skeleton for the Property tab.
// The point allocations and weights live in scoring.ts (single source of truth) —
// this file only fixes the ids, display names, icons, order, and which sub-items
// are conditional (only shown if actually present in the property).
//
// The AI pipeline assesses these ids; it does NOT invent the structure. Category
// order follows spec 6.3.

export interface TemplateSubItem {
  id: string;
  name: string;
  /** Conditional sub-items are dropped if the AI does not report them as present. */
  conditional?: boolean;
}

export interface TemplateCategory {
  id: string;
  name: string;
  icon: string;
  subItems: TemplateSubItem[];
}

export const PROPERTY_TEMPLATE: TemplateCategory[] = [
  {
    id: "exterior",
    name: "Exterior",
    icon: "🏠",
    subItems: [
      { id: "ext_foundation", name: "Foundation" },
      { id: "ext_roof", name: "Roof" },
      { id: "ext_cladding", name: "Cladding" },
      { id: "ext_windows", name: "Windows" },
      { id: "ext_soffits", name: "Soffits and Fascias" },
      { id: "ext_solar", name: "Solar", conditional: true },
      { id: "ext_chimneys", name: "Chimneys", conditional: true },
    ],
  },
  {
    id: "kitchen",
    name: "Kitchen",
    icon: "🍳",
    subItems: [
      { id: "kit_cabinetry", name: "Cabinetry" },
      { id: "kit_benchtop", name: "Benchtop" },
      { id: "kit_appliances", name: "Appliances" },
      { id: "kit_sink", name: "Sink and Tapware" },
      { id: "kit_splashback", name: "Splashback" },
      { id: "kit_flooring", name: "Flooring" },
    ],
  },
  {
    id: "bathrooms",
    name: "Bathroom(s)",
    icon: "🚿",
    subItems: [
      { id: "bath_shower", name: "Shower / Bath" },
      { id: "bath_waterproofing", name: "Waterproofing" },
      { id: "bath_vanity", name: "Vanity and Tapware" },
      { id: "bath_toilet", name: "Toilet" },
      { id: "bath_ventilation", name: "Ventilation" },
      { id: "bath_flooring", name: "Flooring" },
    ],
  },
  {
    id: "bedrooms",
    name: "Bedrooms",
    icon: "🛏️",
    subItems: [
      { id: "bed_master", name: "Master Bedroom" },
      { id: "bed_bed2", name: "Bedroom 2", conditional: true },
      { id: "bed_bed3", name: "Bedroom 3", conditional: true },
    ],
  },
  {
    id: "living",
    name: "Living Areas",
    icon: "🛋️",
    subItems: [
      { id: "liv_flooring", name: "Flooring" },
      { id: "liv_heating", name: "Heating" },
      { id: "liv_light", name: "Natural Light" },
      { id: "liv_ceiling", name: "Ceiling" },
      { id: "liv_insulation", name: "Insulation", conditional: true },
      { id: "liv_size", name: "Size and Flow" },
    ],
  },
  {
    id: "services",
    name: "Services",
    icon: "⚡",
    subItems: [
      { id: "svc_electrical", name: "Electrical Board" },
      { id: "svc_plumbing", name: "Plumbing (visible)" },
      { id: "svc_hotwater", name: "Hot Water Cylinder" },
      { id: "svc_gas", name: "Gas", conditional: true },
    ],
  },
  {
    id: "garage",
    name: "Garage",
    icon: "🚗",
    subItems: [
      { id: "gar_main", name: "Garage", conditional: true },
      { id: "gar_door", name: "Garage Door", conditional: true },
    ],
  },
  {
    id: "outdoor",
    name: "Outdoor & Grounds",
    icon: "🌿",
    subItems: [
      { id: "out_deck", name: "Deck / Patio", conditional: true },
      { id: "out_fencing", name: "Fencing" },
      { id: "out_driveway", name: "Driveway" },
      { id: "out_garden", name: "Garden" },
      { id: "out_drainage", name: "Drainage" },
    ],
  },
];

/** Every sub-item id the AI is allowed to return, for tool-schema enums and validation. */
export const ALL_SUB_ITEM_IDS: string[] = PROPERTY_TEMPLATE.flatMap((c) =>
  c.subItems.map((s) => s.id)
);
