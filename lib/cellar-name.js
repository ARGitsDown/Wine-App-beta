// What to call a Domaine's cellar wherever it is shown to a person - the
// guest screens' header and greeting, the drafted invite message, the
// People page's hint about a blank name. One rule in one place, so the
// friend reading their invite and the friend browsing afterwards see the
// same name.
//
// The estate's own name if one was set (see Domaine.name) - already reads
// as a place, so it stands alone rather than taking a possessive - and
// otherwise the founding Cellarmaster's own name, the person a guest most
// likely knows the cellar by. Plain functions with no imports, so a
// client component can use them too.

// The founder's name in their own words: a display name if Google or the
// profile provided one, their email otherwise, and only "the owner" if
// somehow neither exists (a row from before either was required).
export function founderDisplayName(founder) {
  return founder?.name || founder?.email || "the owner";
}

export function cellarDisplayName(domaine, founder) {
  return domaine?.name || `${founderDisplayName(founder)}'s cellar`;
}
