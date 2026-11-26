/* The landing page's door to analytics.ts. That file imports only local-identity.ts (never app code), so the landing bundle may use it; one implementation keeps the app and the landing sending the same events. */
export { track, mirrorUsage, readConsent, setConsent, signupUtm, ANALYTICS_DEFAULT_GRANTED, CONSENT_VERSION } from "../analytics";
