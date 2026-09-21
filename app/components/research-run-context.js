"use client";

import { createContext, useContext } from "react";

// The context lives in its own module, apart from the provider that fills
// it and the components that read it, and that separation is load-bearing
// rather than tidiness.
//
// A client module that a Server Component imports becomes a *client
// entry*, and what another client module gets when it imports that same
// path is the generated reference to it, not the module itself - so the
// `createContext(null)` inside it is evaluated twice and the provider ends
// up filling a different context than the reader is reading. The symptom
// is a provider that demonstrably renders and a child one element deeper
// that insists there isn't one. Keeping the context somewhere no Server
// Component ever imports means there is only ever one of it.
export const ResearchRunContext = createContext(null);

export function useResearchRun() {
  const value = useContext(ResearchRunContext);
  if (!value) throw new Error("useResearchRun must be used inside a ResearchRunProvider");
  return value;
}
