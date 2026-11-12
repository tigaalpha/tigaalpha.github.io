import { useEffect, useState } from "react";
import { catalogVersion, isExtraLang, loadCatalog, subscribeCatalog } from "./lang-extra";

/* A hook for a root component: loads the catalog of the chosen language and re-renders when it arrives (or is replaced).
   Everything below that root re-renders with it, which is what makes the lookups in lang-extra.ts show the translated text. */
export function useCatalog(lang: string): number {
  const [tick, setTick] = useState(catalogVersion());
  useEffect(() => subscribeCatalog(() => setTick(catalogVersion())), []);
  useEffect(() => { if (isExtraLang(lang)) loadCatalog(lang); }, [lang]);
  return tick;
}
