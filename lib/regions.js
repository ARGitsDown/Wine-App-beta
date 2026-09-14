// A curated list of well-known wine regions/appellations, for the Region
// autocomplete on the bottle form and filter bar. Unlike lib/varietals.js,
// there's no authoritative canonical-name problem to solve here (a region
// name doesn't have "synonyms" the way a grape does) - this is just a
// starting set of suggestions. getRegionOptions() in lib/bottles.js
// supplements it with whatever region names are already in this cellar, so
// the list grows with real use instead of needing to be exhaustive here.
export const KNOWN_REGIONS = [
  // United States
  "California", "Napa Valley", "Sonoma County", "Sonoma Coast",
  "Russian River Valley", "Alexander Valley", "Dry Creek Valley",
  "Paso Robles", "Santa Barbara County", "Santa Ynez Valley",
  "Santa Lucia Highlands", "Central Coast", "Sierra Foothills", "Lodi",
  "Oregon", "Willamette Valley", "Washington", "Columbia Valley",
  "Walla Walla Valley", "New York", "Finger Lakes", "Virginia", "Texas",

  // France
  "Bordeaux", "Médoc", "Margaux", "Saint-Julien", "Pauillac",
  "Saint-Estèphe", "Pomerol", "Saint-Émilion", "Graves", "Sauternes",
  "Burgundy", "Côte de Nuits", "Côte de Beaune", "Chablis", "Beaujolais",
  "Champagne", "Rhône Valley", "Châteauneuf-du-Pape", "Côte-Rôtie",
  "Hermitage", "Condrieu", "Loire Valley", "Sancerre", "Pouilly-Fumé",
  "Vouvray", "Muscadet", "Alsace", "Languedoc", "Roussillon", "Provence",
  "Jura", "Savoie", "Southwest France", "Bergerac", "Cahors", "Madiran",

  // Italy
  "Piedmont", "Barolo", "Barbaresco", "Langhe", "Asti", "Tuscany",
  "Chianti", "Chianti Classico", "Brunello di Montalcino",
  "Vino Nobile di Montepulciano", "Bolgheri", "Veneto", "Valpolicella",
  "Amarone", "Soave", "Prosecco", "Friuli-Venezia Giulia", "Alto Adige",
  "Trentino", "Sicily", "Etna", "Sardinia", "Abruzzo", "Campania",
  "Puglia", "Umbria", "Marche",

  // Spain
  "Rioja", "Ribera del Duero", "Priorat", "Rías Baixas", "Rueda",
  "Jerez", "Penedès", "Jumilla", "Toro", "Bierzo", "Navarra",

  // Portugal
  "Douro", "Vinho Verde", "Dão", "Bairrada", "Alentejo", "Madeira",

  // Germany / Austria / Hungary
  "Mosel", "Rheingau", "Rheinhessen", "Pfalz", "Nahe", "Baden",
  "Württemberg", "Wachau", "Kamptal", "Kremstal", "Burgenland", "Tokaj",

  // Greece
  "Santorini", "Nemea", "Naoussa",

  // Australia
  "Barossa Valley", "McLaren Vale", "Coonawarra", "Margaret River",
  "Hunter Valley", "Yarra Valley", "Clare Valley", "Adelaide Hills",
  "Eden Valley",

  // New Zealand
  "Marlborough", "Central Otago", "Hawke's Bay", "Martinborough",

  // South Africa
  "Stellenbosch", "Paarl", "Swartland", "Franschhoek",

  // South America
  "Maipo Valley", "Colchagua Valley", "Casablanca Valley",
  "Aconcagua Valley", "Mendoza", "Uco Valley", "Salta",

  // Canada
  "Okanagan Valley", "Niagara Peninsula",
];
