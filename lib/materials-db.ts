// NZ Building Materials Database — Budget vs Premium
// Sourced from Bunnings NZ, Mitre 10, Placemakers, Fisher & Paykel, Miele, Grohe
// Last updated: June 2026 — refresh prices quarterly

export interface MaterialOption {
  description: string;
  price: number;
  unit: string;
  source: string;
  notes: string;
}

export interface MaterialItem {
  cat: string;
  name: string;
  budget: MaterialOption;
  premium: MaterialOption;
}

export const MATERIALS_DB: MaterialItem[] = [

  // ─── SITE & FOUNDATIONS ──────────────────────────────────────────────────

  { cat:"Site & Foundations", name:"Concrete mix",
    budget:{ description:"Premix 25 MPa bags DIY pour", price:9.80, unit:"per 20kg bag", source:"Bunnings", notes:"1 bag = ~0.01m³. Good for posts and small pours." },
    premium:{ description:"Ready-mix 30 MPa delivered pump pour", price:265, unit:"per m³", source:"Firth", notes:"Min 1m³. Professional finish. Best for slabs and driveways." }},

  { cat:"Site & Foundations", name:"Foundation type — piles",
    budget:{ description:"H5 timber pile 90x90mm CCA per lm", price:26.20, unit:"per lm", source:"Bunnings", notes:"Standard NZ pile. 25-30yr ground life." },
    premium:{ description:"Concrete encased steel post pile installed", price:185, unit:"per pile installed", source:"Market rate", notes:"100yr lifespan. No rot. Best for high-moisture West Coast sites." }},

  { cat:"Site & Foundations", name:"Foundation type — slab",
    budget:{ description:"100mm reinforced concrete slab installed", price:140, unit:"per m² installed", source:"Market rate", notes:"Standard domestic slab. Includes mesh and basic prep." },
    premium:{ description:"150mm post-tensioned concrete slab installed", price:210, unit:"per m² installed", source:"Market rate", notes:"Far fewer cracks, spans soft ground, better long-term performance." }},

  { cat:"Site & Foundations", name:"Concrete reinforcing mesh",
    budget:{ description:"H1-42 mesh 6x2.4m sheet", price:98, unit:"per sheet", source:"Bunnings", notes:"Standard slab mesh. Covers 14.4m²." },
    premium:{ description:"H16-200 heavy mesh 6x2.4m sheet", price:165, unit:"per sheet", source:"Placemakers", notes:"Heavy residential. Better crack resistance under vehicle loads." }},

  { cat:"Site & Foundations", name:"Rebar reinforcing",
    budget:{ description:"12mm Grade 300E deformed bar 6m", price:20.50, unit:"per 6m", source:"Bunnings", notes:"Standard residential slab reinforcing." },
    premium:{ description:"16mm Grade 300E deformed bar 6m", price:32.50, unit:"per 6m", source:"Bunnings", notes:"Required for driveways with vehicle loading and retaining walls." }},

  { cat:"Site & Foundations", name:"Sub-floor moisture barrier",
    budget:{ description:"200um black polythene 50m roll", price:185, unit:"per 50m roll", source:"Mitre 10", notes:"Basic vapour barrier. Lapped 200mm at joins." },
    premium:{ description:"Delta-MS dimple membrane per m²", price:8.50, unit:"per m²", source:"Placemakers", notes:"Creates air gap, far superior moisture management. Recommended for West Coast." }},

  { cat:"Site & Foundations", name:"DPC membrane",
    budget:{ description:"Standard polythene DPC 300mm x 10m", price:22.50, unit:"per roll", source:"Mitre 10", notes:"Basic strip DPC for masonry courses." },
    premium:{ description:"Self-adhesive fleece-backed DPC 300mm x 10m", price:48, unit:"per roll", source:"Mitre 10", notes:"Self-seals around fixings. Better in high-rainfall zones." }},

  { cat:"Site & Foundations", name:"Basecourse gravel",
    budget:{ description:"20mm crusher dust compacted per tonne", price:55, unit:"per tonne", source:"Local supplier", notes:"Basic sub-base for paths and driveways." },
    premium:{ description:"AP40 roading aggregate per tonne", price:75, unit:"per tonne", source:"Local supplier", notes:"Engineered sub-base. Better drainage and load-bearing capacity." }},

  { cat:"Site & Foundations", name:"Polystyrene under-slab",
    budget:{ description:"EPS50 expanded polystyrene 50mm 2400x1200", price:42, unit:"per sheet", source:"Mitre 10", notes:"Basic thermal break under slab." },
    premium:{ description:"XPS100 extruded polystyrene 100mm 2400x600", price:95, unit:"per sheet", source:"Mitre 10", notes:"Double R-value, moisture resistant, required in Zone 3 for H1:2024 compliance." }},

  { cat:"Site & Foundations", name:"Pile cap and bearer connector",
    budget:{ description:"Galvanised post cap 90x90mm", price:16, unit:"per unit", source:"Mitre 10", notes:"Standard pile-to-bearer connection." },
    premium:{ description:"Stainless steel heavy-duty post anchor 90x90", price:38, unit:"per unit", source:"Mitre 10", notes:"Marine-grade. No corrosion. Essential in coastal locations." }},

  { cat:"Site & Foundations", name:"Formwork ply",
    budget:{ description:"17mm formwork ply 2400x1200 reusable", price:88, unit:"per sheet", source:"Placemakers", notes:"Standard formwork. Re-use 3-5 times." },
    premium:{ description:"21mm WISA-Form birch ply 2400x1200", price:145, unit:"per sheet", source:"Placemakers", notes:"Re-use 20+ times. Far better surface finish on exposed concrete." }},

  { cat:"Site & Foundations", name:"Post hole digging",
    budget:{ description:"Manual auger hire 100mm — DIY", price:95, unit:"per day hire", source:"Bunnings", notes:"DIY post hole. Works well in soft ground." },
    premium:{ description:"Tractor auger professional contractor", price:380, unit:"per half day", source:"Market rate", notes:"50-100 holes per day. Required in hard clay or rocky ground." }},

  { cat:"Site & Foundations", name:"Fast-set post concrete",
    budget:{ description:"Standard post-mix concrete 20kg bag", price:11.80, unit:"per bag", source:"Bunnings", notes:"Mix in hole. Sets in 24hrs." },
    premium:{ description:"Rapid-set post concrete 15kg sets in 15min", price:18.50, unit:"per bag", source:"Mitre 10", notes:"Eliminates bracing time. Add water, no mixing required." }},

  { cat:"Site & Foundations", name:"Concrete sealer and hardener",
    budget:{ description:"Concrete cure and seal 4L acrylic", price:38, unit:"per 4L", source:"Bunnings", notes:"Basic curing membrane. Prevents dusting." },
    premium:{ description:"Densifier-hardener lithium silicate 10L", price:95, unit:"per 10L", source:"Mitre 10", notes:"Chemically hardens concrete. 40% stronger surface. Permanent." }},

  // ─── STRUCTURAL FRAMING ──────────────────────────────────────────────────

  { cat:"Structural Framing", name:"Wall framing timber",
    budget:{ description:"90x45mm H1.2 SG8 KD radiata 6m", price:45.06, unit:"per 6m ($7.51/lm)", source:"Bunnings", notes:"Standard interior wall framing. Kiln dried." },
    premium:{ description:"90x45mm LVL engineered wall framing 6m", price:78, unit:"per 6m ($13/lm)", source:"Placemakers", notes:"No twist or bow. Straighter walls. Better for premium builds." }},

  { cat:"Structural Framing", name:"Exterior wall framing",
    budget:{ description:"90x45mm H3.2 SG8 KD radiata 6m", price:55.82, unit:"per 6m ($9.30/lm)", source:"Bunnings", notes:"Standard exterior framing. Moisture resistant." },
    premium:{ description:"90x45mm H3.2 SG8 Green treated 6m", price:62.16, unit:"per 6m ($10.36/lm)", source:"Bunnings", notes:"Higher treatment for high-moisture West Coast builds." }},

  { cat:"Structural Framing", name:"Floor joists",
    budget:{ description:"190x45mm H3.2 SG8 KD radiata 6m", price:125.09, unit:"per 6m ($20.85/lm)", source:"Bunnings", notes:"Standard residential joist. Can deflect on long spans." },
    premium:{ description:"200mm engineered I-joist TJI per lm", price:28, unit:"per lm", source:"Placemakers", notes:"Far stiffer, lighter, longer spans. Eliminates squeaky floors." }},

  { cat:"Structural Framing", name:"Roof structure",
    budget:{ description:"Prefab pine roof trusses 600mm spacing", price:95, unit:"per truss", source:"Placemakers", notes:"Factory-made, fast to erect. Limited attic access." },
    premium:{ description:"Engineered LVL cathedral rafter system", price:280, unit:"per rafter equivalent", source:"Placemakers", notes:"Allows vaulted ceilings. Architecturally striking." }},

  { cat:"Structural Framing", name:"Lintels",
    budget:{ description:"140x45mm H3.2 SG8 KD double lintel 6m", price:94.19, unit:"per 6m length", source:"Bunnings", notes:"Spans domestic openings up to 1800mm." },
    premium:{ description:"Structural steel RSJ 150mm per lm installed", price:110, unit:"per lm installed", source:"Market rate", notes:"For openings over 2400mm. No size limitation." }},

  { cat:"Structural Framing", name:"Bearers",
    budget:{ description:"140x45mm H4 wet sawn bearer per lm", price:11.78, unit:"per lm", source:"Bunnings", notes:"Standard bearer for pile foundations." },
    premium:{ description:"LVL 200x63mm bearer per lm", price:38, unit:"per lm", source:"Placemakers", notes:"Higher load capacity. Spans further between piles. No creep." }},

  { cat:"Structural Framing", name:"Bottom plates",
    budget:{ description:"90x45mm H3.2 bottom plate per lm", price:9.30, unit:"per lm", source:"Bunnings", notes:"Standard treated bottom plate on concrete." },
    premium:{ description:"90x45mm H4 bottom plate per lm", price:12, unit:"per lm", source:"Bunnings", notes:"Higher treatment — essential where ponding water possible." }},

  { cat:"Structural Framing", name:"Blocking and noggins",
    budget:{ description:"90x45mm H1.2 KD radiata per lm", price:7.51, unit:"per lm", source:"Bunnings", notes:"Off-cuts used for interior blocking." },
    premium:{ description:"90x45mm structural LVL per lm", price:13, unit:"per lm", source:"Placemakers", notes:"For load-bearing blocking points. No splitting." }},

  { cat:"Structural Framing", name:"Purlins",
    budget:{ description:"90x45mm H3.2 KD purlin per lm", price:9.30, unit:"per lm", source:"Bunnings", notes:"Standard roof purlin at 900mm spacing." },
    premium:{ description:"140x45mm LVL roof purlin per lm", price:15, unit:"per lm", source:"Placemakers", notes:"For wider rafter spacing and higher snow/wind loads." }},

  { cat:"Structural Framing", name:"Fascia board",
    budget:{ description:"190x25mm H3.2 fascia board per lm", price:8.50, unit:"per lm", source:"Mitre 10", notes:"Standard timber fascia. Requires painting." },
    premium:{ description:"Primed finger-jointed fascia 190x25 per lm", price:14, unit:"per lm", source:"Mitre 10", notes:"Knot-free, pre-primed. No resin bleed. Paint finish lasts longer." }},

  { cat:"Structural Framing", name:"Soffit lining",
    budget:{ description:"9mm H3.2 ply soffit sheet 2400x1200", price:52, unit:"per sheet", source:"Bunnings", notes:"Painted timber soffit. Budget option." },
    premium:{ description:"Hardisoffit 6mm fibre cement 2400x1200", price:85, unit:"per sheet", source:"Mitre 10", notes:"James Hardie. No rot, no paint peeling. Low maintenance." }},

  { cat:"Structural Framing", name:"Bracing",
    budget:{ description:"Ply wall bracing 9mm structural sheet", price:52, unit:"per sheet", source:"Bunnings", notes:"Standard ply bracing for racking resistance." },
    premium:{ description:"Pryda steel bracing strap per lm", price:4.50, unit:"per lm", source:"Placemakers", notes:"Steel strap bracing. Less wall space than ply." }},

  // ─── PLYWOOD & SHEET ─────────────────────────────────────────────────────

  { cat:"Plywood & Sheet", name:"Structural bracing ply",
    budget:{ description:"9mm H3.2 Structural CD 2400x1200", price:52, unit:"per sheet", source:"Bunnings", notes:"Standard exterior wall bracing." },
    premium:{ description:"12mm H3.2 Structural CD 2400x1200", price:65, unit:"per sheet", source:"Bunnings", notes:"Higher racking resistance. Better for high-wind zones." }},

  { cat:"Plywood & Sheet", name:"Subfloor sheet",
    budget:{ description:"18mm particle board 2400x1200", price:48, unit:"per sheet", source:"Mitre 10", notes:"Budget subfloor. Not moisture tolerant." },
    premium:{ description:"21mm H3.2 structural ply 2400x1200", price:98, unit:"per sheet", source:"Bunnings", notes:"Moisture resistant, stiff, long-lasting." }},

  { cat:"Plywood & Sheet", name:"Interior wall ply",
    budget:{ description:"7mm DD untreated structural 2400x1200", price:42, unit:"per sheet", source:"Bunnings", notes:"Thin interior bracing or lining." },
    premium:{ description:"12mm Okoume hardwood ply 2400x1200", price:88, unit:"per sheet", source:"Bunnings", notes:"Beautiful grain finish. Clear-coat as feature wall." }},

  { cat:"Plywood & Sheet", name:"MDF sheet",
    budget:{ description:"MDF standard 16mm 2400x1200", price:52, unit:"per sheet", source:"Mitre 10", notes:"Interior furniture and joinery substrate." },
    premium:{ description:"MDF moisture resistant 18mm 2400x1200", price:72, unit:"per sheet", source:"Mitre 10", notes:"For wet area joinery including vanities and laundry." }},

  { cat:"Plywood & Sheet", name:"Roof sarking ply",
    budget:{ description:"9mm H3.2 CD ply sarking 2400x1200", price:52, unit:"per sheet", source:"Bunnings", notes:"Open-slat sarking." },
    premium:{ description:"12mm H3.2 closed sarking ply 2400x1200", price:65, unit:"per sheet", source:"Bunnings", notes:"Full closed deck required for torch-on membrane roofing." }},

  { cat:"Plywood & Sheet", name:"Hardboard",
    budget:{ description:"Hardboard 3.2mm 2400x1200", price:22, unit:"per sheet", source:"Mitre 10", notes:"Furniture backing, drawer bottoms, wall lining." },
    premium:{ description:"6mm Masonite hardboard 2400x1200", price:35, unit:"per sheet", source:"Mitre 10", notes:"Thicker, stiffer, better for painted wall lining behind tiles." }},

  // ─── ROOFING ─────────────────────────────────────────────────────────────

  { cat:"Roofing", name:"Main roofing iron",
    budget:{ description:"Corrugate iron 0.40mm standard", price:24, unit:"per lm", source:"Mitre 10", notes:"Classic NZ roofing. 25-30yr lifespan." },
    premium:{ description:"Colorsteel Endura 0.55mm longrun", price:55, unit:"per lm", source:"Mitre 10", notes:"PVDF coating. 40+ yr lifespan. Best for coastal and high-rainfall." }},

  { cat:"Roofing", name:"Roofing underlay",
    budget:{ description:"Standard vapour permeable sarking 30m", price:95, unit:"per 30m roll", source:"Mitre 10", notes:"Minimum Building Code compliance." },
    premium:{ description:"Thermakraft Gold reflective underlay 30m", price:165, unit:"per 30m roll", source:"Mitre 10", notes:"Adds R0.3 thermal resistance. Better in high rainfall." }},

  { cat:"Roofing", name:"Guttering",
    budget:{ description:"PVC quad gutter 150mm per lm", price:18, unit:"per lm", source:"Mitre 10", notes:"Standard plastic. Functional." },
    premium:{ description:"Colorsteel seamless fascia gutter installed", price:42, unit:"per lm installed", source:"Market rate", notes:"No joins = no leaks. Colour-matched steel." }},

  { cat:"Roofing", name:"Downpipes",
    budget:{ description:"PVC round downpipe 90mm per lm", price:12, unit:"per lm", source:"Mitre 10", notes:"Standard plastic round downpipe." },
    premium:{ description:"Colorsteel rectangular downpipe 65x45mm", price:28, unit:"per lm", source:"Mitre 10", notes:"Colour-matched steel. Far more durable." }},

  { cat:"Roofing", name:"Ridge capping",
    budget:{ description:"Standard pressed steel ridge cap per lm", price:28, unit:"per lm", source:"Mitre 10", notes:"Colour-matched. Basic coverage." },
    premium:{ description:"Ventilated ridge cap system per lm", price:55, unit:"per lm", source:"Mitre 10", notes:"Passive roof ventilation. Reduces moisture in ceiling cavity." }},

  { cat:"Roofing", name:"Valley iron",
    budget:{ description:"Standard pressed valley iron per lm", price:22, unit:"per lm", source:"Mitre 10", notes:"Standard valley flashing." },
    premium:{ description:"Wide profile valley 300mm per lm", price:35, unit:"per lm", source:"Mitre 10", notes:"Better water capacity. Required for low-pitch or high-rainfall roofs." }},

  { cat:"Roofing", name:"Roof fixings",
    budget:{ description:"Roofing screws 12g 65mm 500pk", price:38, unit:"per 500pk", source:"Mitre 10", notes:"Standard self-drilling screws." },
    premium:{ description:"Class 4 stainless roofing screws 500pk", price:75, unit:"per 500pk", source:"Mitre 10", notes:"Marine grade. No rust streaks. Mandatory within 500m coast." }},

  { cat:"Roofing", name:"Barge flashing",
    budget:{ description:"Standard barge flashing 2.4m length", price:28, unit:"per 2.4m", source:"Mitre 10", notes:"Pressed steel. Colour-matched." },
    premium:{ description:"Custom folded barge flashing per lm installed", price:45, unit:"per lm installed", source:"Market rate", notes:"Site-folded to exact profile. Waterproof result." }},

  { cat:"Roofing", name:"Eave flashing",
    budget:{ description:"Standard aluminium eave flashing per lm", price:12, unit:"per lm", source:"Mitre 10", notes:"Basic eave drip edge." },
    premium:{ description:"Pre-painted steel eave flashing per lm", price:22, unit:"per lm", source:"Mitre 10", notes:"Colour matched, steel longevity." }},

  { cat:"Roofing", name:"Skylights",
    budget:{ description:"Acrylic dome fixed skylight 600x600", price:280, unit:"per unit", source:"Mitre 10", notes:"Fixed acrylic. Basic light transmission." },
    premium:{ description:"Velux FCM electric opening skylight 780x980", price:1850, unit:"per unit", source:"Placemakers", notes:"Rain sensor auto-closes. Double glazed. Transforms dark rooms." }},

  { cat:"Roofing", name:"Roof vent",
    budget:{ description:"Whirlybird turbine vent 300mm", price:65, unit:"per unit", source:"Mitre 10", notes:"Wind-driven ventilation. No power needed." },
    premium:{ description:"Solar-powered roof ventilator 600mm", price:385, unit:"per unit", source:"Mitre 10", notes:"10x more airflow than whirlybird. Cools roof cavity in summer." }},

  { cat:"Roofing", name:"Butyl tape",
    budget:{ description:"Standard butyl lap tape 50mm x 10m", price:22, unit:"per roll", source:"Bunnings", notes:"Basic lap seal for roofing." },
    premium:{ description:"Wide butyl tape 75mm x 20m self-adhesive", price:45, unit:"per roll", source:"Mitre 10", notes:"Better coverage at seams. Stays flexible at low temperatures." }},

  { cat:"Roofing", name:"Roof paint existing roof",
    budget:{ description:"Roof paint acrylic 10L standard", price:95, unit:"per 10L", source:"Mitre 10", notes:"Refreshes existing iron roof. 5yr warranty." },
    premium:{ description:"Roof membrane elastomeric 10L", price:245, unit:"per 10L", source:"Mitre 10", notes:"Seals existing leaks. 15yr warranty." }},

  // ─── WALL CLADDING ────────────────────────────────────────────────────────

  { cat:"Wall Cladding", name:"Primary cladding",
    budget:{ description:"Pine weatherboard H3.2 treated per lm", price:6.50, unit:"per lm", source:"Mitre 10", notes:"Budget. Repaint every 5-7 years." },
    premium:{ description:"Clear cedar bevel-back weatherboard per lm", price:14, unit:"per lm", source:"Placemakers", notes:"Natural oil finish. Repaint every 8-12 years." }},

  { cat:"Wall Cladding", name:"Fibre cement board",
    budget:{ description:"Hardiflex 4.5mm sheet 2400x1200", price:54, unit:"per sheet", source:"Mitre 10", notes:"Thin sheet. Requires paint system." },
    premium:{ description:"Linea weatherboard 3.6m James Hardie", price:58, unit:"per 3.6m", source:"Mitre 10", notes:"15yr finish warranty. Low maintenance profile cladding." }},

  { cat:"Wall Cladding", name:"Plywood cladding",
    budget:{ description:"Shadowclad 9mm 2400x1200 rough sawn", price:98, unit:"per sheet", source:"Placemakers", notes:"Pre-primed. Shadow groove. Distinctive NZ look." },
    premium:{ description:"Abodo Vulcan thermo-ash cladding per lm", price:32, unit:"per lm", source:"Placemakers", notes:"Thermally modified NZ pine. No chemicals. 25yr warranty." }},

  { cat:"Wall Cladding", name:"Textured base coat",
    budget:{ description:"Harditex base sheet 9mm 2400x1200", price:108, unit:"per sheet", source:"Mitre 10", notes:"Fibre cement base for plaster system." },
    premium:{ description:"Rockcote fibre cement 9mm 2400x1200", price:125, unit:"per sheet", source:"Placemakers", notes:"Better impact resistance. Suits premium textured finish systems." }},

  { cat:"Wall Cladding", name:"Cavity batten",
    budget:{ description:"45x20mm H3.1 batten 3.6m per lm", price:3.11, unit:"per lm", source:"Bunnings", notes:"Standard 20mm drained cavity batten." },
    premium:{ description:"Thermally broken aluminium cavity bracket", price:8.50, unit:"per unit (400mm oc)", source:"Placemakers", notes:"Eliminates thermal bridging through cladding." }},

  { cat:"Wall Cladding", name:"Wall underlay",
    budget:{ description:"Standard builders wrap 60m roll", price:65, unit:"per 60m roll", source:"Mitre 10", notes:"Basic compliance wrap behind cladding." },
    premium:{ description:"Resistiv RV wall underlay 30m", price:125, unit:"per 30m roll", source:"Mitre 10", notes:"Vapour permeable, R0.2 thermal value. Better moisture management." }},

  { cat:"Wall Cladding", name:"Corner trim",
    budget:{ description:"PVC corner joiner trim per 3m length", price:12, unit:"per 3m", source:"Mitre 10", notes:"Basic PVC. Functional." },
    premium:{ description:"Aluminium corner trim anodised per 3m", price:28, unit:"per 3m", source:"Mitre 10", notes:"Durable, sharp finish. Suits fibre cement and plywood systems." }},

  { cat:"Wall Cladding", name:"Window reveal lining",
    budget:{ description:"Pine 65x18mm window reveal per lm", price:4.50, unit:"per lm", source:"Mitre 10", notes:"Painted pine reveal. Standard finish." },
    premium:{ description:"Primed MDF 90x18mm window reveal per lm", price:7.50, unit:"per lm", source:"Mitre 10", notes:"Knot free. Wider profile. Crisp painted result." }},

  { cat:"Wall Cladding", name:"Plaster texture coat",
    budget:{ description:"Rockcote Monobond acrylic texture coat 20kg", price:95, unit:"per 20kg", source:"Placemakers", notes:"Applied over Harditex. Basic acrylic finish." },
    premium:{ description:"Rockcote Roc-Render premium finish 20kg", price:145, unit:"per 20kg", source:"Placemakers", notes:"Richer colour depth, UV stable. Better long-term appearance." }},

  { cat:"Wall Cladding", name:"Cladding nails and screws",
    budget:{ description:"Galv clout nails 75mm 1kg", price:12, unit:"per kg", source:"Bunnings", notes:"Standard fixing for weatherboards." },
    premium:{ description:"Stainless ring shank nails 60mm 1kg", price:32, unit:"per kg", source:"Mitre 10", notes:"No rust staining on cedar. Coastal zone essential." }},

  // ─── INSULATION ──────────────────────────────────────────────────────────

  { cat:"Insulation", name:"Ceiling insulation",
    budget:{ description:"Pink Batts R2.8 150mm ceiling 8.14m²", price:88, unit:"per pack", source:"Mitre 10", notes:"Minimum H1 compliance for most NZ zones." },
    premium:{ description:"Bradford Gold R6.6 190mm ceiling 8.5m²", price:185, unit:"per pack", source:"Mitre 10", notes:"Double thermal performance. Recommended Zone 3 West Coast." }},

  { cat:"Insulation", name:"Wall insulation",
    budget:{ description:"Pink Batts R1.8 slimline wall 11.5m²", price:80, unit:"per pack", source:"Mitre 10", notes:"Suits 90mm stud. Minimum H1 Zone 1-2." },
    premium:{ description:"Pink Batts R2.8 wall 8.14m²", price:88, unit:"per pack", source:"Mitre 10", notes:"H1:2024 Zone 3+ requirement. West Coast standard." }},

  { cat:"Insulation", name:"Underfloor insulation",
    budget:{ description:"Reflective foil underfloor 30m roll", price:88, unit:"per 30m roll", source:"Mitre 10", notes:"Foil stapled to joists. Minimal R-value." },
    premium:{ description:"R2.2 glasswool underfloor batts 8.5m²", price:72, unit:"per pack", source:"Mitre 10", notes:"Bulk insulation. Far better thermal performance. Healthy Homes compliant." }},

  { cat:"Insulation", name:"Rigid foam board",
    budget:{ description:"XPS foam 25mm 2400x1200", price:52, unit:"per sheet", source:"Bunnings", notes:"Basic under-slab or internal insulation." },
    premium:{ description:"XPS foam 100mm 2400x600 R3.5", price:135, unit:"per sheet", source:"Bunnings", notes:"Required under slab in Zone 3 H1:2024. Significant energy savings." }},

  { cat:"Insulation", name:"Acoustic insulation",
    budget:{ description:"Pink Batts R2.0 acoustic 10.5m²", price:85, unit:"per pack", source:"Mitre 10", notes:"Basic acoustic. Reduces mid-frequency noise." },
    premium:{ description:"Knauf Earthwool acoustic 75mm 11m²", price:118, unit:"per pack", source:"Mitre 10", notes:"Superior NRC 0.95. Significantly better speech privacy." }},

  { cat:"Insulation", name:"Thermal break tape",
    budget:{ description:"Compriband foam tape 10x15mm 8m roll", price:18, unit:"per roll", source:"Mitre 10", notes:"Window and door frame thermal break." },
    premium:{ description:"Illbruck TP600 expanding foam tape 15m", price:42, unit:"per roll", source:"Placemakers", notes:"Self-expanding. Seals air, rain AND provides thermal break simultaneously." }},

  { cat:"Insulation", name:"Draught stopping",
    budget:{ description:"Door bottom sweep brush seal per lm", price:8.50, unit:"per lm", source:"Bunnings", notes:"Basic door bottom seal." },
    premium:{ description:"Automatic door bottom seal rises when opened", price:85, unit:"per unit", source:"Mitre 10", notes:"Zero gap when closed. Dramatically reduces draughts and noise." }},

  { cat:"Insulation", name:"Pipe insulation",
    budget:{ description:"Foam pipe lagging 22mm x 1m", price:4.50, unit:"per metre", source:"Bunnings", notes:"Basic pipe wrap. Prevents freezing and heat loss." },
    premium:{ description:"Armaflex Class O 22mm pipe insulation per m", price:12, unit:"per metre", source:"Placemakers", notes:"Superior R-value, moisture resistant, fire retardant. Commercial grade." }},

  { cat:"Insulation", name:"Window insulation film",
    budget:{ description:"Shrink window film kit 3 windows", price:22, unit:"per kit", source:"Bunnings", notes:"DIY seasonal. Adds R0.3 to existing single glaze." },
    premium:{ description:"3M Thinsulate window film per m² installed", price:85, unit:"per m² installed", source:"Market rate", notes:"Permanent. Nearly invisible. Full double-glaze thermal performance." }},

  // ─── INTERIOR LININGS ────────────────────────────────────────────────────

  { cat:"Interior Linings", name:"Wall lining",
    budget:{ description:"GIB Standard 10mm taper edge 2400x1200", price:16.50, unit:"per sheet", source:"Mitre 10", notes:"Standard interior wall. Good with insulation behind." },
    premium:{ description:"GIB Noiseline 10mm acoustic 2400x1200", price:38, unit:"per sheet", source:"Mitre 10", notes:"STC 4-6 points better. Meaningful soundproofing between rooms." }},

  { cat:"Interior Linings", name:"Ceiling lining",
    budget:{ description:"GIB Standard 13mm taper edge 2400x1200", price:19.50, unit:"per sheet", source:"Mitre 10", notes:"Standard ceiling sheet. More joins." },
    premium:{ description:"GIB Wideline 10mm 3600x1350", price:45, unit:"per sheet", source:"Mitre 10", notes:"Fewer joins. Cleaner finish. Worth it for open-plan living." }},

  { cat:"Interior Linings", name:"Wet area lining",
    budget:{ description:"GIB Aqualine 10mm 2400x1200", price:24, unit:"per sheet", source:"Mitre 10", notes:"Moisture resistant. Good tile substrate." },
    premium:{ description:"Aquapanel cement board 12.5mm 2400x900", price:85, unit:"per sheet", source:"Placemakers", notes:"Fully waterproof. Best substrate for floor-to-ceiling shower tiles." }},

  { cat:"Interior Linings", name:"Fire-rated lining",
    budget:{ description:"GIB Fyreline 13mm 2400x1200", price:32, unit:"per sheet", source:"Mitre 10", notes:"FRL 30/30/30. Garage to house separation." },
    premium:{ description:"GIB Fyreline 16mm 2400x1200", price:48, unit:"per sheet", source:"Mitre 10", notes:"FRL 60/60/60. Commercial separation or high-spec fire rating." }},

  { cat:"Interior Linings", name:"Stopping compound",
    budget:{ description:"GIB air-dry stopping compound 20kg", price:32, unit:"per pail", source:"Mitre 10", notes:"Standard joint compound." },
    premium:{ description:"GIB Tradeset 45 setting compound 10kg", price:28, unit:"per bag", source:"Mitre 10", notes:"Sets hard in 45 min. No shrinkage. Better for skimming." }},

  { cat:"Interior Linings", name:"Cornice",
    budget:{ description:"GIB standard cove cornice 55mm 5.4m", price:18, unit:"per 5.4m length", source:"Mitre 10", notes:"Standard curved cornice." },
    premium:{ description:"Primed plaster stepped cornice 75mm 3m", price:45, unit:"per 3m length", source:"Mitre 10", notes:"Architectural stepped profile. Statement look." }},

  { cat:"Interior Linings", name:"Skirting board",
    budget:{ description:"Pine 90x18mm square edge skirting per lm", price:4.50, unit:"per lm", source:"Mitre 10", notes:"Standard painted pine skirting." },
    premium:{ description:"MDF primed 133x18mm rebated skirting per lm", price:8.50, unit:"per lm", source:"Mitre 10", notes:"Knot free, taller profile, crisp paint finish." }},

  { cat:"Interior Linings", name:"Architrave",
    budget:{ description:"Pine 65x18mm colonial architrave per lm", price:3.50, unit:"per lm", source:"Mitre 10", notes:"Classic NZ profile." },
    premium:{ description:"MDF primed 95x18mm square set stop bead", price:7, unit:"per lm", source:"Mitre 10", notes:"Contemporary shadow gap detail. No architrave look. Premium result." }},

  { cat:"Interior Linings", name:"Wall panelling",
    budget:{ description:"Pine tongue and groove panelling 90mm per lm", price:5.50, unit:"per lm", source:"Mitre 10", notes:"Budget wall panel for dado feature areas." },
    premium:{ description:"Shadowclad 9mm plywood feature wall panels", price:98, unit:"per 2400x1200 sheet", source:"Placemakers", notes:"Dramatic vertical grain feature wall. Clear-coat for premium finish." }},

  // ─── WINDOWS & DOORS ─────────────────────────────────────────────────────

  { cat:"Windows & Doors", name:"Standard window 1200x900",
    budget:{ description:"Aluminium DG 1200x900 white powder coat", price:520, unit:"per unit", source:"Mitre 10", notes:"Standard frame. Meets minimum NZ energy code." },
    premium:{ description:"Thermally broken aluminium DG 1200x900", price:980, unit:"per unit", source:"Placemakers", notes:"30-40% better thermal performance. No condensation on frame." }},

  { cat:"Windows & Doors", name:"Large window 1800x1050",
    budget:{ description:"Aluminium DG 1800x1050 white powder coat", price:820, unit:"per unit", source:"Mitre 10", notes:"Standard large slider or awning." },
    premium:{ description:"Timber aluminium composite DG 1800x1050", price:1800, unit:"per unit", source:"Placemakers", notes:"Timber interior, aluminium exterior. Best thermal performance." }},

  { cat:"Windows & Doors", name:"Sliding door 2100x2100",
    budget:{ description:"Aluminium sliding door DG 2100x2100", price:2200, unit:"per unit", source:"Placemakers", notes:"Standard 3-panel slider." },
    premium:{ description:"Thermally broken bi-fold door DG 3600x2100", price:8500, unit:"per unit", source:"Placemakers", notes:"Full opening, flush threshold, premium hardware." }},

  { cat:"Windows & Doors", name:"Internal door",
    budget:{ description:"Hollow core moulded skin 2040x820 pre-primed", price:145, unit:"per unit", source:"Mitre 10", notes:"Lightweight. Poor sound insulation." },
    premium:{ description:"Solid timber 2040x820 pre-primed pine", price:480, unit:"per unit", source:"Placemakers", notes:"Far better soundproofing. Better feel. Paints beautifully." }},

  { cat:"Windows & Doors", name:"External entry door",
    budget:{ description:"Solid pine external door 2040x920", price:620, unit:"per unit", source:"Mitre 10", notes:"Traditional timber. Requires regular painting." },
    premium:{ description:"Fibreglass insulated external door 2040x920", price:1800, unit:"per unit", source:"Placemakers", notes:"No warping. Better thermal. Very low maintenance." }},

  { cat:"Windows & Doors", name:"External door hardware",
    budget:{ description:"Lever set with deadbolt keyed alike", price:145, unit:"per set", source:"Mitre 10", notes:"Standard chrome lever. Functional." },
    premium:{ description:"Gainsborough 700 digital keypad lock", price:485, unit:"per set", source:"Mitre 10", notes:"Keypad + key entry. Smart home compatible." }},

  { cat:"Windows & Doors", name:"Internal door hardware",
    budget:{ description:"Chrome passage privacy lever set", price:45, unit:"per set", source:"Mitre 10", notes:"Standard white or chrome." },
    premium:{ description:"Dormakaba matte black lever set", price:145, unit:"per set", source:"Mitre 10", notes:"Architectural grade. Elevates every room." }},

  { cat:"Windows & Doors", name:"Cavity slider kit",
    budget:{ description:"Cavity slider kit 2040x820 stud-to-stud", price:385, unit:"per unit", source:"Mitre 10", notes:"Standard cavity slider. Saves door swing space." },
    premium:{ description:"Heavy duty soft-close cavity slider 2040x920", price:680, unit:"per unit", source:"Mitre 10", notes:"Soft close, heavier door rating. Far quieter operation." }},

  { cat:"Windows & Doors", name:"Window sill",
    budget:{ description:"Pine window sill 140x40mm per lm", price:6.50, unit:"per lm", source:"Mitre 10", notes:"Painted pine. Basic." },
    premium:{ description:"Aluminium extruded window sill per lm", price:22, unit:"per lm", source:"Mitre 10", notes:"No rot, crisp profile, zero maintenance." }},

  { cat:"Windows & Doors", name:"Louvre window",
    budget:{ description:"PVC framed louvre window 1200x450", price:180, unit:"per unit", source:"Mitre 10", notes:"Budget ventilation. Not secure." },
    premium:{ description:"Breezway Altair louvre 1200x600 aluminium", price:650, unit:"per unit", source:"Placemakers", notes:"Secure, 100% openable. Excellent cross-ventilation." }},

  // ─── FLOORING ────────────────────────────────────────────────────────────

  { cat:"Flooring", name:"Main living flooring",
    budget:{ description:"Vinyl plank 3mm click-lock basic", price:28, unit:"per m²", source:"Mitre 10", notes:"Warm, waterproof, DIY-friendly. 10yr warranty." },
    premium:{ description:"Engineered hardwood 190mm wide board", price:145, unit:"per m²", source:"Placemakers", notes:"Real timber face. Sandable. 25+ yr lifespan." }},

  { cat:"Flooring", name:"Vinyl plank premium",
    budget:{ description:"Vinyl plank 5mm click-lock mid range", price:48, unit:"per m²", source:"Mitre 10", notes:"2mm underlay attached. Good domestic use." },
    premium:{ description:"Vinyl plank 8mm commercial grade", price:72, unit:"per m²", source:"Mitre 10", notes:"Acoustic underlay attached. Investment property grade." }},

  { cat:"Flooring", name:"Wet area floor tiles",
    budget:{ description:"Ceramic tile 300x300mm glazed domestic", price:28, unit:"per m²", source:"Mitre 10", notes:"Basic. 4 star slip rating." },
    premium:{ description:"Large format porcelain 600x1200mm rectified", price:95, unit:"per m²", source:"Mitre 10", notes:"Fewer grout lines. Very contemporary. Requires flat substrate." }},

  { cat:"Flooring", name:"Bedroom carpet",
    budget:{ description:"Basic flatweave carpet 80% nylon", price:28, unit:"per m²", source:"Mitre 10", notes:"Entry-level. 5-7yr lifespan." },
    premium:{ description:"100% NZ wool plush pile carpet", price:130, unit:"per m²", source:"Mitre 10", notes:"Hypoallergenic, resilient, flame retardant. 15+ yr lifespan." }},

  { cat:"Flooring", name:"Carpet underlay",
    budget:{ description:"10mm foam chip underlay", price:12, unit:"per m²", source:"Mitre 10", notes:"Standard comfort underlay." },
    premium:{ description:"12mm memory foam acoustic underlay", price:22, unit:"per m²", source:"Mitre 10", notes:"Better sound absorption. Extends carpet life." }},

  { cat:"Flooring", name:"Tile adhesive",
    budget:{ description:"Standard grey cement adhesive 20kg", price:28, unit:"per bag", source:"Bunnings", notes:"Standard floor and wall tile adhesive." },
    premium:{ description:"Flexible rapid-set large format adhesive 20kg", price:55, unit:"per bag", source:"Bunnings", notes:"Required for 600mm+ tiles. Polymer flex prevents cracking." }},

  { cat:"Flooring", name:"Grout",
    budget:{ description:"Sanded cement grout 5kg grey", price:22, unit:"per bag", source:"Bunnings", notes:"Standard joint grout." },
    premium:{ description:"Mapei Ultracolor Plus epoxy-modified 5kg", price:48, unit:"per bag", source:"Placemakers", notes:"Stain proof, non-shrink, fast set. No sealing needed." }},

  { cat:"Flooring", name:"Underfloor heating",
    budget:{ description:"Electric mat heating per m² bathroom", price:95, unit:"per m² installed", source:"Mitre 10", notes:"Under-tile electric. Easy to install." },
    premium:{ description:"Hydronic underfloor heating per m² installed", price:280, unit:"per m² installed", source:"Market rate", notes:"Hot water through pipes. Lower running costs. Whole-house comfort." }},

  { cat:"Flooring", name:"Waterproof membrane",
    budget:{ description:"Acrylic waterproofing membrane 4kg", price:65, unit:"per 4kg", source:"Mitre 10", notes:"Basic painted-on membrane for wet areas." },
    premium:{ description:"Ardex 8+9 2-part waterproof membrane 5kg", price:95, unit:"per kit", source:"Placemakers", notes:"BRANZ appraised. Sheet membrane option. Highest durability." }},

  { cat:"Flooring", name:"Floor levelling compound",
    budget:{ description:"DIY floor leveller 20kg basic", price:28, unit:"per bag", source:"Bunnings", notes:"For minor undulations under vinyl or tiles." },
    premium:{ description:"Mapei Ultraplan flow compound 25kg", price:55, unit:"per bag", source:"Placemakers", notes:"Self-levelling, pumpable. Suitable under any floor covering." }},

  { cat:"Flooring", name:"Stair nosings",
    budget:{ description:"Aluminium stair nose trim 900mm", price:22, unit:"per unit", source:"Mitre 10", notes:"Basic aluminium edge protection." },
    premium:{ description:"Schluter-SCHIENE stainless stair nosing", price:58, unit:"per unit", source:"Placemakers", notes:"Architectural grade stainless. Crisp edge. Matches premium tile work." }},

  // ─── KITCHEN & APPLIANCES ────────────────────────────────────────────────

  { cat:"Kitchen & Appliances", name:"Kitchen cabinetry 3m run",
    budget:{ description:"Flat pack melamine kitchen 3m run basic", price:3200, unit:"per 3lm run", source:"Mitre 10", notes:"DIY flat pack. Functional standard finish." },
    premium:{ description:"Custom painted MDF kitchen 3m run", price:18000, unit:"per 3lm run", source:"Market rate", notes:"Fully custom. Soft-close, blum runners, 2-pack paint. Adds significant value." }},

  { cat:"Kitchen & Appliances", name:"Benchtop",
    budget:{ description:"Laminate benchtop 38mm per lm", price:110, unit:"per lm", source:"Mitre 10", notes:"Wide colour range. Easy DIY install." },
    premium:{ description:"Dekton ultra-compact stone per lm installed", price:950, unit:"per lm installed", source:"Market rate", notes:"Scratch, heat and stain proof. No sealing required." }},

  { cat:"Kitchen & Appliances", name:"Kitchen tap",
    budget:{ description:"Chrome single lever kitchen mixer", price:195, unit:"per unit", source:"Mitre 10", notes:"Standard functional mixer." },
    premium:{ description:"Grohe Essence pull-out spray mixer", price:780, unit:"per unit", source:"Placemakers", notes:"German engineered. Pull-out spray. Lifetime finish warranty." }},

  { cat:"Kitchen & Appliances", name:"Kitchen sink",
    budget:{ description:"S/S 1.5 bowl undermount 860x500mm", price:320, unit:"per unit", source:"Mitre 10", notes:"Standard stainless. Good all-round performer." },
    premium:{ description:"Fireclay farmhouse apron-front sink 800mm", price:1350, unit:"per unit", source:"Placemakers", notes:"Extremely durable. Statement piece. Classic aesthetic." }},

  { cat:"Kitchen & Appliances", name:"Dishwasher",
    budget:{ description:"F&P dishwasher DD60D integrated 14 place", price:999, unit:"per unit", source:"Mitre 10", notes:"NZ brand. Reliable. Good entry-level choice." },
    premium:{ description:"Miele G7000 fully integrated 14 place", price:2899, unit:"per unit", source:"Market rate", notes:"AutoDos auto-detergent. Quietest in class. 20yr lifespan." }},

  { cat:"Kitchen & Appliances", name:"Refrigerator",
    budget:{ description:"Samsung 400L French door frost free", price:1299, unit:"per unit", source:"Mitre 10", notes:"Good family size. 5 star energy rating." },
    premium:{ description:"F&P 790L ActiveSmart RF610", price:5499, unit:"per unit", source:"Market rate", notes:"Large family. ActiveSmart technology adapts to usage patterns." }},

  { cat:"Kitchen & Appliances", name:"Cooktop",
    budget:{ description:"Basic induction cooktop 60cm 4 zone", price:499, unit:"per unit", source:"Mitre 10", notes:"Functional. Easy clean." },
    premium:{ description:"Miele 90cm induction TempControl", price:3200, unit:"per unit", source:"Market rate", notes:"TempControl prevents burning. PowerFlex zone. Flush installation." }},

  { cat:"Kitchen & Appliances", name:"Oven",
    budget:{ description:"Basic electric 60cm multi-function 70L", price:699, unit:"per unit", source:"Mitre 10", notes:"Standard cooking functions." },
    premium:{ description:"Miele H7860BP pyrolytic steam oven", price:3800, unit:"per unit", source:"Market rate", notes:"Pyrolytic self-cleaning, steam injection. Professional results." }},

  { cat:"Kitchen & Appliances", name:"Rangehood",
    budget:{ description:"Canopy rangehood 600mm ducted", price:349, unit:"per unit", source:"Mitre 10", notes:"Standard extraction." },
    premium:{ description:"Fully integrated concealed rangehood 900mm", price:1800, unit:"per unit", source:"Market rate", notes:"Hidden behind cabinet. Very quiet. Perfect for open-plan kitchens." }},

  { cat:"Kitchen & Appliances", name:"Washing machine",
    budget:{ description:"F&P 7.5kg top loader WA7560", price:899, unit:"per unit", source:"Mitre 10", notes:"Reliable NZ brand. 5yr warranty." },
    premium:{ description:"Miele W1 front loader 8kg TWF160", price:2699, unit:"per unit", source:"Market rate", notes:"20yr motor warranty. Honeycomb drum. Energy rating A." }},

  { cat:"Kitchen & Appliances", name:"Clothes dryer",
    budget:{ description:"F&P 7kg vented dryer DE7060", price:749, unit:"per unit", source:"Mitre 10", notes:"Basic vented. Requires external duct." },
    premium:{ description:"Miele T1 heat pump dryer 8kg", price:2499, unit:"per unit", source:"Market rate", notes:"No vent needed. 50% less energy. Gentler on fabrics." }},

  { cat:"Kitchen & Appliances", name:"Splashback",
    budget:{ description:"Ceramic splashback tile 200x100mm per m²", price:45, unit:"per m²", source:"Mitre 10", notes:"Standard tile splashback. Grout lines to clean." },
    premium:{ description:"Toughened glass splashback per m² installed", price:350, unit:"per m² installed", source:"Market rate", notes:"Seamless, easy clean. Any colour. Transforms kitchen." }},

  { cat:"Kitchen & Appliances", name:"Kitchen handles",
    budget:{ description:"Chrome bar handle 128mm centre", price:8.50, unit:"per unit", source:"Bunnings", notes:"Standard chrome. Functional." },
    premium:{ description:"Matte black square profile handle 160mm", price:22, unit:"per unit", source:"Mitre 10", notes:"Architectural profile. Transforms flat-pack into premium look." }},

  { cat:"Kitchen & Appliances", name:"Wine fridge",
    budget:{ description:"60L bar fridge underbench", price:299, unit:"per unit", source:"Mitre 10", notes:"Basic underbench bar fridge." },
    premium:{ description:"Liebherr 30-bottle wine fridge WKb 1712", price:1299, unit:"per unit", source:"Market rate", notes:"Dual zone. UV-protected glass. Perfect serving temps." }},

  { cat:"Kitchen & Appliances", name:"Microwave",
    budget:{ description:"Standard countertop microwave 1000W", price:189, unit:"per unit", source:"Mitre 10", notes:"Freestanding. Basic functions." },
    premium:{ description:"Miele M7 built-in microwave combination", price:2200, unit:"per unit", source:"Market rate", notes:"Built-in flush fit. Combination microwave, grill, oven." }},

  // ─── BATHROOM & LAUNDRY ──────────────────────────────────────────────────

  { cat:"Bathroom & Laundry", name:"Toilet suite",
    budget:{ description:"Wall-faced close coupled dual flush", price:420, unit:"per unit", source:"Mitre 10", notes:"Standard NZ toilet. Easy install." },
    premium:{ description:"Geberit wall-hung with concealed cistern", price:1850, unit:"per unit", source:"Placemakers", notes:"Tiled wall. Easy cleaning. Saves 200mm floor space." }},

  { cat:"Bathroom & Laundry", name:"Basin",
    budget:{ description:"Semi-recessed ceramic basin 500mm", price:280, unit:"per unit", source:"Mitre 10", notes:"Standard ceramic. Includes waste." },
    premium:{ description:"Stone vessel basin freestanding round", price:980, unit:"per unit", source:"Market rate", notes:"Statement piece. Travertine or composite stone." }},

  { cat:"Bathroom & Laundry", name:"Vanity unit",
    budget:{ description:"Flat pack vanity 600mm with basin", price:620, unit:"per unit", source:"Mitre 10", notes:"Standard MDF carcass. Functional." },
    premium:{ description:"Custom solid oak vanity 1200mm stone top", price:3500, unit:"per unit", source:"Market rate", notes:"Bespoke solid timber, stone top, undermount, soft-close." }},

  { cat:"Bathroom & Laundry", name:"Shower",
    budget:{ description:"Acrylic shower unit 900x900 all-in-one", price:650, unit:"per unit", source:"Mitre 10", notes:"Fast install, no tiling. Good for rentals." },
    premium:{ description:"Full tiled shower 1200x900 with niche installed", price:4500, unit:"per unit installed", source:"Market rate", notes:"Waterproofing, tiles, niche, frameless screen. 30-40yr lifespan." }},

  { cat:"Bathroom & Laundry", name:"Shower screen",
    budget:{ description:"Semi-frameless shower screen 900mm", price:480, unit:"per unit", source:"Mitre 10", notes:"Standard framed or semi-framed." },
    premium:{ description:"Frameless 10mm toughened glass 900mm", price:950, unit:"per unit", source:"Mitre 10", notes:"No frame to corrode. Easy clean. Luxury look." }},

  { cat:"Bathroom & Laundry", name:"Bath",
    budget:{ description:"Acrylic alcove bath 1500mm white", price:620, unit:"per unit", source:"Mitre 10", notes:"Standard NZ bath." },
    premium:{ description:"Stone resin freestanding bath 1700mm", price:4200, unit:"per unit", source:"Market rate", notes:"Stays warm 5x longer. Extremely durable. Transforms room." }},

  { cat:"Bathroom & Laundry", name:"Shower mixer",
    budget:{ description:"Concealed thermostatic shower mixer chrome", price:320, unit:"per unit", source:"Mitre 10", notes:"Standard concealed." },
    premium:{ description:"Grohe Grohtherm SmartControl 260", price:1200, unit:"per unit", source:"Placemakers", notes:"Digital temperature memory. Anti-scald. Volume control." }},

  { cat:"Bathroom & Laundry", name:"Basin tap",
    budget:{ description:"Chrome single lever basin mixer", price:145, unit:"per unit", source:"Mitre 10", notes:"Standard chrome." },
    premium:{ description:"Hansgrohe Talis S basin mixer matte black", price:520, unit:"per unit", source:"Placemakers", notes:"German precision. Ceramic cartridge. No fingerprints." }},

  { cat:"Bathroom & Laundry", name:"Bath tap filler",
    budget:{ description:"Deck-mounted bath mixer chrome", price:280, unit:"per unit", source:"Mitre 10", notes:"Standard bath tap." },
    premium:{ description:"Freestanding bath floor-mounted filler", price:1200, unit:"per unit", source:"Placemakers", notes:"Statement piece. Floor-standing swan neck. Pairs with freestanding bath." }},

  { cat:"Bathroom & Laundry", name:"Heated towel rail",
    budget:{ description:"Electric heated towel rail 600mm chrome", price:245, unit:"per unit", source:"Mitre 10", notes:"Standard ladder rail." },
    premium:{ description:"Designer flat panel heated rail 1200mm", price:850, unit:"per unit", source:"Mitre 10", notes:"Larger surface heats bathroom faster. Timer option." }},

  { cat:"Bathroom & Laundry", name:"Bathroom mirror",
    budget:{ description:"Mirror cabinet 600mm single door stainless", price:280, unit:"per unit", source:"Mitre 10", notes:"Storage and mirror." },
    premium:{ description:"LED illuminated mirror 900mm with demister", price:680, unit:"per unit", source:"Mitre 10", notes:"Halo lighting, demister pad, touch sensor. No foggy mirror." }},

  { cat:"Bathroom & Laundry", name:"Bathroom accessories set",
    budget:{ description:"Chrome accessory set — rail, ring, holder", price:85, unit:"per set", source:"Mitre 10", notes:"Basic chrome set. Towel rail, toilet roll, robe hook." },
    premium:{ description:"Matte black architectural accessory set", price:280, unit:"per set", source:"Mitre 10", notes:"Matching matte black. Transforms bathroom. Stays clean." }},

  { cat:"Bathroom & Laundry", name:"Laundry tub",
    budget:{ description:"Polyethylene laundry tub 45L with brackets", price:185, unit:"per unit", source:"Mitre 10", notes:"Standard plastic laundry tub." },
    premium:{ description:"Fireclay undermount laundry sink 500mm", price:680, unit:"per unit", source:"Placemakers", notes:"Durable fireclay. Flush undermount. Looks as good as kitchen." }},

  { cat:"Bathroom & Laundry", name:"Shower niche",
    budget:{ description:"Plastic recessed shower niche 300x300mm", price:45, unit:"per unit", source:"Mitre 10", notes:"Snap-in plastic. Pre-tiled." },
    premium:{ description:"Schluter SHELF-N aluminium niche 300x300", price:185, unit:"per unit", source:"Placemakers", notes:"Stainless shelf. No tiling issues. Drain channel option." }},

  // ─── PLUMBING ────────────────────────────────────────────────────────────

  { cat:"Plumbing", name:"Water supply pipe",
    budget:{ description:"Blue poly pipe 25mm flexible per lm", price:4.50, unit:"per lm", source:"Bunnings", notes:"Standard NZ residential. Easy to run." },
    premium:{ description:"Copper tube 25mm Type B per lm", price:24, unit:"per lm", source:"Placemakers", notes:"Antimicrobial. 50+ yr lifespan. Adds value at sale." }},

  { cat:"Plumbing", name:"Drainage pipe",
    budget:{ description:"PVC drainage 100mm SN4 per lm", price:12, unit:"per lm", source:"Placemakers", notes:"Standard plastic drain." },
    premium:{ description:"Cast iron drain pipe 100mm per lm", price:45, unit:"per lm", source:"Placemakers", notes:"Near-silent drainage. Used in premium apartments. 100+ yr lifespan." }},

  { cat:"Plumbing", name:"Hot water system",
    budget:{ description:"Electric cylinder 180L mains pressure", price:1480, unit:"per unit", source:"Placemakers", notes:"Standard NZ HWC. ~$800-1000/yr running cost." },
    premium:{ description:"Heat pump water heater 250L", price:3200, unit:"per unit", source:"Placemakers", notes:"75% cheaper to run. 4-6yr payback. EECA rebate eligible." }},

  { cat:"Plumbing", name:"Shower tray",
    budget:{ description:"Acrylic shower tray 900x900 low profile", price:320, unit:"per unit", source:"Mitre 10", notes:"Standard tray. Warm underfoot." },
    premium:{ description:"Tile-in linear drain wetroom kit 900x900", price:850, unit:"per unit", source:"Placemakers", notes:"Flush floor. Seamless tiled look. Requires waterproof membrane." }},

  { cat:"Plumbing", name:"Ball valve",
    budget:{ description:"Brass ball valve 15mm BSP full bore", price:28, unit:"per unit", source:"Bunnings", notes:"Standard isolation valve." },
    premium:{ description:"Stainless steel ball valve 25mm full bore", price:65, unit:"per unit", source:"Placemakers", notes:"Long-life. Required for chemical or coastal environments." }},

  { cat:"Plumbing", name:"Pressure reducing valve",
    budget:{ description:"Brass PRV 15mm adjustable 150-850 kPa", price:75, unit:"per unit", source:"Placemakers", notes:"Protects fittings from high pressure." },
    premium:{ description:"Reliance PRV with gauge and bypass 20mm", price:195, unit:"per unit", source:"Placemakers", notes:"Visual gauge, easy adjustment. Better for monitoring pressure." }},

  { cat:"Plumbing", name:"Floor waste",
    budget:{ description:"PVC floor waste 100mm square chrome grate", price:35, unit:"per unit", source:"Mitre 10", notes:"Standard floor waste." },
    premium:{ description:"Stainless tile-in linear floor drain 600mm", price:185, unit:"per unit", source:"Mitre 10", notes:"Low-profile, invisible grate. Premium wet-room aesthetic." }},

  { cat:"Plumbing", name:"P-trap",
    budget:{ description:"Chrome bottle P-trap 40mm", price:22, unit:"per unit", source:"Mitre 10", notes:"Standard basin waste trap." },
    premium:{ description:"Push-fit flexible P-trap 32-40mm universal", price:35, unit:"per unit", source:"Mitre 10", notes:"Adjustable, snap connection. Good for retrofits." }},

  { cat:"Plumbing", name:"Tempering valve",
    budget:{ description:"Standard tempering valve 45C WRAS", price:75, unit:"per unit", source:"Placemakers", notes:"Required by NZ code. Prevents scalding." },
    premium:{ description:"Caleffi thermostatic mixing valve 20mm", price:145, unit:"per unit", source:"Placemakers", notes:"More accurate temp control. Longer lifespan. Easier servicing." }},

  { cat:"Plumbing", name:"Sink waste kit",
    budget:{ description:"PVC sink waste kit 40mm basket strainer", price:25, unit:"per kit", source:"Bunnings", notes:"Standard kitchen and laundry waste." },
    premium:{ description:"Stainless under-mount waste kit 90mm", price:95, unit:"per kit", source:"Mitre 10", notes:"Suits premium undermount sinks. Clean under-bench look." }},

  // ─── ELECTRICAL ──────────────────────────────────────────────────────────

  { cat:"Electrical", name:"Power outlets",
    budget:{ description:"Clipsal 2000 double GPO 15A white", price:22, unit:"per unit", source:"Mitre 10", notes:"Standard white outlet." },
    premium:{ description:"Clipsal Saturn GPO USB-A/C brushed aluminium", price:95, unit:"per unit", source:"Mitre 10", notes:"Built-in USB charging. Premium finish." }},

  { cat:"Electrical", name:"Downlights",
    budget:{ description:"LED downlight 10W dimmable 900 lumen", price:32, unit:"per unit", source:"Mitre 10", notes:"Standard recessed LED." },
    premium:{ description:"DALI smart downlight 10W colour tunable", price:85, unit:"per unit", source:"Mitre 10", notes:"Tune 2700-6500K. App controlled. Groups with voice assistants." }},

  { cat:"Electrical", name:"Light switches",
    budget:{ description:"Clipsal 2000 single switch white", price:18, unit:"per unit", source:"Mitre 10", notes:"Standard white plastic." },
    premium:{ description:"Clipsal Saturn screwless switch matte black", price:55, unit:"per unit", source:"Mitre 10", notes:"Premium flush plate. Elevates every room." }},

  { cat:"Electrical", name:"Heat pump space heating",
    budget:{ description:"Mitsubishi MSZ-AP25 2.5kW wall split", price:1399, unit:"per unit", source:"Mitre 10", notes:"Efficient. Good to 30m². COP 5.0." },
    premium:{ description:"Mitsubishi Zuba-Central 5kW cold climate", price:4500, unit:"per unit", source:"Market rate", notes:"Operates -25C. Whole-home ducted option. Best for West Coast." }},

  { cat:"Electrical", name:"Smoke alarms",
    budget:{ description:"Photoelectric smoke alarm 10yr battery", price:48, unit:"per unit", source:"Mitre 10", notes:"Standalone. NZ Building Code compliant." },
    premium:{ description:"Interconnected hardwired photoelectric system", price:145, unit:"per unit", source:"Mitre 10", notes:"All alarms trigger together. Required in new builds." }},

  { cat:"Electrical", name:"Switchboard",
    budget:{ description:"20-way consumer unit standard MCBs", price:280, unit:"per unit", source:"Placemakers", notes:"Standard residential switchboard." },
    premium:{ description:"Smart load monitoring switchboard 24-way", price:1200, unit:"per unit", source:"Placemakers", notes:"Per-circuit energy monitoring. App alerts. EV and solar ready." }},

  { cat:"Electrical", name:"Supply cable 2.5mm",
    budget:{ description:"2.5mm twin and earth per lm standard", price:3.20, unit:"per lm", source:"Mitre 10", notes:"General power circuits." },
    premium:{ description:"2.5mm armoured SWA cable per lm", price:8.50, unit:"per lm", source:"Placemakers", notes:"For underground runs and external installations. Crush resistant." }},

  { cat:"Electrical", name:"EV charger",
    budget:{ description:"7.4kW single-phase EV charger tethered", price:850, unit:"per unit installed", source:"Market rate", notes:"Suits most EVs. 25km range per hour charge." },
    premium:{ description:"22kW three-phase smart EV charger", price:2200, unit:"per unit installed", source:"Market rate", notes:"3x faster charge. Load balancing. App control. Future-proof." }},

  { cat:"Electrical", name:"Security system",
    budget:{ description:"Basic alarm system 4 zones and siren", price:480, unit:"per system installed", source:"Market rate", notes:"Entry-level monitored alarm." },
    premium:{ description:"Ajax smart security full home system", price:2200, unit:"per system installed", source:"Market rate", notes:"App control, pet-immune sensors, cellular backup." }},

  { cat:"Electrical", name:"Exterior lighting",
    budget:{ description:"PIR floodlight 150W LED surface mount", price:65, unit:"per unit", source:"Mitre 10", notes:"Motion sensor. Functional security lighting." },
    premium:{ description:"Low-voltage garden path lighting kit 8 lights", price:285, unit:"per kit", source:"Mitre 10", notes:"Solar or 12V. Transforms kerb appeal at night." }},

  { cat:"Electrical", name:"Extractor fans",
    budget:{ description:"Bathroom extractor fan 150mm 240v", price:65, unit:"per unit", source:"Mitre 10", notes:"Standard ceiling fan. No timer." },
    premium:{ description:"Whisper Green DC exhaust fan timer and humidity", price:185, unit:"per unit", source:"Mitre 10", notes:"Ultra-quiet. Humidity sensor auto-runs. Near-silent." }},

  { cat:"Electrical", name:"Data and network points",
    budget:{ description:"Single CAT6 data point installed", price:85, unit:"per point installed", source:"Market rate", notes:"Standard ethernet. 1Gbit speed." },
    premium:{ description:"CAT6A double data point with patch panel", price:165, unit:"per point installed", source:"Market rate", notes:"10Gbit ready. Future-proof for 4K streaming and NAS." }},

  { cat:"Electrical", name:"Solar power system",
    budget:{ description:"3kW solar system 8 panels installed", price:8500, unit:"per system installed", source:"Market rate", notes:"Reduces power bill 30-40%. 5-7yr payback." },
    premium:{ description:"10kW solar plus 10kWh battery storage installed", price:28000, unit:"per system installed", source:"Market rate", notes:"Near off-grid capable. Backup during outages. 7-10yr payback." }},

  // ─── PAINTING & COATINGS ─────────────────────────────────────────────────

  { cat:"Painting & Coatings", name:"Interior wall paint",
    budget:{ description:"Dulux Wash and Wear low sheen 10L", price:128, unit:"per 10L", source:"Mitre 10", notes:"Covers ~120m². Washable, durable." },
    premium:{ description:"Resene premium EzyCoat low sheen 10L", price:198, unit:"per 10L", source:"Mitre 10", notes:"Self-priming, better coverage, richer colour depth." }},

  { cat:"Painting & Coatings", name:"Exterior paint",
    budget:{ description:"Dulux Weathershield semi-gloss 10L", price:155, unit:"per 10L", source:"Mitre 10", notes:"10yr exterior warranty." },
    premium:{ description:"Resene X-200 semi-gloss 10L", price:172, unit:"per 10L", source:"Mitre 10", notes:"15yr warranty. Better UV and moisture resistance for NZ conditions." }},

  { cat:"Painting & Coatings", name:"Primer",
    budget:{ description:"Standard primer sealer white 10L", price:98, unit:"per 10L", source:"Mitre 10", notes:"General purpose interior and exterior." },
    premium:{ description:"Resene Quick Dry high-build primer 10L", price:145, unit:"per 10L", source:"Mitre 10", notes:"Fills imperfections. Reduces topcoat coats. Seals stains." }},

  { cat:"Painting & Coatings", name:"Trim paint",
    budget:{ description:"Basic semi-gloss trim enamel 4L", price:72, unit:"per 4L", source:"Mitre 10", notes:"For skirtings, architraves and doors." },
    premium:{ description:"Resene Lustacryl semi-gloss 4L", price:98, unit:"per 4L", source:"Mitre 10", notes:"Self-levelling. No brush marks. Hard finish for high-traffic areas." }},

  { cat:"Painting & Coatings", name:"Deck stain and oil",
    budget:{ description:"Cabots Decking Oil clear or tint 4L", price:55, unit:"per 4L", source:"Mitre 10", notes:"Annual application on pine deck." },
    premium:{ description:"Resene Kwila Timber Stain tinted 4L", price:82, unit:"per 4L", source:"Mitre 10", notes:"Penetrates deeper. 2yr recoat cycle. Protects UV and moisture." }},

  { cat:"Painting & Coatings", name:"Concrete floor coating",
    budget:{ description:"Acrylic concrete paint 4L", price:45, unit:"per 4L", source:"Bunnings", notes:"Basic painted finish on concrete floor." },
    premium:{ description:"2-pack epoxy floor coating 4L kit", price:145, unit:"per kit", source:"Bunnings", notes:"Chemical resistant, high gloss, 10x harder than acrylic." }},

  { cat:"Painting & Coatings", name:"Waterproofing membrane",
    budget:{ description:"Acrylic waterproof paint 4kg", price:65, unit:"per 4kg", source:"Mitre 10", notes:"Basic painted-on waterproofing for wet areas." },
    premium:{ description:"Sika liquid waterproofing 2-component 6kg", price:120, unit:"per kit", source:"Placemakers", notes:"Crack-bridging, BRANZ appraised. Required under tiled showers." }},

  { cat:"Painting & Coatings", name:"Render and plaster coat",
    budget:{ description:"Rockcote Monobond acrylic texture 20kg", price:95, unit:"per 20kg", source:"Placemakers", notes:"Applied over Harditex. Basic acrylic exterior." },
    premium:{ description:"Rockcote Roc-Render premium finish 20kg", price:145, unit:"per 20kg", source:"Placemakers", notes:"Richer depth, UV stable. Better long-term colour retention." }},

  // ─── EXTERNAL WORKS ──────────────────────────────────────────────────────

  { cat:"External Works", name:"Fence posts",
    budget:{ description:"100x100mm H4 CCA pine post 2400mm", price:52, unit:"per post", source:"Mitre 10", notes:"Standard NZ fence post. 15-20yr ground life." },
    premium:{ description:"65x65mm powder-coated aluminium post 2400mm", price:85, unit:"per post", source:"Mitre 10", notes:"Never rots. Zero maintenance. 50+ yr lifespan." }},

  { cat:"External Works", name:"Fence panels",
    budget:{ description:"150x25mm H3.2 pine paling 1800mm", price:10.50, unit:"per paling", source:"Mitre 10", notes:"Traditional timber. Paint every 5-7 years." },
    premium:{ description:"Aluminium slat panel 1800x1800 powder-coated", price:385, unit:"per panel", source:"Mitre 10", notes:"Zero maintenance. Modern aesthetic. Any colour. 50+ yr." }},

  { cat:"External Works", name:"Deck boards",
    budget:{ description:"H3.2 radiata pine decking 140x19mm per lm", price:8, unit:"per lm", source:"Mitre 10", notes:"Budget NZ decking. Oil annually." },
    premium:{ description:"Kwila hardwood decking 90x19mm per lm", price:22, unit:"per lm", source:"Placemakers", notes:"30+ yr lifespan. Natural oil. Premium look." }},

  { cat:"External Works", name:"Deck framing",
    budget:{ description:"H3.2 pine joist 140x45mm per lm", price:10, unit:"per lm", source:"Mitre 10", notes:"Standard deck subframe." },
    premium:{ description:"H4 treated pine joist 140x45mm per lm", price:13, unit:"per lm", source:"Mitre 10", notes:"Higher treatment for coastal and high-rainfall West Coast." }},

  { cat:"External Works", name:"Driveway surface",
    budget:{ description:"Chip seal tarseal driveway installed", price:45, unit:"per m² installed", source:"Market rate", notes:"Low cost. Reseal every 5-7 years." },
    premium:{ description:"Exposed aggregate concrete driveway installed", price:125, unit:"per m² installed", source:"Market rate", notes:"30+ yr lifespan. Zero maintenance. Huge kerb appeal." }},

  { cat:"External Works", name:"Pathways",
    budget:{ description:"Concrete pavers 400x400x40mm grey", price:9.50, unit:"per unit", source:"Mitre 10", notes:"Basic pressed concrete." },
    premium:{ description:"Bluestone natural stone pavers 600x400x30mm", price:65, unit:"per m²", source:"Placemakers", notes:"Premium stone. Non-slip. Adds real property value." }},

  { cat:"External Works", name:"Retaining wall",
    budget:{ description:"Concrete block 390x190x190mm per block", price:5.50, unit:"per block", source:"Mitre 10", notes:"Gravity wall up to 600mm. Basic." },
    premium:{ description:"Keystone Premier interlocking block per m² installed", price:185, unit:"per m² installed", source:"Market rate", notes:"Engineered geogrid for walls up to 3m+. Decorative face." }},

  { cat:"External Works", name:"Steps",
    budget:{ description:"Concrete masonry step 900x350x150mm", price:32, unit:"per step", source:"Mitre 10", notes:"Basic precast step. Functional." },
    premium:{ description:"Bluestone step 1200x400x50mm installed", price:165, unit:"per step installed", source:"Market rate", notes:"Premium stone. Complements premium pathway and driveway." }},

  { cat:"External Works", name:"Garden edging",
    budget:{ description:"Steel garden edge bender 3m roll", price:28, unit:"per 3m", source:"Mitre 10", notes:"Flexible steel lawn edging." },
    premium:{ description:"Cor-Ten weathering steel edging 3mm x 150mm", price:65, unit:"per 3m", source:"Placemakers", notes:"Weathers to rich orange-brown. Architectural landscape edge." }},

  { cat:"External Works", name:"Clothesline",
    budget:{ description:"Hills Rotary clothesline 45m line", price:220, unit:"per unit", source:"Mitre 10", notes:"Classic NZ rotary. Folds down." },
    premium:{ description:"Hills Retractaway wall-mount 4-line 15m", price:285, unit:"per unit", source:"Mitre 10", notes:"Retracts fully into wall. No clothesline in view." }},

  { cat:"External Works", name:"Letterbox",
    budget:{ description:"Plastic letterbox post-mount", price:35, unit:"per unit", source:"Bunnings", notes:"Basic. Functional." },
    premium:{ description:"Stainless steel architectural letterbox flush-mount", price:285, unit:"per unit", source:"Mitre 10", notes:"Built into fence or wall. Adds kerb appeal." }},

  { cat:"External Works", name:"Garage door",
    budget:{ description:"Steel panel lift garage door 2400x2100", price:1200, unit:"per unit", source:"Market rate", notes:"Standard steel sectional. Manual or motor." },
    premium:{ description:"Timber-look aluminium sectional garage door", price:3200, unit:"per unit", source:"Market rate", notes:"Insulated. Timber aesthetic without rot. Smart opener compatible." }},

  { cat:"External Works", name:"Gate hardware",
    budget:{ description:"Galvanised gate hinge and latch set", price:45, unit:"per set", source:"Mitre 10", notes:"Standard gate hardware set." },
    premium:{ description:"Stainless weld-on gate hardware set", price:145, unit:"per set", source:"Mitre 10", notes:"Marine grade. No corrosion. Required within 500m coast." }},

  { cat:"External Works", name:"Outdoor tap",
    budget:{ description:"Standard brass outdoor tap 15mm BSP", price:32, unit:"per unit", source:"Bunnings", notes:"Basic bib tap. Functional." },
    premium:{ description:"Lockable outdoor tap with backflow prevention", price:85, unit:"per unit", source:"Bunnings", notes:"Backflow prevents contamination. Lockable for rental properties." }},

  // ─── HARDWARE & FIXINGS ──────────────────────────────────────────────────

  { cat:"Hardware & Fixings", name:"Joist hangers",
    budget:{ description:"Galvanised joist hanger LUS26 90x45", price:5.50, unit:"per unit", source:"Mitre 10", notes:"Standard. Adequate inland residential." },
    premium:{ description:"Stainless steel joist hanger 90x45", price:14, unit:"per unit", source:"Mitre 10", notes:"Required within 500m coast. 50+ yr no corrosion." }},

  { cat:"Hardware & Fixings", name:"Post anchors",
    budget:{ description:"Galvanised post cap 90x90mm twin bolt", price:16, unit:"per unit", source:"Mitre 10", notes:"Standard post anchor." },
    premium:{ description:"Stainless heavy-duty post anchor 90x90", price:38, unit:"per unit", source:"Mitre 10", notes:"Marine grade. Essential coastal locations." }},

  { cat:"Hardware & Fixings", name:"Framing nails",
    budget:{ description:"Bright steel framing nails 90mm 2kg", price:22, unit:"per 2kg", source:"Bunnings", notes:"Interior framing only." },
    premium:{ description:"Hot-dip galvanised framing nails 90mm 2kg", price:32, unit:"per 2kg", source:"Bunnings", notes:"Exterior and wet areas. No corrosion." }},

  { cat:"Hardware & Fixings", name:"Deck screws",
    budget:{ description:"Galvanised decking screws 75mm 1kg", price:22, unit:"per kg", source:"Bunnings", notes:"Budget deck fixing. Can rust on hardwood." },
    premium:{ description:"A316 stainless Kwila deck screws 50x3.5mm 3kg", price:85, unit:"per 3kg", source:"Mitre 10", notes:"Marine grade. No rust streaks. Required within 500m coast." }},

  { cat:"Hardware & Fixings", name:"Construction sealant",
    budget:{ description:"Silicone sealant white sanitary 280ml", price:14, unit:"per tube", source:"Bunnings", notes:"Standard sanitary silicone. 10yr mould resistance." },
    premium:{ description:"Soudal Soudaseal 250 hybrid polymer 290ml", price:28, unit:"per tube", source:"Mitre 10", notes:"Paintable, UV stable, adheres to anything. Better exterior sealing." }},

  { cat:"Hardware & Fixings", name:"Expanding foam",
    budget:{ description:"Standard polyurethane expanding foam 750ml", price:24, unit:"per can", source:"Bunnings", notes:"Gap filling. Standard grade." },
    premium:{ description:"Fire-rated expanding foam 750ml intumescent", price:48, unit:"per can", source:"Bunnings", notes:"Required around penetrations in fire-rated walls." }},

  { cat:"Hardware & Fixings", name:"Construction adhesive",
    budget:{ description:"Liquid Nails construction adhesive tube", price:14, unit:"per tube", source:"Bunnings", notes:"General purpose interior bonding." },
    premium:{ description:"Sika Sikaflex 252 structural adhesive 600ml", price:48, unit:"per sausage", source:"Placemakers", notes:"Structural grade, UV stable, bonds wet surfaces." }},

  { cat:"Hardware & Fixings", name:"Bolts and anchors",
    budget:{ description:"Dynabolt M10x75mm through bolt 50pk", price:48, unit:"per 50pk", source:"Bunnings", notes:"Standard concrete anchor." },
    premium:{ description:"Hilti HIT-HY 200 chemical anchor system", price:85, unit:"per kit 10 fixings", source:"Placemakers", notes:"Superior pull-out strength. Required for structural fixings in cracked concrete." }},

  { cat:"Hardware & Fixings", name:"Framing anchors",
    budget:{ description:"Galvanised framing anchor H2.5", price:4, unit:"per unit", source:"Mitre 10", notes:"General purpose timber connector." },
    premium:{ description:"USP Structural heavy duty framing anchor", price:12, unit:"per unit", source:"Placemakers", notes:"Higher load rating. Required at rafter-to-plate connections in high-wind areas." }},

  { cat:"Hardware & Fixings", name:"Safety signage",
    budget:{ description:"PVC safety signs basic set caution and no entry", price:28, unit:"per set", source:"Bunnings", notes:"Basic compliance signage for site." },
    premium:{ description:"Photoluminescent glow-in-dark egress signage", price:85, unit:"per set", source:"Bunnings", notes:"Visible in blackout. Required for commercial buildings." }},

];

// ─── HELPERS ────────────────────────────────────────────────────────────────

export function findMaterial(keyword: string): MaterialItem[] {
  const k = keyword.toLowerCase();
  return MATERIALS_DB.filter(m =>
    m.name.toLowerCase().includes(k) ||
    m.cat.toLowerCase().includes(k) ||
    m.budget.description.toLowerCase().includes(k) ||
    m.premium.description.toLowerCase().includes(k)
  );
}

export function getMaterialsByCategory(cat: string): MaterialItem[] {
  return MATERIALS_DB.filter(m => m.cat === cat);
}

export function getBudgetPrice(name: string): number | null {
  const match = MATERIALS_DB.find(m => m.name === name);
  return match ? match.budget.price : null;
}

export function getPremiumPrice(name: string): number | null {
  const match = MATERIALS_DB.find(m => m.name === name);
  return match ? match.premium.price : null;
}

export const CATEGORIES = [...new Set(MATERIALS_DB.map(m => m.cat))];
export const ITEM_COUNT = MATERIALS_DB.length;
