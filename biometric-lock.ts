/* ── Fingerprint / face unlock for the admin console ──

   This wraps WebAuthn's platform authenticator: on Android that is the phone's
   fingerprint sensor, on iOS Face ID or Touch ID, on a laptop Windows Hello or
   the Mac's sensor. The browser does the whole prompt; nothing here ever sees
   a fingerprint, and there is nothing to store that could leak one — the only
   thing kept is an opaque credential id the authenticator hands back, which is
   useless anywhere except on the device that made it.

   WHAT THIS DOES AND DOES NOT PROTECT. The admin console's real protection has
   always been server-side: every query it makes is re-checked by RLS against
   profiles.is_admin, so an unlocked screen on a stranger's phone still cannot
   read or change anything. The passcode is a doorway, not the lock, and it is
   compiled into the bundle where a determined person can read it. A fingerprint
   is genuinely better than typing that code in a cafe where someone can watch
   your hands, and it is bound to this one device — but it sits alongside the
   code, so it raises the floor rather than the ceiling. Making it the ceiling
   means moving the code check to the server, which is a separate job.

   The credential is per admin tier, so an owner's phone and a staff phone do
   not share an enrolment, and per device: enrolling here says nothing about
   any other phone you sign in from. */

const KEY = "tg_bio_cred_";          // + tier
const RP_NAME = "TIGA.AI Admin";

function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64url(s: string): Uint8Array {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

/* Is there a built-in fingerprint/face sensor this browser will let us use?
   Three things have to hold: the API exists, the page is a secure context
   (WebAuthn is https-only, which GitHub Pages is), and the device actually has
   a user-verifying platform authenticator. The last one is a real check, not a
   feature-detect — a desktop with no sensor answers false. */
export async function bioAvailable(): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !window.isSecureContext) return false;
    const PKC = (window as any).PublicKeyCredential;
    if (!PKC || !navigator.credentials || !PKC.isUserVerifyingPlatformAuthenticatorAvailable) return false;
    return await PKC.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch (_e) { return false; }
}

/** Has this device already enrolled a finger for this admin tier? */
export function bioEnrolled(tier: number): boolean {
  try { return !!localStorage.getItem(KEY + tier); } catch (_e) { return false; }
}

/** Forget the enrolment on this device (the authenticator keeps its own copy;
    this only stops us offering it, which is all we are entitled to do). */
export function bioForget(tier: number): void {
  try { localStorage.removeItem(KEY + tier); } catch (_e) {}
}

/* Enrol. Only ever called straight after a correct passcode, so the person
   asking has already proved they belong here; this records WHICH finger on
   WHICH device may skip typing it next time.

   authenticatorAttachment "platform" keeps this to the sensor built into the
   device — no roaming security keys to lose. userVerification "required" means
   an actual fingerprint or face, never just a screen unlock or a tap. */
export async function bioEnroll(tier: number): Promise<boolean> {
  try {
    if (!(await bioAvailable())) return false;
    const cred: any = await navigator.credentials.create({
      publicKey: {
        challenge: randomBytes(32),
        rp: { name: RP_NAME },            // no id: the browser uses this origin
        user: {
          id: randomBytes(16),
          name: "admin-tier-" + tier,
          displayName: "TIGA Admin",
        },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred",
        },
        attestation: "none",              // we are not verifying a maker; do not collect one
        timeout: 60000,
      },
    } as any);
    if (!cred || !cred.rawId) return false;
    localStorage.setItem(KEY + tier, b64url(cred.rawId));
    return true;
  } catch (_e) { return false; }         // cancelled, unsupported, no sensor — all just "no"
}

/* Verify. Succeeds only if the authenticator produced an assertion for the
   exact credential this device enrolled, after a real fingerprint or face
   check. A cancelled prompt, a wrong finger, or a credential deleted from the
   phone's settings all land here as false, and the passcode still works. */
export async function bioVerify(tier: number): Promise<boolean> {
  try {
    const id = localStorage.getItem(KEY + tier);
    if (!id) return false;
    if (!(await bioAvailable())) return false;
    const assertion: any = await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        allowCredentials: [{ type: "public-key", id: unb64url(id) }],
        userVerification: "required",
        timeout: 60000,
      },
    } as any);
    return !!(assertion && assertion.rawId && b64url(assertion.rawId) === id);
  } catch (_e) { return false; }
}
