# TIGACODE Web

หน้าเว็บแชทของ TIGACODE — เลือกโมเดลจาก dropdown แล้วคุยได้ผ่านเบราว์เซอร์ ใช้ core
engine เดียวกับ CLI (`../src/models.js`, `../src/providers/*`) จึงเห็นโมเดลชุดเดียวกัน
และตั้งค่าคีย์ที่เดียวกัน (`TIGACODE/.env`)

**ขอบเขตต่างจาก CLI**: หน้านี้เป็น chat playground ล้วน ๆ — ไม่มี tool อ่าน/เขียนไฟล์หรือรัน
คำสั่ง shell เหมือน CLI (`bin/tigacode.js`) เพราะถ้า deploy ขึ้นที่สาธารณะ การเปิดให้ endpoint
รันคำสั่งในเครื่อง server ได้โดยไม่มี auth จะเป็นช่องโหว่ร้ายแรง (ใครก็ตามที่เจอ URL จะสั่งรันคำสั่ง
บน server ได้) ถ้าต้องการ agent ที่แก้โค้ดได้ ใช้ CLI

## รันในเครื่องตัวเอง (ได้แน่นอน ไม่ต้อง deploy ที่ไหน)

```bash
cd TIGACODE          # ต้องมี .env ตั้งค่าคีย์ไว้แล้ว (ดู README หลักของ TIGACODE)
cd web
node server.js
# เปิด http://localhost:3210
```

## Deploy ขึ้น Vercel (เพื่อให้ได้ลิงก์สาธารณะ)

โฟลเดอร์นี้เขียนให้ deploy บน Vercel ได้แบบ zero-config อยู่แล้ว (`api/*.js` เป็น
serverless function โดยอัตโนมัติ, ไฟล์ `index.html`/`app.js`/`style.css` เสิร์ฟเป็น static
โดยอัตโนมัติ) — แต่ต้องทำผ่านบัญชี Vercel ของคุณเอง เพราะ session นี้ไม่มีสิทธิ์ deploy ให้:

1. ไปที่ [vercel.com/new](https://vercel.com/new) แล้ว import repo `tigaalpha/tigaalpha.github.io`
2. ตั้งค่า **Root Directory** เป็น `TIGACODE/web` (สำคัญ — ไม่งั้น Vercel จะไปเจอแอปเปียโนหลักแทน)
3. ใส่ Environment Variables เท่าที่จะใช้จริง (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
   `ZHIPU_API_KEY`, `DASHSCOPE_API_KEY`, `MOONSHOT_API_KEY`, `MIMO_API_KEY`/`MIMO_BASE_URL`)
4. Deploy — จะได้โปรเจกต์ Vercel **ใหม่แยกต่างหาก** ไม่เกี่ยวกับโปรเจกต์ของแอปเปียโนหลักที่ใช้
   `vercel.json` ที่ root ของ repo เลย (ไฟล์นั้นไม่ถูกแตะต้อง)

ทุกครั้งที่ push ขึ้น branch นี้ Vercel จะ build ใหม่อัตโนมัติเป็น preview URL ของมันเอง
(พฤติกรรมมาตรฐานของ Vercel เมื่อเชื่อม GitHub repo แล้ว)

## สถานะที่ยังไม่รองรับ

- ไม่มี streaming (รอ response เต็มก่อนแสดง)
- ไม่ persist ประวัติแชท (refresh หน้าแล้วหาย — เก็บใน memory ฝั่ง browser เท่านั้น)
- ไม่มี auth — ใครก็ตามที่เข้าถึง URL ได้ (ไม่ว่า local หรือ deploy แล้ว) ใช้คีย์ที่ตั้งไว้ยิง
  request ได้หมด ถ้า deploy ขึ้นสาธารณะและกังวลเรื่องนี้ ให้เพิ่ม auth เอง (เช่น Vercel's
  password-protection บน preview deployment) ก่อนแชร์ลิงก์ให้คนอื่น
