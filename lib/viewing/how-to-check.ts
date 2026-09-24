// ============================================================
// What to actually DO about each checklist item, in order.
//
// Written for somebody standing at an open home with fifteen minutes, a phone
// and no ladder. Three things, always in the same order, because that is the
// order they cost you: ASK (free, instant, and the agent usually just tells
// you), LOOK (free, but you have to be there), PHOTOGRAPH (which is the only
// one that changes the report).
//
// The steps are hand-written rather than generated. A model asked to invent
// "where is the hot water cylinder in a New Zealand house" will produce
// something plausible every single time, and plausible is not the same as
// right — it is the difference between sending a buyer to a hallway cupboard
// and sending them round the side of the house to a califont. None of this
// costs a token at run time and all of it can be read and corrected.
//
// Where a thing genuinely needs a professional, it says so rather than
// pretending a buyer with a torch can settle it.
// ============================================================

export interface CheckGuide {
  /** What we don't know, in one plain line. The heading of the item. */
  concern: string;
  /** The question to put to the agent. Usually the fastest route to an answer. */
  ask?: string;
  /** What to do at the property, cheapest and quickest first. */
  steps: string[];
  /**
   * What to photograph, in order.
   *
   * These are not decoration. A photograph goes back through the same vision
   * analysis the listing photos went through, and the item is then scored on
   * the buyer's own picture — which changes the score, the condition, the spec
   * tier, the estimated age, the replacement cost, and therefore the valuation.
   * A data plate is called out separately wherever one exists, because a model
   * and serial number date a unit far more precisely than its appearance does.
   */
  photos?: string[];
}

