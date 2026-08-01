/* ═══════════════════════════════════════════════════════════════
   industries — sectors and their niches

   Each sector holds niches; a niche is what an applicant actually
   *is*. Niches carry their own naming vocabulary, flavour, and risk
   character, so "Biotech" is never just "Biotech" — it is a
   radiopharmaceutical shop, or a contract manufacturer, or a
   veterinary oncology spin-out, and they behave differently.

   vol  — price volatility multiplier
   liq  — turnover multiplier (drives your trading fees)
   hype — day-one demand and narrative premium
   grow — bias applied to the niche's underlying quality draw
   ═══════════════════════════════════════════════════════════════ */

export const SECTORS = {
  /* ─────────────────────────── technology ─────────────────────── */
  tech: {
    label: 'Technology', short: 'TECH', hue: 205,
    tails: ['Systems', 'Labs', 'Technologies', 'Compute', 'Dynamics', 'Digital', 'Software'],
    niches: {
      infra:   { label: 'Cloud Infrastructure', vol: .9, liq: 1.3, hype: 1.2, grow: .06,
        heads: ['Nimbus', 'Bedrock', 'Ironclad', 'Substrate', 'Keystone', 'Bastion'],
        blurbs: [
          'Orchestration layer for workloads nobody wants to migrate twice.',
          'Bare-metal capacity rented to people fleeing their cloud bill.',
          'Runs a third of the payments industry and almost nobody knows the name.',
        ] },
      devtools:{ label: 'Developer Tools', vol: 1.05, liq: 1.15, hype: 1.3, grow: .02,
        heads: ['Cascade', 'Loft', 'Anvil', 'Forge', 'Sandbox', 'Quill'],
        blurbs: [
          'Beloved by engineers, tolerated by the CFOs who receive the invoice.',
          'Open-core, and the core is rather more open than the board would like.',
          'Twelve million downloads a month and four hundred paying customers.',
        ] },
      silicon: { label: 'Semiconductors', vol: 1.35, liq: 1.2, hype: 1.45, grow: .10,
        heads: ['Tessera', 'Lattice Point', 'Photon Ridge', 'Verity Micro', 'Kiln'],
        blurbs: [
          'Inference silicon. Two customers, both of whom are also investors.',
          'Analogue parts nobody else bothers making, at margins nobody else gets.',
          'Fabless, which means their whole strategy lives in a Taiwanese queue.',
        ] },
      vertsaas:{ label: 'Vertical SaaS', vol: .8, liq: 1.0, hype: .85, grow: .12,
        heads: ['Dovetail', 'Ledgerpost', 'Bellhop', 'Marrow', 'Tally House'],
        blurbs: [
          'Software for an industry that still, in the year of our lord, faxes.',
          'Owns 71% of the dental-lab scheduling market. Yes, that is a market.',
          'Boring, sticky, and quietly compounding at 30% with no competitors.',
        ] },
      cyber:   { label: 'Cybersecurity', vol: 1.1, liq: 1.2, hype: 1.25, grow: .08,
        heads: ['Perimeter', 'Blackthorn', 'Sentinel Gate', 'Cipherwell', 'Redoubt'],
        blurbs: [
          'Sells fear, competently, on a three-year contract.',
          'Their own breach disclosure is filed under "learning experience".',
          'Every renewal is a board-level decision, which is why churn is 2%.',
        ] },
      space:   { label: 'Space Systems', vol: 1.7, liq: 1.05, hype: 1.6, grow: .04,
        heads: ['Perihelion', 'Kármán', 'Lodestar', 'Astra Vale', 'Highwater'],
        blurbs: [
          'Four successful launches, two unsuccessful, trend broadly correct.',
          'Constellation 8% deployed, 100% capitalised, 0% revenue.',
          'Sells propulsion to everyone else in this sector, which is the better business.',
        ] },
    },
  },

  /* ─────────────────────────── life sciences ──────────────────── */
  bio: {
    label: 'Life Sciences', short: 'BIO', hue: 152,
    tails: ['Therapeutics', 'Biosciences', 'Health', 'Medical', 'Bio', 'Sciences'],
    niches: {
      onco:    { label: 'Oncology', vol: 1.8, liq: .95, hype: 1.4, grow: .02,
        heads: ['Corvexa', 'Alveo', 'Nuvara', 'Somaris', 'Cytoris'],
        blurbs: [
          'Phase II readout in eleven weeks. Everything rides on eleven weeks.',
          'Preclinical data so good the senior team keep re-reading it.',
          'Second-line therapy for a cancer with no first-line therapy.',
        ] },
      gene:    { label: 'Gene Therapy', vol: 1.95, liq: .9, hype: 1.55, grow: -.02,
        heads: ['Helix Vale', 'Sequence', 'Ossia', 'Trellis', 'Vector Grove'],
        blurbs: [
          'One-time cure, priced accordingly, reimbursed reluctantly.',
          'Manufacturing is the bottleneck, as it has been for nine years.',
          'The science is astonishing. The gross margin is theoretical.',
        ] },
      devices: { label: 'Medical Devices', vol: .85, liq: .95, hype: .8, grow: .16,
        heads: ['Orthos', 'Cannula', 'Meridia', 'Steadyhand', 'Fenwick'],
        blurbs: [
          'Sells a titanium object for £14,000 that costs £310 to make.',
          'Surgeons trained on it in residency will use it for thirty years.',
          'Regulatory clearance is the moat, and the moat took a decade.',
        ] },
      diag:    { label: 'Diagnostics', vol: 1.1, liq: 1.05, hype: 1.0, grow: .10,
        heads: ['Assay', 'Clearsight', 'Pathline', 'Verrow', 'Panelworks'],
        blurbs: [
          'Razor-and-blade: the analyser is free, the cartridges are not.',
          'Reimbursement code pending. The entire model is that code.',
          'Installed in 4,000 labs. Switching cost is measured in years.',
        ] },
      cro:     { label: 'Contract Research', vol: .7, liq: .9, hype: .55, grow: .20,
        heads: ['Fairholm', 'Rivet', 'Pallas', 'Ledbury', 'Concord Clinical'],
        blurbs: [
          'Sells shovels to the gold rush and never touches a mine.',
          'Backlog stretches to 2032. Utilisation is the only metric that matters.',
          'Profitable, dull, and the only company here nobody argues about.',
        ] },
      vet:     { label: 'Animal Health', vol: .8, liq: .85, hype: .7, grow: .18,
        heads: ['Barrowfield', 'Kestrel Vet', 'Hollowgate', 'Paddock'],
        blurbs: [
          'Pet oncology. Recession-proof in a way that surprises everyone.',
          'Livestock vaccines with government contracts in four countries.',
          'Cash generative and utterly unglamorous. The best kind.',
        ] },
    },
  },

  /* ─────────────────────────── energy ─────────────────────────── */
  energy: {
    label: 'Energy', short: 'NRG', hue: 38,
    tails: ['Energy', 'Power', 'Resources', 'Grid', 'Renewables', 'Systems'],
    niches: {
      storage: { label: 'Grid Storage', vol: 1.25, liq: 1.05, hype: 1.3, grow: .10,
        heads: ['Anvil', 'Terravolt', 'Solstice', 'Flywheel', 'Deepcell'],
        blurbs: [
          'Four-hour batteries with a signed fifteen-year offtake.',
          'Arbitrages the evening peak, which is a licence to print in July.',
          'Chemistry works. Fire marshals remain to be fully convinced.',
        ] },
      offshore:{ label: 'Offshore Wind', vol: 1.15, liq: 1.0, hype: 1.05, grow: .06,
        heads: ['Boreal', 'Northwind', 'Dogger', 'Cape Grey', 'Seaward'],
        blurbs: [
          'Capital intensive, politically fashionable, contractually bulletproof.',
          'Turbine supplier is late. The turbine supplier is always late.',
          'Twenty-five year CfD. Boring cash flows are the whole point.',
        ] },
      nuclear: { label: 'Nuclear', vol: 1.4, liq: .9, hype: 1.5, grow: .0,
        heads: ['Cerenkov', 'Halden', 'Vitrify', 'Ferrum Hall', 'Cygnet'],
        blurbs: [
          'Small modular reactors, large modular promises, medium regulatory patience.',
          'Fuel fabrication outside Russia — suddenly a strategic asset.',
          'Licensing timeline measured in presidencies.',
        ] },
      upstream:{ label: 'Oil & Gas', vol: 1.3, liq: 1.15, hype: .6, grow: .12,
        heads: ['Permian Reach', 'Basalt', 'Kittiwake', 'Ironwood', 'Sable Point'],
        blurbs: [
          'Proven reserves, unproven management, generous dividend.',
          'Cash-generative today, structurally obsolete by 2045, priced for 2030.',
          'Hedged 80% into next year, which is either genius or a shame.',
        ] },
      efficiency:{ label: 'Energy Efficiency', vol: .75, liq: .85, hype: .7, grow: .14,
        heads: ['Thermwise', 'Rowan Grid', 'Tighthouse', 'Calorie Works'],
        blurbs: [
          'Retrofits buildings and takes a cut of the savings. Forever.',
          'Unsexy heat pumps, twelve-year contracts, index-linked.',
          'Nobody writes about them. Everybody renews with them.',
        ] },
    },
  },

  /* ─────────────────────────── financials ─────────────────────── */
  fin: {
    label: 'Financials', short: 'FIN', hue: 262,
    tails: ['Capital', 'Holdings', 'Financial', 'Partners', 'Group', 'Bancorp'],
    niches: {
      payments:{ label: 'Payments', vol: 1.0, liq: 1.35, hype: 1.25, grow: .10,
        heads: ['Tender', 'Railhead', 'Interchange', 'Clearwater', 'Obol'],
        blurbs: [
          'Rails in three emerging markets and one unresolved lawsuit.',
          'Takes 40 basis points of an enormous number.',
          'Their fraud losses are a rounding error, which is the entire moat.',
        ] },
      insurance:{ label: 'Specialty Insurance', vol: .8, liq: 1.0, hype: .6, grow: .18,
        heads: ['Marlowe Underwriting', 'Chandler', 'Fenchurch', 'Ashfield', 'Rockwell Re'],
        blurbs: [
          'Writes risk nobody else will price, and prices it very well.',
          'Combined ratio of 88%. The float is invested conservatively.',
          'Reserve releases have flattered three straight years of earnings.',
        ] },
      exchange:{ label: 'Market Infrastructure', vol: .7, liq: 1.25, hype: .8, grow: .22,
        heads: ['Clearing House', 'Tessellate', 'Post-Trade', 'Girobank', 'Novation'],
        blurbs: [
          'Toll booth on somebody else\'s motorway. Regulated, entrenched, lovely.',
          'Owns the reference data everyone is contractually obliged to buy.',
          'You of all people understand why this business is good.',
        ] },
      lender:  { label: 'Specialty Lending', vol: 1.15, liq: 1.1, hype: .85, grow: -.04,
        heads: ['Blackrail', 'Sterling Row', 'Covenant', 'Larkspur', 'Whitmore'],
        blurbs: [
          'The book looks pristine, in this rate environment, for now.',
          'Delinquency curves drawn with real optimism about next year.',
          'Funding is 80% wholesale, which is fine until precisely when it is not.',
        ] },
      wealth:  { label: 'Wealth Management', vol: .75, liq: .95, hype: .7, grow: .16,
        heads: ['Harborline', 'Redmont', 'Cavendish', 'Ellwood', 'Thorne & Park'],
        blurbs: [
          'Sticky assets, elderly clients, and an unresolved succession question.',
          'Fee-based, recurring, and utterly indifferent to the market cycle.',
          'Roll-up of regional advisors. The integration is the whole risk.',
        ] },
    },
  },

  /* ─────────────────────────── industrials ────────────────────── */
  ind: {
    label: 'Industrials', short: 'IND', hue: 25,
    tails: ['Industries', 'Manufacturing', 'Works', 'Engineering', 'Group', 'Fabrication'],
    niches: {
      aero:    { label: 'Aerospace Parts', vol: .9, liq: .95, hype: .85, grow: .18,
        heads: ['Halloran', 'Braddock', 'Fairweather', 'Stanchion', 'Merrow'],
        blurbs: [
          'Tier-two supplier. Certification is the moat and it took eleven years.',
          'Sole-sourced on a platform that will fly until 2060.',
          'Aftermarket spares are 22% of revenue and 60% of profit.',
        ] },
      robotics:{ label: 'Robotics', vol: 1.3, liq: 1.15, hype: 1.4, grow: .08,
        heads: ['Kessler', 'Tarn', 'Girdler', 'Cobalt Arm', 'Palletron'],
        blurbs: [
          'Integrator with genuine pricing power and a two-year lead time.',
          'Sells automation to warehouses that cannot hire anyone.',
          'Hardware margins, software multiple requested. Pick one.',
        ] },
      water:   { label: 'Water Treatment', vol: .65, liq: .8, hype: .6, grow: .20,
        heads: ['Clearbeck', 'Wellspring', 'Ondine', 'Grimsby Water'],
        blurbs: [
          'Municipal contracts running to 2049 with inflation escalators.',
          'Membranes wear out on a schedule. That schedule is the business model.',
          'Nobody will ever stop needing this. Nobody will ever be excited about it.',
        ] },
      defence: { label: 'Defence', vol: 1.0, liq: 1.05, hype: 1.15, grow: .14,
        heads: ['Vantablock', 'Ordnance Hill', 'Marchmont', 'Ironvale'],
        blurbs: [
          'Order book stretches into 2034. So does the political risk.',
          'Sells counter-drone kit to eleven governments and no civilians.',
          'Revenue is a line item in somebody\'s defence budget. Sleep well.',
        ] },
      packaging:{ label: 'Packaging', vol: .6, liq: .85, hype: .45, grow: .16,
        heads: ['Corrugate', 'Fold & Score', 'Palewell', 'Brimm'],
        blurbs: [
          'Makes the box. Everyone needs the box. The box has 14% margins.',
          'Freight economics mean nobody can compete beyond 300 miles.',
          'Family controlled for four generations and priced like it.',
        ] },
    },
  },

  /* ─────────────────────────── consumer ───────────────────────── */
  cons: {
    label: 'Consumer', short: 'CNS', hue: 340,
    tails: ['Brands', 'Company', 'Collective', 'Goods', 'Foods', 'Group'],
    niches: {
      beverage:{ label: 'Beverages', vol: 1.0, liq: 1.1, hype: 1.2, grow: .10,
        heads: ['Rosewater', 'Peartree', 'Bittern', 'Copperleaf', 'Salt & Lime'],
        blurbs: [
          'Growing 40% off a base so small the percentage is nearly meaningless.',
          'Distribution deal with one wholesaler who could end them on a whim.',
          'The drink is genuinely good, which is rarer than you would think.',
        ] },
      apparel: { label: 'Apparel', vol: 1.2, liq: 1.05, hype: 1.25, grow: -.04,
        heads: ['Latchkey', 'Wildgrove', 'Bellweather', 'Mendicant', 'Cutwork'],
        blurbs: [
          'Cult following, founder-led, no succession plan whatsoever.',
          'One viral season does not make a brand, but it does make a valuation.',
          'Inventory is up 60% and management calls it "positioning".',
        ] },
      grocery: { label: 'Grocery & Staples', vol: .55, liq: .95, hype: .4, grow: .18,
        heads: ['Hearthstone', 'Sundry', 'Marlowe Foods', 'Pantrywell'],
        blurbs: [
          'Private label manufacturer nobody notices until margins move.',
          'Two hundred stores, no debt, and a very patient family trust.',
          'Sells the thing people buy when they are buying less of everything else.',
        ] },
      pets:    { label: 'Pet Care', vol: .8, liq: 1.0, hype: 1.05, grow: .20,
        heads: ['Barkwell', 'Fetchline', 'Whisker & Bone', 'Paddock Pets'],
        blurbs: [
          'People will cut their own groceries before the dog\'s. Genuinely.',
          'Subscription retention better than most software companies.',
          'Premiumisation of pet food is the single best consumer trend going.',
        ] },
      leisure: { label: 'Leisure & Travel', vol: 1.35, liq: 1.15, hype: 1.2, grow: .0,
        heads: ['Tandem', 'Wayfarer', 'Halcyon Bay', 'Bright Passage'],
        blurbs: [
          'Wonderful in good years, catastrophic in the other kind.',
          'Owns the marina, the hotel and the only road to both.',
          'Bookings up 30%. Bookings are also entirely refundable.',
        ] },
    },
  },

  /* ─────────────────────────── real assets ────────────────────── */
  re: {
    label: 'Real Assets', short: 'PRP', hue: 96,
    tails: ['Properties', 'REIT', 'Estates', 'Realty', 'Land Trust', 'Holdings'],
    niches: {
      datacentre:{ label: 'Data Centres', vol: 1.0, liq: 1.15, hype: 1.45, grow: .16,
        heads: ['Coldaisle', 'Meridian Halls', 'Rack & Ridge', 'Powerloop'],
        blurbs: [
          'A queue of hyperscaler demand and no available grid connection.',
          'Pre-leased through 2035 to tenants with better credit than most states.',
          'Really an electricity business wearing a property costume.',
        ] },
      logistics:{ label: 'Logistics Property', vol: .75, liq: 1.0, hype: .95, grow: .16,
        heads: ['Fieldgate', 'Estuary', 'Portside Park', 'Alderway'],
        blurbs: [
          'Last-mile sheds inside the M25. They are not making more of those.',
          'Tenant list is the entire thesis and the tenant list is excellent.',
          'Rent reviews every five years, upward only, in a shortage.',
        ] },
      farmland:{ label: 'Farmland', vol: .5, liq: .55, hype: .5, grow: .14,
        heads: ['Broadacre', 'Tamarind Fields', 'Rowanhall', 'Longmeadow'],
        blurbs: [
          'Yields 3% and has never once gone to zero in four hundred years.',
          'Water rights attached, which is quietly the whole valuation.',
          'Illiquid, unexciting, and the safest thing on your board.',
        ] },
      selfstore:{ label: 'Self Storage', vol: .65, liq: .95, hype: .7, grow: .18,
        heads: ['Kingsmere', 'Boxwell', 'Thornbury', 'Attic Row'],
        blurbs: [
          'Customers who intend to leave in three months and stay for nine years.',
          'Raises prices 6% a year and almost nobody moves out.',
          'Recession, boom — people always need somewhere to put the sofa.',
        ] },
      office:  { label: 'Offices', vol: 1.05, liq: .85, hype: .35, grow: -.14,
        heads: ['Cornerstone', 'Pinnacle Court', 'Gresham Row', 'Blackfriars Hall'],
        blurbs: [
          'Yes. In this market. Management are aware and would like to explain.',
          'Trophy assets only, which is the last part of the sector still working.',
          'Priced at 40% of replacement cost, which is either value or a warning.',
        ] },
    },
  },

  /* ─────────────────────────── materials ──────────────────────── */
  mat: {
    label: 'Materials', short: 'MAT', hue: 15,
    tails: ['Mining', 'Metals', 'Minerals', 'Resources', 'Extraction'],
    niches: {
      copper:  { label: 'Copper', vol: 1.35, liq: 1.05, hype: 1.15, grow: .12,
        heads: ['Sierra Plata', 'Deepvein', 'Auroch', 'Cobre Alta'],
        blurbs: [
          'Grades that would be exceptional if the drill logs hold up.',
          'Electrification needs this and there is not enough of it. Simple.',
          'One asset, one jurisdiction, one very political permit.',
        ] },
      lithium: { label: 'Lithium', vol: 1.7, liq: 1.1, hype: 1.4, grow: -.02,
        heads: ['Brineworks', 'Salar', 'Kolar', 'Whitepan'],
        blurbs: [
          'Brine with a decade of offtake demand and a decade of build time.',
          'Priced off a spot market that moved 70% last year. Both ways.',
          'Everyone wants this to work, which is not the same as it working.',
        ] },
      rare:    { label: 'Rare Earths', vol: 1.55, liq: .95, hype: 1.5, grow: .04,
        heads: ['Lanthan', 'Vulcan Bay', 'Quarrystone', 'Neodym'],
        blurbs: [
          'Outside China, which is the entire investment case and the entire risk.',
          'Separation chemistry is the hard part and they claim to have it.',
          'Government offtake at a floor price. Read that contract twice.',
        ] },
      gold:    { label: 'Gold', vol: 1.3, liq: 1.1, hype: 1.1, grow: -.06,
        heads: ['Blackrock Ridge', 'Ophir', 'Kestrel Gold', 'Fool\'s Creek'],
        blurbs: [
          'An explorer that has never produced a single ounce of anything.',
          'All-in sustaining cost is below spot, which makes this a real company.',
          'Hedged nothing. Management call that "conviction".',
        ] },
      chem:    { label: 'Specialty Chemicals', vol: .85, liq: .9, hype: .65, grow: .16,
        heads: ['Calderon', 'Solvent Hall', 'Brenner', 'Aurelia Chem'],
        blurbs: [
          'Four molecules, each qualified into a customer\'s process for a decade.',
          'Switching cost is a two-year requalification. Nobody switches.',
          'Cyclical inputs, contracted outputs, and a very good hedging desk.',
        ] },
    },
  },

  /* ─────────────────────────── media ──────────────────────────── */
  media: {
    label: 'Media', short: 'MED', hue: 288,
    tails: ['Media', 'Studios', 'Entertainment', 'Networks', 'Content', 'Broadcasting'],
    niches: {
      games:   { label: 'Video Games', vol: 1.5, liq: 1.25, hype: 1.5, grow: .0,
        heads: ['Silverline', 'Chroma', 'Fable Works', 'Tessellate', 'Coldstart'],
        blurbs: [
          'Between hits. It is always between hits, right up until it is not.',
          'Live-service title in year six, still growing, which is nearly unheard of.',
          'One franchise, one studio, one very tired creative director.',
        ] },
      live:    { label: 'Live Events', vol: 1.25, liq: 1.2, hype: 1.35, grow: .12,
        heads: ['Ovation', 'Lantern', 'Bandstand', 'Ticket Hall'],
        blurbs: [
          'Owns the venue, the ticketing and the beer. All three.',
          'Genuinely unstoppable momentum and no economic moat whatsoever.',
          'Sold out eleven months ahead. Deferred revenue is enormous.',
        ] },
      streaming:{ label: 'Streaming', vol: 1.4, liq: 1.3, hype: 1.4, grow: -.06,
        heads: ['Nightingale', 'Broadsheet', 'Arclight', 'Continuum'],
        blurbs: [
          'Subscriber numbers defined with real creativity in the footnotes.',
          'Content spend is £2bn a year and the library is worth more than the company.',
          'Churn is the elephant, the room, and most of the furniture.',
        ] },
      creator: { label: 'Creator Platforms', vol: 1.6, liq: 1.35, hype: 1.55, grow: -.08,
        heads: ['Bylines', 'Patronage', 'Openfeed', 'Stagelight'],
        blurbs: [
          'Take rate is 12% and the top ten creators are 40% of revenue.',
          'One influencer leaving moves the share price. That is not a business.',
          'Growth is spectacular. Retention cohorts are not shown.',
        ] },
      classifieds:{ label: 'Classifieds & Listings', vol: .7, liq: 1.05, hype: .7, grow: .22,
        heads: ['Noticeboard', 'Marketplace Row', 'Hedgerow', 'Column Inch'],
        blurbs: [
          'Network effect so entrenched competitors have given up entering.',
          'Owns the property portal in a country of forty million people.',
          '85% EBITDA margins. Read that again.',
        ] },
    },
  },

  /* ─────────────────────────── logistics ──────────────────────── */
  log: {
    label: 'Transport', short: 'TRN', hue: 190,
    tails: ['Logistics', 'Freight', 'Shipping', 'Transport', 'Rail', 'Lines'],
    niches: {
      rail:    { label: 'Rail', vol: .65, liq: .9, hype: .6, grow: .18,
        heads: ['Beacon Line', 'Ridgeway', 'Continental Rail', 'Trellick'],
        blurbs: [
          'Concession to 2051. Nobody is building a competing railway.',
          'Freight volumes track GDP. The margins track a monopoly.',
          'Rolling stock is ancient and the maintenance capex shows it.',
        ] },
      shipping:{ label: 'Shipping', vol: 1.6, liq: 1.1, hype: .75, grow: -.08,
        heads: ['Longhaul', 'Fairhaven Marine', 'Cape Line', 'Bulwark'],
        blurbs: [
          'Dry bulk. Cyclical, and the cycle is either turning or taunting.',
          'Day rates tripled. Day rates have also, historically, fallen 80%.',
          'Fleet age is 14 years, which is a capex cliff with a countdown.',
        ] },
      cold:    { label: 'Cold Chain', vol: .8, liq: .9, hype: .8, grow: .18,
        heads: ['Frostline', 'Waypoint Cold', 'Chillbank', 'Northgate'],
        blurbs: [
          'Pharma contracts that require exactly this and nothing else.',
          'Temperature excursion means the cargo is worthless. They never have one.',
          'Warehouses are the asset; the trucking is almost a courtesy.',
        ] },
      lastmile:{ label: 'Last Mile', vol: 1.25, liq: 1.15, hype: 1.15, grow: -.06,
        heads: ['Portside', 'Doorstep', 'Rundown Row', 'Kerbside'],
        blurbs: [
          'Real density in four cities and catastrophic economics in eleven others.',
          'Driver costs are 62% of revenue and rising faster than price.',
          'Every parcel is profitable. Every route is not.',
        ] },
      ports:   { label: 'Ports & Terminals', vol: .7, liq: .85, hype: .7, grow: .20,
        heads: ['Harbourmaster', 'Quayside', 'Deepwater', 'Sloop Point'],
        blurbs: [
          'The permit is the business. The concrete is incidental.',
          'Handles 40% of a country\'s containers and answers to nobody.',
          'Inflation-linked tariffs and a hundred-year lease.',
        ] },
    },
  },

  /* ─────────────────────────── agriculture ────────────────────── */
  agri: {
    label: 'Agriculture', short: 'AGR', hue: 80,
    tails: ['Agriculture', 'Farms', 'Agri', 'Growers', 'Produce', 'Harvest'],
    niches: {
      vertical:{ label: 'Controlled Environment', vol: 1.5, liq: .9, hype: 1.35, grow: -.14,
        heads: ['Verdant Row', 'Stackfield', 'Glasshouse', 'Photonfarm'],
        blurbs: [
          'Lettuce grown under lights at a cost that assumes free electricity.',
          'The unit economics work at scale. Scale is the unsolved part.',
          'Third round of "revised" capex guidance this year.',
        ] },
      inputs:  { label: 'Crop Inputs', vol: .9, liq: .95, hype: .7, grow: .16,
        heads: ['Furrow', 'Greenlane', 'Nitron', 'Seedstock'],
        blurbs: [
          'Seed genetics licensed to every major grower on the continent.',
          'Biologicals replacing chemistry, slowly, at much better margins.',
          'Farmers buy this every single season regardless of the weather.',
        ] },
      aqua:    { label: 'Aquaculture', vol: 1.2, liq: .85, hype: .9, grow: .10,
        heads: ['Salmonry', 'Tidewater Farms', 'Fjordline', 'Netpen'],
        blurbs: [
          'Biological risk is real: one disease event and the year is gone.',
          'Protein conversion ratio better than any land animal. That is the case.',
          'Licences are capped by the regulator, which caps the competition too.',
        ] },
      protein: { label: 'Alternative Protein', vol: 1.65, liq: 1.0, hype: 1.3, grow: -.16,
        heads: ['Mycelia', 'Ferment Row', 'Culture Works', 'Provender'],
        blurbs: [
          'The category grew 200%, then shrank 40%, and nobody agrees why.',
          'Tastes genuinely good now, which was not always true.',
          'Burn rate assumes a retail listing that has not been signed.',
        ] },
    },
  },

  /* ─────────────────────────── services ──────────────────────── */
  svc: {
    label: 'Services', short: 'SVC', hue: 220,
    tails: ['Group', 'Partners', 'Services', 'Associates', 'Holdings'],
    niches: {
      staffing:{ label: 'Staffing', vol: 1.1, liq: 1.0, hype: .6, grow: .02,
        heads: ['Placement Row', 'Ludlow Search', 'Handover', 'Shiftwork'],
        blurbs: [
          'A leading indicator of the economy, which cuts both ways.',
          'Gross margin 18% and every consultant is a flight risk.',
          'Perm fees collapse in a downturn; contract keeps the lights on.',
        ] },
      education:{ label: 'Education', vol: 1.0, liq: .9, hype: .95, grow: .08,
        heads: ['Quadrangle', 'Hornbeam', 'Latin Row', 'Scholar Hall'],
        blurbs: [
          'Accreditation is the moat and the regulator holds the key.',
          'Enrolment is falling but price per student is climbing faster.',
          'Vocational training with a genuine employment outcome. Rare.',
        ] },
      facilities:{ label: 'Facilities Management', vol: .6, liq: .85, hype: .4, grow: .16,
        heads: ['Janitorial Row', 'Keeper', 'Upkeep', 'Broomfield'],
        blurbs: [
          'Cleans hospitals on ten-year contracts. Thrilling it is not.',
          'Margins of 5% on revenue nobody can dislodge.',
          'The most boring company you will ever profit from.',
        ] },
      testing: { label: 'Testing & Certification', vol: .6, liq: .9, hype: .65, grow: .24,
        heads: ['Assay Row', 'Kitemark', 'Verity Labs', 'Proofhouse'],
        blurbs: [
          'Regulation creates demand and regulation only ever increases.',
          'Accredited in 40 countries. Getting accredited takes eight years.',
          'One of the finest business models ever constructed, honestly.',
        ] },
    },
  },
};

export const SECTOR_KEYS = Object.keys(SECTORS);

/** Flat list of every niche as { sector, key, ...niche } — used for weighting. */
export const NICHES = [];
for (const [sk, S] of Object.entries(SECTORS)) {
  for (const [nk, N] of Object.entries(S.niches)) {
    NICHES.push({ sector: sk, key: nk, sectorLabel: S.label, ...N });
  }
}

export const nicheOf = (sectorKey, nicheKey) => SECTORS[sectorKey]?.niches?.[nicheKey];

/** Shared tail pool fallback so every niche can build a plausible name. */
export const tailsFor = (sectorKey) => SECTORS[sectorKey].tails;
