# Blog promo template: handover for the external blog writer

Date: 2026-11-17

Updated 2026-11-19: the language sentence in every block below now says "10 languages" and lists the ten in the site's canonical usage order (Thai, English, Chinese, Arabic, Japanese, Russian, Spanish, French, Hindi, Korean), on the owner's request that the site must say 10 languages everywhere. The blocks therefore differ from the rows of `public.blog_translation_cta` until those rows are updated the same way.

This file holds the corrected promo text that goes at the end of every blog article, in ten languages. Whoever maintains the external system that writes the daily blog articles should paste it into that system's template.

## Why this exists

As of 2026-11-17, three facts:

1. The blog articles are written every day by an external system. It lives outside this repo and outside the owner's scheduled tasks, and it puts a promo section at the end of each article.
2. That system's template is outdated. It quotes the old baht price, and it says the lessons exist in only three languages. The app speaks ten.
3. The database now guards the price: the trigger `blog_posts_normalize_price` rewrites the old baht price on insert (details in the last section). That is only a safety net, not a fix. Whoever maintains the external system should paste the corrected promo text below into its template.

## The rules

- **Price.** US$24.99 per month in every language except two: Thai (799 baht per month) and Chinese (176 CNY per month, written as ¥176).
- **Languages.** The app speaks ten languages, always listed in this order (most used first): Thai, English, Chinese, Arabic, Japanese, Russian, Spanish, French, Hindi and Korean. Never write "Thai, English and Mandarin" or "six languages".
- **Trial.** A 7-day free Premium trial, no credit card.
- **Links.** Every article ends with three links: the landing page of the article's own language, then `https://www.tigastudio.net/`, then `https://www.tigaalpha.com`. The landing page is `https://www.tigaalpha.com/landing/` for Thai and `https://www.tigaalpha.com/landing-<lang>/` for every other language, including `landing-zh` for Chinese.
- **The CEO.** The CEO is called Aum (Teacher Aum; ครูอั้ม in Thai) and has 20 years of piano teaching.

The same rules, per language:

| Code | Language | Price to quote | Landing page |
|---|---|---|---|
| ar | Arabic | US$24.99 per month | `https://www.tigaalpha.com/landing-ar/` |
| de | German | US$24.99 per month | `https://www.tigaalpha.com/landing-de/` |
| en | English | US$24.99 per month | `https://www.tigaalpha.com/landing-en/` |
| es | Spanish | US$24.99 per month | `https://www.tigaalpha.com/landing-es/` |
| fr | French | US$24.99 per month | `https://www.tigaalpha.com/landing-fr/` |
| hi | Hindi | US$24.99 per month | `https://www.tigaalpha.com/landing-hi/` |
| ja | Japanese | US$24.99 per month | `https://www.tigaalpha.com/landing-ja/` |
| ko | Korean | US$24.99 per month | `https://www.tigaalpha.com/landing-ko/` |
| ru | Russian | US$24.99 per month | `https://www.tigaalpha.com/landing-ru/` |
| th | Thai | 799 baht per month | `https://www.tigaalpha.com/landing/` |
| zh | Chinese | ¥176 per month (176 CNY) | `https://www.tigaalpha.com/landing-zh/` |

## How to use the blocks

Each language section below holds one block: the paragraph, one blank line, then three bullet lines (download link, TIGA Studio, about the company). Paste the block for the article's language at the very end of the article, unchanged. It already carries the right price, the right language list and the right landing page for that language, so nothing has to be filled in.

The blocks for ar, en, es, fr, hi, ja, ko, ru and th are the reviewed, final text (the German block is new and is not in the table until its migration is applied). They were copied on 2026-11-17 from the table `public.blog_translation_cta` (columns `paragraph` and `bullets`) and compared with it character for character. They sit in fenced code blocks so that nothing is reflowed: copy what is inside the fence, not the fence itself. The blank line between paragraph and bullets is only a separator; it is not stored in either column. The table has no Chinese row, so the zh block is a suggestion (see its section).

## Arabic (ar)