export const CHECK_GUIDE: Record<string, CheckGuide> = {
  // ── Exterior ───────────────────────────────────────────────────────────────
  ext_foundation: {
    concern: "What the house sits on, and whether it has moved.",
    ask: "Is there subfloor access, and has the house ever been re-piled or re-levelled?",
    steps: [
      "Find the subfloor hatch — usually an external panel under the house, or a hatch in a hallway cupboard.",
      "With a torch: rot or splits in the piles, sagging bearers, standing water, and how much clearance there is to the ground.",
      "No access? Say so — that is an answer. Then check inside instead: roll a marble on the floor, look for doors that won't latch and cracks running diagonally from a door corner.",
    ],
    photos: ["Down into the subfloor, piles and bearers in frame", "Any crack, sag or water you found"],
  },
  ext_roof: {
    concern: "How old the roof is and how much life is left in it.",
    ask: "How old is the roof, and has it been recoated or re-screwed?",
    steps: [
      "Walk all four sides and look up from the ground. Never get on the roof.",
      "Long-run steel: rust at the laps and screw heads, lifted sheets, patched flashings. Tiles: cracked, slipped or moss-covered.",
      "Look where the roof meets the chimney, the vents and the spouting — that is where leaks start.",
    ],
    photos: ["Each elevation from the ground", "Any rust, moss, patch or lifted sheet, close up"],
  },
  ext_cladding: {
    concern: "What the house is clad in, and whether water is getting behind it.",
    ask: "What is the cladding, and has any of it been replaced?",
    steps: [
      "Walk the FULL perimeter, including the side you can't see from the street — that is the side that doesn't get maintained.",
      "Weatherboard: press for soft spots, especially low down and at the corners. Plaster or monolithic: hairline cracks, bulges, staining under the windows.",
      "Look at where the cladding meets the window joinery. Gaps, failed sealant and rust streaks are the tell.",
    ],
    photos: ["All four elevations", "Any crack, stain, bulge or soft spot, close up"],
  },
  ext_windows: {
    concern: "Single or double glazed, and what condition the joinery is in.",
    ask: "Are the windows single or double glazed, and what year were they put in?",
    steps: [
      "Hold something against the glass at an angle — two reflections means double glazing, one means single.",
      "Open and shut several. Catches that don't work, sashes that stick, and rot in timber sills.",
      "Fogging or moisture BETWEEN the panes means the seal has failed and the unit needs replacing.",
    ],
    photos: ["A window from inside showing the frame and sill", "The double-glazing spacer at the edge of the glass, if there is one"],
  },
  ext_decking: {
    concern: "Whether the deck is sound, and whether the balustrade is legal.",
    ask: "When was the deck built, and was it consented?",
    steps: [
      "Stand in the middle and bounce. Spring or movement means the joists or piles are undersized or rotten.",
      "Look where the deck meets the house — that junction is the most common rot point on any NZ deck.",
      "A deck more than a metre off the ground needs a balustrade at least a metre high, and gaps a 100mm ball can't pass through.",
    ],
    photos: ["The whole deck", "Underneath it — joists, bearers and fixings", "The house junction"],
  },
  ext_gutters: {
    concern: "Whether the spouting is clearing water away from the house.",
    steps: [
      "Look along each run for sags, rust, splits and plants growing in them.",
      "Follow every downpipe to the ground. It should go into a drain, not just end on the dirt.",
      "Look for staining on the wall below the gutter line — that is water that has been going the wrong way for a while.",
    ],
    photos: ["Any sagging, rusted or overflowing run", "Where the downpipes discharge"],
  },
  ext_soffits: {
    concern: "Whether the eaves are sound, and how much overhang the walls get.",
    steps: [
      "Look up under the eaves on all four sides.",
      "Sagging, staining, holes or flaking paint in the soffit lining means water has been getting in above it.",
      "Note how far the eaves overhang. Little or no eave means the walls take the weather directly, which matters most on plaster cladding.",
    ],
    photos: ["Under the eaves on each side", "Any stain, sag or hole"],
  },
  ext_doors: {
    concern: "Whether the exterior doors seal, lock and are sound.",
    steps: [
      "Open and close every exterior door. Sticking, dropping or not latching means the frame has moved.",
      "Check the weather seals and thresholds — daylight around a closed door is a draught and a Healthy Homes issue.",
      "Rot at the bottom of a timber door or frame, and rust on a sliding door track.",
    ],
    photos: ["Each exterior door", "Any rot, gap or damaged seal"],
  },
  ext_paint: {
    concern: "How long since it was painted, and how much time is left.",
    ask: "When was the exterior last painted?",
    steps: [
      "Look at the north and west walls first — they get the most sun and fail first.",
      "Chalky, flaking or peeling paint, and bare timber showing through.",
      "Paint is protection, not decoration. Bare weatherboard is a maintenance job with a deadline.",
    ],
    photos: ["The worst-affected wall", "Any bare or peeling area, close up"],
  },
  ext_chimney: {
    concern: "Whether the chimney is sound and whether the fire can legally be used.",
    ask: "Is the fire still used, and was it consented? Is there a recent chimney sweep or inspection?",
    steps: [
      "From the ground: cracked or missing mortar, leaning, loose bricks, rust on a flue.",
      "An unreinforced brick chimney above the roofline is an earthquake risk and insurers ask about it.",
      "Inside, look at the hearth clearances and whether the fire looks used or blocked off.",
    ],
    photos: ["The chimney from outside", "The fire and hearth from inside"],
  },
  ext_retaining: {
    concern: "Whether the retaining walls are holding, and who owns them.",
    ask: "Who owns and maintains the retaining walls, and was anything over 1.5m consented?",
    steps: [
      "Walk each wall. Leaning, bulging, cracked timbers, rusted fixings, soil washing through.",
      "A wall over 1.5m high, or any wall with a load above it, needs a building consent — ask for it.",
      "Look for weep holes or drainage at the base. A wall with nowhere for water to go is a wall under pressure.",
    ],
    photos: ["Each wall end to end", "Any lean, bulge or crack"],
  },

  // ── Bathroom ───────────────────────────────────────────────────────────────
  bath_waterproof: {
    concern: "Whether the wet area is still sealed behind the tiles.",
    ask: "When was the bathroom last done, and was the waterproofing certified?",
    steps: [
      "Press the wall lining beside and behind the shower. Any give or softness means water is getting through.",
      "Look at the grout and the silicone in the corners — dark, cracked or missing is how water gets behind.",
      "Look at the floor outside the shower: lifting vinyl, swollen skirting or cupping floorboards.",
      "Smell the room. A persistent musty smell with no visible cause is usually a wet wall cavity.",
    ],
    photos: ["The shower corner, floor to ceiling", "Any soft spot, lifting or staining"],
  },
  bath_shower: {
    concern: "The age and condition of the shower, and whether it leaks.",
    steps: [
      "Run it. Pressure, temperature, and whether the water drains away or pools.",
      "Acrylic liner or tiled? A tiled shower is a waterproofing question; a liner is a replacement cost.",
      "Check the door or curtain seal, and the tray for cracks.",
    ],
    photos: ["The whole shower", "The tray and the waste"],
  },
  bath_hotwater: {
    concern: "Whether it's gas or an electric cylinder, and how close it is to the end of its life.",
    ask: "How old is the hot water system, and has it ever been replaced?",
    steps: [
      "Look for a hot water cupboard first — usually off a hallway, in the laundry or in the bathroom. An electric cylinder is a tall insulated tank.",
      "No cupboard? Walk the outside of the house. A gas califont is a slim white or steel box on an exterior wall with a flue out the top.",
      "Run a hot tap for a full minute. Slow to arrive, or running cold quickly, points at a tired or undersized system.",
      "Look for rust or damp at the base of a cylinder, and green staining on the copper pipework above it.",
    ],
    photos: [
      "The whole unit, so we can see the type and size",
      "The data plate or label — the model and serial number date it far better than its appearance does",
    ],
  },
  bath_ventilation: {
    concern: "Whether there's a working extractor, which is a legal requirement for a rental.",
    ask: "Is the extractor fan vented outside, or just into the ceiling space?",
    steps: [
      "Is there a fan at all? An openable window is NOT enough under the Healthy Homes standards.",
      "Turn it on. Hold a tissue to it — if it doesn't hold, the fan isn't moving air.",
      "A fan venting into the roof space rather than outside moves the moisture problem rather than solving it.",
    ],
    photos: ["The fan in the ceiling or wall", "Its label, if you can read one"],
  },
  bath_toilet: {
    concern: "Condition, age, and whether anything is leaking at the base.",
    steps: [
      "Flush it. Slow refill, running water or a weak flush.",
      "Look and feel around the base for damp, staining or movement when you press on the pan.",
      "Check the cistern for cracks and the seal where it meets the pan.",
    ],
    photos: ["The toilet and the floor around its base"],
  },

  // ── Kitchen ────────────────────────────────────────────────────────────────
  kit_appliances: {
    concern: "What's actually included in the sale, and how old it is.",
    ask: "Which appliances are included in the chattels list, and how old are they?",
    steps: [
      "Appliances are CHATTELS — what stays is whatever the sale and purchase agreement lists, not what you saw at the open home.",
      "Open the oven and dishwasher. Rust, broken seals, burnt elements, missing racks.",
      "Check the extractor over the hob actually pulls — many are recirculating filters that vent nowhere.",
    ],
    photos: [
      "Each appliance",
      "The data plate — usually inside the oven door, the dishwasher door edge, or behind the fridge",
    ],
  },
  kit_cabinetry: {
    concern: "Whether the carcasses are sound or the kitchen needs replacing.",
    steps: [
      "Open and close several doors and drawers. Sagging, sticking, and hinges that have pulled out.",
      "Look at the cabinet under the sink — swollen, delaminated particleboard there means a leak nobody fixed.",
      "Doors can be replaced cheaply; carcasses cannot. It is the boxes that decide whether this is a facelift or a new kitchen.",
    ],
    photos: ["The kitchen as a whole", "Inside the under-sink cupboard", "Any swelling or damage"],
  },
  kit_benchtop: {
    concern: "What it's made of and whether the edges have gone.",
    steps: [
      "Run your hand along the join at the sink and the hob — swelling there is the first thing to fail on laminate.",
      "Laminate, timber, engineered stone or granite? It sets the replacement cost more than anything else in the kitchen.",
      "Look for burns, deep cuts and lifting edge strips.",
    ],
    photos: ["The full run of benchtop", "The join at the sink and the hob"],
  },
  kit_sink: {
    concern: "Condition of the sink and tap, and whether anything is leaking.",
    steps: [
      "Run both taps. Pressure, drips at the spout and base, and how fast it drains.",
      "Open the cupboard underneath and look at the trap and the pipework with a torch — damp, staining, green corrosion.",
      "Press the base of the cupboard. Soft means a slow leak.",
    ],
    photos: ["The sink and tap", "Under the sink, pipework in frame"],
  },

  // ── Living ─────────────────────────────────────────────────────────────────
  liv_insulation: {
    concern: "Whether there's ceiling and underfloor insulation, and whether it meets the standard.",
    ask: "Is there a Healthy Homes compliance statement, or an insulation installation certificate?",
    steps: [
      "Find the ceiling access hatch — usually in a hallway, a wardrobe or the garage.",
      "Put your phone in and take a photo with the flash on. You are looking for whether there is any, how thick it is, and whether it covers the whole ceiling or stops short at the edges.",
      "Underfloor: same subfloor hatch as the foundation check. Look for a foil or blanket between the joists.",
      "Old foil underfloor is a known electrical hazard and has been banned from installation since 2016.",
    ],
    photos: ["Into the ceiling space with the flash on", "Into the subfloor, joists in frame"],
  },
  liv_heating: {
    concern: "What heats the house, how old it is, and whether it meets the rental standard.",
    ask: "How old is the heat pump or woodburner, has it been serviced, and was the burner consented?",
    steps: [
      "Find the main fixed heater in the living room. A plug-in electric heater does not count under the Healthy Homes standards.",
      "Heat pump: run it in both heating and cooling. Listen for rattle, look for ice or rust on the outdoor unit and check the filters.",
      "Woodburner: needs a building consent, and there are clearances to the wall and hearth it must meet. Many regions also restrict which burners can be installed.",
      "Ask whether the heater is sized for the room — an undersized unit is a compliance problem as well as a cold one.",
    ],
    photos: [
      "The indoor unit or the fire",
      "The OUTDOOR heat pump unit",
      "Its data plate — model and serial number give us the age and the output",
    ],
  },
  liv_fixtures: {
    concern: "The age and condition of the wiring, switches and fittings.",
    ask: "When was the house last rewired, and is there an electrical safety certificate?",
    steps: [
      "Find the switchboard. Old ceramic rewirable fuses mean original wiring; modern breakers and an RCD mean it has been updated.",
      "Look for cloth-covered or black rubber cable at the board — that is pre-1960s wiring and it is at the end of its life.",
      "Around the house: scorched or cracked switches and sockets, and how few sockets there are per room.",
    ],
    photos: ["The switchboard with the cover closed", "The switchboard with the door open, if it opens safely"],
  },
  liv_flooring: {
    concern: "What's underfoot, its condition, and what's under it.",
    ask: "What is under the carpet — is it original timber?",
    steps: [
      "Walk every room. Bounce, squeaks, sloping and soft patches near exterior walls or wet areas.",
      "Lift a carpet edge at a doorway if you can — original timber underneath is a big difference in both cost and value.",
      "Look at the floor at the edges of wet areas for cupping or dark staining.",
    ],
    photos: ["Each main floor surface", "Any stain, slope, gap or soft spot"],
  },
  liv_walls: {
    concern: "Whether the walls are sound, dry and what they are made of.",
    ask: "Have any walls been relined, and was it consented?",
    steps: [
      "Knock on the walls as you go. Plasterboard sounds hollow and even; lath and plaster is harder and dead, and patches of it that sound hollow have come away from the laths.",
      "Look along each wall towards a window with the light behind it. Waves, bulges and a line of nail-pops show up that way and not face-on.",
      "Check the bottom of the walls on the weather side and behind the wet areas for staining, bubbled paint or skirting that has swollen — that is moisture getting in, and it is the expensive find.",
      "Cracks running out from the corners of doors and windows are usually movement. Note them, and whether the doors in those walls still close cleanly.",
    ],
    photos: ["Any stain, bulge or crack", "The bottom of the walls on the weather side and behind the bathroom"],
  },
  liv_ceiling: {
    concern: "Whether the ceilings are sound, and whether anything has leaked.",
    steps: [
      "Look up in every room, and take the corners and the edges as well as the middle.",
      "Brown or yellow rings are old leaks. Sagging, cracking along a line, or fresh paint on one ceiling and not the others.",
      "Fresh paint on a single ceiling is worth asking about — it is the cheapest way to cover a stain.",
    ],
    photos: ["Any stain, sag or crack", "Any ceiling that has obviously been repainted on its own"],
  },

  // ── Bedrooms ───────────────────────────────────────────────────────────────
  bed_size: {
    concern: "Whether the bedrooms actually take a bed and furniture.",
    steps: [
      "Pace each room heel to toe — roughly one pace is 750mm. A double bed needs 1.4m plus room to walk.",
      "Note where the door and the window swing, and how much wall is left for a wardrobe.",
      "Photographs are taken with a wide lens. The room is always smaller than the listing made it look.",
    ],
    photos: ["Each bedroom from the doorway"],
  },
  bed_windows: {
    concern: "Light, ventilation, and whether an upstairs window is an escape route.",
    steps: [
      "Open each bedroom window. Does it open far enough to climb out of, and does the catch work?",
      "Which way does it face? A south-facing bedroom with one small window is a cold, dark room year round.",
      "Condensation staining on the reveals and mould in the top corners are the signs of a room that doesn't dry out.",
    ],
    photos: ["Each bedroom window from inside", "Any mould or staining in the corners"],
  },

  // ── Garage ─────────────────────────────────────────────────────────────────
  gar_construction: {
    concern: "How the garage is built, and whether it was consented.",
    ask: "Was the garage consented, and does it have a Code Compliance Certificate?",
    steps: [
      "Is it attached or separate, and does it match the house construction and era?",
      "A garage that looks newer than the house is a consent question — ask directly.",
      "Look at the roof, cladding and door in the same way as the house. Garages get the least maintenance.",
    ],
    photos: ["The garage outside", "Inside, showing the framing and roof"],
  },
  gar_floor: {
    concern: "Whether the slab is sound, and whether water gets in.",
    steps: [
      "Look for cracks. Hairline cracks are normal in any slab; cracks with a step or a level difference across them are not.",
      "Look for a tide mark, silt line or rust staining along the walls — that is water that has been in here.",
      "Check the fall: water should run out of the door, not toward the back wall.",
    ],
    photos: ["The floor as a whole", "Any significant crack or water mark"],
  },

  // ── Outdoors ───────────────────────────────────────────────────────────────
  out_drainage: {
    concern: "Where the water goes in heavy rain.",
    ask: "Does the section flood or pond in heavy rain, and are the drains council or private?",
    steps: [
      "Walk the section and look for standing water, moss, bare patches and soft ground — all signs of where water sits.",
      "Find the gully traps near the house. They should be clear and above ground level, not buried in a garden bed.",
      "Look at which way the ground falls. Ground that slopes toward the house is the problem you cannot easily fix.",
    ],
    photos: ["Any wet, boggy or ponding area", "The gully traps beside the house"],
  },
  out_driveway: {
    concern: "Surface, condition, and whether it is shared.",
    ask: "Is the driveway shared, and is there a right of way on the title?",
    steps: [
      "Concrete, asphalt, gravel or pavers? It changes the replacement cost by a factor of five.",
      "Look for cracking, subsidence, potholes and tree roots lifting the surface.",
      "If it is shared, who maintains it and on what terms — that is a title question, not an agent question.",
    ],
    photos: ["The driveway end to end", "Any cracking or subsidence"],
  },
  out_fencing: {
    concern: "Condition and ownership of the boundary fences.",
    ask: "Are any of the boundary fences shared, and has anything been agreed with the neighbours?",
    steps: [
      "Walk every boundary. Leaning, rotted posts at ground level, missing palings, rusted wire.",
      "Push a post at the top. Movement means the bottom has gone whatever the top looks like.",
      "Under the Fencing Act the cost of an adequate fence is usually shared with the neighbour — but only if it is agreed properly first.",
    ],
    photos: ["Each boundary run", "Any leaning or rotted section"],
  },
  out_retaining: {
    concern: "Whether the garden retaining is holding, and who is responsible.",
    ask: "Who owns the retaining, and was anything over 1.5m consented?",
    steps: [
      "Walk each wall and look along it from the end — a bulge shows up from the side and not from the front.",
      "Rotted timber at ground level, rusted fixings, soil escaping between the boards.",
      "Anything over 1.5m, or with a driveway or building above it, needs a consent. Ask for it.",
    ],
    photos: ["Each wall from the end and from the front", "Any lean, bulge or rot"],
  },

  // ── Location ───────────────────────────────────────────────────────────────
  loc_noise: {
    concern: "What it actually sounds like, which no photograph can tell you.",
    steps: [
      "Stand outside and just listen for a full minute. Traffic, dogs, industry, a school, a flight path.",
      "Go back at a DIFFERENT time — a weekday at 5pm and a Saturday morning are different properties.",
      "Open a bedroom window and listen again. Closed double glazing hides a lot.",
    ],
    photos: [],
  },
  loc_views: {
    concern: "What you can actually see, and whether it can be built out.",
    steps: [
      "Look from the main living room and the main bedroom, not from the garden.",
      "Ask what the vacant or low-rise land in the view is zoned for — a view is only permanent if the thing in front of it can't get taller.",
      "Check for power lines and poles, which listing photographers are good at avoiding.",
    ],
    photos: ["The view from the main living area", "The view from the main bedroom"],
  },
  loc_sun: {
    concern: "How much sun the house actually gets, and when.",
    steps: [
      "Work out which way the main living area faces — use the compass on your phone.",
      "North is what you want. A south-facing living room in New Zealand is cold and dark for most of the year.",
      "Look at what casts shade: neighbouring buildings, a hill, large trees. Then remember the winter sun is much lower than today's.",
    ],
    photos: ["The main living area with the phone compass visible, or note the direction"],
  },

  // ── Land ───────────────────────────────────────────────────────────────────
  land_topography: {
    concern: "How the ground actually lies, which a flat photo hides.",
    steps: [
      "Walk the whole section, including the back corners.",
      "How steep is it really, and how much of it is genuinely usable — flat enough for a lawn, a shed or a car?",
      "Look for slips, scarps, cracking in the ground and any repaired-looking patch on a bank.",
    ],
    photos: ["The section from the top and from the bottom", "Any slip, slump or crack"],
  },
  land_frontage: {
    concern: "How the property meets the road, and how you get in.",
    steps: [
      "Stand at the road. How wide is the frontage, and is there room to park off the street?",
      "Check sight lines pulling out of the drive, especially on a bend or a hill.",
      "A rear or back-section property gets its access over somebody else's land — that is a right of way and it will be on the title.",
    ],
    photos: ["The property from the road", "The entrance and sight lines both ways"],
  },


  // ── Paperwork ──────────────────────────────────────────────────────────────
  leg_lim: {
    concern: "What the council knows about this property that the listing doesn't say.",
    ask: "Is there a LIM already, and what date was it issued?",
    steps: [
      "Ask the agent FIRST. Vendors often order one before marketing and hand copies out — if it exists it costs you nothing.",
      "Check the date on the front. A LIM is a snapshot of its issue date and won't show anything registered since.",
      "No copy, or an old one? Order your own from the council. Anyone can, on any property — allow about ten working days and a few hundred dollars.",
    ],
    photos: [],
  },
  leg_consents: {
    concern: "Whether the work done to this house was consented and signed off.",
    ask: "Are there building consents and Code Compliance Certificates for the work that's been done?",
    steps: [
      "Ask for the consent numbers and the CCCs. A consent without a CCC is work that was never signed off.",
      "Compare what you can see against what the paperwork covers — a deck, a carport, a converted garage or a bathroom that isn't listed is the thing to ask about.",
      "The council property file has the full history. The LIM summarises it; the file holds the drawings.",
    ],
    photos: [],
  },
  leg_eqc: {
    concern: "Whether this property has an earthquake claim history, and whether it was repaired.",
    ask: "Has the property had an EQC or private insurance claim, and is there a repair sign-off?",
    steps: [
      "Ask directly. A claim history is not a reason to walk away; an UNREPAIRED claim is.",
      "An over-cap claim means the damage exceeded the EQC limit and went to the private insurer — ask what was done and by whom.",
      "Ask your insurer whether they will cover the property BEFORE you go unconditional. A house nobody will insure is a house nobody will lend on.",
    ],
    photos: [],
  },
  leg_title: {
    concern: "What the title actually is, and what comes with it.",
    steps: [
      "The tenure is on the report already, read from the register. What you are checking is everything registered against it.",
      "Ask your solicitor to read the title and every instrument on it before you go unconditional.",
      "Freehold, cross lease, unit title and leasehold are four different things to own, and they are not interchangeable.",
    ],
    photos: [],
  },
  leg_weathertight: {
    concern: "Whether this house is from the leaky-building era and built the way that failed.",
    ask: "Has the house ever had a weathertightness claim, remediation or a reclad?",
    steps: [
      "The risk era is roughly 1994–2004, and the risk features are monolithic cladding, little or no eaves, internal gutters and enclosed balconies.",
      "Look for staining below the windows and at the base of the walls, and any patch of cladding that has clearly been replaced.",
      "If this house has those features, a weathertightness-specific inspection is worth paying for. A general building inspection is not the same thing.",
    ],
    photos: ["Each elevation showing the cladding and the eave", "Any staining, crack or patched area"],
  },
  leg_unconsented: {
    concern: "Whether anything here was built without permission.",
    ask: "Has anything been added or altered, and is it all on the council file?",
    steps: [
      "Count the rooms and structures against the floor area the listing gives. More house than the record knows about is the tell.",
      "Look for a converted garage, a sleepout, a bathroom in an odd place, or a room with a ceiling height that feels wrong.",
      "Unconsented work is the buyer's problem once you own it — a council can require it removed or brought up to Code.",
    ],
    photos: ["Anything that looks added on, inside or out"],
  },
  leg_bodycorp: {
    concern: "What the body corporate costs, and what state its finances are in.",
    ask: "What are the annual levies, what is in the long-term maintenance plan, and is there a current pre-contract disclosure statement?",
    steps: [
      "Ask for the levies, the minutes and the long-term maintenance plan. All three, not just the levy figure.",
      "Look for a thin sinking fund with big work coming — that is a special levy waiting to happen, and you will own it.",
      "Read the minutes for disputes, leaks and anything the body corporate is arguing about.",
    ],
    photos: [],
  },
  leg_crosslease: {
    concern: "Whether the flats plan matches what is actually built.",
    ask: "Does the flats plan match the current buildings, and has anything been added since it was drawn?",
    steps: [
      "Get the flats plan and walk the property with it. Every building and every exclusive-use area should match what is drawn.",
      "A conservatory, deck, carport or extension that isn't on the plan makes the cross lease DEFECTIVE — and fixing it needs the other owners' agreement and a new plan.",
      "This is the single most common problem with cross leases, and it is expensive and slow to put right. Your solicitor must check it.",
    ],
    photos: ["Each building on the site", "Anything that looks like it has been added"],
  },
  leg_easements: {
    concern: "What rights other people have over this land.",
    steps: [
      "The report draws the surveyed ones it can find. Ask your solicitor to read the rest off the title.",
      "Walk the ground and look for what the easements are FOR — a shared drive, a drain, a power line, a neighbour's access.",
      "You cannot build over a right of way or a drainage easement, which changes what you could add later.",
    ],
    photos: ["Any shared driveway or access strip", "Any visible services crossing the land"],
  },
  leg_encumbrances: {
    concern: "What is registered against the title beyond the easements.",
    steps: [
      "Ask your solicitor for the title and every current instrument on it — covenants, caveats, land covenants, consent notices.",
      "A covenant can restrict what you build, what it's clad in, whether you can add a minor dwelling, even where the letterbox goes. We can see one exists; only the document says what it requires.",
      "A caveat is somebody claiming an interest in the property. It must be dealt with before settlement.",
    ],
    photos: [],
  },
};
