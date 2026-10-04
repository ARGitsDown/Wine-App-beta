// What goes on a printed dinner or flight card. Pure, so the choice of which
// wines to print is tested (scripts/print-card.test.mjs).
//
// The card is for a table, not for deciding: it names the wines, not the
// model's arguments for them. A pairing prints the wines chosen to Drink when
// any have been chosen (those are the evening's wines), and otherwise every
// wine that is not on Hold, labelled as suggestions. A flight prints in its
// running order, one line each, without the model's reasons.

import { groupPicksByDish } from "./pairings.js";

// "Rochioli “Three Corner” 2018" from a pick: the label as it read when the
// pairing was kept, which is what the owner chose from.
export function pickWineText(pick) {
  return (pick.wineLabel || pick.wineName || "").trim();
}

export function pairingCard(pairing) {
  const picks = pairing.picks ?? [];
  const chosen = picks.filter((pick) => pick.decision === "drink");
  const usable = chosen.length > 0 ? chosen : picks.filter((pick) => pick.decision !== "hold");
  const groups = groupPicksByDish(usable)
    .map((group) => ({ dish: group.dish, wines: group.picks.map(pickWineText).filter(Boolean) }))
    .filter((group) => group.wines.length > 0);
  return {
    title: pairing.title || pairing.request || "Pairing",
    request: pairing.title && pairing.request && pairing.title !== pairing.request ? pairing.request : null,
    suggestionsOnly: chosen.length === 0,
    groups,
  };
}

export function flightCard(flight, label) {
  const wines = (flight.picks ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((pick) => ({ text: label(pick.bottle) }))
    .filter((wine) => wine.text);
  return {
    title: flight.title || flight.summary || "Tasting flight",
    summary: flight.title && flight.summary ? flight.summary : null,
    wines,
  };
}