```text
TIGA ALPHA تطبيق لتعليم البيانو بالذكاء الاصطناعي، طوّره فريق في تايلاند. يتوفر التطبيق بـ10 لغات: التايلاندية والإنجليزية والصينية والعربية واليابانية والروسية والإسبانية والفرنسية والهندية والكورية. وتمتد خبرة Aum، CEO في TIGA ALPHA، 20 عامًا في تدريس البيانو، وتشكّل هذه الخلفية التعليمية كل درس. وعندما تعزف، يستمع التطبيق إليك ويخبرك بالنوتات أو النبضات التي ينبغي أن تتدرّب عليها بعد ذلك، فتأتي الملاحظات محددة وليست عامة. يمكنك استخدامه كتطبيق دروس بيانو أونلاين لجلسات يومية قصيرة، أو اتّباعه كدورة بيانو أونلاين كاملة، أو الجمع بينه وبين دروس يقدّمها معلّم. سواء كنت تبدأ من الصفر، أو تعود بعد انقطاع طويل، أو تتعلّم الموسيقى مع أطفالك، أو تعزف للمتعة فقط، فخطوتك التالية تبقى واضحة. يحصل المستخدمون الجدد على تجربة Premium المجانية لمدة 7 أيام، ثم US$24.99 شهريًا.

- التحميل والبدء: [TIGA ALPHA](https://www.tigaalpha.com/landing-ar/)
- دروس حضورية في تايلاند: [TIGA Studio](https://www.tigastudio.net/)
- عن الشركة: [tigaalpha.com](https://www.tigaalpha.com)
```

## English (en)

```text
TIGA ALPHA is an AI piano teaching app built by a team in Thailand. The app is available in 10 languages: Thai, English, Chinese, Arabic, Japanese, Russian, Spanish, French, Hindi and Korean. Its CEO, Teacher Aum, has 20 years of experience teaching piano, and that teaching background shapes every lesson. When you play, the app listens and tells you which notes or beats to practise next, so the feedback is specific rather than generic. Use it as an online piano lessons app for short daily sessions, follow it as a complete online piano course, or combine it with lessons from a teacher. Whether you are starting from scratch, coming back after a long break, learning music alongside your children or simply playing for fun, your next step stays clear. New users get a 7-day free Premium trial, then US$24.99 per month.

- Download and start: [TIGA ALPHA](https://www.tigaalpha.com/landing-en/)
- In-person lessons in Thailand: [TIGA Studio](https://www.tigastudio.net/)
- About the company: [tigaalpha.com](https://www.tigaalpha.com)
```

## Spanish (es)

```text
TIGA ALPHA es una app de enseñanza de piano con IA creada por un equipo en Tailandia. La app está disponible en 10 idiomas: tailandés, inglés, chino, árabe, japonés, ruso, español, francés, hindi y coreano. Su CEO, Teacher Aum, tiene 20 años de experiencia enseñando piano, y esa trayectoria docente da forma a cada lección. Cuando tocas, la app te escucha y te indica qué notas o qué tiempos del compás practicar a continuación, así que los comentarios que recibes son específicos y no genéricos. Úsala como app de clases de piano en línea para sesiones diarias breves, síguela como un curso completo de piano en línea o combínala con las clases de un profesor. Ya sea que empieces desde cero, retomes el piano después de una larga pausa, aprendas música junto a tus hijos o simplemente toques por diversión, tu siguiente paso siempre está claro. Los usuarios nuevos reciben una prueba gratuita de Premium durante 7 días y, después, US$24.99 al mes.

- Descarga y empieza: [TIGA ALPHA](https://www.tigaalpha.com/landing-es/)
- Clases presenciales en Tailandia: [TIGA Studio](https://www.tigastudio.net/)
- Sobre la empresa: [tigaalpha.com](https://www.tigaalpha.com)
```

## French (fr)

The French block uses no-break spaces (U+00A0) after `20` and `7` and before each colon. Keep them as they are.

```text
TIGA ALPHA est une application d’enseignement du piano par IA, conçue par une équipe basée en Thaïlande. L’application est disponible en 10 langues : thaï, anglais, chinois, arabe, japonais, russe, espagnol, français, hindi et coréen. Teacher Aum, CEO de TIGA ALPHA, compte 20 ans d’expérience dans l’enseignement du piano, et ce bagage pédagogique façonne chaque leçon. Quand vous jouez, l’application vous écoute et vous indique quelles notes ou quels temps travailler ensuite, pour un retour précis plutôt que générique. Utilisez-la comme une application de leçons de piano en ligne pour de courtes séances quotidiennes, suivez-la comme un cours de piano en ligne complet, ou associez-la à des leçons avec un professeur. Que vous partiez de zéro, que vous repreniez après une longue pause, que vous appreniez la musique aux côtés de vos enfants ou que vous jouiez simplement pour le plaisir, votre prochaine étape reste claire. Les nouveaux utilisateurs bénéficient d’un essai Premium gratuit de 7 jours, puis US$24.99 par mois.

- Télécharger et commencer : [TIGA ALPHA](https://www.tigaalpha.com/landing-fr/)
- Cours en présentiel en Thaïlande : [TIGA Studio](https://www.tigastudio.net/)
- À propos de l’entreprise : [tigaalpha.com](https://www.tigaalpha.com)
```

