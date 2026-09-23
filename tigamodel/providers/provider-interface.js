/* ── tigamodel/providers/provider-interface.js ──
   The ONE contract every foundation-model provider must satisfy (spec §5, §7).
   TIGA Core calls providers only through this interface — adapters own all
   wire-format knowledge. Registering an adapter here is the ONLY way a
   provider becomes visible to the router.

   Contract (async complete(tigaRequest, {signal}) → tigaResponse):
   - MUST return a TIGAResponse (use makeTIGAResponse) — never a raw provider
     payload; if the provider errored, return status:"error" (never throw, so
     router fallback logic stays in one place).
   - MUST be swappable: same input → equivalent teaching behavior regardless
     of which adapter served it. Model names live in adapter internals/config.
   - declare() advertises capabilities so the router can pre-filter
     (taskTypes, latency class, relative cost, privacy/data-handling class,
     multimodal support) WITHOUT core knowing provider identities. ── */

const _providers = new Map(); // name → { declare, complete }

export function registerProvider(name, adapter) {
  if (!name || typeof adapter?.complete !== "function") {
    throw new Error("registerProvider: needs { name, adapter: { complete } }");
  }
  _providers.set(String(name), {
    name: String(name),
    declare: adapter.declare || (() => ({ taskTypes: ["chat"], cost: "medium", latency: "medium", privacy: "cloud", modalities: ["text"] })),
    complete: adapter.complete,
  });
}

export function getProvider(name) { return _providers.get(String(name)) || null; }
export function listProviders() { return Array.from(_providers.values()); }

/* Capability classes the router reasons over (spec §6, §26).
   Kept as data here so policy files and eval results can reference the
   same vocabulary without importing provider code. */
export const COST_TIERS = ["free", "low", "medium", "high"];
export const LATENCY_CLASSES = ["fast", "medium", "slow"];
export const PRIVACY_CLASSES = ["cloud", "cloud-strict", "local"]; // local = data never leaves device
