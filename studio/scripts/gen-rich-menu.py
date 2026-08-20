#!/usr/bin/env python3
"""Generate bos/public/rich-menu.png — the LINE Rich Menu image (2500x843).

Run:  python3 scripts/gen-rich-menu.py
Requires: pillow + a Thai TTF (Sarabun) at scripts/fonts/Sarabun-Bold.ttf
(put the font file there before running; output is committed to public/).
"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_PATH = os.path.join(HERE, "fonts", "Sarabun-Bold.ttf")
OUT = os.path.join(HERE, "..", "public", "rich-menu.png")

W, H = 2500, 843
img = Image.new("RGB", (W, H), "#13141c")
d = ImageDraw.Draw(img)


def font(size):
    return ImageFont.truetype(FONT_PATH, size)


f_label = font(58)
f_sub = font(40)

# ---- top band (brand) ----
band_h = 210
for i in range(band_h):
    t = i / band_h
    r = int(19 + (124 - 19) * t)
    g = int(20 + (45 - 20) * t)
    b = int(28 + (249 - 28) * t)
    d.line([(0, i), (W, i)], fill=(r, g, b))

# piano keys motif
keys_x = 1500
for k in range(14):
    x = keys_x + k * 62
    d.rectangle([x, 18, x + 52, band_h - 18], fill=(245, 245, 250), outline=(30, 30, 40), width=3)
for k in range(13):
    x = keys_x + 46 + k * 62
    d.rectangle([x, 18, x + 30, 120], fill=(20, 20, 30))

d.text((70, 30), "TIGA", font=font(96), fill="#ffffff")
d.text((70, 130), "PIANO STUDIO", font=f_sub, fill="#d8b4fe")

# ---- 4 tiles ----
tile_w = 625
colors = [
    (109, 40, 217),  # purple - จองคอร์ส
    (37, 99, 235),   # blue   - ดูตาราง
    (13, 148, 136),  # teal   - ราคา
    (234, 88, 12),   # orange - คุยกับคน
]
labels = ["จองคอร์ส", "ดูตาราง", "ราคา", "คุยกับคน"]
subs = ["BOOK A LESSON", "CHECK SCHEDULE", "PRICES & PACKS", "TALK TO US"]

for i in range(4):
    x0 = i * tile_w
    x1 = x0 + tile_w
    base = colors[i]
    for y in range(band_h, H):
        t = (y - band_h) / (H - band_h)
        r = int(base[0] + (30 - base[0]) * t)
        g = int(base[1] + (30 - base[1]) * t)
        b = int(base[2] + (35 - base[2]) * t)
        d.line([(x0, y), (x1, y)], fill=(r, g, b))
    if i > 0:
        d.rectangle([x0 - 2, band_h, x0 + 2, H], fill="#ffffff")

    cx = x0 + tile_w // 2
    icon_top = band_h + 120

    if i == 0:  # calendar
        d.rounded_rectangle([cx - 130, icon_top, cx + 130, icon_top + 230], radius=28, fill="#ffffff")
        d.rectangle([cx - 130, icon_top, cx + 130, icon_top + 60], fill="#fef3c7")
        d.rounded_rectangle([cx - 95, icon_top + 110, cx + 95, icon_top + 150], radius=10, fill=base)
        d.rounded_rectangle([cx - 95, icon_top + 180, cx + 40, icon_top + 205], radius=8, fill="#ffffff")
    elif i == 1:  # clock
        d.ellipse([cx - 135, icon_top, cx + 135, icon_top + 270], outline="#ffffff", width=18)
        d.line([(cx, icon_top + 135), (cx, icon_top + 55)], fill="#ffffff", width=14)
        d.line([(cx, icon_top + 135), (cx + 70, icon_top + 175)], fill="#ffffff", width=14)
        d.ellipse([cx - 16, icon_top + 119, cx + 16, icon_top + 151], fill="#ffffff")
    elif i == 2:  # coin with baht
        d.ellipse([cx - 135, icon_top + 10, cx + 135, icon_top + 280], fill="#fef3c7", outline="#ffffff", width=10)
        d.text((cx - 45, icon_top + 70), "\u0e3f", font=font(140), fill="#92400e")
    else:  # chat bubble
        d.rounded_rectangle([cx - 150, icon_top, cx + 150, icon_top + 200], radius=40, fill="#ffffff")
        d.polygon([(cx - 20, icon_top + 195), (cx + 40, icon_top + 195), (cx + 10, icon_top + 260)], fill="#ffffff")
        d.ellipse([cx - 70, icon_top + 60, cx - 20, icon_top + 110], fill=base)
        d.ellipse([cx - 5, icon_top + 60, cx + 45, icon_top + 110], fill=base)
        d.ellipse([cx + 60, icon_top + 60, cx + 110, icon_top + 110], fill=base)

    lw = d.textlength(labels[i], font=f_label)
    d.text((cx - lw / 2, H - 150), labels[i], font=f_label, fill="#ffffff")
    sw = d.textlength(subs[i], font=f_sub)
    d.text((cx - sw / 2, H - 80), subs[i], font=f_sub, fill="#e5e7eb")

os.makedirs(os.path.dirname(OUT), exist_ok=True)
img.save(OUT, "PNG")
print("saved", os.path.abspath(OUT), img.size)