## German (de)

Added 2026-11-20. German is the eleventh language of the blog (its articles are `live_only` database rows written by the translation queue, no committed files). This block is the text of the `de` row of `public.blog_translation_cta` that `supabase-blog-de-migration.sql` inserts (WRITTEN, NOT APPLIED until the owner approves it): du-form, same facts and sentence order as the Spanish block, plain ASCII spaces and straight quotes only (the translating agents must reproduce it character for character). It names 11 languages because German joins the ten; the other blocks still say 10 until the sweep of the language claims. The German label of Teacher Aum stays "Teacher Aum" with no gendered title.

```text
TIGA ALPHA ist eine KI-Klavierlern-App von einem Team in Thailand. Die App gibt es in 11 Sprachen: Thai, Englisch, Chinesisch, Arabisch, Japanisch, Russisch, Spanisch, Französisch, Hindi, Koreanisch und Deutsch. Teacher Aum, CEO von TIGA ALPHA, hat 20 Jahre Erfahrung im Klavierunterricht, und diese Lehrerfahrung prägt jede Lektion. Wenn du spielst, hört die App dir zu und sagt dir, welche Noten oder welche Zählzeiten du als Nächstes üben solltest, damit dein Feedback konkret statt allgemein ausfällt. Nutze sie als App für Online-Klavierunterricht für kurze tägliche Einheiten, folge ihr als komplettem Online-Klavierkurs oder kombiniere sie mit dem Unterricht bei einer Lehrkraft. Egal, ob du bei null anfängst, nach einer langen Pause wieder einsteigst, gemeinsam mit deinen Kindern Musik lernst oder einfach nur zum Spaß spielst: Dein nächster Schritt bleibt immer klar. Wer neu dabei ist, testet Premium 7 Tage lang kostenlos, danach kostet es US$24.99 pro Monat.

- Herunterladen und loslegen: [TIGA ALPHA](https://www.tigaalpha.com/landing-de/)
- Unterricht vor Ort in Thailand: [TIGA Studio](https://www.tigastudio.net/)
- Über das Unternehmen: [tigaalpha.com](https://www.tigaalpha.com)
```

## Hindi (hi)

```text
TIGA ALPHA एक AI पियानो सिखाने वाला ऐप है, जिसे थाईलैंड की एक टीम ने बनाया है। यह ऐप 10 भाषाओं में उपलब्ध है: थाई, अंग्रेज़ी, चीनी, अरबी, जापानी, रूसी, स्पेनिश, फ़्रेंच, हिन्दी और कोरियाई। इसके CEO, टीचर Aum, के पास पियानो सिखाने का 20 साल का अनुभव है, और सिखाने की यही पृष्ठभूमि हर पाठ को आकार देती है। आपके बजाने पर ऐप सुनता है और बताता है कि आगे कौन-से नोट या बीट का अभ्यास करना है, इसलिए फ़ीडबैक आम सलाह जैसा नहीं, बल्कि ठोस होता है। इसे रोज़ के छोटे सत्रों के लिए ऑनलाइन पियानो पाठ ऐप की तरह इस्तेमाल करें, एक संपूर्ण ऑनलाइन पियानो कोर्स की तरह इसके साथ आगे बढ़ें, या किसी शिक्षक से मिलने वाले पाठों के साथ जोड़ लें। चाहे शुरुआत ज़ीरो से हो, लंबे ब्रेक के बाद वापसी हो, अपने बच्चों के साथ संगीत सीखना हो या बस मज़े के लिए बजाना हो, आपका अगला क़दम साफ़ बना रहता है। नए उपयोगकर्ताओं को 7 दिन का मुफ़्त Premium ट्रायल मिलता है, फिर US$24.99 प्रति माह।

- डाउनलोड करें और शुरू करें: [TIGA ALPHA](https://www.tigaalpha.com/landing-hi/)
- थाईलैंड में आमने-सामने के पाठ: [TIGA Studio](https://www.tigastudio.net/)
- कंपनी के बारे में: [tigaalpha.com](https://www.tigaalpha.com)
```

