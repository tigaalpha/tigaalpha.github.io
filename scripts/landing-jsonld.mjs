/* ── scripts/landing-jsonld.mjs ──
   schema.org JSON-LD for marketing landing page 1, one block per language.
   landing/index.template.html carries the Thai block verbatim (vite leaves
   application/ld+json untouched); landing-locales.mjs swaps it for the
   en/zh block, so url + inLanguage always match the page they ship on.
   Facts only: no ratings or reviews. The public offer is one price:
   7 days of Premium free, then 799 THB per month, for everyone. */
const BASE = "https://www.tigaalpha.com";
const PAGES = { th: `${BASE}/landing/`, en: `${BASE}/landing-en/`, zh: `${BASE}/landing-zh/` };
const NAME = {
  th: "ลองเรียนเปียโนกับครู AI — TIGA",
  en: "Try a piano lesson with an AI teacher — TIGA",
  zh: "和 AI 钢琴老师试上一课 — TIGA",
};
const APP_DESC = {
  th: "TIGA AI แอปพลิเคชันสอนเปียโนด้วยเอไอ เรียนออนไลน์ สอนได้ 3 ภาษา ไทย อังกฤษ จีนกลาง ผลงานของคนไทย ก่อตั้งโดยครูอั้ม (CEO) ครูสอนเปียโนประสบการณ์ 20 ปี",
  en: "TIGA AI is an AI piano-teaching application that teaches online in three languages: Thai, English and Mandarin Chinese. Made by Thais. Founded by Teacher Aum (ครูอั้ม), CEO and piano teacher with 20 years of experience.",
  zh: "TIGA AI 是在线 AI 钢琴教学应用，支持泰语、英语和普通话三种语言，由泰国人打造。创始人兼 CEO 为阿姆老师（ครูอั้ม），拥有 20 年钢琴教学经验。",
};
const OFFER_NAME = { th: "แพ็กเกจพรีเมียม", en: "Premium", zh: "高级版" };
const OFFER_DESC = {
  th: "ทุกคนเล่นแพ็กเกจพรีเมียมฟรี 7 วัน แล้วต่อเดือนละ 799 บาท",
  en: "Everyone gets 7 days of Premium free, then 799 THB/month",
  zh: "所有人均可免费使用高级版 7 天，之后每月 799 泰铢",
};

function premiumOffer(lang) {
  return {
    "@type": "Offer",
    "name": OFFER_NAME[lang],
    "description": OFFER_DESC[lang],
    "price": "799",
    "priceCurrency": "THB",
    "priceSpecification": {
      "@type": "UnitPriceSpecification",
      "price": "799",
      "priceCurrency": "THB",
      "billingDuration": "P1M",
      "unitText": "MONTH",
    },
  };
}

export function landingJsonLd(lang) {
  const url = PAGES[lang];
  if (!url) throw new Error(`landing-jsonld: unknown lang ${lang}`);
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        "url": url,
        "name": NAME[lang],
        "inLanguage": lang,
        "about": { "@id": `${BASE}/landing/#tiga-ai` },
        "publisher": { "@id": "https://www.tigastudio.net/#organization" },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${BASE}/landing/#tiga-ai`,
        "name": "TIGA AI",
        "applicationCategory": "EducationalApplication",
        "operatingSystem": "Web",
        "description": APP_DESC[lang],
        "url": url,
        "sameAs": Object.values(PAGES).filter((u) => u !== url),
        "inLanguage": ["th", "en", "zh"],
        "countryOfOrigin": { "@type": "Country", "name": "Thailand" },
        "keywords": "แอปพลิเคชันสอนเปียโนออนไลน์, สอนเปียโนด้วยเอไอ, เล่นเปียโน, เล่นดนตรี, สอนดนตรี, online piano learning app, AI piano lessons",
        "creator": { "@id": "https://www.tigastudio.net/#teacher-aum" },
        "publisher": { "@id": "https://www.tigastudio.net/#organization" },
        "offers": premiumOffer(lang),
      },
      {
        "@type": "Person",
        "@id": "https://www.tigastudio.net/#teacher-aum",
        "name": "Teacher Aum (ครูอั้ม)",
        "alternateName": ["ครูอั้ม", "阿姆老师", "Teacher Aum"],
        "jobTitle": "CEO",
        "description": "Founder and CEO of TIGA AI. Piano teacher with 20 years of experience.",
        "worksFor": { "@id": "https://www.tigastudio.net/#organization" },
        "knowsLanguage": ["th", "en", "zh"],
      },
      {
        "@type": ["EducationalOrganization", "LocalBusiness"],
        "@id": "https://www.tigastudio.net/#organization",
        "name": "TIGA Studio",
        "url": "https://www.tigastudio.net/",
        "telephone": "+66-84-111-9531",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "หมู่บ้านเมืองเอกรังสิต โครงการ 4",
          "addressLocality": "Rangsit",
          "addressRegion": "Pathum Thani",
          "addressCountry": "TH",
        },
        "priceRange": "THB 27000",
        "founder": { "@id": "https://www.tigastudio.net/#teacher-aum" },
        "sameAs": ["https://www.tiktok.com/@tiga.piano_studio", "https://www.youtube.com/@tiga.studio"],
      },
    ],
  };
  return `<script type="application/ld+json">${JSON.stringify(graph)}</script>`;
}
