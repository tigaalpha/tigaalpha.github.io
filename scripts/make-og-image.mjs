/* ── scripts/make-og-image.mjs ──
   Builds public/og-card.png (1200x630), the Open Graph card every link
   preview renders. It exists because the old og:image was the app icon
   (SVG), and Facebook, Instagram and LINE do not render SVG in previews —
   every share in a feed showed an empty box. Drawn with raw Pillow calls
   rather than a headless browser so the build needs no Chromium; the layout
   mirrors the landing page itself: cream ground, orange TIGA mark, piano
   keys along the bottom, the pitch in three words. */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const OUT = "public/og-card.png";

const PY = `
from PIL import Image, ImageDraw

W, H = 1200, 630
ACC = (217, 119, 87)        # --acc
BG = (250, 249, 245)        # --bg
CARD = (255, 255, 255)      # --key white
KEYBD = (212, 207, 197)     # --key-w-bd
BLACK = (27, 25, 23)        # --key-b
TEXT = (20, 20, 19)         # --text
MUTED = (125, 122, 112)     # --muted

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

# ── TIGA mark ──
try:
    from PIL import ImageFont
    f_mark = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 84)
    f_head = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 64)
    f_sub  = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 34)
    f_th   = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 30)
except Exception:
    f_mark = f_head = f_sub = f_th = None

mark = "TIGA"
mw = d.textlength(mark, font=f_mark)
mx = (W - mw) / 2
d.rounded_rectangle([mx - 44, 84, mx + mw + 44, 84 + 130], radius=30,
                    outline=ACC, width=8)
d.text((mx, 108), mark, fill=ACC, font=f_mark)

# ── headline ──
head = "Your AI piano teacher plays"
hw = d.textlength(head, font=f_head)
d.text(((W - hw) / 2, 300), head, fill=TEXT, font=f_head)
head2 = "the answer, finger by finger"
hw2 = d.textlength(head2, font=f_head)
d.text(((W - hw2) / 2, 384), head2, fill=ACC, font=f_head)

sub = "Ask anything - it answers by playing. No sign-up to try."
sw = d.textlength(sub, font=f_sub)
d.text(((W - sw) / 2, 486), sub, fill=MUTED, font=f_sub)

# ── piano keys along the bottom edge ──
KEYS = 14
kw = W / KEYS
keytop = H - 96
for i in range(KEYS):
    x0 = i * kw
    white_note = i % 7 not in (2, 6)  # E/F and B/C gaps make the black-key pattern
    d.rectangle([x0, keytop, x0 + kw - 2, H], fill=CARD, outline=KEYBD, width=2)
# black keys sit between most whites
for i in range(KEYS):
    if i % 7 in (2, 6):
        continue
    if i + 1 < KEYS and i % 7 not in (0, 3):
        bx = (i + 1) * kw - kw * 0.30
        d.rectangle([bx, keytop, bx + kw * 0.6, keytop + 58], fill=BLACK)
# one lit key so the card says "playable", not "diagram"
lit = 4
d.rectangle([lit * kw, keytop, (lit + 1) * kw - 2, H], fill=ACC)

img.save(${JSON.stringify(OUT)}, "PNG")
print("og-card:", img.size)
`;

writeFileSync("/tmp/og.py", PY);
execSync(`python3 /tmp/og.py`, { stdio: "inherit" });