## Japanese (ja)

```text
TIGA ALPHAは、タイのチームが開発したAIピアノ指導アプリです。アプリは10言語（タイ語・英語・中国語・アラビア語・日本語・ロシア語・スペイン語・フランス語・ヒンディー語・韓国語）に対応しています。TIGA ALPHAのCEOを務めるAum先生には、20年にわたるピアノ指導の経験があります。その指導経験が、すべてのレッスンの組み立てに生かされています。ピアノを弾くと、アプリが演奏を聞き取り、次にどの音やどの拍を練習するとよいかを教えてくれます。そのため、フィードバックは一般的なものではなく、具体的です。毎日の短い練習にはオンラインピアノレッスンアプリとして使えます。一通り学べるオンラインピアノコースとして進めることも、先生のレッスンと組み合わせることもできます。ゼロから始める方も、長いブランクのあとで再開する方も、お子さんと一緒に音楽を学ぶ方も、ただ楽しく弾きたい方も、次の一歩がいつもはっきり見えます。新規ユーザーにはPremiumの7日間無料トライアルがあり、その後は月額US$24.99です。

- ダウンロードして始める：[TIGA ALPHA](https://www.tigaalpha.com/landing-ja/)
- タイでの対面レッスン：[TIGA Studio](https://www.tigastudio.net/)
- 会社情報：[tigaalpha.com](https://www.tigaalpha.com)
```

## Korean (ko)

```text
TIGA ALPHA는 태국 팀이 개발한 AI 피아노 교육 앱이에요. 앱은 10개 언어(태국어, 영어, 중국어, 아랍어, 일본어, 러시아어, 스페인어, 프랑스어, 힌디어, 한국어)를 지원해요. CEO인 Aum 선생님은 20년 동안 피아노를 가르쳐 왔고, 그 경험이 모든 레슨의 바탕이 돼요. 연주하면 앱이 소리를 듣고 다음에 연습할 음이나 박자를 알려 줘요. 그래서 일반적인 조언이 아니라 구체적인 피드백을 받을 수 있어요. 매일 짧게 연습하는 온라인 피아노 레슨 앱으로 활용해도 되고, 처음부터 끝까지 따라가는 온라인 피아노 코스로 삼아도 되고, 선생님께 받는 레슨과 병행해도 좋아요. 피아노를 처음부터 시작하든, 오랫동안 쉬다가 다시 돌아오든, 아이들과 함께 음악을 배우든, 그저 재미로 치든, 다음 단계는 늘 분명해요. 신규 사용자는 Premium을 7일 동안 무료로 체험할 수 있고, 이후에는 월 US$24.99예요.

- 다운로드하고 시작하기: [TIGA ALPHA](https://www.tigaalpha.com/landing-ko/)
- 태국 대면 레슨: [TIGA Studio](https://www.tigastudio.net/)
- 회사 소개: [tigaalpha.com](https://www.tigaalpha.com)
```

## Russian (ru)

```text
TIGA ALPHA — приложение для обучения игре на пианино с помощью ИИ, созданное командой в Таиланде. Оно доступно на 10 языках: тайском, английском, китайском, арабском, японском, русском, испанском, французском, хинди и корейском. Генеральный директор TIGA ALPHA — преподаватель Aum с 20-летним опытом обучения игре на пианино. Этот педагогический опыт лежит в основе каждого урока. Когда вы играете, приложение слушает и подсказывает, над какими нотами или долями такта стоит поработать дальше, поэтому обратная связь получается конкретной, а не шаблонной. Используйте его как приложение с онлайн-уроками пианино для коротких ежедневных занятий, проходите как полноценный онлайн-курс игры на пианино или сочетайте с занятиями у преподавателя. Неважно, начинаете ли вы с нуля, возвращаетесь к игре после долгого перерыва, учитесь музыке вместе с детьми или просто играете для удовольствия, ваш следующий шаг остаётся понятным. Новые пользователи получают 7-дневный бесплатный пробный период Premium, затем — US$24.99 в месяц.

- Скачать и начать: [TIGA ALPHA](https://www.tigaalpha.com/landing-ru/)
- Очные уроки в Таиланде: [TIGA Studio](https://www.tigastudio.net/)
- О компании: [tigaalpha.com](https://www.tigaalpha.com)
```

## Thai (th)

