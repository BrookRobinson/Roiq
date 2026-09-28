// The property types a reader can choose in Variables ("Property types you
// want"). "Not known yet" is a real option: most pins are discovered from
// OneRoof's sitemap, which carries an address and nothing else, so for most of
// the country the type genuinely isn't known — leaving it out would quietly
// empty the map.

export interface TypeOption {
  value: string;
  label: string;
  hint?: string;
}

/**
 * Ordered the way someone shops: the things most people are looking for first,
 * then land, then the honest unknown.
 */
export const TYPE_OPTIONS: TypeOption[] = [
  { value: "house", label: "House" },
  { value: "townhouse", label: "Townhouse" },
  { value: "apartment", label: "Apartment" },
  { value: "unit", label: "Unit" },
  { value: "section", label: "Section", hint: "Bare land with no dwelling" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "rural", label: "Rural land", hint: "From OneRoof's rural listings" },
  { value: "unknown", label: "Not known yet", hint: "Discovered from the listing index — type isn't published there" },
];
