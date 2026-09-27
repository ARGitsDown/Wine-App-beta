// A curated list of well-known wine regions/appellations, for the Region
// autocomplete on the bottle form and filter bar. Unlike lib/varietals.js,
// there's no authoritative canonical-name problem to solve here (a region
// name doesn't have "synonyms" the way a grape does) - this is just a
// starting set of suggestions. getRegionOptions() in lib/bottles.js
// supplements it with whatever region names are already in this cellar, so
// the list grows with real use instead of needing to be exhaustive here.
//
// Grouped by country as data, not just as a comment above a flat array -
// this is what lets BottleForm auto-fill Country from a known Region and
// warn softly on a mismatch (BACKLOG #17). Two groups genuinely mix
// countries and are split accordingly rather than grouped by the loose
// heading a human would reach for: Wachau/Kamptal/Kremstal/Burgenland are
// Austria and Tokaj is Hungary, not Germany; Mendoza/Uco Valley/Salta are
// Argentina, not Chile.
const REGIONS_BY_COUNTRY = {
  "United States": [
    "California", "Napa Valley", "Sonoma County", "Sonoma Coast",
    "Russian River Valley", "Alexander Valley", "Dry Creek Valley",
    "Paso Robles", "Santa Barbara County", "Santa Ynez Valley",
    "Santa Lucia Highlands", "Central Coast", "Sierra Foothills", "Lodi",
    "Oregon", "Willamette Valley", "Washington", "Columbia Valley",
    "Walla Walla Valley", "New York", "Finger Lakes", "Virginia", "Texas",
  ],
  France: [
    "Bordeaux", "Médoc", "Margaux", "Saint-Julien", "Pauillac",
    "Saint-Estèphe", "Pomerol", "Saint-Émilion", "Graves", "Sauternes",
    "Burgundy", "Côte de Nuits", "Côte de Beaune", "Chablis", "Beaujolais",
    "Champagne", "Rhône Valley", "Châteauneuf-du-Pape", "Côte-Rôtie",
    "Hermitage", "Condrieu", "Loire Valley", "Sancerre", "Pouilly-Fumé",
    "Vouvray", "Muscadet", "Alsace", "Languedoc", "Roussillon", "Provence",
    "Jura", "Savoie", "Southwest France", "Bergerac", "Cahors", "Madiran",
  ],
  Italy: [
    "Piedmont", "Barolo", "Barbaresco", "Langhe", "Asti", "Tuscany",
    "Chianti", "Chianti Classico", "Brunello di Montalcino",
    "Vino Nobile di Montepulciano", "Bolgheri", "Veneto", "Valpolicella",
    "Amarone", "Soave", "Prosecco", "Friuli-Venezia Giulia", "Alto Adige",
    "Trentino", "Sicily", "Etna", "Sardinia", "Abruzzo", "Campania",
    "Puglia", "Umbria", "Marche",
  ],
  Spain: [
    "Rioja", "Ribera del Duero", "Priorat", "Rías Baixas", "Rueda",
    "Jerez", "Penedès", "Jumilla", "Toro", "Bierzo", "Navarra",
  ],
  Portugal: ["Douro", "Vinho Verde", "Dão", "Bairrada", "Alentejo", "Madeira"],
  Germany: ["Mosel", "Rheingau", "Rheinhessen", "Pfalz", "Nahe", "Baden", "Württemberg"],
  Austria: ["Wachau", "Kamptal", "Kremstal", "Burgenland"],
  Hungary: ["Tokaj"],
  Greece: ["Santorini", "Nemea", "Naoussa"],
  Australia: [
    "Barossa Valley", "McLaren Vale", "Coonawarra", "Margaret River",
    "Hunter Valley", "Yarra Valley", "Clare Valley", "Adelaide Hills",
    "Eden Valley",
  ],
  "New Zealand": ["Marlborough", "Central Otago", "Hawke's Bay", "Martinborough"],
  "South Africa": ["Stellenbosch", "Paarl", "Swartland", "Franschhoek"],
  Chile: ["Maipo Valley", "Colchagua Valley", "Casablanca Valley", "Aconcagua Valley"],
  Argentina: ["Mendoza", "Uco Valley", "Salta"],
  Canada: ["Okanagan Valley", "Niagara Peninsula"],
};

export const KNOWN_REGIONS = Object.values(REGIONS_BY_COUNTRY).flat();

// region -> country, lowercased so a lookup doesn't care about the exact
// case someone typed (the Region field is free text with a datalist, not a
// locked dropdown - a hand-typed "bordeaux" should still imply France).
const REGION_TO_COUNTRY = new Map(
  Object.entries(REGIONS_BY_COUNTRY).flatMap(([country, regions]) =>
    regions.map((region) => [region.toLowerCase(), country])
  )
);

// The country a known region implies, or null for anything not in the
// curated list (a region only saved from real use, or one the model read
// off a label that isn't here yet) - null means "no opinion", not "no
// country", so a caller can tell "nothing to check" apart from a genuine
// mismatch.
export function countryForRegion(region) {
  return REGION_TO_COUNTRY.get(String(region ?? "").trim().toLowerCase()) ?? null;
}