```text
TIGA ALPHA คือแอปสอนเปียโนด้วย AI ที่พัฒนาโดยทีมงานในประเทศไทย แอปมีให้เลือกใช้ทั้ง 10 ภาษา ไทย อังกฤษ จีนกลาง อาหรับ ญี่ปุ่น รัสเซีย สเปน ฝรั่งเศส ฮินดี และเกาหลี ครูอั้ม CEO ของ TIGA ALPHA มีประสบการณ์สอนเปียโนมา 20 ปี และประสบการณ์การสอนนี้เองที่กำหนดแนวทางของทุกบทเรียน เมื่อคุณเล่น แอปจะฟังแล้วบอกว่าควรฝึกโน้ตตัวไหนหรือจังหวะไหนต่อไป คำแนะนำจึงเฉพาะเจาะจง ไม่ใช่คำแนะนำทั่ว ๆ ไป จะใช้เป็นแอปสอนเปียโนออนไลน์สำหรับฝึกรอบสั้น ๆ ทุกวัน ใช้เรียนเป็นคอร์สเรียนเปียโนออนไลน์แบบครบถ้วน หรือใช้ควบคู่กับการเรียนกับครูก็ได้ ไม่ว่าคุณจะเริ่มจากศูนย์ กลับมาเล่นอีกครั้งหลังห่างหายไปนาน เรียนดนตรีไปพร้อมกับลูก ๆ หรือแค่เล่นเพื่อความสนุก ก้าวถัดไปของคุณก็ยังคงชัดเจน ผู้ใช้ใหม่ทดลองใช้แพ็กเกจพรีเมียมฟรี 7 วัน หลังจากนั้น 799 บาทต่อเดือน

- ดาวน์โหลดและเริ่มใช้งาน: [TIGA ALPHA](https://www.tigaalpha.com/landing/)
- เรียนแบบพบหน้าในประเทศไทย: [TIGA Studio](https://www.tigastudio.net/)
- เกี่ยวกับบริษัท: [tigaalpha.com](https://www.tigaalpha.com)
```

## Chinese (zh)

> **Suggested, not reviewed by a native speaker.** The table has no zh row. This block was written from the English one: same facts, same structure, price ¥176 per month, landing page `landing-zh`. It is in Simplified Chinese. Have a native speaker read it before it goes live.

```text
TIGA ALPHA是一款由泰国团队开发的AI钢琴教学应用。应用支持 10 种语言：泰语、英语、中文、阿拉伯语、日语、俄语、西班牙语、法语、印地语和韩语。TIGA ALPHA的CEO Aum老师拥有20年钢琴教学经验，这份教学积累也体现在每一节课的设计之中。当你弹奏时，应用会聆听并告诉你接下来该练习哪些音符或节拍，因此你得到的反馈是具体的，而不是泛泛而谈。你可以把它当作在线钢琴课应用，每天进行简短练习；也可以把它当作一套完整的在线钢琴课程来学习，或与老师的课程搭配使用。无论你是从零开始、久别之后重新回到钢琴前、陪孩子一起学习音乐，还是只想弹着玩，你的下一步始终清晰明了。新用户可享7天Premium免费试用，之后每月¥176。

- 下载并开始：[TIGA ALPHA](https://www.tigaalpha.com/landing-zh/)
- 泰国线下面授课程：[TIGA Studio](https://www.tigastudio.net/)
- 关于公司：[tigaalpha.com](https://www.tigaalpha.com)
```

## How the database protects you meanwhile

Until the external template is fixed, the database keeps the old price out of new articles. The trigger `blog_posts_normalize_price` on `public.blog_posts` runs before every insert and before every update of `body` or `lang`, and passes the body through `blog_fix_price_text`. In an article in any language other than Thai and Chinese, `799 THB`, `THB 799`, `฿799`, `799 baht`, `799タイバーツ`, `799バーツ` and `799바트` are rewritten to `US$24.99`; in a Chinese article (`lang = 'zh'`, exactly) `799泰铢` and `799 THB` are rewritten to `¥176`. Thai articles are left alone. So the old template cannot bring the old price back. But the trigger rewrites only those price spellings, and only in `body`: the OTHER stale claims are not rewritten, above all the language list ("Thai, English and Mandarin", "six languages"), and in a Chinese article a price written as `THB 799`, `฿799` or `799 baht` is not caught either. Those stay wrong in every new article until the template itself is replaced with the blocks in this file.
