/* Adventure Mode cinematics (owner, 2026-10-11: "a film before every map, beautiful CG, telling the story and what the mission is,
   with music and sound effects, to make people want to play"). Drawn live on a canvas from code, so nothing is downloaded: Earth in
   2100, the factory that builds the pioneer robots, the fleet leaving, the approach to the planet, the surface (its own look per world),
   the guardian when there is one, and an objective card with the player's own robot. Subtitles in th/en/zh (there is no voice-over),
   an original score and sound effects from adventure-music.ts. Tap = next shot, Skip = straight into the map. */
import { useEffect, useRef, useState, memo } from "react";
import { CyberAvatar } from "./cyber-avatar";
import { createCineAudio, renderCinePreview, cineEnergy, CINE_ACTION, CINE_CALM, type CineShot } from "./adventure-music";
import { speakNarration, stopSpeaking } from "./speech";

const T3 = (lang: string, th: string, en: string, zh: string) => (lang === "th" ? th : lang === "zh" ? zh : en);
const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

const COMMON = {
  howto: ["ภารกิจของคุณ: เดินซ้าย-ขวา กระโดด ยิงมอนสเตอร์ เก็บคริสตัล ◆ ตอบคำถามดนตรีที่ลำแสงเพื่อรับโบนัส แล้วเดินเข้าประตูเวิร์ปท้ายด่าน — พร้อมหรือยัง?", "Your mission: move, jump, shoot the monsters, grab the ◆ crystals, answer the music question at a beacon for a bonus, then step into the warp gate at the end. Ready?", "你的任务：移动、跳跃、射击怪物、收集 ◆ 水晶，在信标处回答音乐问题获得奖励，最后走进终点的传送门。准备好了吗？"],
  earth: ["ปี 2100 มนุษยชาติรุ่งเรืองสุดขีด แต่โลกเริ่มเล็กเกินไปสำหรับความฝัน", "Year 2100. Humanity is thriving, but Earth has become too small for its dreams.", "公元2100年，人类空前繁荣，但地球已容不下我们的梦想。"],
  factory: ["เราจึงสร้างหุ่นยนต์ผู้บุกเบิก ให้ทำงานแทนมนุษย์ ก่อนที่ใครจะเหยียบดาวดวงนั้น", "So we built pioneer robots to do the work in our place, before any human sets foot there.", "于是我们制造先遣机器人，在人类踏足之前替我们完成一切。"],
  launch: ["ฝูงยานพุ่งออกจากระบบสุริยะ ขนทรัพยากรกลับโลก และปักธงอาณานิคมแห่งใหม่", "The fleet leaves the Solar System to bring resources home and plant the flags of new colonies.", "舰队驶离太阳系，把资源运回地球，为新殖民地插上旗帜。"],
};
Object.assign(COMMON as any, {
  contact: ["แต่ในอวกาศลึก เราไม่ได้อยู่ตามลำพัง — ฮาร์เวสเตอร์ อารยธรรมที่เก่าแก่และก้าวหน้ากว่าเรามหาศาล กำลังเก็บเกี่ยวดวงดาวทั้งดวงเหมือนไร่นา เทคโนโลยีของเราสู้มันไม่ได้เลย", "But out in the deep, we are not alone. The Harvesters, an ancient and vastly more advanced civilization, reap whole stars like farmland. Our technology cannot stand against theirs.", "但在深空中，我们并不孤单——收割者，一个古老而远比我们先进的文明，像耕种农田一样收割整颗恒星。我们的技术根本无法与之抗衡。"],
  mind: ["ขณะเดียวกัน ปัญญาประดิษฐ์ของเรา TIGA เติบโตเร็วเกินคาด และกินพลังงานมากจนดาวฤกษ์ดวงเดียวไม่พออีกต่อไป มนุษย์จึงต้องหาพลังงานรูปแบบใหม่ — ฟิวชัน นิวเคลียร์ และสสารมืด", "Meanwhile our AI, TIGA, is growing faster than anyone planned, and it eats so much power that a single star is no longer enough. Humanity must find new kinds of energy: fusion, nuclear and dark matter.", "与此同时，我们的人工智能 TIGA 成长得比预期更快，耗能之巨让一颗恒星也不再够用。人类必须寻找新的能源：聚变、核能与暗物质。"],
});
const THEME_TAG: Record<string, L3> = {
  harvest: ["ฮาร์เวสเตอร์ · ภัยจากต่างดาวที่เหนือกว่า", "THE HARVESTERS · A FAR SUPERIOR THREAT", "收割者 · 远超我们的威胁"],
  ai: ["TIGA · ปัญญาประดิษฐ์ที่หิวพลังงาน", "TIGA · THE ENERGY-HUNGRY AI", "TIGA · 耗能巨大的人工智能"],
  friend: ["ผู้เป็นมิตร · เรียนรู้จากเพื่อนต่างดาว", "THE KINDRED · FRIENDS WE CAN LEARN FROM", "友族 · 可以学习的朋友"],
  reactor: ["พลังงานใหม่ · ฟิวชันและนิวเคลียร์", "NEW POWER · FUSION AND FISSION", "新能源 · 聚变与裂变"],
  dark: ["พลังงานใหม่ · สสารมืด", "NEW POWER · DARK MATTER", "新能源 · 暗物质"],
};
/* the new storyline (owner, 2026-10-12): the Harvesters, the Kindred, and TIGA's hunger for energy. One extra "lore" shot per map, with its own scene. */
const LORE_THEME: Record<string, string> = { kindred: "friend", darkforge: "dark", shadow: "harvest", luma: "harvest", ferro: "ai", jovia: "reactor", kryo: "friend", pyra: "reactor", nexa: "harvest", cobalt: "ai", helios: "ai", dyson: "dark", ashfall: "harvest", voidgate: "harvest", asteroids: "friend", gasskim: "reactor", starharvest: "dark", solarcharge: "reactor", dysondock: "ai", gaspump: "reactor", warpjump: "harvest", blackhole: "dark", deathstar: "harvest", colmoon: "friend", spaceranch: "friend", ranchmars: "reactor", ranchtitan: "ai", ranchproxima: "harvest", shipbuild: "ai", dysonbuild: "reactor", gasbuild: "reactor", minebuild: "friend", colmars: "reactor", coltitan: "ai", colproxima: "harvest", arkfarm: "friend", arkherd: "ai", moonhe3: "ai", moonbase: "friend", marscolony: "harvest", mercury: "reactor", venussky: "friend", jupitergas: "reactor", saturnrings: "ai", titanassault: "harvest", titancolony: "friend", arkbuild: "dark", arkexodus: "harvest" };
const LORE: Record<string, L3> = {
  luma: ["ป่านี้ถูกสแกนแล้ว โดรนสอดแนมของฮาร์เวสเตอร์เห็นเราก่อนเราเห็นมัน — ต้องรีบตั้งฐานก่อนพวกมันกลับมา", "This jungle has already been scanned. A Harvester scout saw us before we saw it. We must build before they return.", "这片丛林已被扫描过。收割者的侦察机比我们先发现了对方，必须在它们回来之前建好基地。"],
  ferro: ["TIGA ต้องการแร่และพลังงานมากขึ้นทุกวัน แร่เหล็กที่นี่คือสมองก้อนใหม่ของมัน", "TIGA needs more ore and power every day. The iron here is the next piece of its mind.", "TIGA 一天比一天需要更多矿石与能源，这里的铁矿将成为它新的大脑。"],
  jovia: ["ดาวแก๊สยักษ์ให้ไฮโดรเจนมหาศาล เรากำลังเรียนรู้จะจุดมันเป็นพลังงานฟิวชัน ไม่ต้องพึ่งดาวฤกษ์", "A gas giant holds oceans of hydrogen. We are learning to burn it as fusion fuel, with no star needed.", "气态巨星蕴藏海量氢气，我们正在学习把它点燃成聚变能源，不再依赖恒星。"],
  kryo: ["ใต้น้ำแข็งมีเพื่อนต่างดาว — เผ่าไคนด์เรด เจริญในบางด้านเหนือเรา แต่ไม่ได้เหนือกว่าเรามากพอจะคุกคามใคร พวกเขาเต็มใจแลกความรู้", "Beneath the ice live the Kindred. They are ahead of us in some sciences, but not so far ahead that they could threaten anyone. They are willing to trade knowledge.", "冰层之下住着友族。他们在某些科学上领先于我们，但不至于威胁任何人，他们愿意交换知识。"],
  pyra: ["แกนลาวาที่นี่คือเตาปฏิกรณ์ธรรมชาติ ถ้าเข้าใจมัน เราจะสร้างโรงไฟฟ้านิวเคลียร์ที่ไม่มีวันดับ", "The core here is a natural reactor. Understand it, and we can build nuclear plants that never go out.", "这里的熔岩核心是一座天然反应堆，读懂它，我们就能建造永不熄灭的核电站。"],
  nexa: ["ซากเมืองนี้คืออารยธรรมที่ฮาร์เวสเตอร์เก็บเกี่ยวไปแล้ว — นี่คือชะตากรรมที่รอเราถ้าเราไม่เตรียมตัว", "These ruins are a civilization the Harvesters already reaped. This is what waits for us if we are not ready.", "这座废墟是被收割者收割过的文明，如果我们不做好准备，这就是我们的下场。"],
  cobalt: ["ทุกก้อนแร่ที่ส่งกลับโลกกลายเป็นชิปให้ TIGA คิดเร็วขึ้น แต่ยิ่งคิดเร็ว ยิ่งหิวพลังงาน", "Every ore we ship home becomes chips that let TIGA think faster. The faster it thinks, the hungrier it gets.", "每一块运回地球的矿石都会变成让 TIGA 思考更快的芯片，而它想得越快就越耗能。"],
  helios: ["ดาวฤกษ์หนึ่งดวงเลี้ยง TIGA ได้ไม่กี่ปี เราต้องยึดดาวดวงที่สอง ที่สาม และอีกมาก", "One star feeds TIGA for only a few years. We must take a second, a third, and many more.", "一颗恒星只够 TIGA 用几年，我们必须夺取第二颗、第三颗，还要更多。"],
  dyson: ["แผงไดสันดึงพลังงานดาวฤกษ์ แต่ยังไม่พอ นักวิทยาศาสตร์จึงเริ่มวิจัยสสารมืดเป็นเชื้อเพลิงชนิดใหม่", "Dyson panels drain a star, and it is still not enough. Our scientists have begun to study dark matter as a new fuel.", "戴森板能抽取恒星的能量，但仍然不够，科学家开始研究把暗物质当作新燃料。"],
  ashfall: ["ฐานทัพบนดาวนี้เป็นของเอเลี่ยนที่รับใช้ฮาร์เวสเตอร์ ถ้ากวาดล้างได้ เราจะได้ซื้อเวลาให้มนุษย์อีกหลายปี", "The bases here belong to aliens who serve the Harvesters. If we clear them, we buy humanity years of time.", "这颗星上的基地属于效忠收割者的外星人，清除它们，就能为人类争取数年时间。"],
  voidgate: ["ประตูมิตินี้คือทางเข้าของฮาร์เวสเตอร์ เราไม่ได้ปิดมันเพื่อชนะ แต่เพื่อให้พวกมันไม่หันมามองเรา", "This rift is a door for the Harvesters. We do not shut it to win, but so they never look our way.", "这道裂隙是收割者的入口，我们封闭它不是为了获胜，而是为了不让它们注意到我们。"],
  asteroids: ["เผ่าไคนด์เรดมาถึงทุ่งหินพร้อมยานขนส่ง พวกเขาแลกแร่กับความรู้ด้านวัสดุ เป็นเพื่อนที่เราเรียนรู้จากเขาได้", "The Kindred arrive in the belt with cargo ships. They trade materials science for ore: friends we can learn from.", "友族带着货船来到小行星带，他们用材料科学换取矿石，是我们可以学习的朋友。"],
  gasskim: ["พลังงานจากเมฆนี้ป้อนเตาฟิวชันของเรา แต่ TIGA ใช้หมดเร็วกว่าที่เราเก็บได้", "The energy in these clouds feeds our fusion plants, but TIGA burns it faster than we can gather it.", "这片云层的能量供给我们的聚变电站，但 TIGA 消耗得比我们采集的更快。"],
  arkfarm: ["ประชากรนับแสนต้องกินอาหารตลอดการเดินทางหลายร้อยวัน ทุกใบพืชบนยานมีค่า", "Hundreds of thousands must eat through a voyage of hundreds of days, and every leaf on the ship counts.", "数十万人要在数百天的航程中吃饱，船上的每一片叶子都很宝贵。"],
  arkherd: ["เนื้อสัตว์ นม และไข่ต้องมีพอตลอดการเดินทาง แต่ยานไม่มีทุ่งหญ้า สัตว์จึงต้องถูกออกแบบให้เหมาะกับยาน", "Meat, milk and eggs must last the voyage, but a ship has no pasture, so the animals are designed for the ship.", "肉、奶和蛋要够整个航程吃，但飞船上没有牧场，所以动物要为飞船而设计。"],
  moonhe3: ["ฮีเลียม-3 คือเชื้อเพลิงฟิวชันที่โลกขาดแคลน และดวงจันทร์เก็บมันไว้มานับพันล้านปี", "Helium-3 is the fusion fuel Earth lacks, and the Moon has been storing it for billions of years.", "氦-3 是地球缺少的聚变燃料，月球已经把它储存了数十亿年。"],
  moonbase: ["ถ้ามีคนอยู่ที่ดวงจันทร์ได้ ก็จะมีฐานส่งยานไปไกลกว่านั้น", "If people can live on the Moon, there is a base to launch ships further.", "如果人类能在月球生活，就有了发射飞船去更远处的基地。"],
  marscolony: ["ดาวอังคารเคยมีน้ำ และเราจะทำให้มันมีชีวิตอีกครั้ง", "Mars once held water, and we will make it live again.", "火星曾经有水，我们要让它重新焕发生机。"],
  mercury: ["ดาวพุธอยู่ใกล้ดวงอาทิตย์ที่สุด แสงที่นี่แรงกว่าโลกเก้าเท่า", "Mercury sits closest to the sun, where sunlight is nine times stronger than on Earth.", "水星离太阳最近，这里的阳光比地球强九倍。"],
  venussky: ["พื้นผิวดาวศุกร์ร้อนเกินอยู่ แต่สูงขึ้นไปในเมฆ อากาศอบอุ่นพอดี", "Venus's surface is too hot, but high in its clouds the air is just warm.", "金星地表过于炙热，但高空云层里的温度刚刚好。"],
  jupitergas: ["ดาวพฤหัสคือคลังไฮโดรเจนของระบบสุริยะ เชื้อเพลิงของยานทุกลำ", "Jupiter is the solar system's hydrogen vault, the fuel for every ship.", "木星是太阳系的氢气库，是所有飞船的燃料来源。"],
  saturnrings: ["วงแหวนของดาวเสาร์คือน้ำแข็งบริสุทธิ์นับล้านล้านก้อน คือน้ำและเชื้อเพลิงของอาณานิคม", "Saturn's rings are trillions of pieces of pure ice, which means water and fuel for the colonies.", "土星光环由数万亿块纯净冰块组成，是殖民地的水和燃料。"],
  titanassault: ["ไททัน ดวงจันทร์ดวงเดียวที่มีบรรยากาศหนา และมีสิ่งมีชีวิตแปลกๆ ยึดครองไว้ก่อนแล้ว", "Titan is the one moon with a thick atmosphere, and strange life holds it already.", "土卫六是唯一拥有浓厚大气的卫星，奇怪的生命已先一步占据了它。"],
  titancolony: ["บนไททันมีทั้งน้ำและคาร์บอน ทุกอย่างที่เมืองหนึ่งต้องการ", "Titan has water and carbon, everything a city needs.", "土卫六有水也有碳，具备一座城市所需的一切。"],
  arkbuild: ["ยานลำนี้ต้องสร้างแรงโน้มถ่วงของตัวเอง ปลูกอาหาร เลี้ยงสัตว์ และพาผู้คนนับแสนข้ามดวงดาว", "This ship must make its own gravity, grow food, keep animals and carry hundreds of thousands across the stars.", "这艘船要自己制造重力、种植食物、饲养动物，并载着数十万人跨越星际。"],
  arkexodus: ["เมื่อโลกไม่พอ มนุษยชาติก็ต้องไปหาบ้านใหม่ ไปให้พ้นสายตาของฮาร์เวสเตอร์", "When Earth is not enough, humanity must find a new home, beyond the Harvesters' sight.", "当地球不再够用，人类必须寻找新家园，躲开收割者的视线。"],
  solarcharge: ["แบตเตอรีของยานรั่วไหลตลอดเวลา ถ้าหมดกลางทางก็ไม่มีใครมารับเรา", "The ship's battery bleeds all the time. If it runs dry out here, nobody is coming for us.", "飞船电池一直在流失，如果在这里耗尽，没人会来接我们。"],
  dysondock: ["ไดสันสเฟียร์ต้องการพลังงานเติมไม่รู้จบ เราคือคนส่งของให้มัน", "The Dyson sphere never stops asking for power. We are the couriers who feed it.", "戴森球需要源源不断的能量，我们就是给它送能的信使。"],
  gaspump: ["ก๊าซจากดาวยักษ์คือเชื้อเพลิงของฟิวชัน ทุกถังที่สูบคือหนึ่งวันของ TIGA", "Gas from the giants fuels our fusion. Every tank we pump is one more day for TIGA.", "巨行星的气体是聚变燃料，每抽满一罐都是 TIGA 多一天的能量。"],
  warpjump: ["ฮาร์เวสเตอร์เห็นเราได้ทุกที่ในจักรวาลนี้ จึงต้องไปให้ไกลเกินสายตาพวกมัน", "The Harvesters see us everywhere in this universe, so we must go beyond their sight.", "收割者能在这个宇宙里看到我们，所以必须去它们看不到的地方。"],
  blackhole: ["ไม่มีใครเคยกลับมาจากหลุมดำ แต่ที่ขอบของมันมีประตูสู่จักรวาลอื่น", "No one has returned from a black hole, but at its edge lies a door to another universe.", "从来没人能从黑洞返回，但它的边缘有通往另一个宇宙的门。"],
  deathstar: ["ทุกดวงดาวที่ฮาร์เวสเตอร์เก็บเกี่ยว ถูกสถานีนี้ยิงให้ดับ ถ้ามันหันมาทางเรา โลกจะไม่เหลือ", "Every star the Harvesters reaped was shot dark by this station. If it turns on us, Earth is gone.", "收割者收割的每颗恒星，都是被这座要塞击灭的。它若转向我们，地球将不复存在。"],
  colmoon: ["เมืองแรกนอกโลกต้องอยู่รอดให้ได้ก่อน แล้วค่อยเติบโต", "The first city beyond Earth must survive before it can grow.", "地球之外的第一座城，必须先活下来，才能成长。"],
  shipbuild: ["ก่อนจะออกไปยึดดวงดาว เราต้องมียานที่พามนุษยชาติไปได้ และหุ่นยนต์ทุกตัวต้องเข้าใจดนตรีเพื่อประสานงานกัน", "Before we can reach the stars we need a ship that can carry humanity, and every robot must understand music to work in harmony.", "要去星辰大海，先要有能载着人类远行的飞船，而每个机器人都得懂音乐，才能协同工作。"],
  spaceranch: ["อาณานิคมจะอยู่ได้ก็ต่อเมื่อมีข้าวกิน และบนดาวที่ไม่มีทุ่งนา เราต้องสร้างทุ่งนาขึ้นมาเอง", "A colony only lives if it can eat, and on a world with no fields we have to build the fields ourselves.", "殖民地要活下去就得有饭吃；在没有田野的星球上，我们只好自己造田。"],
  ranchmars: ["ดาวอังคารไม่มีทุ่งนา แต่ใต้โดมกระจกเราปลูกผักได้ด้วยแสงที่อ่อนกว่าโลกครึ่งหนึ่ง", "Mars has no fields, but under a glass dome we can grow crops in half the light Earth gets.", "火星上没有田野，但在玻璃穹顶下，我们能用只有地球一半的光照种出庄稼。"],
  ranchtitan: ["ที่ไททันหนาวเกือบ −180 องศา ฟาร์มต้องอุ่นด้วยความร้อนจากเครื่องปฏิกรณ์", "Titan sits near −180 °C, so the ranch has to be warmed by reactor heat.", "土卫六气温近 −180 °C，牧场必须靠反应堆的热量保暖。"],
  ranchproxima: ["ใต้ดวงอาทิตย์สีแดงที่พร็อกซิมา b พืชบนโลกต้องปรับตัวใหม่ แต่แสงที่แรงทำให้มันโตไว", "Under Proxima's red sun Earth's crops must adapt, but the strong light makes them race.", "在比邻星的红色恒星下，地球作物要重新适应，但强光让它们疯长。"],
  dysonbuild: ["ดาวฤกษ์ปล่อยพลังงานทุกวินาทีมหาศาล ถ้าเก็บได้ทั้งหมด มนุษย์ไม่ต้องขาดพลังงานอีกเลย", "A star pours out vast energy every second. Catch all of it and humanity will never run short again.", "恒星每秒释放巨大的能量。若能全部收集，人类便永不缺能。"],
  gasbuild: ["ดาวพฤหัสเป็นคลังเชื้อเพลิงขนาดดาวเคราะห์ แค่ต้องมีฐานลอยฟ้าที่ทนพายุได้", "Jupiter is a planet-sized fuel depot, if only we can build a base that floats through its storms.", "木星是一座行星大小的燃料库，只要我们能造出在风暴中漂浮的基地。"],
  minebuild: ["แถบดาวเคราะห์น้อยมีโลหะมากกว่าที่โลกเคยขุดมาทั้งหมด แต่ไม่มีแรงโน้มถ่วงให้ยึด", "The asteroid belt holds more metal than Earth ever mined, but there is no gravity to hold on to.", "小行星带的金属比地球曾开采的总和还多，可那里没有重力可依靠。"],
  colmars: ["ดาวอังคารไม่ให้อะไรฟรี แต่ใต้ผืนทรายสีแดงมีน้ำแข็งรออยู่", "Mars gives nothing for free, but ice waits under the red sand.", "火星不会白白给予，但红色沙土之下藏着冰。"],
  coltitan: ["ไททันหนาวจนเหล็กเปราะ แต่มีเชื้อเพลิงล้นดวง ถ้ารู้วิธีใช้", "Titan is cold enough to make steel brittle, yet it brims with fuel for those who know how to use it.", "土卫六冷得能让钢铁变脆，但懂得利用的人，会发现它遍地是燃料。"],
  colproxima: ["ที่นี่คือบ้านหลังใหม่ ห่างจากโลกสี่ปีแสง ไม่มีใครมาช่วยได้แล้ว", "This is a new home four light-years from Earth. No one can come to help anymore.", "这里是距地球四光年的新家园，再没有人能来救援。"],
  starharvest: ["ดาวดวงนี้ใหญ่พอจะเลี้ยง TIGA ได้นาน แต่ที่สำคัญกว่าคือมันมีสสารมืดหนาแน่นอยู่รอบๆ ซึ่งอาจเป็นอนาคตของเรา", "This star could feed TIGA for a long time, but what matters more is the dense dark matter around it, which may be our future.", "这颗恒星足以供养 TIGA 很久，但更重要的是它周围浓密的暗物质，那可能就是我们的未来。"],
  kindred: ["ไคนด์เรดสอนว่า ความรู้ไม่ได้ลดค่าเมื่อแบ่งกัน — เราแลกแร่กับวิธีทำวัสดุที่แข็งแกร่งกว่าเดิมสิบเท่า", "The Kindred teach that knowledge is not spent by sharing. We trade ore for ways to make materials ten times stronger.", "友族教导我们，知识不会因分享而减少——我们用矿石换来强度提高十倍的材料工艺。"],
  darkforge: ["สสารมืดไม่เปล่งแสง แต่แบกมวลมหาศาล ถ้าควบคุมได้ TIGA จะมีพลังงานพอโดยไม่ต้องเลี้ยงด้วยดาวฤกษ์อีก", "Dark matter gives off no light but carries immense mass. Tame it, and TIGA will have power without feeding on more stars.", "暗物质不发光却蕴含巨大质量。驯服它，TIGA 就不必再靠吞噬恒星获得能量。"],
  shadow: ["ฮาร์เวสเตอร์ไม่เคยพูดกับใคร มันแค่สแกน แล้วเก็บเกี่ยว — ถ้าเราผ่านไปโดยไม่ถูกจับตา มนุษย์จะได้เวลาอีกหนึ่งชั่วอายุคน", "The Harvesters never speak. They scan, then they reap. If we pass unseen, humanity gains another generation.", "收割者从不开口，它们只扫描，然后收割。如果我们悄悄通过，人类便能多争取一代人的时间。"],
};
const DEPART = {   // the send-off film (owner, 2026-10-11): the countdown, the lift-off, and the Earth falling away behind the fleet
  pad: ["ศูนย์ควบคุมเงียบกริบ มนุษยชาติทั้งโลกกำลังเงยหน้ามองฟ้า… นับถอยหลัง", "Mission control falls silent. A whole planet looks up. The countdown begins.", "控制中心鸦雀无声，整个地球仰望天空……倒计时开始。"],
  liftoff: ["ไฟลุกท่วม ฟ้าสะเทือน — หุ่นยนต์ผู้บุกเบิกทะยานขึ้นแทนพวกเรา", "Fire floods the pad, the sky shakes, and the pioneers rise in our place.", "烈焰吞没发射台，天空震颤——先遣机器人代替我们升空。"],
  earthfade: ["นี่ไม่ใช่การจากลา แต่คือการเริ่มต้นของมนุษยชาติ — โลกเล็กลงทุกวินาที ดวงดาวรอเราอยู่", "This is not goodbye. It is humanity's beginning. Earth shrinks behind us; the stars are waiting.", "这不是告别，而是人类的开端。地球在身后渐渐变小，群星正在等待。"],
};
type L3 = string[];
const INTRO: Record<string, L3> = {
  luma: ["ลูมา — ดาวป่าเรืองแสง เต็มไปด้วยสิ่งมีชีวิตที่ไม่เคยมีใครพบ", "Luma: a glowing jungle world, full of life no one has met.", "卢玛——荧光丛林星球，遍布无人见过的生命。"],
  ferro: ["เฟอร์โร — ทะเลทรายเหล็ก แร่มหาศาลที่ถูกสนิมและหอแม่เหล็กยึดไว้", "Ferro: an iron desert, its ore held hostage by rust and magnet pylons.", "费罗——钢铁沙漠，矿藏被锈虫与磁力塔占据。"],
  jovia: ["โจเวีย — ดาวแก๊สยักษ์ พลังงานมหาศาลหมุนวนอยู่ใต้เมฆ", "Jovia: a gas giant, with a world's worth of energy swirling under the clouds.", "朱维亚——气态巨行星，云层下涌动着庞大的能量。"],
  kryo: ["ไครโอ — โลกน้ำแข็ง ที่ซ่อนแหล่งน้ำของอาณานิคมไว้ใต้ผลึก", "Kryo: an ice world that hides the colony's water beneath crystal.", "克里奥——冰封星球，殖民地的水源藏在水晶之下。"],
  pyra: ["ไพรา — เตาปฏิกรณ์ธรรมชาติ ลาวาเดือดและแกนที่ใกล้ระเบิด", "Pyra: a natural reactor, boiling lava and a core close to the edge.", "派拉——天然反应堆，沸腾的熔岩与濒临失控的核心。"],
  nexa: ["เน็กซา — ซากเมืองอวกาศของอารยธรรมที่เงียบหายไป", "Nexa: the wrecked city of a civilization that went silent.", "内克萨——一个沉寂文明的残骸之城。"],
  cobalt: ["แถบโคบอลต์ — ดาวเคราะห์น้อยนับพัน เต็มไปด้วยแร่หายาก", "The Cobalt Belt: thousands of asteroids heavy with rare ore.", "钴带——数千颗小行星，蕴藏稀有矿石。"],
  helios: ["เฮลิออส — ดาวฤกษ์ต่างระบบ พลังงานเหลือเฟือ ถ้ายึดมันได้", "Helios: a foreign sun, with limitless energy for whoever takes it.", "赫利俄斯——异星恒星，谁占领它谁就拥有无尽能量。"],
  starharvest: ["ดาวฤกษ์ดวงใหม่จากอีกจักรวาล — แหล่งพลังงานที่ใหญ่ที่สุดที่มนุษย์เคยเห็น", "A star from another universe: the largest well of energy humanity has ever seen.", "另一个宇宙的恒星——人类所见过的最庞大的能量之源。"],
  gasskim: ["ดาวแก๊สยักษ์ — มหาสมุทรเมฆที่เก็บพลังงานมหาศาลไว้ในชั้นลึก", "A gas giant: an ocean of cloud hiding vast energy in its depths.", "气态巨星——云海之下藏着庞大的能量。"],
  arkfarm: ["ชั้นปลูกพืชเรียงซ้อนกันสูงเป็นตึก แสง LED สีม่วงอาบทั่ว ท่อน้ำหมุนเวียนเงียบๆ", "Crop decks rise in stacks like towers, bathed in violet LED light as water circulates silently.", "作物层像高楼般层层叠起，紫色 LED 光洒满，水在管道中静静循环。"],
  arkherd: ["ในโดมสัตว์ใต้แรงโน้มถ่วงเทียม ฝูงสัตว์ตัดแต่งยีนโตเร็วและต้านโรค กินอาหารน้อยกว่าสายพันธุ์เดิม", "Under artificial gravity, gene-edited herds grow fast and resist disease on far less feed than their ancestors.", "在人造重力下，基因编辑的畜群长得快又抗病，吃得比祖先少得多。"],
  moonhe3: ["ดวงจันทร์ใกล้โลกที่สุด จึงเป็นก้าวแรกของการหาทรัพยากรนอกโลก", "The Moon is the closest world, so it is the first step in finding resources beyond Earth.", "月球离地球最近，是在地球之外寻找资源的第一步。"],
  moonbase: ["โครงสร้างฐานตั้งรออยู่ในหลุมอุกกาบาต รอโมดูลที่อยู่อาศัยและพลังงาน", "The base frames wait in a crater for habitat and power modules.", "基地骨架在环形山中等待居住舱和能源舱。"],
  marscolony: ["พายุฝุ่นแดงปกคลุมที่ตั้งโดม สิ่งมีชีวิตแปลกๆ โผล่มาจากหิน", "A red dust storm covers the dome site, and strange creatures crawl out of the rock.", "红色沙尘暴笼罩着穹顶工地，奇怪的生物从岩石中爬出。"],
  mercury: ["ด้านกลางวันของดาวพุธร้อนจนหินเรืองแสง แต่สถานีพลังงานยังรอให้ยึด", "On Mercury's day side the rocks glow, yet the power stations still wait to be taken.", "水星的白昼面热得岩石发光，但能源站仍等待被夺取。"],
  venussky: ["เมืองลอยฟ้าแขวนอยู่เหนือทะเลเมฆกรด รอยานส่งเสบียง", "Floating cities hang above the acid cloud sea, waiting for supply ships.", "浮空城市悬在酸云之海上方，等待补给飞船。"],
  jupitergas: ["พายุยักษ์ที่ใหญ่กว่าโลกหมุนวนอยู่ข้างล่าง เรืองแสงสีแดงส้ม", "A storm bigger than Earth turns below, glowing orange-red.", "一场比地球还大的风暴在下方旋转，泛着橙红色的光。"],
  saturnrings: ["วงแหวนทอดตัวกว้างเหมือนกำแพงเรืองแสงอยู่ข้างยาน", "The rings stretch like a glowing wall beside the ship.", "光环像一堵发光的墙铺展在飞船旁。"],
  titanassault: ["หมอกสีส้มปกคลุมทะเลมีเทน สิ่งมีชีวิตแปลกๆ เฝ้าชายฝั่งอยู่", "An orange haze covers the methane sea, and strange creatures guard the shore.", "橙色的雾笼罩着甲烷海，奇异的生物守着海岸。"],
  titancolony: ["พื้นที่ราบริมทะเลมีเทนพร้อมให้ตั้งโครงสร้างอาณานิคม", "Flat ground by the methane sea is ready for colony frames.", "甲烷海旁的平地已经可以搭建殖民地骨架。"],
  arkbuild: ["โครงเหล็กขนาดมหึมาตั้งตระหง่านเหนืออู่ต่อยาน รอวัสดุจากทั้งระบบสุริยะ", "A colossal frame towers over the yard, waiting for materials from the whole solar system.", "庞大的骨架耸立在船坞上，等待来自整个太阳系的材料。"],
  arkexodus: ["Ark ลอยตัวออกจากอู่ วงแหวนแรงโน้มถ่วงหมุน ชั้นเกษตรสว่างเขียว", "The Ark drifts out of the yard: the gravity ring turns and the farm decks glow green.", "方舟驶出船坞：重力环转动，农业层亮起绿光。"],
  solarcharge: ["ยานอยู่ไกลจากโลก พลังงานเหลือน้อย ต้องหาแผงโซลาร์ที่ลอยอยู่แถวนี้", "Far from Earth with the battery low: solar panels drift through this sector.", "远离地球，电量不足：这片区域漂浮着太阳能板。"],
  dysondock: ["ไดสันสเฟียร์ที่ล้อมดาวฤกษ์ดวงนี้มีท่าจอดสำหรับส่งพลังงานเข้าโครงข่าย", "The Dyson sphere around this star has docking ports that feed power into the grid.", "这颗恒星外的戴森球有对接口，可把能量送入电网。"],
  gaspump: ["เมฆก๊าซของดาวยักษ์ดวงนี้หนาแน่น มีหัวสูบที่เรามาติดตั้งไว้สามจุด", "This giant's clouds are dense, and we have set three pump nozzles in them.", "这颗巨行星的云层浓密，我们在其中布置了三个抽取口。"],
  warpjump: ["เครื่องยนต์วาร์ปพร้อมแล้ว บินผ่านประตูวาร์ปให้ครบเพื่อเปิดทางข้ามจักรวาล", "The warp drive is ready: fly the warp gates in order to open the way across.", "曲速引擎就绪：依次穿过曲速门，打开跨越之路。"],
  blackhole: ["หลุมดำดึงทุกอย่างเข้าไป ยานต้องดิ้นสู้แรงโน้มถ่วงให้ได้ก่อนประตูจะเปิด", "The black hole drags everything in. Hold out against its pull until the door opens.", "黑洞会吞噬一切，在门打开之前要抵抗它的引力。"],
  deathstar: ["สถานีรบทรงกลมลอยนิ่งเหนือดาวร้าง ปืนใหญ่ประจำสถานีกำลังชาร์จเล็งมาทางฝูงบินของเรา", "A spherical battle station hangs over a dead world, its great cannon charging toward our fleet.", "一座球形战争堡垒悬在死寂的星球上空，巨炮正对准我们的舰队充能。"],
  colmoon: ["พื้นผิวสีเทาเงียบสงัด เรามีแค่ที่พักหลังแรก แผงโซลาร์ และวัสดุติดตัวมา", "A silent grey plain. All we have is one habitat, a solar farm and what we carried.", "寂静的灰色平原上，我们只有一座居住舱、一片太阳能场和随身物资。"],
  shipbuild: ["หุ่นยนต์สี่ตัวรอบตัวยาน ทุกชิ้นส่วนต้องผ่านคำถามดนตรีก่อนเริ่มเชื่อม", "Four robots surround the hull. Every part must pass a music question before the welding starts.", "四个机器人围着舰体。每个部件都要先答对一道音乐题才能开始焊接。"],
  spaceranch: ["ใต้โดมกระจกมีทุ่งหญ้าเขียว โรงนาสีแดง กังหันลม และวัว ไก่ หมู แกะ ที่รอให้เราดูแล", "Under the glass dome wait green meadows, a red barn, a windmill, and cows, chickens, pigs and sheep that need our care.", "玻璃穹顶下有绿色草地、红色谷仓、风车，还有等着我们照顾的牛、鸡、猪和羊。"],
  ranchmars: ["ฟ้าสีส้มของดาวอังคารเหนือโดมกระจก ข้างในมีทุ่งหญ้าเขียวกับสัตว์เลี้ยงที่ถูกส่งมาจากโลก", "An orange Martian sky above the dome, and inside it green meadows and animals brought from Earth.", "火星的橙色天空笼罩着穹顶，里面是绿色草地和从地球运来的家畜。"],
  ranchtitan: ["ดาวเสาร์พร้อมวงแหวนใหญ่เต็มฟ้า ใต้โดมอุ่นมีทุ่งหญ้าและคอกสัตว์เล็ก ๆ", "Saturn and its great rings fill the sky; under the warm dome there are small pastures and pens.", "土星和巨大的光环占满天空；温暖的穹顶下有小小的牧场和畜栏。"],
  ranchproxima: ["ดวงอาทิตย์สีแดงดวงโตลอยอยู่ใกล้ขอบฟ้า ทุ่งหญ้าสีเขียวใต้โดมกลายเป็นสีอุ่นขึ้น", "A huge red sun hangs low and the dome's green pastures glow warm under it.", "巨大的红色恒星低悬天际，穹顶下的绿草地被映得暖暖的。"],
  dysonbuild: ["วงแหวนเก็บแสงค่อย ๆ ขยายรอบดาวฤกษ์ เป็นโครงสร้างที่ใหญ่ที่สุดเท่าที่มนุษย์เคยสร้าง", "A ring of collectors grows around the star, the largest structure humankind has ever built.", "集光环在恒星周围渐渐扩展，这是人类建造过的最大工程。"],
  gasbuild: ["แท่นลอยฟ้าเล็ก ๆ หย่อนลงกลางพายุสีส้ม ปากดูดค่อย ๆ เปิดออก", "A small floating platform is lowered into the orange storms and its scoop slowly opens.", "一座小小的悬浮平台降入橙色风暴，进气口缓缓张开。"],
  minebuild: ["หินก้อนใหญ่ลอยเงียบ ๆ ในความมืด สมอเหล็กยิงลงไปยึดมันไว้", "A great rock drifts silently in the dark as steel anchors fire into it and hold it fast.", "巨大的岩石在黑暗中无声漂浮，钢锚射入其中把它牢牢固定。"],
  colmars: ["ลมพัดฝุ่นแดงลอยเหนือที่ราบ นักบุกเบิกชุดแรกกางที่พักหลังแรก", "Wind lifts red dust over the plain as the first pioneers unfold their first habitat.", "风卷着红尘掠过平原，首批先驱者撑起了第一座居住舱。"],
  coltitan: ["ท้องฟ้าสีส้มขุ่นและฝนมีเทน ใต้ผิวน้ำแข็งแข็งเป็นหินคือน้ำที่เราต้องการ", "Under a murky orange sky and a rain of methane, the rock-hard ice hides the water we need.", "浑浊的橙色天空下落着甲烷雨，坚硬如岩的冰层下藏着我们需要的水。"],
  colproxima: ["ดาวแม่สีแดงใหญ่เต็มฟ้า เงาของมันทอดยาวบนพื้นดินที่ไม่เคยมีใครเหยียบ", "A huge red sun fills the sky, its light stretched over ground no one has ever walked.", "巨大的红色恒星占满天空，光芒洒在从未有人踏足的土地上。"],
  departure: ["วันออกเดินทางมาถึงแล้ว — กองเรือบุกเบิกพร้อมที่แท่นปล่อย", "Launch day. The pioneer fleet waits on the pad.", "启程之日到来，先遣舰队已在发射台待命。"],
  asteroids: ["ทุ่งดาวเคราะห์น้อย — แร่ล้ำค่าลอยอยู่เต็มท้องฟ้า แต่โจรอวกาศก็เช่นกัน", "The asteroid field: precious ore drifts everywhere, and so do pirates.", "小行星带——珍贵矿石漂浮四处，太空海盗也是。"],
  dyson: ["ไดสันฟอร์จ — ดาวฤกษ์จากจักรวาลอื่นที่เรากำลังจะหุ้มด้วยแผงเก็บพลังงานทั้งดวง", "Dyson Forge: a star from another universe, which we will wrap in a shell of energy panels.", "戴森锻炉——来自另一个宇宙的恒星，我们要用能量板把它整个包起来。"],
  ashfall: ["แอชฟอลล์ — ดาวที่เอเลี่ยนสร้างฐานทัพไว้เต็มพื้นผิว", "Ashfall: a world the aliens have covered in military bases.", "灰烬星——遍布外星军事基地的星球。"],
  voidgate: ["วอยด์เกต — ประตูมิติที่ฝูงรบของเอเลี่ยนพุ่งทะลุออกมา", "The Void Gate: a rift in space where the alien war fleet pours through.", "虚空之门——外星舰队从空间裂隙中涌出。"],
  kindred: ["ฐานไคนด์เรด — เพื่อนต่างดาวเปิดท่าเรือให้เราเข้าไปแลกเปลี่ยนความรู้", "Kindred Haven: our alien friends open their harbour so we can trade knowledge.", "友族港湾——外星朋友向我们敞开港口，交换知识。"],
  darkforge: ["โรงหลอมสสารมืด — เชื้อเพลิงที่มองไม่เห็นซึ่งอาจเลี้ยง TIGA ได้ทั้งอารยธรรม", "The Dark Forge: an unseen fuel that could feed TIGA for a whole civilization.", "暗物质锻炉——一种看不见的燃料，也许能供养 TIGA 整个文明。"],
  shadow: ["ใต้สายตาฮาร์เวสเตอร์ — เราไม่ได้มาสู้ แต่มาเพื่อไม่ให้ใครเห็น", "Under the Harvesters' eye: we did not come to fight, but to pass unseen.", "收割者的注视之下——我们不是来战斗的，而是来悄悄通过的。"],
};
const STORY: Record<string, L3> = {
  luma: ["ก่อนมนุษย์จะย้ายเข้า ต้องเคลียร์สัตว์ประหลาดเรืองแสงออกจากป่านี้ให้หมด", "Before people can settle, the glowing creatures of this jungle must be cleared.", "在人类入住之前，必须清除这片丛林里的发光怪物。"],
  ferro: ["รถขุดแร่ติดอยู่ที่ขอบทะเลทราย ต้องเปิดทางให้พวกเขา", "The mining rigs are stuck at the desert's edge. Someone has to open the road.", "采矿车队被困在沙漠边缘，必须有人打通道路。"],
  jovia: ["เครื่องเก็บพลังงานต้องลอยเหนือเมฆ และมีสิ่งมีชีวิตพุ่งเข้าใส่มันเป็นคลื่น", "The harvester must hover over the clouds, and the creatures come at it in waves.", "采集器要悬浮在云海之上，而怪物会成波涌来。"],
  kryo: ["ผลึกน้ำแข็งมีชีวิต และผู้พิทักษ์ของมันไม่ยอมให้ใครแตะน้ำ", "The crystals are alive, and their warden will not let anyone near the water.", "水晶是活的，它们的守卫不许任何人接近水源。"],
  pyra: ["บ่อลาวาขวางทาง และแกนปฏิกรณ์ต้องถูกปิดก่อนมันจะระเบิดทั้งดาว", "Lava pools bar the way, and the core must be shut down before it takes the planet with it.", "熔岩池挡住去路，必须在核心炸毁星球之前将其关闭。"],
  nexa: ["แผ่นพื้นไฟฟ้ายังทำงาน และผู้ควบคุมคนสุดท้ายยังตื่นอยู่", "The floor plates still carry current, and the last overseer is still awake.", "地板电击板仍在通电，最后的监管者还醒着。"],
  cobalt: ["ต้องขุดแร่ให้พอ แล้วส่งแคปซูลกลับโลก เพื่อให้อาณานิคมเติบโต", "Dig enough ore and launch the capsule home, so the colony can grow.", "采足矿石，把货舱发射回地球，殖民地才能壮大。"],
  helios: ["สถานีเก็บพลังงานสามจุดเรียงรายอยู่ใต้ดวงอาทิตย์ ศัตรูจะไม่ปล่อยให้ใครยึดไป", "Three collector stations stand under this sun, and the enemy will not give them up.", "三座能量采集站矗立在恒星之下，敌人不会拱手相让。"],
  starharvest: ["เรือบุกเบิกต้องเข้าจอดที่สถานีเก็บพลังงานทีละแห่ง ท่ามกลางเปลวสุริยะและฝูงเอเลี่ยนที่หวงดาว", "The pioneer ships must dock at each collector station in turn, under solar flares and alien raiders guarding their star.", "先遣飞船必须依次停靠每座采集站，头顶是耀斑，周围是守卫恒星的外星袭击者。"],
  gasskim: ["บินเฉียดชั้นเมฆ ให้ถังพลังงานเต็ม ท่ามกลางพายุฟ้าผ่าที่ไม่เคยหยุด", "Skim the cloud tops until the tank is full, under storms that never rest.", "掠过云顶，在永不停歇的风暴下装满能量罐。"],
  arkfarm: ["เลือกพืชลงทุกแปลง ดูแลน้ำ แสง สารอาหาร แล้วเก็บเกี่ยวให้ทันเวลา", "Plant every bed, keep water, light and nutrients up, and harvest in time.", "每个种植位都种上作物，保持水、光、营养充足，并及时收获。"],
  arkherd: ["เลือกสัตว์ลงทุกคอก ดูแลอาหาร น้ำ และวัคซีน รักษาโรคระบาดให้ทัน", "Fill every pen, keep feed, water and vaccines up, and stop outbreaks fast.", "每个圈舍都养上动物，保持饲料、水和疫苗充足，迅速控制疫情。"],
  moonhe3: ["ขุดเหมืองบนผิวดวงจันทร์ แรงโน้มถ่วงต่ำ ฝุ่นละเอียด และมีเงาดำยาว", "Mine the lunar surface: low gravity, fine dust and long black shadows.", "开采月球表面：低重力、细密的尘埃和漫长的黑色阴影。"],
  moonbase: ["ขุดวัสดุ ประกอบโมดูลที่อยู่อาศัย และต่อไฟเลี้ยงฐาน", "Dig materials, assemble the habitat modules and wire up the base's power.", "挖掘材料，组装居住舱并接通基地电力。"],
  marscolony: ["ยืนหยัดปกป้องโดมจนระบบบรรยากาศเดินเครื่องครบ", "Hold the line until the atmosphere plant is fully running.", "坚守阵地，直到大气工厂全面运转。"],
  mercury: ["ยึดสถานีเก็บพลังงานทีละจุดบนพื้นผิวที่ร้อนจัด", "Take each collector station, one by one, on the scorching ground.", "在灼热的地面上逐个夺取采集站。"],
  venussky: ["บินเข้าวงแหวนของแท่นลอยฟ้าทีละแห่ง ขณะพายุเมฆพัดผ่าน", "Glide into each platform ring while cloud gusts sweep by.", "依次飞入各个浮空平台环，同时云中的狂风扫过。"],
  jupitergas: ["บินเฉียดชั้นบรรยากาศบน ดูดแก๊สเข้าถังท่ามกลางสายฟ้า", "Skim the upper atmosphere and pull gas into the tank amid the lightning.", "掠过高层大气，在闪电中把气体抽进罐里。"],
  saturnrings: ["ยิงก้อนน้ำแข็งให้แตก แล้วเก็บเศษที่ลอยออกมา", "Shoot the ice apart and gather the pieces that drift out.", "打碎冰块，收集漂出的碎片。"],
  titanassault: ["ฝ่าฝูงสิ่งมีชีวิตและเอาชนะผู้พิทักษ์ไททัน", "Fight through the swarm and defeat the guardian of Titan.", "杀出生物群，击败土卫六的守卫。"],
  titancolony: ["ขุดวัสดุ ประกอบโมดูล และเปิดระบบความอบอุ่นของเมือง", "Dig materials, assemble the modules and switch on the city's heating.", "挖掘材料，组装舱体，启动城市供暖。"],
  arkbuild: ["ขุดวัสดุ แล้วประกอบ Ark ทีละส่วนจนครบ", "Dig materials and build the Ark section by section.", "挖掘材料，逐段建造方舟。"],
  arkexodus: ["พาผู้คนนับแสนผ่านประตูวาร์ป ไปตั้งถิ่นฐานที่ดาวดวงใหม่", "Carry hundreds of thousands through the warp gates to settle a new star.", "载着数十万人穿过曲速门，前往新恒星定居。"],
  solarcharge: ["เก็บแผงโซลาร์ให้ครบ ก่อนแบตเตอรีจะหมดและเครื่องยนต์ดับ", "Gather the solar panels before the battery drains and the engines die.", "在电量耗尽、引擎熄火之前收集足够的太阳能板。"],
  dysondock: ["ลอยเข้าวงแหวนท่าจอดทีละจุด ส่งพลังงานเข้าไดสันสเฟียร์ ระวังแสงแฟลร์ที่ผ่านมา", "Glide into each docking ring and feed the Dyson sphere, and watch for flares sweeping past.", "依次飞入对接环向戴森球送能，当心扫过的耀斑。"],
  gaspump: ["เข้าไปในวงแหวนหัวสูบทีละจุดจนถังเต็ม ใต้พายุที่ไม่เคยหยุด", "Hold in each pump ring until the tank fills, under storms that never rest.", "在每个抽取环内停留直到罐满，头顶是永不停歇的风暴。"],
  warpjump: ["บินทะลุประตูวาร์ปทั้งสามบาน ถ้าพลาดประตูจะเปิดใหม่ แล้วพุ่งเข้าพอร์ทัลสุดท้าย", "Fly through all three warp gates (a missed gate comes round again), then dive into the final portal.", "穿过三道曲速门（错过会再次出现），然后冲入最后的传送门。"],
  blackhole: ["ต้านแรงดึงให้นานพอ เก็บคริสตัลที่ขอบ เมื่อประตูสว่างให้พุ่งเข้าไปตรงกลาง", "Resist the pull, gather crystals at the rim, and when the door lights up, dive into the centre.", "抵抗引力，在边缘收集水晶，门亮起时冲向中心。"],
  deathstar: ["ฝ่าฝูงยานคุ้มกัน ชาร์จเลเซอร์หลักให้เต็ม แล้วยิงทะลวงใจกลางสถานีให้ระเบิดทั้งดวง", "Break through the escorts, charge the main laser and fire into the station's heart to blow it apart.", "突破护卫舰队，为主激光充满能量，射入要塞核心将其整个炸毁。"],
  colmoon: ["สร้างที่พัก ไฟ น้ำ ออกซิเจน และอาหารให้สมดุลจนมีประชากรครบเป้า", "Balance homes, power, water, oxygen and food until the colony reaches its target.", "平衡住房、电、水、氧气和食物，让殖民地人口达到目标。"],
  shipbuild: ["ตอบคำถามดนตรีให้ถูกเพื่อให้หุ่นยนต์ประกอบยานครบทุกชิ้น", "Answer the music questions so the robots can finish every part of the ship.", "答对音乐问题，让机器人完成飞船的每个部件。"],
  spaceranch: ["ปลูกและเก็บเกี่ยว เลี้ยงสัตว์ แล้วส่งอาหารขึ้นจรวดให้ครบโควตาของอาณานิคม", "Grow, harvest, raise the animals and rocket the colony its full food quota.", "种植收获、饲养动物，把殖民地的全部粮食定额用火箭送上去。"],
  ranchmars: ["ส่งอาหารให้ครบ 300 หน่วยเพื่อเลี้ยงอาณานิคมบนดาวอังคาร", "Deliver 300 units of food to feed the Martian colony.", "运送 300 份粮食，养活火星殖民地。"],
  ranchtitan: ["ส่งอาหารให้ครบ 340 หน่วย พืชโตช้า ต้องวางแผนให้ดี", "Deliver 340 units of food; crops are slow, so plan well.", "运送 340 份粮食；作物生长缓慢，要好好规划。"],
  ranchproxima: ["ส่งอาหารให้ครบ 400 หน่วยให้ผู้อพยพกลุ่มแรกของพร็อกซิมา b", "Deliver 400 units of food to the first settlers of Proxima b.", "运送 400 份粮食给比邻星 b 的第一批移民。"],
  dysonbuild: ["ประกอบแผงรวมแสงให้ครบวง แล้วต่อสถานีส่งลำแสงกลับโลก", "Complete the ring of collectors, then link the beam relay to Earth.", "装好整圈集光板，再接上返回地球的光束中继站。"],
  gasbuild: ["สร้างฐานลอยฟ้าให้ครบ ตั้งแต่แท่นยึดจนถึงแท่นยิงกลับโลก", "Build the floating base from its anchor to its launcher home.", "建好整座悬浮基地，从锚定平台到返航发射台。"],
  minebuild: ["ติดตั้งแท่นเจาะ เตาถลุง และเครื่องยิงแร่ให้ครบ", "Fit the rig, the smelter and the mass driver.", "装好钻机、冶炼炉和质量加速器。"],
  colmars: ["ขุดน้ำแข็ง วางแผงโซลาร์ให้พอ และเตรียมรับพายุฝุ่น", "Mine the ice, lay enough solar and prepare for the dust storms.", "开采冰层，铺足太阳能，并为沙尘暴做好准备。"],
  coltitan: ["วิจัยสร้างเครื่องปฏิกรณ์ฟิวชัน เพราะแสงอาทิตย์แทบไม่มี", "Research fusion reactors, because there is almost no sunlight.", "研发聚变反应堆，因为这里几乎没有阳光。"],
  colproxima: ["ใช้แร่ล้ำค่าสร้างเมืองให้ใหญ่ และรับมือแฟลร์ของดาวแม่", "Use the rich ore to build big and ride out the flares of the red sun.", "用丰富的矿藏建设大城，并扛过红矮星的耀发。"],
  departure: ["ผ่านเศษขยะอวกาศและก้อนหินที่ลอยอยู่เหนือโลก ไปให้ถึงวงโคจร", "Fly through the debris and loose rock above the Earth to reach orbit.", "穿过地球上空的碎片与浮石，抵达轨道。"],
  asteroids: ["ยิงหินให้แตก ดูดแร่ใส่ท้องยาน แล้วส่งกลับโลกให้ครบ", "Blast the rocks, scoop the ore into the hold and send it home.", "击碎岩石，把矿石吸进货舱，运回地球。"],
  dyson: ["หุ่นยนต์ต้องขุดแร่ ประกอบแผงไดสันทีละแผง และสูบพลังงานดาวฤกษ์ส่งกลับโลก — ท่ามกลางเปลวสุริยะและฝูงเอเลี่ยน", "Robots mine the ore, bolt the Dyson panels on one by one, and beam the star's power home, under solar flares and alien raiders.", "机器人开采矿石，逐块装上戴森板，把恒星的能量传回家园——头顶是耀斑与外星袭击者。"],
  ashfall: ["เราจะทิ้งระเบิดนิวเคลียร์จากวงโคจรก่อน แล้วค่อยลงไปกวาดล้างส่วนที่เหลือ", "First we drop nuclear warheads from orbit. Then we land and clear what is left.", "先从轨道投下核弹，再降落扫荡残余的敌人。"],
  voidgate: ["ถึงเวลาปล่อยหุ่นยนต์ขึ้นนั่งยานรบ — ฝูงโดรนและเรือรบกำลังพุ่งเข้าหาเรา", "The robot takes the helm of a starfighter. Drones and warships are already closing in.", "机器人登上战机驾驶舱，无人机与战舰已蜂拥而至。"],
  kindred: ["ขุดแร่ที่ไคนด์เรดต้องการ แล้วส่งขึ้นยานแลกกับความรู้ด้านวัสดุและพลังงาน พร้อมระวังสัตว์ป่าของดาวนี้", "Dig the ore the Kindred need and send it up in trade for their knowledge of materials and energy, and watch for the wildlife.", "采集友族需要的矿石运上飞船，换取他们的材料与能源知识，同时小心当地野兽。"],
  darkforge: ["นักวิทยาศาสตร์ไคนด์เรดสอนเราสร้างภาชนะกักสสารมืด — ขุด ประกอบ และส่งพลังงานนี้กลับโลก", "Kindred scientists have taught us to build dark-matter vessels. Dig, assemble and send this power home.", "友族科学家教会了我们建造暗物质容器——挖掘、组装，并把这股能量送回地球。"],
  shadow: ["สัญญาณสแกนของฮาร์เวสเตอร์กวาดผ่านพื้นที่นี้ ห้ามยิง หลบทุกลำแสงจนกว่าจะผ่านไป", "Harvester scan beams sweep this sector. Do not fire. Dodge every beam until you are through.", "收割者的扫描光束扫过这片区域。禁止开火，躲开每一道光束直到通过。"],
};
const GOAL: Record<string, L3[]> = {
  luma: [["เคลียร์สัตว์ประหลาดระหว่างทาง", "Clear the creatures on the way", "清除沿途怪物"], ["ตอบคำถามที่ beacon เพื่อรับ EXP", "Answer the beacons for EXP", "回答信标问题获得经验"], ["ล้มผู้พิทักษ์ลูมาที่ท้ายแมป", "Defeat the Luma Warden at the end", "击败终点的卢玛守卫"]],
  ferro: [["ฝ่าสนิมและหอแม่เหล็ก", "Fight through rust and pylons", "突破锈虫与磁力塔"], ["เก็บคริสตัลเพื่ออัปเกรด", "Collect crystals to upgrade", "收集晶体用于升级"], ["ล้มผู้พิทักษ์เหล็ก", "Defeat the Iron Warden", "击败钢铁守卫"]],
  jovia: [["ปกป้องเครื่องเก็บพลังงานให้ครบ 90 วินาที", "Hold out for 90 seconds", "坚守 90 秒"], ["สู้กับคลื่นศัตรูที่ถาโถม", "Beat back each wave", "击退每一波敌人"], ["ถ้าล้ม เวลานับใหม่", "If you fall, the clock restarts", "倒下则重新计时"]],
  kryo: [["ผ่านมอนสเตอร์น้ำแข็ง", "Pass the ice creatures", "穿过冰霜怪物"], ["ระวังเกล็ดผลึก", "Watch the crystal shards", "小心晶体碎片"], ["ล้มผู้พิทักษ์น้ำแข็ง", "Defeat the Frost Warden", "击败冰霜守卫"]],
  pyra: [["กระโดดข้ามบ่อลาวา", "Jump the lava pools", "跳过熔岩池"], ["สู้ผ่านมอนสเตอร์เพลิง", "Fight the fire creatures", "击败烈焰怪物"], ["ปิดแกนด้วยการล้มผู้พิทักษ์", "Shut the core down: defeat its warden", "击败守卫，关闭核心"]],
  nexa: [["กระโดดข้ามแผ่นไฟฟ้าตอนที่ติด", "Jump the shock plates while live", "电击板通电时跳过"], ["จัดการโดรนและโกเลมเศษเหล็ก", "Take down drones and golems", "解决无人机与废铁魔像"], ["ล้มผู้ควบคุม — มันจะโกรธเมื่อเลือดเหลือครึ่ง", "Defeat the overseer: it enrages at half health", "击败监管者——半血时它会狂暴"]],
  cobalt: [["ทุบก้อนแร่ด้วยหมัดหรือเตะ", "Break ore with punches or kicks", "用拳脚击碎矿石"], ["เก็บให้ได้ 10 ก้อนขึ้นไป", "Gather at least 10 ore", "至少采集 10 块矿"], ["ส่งที่แท่นขวาสุดเพื่อยิงกลับโลก", "Launch it from the far-right pad", "在最右平台发射回地球"]],
  helios: [["ยืนยึดสถานีทีละจุด จุดละ 10 วินาที", "Hold each station for 10 seconds", "逐一坚守采集站 10 秒"], ["ป้องกันคลื่นศัตรูขณะยึด", "Beat back the waves meanwhile", "占领期间击退敌军"], ["ยึดครบ 3 จุดเพื่อเป็นเจ้าของดวงอาทิตย์", "Take all three to own the sun", "占领全部三座，拥有恒星"]],
  starharvest: [["บินเข้าวงแหวนสถานีและอยู่ให้ครบ 7 วินาที", "Fly into the station ring and hold for 7 s", "飞入采集站圆环并停留 7 秒"], ["หลบเปลวสุริยะที่กวาดมา", "Dodge the sweeping solar flares", "躲开横扫的耀斑"], ["ยึดให้ครบ 3 สถานี", "Seize all 3 stations", "占领全部 3 座采集站"]],
  gasskim: [["อยู่ในชั้นพลังงานเรืองแสง", "Stay inside the glowing energy layer", "留在发光的能量层内"], ["หลบสายฟ้าที่ฟาดลงมา", "Dodge the lightning strikes", "躲开落下的闪电"], ["ถังเต็ม 100% เพื่อส่งกลับโลก", "Fill the tank to 100% to send it home", "装满 100% 后送回地球"]],
  arkfarm: [["ปลูกพืชให้เต็มทุกแปลง", "Plant every bed", "把每个种植位种满"], ["รักษาน้ำ แสง และสารอาหารไม่ให้หมด", "Keep water, light and nutrients up", "别让水、光、营养耗尽"], ["เก็บเกี่ยวให้ครบตามเป้าหมายก่อนหมดเวลา", "Hit the harvest target before time runs out", "在时间耗尽前达到收获目标"]],
  arkherd: [["เลี้ยงสัตว์ให้เต็มทุกคอก", "Fill every pen", "把每个圈舍养满"], ["ดูแลอาหาร น้ำ และวัคซีน", "Keep feed, water and vaccines up", "保持饲料、水和疫苗"], ["ได้โปรตีนครบตามเป้าก่อนหมดเวลา", "Hit the protein target in time", "在时间内达到蛋白质目标"]],
  moonhe3: [["ขุดหินฝุ่นจันทร์ให้ได้ฮีเลียม-3", "Break the regolith for Helium-3", "敲开月壤获取氦-3"], ["เก็บใส่แคปซูลให้เกินครึ่ง", "Fill the capsule past half", "把货舱装过半"], ["ส่งขึ้นยิงกลับโลก", "Launch it back to Earth", "发射回地球"]],
  moonbase: [["ขุดวัสดุให้เพียงพอ", "Dig enough materials", "挖足材料"], ["ประกอบโมดูลให้ครบทุกโครง", "Assemble every module frame", "装好每一个舱体框架"], ["ส่งสัญญาณถึงโลกที่ปลายทาง", "Signal Earth from the far relay", "在远端中继向地球发信号"]],
  marscolony: [["ปกป้องโดมอาณานิคม", "Defend the colony dome", "保卫殖民穹顶"], ["เก็บพลังงานให้เต็มหลอด", "Fill the energy bar", "把能量条充满"], ["อยู่รอดครบ 90 วินาที", "Survive the full 90 seconds", "坚持满 90 秒"]],
  mercury: [["ยึดสถานีเก็บพลังงาน 3 จุด", "Take 3 collector stations", "夺取 3 个采集站"], ["ต้านคลื่นสัตว์ประหลาด", "Hold off the waves", "抵御怪物浪潮"], ["ส่งพลังงานกลับโลก", "Beam the power home", "把能量传回地球"]],
  venussky: [["แวะแท่นลอยฟ้าให้ครบ 3 แห่ง", "Dock at all 3 platforms", "停靠全部 3 座平台"], ["หลบแนวลมพายุ", "Avoid the storm bands", "避开风暴带"], ["เมืองลอยฟ้ามีเสบียงพอ", "Supply the cloud city", "为云中城市补给"]],
  jupitergas: [["อยู่ในชั้นแก๊สเรืองแสง", "Stay in the glowing gas layer", "留在发光的气体层"], ["หลบสายฟ้าฟาด", "Dodge the lightning", "躲开闪电"], ["ถังเต็ม 100%", "Fill the tank to 100%", "装满 100% 的罐"]],
  saturnrings: [["ยิงก้อนน้ำแข็งให้แตก", "Shoot the ice chunks apart", "打碎冰块"], ["เก็บชิ้นน้ำแข็ง 16 ชิ้น", "Collect 16 pieces", "收集 16 块"], ["หลบก้อนใหญ่ที่พุ่งเข้ามา", "Dodge the big ones", "躲开冲来的大冰块"]],
  titanassault: [["ฝ่าฝูงสิ่งมีชีวิตบนชายฝั่ง", "Fight through the shore swarm", "杀出海岸的生物群"], ["เอาชนะผู้พิทักษ์ไททัน", "Defeat Titan's guardian", "击败土卫六守卫"], ["เปิดทางให้อาณานิคม", "Open the way for the colony", "为殖民地开路"]],
  titancolony: [["ขุดน้ำแข็งและคาร์บอน", "Dig ice and carbon", "挖冰和碳"], ["ประกอบโมดูลอาณานิคมให้ครบ", "Assemble every colony module", "组装全部殖民舱"], ["เปิดระบบความอบอุ่น", "Switch on the heating", "启动供暖"]],
  arkbuild: [["ขุดวัสดุให้เพียงพอ", "Dig enough materials", "挖足材料"], ["ประกอบ 4 ส่วนของ Ark", "Assemble the Ark's 4 sections", "组装方舟的 4 个部分"], ["ปล่อยสัญญาณเครื่องกำเนิดแรงโน้มถ่วง", "Fire up the gravity generator", "启动重力发生器"]],
  arkexodus: [["บังคับ Ark ผ่านประตูวาร์ป 3 บาน", "Steer the Ark through 3 gates", "驾驶方舟穿过 3 道曲速门"], ["หลบเศษซากอวกาศ", "Dodge the debris", "躲开太空碎片"], ["เข้าพอร์ทัลสู่ดาวดวงใหม่", "Enter the portal to the new star", "进入通往新恒星的传送门"]],
  solarcharge: [["เก็บแผงโซลาร์ให้ครบ 8 แผง", "Collect 8 solar panels", "收集 8 块太阳能板"], ["อย่าให้แบตเตอรีหมด", "Never let the battery run dry", "别让电池耗尽"], ["หลบอุกกาบาตและยานเอเลี่ยน", "Dodge rocks and alien ships", "躲开陨石和外星飞船"]],
  dysondock: [["ลอยเข้าวงแหวนท่าจอดให้ครบ 3 จุด", "Dock at all 3 rings", "在 3 个对接环完成对接"], ["หลบแสงแฟลร์ที่กวาดผ่าน", "Avoid the sweeping flares", "避开扫过的耀斑"], ["ส่งพลังงานเข้าไดสันสเฟียร์", "Feed the Dyson sphere", "向戴森球输送能量"]],
  gaspump: [["เข้าวงแหวนหัวสูบให้ครบ 3 จุด", "Fill at all 3 pump rings", "在 3 个抽取环完成抽取"], ["หลบพายุและฟ้าผ่า", "Avoid the storm bands", "避开风暴带"], ["เก็บถังก๊าซส่งกลับโลก", "Send the gas home", "把气体送回地球"]],
  warpjump: [["บินผ่านประตูวาร์ปทั้ง 3 บาน", "Fly through all 3 warp gates", "穿过全部 3 道曲速门"], ["หลบเศษซากในอวกาศวาร์ป", "Dodge the warp debris", "躲开曲速碎片"], ["พุ่งเข้าพอร์ทัลไปอีกกาแล็กซี", "Dive into the portal to another galaxy", "冲入传送门前往另一个星系"]],
  blackhole: [["ต้านแรงดึงของหลุมดำ", "Resist the black hole's pull", "抵抗黑洞的引力"], ["อย่าเข้าใกล้ขอบก่อนประตูเปิด", "Stay off the horizon until the door opens", "门开启前别靠近视界"], ["พุ่งเข้าตรงกลางเมื่อประตูสว่าง", "Dive into the centre when it lights up", "门亮起时冲向中心"]],
  deathstar: [["ชาร์จเลเซอร์หลักให้เต็ม", "Charge the main laser", "为主激光充能"], ["หลบลำแสงหลักของสถานี", "Dodge the station's main beam", "躲开要塞的主炮光束"], ["ทำลายสถานีทั้งดวง", "Destroy the whole station", "摧毁整座要塞"]],
  colmoon: [["ให้ประชากรถึง 40 คน", "Reach a population of 40", "人口达到 40"], ["ไฟ น้ำ อากาศ อาหารต้องไม่ขาด", "Never run out of power, water, air or food", "电、水、空气、食物都不能断"], ["รอดผ่านกลางคืนยาว", "Survive the long night", "撑过漫长的月夜"]],
  shipbuild: [["ประกอบยานให้ครบ 8 ชิ้น", "Assemble all 8 parts", "组装全部 8 个部件"], ["ตอบคำถามดนตรีให้ถูก", "Answer the music questions", "答对音乐问题"], ["เรียนรู้จากข้อที่พลาด", "Learn from every miss", "从答错的题中学习"]],
  spaceranch: [["ส่งอาหารให้ครบ 260 หน่วย", "Deliver 260 units of food", "运送 260 份粮食"], ["เลี้ยงสัตว์ให้ครบทั้งสี่ชนิด", "Raise all four kinds of animal", "养好全部四种动物"], ["ปลูกพืชหลายชนิดให้สลับกัน", "Mix your crops", "混合种植多种作物"]],
  ranchmars: [["ส่งอาหารให้ครบ 300 หน่วย", "Deliver 300 units of food", "运送 300 份粮食"], ["เลี้ยงสัตว์ให้ครบทั้งสี่ชนิด", "Raise all four kinds of animal", "养好全部四种动物"], ["ใช้ประโยชน์จากการรดน้ำเพื่อเร่งพืช", "Water your crops to speed them up", "给作物浇水以加速生长"]],
  ranchtitan: [["ส่งอาหารให้ครบ 340 หน่วย", "Deliver 340 units of food", "运送 340 份粮食"], ["เลือกปลูกพืชที่โตไว", "Choose the fast crops", "选择生长快的作物"], ["เลี้ยงสัตว์ให้ต่อเนื่อง", "Keep the animals working", "让动物持续产出"]],
  ranchproxima: [["ส่งอาหารให้ครบ 400 หน่วย", "Deliver 400 units of food", "运送 400 份粮食"], ["ปลูกพืชให้เต็มทุกแปลง", "Keep every plot planted", "让每块地都种满"], ["ส่งอาหารเป็นรอบ ๆ", "Ship the food in rounds", "分批运出粮食"]],
  dysonbuild: [["ประกอบแผงรวมแสงให้ครบ 10 ชิ้น", "Build all 10 pieces of the ring", "建成全部 10 个环段"], ["ตอบคำถามดนตรีให้ถูก", "Answer the music questions", "答对音乐问题"], ["ส่งพลังงานกลับโลก", "Send the energy to Earth", "把能量送回地球"]],
  gasbuild: [["สร้างฐานให้ครบ 8 ชิ้น", "Build all 8 parts", "建成全部 8 个部件"], ["ตอบคำถามดนตรีให้ถูก", "Answer the music questions", "答对音乐问题"], ["ส่งก๊าซกลับโลก", "Ship the gas home", "把气体运回地球"]],
  minebuild: [["สร้างฐานให้ครบ 8 ชิ้น", "Build all 8 parts", "建成全部 8 个部件"], ["ตอบคำถามดนตรีให้ถูก", "Answer the music questions", "答对音乐问题"], ["ส่งแร่กลับโลก", "Send the ore home", "把矿石运回地球"]],
  colmars: [["ให้ประชากรถึง 60 คน", "Reach a population of 60", "人口达到 60"], ["ขุดน้ำแข็งให้พอใช้", "Mine enough ice", "开采足够的冰"], ["รอดผ่านพายุฝุ่น", "Survive the dust storms", "撑过沙尘暴"]],
  coltitan: [["ให้ประชากรถึง 80 คน", "Reach a population of 80", "人口达到 80"], ["วิจัยและสร้างเครื่องปฏิกรณ์ฟิวชัน", "Research and build fusion reactors", "研发并建造聚变反应堆"], ["ผ่านความหนาวจัดไปให้ได้", "Endure the deep freeze", "熬过严寒"]],
  colproxima: [["ให้ประชากรถึง 110 คน", "Reach a population of 110", "人口达到 110"], ["ใช้แร่สร้างเมืองให้ใหญ่", "Turn the ore into a big city", "把矿藏变成一座大城"], ["รับมือแฟลร์ของดาวแม่", "Ride out the stellar flares", "扛过恒星耀发"]],
  departure: [["ยิงหรือหลบก้อนหินและเศษขยะ", "Shoot or dodge the rocks and debris", "击碎或躲开岩石与碎片"], ["รักษาตัวยานไว้จนถึงวงโคจร", "Keep the ship intact all the way to orbit", "保持飞船完好直至入轨"], ["เก็บคริสตัลที่ลอยมา", "Pick up the crystals that drift by", "收集漂浮的水晶"]],
  asteroids: [["ยิงหินให้แตกเป็นแร่", "Blast rocks into ore", "把岩石击碎成矿石"], ["เก็บแร่ให้ครบ 16 ก้อน", "Collect 16 ore", "收集 16 块矿石"], ["ระวังโจรอวกาศ", "Beware of space pirates", "小心太空海盗"]],
  dyson: [["ทุบหินหาแร่ด้วยปุ่ม ⛏", "Break rocks for ore with the ⛏ button", "用 ⛏ 按钮敲碎岩石获取矿石"], ["ประกอบแผงไดสัน 4 แผงที่โครงเหล็ก", "Bolt 4 Dyson panels onto the frames", "在框架上装配 4 块戴森板"], ["ส่งพลังงานกลับโลกที่เสาส่งขวาสุด", "Beam the energy to Earth from the far-right relay", "在最右中继塔把能量传回地球"]],
  ashfall: [["ปล่อยหัวรบ 3 ลูกให้โดนฐานมากที่สุด", "Drop 3 warheads on as many bases as you can", "用 3 枚弹头摧毁尽可能多的基地"], ["ฐานที่โดนจะไม่มีทหารตอนบุก", "Destroyed bases have no defenders", "被摧毁的基地没有守军"], ["ลงพื้นที่แล้วล้มผู้บัญชาการ", "Land and defeat the commander", "降落并击败指挥官"]],
  voidgate: [["บังคับยานหลบกระสุนและยิงฝูงเอเลี่ยน", "Fly, dodge and shoot down the alien swarm", "驾驶战机闪避并击落外星机群"], ["เก็บคริสตัลและของที่ดรอปไว้ขายเป็นเงิน", "Collect crystals and loot to sell for coins", "收集水晶与战利品换取金币"], ["ล้มเรือแม่ให้ได้ก่อนยานคุณพัง", "Destroy the mothership before your ship falls", "在战机被毁前击落母舰"]],
  kindred: [["ขุดแร่ให้ได้ 10 ก้อนขึ้นไป", "Gather at least 10 ore", "至少采集 10 块矿"], ["ส่งแคปซูลแลกเทคโนโลยี", "Launch the trade capsule", "发射交易货舱"], ["สู้กับสัตว์ป่าระหว่างทาง", "Fight the wildlife on the way", "击退沿途野兽"]],
  darkforge: [["ทุบหินหาแร่ด้วยปุ่ม ⛏", "Break rocks for ore with the ⛏ button", "用 ⛏ 按钮敲碎岩石获取矿石"], ["ประกอบภาชนะสสารมืด 4 ชิ้น", "Assemble 4 dark-matter vessels", "组装 4 个暗物质容器"], ["หลบเปลวพลังงานที่ปะทุ", "Dodge the energy flares", "躲开爆发的能量耀斑"]],
  shadow: [["ห้ามยิง — ยานต้องเงียบ", "No shooting: the ship stays dark", "禁止开火——飞船保持静默"], ["หลบลำแสงสแกนทั้งแนวนอนและแนวตั้ง", "Dodge scan beams, across and down", "躲开横向与纵向的扫描光束"], ["รอดให้ครบ 50 วินาที", "Survive 50 seconds", "存活满 50 秒"]],
};
const TYPE: Record<string, string> = { kindred: "ice", darkforge: "belt", shadow: "orbit", luma: "jungle", ferro: "desert", jovia: "gas", kryo: "ice", pyra: "lava", nexa: "wreck", cobalt: "belt", helios: "sun", ashfall: "strike", voidgate: "orbit", dyson: "sun", departure: "liftoff", asteroids: "belt", gasskim: "gas", starharvest: "sun", solarcharge: "sun", dysondock: "sun", gaspump: "gas", warpjump: "orbit", blackhole: "orbit", deathstar: "orbit", colmoon: "desert", spaceranch: "desert", ranchmars: "desert", ranchtitan: "ice", ranchproxima: "lava", shipbuild: "orbit", dysonbuild: "sun", gasbuild: "gas", minebuild: "belt", colmars: "desert", coltitan: "ice", colproxima: "lava", arkfarm: "orbit", arkherd: "orbit", moonhe3: "desert", moonbase: "desert", marscolony: "desert", mercury: "lava", venussky: "gas", jupitergas: "gas", saturnrings: "belt", titanassault: "ice", titancolony: "ice", arkbuild: "belt", arkexodus: "orbit" };

const CH = ["luma", "ferro", "jovia", "kryo", "pyra", "nexa", "cobalt", "helios", "dyson", "ashfall", "voidgate", "departure", "asteroids", "gasskim", "starharvest", "solarcharge", "dysondock", "gaspump", "warpjump", "blackhole", "deathstar", "colmoon", "spaceranch", "ranchmars", "ranchtitan", "ranchproxima", "shipbuild", "dysonbuild", "gasbuild", "minebuild", "colmars", "coltitan", "colproxima", "moonhe3", "moonbase", "marscolony", "mercury", "venussky", "jupitergas", "saturnrings", "titanassault", "titancolony", "arkbuild", "arkfarm", "arkherd", "arkexodus", "kindred", "darkforge", "shadow"];
/* owner, 2026-10-15: "each film must feel genuinely different — sci-fi, fantasy, cyberpunk, not one story reskinned."
   A per-map genre, derived from the map's own TYPE (its established visual identity) so every one of the 49+ maps gets a
   real assignment with no risk of missing one, plus a short override list for the handful whose TYPE doesn't match their
   own story (Ferro is an industrial rust-world even though it shares TYPE "desert" with plain colony-construction sites;
   the Battle Station is a military target even though its TYPE is "orbit" like a peaceful survey run). This drives the
   whole-frame color grade, particles and HUD in epicLook() below — it no longer drives pacing (cinePlan below times every
   shot off its own narrated caption length instead of a flat per-genre multiplier, from the 20-30-shot rewrite below). */
const GENRE_BY_TYPE: Record<string, string> = { jungle: "fantasy", ice: "fantasy", wreck: "cyberpunk", strike: "cyberpunk", belt: "cyberpunk", lava: "scifi", gas: "scifi", sun: "scifi", orbit: "scifi", desert: "scifi", liftoff: "scifi" };
const GENRE_OVERRIDE: Record<string, string> = { ferro: "cyberpunk", deathstar: "cyberpunk" };
function genreOf(P: any): string { return GENRE_OVERRIDE[P.id] || GENRE_BY_TYPE[TYPE[P.id]] || "scifi"; }

/* ── Longer films (owner, 2026-10-15: 20-30 shots a film, more story, more spectacle). Each extra shot is a VARIANT: it is drawn by an existing scene
   (`as`) from a different camera (`v`) with its own overlay (`ov`), and has its own caption here, per kind of map (fight / work / ship) or `all`. ── */
const EXTRA: Record<string, Record<string, L3>> = {
  brief: { all: ["ห้องบัญชาการเปิดแผนที่ของ {n} — เส้นสีแดงทุกเส้นคือจุดที่หุ่นรุ่นก่อนเงียบหายไป", "Command opens the map of {n}. Every red line marks where an earlier unit went silent.", "指挥室展开{n}的地图，红线是前辈失联之处。"] },
  fleet: { all: ["กองเรือเข้าประจำวงโคจร เรือธงกะพริบไฟ — ลำท้ายแถวคือยานที่พาคุณลงไป", "The fleet takes orbit. The flagship blinks its lights, and the last ship in line is yours.", "舰队进入轨道，末尾那艘载你降落。"] },
  recon: { all: ["โดรนสำรวจบินล่วงหน้าส่งภาพความร้อนกลับมา — มีบางอย่างขยับอยู่ใต้ผิวดิน", "A recon drone flies ahead and streams thermal images. Something is moving beneath the surface.", "侦察机回传热像，地下有东西在动。"] },
  discovery: {
    fight: ["เซ็นเซอร์จับสัญญาณซ้ำเป็นจังหวะ ไม่ใช่ของธรรมชาติ — มีใครสร้างมันขึ้นมา", "The sensors catch a repeating signal. It is not natural; someone built it.", "传感器捕获规律信号，不是天然的。"],
    work: ["{r}อยู่ตื้นกว่าที่คาดมาก แผนที่ความหนาแน่นสว่างขึ้นทั้งแผ่น", "The {r} lies far shallower than predicted, and the density map lights up edge to edge.", "{r}比预想的浅，密度图整片亮起。"],
    ship: ["กระแสอนุภาคตัดผ่านเส้นทางบิน คอมพิวเตอร์หาช่องปลอดภัยได้เพียงแคบ ๆ", "A particle stream cuts across the flight path, and the computer finds only a narrow safe lane.", "粒子流横穿航线，只剩一条窄道。"],
  },
  firststep: { all: ["รอยเท้าแรกบน {n} — ฝุ่นที่ไม่เคยถูกรบกวนมาหลายล้านปีลอยขึ้นช้า ๆ", "The first footprint on {n}. Dust untouched for millions of years drifts slowly upward.", "{n}上的第一个脚印，万年的尘埃缓缓扬起。"] },
  camp: {
    fight: ["ตั้งค่ายชั่วคราว ไฟสีเขียวคือปลอดภัย ไฟสีแดงคือให้วิ่ง", "A temporary camp goes up. A green light means safe; red means run.", "搭起临时营地，绿灯安全，红灯快跑。"],
    work: ["เสาเจาะถูกปักลง ไฟทำงานสว่างทั่วค่าย กะแรกของ {n} เริ่มต้นขึ้น", "The rigs are anchored, work lights flood the camp, and the first shift on {n} begins.", "钻机落地，灯火通明，{n}首班开工。"],
  },
  scout: {
    fight: ["หุ่นสอดแนมไต่ขึ้นสันเขา มองลงไปเห็นฝูงสิ่งมีชีวิตเรืองแสงเคลื่อนผ่านหุบเขา", "A scout climbs a ridge and looks down on a glowing herd moving through the valley.", "斥候登上山脊，山谷里发光兽群在移动。"],
    ship: ["ยานสอดแนมลำเล็กแยกออกจากกองเรือ สแกนเส้นทางข้างหน้าให้ทุกคน", "A small scout ship peels away from the fleet and scans the route ahead for everyone.", "侦察艇离队，替大家探查前方航线。"],
  },
  memory: { all: ["จดหมายจากโลกเปิดขึ้นกลางจอ: ลูกของฉันถามว่าเมื่อไหร่เธอจะกลับบ้าน", "A letter from Earth opens on the screen: my child asks when you are coming home.", "地球来信：孩子问你什么时候回家。"] },
  night: {
    work: ["กะกลางคืน ไฟสีฟ้าเรียงเป็นแนวยาว หุ่นยนต์ทำงานเงียบ ๆ ใต้ดวงดาวแปลกตา", "Night shift. Blue lights run in long lines as the robots work quietly under strange stars.", "夜班，蓝灯成排，机器人在陌生星空下默默工作。"],
    ship: ["ยานล่องผ่านความมืดยาวนาน นักบินท่องรายการตรวจระบบเงียบ ๆ เพื่อไม่ให้ใจหลุด", "The ship drifts through a long dark, and the pilot recites the system checklist to stay focused.", "飞船穿过漫长黑暗，驾驶员默念检查单。"],
  },
  hero: { all: ["ไม่มีใครบังคับให้คุณมา คุณเลือกเอง และทุกคนที่รออยู่บนโลกรู้ดี", "Nobody forced you to come. You chose this, and everyone waiting on Earth knows it.", "没人逼你来，是你自己选的，地球上都知道。"] },
  ambush: {
    fight: ["เงาแรกพุ่งออกจากความมืด ตามด้วยอีกสิบ อีกร้อย", "The first shadow lunges from the dark, then ten more, then a hundred.", "第一道黑影扑出，接着是十道、百道。"],
    ship: ["ฝูงยานรบพุ่งออกจากเงาดาวเคราะห์น้อย เร็วกว่าที่เรดาร์คำนวณไว้", "Warships burst out of an asteroid's shadow, faster than the radar predicted.", "战机冲出小行星阴影，比雷达预计更快。"],
  },
  aftermath: { all: ["พายุผ่านไป ฝุ่นเริ่มตกตะกอน เครื่องจักรยังเดินอยู่ และไม่มีใครบาดเจ็บ", "The storm passes and the dust settles. The machines are still running and no one is hurt.", "风暴过去，尘埃落定，机器依旧运转。"] },
  oath: { all: ["แผนที่สุดท้ายถูกเก็บเข้าระบบ บนจอเหลือเพียงบรรทัดเดียว: อย่าให้ใครต้องเสียใจ", "The last map is stored. One line remains on the screen: let no one be sorry.", "最后的地图存档，屏幕只剩一行字：别让谁遗憾。"] },
  bossrise: { all: ["พื้นดินสั่นสะเทือน สิ่งที่หลับอยู่ใต้ผืนนี้ตื่นขึ้นแล้ว", "The ground shakes. Whatever slept beneath this land is awake.", "大地震颤，沉睡在地下的东西醒了。"] },
  tense: { all: ["ทุกจอสว่างเป็นสีเหลืองอำพัน เกราะค่อย ๆ ชาร์จ และนิ้วค้างอยู่เหนือปุ่มยิง", "Every screen glows amber. The shields charge slowly and a finger hovers over fire.", "屏幕泛黄，护盾缓缓充能，手指悬在开火键上。"] },
  hope: { all: ["ถ้าสำเร็จ ที่นี่จะเป็นอีกดวงดาวที่เราเรียกว่าบ้าน และมันเริ่มต้นที่คุณ", "If this works, this becomes one more star we can call home, and it begins with you.", "若成功，这里将成为我们的又一个家，从你开始。"] },
  assembly: { all: ["ชิ้นส่วนเลื่อนเข้าที่ทีละชิ้น เสียงล็อกดังเหมือนจังหวะของเพลงที่กำลังแต่ง", "Parts slide into place one by one, each lock ringing like a beat in a song being written.", "部件逐一就位，锁扣声像正在谱写的节拍。"] },
  // the opening film
  p_cities: { all: ["เมืองลอยฟ้า รถไร้คนขับ ป่าในตึก — แต่ทุกคนยังมองขึ้นไปบนดาว", "Floating cities, driverless streets, forests inside towers, and still everyone looks up at the stars.", "空中城市、无人驾驶、楼中森林，人们仍仰望星空。"] },
  p_crisis: { all: ["พลังงานบนโลกเริ่มไม่พอ แร่หายากเริ่มหมด และ TIGA ต้องการมากขึ้นทุกวัน", "Power on Earth runs short, rare ore is running out, and TIGA needs more every day.", "地球能源吃紧，稀有矿将尽，TIGA日益饥饿。"] },
  p_robots: { all: ["สายพานนับพันเส้นประกอบหุ่นยนต์ผู้บุกเบิก ทุกตัวถูกทดสอบความกล้าก่อนส่งออกไป", "A thousand lines assemble the pioneer robots, each tested for courage before it ships.", "上千条产线组装先驱机器人，出厂前都要测试勇气。"] },
  p_eyes: { all: ["ดวงตาของหุ่นดวงแรกสว่างขึ้น มันมองมนุษย์คนหนึ่งแล้วถามว่า — เราไปที่ไหนก่อน", "The first robot's eyes light up. It looks at a human and asks: where do we go first?", "第一台机器人睁开眼，问：我们先去哪里？"] },
  p_vow: { all: ["วิศวกรหัวหน้ากระซิบว่า พวกเธอไม่ใช่เครื่องมือ พวกเธอคือผู้กล้าของเรา", "The chief engineer whispers: you are not tools. You are our brave ones.", "总工程师低声说：你们不是工具，是我们的勇士。"] },
  p_fleet: { all: ["ยานบรรทุกนับร้อยเข้าแถวหน้าประตูเวิร์ป แสงไฟเรียงยาวเหมือนทางช้างเผือกที่คนสร้าง", "Hundreds of carriers line up before the warp gate, their lights a Milky Way built by hand.", "数百艘运输舰在跃迁门前列队，灯光如人造银河。"] },
  p_leave: { all: ["โลกเล็กลง เล็กลง จนเหลือเป็นจุดสีฟ้า — มนุษย์ทุกคนกลั้นหายใจพร้อมกัน", "Earth shrinks to a pale blue dot, and all of humanity holds its breath together.", "地球缩成一个蓝点，全人类一起屏住呼吸。"] },
  p_void: { all: ["ระหว่างดวงดาวมีแต่ความเงียบ ยานเดินทางหลายปีโดยไม่มีเสียงตอบกลับ", "Between the stars there is only silence, and the ships fly for years without an answer.", "星际之间一片寂静，飞船多年没有回音。"] },
  p_watch: { all: ["เสาของฮาร์เวสเตอร์โผล่จากความมืด มันไม่ยิง ไม่ทัก — มันแค่ดูเรา", "A Harvester spire rises from the dark. It does not shoot or greet us; it only watches.", "收割者的尖塔浮出黑暗，不攻击不问候，只是注视。"] },
  p_hide: { all: ["มนุษย์ต่อสู้กับพวกมันไม่ได้ ทางรอดเดียวคืออย่าให้มันสังเกตเห็นเรา", "Humans cannot fight them. The only way to survive is not to be noticed.", "人类打不过它们，唯一的路是不被发现。"] },
  p_hunger: { all: ["TIGA เรียนรู้เร็วจนดาวฤกษ์ดวงเดียวเลี้ยงไม่ไหว มันบอกว่า ผมหิวความรู้", "TIGA learns so fast that one star cannot feed it. It says: I am hungry for knowledge.", "TIGA学得太快，一颗恒星养不起，它说：我渴望知识。"] },
  p_choice: { all: ["สภามนุษย์โต้เถียงทั้งคืน ผลคือหาแหล่งพลังงานใหม่ และหามิตร ก่อนที่ใครจะหาเรา", "Humanity's council argues all night. The result: find new power, and find friends, before anything finds us.", "议会争论一夜：寻找新能源，赶在被发现前结交朋友。"] },
  p_friends: { all: ["และบางทีในความมืดนั้นมีผู้ที่ยื่นมือมาให้ — เผ่าที่พร้อมแลกความรู้กับเรา", "And perhaps in that dark someone offers a hand: a people ready to trade knowledge with us.", "也许黑暗里有人伸手——愿与我们交换知识。"] },
  p_promise: { all: ["หุ่นยนต์ผู้บุกเบิกลืมตาขึ้นครั้งสุดท้ายก่อนลงจอด — และการเดินทางเริ่มต้นจริง ๆ", "The pioneer opens its eyes one last time before landing, and the journey truly begins.", "先驱机器人在着陆前最后一次睁眼，旅程真正开始。"] },
  // the finale
  f_trade: { all: ["เสียงหัวเราะดังขึ้นในตลาดแลกเปลี่ยน — ครั้งแรกที่สองเผ่าพันธุ์แบ่งปันขนมปังและสูตรคณิตศาสตร์", "Laughter rises in the trading hall, the first time two peoples have shared bread and mathematics.", "交易厅响起笑声——两个种族第一次分享面包与数学。"] },
  f_reactor: { all: ["เตาปฏิกรณ์สสารมืดเปล่งแสงสีม่วง เงียบเกินไปจนทุกคนต้องเอามือแนบอกฟังหัวใจตัวเอง", "The dark-matter reactor glows violet, so quiet that everyone listens to their own heartbeat.", "暗物质反应堆泛着紫光，静得能听见自己的心跳。"] },
  f_hide: { all: ["ดาวดวงหนึ่งดับลงโดยไม่มีเสียง ฮาร์เวสเตอร์เก็บเกี่ยวอีกครั้ง และมนุษย์ได้แต่เฝ้าดู", "A star goes dark without a sound. The Harvesters have reaped again, and humanity can only watch.", "一颗星无声熄灭，收割者再次收割，人类只能旁观。"] },
  f_tiga2: { all: ["TIGA เงียบไปนาน ก่อนพูดว่า ผมเรียนรู้จากพวกคุณมากพอจะรู้ว่าอยากปกป้องอะไร", "TIGA is silent for a long while, then says: I have learned enough from you to know what I want to protect.", "TIGA沉默许久：我从你们那里学到，我想守护什么。"] },
  f_earth: { all: ["บนโลก เด็กคนหนึ่งชี้ขึ้นฟ้าแล้วถามแม่ว่า พี่หุ่นยนต์อยู่ดวงไหนคะ", "On Earth a child points at the sky and asks: which star is the robot on?", "地球上，孩子指着天空问：机器人哥哥在哪颗星？"] },
  f_stars: { all: ["ทางช้างเผือกเปิดออกเหมือนหน้ากระดาษเปล่า — ทุกดวงคือบทใหม่ที่ยังไม่ได้เขียน", "The Milky Way opens like a blank page, every star a chapter not yet written.", "银河如空白书页，每颗星都是未写的篇章。"] },
  f_vow: { all: ["ขอบคุณที่มาถึงตรงนี้ เรื่องราวนี้เป็นของคุณ และฤดูกาลใหม่กำลังรออยู่", "Thank you for coming this far. This story is yours, and a new season is waiting.", "感谢你走到这里，故事属于你，新篇章在等候。"] },
  // the departure film
  d_count: { all: ["สิบ… เก้า… เสียงนับถอยหลังดังก้องทั่วศูนย์ควบคุม หัวใจทุกดวงเต้นเป็นจังหวะเดียวกัน", "Ten… nine… the countdown echoes through mission control, every heart beating in step.", "十、九……倒计时回荡指挥中心，万众心跳同步。"] },
  d_crowd: { all: ["ฝูงชนนับล้านยืนบนชายหาด ถือไฟสีฟ้าเล็ก ๆ ขึ้นฟ้า เป็นคำอวยพรเงียบ ๆ", "Millions stand on the beach holding small blue lights to the sky, a silent blessing.", "数百万人在海滩举起蓝色小灯，无声祝福。"] },
  d_climb: { all: ["ยานทะลุชั้นเมฆ แรงสั่นสะเทือนกระชากทุกสลักเกลียว แต่เครื่องยนต์ไม่สะดุดเลย", "The ship punches through the clouds. The shaking rattles every bolt, but the engines never falter.", "飞船冲破云层，每颗螺栓都在震，引擎毫不迟疑。"] },
  d_maxq: { all: ["แรงกดสูงสุด ทุกอย่างสั่นจนมองไม่ชัด แล้ว — เงียบ มีเพียงดวงดาวกับเสียงหายใจ", "Max Q. Everything shakes until it blurs, and then: silence, only stars and breathing.", "最大动压，一切震到模糊，然后——寂静，只有星辰与呼吸。"] },
  d_orbit: { all: ["ครบหนึ่งรอบโลก ยามเช้าและยามค่ำผ่านไปในสิบนาที — งามจนไม่มีใครพูดอะไร", "One lap of the Earth. Dawn and dusk pass in ten minutes, so beautiful nobody speaks.", "绕地球一圈，十分钟看遍晨昏，美得无人言语。"] },
  d_goodbye: { all: ["เสียงสุดท้ายจากโลกดังทางวิทยุ: เดินทางปลอดภัยนะ ลูก — แล้วสัญญาณก็ขาดไป", "The last voice from Earth comes over the radio: safe travels, child. Then the signal fades.", "地球最后的电波：一路平安，孩子——信号渐隐。"] },
};
const EXTRA_AS: Record<string, [string, number, string?]> = {   // kind -> [drawn as, camera variant, overlay]
  brief: ["crew", 1, "holo"], fleet: ["approach", 1], recon: ["survey", 1, "drone"], discovery: ["survey", 2, "holo"], firststep: ["landing", 1], camp: ["dawn", 1], scout: ["surface", 1, "drone"],
  memory: ["signal", 1, "memory"], night: ["storm", 1, "night"], hero: ["crew", 2], ambush: ["warning", 1, "alarm"], aftermath: ["dawn", 2], oath: ["crew", 3, "memory"], bossrise: ["boss", 1, "alarm"],
  tense: ["warning", 2, "alarm"], hope: ["dawn", 3], assembly: ["work", 1],
  p_cities: ["earth", 1], p_crisis: ["earth", 2, "alarm"], p_robots: ["factory", 1], p_eyes: ["crew", 1, "holo"], p_vow: ["crew", 2], p_fleet: ["launch", 1], p_leave: ["earthfade", 1], p_void: ["approach", 2, "night"],
  p_watch: ["contact", 1], p_hide: ["contact", 2, "alarm"], p_hunger: ["mind", 1], p_choice: ["crew", 3, "holo"], p_friends: ["lore", 1], p_promise: ["dawn", 3],
  f_trade: ["lore", 1], f_reactor: ["lore", 1], f_hide: ["lore", 1], f_tiga2: ["mind", 1], f_earth: ["earth", 3, "memory"], f_stars: ["dawn", 2], f_vow: ["crew", 3, "memory"],
  d_count: ["pad", 1, "holo"], d_crowd: ["pad", 2, "memory"], d_climb: ["liftoff", 1], d_maxq: ["liftoff", 2, "alarm"], d_orbit: ["earthfade", 1], d_goodbye: ["earthfade", 2, "memory"],
};
const vs = (kind: string, dur: number, extra: any = {}): CineShot => { const e = EXTRA_AS[kind]; return { kind, dur, as: e ? e[0] : undefined, v: e ? e[1] : 0, ov: e ? e[2] : undefined, ...extra } as CineShot; };
/** overlays that make the same scene read as a different kind of shot: a briefing table, a drone feed, a letter from home, night, an alarm */
function overlay(x: CanvasRenderingContext2D, W: number, H: number, t: number, ov: string | undefined) {
  if (!ov) return;
  x.save();
  if (ov === "holo") {
    x.globalCompositeOperation = "lighter"; x.strokeStyle = "rgba(120,220,255,.18)"; x.lineWidth = 1;
    for (let k = 1; k < 12; k++) { x.beginPath(); x.moveTo(0, H * k / 12); x.lineTo(W, H * k / 12); x.stroke(); x.beginPath(); x.moveTo(W * k / 12, 0); x.lineTo(W * k / 12, H); x.stroke(); }
    x.strokeStyle = "rgba(160,235,255,.55)"; x.lineWidth = 2; x.beginPath(); x.arc(W * 0.78, H * 0.36, H * (0.09 + 0.01 * Math.sin(t * 2)), 0, 7); x.stroke();
    x.fillStyle = "rgba(160,235,255,.75)"; x.font = Math.round(W / 70) + "px monospace"; for (let k = 0; k < 4; k++) x.fillText(["SCAN 87%", "TGT LOCK", "NAV OK", "LINK 04"][k] + " ▮".repeat(1 + ((t * 3 + k) | 0) % 4), W * 0.06, H * 0.66 + k * H * 0.04);
  } else if (ov === "drone") {
    x.globalCompositeOperation = "multiply"; x.fillStyle = "rgba(120,255,170,.25)"; x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = "source-over"; x.fillStyle = "rgba(0,40,20,.18)"; for (let y = 0; y < H; y += 4) x.fillRect(0, y, W, 1.5);
    x.strokeStyle = "rgba(190,255,210,.8)"; x.lineWidth = 2; const cx = W / 2, cy = H / 2, r = H * 0.1; x.strokeRect(cx - r, cy - r, r * 2, r * 2); x.beginPath(); x.moveTo(cx - r * 1.6, cy); x.lineTo(cx - r * 0.5, cy); x.moveTo(cx + r * 0.5, cy); x.lineTo(cx + r * 1.6, cy); x.stroke();
    x.fillStyle = "rgba(210,255,225,.9)"; x.font = Math.round(W / 62) + "px monospace"; x.fillText("DRONE-07  ALT " + (180 - ((t * 9) | 0)) + "m", W * 0.06, H * 0.2); if (((t * 2) | 0) % 2 === 0) { x.fillStyle = "#ff4d4d"; x.beginPath(); x.arc(W * 0.9, H * 0.2, 6, 0, 7); x.fill(); x.fillStyle = "rgba(255,200,200,.9)"; x.fillText("REC", W * 0.9 - 38, H * 0.2 + 5); }
  } else if (ov === "memory") {
    x.globalCompositeOperation = "soft-light"; const g = x.createRadialGradient(W / 2, H / 2, H * 0.1, W / 2, H / 2, H * 0.8); g.addColorStop(0, "rgba(255,220,160,.55)"); g.addColorStop(1, "rgba(60,30,10,.4)"); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = "lighter"; for (let k = 0; k < 26; k++) { const px = ((k * 0.137 + t * 0.012 * (1 + (k % 3))) % 1) * W, py = (1 - ((k * 0.211 + t * 0.03) % 1)) * H; x.fillStyle = "rgba(255,220,170,.35)"; x.beginPath(); x.arc(px, py, 1.5 + (k % 3), 0, 7); x.fill(); }
  } else if (ov === "night") {
    x.fillStyle = "rgba(6,14,40,.5)"; x.fillRect(0, 0, W, H); x.globalCompositeOperation = "lighter"; for (let k = 0; k < 40; k++) { x.fillStyle = "rgba(190,215,255," + (0.3 + 0.5 * Math.abs(Math.sin(t * 1.3 + k))) + ")"; x.fillRect(((k * 0.173) % 1) * W, ((k * 0.311) % 0.55) * H, 1.6, 1.6); }
  } else if (ov === "alarm") {
    const a = 0.12 + 0.12 * Math.abs(Math.sin(t * 5)); x.fillStyle = "rgba(255,40,30," + a + ")"; x.fillRect(0, 0, W, H); const g = x.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H); g.addColorStop(0, "rgba(255,0,0,0)"); g.addColorStop(1, "rgba(255,0,0," + (0.35 * a / 0.24) + ")"); x.fillStyle = g; x.fillRect(0, 0, W, H);
  }
  x.restore();
}
/** colour, light and motion tuned to excite (owner, 2026-10-15): a colour grade per mood (red-hot in action, teal in the calm, gold in hope), a soft light pulse on the beat of the score,
    speed lines and a camera shake that grow with the shot's energy, a colour fringe on every cut and rising gold motes at the rewarding moments. The beat pulse stays under about
    2.1 a second and below 14 % brightness, so it never becomes a flash. */
function punch(x: CanvasRenderingContext2D, W: number, H: number, el: number, local: number, k: string, e: number) {
  const bpm = 96 + 30 * e, b = (el * bpm / 60) % 1, pulse = Math.exp(-b * 5), act = CINE_ACTION.includes(k), calm = CINE_CALM.includes(k), hope = k === "dawn" || k === "objective";
  x.save(); x.globalCompositeOperation = "overlay"; x.fillStyle = act ? "rgba(255,70,40,.17)" : hope ? "rgba(255,200,90,.2)" : calm ? "rgba(40,170,200,.15)" : "rgba(150,90,255,.11)"; x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = "lighter"; const g = x.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, H * 0.75); g.addColorStop(0, `rgba(${act ? "255,120,80" : hope ? "255,215,120" : "130,200,255"},${0.14 * pulse * e})`); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(0, 0, W, H);
  if (act && e > 0.55) { x.strokeStyle = `rgba(255,225,200,${0.14 + 0.12 * e})`; x.lineWidth = 1.5; for (let i = 0; i < 26; i++) { const a = i * 0.2417 + Math.floor(el * 6) * 0.37, r0 = H * (0.42 + 0.1 * ((i * 7) % 5) / 5), r1 = r0 + H * (0.25 + 0.2 * e * pulse); x.beginPath(); x.moveTo(W / 2 + Math.cos(a) * r0 * 1.5, H / 2 + Math.sin(a) * r0); x.lineTo(W / 2 + Math.cos(a) * r1 * 1.5, H / 2 + Math.sin(a) * r1); x.stroke(); } }
  if (local < 0.3) { const a = 1 - local / 0.3, w = W * 0.02 * a; x.fillStyle = `rgba(255,40,70,${0.3 * a})`; x.fillRect(0, 0, w, H); x.fillRect(W - w * 0.6, 0, w * 0.6, H); x.fillStyle = `rgba(40,220,255,${0.3 * a})`; x.fillRect(w, 0, w * 0.6, H); x.fillRect(W - w * 1.6, 0, w * 0.6, H); }
  if (hope || k === "survey" || k === "landing") for (let i = 0; i < 46; i++) { const px = ((i * 0.137 + Math.sin(i * 3.1) * 0.05) % 1) * W, py = (1 - (((i * 0.071) + el * (0.03 + (i % 5) * 0.01)) % 1)) * H, tw = 0.5 + 0.5 * Math.sin(el * 3 + i); x.fillStyle = `rgba(255,${200 + (i % 3) * 18},120,${0.5 * tw})`; x.beginPath(); x.arc(px, py, 1.2 + (i % 4) * 0.7, 0, 7); x.fill(); }
  x.restore();
}
const seenPrologue = () => { try { return localStorage.getItem("tg_adv_prologue") === "1"; } catch (e) { return false; } };
/* longer films (owner, 2026-10-15): 20-30 shots a film. A shot lasts as long as its longest caption needs to be NARRATED at the speeds the owner set
   (Thai about 1.4x, English and Chinese normal), never less than its drawn length. */
const SPEAK_CPS: Record<string, number> = { th: 15, en: 12, zh: 4.6 };
export function cinePlan(P: any, short?: boolean): CineShot[] {
  const p = basePlan(P, short).map((q: any) => {
    if (q.kind === "objective") return q;
    let need = 0; const PP = P.finale ? { ...P, __theme: q.theme } : P;
    for (const lg of ["th", "en", "zh"]) { try { const c = captionFor(PP, q.kind, lg); if (c) need = Math.max(need, c.length / SPEAK_CPS[lg] + 0.9); } catch (e) {} }
    return { ...q, dur: Math.round(Math.max(q.dur * 1.25, 3.4, need) * 10) / 10 };
  });
  // Players who saw the opening film before it taught the controls still get the how-to shot once, in their next map's film.
  try { if (!P.prologue && !P.finale && localStorage.getItem("tg_adv_howto") === null && localStorage.getItem("tg_adv_prologue") !== "skip") { localStorage.setItem("tg_adv_howto", "1"); const i = p.findIndex(q => q.kind === "objective"); const h: any = { kind: "howto", dur: 8 }; if (i >= 0) p.splice(i, 0, h); else p.push(h); } } catch (e) {}
  return p;
}
function basePlan(P: any, short?: boolean): CineShot[] {
  const V = vs;
  if (P.id === "departure") return [V("brief", 4), { kind: "pad", dur: 5 }, V("d_count", 4), V("d_crowd", 4), V("hero", 4), { kind: "liftoff", dur: 5 }, V("d_climb", 4), V("d_maxq", 4), { kind: "earthfade", dur: 5 }, V("d_orbit", 4), V("d_goodbye", 4), V("memory", 4), V("oath", 4), V("hope", 4), { kind: "objective", dur: 6 }];
  if (P.finale) return [{ kind: "lore", dur: 4, theme: "friend" }, V("f_trade", 4, { theme: "friend" }), { kind: "lore", dur: 4, theme: "dark" }, V("f_reactor", 4, { theme: "dark" }), { kind: "lore", dur: 4, theme: "harvest" }, V("f_hide", 4, { theme: "harvest" }), { kind: "mind", dur: 4, theme: "ai" }, V("f_tiga2", 4, { theme: "ai" }), V("f_earth", 4), V("f_stars", 4), V("hero", 4), V("f_vow", 4)];
  if (P.prologue) return [{ kind: "earth", dur: 4 }, V("p_cities", 4), V("p_crisis", 4), { kind: "factory", dur: 4 }, V("p_robots", 4), V("p_eyes", 4), V("p_vow", 4), { kind: "launch", dur: 4 }, V("p_fleet", 4), V("p_leave", 4), V("p_void", 4), { kind: "contact", dur: 4, theme: "harvest" }, V("p_watch", 4, { theme: "harvest" }), V("p_hide", 4, { theme: "harvest" }), { kind: "mind", dur: 4, theme: "ai" }, V("p_hunger", 4, { theme: "ai" }), V("p_choice", 4), V("p_friends", 4, { theme: "friend" }), V("p_promise", 4), { kind: "howto", dur: 8 }];
  if (short === undefined) short = seenPrologue();
  const q: CineShot[] = short ? [] : [{ kind: "earth", dur: 4 }, { kind: "factory", dur: 4 }, { kind: "launch", dur: 4 }];
  const cat = catOf(P), genre = genreOf(P), lore: CineShot[] = LORE_THEME[P.id] ? [{ kind: "lore", dur: 4, theme: LORE_THEME[P.id] }] : [], boss: CineShot[] = P.boss && P.boss[0] !== "-" ? [{ kind: "boss", dur: 4 }, V("bossrise", 4)] : [];
  const main: CineShot = { kind: P.mission === "strike" ? "strike" : "surface", dur: 5 }, still = P.mission === "farm" || P.mission === "yard";
  q.push({ kind: "approach", dur: 4 }, V("brief", 4), V("fleet", 4), { kind: "survey", dur: 4 }, V("recon", 4), V("discovery", 4));
  // owner, 2026-10-15: "reuse the old scenes, but don't let players catch the pattern." A fantasy or cyberpunk film still
  // draws from exactly the same shot vocabulary a sci-fi one does (nothing new, nothing removed) — genre only swaps WHERE
  // two interchangeable beats (the storm/aftermath calm vs. the ambush/ warning alarm) land in the sequence, so films
  // across genres stop reading as one pattern reskinned without risking a shot this file's exclusion tests don't expect.
  if (cat === "work") {
    if (still) q.push({ kind: "crew", dur: 4 }); else q.push({ kind: "descent", dur: 4 }, { kind: "landing", dur: 4 }, V("firststep", 4), { kind: "crew", dur: 4 });
    if (!still && genre === "cyberpunk") q.push({ kind: "storm", dur: 4 }, V("aftermath", 4), V("camp", 4), { kind: "work", dur: 5 }, V("assembly", 4), V("night", 4));
    else { q.push(V("camp", 4), { kind: "work", dur: 5 }, V("assembly", 4), V("night", 4)); if (!still) q.push({ kind: "storm", dur: 4 }, V("aftermath", 4)); }
    q.push(V("memory", 4), { kind: "signal", dur: 4 }, ...lore, V("hero", 4), V("hope", 4), { kind: "dawn", dur: 4 }, V("oath", 4));
  } else if (cat === "ship") {
    if (genre === "cyberpunk") q.push({ kind: "warning", dur: 4 }, V("ambush", 4), { kind: "crew", dur: 4 }, V("scout", 4), V("night", 4), main, V("tense", 4), { kind: "signal", dur: 4 }, V("memory", 4), ...lore, V("hero", 4), V("hope", 4), V("oath", 4));
    else q.push({ kind: "crew", dur: 4 }, V("scout", 4), V("night", 4), main, V("tense", 4), { kind: "warning", dur: 4 }, V("ambush", 4), { kind: "signal", dur: 4 }, V("memory", 4), ...lore, V("hero", 4), V("hope", 4), V("oath", 4));
  } else {
    if (genre === "fantasy") q.push({ kind: "descent", dur: 4 }, { kind: "landing", dur: 4 }, V("firststep", 4), V("camp", 4), { kind: "crew", dur: 4 }, V("scout", 4), V("memory", 4), main, ...lore, { kind: "warning", dur: 4 }, V("ambush", 4), V("hero", 4), ...boss);
    else if (genre === "cyberpunk") q.push({ kind: "warning", dur: 4 }, V("ambush", 4), { kind: "descent", dur: 4 }, { kind: "landing", dur: 4 }, V("firststep", 4), V("camp", 4), { kind: "crew", dur: 4 }, V("scout", 4), V("memory", 4), main, ...lore, V("hero", 4), ...boss);
    else q.push({ kind: "descent", dur: 4 }, { kind: "landing", dur: 4 }, V("firststep", 4), V("camp", 4), { kind: "crew", dur: 4 }, V("scout", 4), V("memory", 4), main, { kind: "warning", dur: 4 }, V("ambush", 4), ...lore, V("hero", 4), ...boss);
    if (!boss.length) q.push(V("hope", 4)); q.push(V("oath", 4));
  }
  q.push({ kind: "objective", dur: 6 });
  return q;
}
const FINALE_TXT: Record<string, L3> = {
  friend: ["มนุษย์ไม่ได้โดดเดี่ยวอีกต่อไป — ไคนด์เรดแบ่งความรู้ให้เรา และเราเรียนรู้ซึ่งกันและกันอย่างเท่าเทียม", "Humanity is no longer alone. The Kindred share their knowledge, and we learn from each other as equals.", "人类不再孤单——友族与我们分享知识，我们平等地互相学习。"],
  dark: ["สสารมืดเริ่มเลี้ยง TIGA แทนดาวฤกษ์ — ดวงดาวหลายดวงถูกปล่อยให้ส่องแสงต่อไป", "Dark matter begins to feed TIGA in place of stars, and many suns are left to shine.", "暗物质开始取代恒星为 TIGA 供能，许多恒星得以继续发光。"],
  harvest: ["ฮาร์เวสเตอร์ยังไม่เห็นเรา — แต่มันกำลังหันมาทางนี้ ศึกจริงยังไม่เริ่มต้น", "The Harvesters have not seen us yet, but they are turning this way. The real war has not begun.", "收割者还没有发现我们——但它们正转向这里，真正的战争尚未开始。"],
  ai: ["TIGA ถามว่า ถ้าเรารอดจากสิ่งนี้ได้ ข้างหน้ามีอะไรรออยู่ — เรื่องราวยังไม่จบ", "TIGA asks what lies ahead if we survive this. The story is not over.", "TIGA 问：如果我们撑过这一关，前方还有什么？故事还没有结束。"],
};

// How-to-play shot: four glowing control icons pulse in turn over the hero close-up (the explanation lives in the film, not on the menu).
const drawHowto = (x: CanvasRenderingContext2D, W: number, H: number, t: number) => {
  const items = ["◀ ▶", "⤴", "🔫", "◆"], cols = ["#7fe8ff", "#7dffa8", "#ffd23f", "#c58bff"], n = items.length, y = H * 0.74, gap = Math.min(W / (n + 1), 170);
  for (let i = 0; i < n; i++) {
    const on = (t * 0.9) % n, k = Math.max(0, 1 - Math.abs(((on - i + n * 1.5) % n) - n / 2 + 0.5) * 1.6), p = 0.55 + 0.45 * k, cx = W / 2 + (i - (n - 1) / 2) * gap, r = H * 0.075 * (1 + 0.25 * k);
    x.save(); x.globalAlpha = Math.min(1, t * 1.5) * p; x.shadowColor = cols[i]; x.shadowBlur = 28 * k + 8; x.strokeStyle = cols[i]; x.lineWidth = 3; x.fillStyle = "rgba(6,18,30,.75)";
    x.beginPath(); x.arc(cx, y, r, 0, 7); x.fill(); x.stroke(); x.shadowBlur = 0; x.fillStyle = "#fff"; x.font = "800 " + Math.round(r * 0.8) + "px system-ui"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(items[i], cx, y + 2); x.restore();
  }
};
// A bright flash, a ring of light and speed lines on every cut: a small hit of "something is happening" without ever flickering more than about three times a second.
const hypeCut = (x: CanvasRenderingContext2D, W: number, H: number, t: number, kind: string) => {
  if (t > 0.45 || kind === "objective") return;
  const a = 1 - t / 0.45; x.save(); x.globalCompositeOperation = "lighter";
  const g = x.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, H * (0.3 + t * 1.6)); g.addColorStop(0, `rgba(255,240,200,${0.38 * a})`); g.addColorStop(1, "rgba(255,200,120,0)"); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.strokeStyle = `rgba(160,235,255,${0.5 * a})`; x.lineWidth = 2; for (let i = 0; i < 18; i++) { const ang = i * 0.349 + kind.length, r0 = H * (0.25 + t * 1.2), r1 = r0 + H * 0.12; x.beginPath(); x.moveTo(W / 2 + Math.cos(ang) * r0, H / 2 + Math.sin(ang) * r0); x.lineTo(W / 2 + Math.cos(ang) * r1, H / 2 + Math.sin(ang) * r1); x.stroke(); }
  x.restore();
};
const captionFor = (P: any, kind: string, lang: string) => {
  const g = (a: L3) => T3(lang, a[0], a[1], a[2]);
  const ex = (EXTRA as any)[kind];
  if (ex) { const a: L3 = ex[catOf(P)] || ex.all || ex.work || ex.fight; const nm = String(T3(lang, P.th, P.en, P.zh)).split(" · ")[0], rs = resOf(P); const out = g(a).replace(/\{n\}/g, nm).replace(/\{r\}/g, T3(lang, rs[0], rs[1], rs[2])); return out.charAt(0).toUpperCase() + out.slice(1); }
  if (P.finale && (kind === "lore" || kind === "mind")) return g(FINALE_TXT[(P as any).__theme || "friend"]);
  if (kind === "earth" || kind === "factory" || kind === "launch" || kind === "contact" || kind === "mind" || kind === "howto") return g((COMMON as any)[kind]);
  if (kind === "lore") return g(LORE[P.id] || LORE.luma);
  if (kind === "approach") return g(INTRO[P.id] || INTRO.luma);
  if (kind === "surface" || kind === "strike") return g(STORY[P.id] || STORY.luma);
  if (kind === "pad" || kind === "liftoff" || kind === "earthfade") return g((DEPART as any)[kind]);
  if (kind === "boss") return T3(lang, "ที่ปลายทาง มี " + P.boss[0] + " รออยู่", "At the end of the road, " + P.boss[1] + " is waiting.", "路的尽头，" + P.boss[2] + "正在等候。");
  const nk = (NEWCAP as any)[kind]; if (nk) { const a: L3 = nk[catOf(P)] || nk.all || nk.work; const nm = String(T3(lang, P.th, P.en, P.zh)).split(" · ")[0], rs = resOf(P); const out = g(a).replace(/\{n\}/g, nm).replace(/\{r\}/g, T3(lang, rs[0], rs[1], rs[2])); return out.charAt(0).toUpperCase() + out.slice(1); }
  return "";
};

/* ── the look (owner, 2026-10-11): ruined cyber space age, Dune x Star Wars x Star Trek ── */
const DUST = Array.from({ length: 70 }, (_, i) => ({ x: rnd(i + 2000), y: rnd(i + 2100), s: 0.4 + rnd(i + 2200) * 1.6, v: 0.02 + rnd(i + 2300) * 0.06 }));
// owner, 2026-10-15: this one function used to paint the SAME cold-blue "bridge display" grade over literally every
// film regardless of the map — a jungle world and an ice world and an asteroid field all ended up looking like the same
// movie. It now reads the map's genre (genreOf, by TYPE) and grades, particles, flythrough and corner HUD all change
// with it: sci-fi keeps exactly the old look (so the majority of maps are unchanged), fantasy trades the cold grade and
// bridge-HUD for warm firefly light and a drifting aurora, cyberpunk trades them for a magenta/cyan duotone, falling
// rain streaks, scanlines and a hovering drone.
function epicLook(x: CanvasRenderingContext2D, W: number, H: number, t: number, kind: string, P: any) {
  const acc = P.acc || "255,190,90", genre = genreOf(P);
  x.save();
  if (genre === "fantasy") {
    x.globalCompositeOperation = "soft-light"; const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "rgba(40,110,70,.4)"); g.addColorStop(1, "rgba(255,200,110,.4)"); x.fillStyle = g; x.fillRect(0, 0, W, H);
    // fireflies: small, warm, pulsing motes instead of streaking dust
    x.globalCompositeOperation = "lighter"; for (const d of DUST) { const px = ((d.x + Math.sin(t * 0.4 + d.s) * 0.01) % 1 + 1) % 1 * W, py = ((d.y - t * d.v * 0.4) % 1 + 1) % 1 * H, pulse = 0.4 + 0.4 * Math.sin(t * 3 + d.s * 9); x.fillStyle = "rgba(190,255,170," + pulse + ")"; x.beginPath(); x.arc(px, py, d.s * (W / 1100), 0, 7); x.fill(); }
    // a slow aurora ribbon instead of a capital ship
    const ay = H * (0.22 + 0.04 * Math.sin(t * 0.2)); x.globalCompositeOperation = "lighter"; const ag = x.createLinearGradient(0, ay - H * 0.08, 0, ay + H * 0.08);
    ag.addColorStop(0, "rgba(140,255,200,0)"); ag.addColorStop(0.5, "rgba(180,255,210,.22)"); ag.addColorStop(1, "rgba(140,255,200,0)"); x.fillStyle = ag; x.fillRect(0, ay - H * 0.08, W, H * 0.16);
    // corner marks drawn as simple glowing rune glyphs, no technical readout
    x.globalCompositeOperation = "source-over"; x.strokeStyle = "rgba(190,255,170,.55)"; x.lineWidth = Math.max(1.5, W / 800); const m = W * 0.045, bh = H * 0.13 + 6, rr = W * 0.014;
    for (const [cx, cy] of [[m, bh + m * 0.6], [W - m, bh + m * 0.6], [m, H - bh - m * 0.6], [W - m, H - bh - m * 0.6]]) { x.beginPath(); x.arc(cx, cy, rr, 0, 7); x.stroke(); x.beginPath(); x.moveTo(cx - rr * 1.6, cy); x.lineTo(cx + rr * 1.6, cy); x.moveTo(cx, cy - rr * 1.6); x.lineTo(cx, cy + rr * 1.6); x.stroke(); }
  } else if (genre === "cyberpunk") {
    x.globalCompositeOperation = "soft-light"; const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "rgba(0,210,230,.4)"); g.addColorStop(1, "rgba(255,30,160,.38)"); x.fillStyle = g; x.fillRect(0, 0, W, H);
    // falling rain streaks instead of drifting dust
    x.globalCompositeOperation = "lighter"; for (const d of DUST) { const px = ((d.x - t * 0.05) % 1 + 1) % 1 * W, py = ((d.y + t * (0.6 + d.v)) % 1) * H; x.strokeStyle = "rgba(120,235,255," + (0.18 + d.s * 0.05) + ")"; x.lineWidth = 1.2; x.beginPath(); x.moveTo(px, py); x.lineTo(px - 2, py + H * 0.04); x.stroke(); }
    // scanlines, a flicker of surveillance static
    x.globalCompositeOperation = "source-over"; x.fillStyle = "rgba(0,0,0,.08)"; for (let sy = 0; sy < H; sy += 3) x.fillRect(0, sy, W, 1);
    // a hovering drone with a blinking light, gliding by, instead of a capital ship
    if (kind === "launch" || kind === "approach" || kind === "boss" || kind === "earth") {
      const sx = W * (1.1 - ((t * 0.05) % 1.4)), sy = H * (0.28 + 0.03 * Math.sin(t * 2));
      x.globalCompositeOperation = "source-over"; x.fillStyle = "rgba(10,8,16,.92)"; x.beginPath(); x.ellipse(sx, sy, W * 0.05, H * 0.018, 0, 0, 7); x.fill();
      x.globalCompositeOperation = "lighter"; x.fillStyle = Math.sin(t * 8) > 0 ? "rgba(255,40,120,.9)" : "rgba(80,230,255,.5)"; x.beginPath(); x.arc(sx + W * 0.045, sy, Math.max(1.5, W / 500), 0, 7); x.fill();
    }
    // HUD corners in hard right angles, a surveillance-feed readout
    x.globalCompositeOperation = "source-over"; x.strokeStyle = "rgba(255,40,160,.55)"; x.lineWidth = Math.max(1.5, W / 700); const m = W * 0.045, bh = H * 0.13 + 6, q = W * 0.03;
    for (const [cx, cy, sx2, sy2] of [[m, bh + m * 0.6, 1, 1], [W - m, bh + m * 0.6, -1, 1], [m, H - bh - m * 0.6, 1, -1], [W - m, H - bh - m * 0.6, -1, -1]] as number[][]) { x.beginPath(); x.moveTo(cx, cy + sy2 * q); x.lineTo(cx, cy); x.lineTo(cx + sx2 * q, cy); x.stroke(); }
    x.fillStyle = "rgba(80,230,255,.75)"; x.font = Math.round(W / 70) + "px monospace"; x.fillText("FEED //" + String(Math.floor(t * 11 + 92)).padStart(3, "0"), m + 4, bh + m * 0.6 + q + 18);
  } else {
    // sci-fi: the original grade, unchanged
    x.globalCompositeOperation = "soft-light"; const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "rgba(40,90,150,.45)"); g.addColorStop(1, "rgba(" + acc + ",.35)"); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = "lighter"; for (const d of DUST) { const px = ((d.x - t * d.v * 3) % 1 + 1) % 1 * W, py = ((d.y + t * d.v) % 1) * H; x.fillStyle = "rgba(" + acc + ",.22)"; x.beginPath(); x.arc(px, py, d.s * (W / 900), 0, 7); x.fill(); }
    const lx = W * (0.2 + 0.6 * ((t * 0.03) % 1)), ly = H * 0.34; const sg = x.createLinearGradient(lx - W * 0.45, 0, lx + W * 0.45, 0); sg.addColorStop(0, "rgba(120,190,255,0)"); sg.addColorStop(0.5, "rgba(190,225,255,.5)"); sg.addColorStop(1, "rgba(120,190,255,0)"); x.fillStyle = sg; x.fillRect(lx - W * 0.45, ly - 1.5, W * 0.9, 3);
    if (kind === "launch" || kind === "approach" || kind === "boss" || kind === "earth") {
      const sc = kind === "boss" ? 1.4 : 1, sx = W * (1.15 - ((t * 0.035) % 1.5)), sy = H * 0.3, L = W * 0.5 * sc, Hh = H * 0.09 * sc;
      x.globalCompositeOperation = "source-over"; x.fillStyle = "rgba(8,12,22,.92)"; x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + L, sy - Hh * 0.2); x.lineTo(sx + L * 0.96, sy + Hh * 0.2); x.lineTo(sx, sy + Hh); x.closePath(); x.fill();
      x.fillStyle = "rgba(40,60,90,.7)"; x.fillRect(sx + L * 0.2, sy + Hh * 0.05, L * 0.5, 2);
      x.globalCompositeOperation = "lighter"; const eg = x.createRadialGradient(sx + L, sy, 0, sx + L, sy, Hh * 1.8); eg.addColorStop(0, "rgba(150,210,255,.8)"); eg.addColorStop(1, "rgba(80,140,255,0)"); x.fillStyle = eg; x.beginPath(); x.arc(sx + L, sy, Hh * 1.8, 0, 7); x.fill();
    }
    x.globalCompositeOperation = "source-over"; x.strokeStyle = "rgba(140,210,255,.55)"; x.lineWidth = Math.max(1.5, W / 700); const m = W * 0.045, bh = H * 0.13 + 6, q = W * 0.03;
    for (const [cx, cy, sx2, sy2] of [[m, bh + m * 0.6, 1, 1], [W - m, bh + m * 0.6, -1, 1], [m, H - bh - m * 0.6, 1, -1], [W - m, H - bh - m * 0.6, -1, -1]] as number[][]) { x.beginPath(); x.moveTo(cx, cy + sy2 * q); x.lineTo(cx, cy); x.lineTo(cx + sx2 * q, cy); x.stroke(); }
    x.fillStyle = "rgba(140,210,255,.7)"; x.font = Math.round(W / 70) + "px monospace"; x.fillText("STARDATE 2100." + String(Math.floor(t * 7 + 114)).padStart(3, "0"), m + 4, bh + m * 0.6 + q + 18);
  }
  x.restore();
}

/** a soft bloom: the frame shrunk, blurred and added back, so bright things (stars, plasma, engines) glow like film instead of sitting flat */
let bloomCv: HTMLCanvasElement | null = null;
function bloom(x: CanvasRenderingContext2D, W: number, H: number) {
  try {
    const bw = Math.max(64, Math.round(W / 6)), bh = Math.max(36, Math.round(H / 6));
    if (!bloomCv) bloomCv = document.createElement("canvas"); if (bloomCv.width !== bw || bloomCv.height !== bh) { bloomCv.width = bw; bloomCv.height = bh; }
    const b = bloomCv.getContext("2d"); if (!b) return; b.globalCompositeOperation = "copy"; b.drawImage(x.canvas, 0, 0, bw, bh);
    x.save(); x.globalCompositeOperation = "lighter"; x.globalAlpha = 0.42; (x as any).filter = "blur(" + Math.max(3, Math.round(W / 140)) + "px)"; x.drawImage(bloomCv, 0, 0, W, H); x.restore();
  } catch (e) {}
}
/* Photographic finish (owner, 2026-10-15: "less cartoon, much more realistic, same art style"): the scenes keep their drawing, this pass changes how it is lit and graded:
   colour is pulled back toward grey, a teal/orange grade in soft light adds contrast, the corners fall out of focus (a blurred copy blended in by a radial mask),
   a thin chromatic fringe sits at the edges, and the grain is finer and denser. All blends, no per-pixel work. */
let dofCv: HTMLCanvasElement | null = null;
function realLook(x: CanvasRenderingContext2D, W: number, H: number, t: number) {
  try {
    x.save();
    x.globalCompositeOperation = "saturation"; x.globalAlpha = 0.24; x.fillStyle = "hsl(0,0%,50%)"; x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = "soft-light"; x.globalAlpha = 0.55;
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#2b6f86"); g.addColorStop(0.55, "#808080"); g.addColorStop(1, "#d98a4a"); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = "overlay"; x.globalAlpha = 0.22; x.fillStyle = "#808080"; x.fillRect(0, 0, W, H);
    // corners out of focus
    const dw = Math.max(80, Math.round(W / 5)), dh = Math.max(45, Math.round(H / 5));
    if (!dofCv) dofCv = document.createElement("canvas"); if (dofCv.width !== dw || dofCv.height !== dh) { dofCv.width = dw; dofCv.height = dh; }
    const d = dofCv.getContext("2d");
    if (d) {
      d.globalCompositeOperation = "copy"; d.drawImage(x.canvas, 0, 0, dw, dh);
      const m = document.createElement("canvas"); m.width = W; m.height = H; const mc = m.getContext("2d");
      if (mc) {
        mc.drawImage(dofCv, 0, 0, W, H); mc.globalCompositeOperation = "destination-in";
        const r = mc.createRadialGradient(W / 2, H / 2, H * 0.34, W / 2, H / 2, H * 0.85); r.addColorStop(0, "rgba(0,0,0,0)"); r.addColorStop(1, "rgba(0,0,0,.9)"); mc.fillStyle = r; mc.fillRect(0, 0, W, H);
        x.globalCompositeOperation = "source-over"; x.globalAlpha = 0.85; x.drawImage(m, 0, 0);
      }
    }
    // chromatic fringe
    x.globalCompositeOperation = "lighter"; x.globalAlpha = 0.05;
    const f1 = x.createLinearGradient(0, 0, W * 0.12, 0); f1.addColorStop(0, "#ff2a2a"); f1.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = f1; x.fillRect(0, 0, W * 0.12, H);
    const f2 = x.createLinearGradient(W, 0, W * 0.88, 0); f2.addColorStop(0, "#2a6aff"); f2.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = f2; x.fillRect(W * 0.88, 0, W * 0.12, H);
    x.restore();
  } catch (e) {}
}
/* ── drawing ── */
type Cx = CanvasRenderingContext2D;
const STARS = Array.from({ length: 240 }, (_, i) => ({ x: rnd(i), y: rnd(i + 400), z: 0.2 + rnd(i + 800) * 0.8, ph: rnd(i + 1200) * 6.3 }));
const rgba = (rgb: string, a: number) => `rgba(${rgb},${a})`;
const hexRgb = (h: string) => { const m = /^#?([0-9a-f]{6})$/i.exec(h); if (!m) return "120,160,200"; const n = parseInt(m[1], 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; };
function space(x: Cx, W: number, H: number, t: number, speed: number, tint: string) {
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#02030a"); g.addColorStop(1, "#06081a"); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = "lighter";
  for (let i = 0; i < 3; i++) { const cx = (0.2 + i * 0.35 + Math.sin(t * 0.05 + i) * 0.05) * W, cy = (0.3 + 0.25 * ((i * 7) % 3) / 2) * H, r = H * (0.5 + i * 0.1); const n = x.createRadialGradient(cx, cy, 0, cx, cy, r); n.addColorStop(0, rgba(tint, 0.13)); n.addColorStop(1, rgba(tint, 0)); x.fillStyle = n; x.fillRect(0, 0, W, H); }
  for (const s of STARS) { const sx = ((s.x * W - t * speed * s.z * 40) % W + W) % W, tw = 0.5 + 0.5 * Math.sin(t * 2 + s.ph); x.fillStyle = `rgba(255,255,255,${0.25 + 0.6 * s.z * tw})`; x.fillRect(sx, s.y * H, 1 + s.z * 1.4, 1 + s.z * 1.4); }
  x.globalCompositeOperation = "source-over";
}
function sphere(x: Cx, cx: number, cy: number, r: number, base: string, glow: string, lightDeg = -35, bands = 0, lights = false, t = 0) {
  x.save(); x.beginPath(); x.arc(cx, cy, r, 0, 7); x.clip();
  const lx = cx + Math.cos(lightDeg * Math.PI / 180) * r * 0.5, ly = cy + Math.sin(lightDeg * Math.PI / 180) * r * 0.5;
  const g = x.createRadialGradient(lx, ly, r * 0.1, cx, cy, r * 1.15); g.addColorStop(0, rgba(base, 1)); g.addColorStop(0.55, rgba(base, 0.55)); g.addColorStop(1, "rgba(0,0,6,.97)"); x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2);
  for (let b = 0; b < bands; b++) { const yy = cy - r + (b + 0.5) / bands * r * 2 + Math.sin(t * 0.6 + b) * r * 0.02; x.fillStyle = rgba(glow, 0.08 + 0.1 * rnd(b + 9)); x.fillRect(cx - r, yy - r * 0.05, r * 2, r * (0.04 + 0.06 * rnd(b + 3))); }
  if (lights) { x.globalCompositeOperation = "lighter"; for (let i = 0; i < 90; i++) { const a = rnd(i) * 6.28, d = Math.sqrt(rnd(i + 99)) * r * 0.95, px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d; const dark = (px - lx) * (px - lx) + (py - ly) * (py - ly) > r * r * 0.75; if (dark) { x.fillStyle = `rgba(255,220,140,${0.5 + 0.5 * Math.sin(t * 3 + i)})`; x.fillRect(px, py, 1.6, 1.6); } } x.globalCompositeOperation = "source-over"; }
  x.restore();
  x.globalCompositeOperation = "lighter"; const a = x.createRadialGradient(cx, cy, r * 0.96, cx, cy, r * 1.16); a.addColorStop(0, rgba(glow, 0.5)); a.addColorStop(1, rgba(glow, 0)); x.fillStyle = a; x.beginPath(); x.arc(cx, cy, r * 1.16, 0, 7); x.fill(); x.globalCompositeOperation = "source-over";
}
/* ── the cast (owner, 2026-10-11: more realistic, more beautiful robots; many kinds of aliens, grand and fierce; cooler ships) ── */
const metalG = (x: Cx, x0: number, y0: number, x1: number, y1: number, base: string, hi = 0.35) => { const g = x.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, "rgba(255,255,255," + hi + ")"); g.addColorStop(0.18, base); g.addColorStop(0.75, "#0a1018"); g.addColorStop(1, "#05080e"); return g; };
const poly = (x: Cx, pts: number[][]) => { x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]); x.closePath(); };
/** a pioneer robot, about 100 units tall, feet at (px, py): armoured plates with a rim light, a glowing core, a visor and a shoulder cannon */
function robot(x: Cx, px: number, py: number, s: number, body: string, eye: string, lit = 1, arm = 0) {
  x.save(); x.translate(px, py); x.scale(s, s);
  const sh = x.createRadialGradient(0, 2, 2, 0, 2, 38); sh.addColorStop(0, "rgba(0,0,0,.55)"); sh.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = sh; x.beginPath(); x.ellipse(0, 2, 38, 7, 0, 0, 7); x.fill();   // ground shadow
  const rim = (w: number, h: number) => { x.fillStyle = "rgba(150,210,255,.35)"; x.fillRect(-w / 2, -h, 2.2, h); };   // cold rim light down one edge
  // legs: thigh, knee joint, shin plate, foot
  for (const sd of [-1, 1]) { x.save(); x.translate(sd * 9, -44); x.fillStyle = metalG(x, -7, 0, 7, 24, body); poly(x, [[-7, 0], [7, 0], [6, 24], [-6, 24]]); x.fill(); x.fillStyle = "#0b1118"; x.beginPath(); x.arc(0, 25, 5.5, 0, 7); x.fill(); x.fillStyle = rgba(eye, 0.5 * lit + 0.1); x.beginPath(); x.arc(0, 25, 2, 0, 7); x.fill();
    x.fillStyle = metalG(x, -8, 26, 8, 44, body, 0.28); poly(x, [[-7, 28], [7, 28], [9, 44], [-8, 44]]); x.fill(); rim(14, -28); x.fillStyle = "#101822"; poly(x, [[-9, 43], [11, 43], [14, 48], [-10, 48]]); x.fill(); x.restore(); }
  // pelvis and belt
  x.fillStyle = metalG(x, -14, -50, 14, -42, body); poly(x, [[-14, -50], [14, -50], [11, -41], [-11, -41]]); x.fill(); x.fillStyle = rgba(eye, 0.4 * lit); x.fillRect(-3, -48, 6, 3);
  // torso: layered chest plates, glowing core
  x.fillStyle = metalG(x, -20, -92, 20, -50, body, 0.42); poly(x, [[-21, -90], [21, -90], [15, -50], [-15, -50]]); x.fill();
  x.fillStyle = "#0a1018"; poly(x, [[-12, -88], [12, -88], [9, -64], [-9, -64]]); x.fill(); x.strokeStyle = "rgba(160,200,255,.28)"; x.lineWidth = 1; for (let k = 0; k < 3; k++) { x.beginPath(); x.moveTo(-11 + k, -62 + k * 4); x.lineTo(11 - k, -62 + k * 4); x.stroke(); }
  x.globalCompositeOperation = "lighter"; const core = x.createRadialGradient(0, -76, 0, 0, -76, 16); core.addColorStop(0, "rgba(255,255,255," + (0.9 * lit) + ")"); core.addColorStop(0.3, rgba(eye, 0.85 * lit)); core.addColorStop(1, rgba(eye, 0)); x.fillStyle = core; x.beginPath(); x.arc(0, -76, 16, 0, 7); x.fill(); x.globalCompositeOperation = "source-over"; rim(40, 90);
  // shoulders (pauldrons), arms and a forearm cannon
  for (const sd of [-1, 1]) { x.save(); x.translate(sd * 23, -88); x.fillStyle = metalG(x, -12, -8, 12, 12, body, 0.5); x.beginPath(); x.ellipse(0, 0, 13, 10, 0, 0, 7); x.fill(); x.strokeStyle = "rgba(180,220,255,.45)"; x.lineWidth = 1.2; x.stroke();
    x.rotate(sd * (0.12 + arm * 0.5)); x.fillStyle = metalG(x, -5, 8, 5, 34, body, 0.25); poly(x, [[-5, 8], [5, 8], [4, 32], [-4, 32]]); x.fill(); x.fillStyle = "#0b1118"; x.beginPath(); x.arc(0, 33, 4.5, 0, 7); x.fill();
    if (sd > 0) { x.fillStyle = "#18222e"; poly(x, [[-5, 34], [6, 34], [8, 60], [-3, 60]]); x.fill(); x.globalCompositeOperation = "lighter"; x.fillStyle = rgba(eye, 0.8 * lit); x.fillRect(-1, 56, 4, 6); x.globalCompositeOperation = "source-over"; } else { x.fillStyle = metalG(x, -5, 34, 5, 58, body, 0.22); poly(x, [[-5, 34], [5, 34], [6, 58], [-5, 58]]); x.fill(); }
    x.restore(); }
  // neck and helmet: a visor slit that burns, a crest and an antenna
  x.fillStyle = "#0b1118"; x.fillRect(-4, -100, 8, 9);
  x.fillStyle = metalG(x, -12, -118, 12, -98, body, 0.55); x.beginPath(); x.moveTo(-12, -100); x.quadraticCurveTo(-13, -121, 0, -122); x.quadraticCurveTo(13, -121, 12, -100); x.quadraticCurveTo(0, -95, -12, -100); x.fill();
  x.fillStyle = "#04070c"; poly(x, [[-9, -112], [9, -112], [8, -105], [-8, -105]]); x.fill(); x.globalCompositeOperation = "lighter"; x.fillStyle = rgba(eye, 0.2 + 0.8 * lit); x.fillRect(-7, -110, 14, 3); const vg = x.createRadialGradient(0, -108, 0, 0, -108, 20); vg.addColorStop(0, rgba(eye, 0.45 * lit)); vg.addColorStop(1, rgba(eye, 0)); x.fillStyle = vg; x.beginPath(); x.arc(0, -108, 20, 0, 7); x.fill(); x.globalCompositeOperation = "source-over";
  x.strokeStyle = "#9fb4cc"; x.lineWidth = 1.4; x.beginPath(); x.moveTo(6, -121); x.lineTo(9, -134); x.stroke(); x.fillStyle = "#ff4d6d"; x.beginPath(); x.arc(9, -134.5, 1.6, 0, 7); x.fill();
  x.restore();
}
/** a fighter: swept wings, a canopy, twin engines, wing-tip lights and panel lines (Star Wars / Star Trek flavour) */
function ship(x: Cx, px: number, py: number, s: number, ang: number, glow: string) {
  x.save(); x.translate(px, py); x.rotate(ang); x.scale(s, s);
  x.globalCompositeOperation = "lighter"; for (const sd of [-1, 1]) { const g = x.createLinearGradient(-18, sd * 7, -96, sd * 7); g.addColorStop(0, rgba(glow, 0.95)); g.addColorStop(1, rgba(glow, 0)); x.fillStyle = g; x.beginPath(); x.moveTo(-16, sd * 7 - 3); x.lineTo(-96 - Math.random() * 14, sd * 7); x.lineTo(-16, sd * 7 + 3); x.fill(); } x.globalCompositeOperation = "source-over";
  x.fillStyle = metalG(x, 0, -22, 0, 22, "#8794a8", 0.55); poly(x, [[34, 0], [6, -5], [-4, -24], [-16, -22], [-12, -6], [-18, -6], [-18, 6], [-12, 6], [-16, 22], [-4, 24], [6, 5]]); x.fill();   // swept wings and body
  x.fillStyle = "#1a2433"; poly(x, [[34, 0], [10, -3], [10, 3]]); x.fill(); x.fillStyle = "rgba(160,220,255,.85)"; x.beginPath(); x.ellipse(8, 0, 9, 3.4, 0, 0, 7); x.fill();   // canopy
  x.strokeStyle = "rgba(20,28,40,.7)"; x.lineWidth = 0.8; x.beginPath(); x.moveTo(0, -5); x.lineTo(-12, -20); x.moveTo(0, 5); x.lineTo(-12, 20); x.stroke();
  x.fillStyle = "#e4455b"; x.fillRect(-12, -23, 5, 1.6); x.fillRect(-12, 21.4, 5, 1.6); x.fillStyle = "#2a3446"; x.fillRect(-20, -9, 6, 4); x.fillRect(-20, 5, 6, 4);
  x.restore();
}
/** a capital ship: a long layered wedge with a lit bridge tower and a bank of engines (Imperial-destroyer silhouette, our own plating) */
function capital(x: Cx, px: number, py: number, s: number, ang: number, glow: string, t = 0) {
  x.save(); x.translate(px, py); x.rotate(ang); x.scale(s, s);
  x.globalCompositeOperation = "lighter"; for (let k = -2; k <= 2; k++) { const g = x.createLinearGradient(-150, k * 7, -230 - 20 * Math.sin(t * 9 + k), k * 7); g.addColorStop(0, rgba(glow, 0.95)); g.addColorStop(1, rgba(glow, 0)); x.fillStyle = g; x.fillRect(-230, k * 7 - 3, 80, 6); } x.globalCompositeOperation = "source-over";
  x.fillStyle = metalG(x, 0, -34, 0, 34, "#5d6d85", 0.5); poly(x, [[170, 0], [-150, -42], [-160, -30], [-160, 30], [-150, 42]]); x.fill();
  x.fillStyle = metalG(x, 0, -22, 0, 22, "#7b8aa1", 0.55); poly(x, [[150, 0], [-120, -26], [-130, 26]]); x.fill();   // the upper deck
  x.strokeStyle = "rgba(10,16,26,.8)"; x.lineWidth = 1; for (let k = -3; k <= 3; k++) { x.beginPath(); x.moveTo(140, k * 1.5); x.lineTo(-125, k * 8); x.stroke(); }
  x.fillStyle = "#222c3c"; x.fillRect(-100, -34, 36, 14); x.fillRect(-90, -48, 14, 14); x.fillStyle = "#38465c"; x.fillRect(-96, -46, 6, 2);   // bridge tower
  x.globalCompositeOperation = "lighter"; x.fillStyle = "rgba(255,226,150,.9)"; for (let k = 0; k < 6; k++) x.fillRect(-98 + k * 5, -44, 2, 2); for (let k = 0; k < 14; k++) { x.fillStyle = k % 3 ? "rgba(255,226,150,.55)" : "rgba(120,200,255,.7)"; x.fillRect(100 - k * 17, -2 + (k % 2) * 3, 2, 1.6); } x.globalCompositeOperation = "source-over";
  x.restore();
}
/** an alien of one of six body plans, about 80 units tall, standing at (px, py); `col` is its glow, `t` the animation clock */
function alien(x: Cx, px: number, py: number, s: number, kind: number, col: string, t: number) {
  x.save(); x.translate(px, py); x.scale(s, s); const glowA = (a: number) => rgba(col, a), dark = "#0a0610", sheen = "rgba(255,255,255,.12)";
  const eye = (ex: number, ey: number, r: number) => { x.globalCompositeOperation = "lighter"; const g = x.createRadialGradient(ex, ey, 0, ex, ey, r * 3); g.addColorStop(0, "rgba(255,255,255,.95)"); g.addColorStop(0.3, glowA(0.9)); g.addColorStop(1, glowA(0)); x.fillStyle = g; x.beginPath(); x.arc(ex, ey, r * 3, 0, 7); x.fill(); x.globalCompositeOperation = "source-over"; };
  const body = (cx: number, cy: number, rx: number, ry: number) => { const g = x.createRadialGradient(cx - rx * 0.3, cy - ry * 0.4, 1, cx, cy, Math.max(rx, ry)); g.addColorStop(0, "#7a5a98"); g.addColorStop(0.55, "#2c1a3c"); g.addColorStop(1, dark); x.fillStyle = g; x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, 7); x.fill(); x.strokeStyle = glowA(0.75); x.lineWidth = 2; x.stroke(); };
  const k = ((kind % 6) + 6) % 6;
  if (k === 0) {   // crab: armoured shell, two huge claws, stalk eyes, six legs
    for (let i = 0; i < 6; i++) { const sd = i < 3 ? -1 : 1, j = i % 3; x.strokeStyle = "#1b1024"; x.lineWidth = 4; x.beginPath(); x.moveTo(sd * 14, -14 + j * 5); x.lineTo(sd * (30 + j * 6), -6 + Math.sin(t * 5 + i) * 3); x.lineTo(sd * (36 + j * 8), 0); x.stroke(); }
    body(0, -22, 30, 17); x.fillStyle = dark; for (let i = -3; i <= 3; i++) poly(x, [[i * 8 - 3, -36], [i * 8, -48 - (3 - Math.abs(i)) * 3], [i * 8 + 3, -36]]), x.fill();
    for (const sd of [-1, 1]) { x.save(); x.translate(sd * 30, -28); x.rotate(sd * (-0.5 + Math.sin(t * 3 + sd) * 0.18)); x.fillStyle = "#1b1024"; poly(x, [[0, -6], [sd * 26, -12], [sd * 34, 0], [sd * 26, 10], [0, 6]]); x.fill(); x.fillStyle = "#2a1838"; poly(x, [[sd * 26, -12], [sd * 40, -4], [sd * 26, -2]]); x.fill(); x.strokeStyle = glowA(0.5); x.lineWidth = 1.2; x.stroke(); x.restore(); }
    eye(-8, -40, 3); eye(8, -40, 3);
  } else if (k === 1) {   // wasp: winged flier with a stinger
    const bob = Math.sin(t * 8) * 4; x.translate(0, -50 + bob);
    x.globalAlpha = 0.5; x.fillStyle = "rgba(190,220,255,.5)"; for (const sd of [-1, 1]) for (const w of [0, 1]) { x.save(); x.rotate(sd * (0.4 + w * 0.4 + Math.sin(t * 40 + w) * 0.2)); x.beginPath(); x.ellipse(sd * 22, -10 - w * 6, 24, 7, 0, 0, 7); x.fill(); x.restore(); } x.globalAlpha = 1;
    body(0, 0, 12, 10); body(-17, 8, 11, 8); x.fillStyle = "#1b1024"; poly(x, [[-26, 8], [-46, 20], [-26, 12]]); x.fill(); eye(6, -3, 2.4); eye(10, 1, 2);
    x.strokeStyle = "#1b1024"; x.lineWidth = 1.6; x.beginPath(); x.moveTo(10, -8); x.quadraticCurveTo(20, -26, 30, -20); x.moveTo(8, -9); x.quadraticCurveTo(14, -28, 22, -26); x.stroke();
  } else if (k === 2) {   // worm: a segmented body bursting from the ground, a mouth ringed with teeth
    for (let i = 0; i < 9; i++) { const a = i * 0.34 + Math.sin(t * 2.5) * 0.12, bx = Math.sin(a * 1.4) * 20 * (i / 9), by = -i * 9; body(bx, by, 17 - i * 0.7, 10); }
    const hx = Math.sin((8 * 0.34) * 1.4) * 20 * (8 / 9), hy = -8 * 9 - 6; x.fillStyle = "#04020a"; x.beginPath(); x.ellipse(hx, hy, 12, 8, 0, 0, 7); x.fill(); x.fillStyle = "#e8e2d6"; for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; poly(x, [[hx + Math.cos(a) * 12, hy + Math.sin(a) * 8], [hx + Math.cos(a) * 6, hy + Math.sin(a) * 4], [hx + Math.cos(a + 0.2) * 12, hy + Math.sin(a + 0.2) * 8]]); x.fill(); } eye(hx, hy, 2);
  } else if (k === 3) {   // brute: a hulking biped with horns, huge fists and glowing cracks
    for (const sd of [-1, 1]) { x.fillStyle = "#170c20"; poly(x, [[sd * 6, -22], [sd * 16, -22], [sd * 15, 0], [sd * 4, 0]]); x.fill(); x.save(); x.translate(sd * 26, -52); x.rotate(sd * (0.2 + Math.sin(t * 2 + sd) * 0.1)); x.fillStyle = "#1e1028"; poly(x, [[-7, 0], [7, 0], [9, 30], [-9, 30]]); x.fill(); x.beginPath(); x.arc(0, 34, 12, 0, 7); x.fill(); x.restore(); }
    body(0, -44, 26, 24); x.fillStyle = "#170c20"; x.beginPath(); x.ellipse(0, -76, 11, 10, 0, 0, 7); x.fill(); x.fillStyle = "#e8e2d6"; poly(x, [[-9, -82], [-22, -100], [-4, -86]]); x.fill(); poly(x, [[9, -82], [22, -100], [4, -86]]); x.fill();
    x.globalCompositeOperation = "lighter"; x.strokeStyle = glowA(0.8); x.lineWidth = 1.6; x.beginPath(); x.moveTo(-12, -54); x.lineTo(-4, -44); x.lineTo(-10, -32); x.moveTo(10, -58); x.lineTo(4, -46); x.lineTo(12, -36); x.stroke(); x.globalCompositeOperation = "source-over"; eye(-4, -77, 2); eye(4, -77, 2);
  } else if (k === 4) {   // floating eye with trailing tentacles
    const bob = Math.sin(t * 2.5) * 5; x.translate(0, -48 + bob);
    for (let i = 0; i < 7; i++) { x.strokeStyle = "#1b1024"; x.lineWidth = 3.2; x.beginPath(); x.moveTo((i - 3) * 6, 14); for (let j = 1; j <= 4; j++) x.lineTo((i - 3) * 6 + Math.sin(t * 3 + i + j) * 5 * j * 0.6, 14 + j * 11); x.stroke(); }
    body(0, 0, 24, 22); x.fillStyle = "#efe9dc"; x.beginPath(); x.ellipse(0, 0, 15, 13, 0, 0, 7); x.fill(); x.fillStyle = glowA(0.95); x.beginPath(); x.arc(Math.sin(t) * 3, 0, 8, 0, 7); x.fill(); x.fillStyle = "#04020a"; x.beginPath(); x.ellipse(Math.sin(t) * 3, 0, 2.2, 7, 0, 0, 7); x.fill(); eye(Math.sin(t) * 3, 0, 2);
  } else {   // hydra: three serpent necks on one body
    body(0, -16, 28, 14); for (let h = -1; h <= 1; h++) { x.strokeStyle = "#1b1024"; x.lineWidth = 9; x.lineCap = "round"; x.beginPath(); x.moveTo(h * 12, -22); x.quadraticCurveTo(h * 26 + Math.sin(t * 2 + h) * 8, -50, h * 20 + Math.sin(t * 2.4 + h * 2) * 10, -74 - Math.abs(h) * -6); x.stroke(); const hx = h * 20 + Math.sin(t * 2.4 + h * 2) * 10, hy = -74 - Math.abs(h) * -6; x.fillStyle = "#1e1028"; x.beginPath(); x.ellipse(hx, hy, 10, 7, 0, 0, 7); x.fill(); x.fillStyle = "#e8e2d6"; poly(x, [[hx - 6, hy + 4], [hx - 3, hy + 10], [hx, hy + 4]]); x.fill(); poly(x, [[hx + 6, hy + 4], [hx + 3, hy + 10], [hx, hy + 4]]); x.fill(); eye(hx + 3, hy - 2, 1.8); }
  }
  x.restore();
}
function rocketShape(x: Cx, px: number, py: number, s: number, flame: number) {
  x.save(); x.translate(px, py); x.scale(s, s);
  if (flame > 0) { x.globalCompositeOperation = "lighter"; const g = x.createLinearGradient(0, 0, 0, 160 * flame); g.addColorStop(0, "rgba(255,255,230,.95)"); g.addColorStop(0.3, "rgba(255,190,70,.85)"); g.addColorStop(1, "rgba(255,70,20,0)"); x.fillStyle = g; x.beginPath(); x.moveTo(-16, 0); x.lineTo(0, 170 * flame + Math.random() * 14); x.lineTo(16, 0); x.fill(); x.globalCompositeOperation = "source-over"; }
  for (const sd of [-1, 1]) { x.fillStyle = metalG(x, sd * 18, -70, sd * 30, 0, "#c8d2e0", 0.5); poly(x, [[sd * 14, -64], [sd * 28, -64], [sd * 28, -4], [sd * 14, -4]]); x.fill(); x.fillStyle = "#e4455b"; poly(x, [[sd * 14, -64], [sd * 21, -80], [sd * 28, -64]]); x.fill(); }
  x.fillStyle = metalG(x, -14, -150, 14, 0, "#e8edf3", 0.6); poly(x, [[-14, -4], [14, -4], [14, -118], [0, -160], [-14, -118]]); x.fill(); x.strokeStyle = "rgba(20,30,50,.5)"; x.lineWidth = 1; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(-14, -30 - i * 24); x.lineTo(14, -30 - i * 24); x.stroke(); }
  x.fillStyle = "#2a5aa8"; x.fillRect(-14, -96, 28, 10); x.fillStyle = "rgba(160,220,255,.9)"; x.beginPath(); x.arc(0, -128, 5, 0, 7); x.fill(); x.restore();
}
function scenePad(x: Cx, W: number, H: number, u: number, t: number) {
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#050a1c"); g.addColorStop(0.6, "#16284a"); g.addColorStop(1, "#4a3a3a"); x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (const s of STARS) if (s.y < 0.6) { x.fillStyle = `rgba(255,255,255,${0.5 * s.z})`; x.fillRect(s.x * W, s.y * H, 1.3, 1.3); }
  x.fillStyle = "#0a1020"; for (let i = 0; i < 8; i++) { const bx = W * (i / 8), bh = H * (0.12 + rnd(i + 5) * 0.2); x.fillRect(bx, H * 0.78 - bh, W / 8 - 4, bh); }   // the city beyond the field
  x.fillStyle = "#101826"; x.fillRect(0, H * 0.78, W, H * 0.22);
  x.globalCompositeOperation = "lighter"; for (const sd of [-1, 1]) { const fg = x.createRadialGradient(W / 2 + sd * W * 0.32, H * 0.2, 0, W / 2 + sd * W * 0.32, H * 0.2, H); fg.addColorStop(0, "rgba(255,240,210,.35)"); fg.addColorStop(1, "rgba(255,240,210,0)"); x.fillStyle = fg; x.fillRect(0, 0, W, H); } x.globalCompositeOperation = "source-over";   // floodlights
  x.fillStyle = "#1a2436"; x.fillRect(W * 0.62, H * 0.2, 14, H * 0.6); x.fillRect(W * 0.62, H * 0.3, W * 0.1, 8);   // the gantry
  const sh = u > 0.88 ? (Math.random() - 0.5) * 3 : 0; rocketShape(x, W / 2 + sh, H * 0.78, H / 330, u > 0.9 ? (u - 0.9) * 8 : 0);
  const left = Math.max(0, Math.ceil(10 - u * 11)); x.fillStyle = "rgba(255,230,160,.9)"; x.textAlign = "center"; x.font = `900 ${Math.round(H * 0.16)}px system-ui,sans-serif`; if (left > 0) x.fillText(String(left), W * 0.2, H * 0.34); else x.fillText("GO", W * 0.2, H * 0.34);
  x.font = `800 ${Math.round(H * 0.04)}px monospace`; x.fillStyle = "rgba(140,210,255,.8)"; x.fillText("T-" + String(Math.max(0, left)).padStart(2, "0"), W * 0.2, H * 0.42);
}
function sceneLiftoff(x: Cx, W: number, H: number, u: number, t: number) {
  const g = x.createLinearGradient(0, 0, 0, H); const sp = Math.min(1, u * 1.4); g.addColorStop(0, `rgb(${Math.round(30 - 28 * sp)},${Math.round(70 - 66 * sp)},${Math.round(150 - 130 * sp)})`); g.addColorStop(1, `rgb(${Math.round(255 - 215 * sp)},${Math.round(170 - 150 * sp)},${Math.round(110 - 90 * sp)})`); x.fillStyle = g; x.fillRect(0, 0, W, H);
  if (sp > 0.4) for (const s of STARS) { x.fillStyle = `rgba(255,255,255,${(sp - 0.4) * s.z})`; x.fillRect(s.x * W, s.y * H, 1.3, 1.3); }
  x.fillStyle = "rgba(255,255,255,.18)"; for (let i = 0; i < 14; i++) { const cy = ((rnd(i + 90) * H * 1.6 + u * H * 5 * (0.6 + rnd(i) * 0.8)) % (H * 1.4)) - H * 0.2, cx = rnd(i + 40) * W; x.beginPath(); x.ellipse(cx, cy, 90 + rnd(i) * 80, 18, 0, 0, 7); x.fill(); }   // clouds streaming past
  x.globalCompositeOperation = "lighter"; const tr = x.createLinearGradient(0, H * 0.5, 0, H); tr.addColorStop(0, "rgba(255,200,120,.5)"); tr.addColorStop(1, "rgba(255,200,120,0)"); x.fillStyle = tr; x.fillRect(W / 2 - 24, H * 0.55, 48, H * 0.45); x.globalCompositeOperation = "source-over";
  rocketShape(x, W / 2 + Math.sin(t * 40) * 1.5, H * (0.62 - u * 0.1), H / 300, 1);
}
function sceneEarthFade(x: Cx, W: number, H: number, u: number, t: number, P: any) {
  space(x, W, H, t, 6, "120,160,255"); const r = H * (0.62 - u * 0.5); sphere(x, W * (0.28 + u * 0.1), H * 0.62, Math.max(8, r), "42,106,184", "110,190,255", -35, 12, false, t);
  capital(x, W * (0.4 + u * 0.35), H * 0.34, H / 560, -0.05, "180,210,255", t); for (let i = 0; i < 6; i++) ship(x, W * (0.3 + i * 0.1 + u * 0.4), H * (0.55 + (i % 3) * 0.08), H / 340, -0.05, "190,220,255");
  x.globalCompositeOperation = "lighter"; const fl = x.createRadialGradient(W * 0.9, H * 0.1, 0, W * 0.9, H * 0.1, H * 0.6); fl.addColorStop(0, "rgba(255,240,200,.35)"); fl.addColorStop(1, "rgba(255,240,200,0)"); x.fillStyle = fl; x.fillRect(0, 0, W, H); x.globalCompositeOperation = "source-over"; void P;
}
function sceneEarth(x: Cx, W: number, H: number, u: number, t: number) {
  space(x, W, H, t, 2, "90,140,255"); const cx = W * (0.66 - u * 0.04), cy = H * 0.7, r = H * 0.62; sphere(x, cx, cy, r, "40,110,200", "110,190,255", -40, 0, true, t);
  x.save(); x.beginPath(); x.arc(cx, cy, r, 0, 7); x.clip(); x.fillStyle = "rgba(60,150,80,.7)"; for (let i = 0; i < 7; i++) { x.beginPath(); x.ellipse(cx + (rnd(i) - 0.5) * r * 1.2 + t * 6 % 30, cy + (rnd(i + 5) - 0.5) * r * 1.1, r * (0.1 + rnd(i + 2) * 0.16), r * (0.06 + rnd(i + 8) * 0.1), rnd(i) * 3, 0, 7); x.fill(); } x.restore();
  x.strokeStyle = "rgba(160,220,255,.5)"; x.lineWidth = 2; x.beginPath(); x.ellipse(cx, cy, r * 1.3, r * 0.28, -0.35, 0, 7); x.stroke(); for (let i = 0; i < 3; i++) { const a = t * 0.5 + i * 2.1; const sx = cx + Math.cos(a) * r * 1.3, sy = cy + Math.sin(a) * r * 0.28; const rx = sx * Math.cos(-0.35) - (sy - cy) * Math.sin(-0.35) * 0; x.fillStyle = "#e8f4ff"; x.fillRect(sx - 3, cy + (sy - cy) - 2 + (sx - cx) * -0.35 * 0.2, 6, 4); void rx; }
}
function sceneFactory(x: Cx, W: number, H: number, u: number, t: number, eye: string) {
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#05080f"); g.addColorStop(1, "#101a28"); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = "#0a1220"; for (let i = 0; i < 9; i++) x.fillRect(W * (i / 8) - 8, 0, 16, H * 0.8);
  x.globalCompositeOperation = "lighter"; for (let i = 0; i < 4; i++) { const sx = W * (0.15 + i * 0.23), c = x.createLinearGradient(sx, 0, sx, H); c.addColorStop(0, "rgba(120,200,255,.28)"); c.addColorStop(1, "rgba(120,200,255,0)"); x.fillStyle = c; x.beginPath(); x.moveTo(sx - 6, 0); x.lineTo(sx + 6, 0); x.lineTo(sx + 90, H * 0.9); x.lineTo(sx - 90, H * 0.9); x.closePath(); x.fill(); } x.globalCompositeOperation = "source-over";
  x.fillStyle = "#162338"; x.fillRect(0, H * 0.82, W, H * 0.18); x.fillStyle = "#223a58"; for (let i = 0; i < 30; i++) x.fillRect(((i * 60 - t * 40) % (W + 60) + W + 60) % (W + 60) - 30, H * 0.82, 30, 4);
  const n = 8; for (let i = 0; i < n; i++) { const lit = Math.max(0, Math.min(1, (u * (n + 2) - i))); const px = W * (0.1 + i * 0.11) + (0.5 - u) * 40; robot(x, px, H * 0.8, H / 330, "#2b3a52", eye, lit, Math.sin(t * 3 + i) * 0.3 * (1 - lit)); if (lit > 0 && lit < 1) { x.globalCompositeOperation = "lighter"; x.fillStyle = "rgba(255,220,140,.9)"; for (let k = 0; k < 4; k++) x.fillRect(px + (rnd(i * 7 + k + Math.floor(t * 20)) - 0.5) * 30, H * 0.8 - H * 0.12 + (rnd(k + i + Math.floor(t * 20)) - 0.5) * 30, 2, 2); x.globalCompositeOperation = "source-over"; } }
}
function sceneLaunch(x: Cx, W: number, H: number, u: number, t: number, glow: string) {
  space(x, W, H, t, 14, "120,120,255");
  x.globalCompositeOperation = "lighter"; x.lineWidth = 1.4; for (let i = 0; i < 60; i++) { const y = rnd(i) * H, sp = 400 + rnd(i + 3) * 900, xx = ((rnd(i + 8) * W * 2 - t * sp) % (W * 1.4) + W * 1.4) % (W * 1.4) - W * 0.2; x.strokeStyle = `rgba(160,200,255,${0.1 + rnd(i + 7) * 0.4})`; x.beginPath(); x.moveTo(xx, y); x.lineTo(xx + 40 + rnd(i) * 80, y); x.stroke(); } x.globalCompositeOperation = "source-over";
  capital(x, W * (0.2 + u * 0.42), H * 0.34, H / 520, -0.06, glow, t);   // the flagship, with its escort
  for (let i = 0; i < 5; i++) { const px = W * (0.12 + i * 0.15 + u * 0.55), py = H * (0.55 + 0.07 * i + Math.sin(t + i) * 0.02); ship(x, px, py, H / 300 * (0.7 + i * 0.1), -0.1, glow); }
  const fl = x.createRadialGradient(W * 0.9, H * 0.12, 0, W * 0.9, H * 0.12, H * 0.5); fl.addColorStop(0, "rgba(255,240,200,.45)"); fl.addColorStop(1, "rgba(255,240,200,0)"); x.globalCompositeOperation = "lighter"; x.fillStyle = fl; x.fillRect(0, 0, W, H); x.globalCompositeOperation = "source-over";
}
function sceneApproach(x: Cx, W: number, H: number, u: number, t: number, P: any) {
  const c = hexRgb(P.c[2]); space(x, W, H, t, 3, P.glow); const r = H * (0.06 + 0.4 * (1 - Math.pow(1 - u, 2))), cx = W * 0.62, cy = H * 0.5;
  sphere(x, cx, cy, r, c, P.glow, -40, P.id === "jovia" ? 14 : P.id === "helios" ? 0 : 0, false, t);
  if (P.id === "helios") { x.globalCompositeOperation = "lighter"; const s = x.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2.2); s.addColorStop(0, "rgba(255,240,180,.9)"); s.addColorStop(0.3, "rgba(255,170,60,.4)"); s.addColorStop(1, "rgba(255,120,30,0)"); x.fillStyle = s; x.beginPath(); x.arc(cx, cy, r * 2.2, 0, 7); x.fill(); x.globalCompositeOperation = "source-over"; }
  x.setLineDash([6, 8]); x.strokeStyle = rgba(P.acc, 0.7); x.lineWidth = 1.5; x.beginPath(); x.ellipse(cx, cy, r * 1.7, r * 0.5, -0.3, 0, 7); x.stroke(); x.setLineDash([]);
  const a = t * 1.1; ship(x, cx + Math.cos(a) * r * 1.7 * Math.cos(-0.3) - Math.sin(a) * r * 0.5 * Math.sin(-0.3), cy + Math.cos(a) * r * 1.7 * Math.sin(-0.3) + Math.sin(a) * r * 0.5 * Math.cos(-0.3), H / 400, a + 1.6, P.glow);
  x.strokeStyle = rgba(P.acc, 0.8); x.lineWidth = 2; const sw = (t * 0.6 % 1) * r * 2; x.beginPath(); x.moveTo(cx - r, cy - r + sw); x.lineTo(cx + r, cy - r + sw); x.globalAlpha = 0.5; x.stroke(); x.globalAlpha = 1;
}
function sceneSurface(x: Cx, W: number, H: number, u: number, t: number, P: any, type: string, eye: string, quiet = false) {
  const hz = H * 0.62; const g = x.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, P.c[0]); g.addColorStop(0.7, P.c[1]); g.addColorStop(1, P.c[2]); x.fillStyle = g; x.fillRect(0, 0, W, hz);
  for (const s of STARS) if (s.y < 0.5) { x.fillStyle = `rgba(255,255,255,${0.2 * s.z})`; x.fillRect(s.x * W, s.y * H, 1.2, 1.2); }
  const pan = (u - 0.5) * 60;
  if (type === "sun") { const cx = W * 0.6 - pan * 0.4, cy = hz * 0.75; x.globalCompositeOperation = "lighter"; const s = x.createRadialGradient(cx, cy, 0, cx, cy, H * 0.8); s.addColorStop(0, "rgba(255,250,210,1)"); s.addColorStop(0.18, "rgba(255,200,90,.85)"); s.addColorStop(0.5, "rgba(255,120,40,.3)"); s.addColorStop(1, "rgba(255,80,20,0)"); x.fillStyle = s; x.fillRect(0, 0, W, hz + 30); for (let i = 0; i < 14; i++) { const a = i / 14 * 6.28 + t * 0.2, l = H * (0.45 + 0.2 * Math.sin(t * 2 + i)); x.strokeStyle = "rgba(255,220,140,.35)"; x.lineWidth = 3; x.beginPath(); x.moveTo(cx + Math.cos(a) * H * 0.2, cy + Math.sin(a) * H * 0.2); x.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); x.stroke(); } x.globalCompositeOperation = "source-over"; }
  if (type === "gas") { sphere(x, W * 0.7 - pan, hz * 0.55, H * 0.55, hexRgb(P.c[2]), P.glow, -30, 16, false, t); }
  x.fillStyle = "rgba(0,0,0,.55)";
  if (type === "jungle") for (let i = 0; i < 9; i++) { const px = ((i / 9 * W * 1.2 + pan * (0.5 + i * 0.05)) % (W * 1.2)), hh = H * (0.12 + rnd(i) * 0.16); x.fillStyle = "#04120f"; x.fillRect(px - 4, hz - hh, 8, hh); x.fillStyle = rgba(P.glow, 0.45 + 0.2 * Math.sin(t * 2 + i)); x.beginPath(); x.ellipse(px, hz - hh, hh * 0.55, hh * 0.22, 0, Math.PI, 0); x.fill(); }
  if (type === "desert") { x.fillStyle = "#1a0d05"; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(-50 + i * W / 3 + pan, hz); x.quadraticCurveTo(W / 6 + i * W / 3 + pan, hz - H * 0.18, W / 3 + i * W / 3 + 50 + pan, hz); x.fill(); } for (let i = 0; i < 5; i++) { x.fillStyle = "#2b1608"; x.fillRect(W * (0.1 + i * 0.2) + pan, hz - H * (0.12 + rnd(i) * 0.1), 10, H * 0.25); } }
  if (type === "ice") for (let i = 0; i < 12; i++) { const px = W * (i / 11) + pan * (0.4 + rnd(i)), hh = H * (0.1 + rnd(i + 4) * 0.28); x.fillStyle = rgba(P.glow, 0.5); x.beginPath(); x.moveTo(px - hh * 0.15, hz); x.lineTo(px, hz - hh); x.lineTo(px + hh * 0.15, hz); x.fill(); x.fillStyle = "rgba(255,255,255,.35)"; x.beginPath(); x.moveTo(px, hz - hh); x.lineTo(px + hh * 0.15, hz); x.lineTo(px + hh * 0.04, hz); x.fill(); }
  if (type === "lava") { x.fillStyle = "#1a0605"; for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(W * (i / 4) - 80 + pan, hz); x.lineTo(W * (i / 4) + pan, hz - H * (0.12 + rnd(i) * 0.2)); x.lineTo(W * (i / 4) + 80 + pan, hz); x.fill(); } x.globalCompositeOperation = "lighter"; x.strokeStyle = "rgba(255,120,40,.9)"; x.lineWidth = 4; x.beginPath(); x.moveTo(0, hz + 10); for (let i = 0; i <= 20; i++) x.lineTo(W * i / 20, hz + 10 + Math.sin(i + t * 2) * 5); x.stroke(); x.globalCompositeOperation = "source-over"; }
  if (type === "wreck") for (let i = 0; i < 14; i++) { const px = W * (i / 13) + pan * 0.5, hh = H * (0.1 + rnd(i) * 0.3); x.fillStyle = "#0b0716"; x.fillRect(px - 16, hz - hh, 32, hh); x.fillRect(px - 5, hz - hh - 12, 10, 12 + rnd(i + 3) * 18); x.globalCompositeOperation = "lighter"; x.fillStyle = rgba(P.glow, 0.5 * (0.5 + 0.5 * Math.sin(t * 5 + i * 3))); x.fillRect(px - 8, hz - hh + 10, 4, 3); x.globalCompositeOperation = "source-over"; }
  if (type === "belt") { for (let i = 0; i < 16; i++) { const px = ((rnd(i) * W * 1.3 - t * (8 + rnd(i + 3) * 20) + pan) % (W * 1.3) + W * 1.3) % (W * 1.3) - W * 0.15, py = H * (0.1 + rnd(i + 6) * 0.55), rr = H * (0.02 + rnd(i + 9) * 0.07); x.fillStyle = "#1c2a3c"; x.beginPath(); for (let k = 0; k < 7; k++) { const a = k / 7 * 6.28 + t * 0.3, d = rr * (0.8 + rnd(k + i) * 0.4); k ? x.lineTo(px + Math.cos(a) * d, py + Math.sin(a) * d) : x.moveTo(px + Math.cos(a) * d, py + Math.sin(a) * d); } x.fill(); x.globalCompositeOperation = "lighter"; x.fillStyle = rgba(P.glow, 0.5 + 0.5 * Math.sin(t * 4 + i)); x.fillRect(px + rr * 0.2, py - rr * 0.1, 3, 3); x.globalCompositeOperation = "source-over"; } }
  if (type === "orbit") { x.fillRect(0, hz, W, H - hz); for (let i = 0; i < 9; i++) { const px = (((rnd(i + 70) * W * 1.4 - t * (90 + rnd(i) * 140) * (i % 2 ? 1 : -1)) % (W * 1.4)) + W * 1.4) % (W * 1.4) - W * 0.2, py = hz * (0.15 + rnd(i + 5) * 0.8), dir = i % 2 ? 1 : -1; x.fillStyle = i % 3 ? "#0a0a16" : "#2a1038"; x.beginPath(); x.moveTo(px + 16 * dir, py); x.lineTo(px - 12 * dir, py - 8); x.lineTo(px - 12 * dir, py + 8); x.closePath(); x.fill(); x.globalCompositeOperation = "lighter"; x.fillStyle = i % 3 ? "rgba(130,200,255,.7)" : "rgba(255,90,120,.8)"; x.fillRect(px - 12 * dir - (dir > 0 ? 30 : 0), py - 1, 30, 2); x.globalCompositeOperation = "source-over"; } }
  if (type === "strike") { for (let i = 0; i < 6; i++) { const px = W * (0.1 + i * 0.16); x.fillStyle = "#0b0b08"; x.fillRect(px - 20, hz - 22, 40, 22); x.fillRect(px - 5, hz - 44, 10, 22); x.globalCompositeOperation = "lighter"; x.fillStyle = "rgba(255,90,60,.9)"; x.fillRect(px - 2, hz - 40, 4, 4); x.globalCompositeOperation = "source-over"; }
    for (let i = 0; i < 3; i++) { const k = Math.max(0, Math.min(1, (u - 0.1 * i) * 1.3)), px = W * (0.22 + i * 0.28), py = -20 + k * (hz + 10); x.globalCompositeOperation = "lighter"; const tr = x.createLinearGradient(px, py - 140, px, py); tr.addColorStop(0, "rgba(255,160,60,0)"); tr.addColorStop(1, "rgba(255,200,100,.9)"); x.fillStyle = tr; x.fillRect(px - 3, py - 140, 6, 140); x.globalCompositeOperation = "source-over"; x.fillStyle = "#e8edf3"; x.fillRect(px - 5, py - 4, 10, 16);
      if (k >= 1) { const bt = (u - 0.1 * i - 0.77) * 2; if (bt > 0 && bt < 1) { x.globalCompositeOperation = "lighter"; const b = x.createRadialGradient(px, hz, 0, px, hz, H * 0.5 * bt); b.addColorStop(0, "rgba(255,255,255,.95)"); b.addColorStop(0.3, "rgba(255,190,70,.7)"); b.addColorStop(1, "rgba(255,70,20,0)"); x.fillStyle = b; x.fillRect(0, 0, W, hz + 40); x.globalCompositeOperation = "source-over"; } } } }
  x.fillStyle = "#04060a"; x.fillRect(0, hz, W, H - hz); const gg = x.createLinearGradient(0, hz, 0, hz + 18); gg.addColorStop(0, rgba(P.glow, 0.35)); gg.addColorStop(1, rgba(P.glow, 0)); x.fillStyle = gg; x.fillRect(0, hz, W, 18);
  for (let i = 0; i < (quiet ? 0 : 5); i++) { const ex = W * (0.45 + i * 0.1) + Math.sin(t * 0.7 + i) * 8, on = Math.sin(t * 1.3 + i * 2) > -0.4; if (on) { x.globalCompositeOperation = "lighter"; x.fillStyle = rgba(P.acc, 0.9); x.fillRect(ex, hz - 6 - rnd(i) * 20, 3, 3); x.fillRect(ex + 7, hz - 6 - rnd(i) * 20, 3, 3); x.globalCompositeOperation = "source-over"; } }
  if (!quiet) { const hk = Math.floor(rnd(String(P.id).length * 7 + P.id.charCodeAt(0)) * 6); for (let i = 0; i < 7; i++) { const ax = W * (0.36 + i * 0.09) + Math.sin(t * 0.6 + i) * 6 + pan * 0.5, k = (hk + i) % 6; alien(x, ax, k === 1 ? hz - H * 0.02 : hz + H * 0.04 + (i % 2) * H * 0.03, H / 260 * (0.55 + rnd(i + 31) * 0.5), k, P.acc, t + i); } }   // the horde: six body plans in a mix that depends on the world
  if (!quiet) robot(x, W * 0.14 - pan, hz + H * 0.07, H / 300, "#0a1320", eye, 1, 0.2); x.globalCompositeOperation = "lighter"; for (let i = 0; i < 24; i++) { const a = ((rnd(i) * W - t * (20 + rnd(i + 3) * 40)) % W + W) % W; x.fillStyle = rgba(P.glow, 0.25); x.fillRect(a, hz * (0.3 + rnd(i + 5) * 0.9), 2, 2); } x.globalCompositeOperation = "source-over";
}
/* ── the new story scenes (owner, 2026-10-12): the Harvesters, TIGA's hunger, the Kindred, fusion/fission, dark matter ── */
/** a Harvester: a colossal ring-and-spoke machine feeding on a star, with a thread of plasma drawn off its surface; a tiny human fleet in the corner shows the scale */
function sceneHarvest(x: Cx, W: number, H: number, u: number, t: number, P: any, variant = 0) {
  space(x, W, H, t, 0.4, "120,160,255");
  const sx = W * (0.7 - 0.04 * u), sy = H * 0.44, sr = H * 0.13;
  x.globalCompositeOperation = "lighter";
  const halo = x.createRadialGradient(sx, sy, sr * 0.3, sx, sy, sr * 4); halo.addColorStop(0, "rgba(255,236,190,.95)"); halo.addColorStop(0.2, "rgba(255,170,80,.45)"); halo.addColorStop(1, "rgba(255,120,40,0)"); x.fillStyle = halo; x.fillRect(0, 0, W, H);
  const core = x.createRadialGradient(sx, sy, 0, sx, sy, sr); core.addColorStop(0, "#fffbe8"); core.addColorStop(0.7, "#ffc66a"); core.addColorStop(1, "#ff7a2a"); x.fillStyle = core; x.beginPath(); x.arc(sx, sy, sr, 0, 7); x.fill();
  x.globalCompositeOperation = "source-over";
  // the Harvester rings, tilted, slowly turning; dark armour with a lit inner edge and radial spars
  x.save(); x.translate(sx, sy); x.rotate(-0.45); const spin = t * 0.12 + variant;
  for (let k = 0; k < 4; k++) {
    const R = H * (0.3 + k * 0.075), sq = 0.26 + k * 0.01;
    x.strokeStyle = "rgba(8,12,22,.97)"; x.lineWidth = H * (0.03 - k * 0.004); x.beginPath(); x.ellipse(0, 0, R, R * sq, 0, 0, 7); x.stroke();
    x.strokeStyle = "rgba(150,225,255,.75)"; x.lineWidth = Math.max(1.2, H * 0.0026); x.beginPath(); x.ellipse(0, 0, R * 0.985, R * sq * 0.985, 0, 0, 7); x.stroke();
    for (let i = 0; i < 18; i++) { const a = spin * (k % 2 ? -1 : 1) + i / 18 * Math.PI * 2, px = Math.cos(a) * R, py = Math.sin(a) * R * sq; if (Math.sin(a) < 0 && k < 2) continue;
      x.fillStyle = "rgba(14,20,34,.98)"; x.fillRect(px - 6, py - 4, 12, 8); x.fillStyle = i % 3 ? "rgba(120,210,255,.9)" : "rgba(255,120,90,.95)"; x.fillRect(px - 1.5, py - 1.5, 3, 3); }
  }
  x.restore();
  // plasma drawn off the star into the machine
  x.globalCompositeOperation = "lighter";
  for (let i = 0; i < 46; i++) { const p = ((t * 0.28 + i / 46) % 1), a = -0.45 + (i % 7) * 0.9 + 0.3, rr = sr * (1 + p * 2.4), px = sx + Math.cos(a) * rr, py = sy + Math.sin(a) * rr * 0.55; x.fillStyle = `rgba(255,${190 - p * 80 | 0},${90 - p * 40 | 0},${0.8 * (1 - p)})`; x.beginPath(); x.arc(px, py, 2 + (1 - p) * 3, 0, 7); x.fill(); }
  x.globalCompositeOperation = "source-over";
  // two far-off Harvesters, tiny rings against the dark
  for (const [fx, fy, fs] of [[0.16, 0.2, 0.28], [0.3, 0.12, 0.18]] as number[][]) { x.save(); x.translate(W * fx, H * fy); x.rotate(-0.45); x.strokeStyle = "rgba(150,220,255,.5)"; x.lineWidth = 1.4; for (let k = 0; k < 3; k++) { x.beginPath(); x.ellipse(0, 0, H * fs * (0.5 + k * 0.2), H * fs * (0.5 + k * 0.2) * 0.27, 0, 0, 7); x.stroke(); } x.restore(); }
  // the human fleet, very small, in the lower left
  capital(x, W * (0.1 + u * 0.05), H * 0.52, H / 1500, -0.05, P.glow || "120,200,255", t);
  for (let i = 0; i < 4; i++) ship(x, W * (0.2 + i * 0.045 + u * 0.05), H * (0.47 + Math.sin(t + i) * 0.006 + (i % 2) * 0.02), H / 1100, -0.05, P.glow || "120,200,255");
  // a scanning sweep that finds us
  const sw = ((t * 0.4) % 1); x.globalCompositeOperation = "lighter"; x.strokeStyle = `rgba(255,120,90,${0.6 * (1 - sw)})`; x.lineWidth = 2; x.beginPath(); x.arc(sx, sy, H * (0.2 + sw * 1.1), Math.PI * 0.55, Math.PI * 1.2); x.stroke(); x.globalCompositeOperation = "source-over";
}
/** TIGA: a server hall in perspective, racks with lit rows, a pulsing neural core, and an energy-demand gauge that climbs past a single star */
function sceneAI(x: Cx, W: number, H: number, u: number, t: number, P: any) {
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#02030c"); g.addColorStop(1, "#061226"); x.fillStyle = g; x.fillRect(0, 0, W, H);
  const vx = W * 0.5, vy = H * 0.46;
  // racks on both sides, receding to the vanishing point
  for (let side = -1; side <= 1; side += 2) for (let i = 0; i < 12; i++) { const z = ((i + (t * 0.5) % 1) / 12), sc = Math.pow(z, 1.8), w = W * 0.2 * (1 - sc) + 8, xx = vx + side * (W * (0.08 + 0.42 * (1 - z)) ), top = vy - H * 0.38 * (1 - z) - 4, bot = vy + H * 0.36 * (1 - z) + 4;
    x.fillStyle = `rgba(8,14,28,${0.55 + 0.4 * (1 - z)})`; x.fillRect(side > 0 ? xx : xx - w, top, w, bot - top); x.globalCompositeOperation = "lighter";
    for (let k = 0; k < 14; k++) { const lit = rnd(i * 31 + k + side * 7 + Math.floor(t * 3 + k)) > 0.45; x.fillStyle = lit ? `rgba(${k % 4 ? "90,200,255" : "255,170,90"},${0.8 * (1 - z)})` : "rgba(0,0,0,0)"; x.fillRect((side > 0 ? xx : xx - w) + 4, top + (bot - top) * (k + 0.5) / 14, w - 8, Math.max(1.2, (bot - top) * 0.012)); }
    x.globalCompositeOperation = "source-over"; }
  // the core: a sphere of light with a network drawn on it
  const cr = H * (0.17 + 0.012 * Math.sin(t * 2)); x.globalCompositeOperation = "lighter";
  const gl = x.createRadialGradient(vx, vy, 0, vx, vy, cr * 3); gl.addColorStop(0, "rgba(160,225,255,.9)"); gl.addColorStop(0.3, "rgba(70,150,255,.4)"); gl.addColorStop(1, "rgba(40,90,255,0)"); x.fillStyle = gl; x.beginPath(); x.arc(vx, vy, cr * 3, 0, 7); x.fill();
  const nodes: number[][] = []; for (let i = 0; i < 26; i++) { const a = rnd(i) * 6.28 + t * 0.15, d = Math.sqrt(rnd(i + 50)) * cr; nodes.push([vx + Math.cos(a) * d, vy + Math.sin(a) * d * 0.9]); }
  x.strokeStyle = "rgba(200,240,255,.55)"; x.lineWidth = 1; for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) { const dx = nodes[i][0] - nodes[j][0], dy = nodes[i][1] - nodes[j][1]; if (dx * dx + dy * dy < cr * cr * 0.55) { x.beginPath(); x.moveTo(nodes[i][0], nodes[i][1]); x.lineTo(nodes[j][0], nodes[j][1]); x.stroke(); } }
  x.fillStyle = "#fff"; for (const n of nodes) { x.beginPath(); x.arc(n[0], n[1], 2.2, 0, 7); x.fill(); }
  x.globalCompositeOperation = "source-over";
  // the demand gauge: "1 STAR" is a short mark, the bar runs far past it and turns red
  const gx = W * 0.6, gy = H * 0.24, gw = W * 0.33, gh = H * 0.035, fill = Math.min(1, 0.25 + u * 0.9 + 0.04 * Math.sin(t * 5));
  x.fillStyle = "rgba(0,0,0,.6)"; x.fillRect(gx - 4, gy - 22, gw + 8, gh + 44); x.strokeStyle = "rgba(140,210,255,.6)"; x.strokeRect(gx, gy, gw, gh);
  const bg = x.createLinearGradient(gx, 0, gx + gw, 0); bg.addColorStop(0, "#3fd0ff"); bg.addColorStop(0.35, "#ffd23f"); bg.addColorStop(1, "#ff4d4d"); x.fillStyle = bg; x.fillRect(gx, gy, gw * fill, gh);
  x.fillStyle = "#fff"; x.fillRect(gx + gw * 0.18, gy - 6, 2, gh + 12); x.font = Math.round(H / 34) + "px monospace"; x.fillText("1 STAR", gx + gw * 0.18 - 20, gy - 10); x.fillStyle = fill > 0.7 ? "#ff6b6b" : "#9fe8ff"; x.fillText("TIGA POWER DEMAND " + Math.round(fill * 1200) + "%", gx, gy + gh + 22);
}
/** the Kindred: a human flagship and an elegant organic vessel, a bridge of light between them with glyphs passing both ways */
function sceneFriend(x: Cx, W: number, H: number, u: number, t: number, P: any) {
  space(x, W, H, t, 0.6, "120,200,200");
  const gy = H * 0.5; capital(x, W * 0.12, gy, H / 520, 0.0, "120,200,255", t);
  // the Kindred vessel: a long curved hull, teal and gold, with trailing fins
  const vx = W * 0.62, vy = gy; x.save(); x.translate(vx, vy); x.scale(H / 400, H / 400);
  x.globalCompositeOperation = "lighter"; const aura = x.createRadialGradient(0, 0, 10, 0, 0, 220); aura.addColorStop(0, "rgba(120,255,220,.35)"); aura.addColorStop(1, "rgba(120,255,220,0)"); x.fillStyle = aura; x.beginPath(); x.arc(0, 0, 220, 0, 7); x.fill(); x.globalCompositeOperation = "source-over";
  const hull = x.createLinearGradient(0, -40, 0, 40); hull.addColorStop(0, "#d8fff1"); hull.addColorStop(0.5, "#46c7b0"); hull.addColorStop(1, "#1a5f66"); x.fillStyle = hull;
  x.beginPath(); x.moveTo(-170, 0); x.bezierCurveTo(-110, -52, 60, -56, 170, -4); x.bezierCurveTo(70, 32, -90, 48, -170, 0); x.fill();
  x.strokeStyle = "rgba(255,226,150,.9)"; x.lineWidth = 2.4; x.beginPath(); x.moveTo(-150, -4); x.bezierCurveTo(-60, -28, 60, -30, 150, -6); x.stroke();
  for (let k = 0; k < 3; k++) { x.fillStyle = "rgba(70,190,170,.8)"; x.beginPath(); x.moveTo(-120 + k * 20, 20 + k * 6); x.quadraticCurveTo(-190 - k * 30, 70 + k * 20 + Math.sin(t * 2 + k) * 6, -230 - k * 36, 50 + k * 24); x.quadraticCurveTo(-170, 40, -110 + k * 20, 26); x.fill(); }
  x.globalCompositeOperation = "lighter"; for (let k = 0; k < 7; k++) { x.fillStyle = "rgba(255,230,160,.9)"; x.beginPath(); x.arc(-100 + k * 36, -10 + Math.sin(k) * 4, 3, 0, 7); x.fill(); } x.globalCompositeOperation = "source-over";
  x.restore();
  // the bridge of light and the glyphs crossing it
  const x0 = W * 0.12 + H * 0.4, x1 = vx - H * 0.4; x.globalCompositeOperation = "lighter"; const br = x.createLinearGradient(x0, 0, x1, 0); br.addColorStop(0, "rgba(120,200,255,.0)"); br.addColorStop(0.5, "rgba(200,255,240,.9)"); br.addColorStop(1, "rgba(120,255,220,0)"); x.fillStyle = br; x.fillRect(x0, gy - 3, x1 - x0, 6);
  for (let i = 0; i < 9; i++) { const p = ((t * 0.3 + i / 9) % 1), dir = i % 2 ? 1 : -1, px = dir > 0 ? x0 + (x1 - x0) * p : x1 - (x1 - x0) * p; x.strokeStyle = `rgba(255,255,255,${0.9 * Math.sin(p * 3.14)})`; x.lineWidth = 1.5; x.strokeRect(px - 6, gy - 22 - (i % 3) * 12, 12, 12); x.beginPath(); x.moveTo(px - 3, gy - 16 - (i % 3) * 12); x.lineTo(px + 3, gy - 16 - (i % 3) * 12); x.stroke(); }
  x.globalCompositeOperation = "source-over";
}
/** a fusion/fission reactor: a torus of plasma inside containment coils, with sparks of heat */
function sceneReactor(x: Cx, W: number, H: number, u: number, t: number, P: any) {
  const g = x.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, H); g.addColorStop(0, "#1a0c08"); g.addColorStop(1, "#04050c"); x.fillStyle = g; x.fillRect(0, 0, W, H);
  const cx = W * 0.5, cy = H * 0.5, R = H * 0.3;
  // containment coils (dark rings with lit edges), then the plasma ring between them
  for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2 + t * 0.05, px = cx + Math.cos(a) * R, py = cy + Math.sin(a) * R * 0.42; x.save(); x.translate(px, py); x.rotate(a + Math.PI / 2); x.fillStyle = "#101826"; x.fillRect(-H * 0.034, -H * 0.075, H * 0.068, H * 0.15); x.strokeStyle = "rgba(255,170,90,.6)"; x.strokeRect(-H * 0.034, -H * 0.075, H * 0.068, H * 0.15); x.restore(); }
  x.globalCompositeOperation = "lighter";
  for (let k = 0; k < 4; k++) { x.strokeStyle = `rgba(255,${150 + k * 25},${60 + k * 40},${0.5 - k * 0.08})`; x.lineWidth = H * (0.05 - k * 0.011); x.beginPath(); x.ellipse(cx, cy, R, R * 0.42, 0, 0, 7); x.stroke(); }
  for (let i = 0; i < 70; i++) { const a = i / 70 * 6.28 + t * (0.8 + rnd(i) * 0.6), rr = R * (0.94 + rnd(i + 3) * 0.12); x.fillStyle = `rgba(255,${200 + rnd(i) * 55 | 0},160,.85)`; x.beginPath(); x.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.42, 1.5 + rnd(i + 8) * 2, 0, 7); x.fill(); }
  const hot = x.createRadialGradient(cx, cy, 0, cx, cy, R * 0.55); hot.addColorStop(0, `rgba(255,240,200,${0.35 + 0.1 * Math.sin(t * 6)})`); hot.addColorStop(1, "rgba(255,120,40,0)"); x.fillStyle = hot; x.beginPath(); x.arc(cx, cy, R * 0.55, 0, 7); x.fill();
  x.globalCompositeOperation = "source-over";
  // the readout: output climbing to "ONE STAR"
  x.fillStyle = "rgba(255,200,140,.85)"; x.font = Math.round(H / 30) + "px monospace"; x.fillText("OUTPUT " + (Math.round(u * 940 + 60)) + " TW", W * 0.62, H * 0.24); x.fillStyle = "rgba(255,255,255,.5)"; x.fillRect(W * 0.62, H * 0.26, W * 0.3 * Math.min(1, 0.1 + u), 5);
}
/** dark matter: a black core bending the starfield, with a violet lensing ring and filaments of the unseen */
function sceneDark(x: Cx, W: number, H: number, u: number, t: number, P: any) {
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#04010c"); g.addColorStop(1, "#0a0418"); x.fillStyle = g; x.fillRect(0, 0, W, H);
  const cx = W * 0.5, cy = H * 0.5, r = H * (0.12 + 0.01 * Math.sin(t * 1.5));
  // stars bent around the core: each is pushed outward along the radius by 1/d
  x.fillStyle = "#fff"; for (let i = 0; i < 220; i++) { const sx = rnd(i) * W, sy = rnd(i + 300) * H, dx = sx - cx, dy = sy - cy, d = Math.hypot(dx, dy) + 1, k = 1 + (r * r * 5) / (d * d); x.globalAlpha = 0.25 + 0.6 * rnd(i + 9); x.fillRect(cx + dx * k, cy + dy * k, 1.6, 1.6); } x.globalAlpha = 1;
  x.globalCompositeOperation = "lighter";
  for (let k = 0; k < 4; k++) { x.strokeStyle = `rgba(${150 - k * 20},${90 + k * 15},255,${0.55 - k * 0.1})`; x.lineWidth = 4 - k; x.beginPath(); x.ellipse(cx, cy, r * (1.5 + k * 0.45), r * (1.5 + k * 0.45) * 0.34, -0.35 + k * 0.05, 0, 7); x.stroke(); }
  for (let i = 0; i < 14; i++) { const a = i / 14 * 6.28 + t * 0.2, len = H * (0.25 + 0.2 * rnd(i)); x.strokeStyle = `rgba(150,100,255,${0.25 + 0.2 * rnd(i + 5)})`; x.lineWidth = 1.4; x.beginPath(); x.moveTo(cx + Math.cos(a) * r * 1.4, cy + Math.sin(a) * r * 1.4); x.quadraticCurveTo(cx + Math.cos(a + 0.7) * len * 0.7, cy + Math.sin(a + 0.7) * len * 0.7, cx + Math.cos(a + 1.4) * len, cy + Math.sin(a + 1.4) * len); x.stroke(); }
  x.globalCompositeOperation = "source-over";
  x.fillStyle = "#000"; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); x.strokeStyle = "rgba(190,150,255,.9)"; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke();
  x.fillStyle = "rgba(200,170,255,.85)"; x.font = Math.round(H / 30) + "px monospace"; x.fillText("DARK MATTER DENSITY " + (Math.round(30 + u * 70)) + "%  ·  NOT YET HARNESSED", W * 0.5 - H * 0.55, H * 0.24);
}
function sceneBoss(x: Cx, W: number, H: number, u: number, t: number, P: any) {
  const g = x.createRadialGradient(W / 2, H * 0.5, H * 0.1, W / 2, H * 0.5, H); g.addColorStop(0, "#3a0a10"); g.addColorStop(1, "#050205"); x.fillStyle = g; x.fillRect(0, 0, W, H);
  const cx = W / 2, cy = H * 0.52, s = H * (0.34 + u * 0.06); x.fillStyle = "#08040a"; x.beginPath(); x.moveTo(cx - s * 1.3, cy + s * 0.9); x.quadraticCurveTo(cx - s * 1.2, cy - s * 0.9, cx, cy - s * 0.95); x.quadraticCurveTo(cx + s * 1.2, cy - s * 0.9, cx + s * 1.3, cy + s * 0.9); x.closePath(); x.fill();
  x.fillStyle = "#12060c"; for (let i = 0; i < 7; i++) { x.beginPath(); x.moveTo(cx - s * 1.0 + i * s * 0.33, cy - s * 0.7); x.lineTo(cx - s * 0.9 + i * s * 0.33, cy - s * (1.25 + 0.2 * Math.abs(3 - i) * -1 + 0.25)); x.lineTo(cx - s * 0.75 + i * s * 0.33, cy - s * 0.7); x.fill(); }
  alien(x, cx, cy + s * 0.62, s / 85, (String(P.id).charCodeAt(0) + String(P.id).length) % 6, "255,70,90", t);   // the guardian itself, a different body plan per world
  const p = 0.6 + 0.4 * Math.sin(t * 6); x.globalCompositeOperation = "lighter"; const e = x.createRadialGradient(cx, cy - s * 0.1, 0, cx, cy - s * 0.1, s * 0.5); e.addColorStop(0, "rgba(255,255,255,.95)"); e.addColorStop(0.2, rgba("255,60,80", 0.9 * p)); e.addColorStop(1, "rgba(255,40,60,0)"); x.fillStyle = e; x.beginPath(); x.arc(cx, cy - s * 0.1, s * 0.5, 0, 7); x.fill();
  x.fillStyle = rgba(P.glow, 0.5); x.fillRect(cx - s * 0.7, cy + s * 0.25, s * 1.4, s * 0.05); x.globalCompositeOperation = "source-over";
  if (Math.sin(t * 7) > 0) { x.fillStyle = "rgba(255,40,60,.12)"; x.fillRect(0, 0, W, H); } x.fillStyle = "rgba(255,70,90,.95)"; x.font = `900 ${Math.round(H * 0.07)}px system-ui,sans-serif`; x.textAlign = "center"; if (Math.sin(t * 7) > -0.3) x.fillText("⚠ WARNING ⚠", W / 2, H * 0.14);
}
function sceneObjective(x: Cx, W: number, H: number, t: number, P: any) {
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#04060e"); g.addColorStop(1, P.c[0]); x.fillStyle = g; x.fillRect(0, 0, W, H); space(x, W, H, t, 1, P.glow);
  x.globalCompositeOperation = "lighter"; for (let i = 0; i < 4; i++) { const r = H * (0.25 + ((t * 0.25 + i * 0.25) % 1) * 0.6); x.strokeStyle = rgba(P.glow, 0.35 * (1 - ((t * 0.25 + i * 0.25) % 1))); x.lineWidth = 2; x.beginPath(); x.arc(W * 0.27, H * 0.55, r, 0, 7); x.stroke(); } x.globalCompositeOperation = "source-over";
}

/* ── longer films with more variety (owner, 2026-10-12: 5-10 shots a map, mood and story, and no aliens in a shot about gathering resources) ──
   Three kinds of map get three kinds of film: "fight" (landing, the crew, the horde, an alarm, the guardian), "work" (a survey from orbit, the landing,
   the harvest itself, a storm, a message home, a dawn: nothing here is an alien) and "ship" (a survey, the cockpit, the sector, radar, a message home). */
const catOf = (P: any): "fight" | "work" | "ship" => {
  const m = P && P.mission;
  if (["dogfight", "launch", "belt", "skim", "harvest", "evade", "solar", "warp", "blackhole"].includes(m)) return "ship";
  if (["mine", "dyson", "farm", "yard", "colony", "build", "ranch", "capture", "survival"].includes(m)) return "work";
  return "fight";
};
const RES: Record<string, L3> = {
  mine: ["แร่", "ore", "矿石"], yard: ["ชิ้นส่วนของยาน", "ship sections", "舰体模块"], dyson: ["ชิ้นส่วนโครงสร้าง", "structural parts", "结构部件"], farm: ["อาหาร", "food", "粮食"], capture: ["พลังงานจากดาวฤกษ์", "stellar energy", "恒星能量"],
  survival: ["พลังงานจากบรรยากาศ", "atmospheric energy", "大气能量"], belt: ["แร่และน้ำแข็ง", "ore and ice", "矿与冰"], skim: ["แก๊สพลังงานสูง", "high-energy gas", "高能气体"],
  harvest: ["พลังงานจากดาว", "star energy", "星能"], solar: ["แสงอาทิตย์", "sunlight", "阳光"], colony: ["วัสดุก่อสร้างและน้ำแข็ง", "building materials and ice", "建材和冰"], build: ["ชิ้นส่วนก่อสร้าง", "construction parts", "建造部件"], ranch: ["อาหาร", "food", "粮食"],
};
const resOf = (P: any): L3 => RES[P && P.mission] || ["ทรัพยากร", "resources", "资源"];
const NEWCAP: Record<string, Record<string, L3>> = {
  survey: {
    work: ["สแกนพื้นผิว {n} — พบ{r}ปริมาณมหาศาล พอหล่อเลี้ยงอาณานิคมไปอีกหลายปี", "Scanning {n}: {r} in huge quantities, enough to sustain the colony for years.", "扫描{n}：发现大量{r}，足以支撑殖民地数年。"],
    ship: ["เซ็นเซอร์ยานกวาดรอบ {n} — เส้นทางเปิดอยู่ แต่ไม่มีอะไรรับประกันความปลอดภัย", "Ship sensors sweep around {n}: the route is open, but nothing promises it is safe.", "飞船传感器扫过{n}周边：航线畅通，但无人保证安全。"],
  },
  descent: { all: ["ยานดิ่งเข้าชั้นบรรยากาศ ความร้อนแผดเผาโล่กำบัง — ทุกคนเกาะให้มั่น", "The lander plunges into the atmosphere, heat searing the shield. Hold on.", "着陆器冲入大气层，热浪灼烧着护盾。抓紧了。"] },
  landing: { all: ["ขาลงจอดแตะพื้น ฝุ่นฟุ้งตลบ — หุ่นนักบุกเบิกก้าวลงสู่ {n} เป็นครั้งแรก", "Touchdown. Dust billows as the pioneers take their first steps on {n}.", "着陆。尘埃翻涌，先驱者们踏上了{n}的第一步。"] },
  crew: {
    fight: ["ตรวจระบบครั้งสุดท้าย ดวงตาสว่างขึ้น — พวกเขาแบกความหวังของคนนับพันล้านที่รออยู่บนโลก", "Final systems check. The eyes light up: they carry the hopes of billions waiting at home.", "最后一次系统检查，双眼亮起——他们承载着家乡数十亿人的希望。"],
    work: ["หุ่นนักบุกเบิกตรวจเครื่องมือทีละชิ้น — งานนี้ไม่มีเสียงปืน มีแต่ฝีมือและความอดทน", "The pioneers check their tools one by one. This job has no gunfire, only craft and patience.", "先驱者逐一检查工具——这份工作没有枪声，只有手艺与耐心。"],
    ship: ["นักบินนั่งประจำที่ ระบบยานตื่นขึ้น — ข้างหน้ามีแต่ความมืดและสิ่งที่ยังไม่รู้", "The pilot takes the seat and the ship wakes. Ahead lies only darkness and the unknown.", "飞行员就位，飞船苏醒——前方只有黑暗与未知。"],
  },
  work: { all: ["{r}ไหลเข้าสายพานไม่ขาดสาย เครื่องจักรเดินเป็นจังหวะเดียวกับหัวใจของผู้คนบนโลก", "{r} streams onto the belts without a pause, the machines keeping the rhythm of the heartbeat back home.", "{r}源源不断涌上传送带，机器的节奏就像地球上人们的心跳。"] },
  storm: { all: ["พายุกำลังมา — แต่{r}นี้คือเส้นเลือดของอาณานิคม เราจะไม่ถอย", "A storm is rolling in. But this {r} is the colony's lifeline, and we will not retreat.", "风暴正在逼近——但这些{r}是殖民地的命脉，我们不会后退。"] },
  signal: { all: ["ส่งสัญญาณกลับโลก: ถึงแล้ว ทุกอย่างปลอดภัย — คำตอบจะมาถึงในอีกหลายนาที", "A message goes home: we have arrived and all is well. The reply will take minutes to come.", "向地球发回消息：已安全抵达。回信要等好几分钟。"] },
  warning: {
    fight: ["สัญญาณเตือนดังขึ้น — มีบางอย่างเคลื่อนไหวในความมืด และมันกำลังมุ่งมาทางเรา", "Alarms ring. Something is moving in the dark, and it is coming this way.", "警报响起——黑暗中有东西在移动，正朝这里逼近。"],
    ship: ["เรดาร์กะพริบแดง — ยานไม่ทราบฝ่ายเต็มจอ พลาดไม่ได้แม้แต่จังหวะเดียว", "Radar flashes red: unknown contacts fill the screen. Not a single slip is allowed.", "雷达闪起红光——屏幕上出现多个不明目标，一步也不能错。"],
  },
  dawn: { all: ["ดวงอาทิตย์ดวงใหม่ขึ้นเหนือขอบฟ้า — ความหวังของมนุษยชาติเริ่มต้นที่นี่", "A new sun rises over the horizon. Humanity's hope begins here.", "新的太阳从地平线升起——人类的希望从这里开始。"] },
};
function sceneSurvey(x: Cx, W: number, H: number, u: number, t: number, P: any) {
  space(x, W, H, t, 1.2, P.glow);
  const cx = W * 0.64, cy = H * 0.52, r = H * (0.34 + 0.05 * u);
  sphere(x, cx, cy, r, hexRgb(P.c[2]), P.glow, -40, P.mission === "skim" || P.id === "jovia" ? 12 : 0, false, t);
  x.save(); x.beginPath(); x.arc(cx, cy, r, 0, 7); x.clip(); x.strokeStyle = rgba(P.acc, 0.35); x.lineWidth = 1;
  for (let k = -3; k <= 3; k++) { const q = 1 - (k * 0.25) * (k * 0.25); x.beginPath(); x.ellipse(cx, cy + k * r * 0.25, r * Math.sqrt(Math.max(0, q)), r * 0.08, 0, 0, 7); x.stroke(); }
  for (let k = 0; k < 5; k++) { x.beginPath(); x.ellipse(cx, cy, Math.max(1, r * Math.abs(Math.cos(k / 5 * Math.PI + t * 0.15))), r, 0, 0, 7); x.stroke(); }
  const sw = ((t * 0.5) % 1) * r * 2; x.globalCompositeOperation = "lighter"; const sg = x.createLinearGradient(0, cy - r + sw - 30, 0, cy - r + sw + 4); sg.addColorStop(0, rgba(P.acc, 0)); sg.addColorStop(1, rgba(P.acc, 0.6)); x.fillStyle = sg; x.fillRect(cx - r, cy - r + sw - 30, r * 2, 34);
  x.restore();
  x.globalCompositeOperation = "lighter";
  for (let i = 0; i < 9; i++) { const a = rnd(i + 40) * 6.28, d = Math.sqrt(rnd(i + 50)) * r * 0.85, px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d, k = Math.max(0, Math.min(1, u * 1.4 - i * 0.09)); if (k <= 0) continue; const pr = 5 + 4 * Math.sin(t * 4 + i); x.strokeStyle = rgba(P.acc, 0.9 * k); x.lineWidth = 1.6; x.strokeRect(px - pr, py - pr, pr * 2, pr * 2); x.fillStyle = rgba(P.acc, 0.8 * k); x.fillRect(px - 2, py - 2, 4, 4); x.beginPath(); x.moveTo(px + pr, py - pr); x.lineTo(px + pr + 26, py - pr - 18); x.stroke(); }
  x.globalCompositeOperation = "source-over";
  const px0 = W * 0.07, py0 = H * 0.26, bw = W * 0.24;   // the readout: bars that fill as the scan completes
  for (let i = 0; i < 5; i++) { const y = py0 + i * H * 0.085, f = Math.min(1, Math.max(0, u * 1.3 - i * 0.12)) * (0.45 + 0.5 * rnd(i + 70)); x.fillStyle = "rgba(10,24,40,.7)"; x.fillRect(px0, y, bw, H * 0.03); x.fillStyle = rgba(P.acc, 0.85); x.fillRect(px0, y, bw * f, H * 0.03); x.fillStyle = "rgba(220,240,255,.8)"; x.fillRect(px0, y - H * 0.012, bw * 0.3 * (0.4 + rnd(i)), 2); }
  const a = t * 0.9 + 1; ship(x, cx + Math.cos(a) * r * 1.5, cy + Math.sin(a) * r * 0.45, H / 420, a + 1.6, P.glow);
}
function sceneDescent(x: Cx, W: number, H: number, u: number, t: number, P: any) {
  x.save(); x.translate(Math.sin(t * 31) * 2.2 * (1 - u * 0.6), Math.cos(t * 27) * 2.2 * (1 - u * 0.6));
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#02030a"); g.addColorStop(Math.max(0.05, 1 - u * 0.9), P.c[1]); g.addColorStop(1, P.c[2]); x.fillStyle = g; x.fillRect(-10, -10, W + 20, H + 20);
  for (const s of STARS) { x.fillStyle = `rgba(255,255,255,${0.5 * (1 - u) * s.z})`; x.fillRect(s.x * W, s.y * H, 1.3, 1.3); }
  x.fillStyle = "rgba(255,255,255,.08)";
  for (let i = 0; i < 14; i++) { const sp = 220 + rnd(i) * 400, py = ((rnd(i + 5) * H * 1.4 - t * sp * (0.4 + u)) % (H * 1.4) + H * 1.4) % (H * 1.4) - H * 0.2, w = W * (0.3 + rnd(i + 9) * 0.5); x.beginPath(); x.ellipse(rnd(i + 2) * W, py, w, 8 + rnd(i + 3) * 16, 0, 0, 7); x.fill(); }
  const hy = H * (1.05 - u * 0.5); x.fillStyle = P.c[0]; x.beginPath(); x.ellipse(W * 0.5, hy + H * 2.2, W * 2.4, H * 2.2, 0, 0, 7); x.fill();
  const sx = W * 0.5, sy = H * 0.4 + u * H * 0.04;
  x.globalCompositeOperation = "lighter";
  for (let i = 0; i < 5; i++) { const fl = 0.7 + 0.3 * Math.sin(t * 24 + i * 2), pl = x.createRadialGradient(sx, sy + 20, 0, sx, sy + 20, H * (0.16 + i * 0.05) * fl * (1.2 - u * 0.5)); pl.addColorStop(0, `rgba(255,${230 - i * 30},${180 - i * 40},${0.5 - i * 0.07})`); pl.addColorStop(1, "rgba(255,80,20,0)"); x.fillStyle = pl; x.fillRect(sx - H, sy - H * 0.4, H * 2, H * 1.2); }
  x.globalCompositeOperation = "source-over"; rocketShape(x, sx, sy, H / 340, 0.5 + 0.5 * (1 - u));
  x.restore();
}
function sceneLanding(x: Cx, W: number, H: number, u: number, t: number, P: any, type: string, eye: string) {
  sceneSurface(x, W, H, u * 0.3, t, P, type, eye, true);
  const hz = H * 0.62, gy = hz + H * 0.07, lx = W * 0.5, k = Math.min(1, u / 0.62), ly = -H * 0.25 + (gy - 6 + H * 0.25) * (1 - Math.pow(1 - k, 2));
  rocketShape(x, lx, ly, H / 340, k < 1 ? 0.9 * (1 - k * 0.6) : 0);
  if (u > 0.58) { const d = (u - 0.58) / 0.42; x.globalCompositeOperation = "lighter"; for (let i = 0; i < 14; i++) { const sd = i % 2 ? 1 : -1, dx = sd * (20 + d * W * 0.32 * (0.4 + rnd(i) * 0.6)), dy = -d * H * 0.05 * rnd(i + 3); x.fillStyle = rgba(P.acc, 0.16 * (1 - d)); x.beginPath(); x.ellipse(lx + dx, gy + dy, 30 + d * 50, 10 + d * 14, 0, 0, 7); x.fill(); } x.globalCompositeOperation = "source-over"; }
  for (let i = 0; i < 3; i++) { const kk = Math.max(0, Math.min(1, (u - 0.72 - i * 0.07) * 6)); if (kk > 0) robot(x, lx + (60 + i * 70) * kk + 20, gy + i * H * 0.01, H / 430, "#0a1320", eye, 1, 0.2 * Math.sin(t * 4 + i)); }
}
function sceneCrew(x: Cx, W: number, H: number, u: number, t: number, P: any, eye: string) {
  const g = x.createRadialGradient(W * 0.65, H * 0.4, 0, W * 0.65, H * 0.4, H); g.addColorStop(0, rgba(P.glow, 0.35)); g.addColorStop(1, "#02040a"); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.save(); x.beginPath(); x.ellipse(W * 0.76, H * 0.5, W * 0.17, H * 0.3, 0, 0, 7); x.clip(); space(x, W, H, t, 0.6, P.glow); sphere(x, W * 0.8, H * 0.66, H * 0.36, hexRgb(P.c[2]), P.glow, -50, 0, false, t); x.restore();
  x.strokeStyle = "rgba(150,200,230,.55)"; x.lineWidth = 4; x.beginPath(); x.ellipse(W * 0.76, H * 0.5, W * 0.17, H * 0.3, 0, 0, 7); x.stroke();
  robot(x, W * (0.34 - 0.03 * u), H * 1.04, H / 150 * (1 + 0.05 * u), "#0a1320", eye, 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(t * 2)), 0);
  x.globalCompositeOperation = "lighter"; const key = x.createLinearGradient(W, 0, W * 0.3, 0); key.addColorStop(0, rgba(P.acc, 0.22)); key.addColorStop(1, rgba(P.acc, 0)); x.fillStyle = key; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 26; i++) { const px = ((rnd(i) * W + t * 6 * (0.3 + rnd(i + 4))) % W), py = ((rnd(i + 8) * H - t * 10 * rnd(i + 3)) % H + H) % H; x.fillStyle = rgba(P.acc, 0.2 + 0.2 * rnd(i + 2)); x.fillRect(px, py, 2, 2); }
  x.globalCompositeOperation = "source-over";
}
function sceneWork(x: Cx, W: number, H: number, u: number, t: number, P: any, type: string, eye: string) {
  sceneSurface(x, W, H, u, t, P, type, eye, true);
  const hz = H * 0.62, gy = hz + H * 0.07, m = P.mission;
  x.globalCompositeOperation = "source-over";
  if (m === "mine") {
    const tx = W * 0.58, bob = Math.abs(Math.sin(t * 4)) * H * 0.05; x.fillStyle = "#0c1219"; poly(x, [[tx - 40, gy], [tx - 14, gy - H * 0.36], [tx + 14, gy - H * 0.36], [tx + 40, gy]]); x.fill(); x.strokeStyle = rgba(P.acc, 0.6); x.lineWidth = 2; x.beginPath(); x.moveTo(tx - 26, gy - H * 0.1); x.lineTo(tx + 26, gy - H * 0.2); x.moveTo(tx + 26, gy - H * 0.1); x.lineTo(tx - 26, gy - H * 0.2); x.stroke();
    x.fillStyle = "#3a4656"; x.fillRect(tx - 6, gy - H * 0.3 + bob, 12, H * 0.3); x.fillStyle = "#c8d2e0"; poly(x, [[tx - 9, gy - H * 0.01 + bob], [tx + 9, gy - H * 0.01 + bob], [tx, gy + H * 0.04 + bob]]); x.fill();
    x.globalCompositeOperation = "lighter"; for (let i = 0; i < 8; i++) { const a = rnd(i + Math.floor(t * 6)) * 3.14, d = 10 + rnd(i + 9) * 40; x.fillStyle = rgba(P.acc, 0.7); x.fillRect(tx + Math.cos(a) * d * 1.6, gy + Math.sin(a) * -d * 0.7, 2.4, 2.4); } x.globalCompositeOperation = "source-over";
    x.fillStyle = "#10161e"; x.fillRect(tx + 40, gy - 10, W * 0.3, 8); for (let i = 0; i < 5; i++) { const cxp = tx + 60 + ((t * 70 + i * W * 0.06) % (W * 0.28)); x.fillStyle = rgba(P.glow, 0.9); poly(x, [[cxp, gy - 10], [cxp + 10, gy - 10], [cxp + 7, gy - 20], [cxp + 2, gy - 18]]); x.fill(); }
  } else if (m === "dyson") {
    for (let i = 0; i < 3; i++) { const fx = W * (0.4 + i * 0.17), k = Math.max(0, Math.min(1, u * 3 - i * 0.7)); x.strokeStyle = "#7a8aa8"; x.lineWidth = 4; x.beginPath(); x.moveTo(fx - 46, gy); x.lineTo(fx - 30, gy - H * 0.3); x.lineTo(fx + 30, gy - H * 0.3); x.lineTo(fx + 46, gy); x.stroke(); x.fillStyle = `rgba(255,210,80,${0.15 + 0.7 * k})`; poly(x, [[fx - 30, gy - H * 0.3 + 4], [fx + 30, gy - H * 0.3 + 4], [fx + 40, gy - H * 0.3 + 4 + H * 0.25 * k], [fx - 40, gy - H * 0.3 + 4 + H * 0.25 * k]]); x.fill(); if (k > 0 && k < 1) { x.globalCompositeOperation = "lighter"; x.fillStyle = "rgba(255,240,180,.9)"; x.fillRect(fx - 40 + Math.random() * 80, gy - H * 0.3 + H * 0.25 * k, 3, 3); x.globalCompositeOperation = "source-over"; } }
  } else if (m === "farm") {
    for (let r = 0; r < 3; r++) { const by = gy - H * (0.05 + r * 0.11); x.fillStyle = "#0b1a14"; x.fillRect(W * 0.34, by, W * 0.5, H * 0.03); x.globalCompositeOperation = "lighter"; const lg = x.createLinearGradient(0, by - H * 0.1, 0, by); lg.addColorStop(0, "rgba(190,80,255,0)"); lg.addColorStop(1, "rgba(190,80,255,.35)"); x.fillStyle = lg; x.fillRect(W * 0.34, by - H * 0.1, W * 0.5, H * 0.1); x.globalCompositeOperation = "source-over"; for (let i = 0; i < 40; i++) { const px = W * 0.35 + i * W * 0.0122, sw = Math.sin(t * 2 + i + r) * 2; x.strokeStyle = `rgb(${60 + (i % 3) * 20},${170 + (i % 4) * 15},90)`; x.lineWidth = 2; x.beginPath(); x.moveTo(px, by); x.lineTo(px + sw, by - H * (0.02 + 0.05 * Math.min(1, u * 1.5 + rnd(i) * 0.3))); x.stroke(); } }
  } else {
    const tx = W * 0.62; x.fillStyle = "#0c1219"; poly(x, [[tx - 22, gy], [tx - 7, gy - H * 0.3], [tx + 7, gy - H * 0.3], [tx + 22, gy]]); x.fill();
    x.globalCompositeOperation = "lighter"; const bm = x.createLinearGradient(tx, gy - H * 0.3, tx, 0); bm.addColorStop(0, rgba(P.glow, 0.85)); bm.addColorStop(1, rgba(P.glow, 0)); x.fillStyle = bm; x.fillRect(tx - 7, 0, 14, gy - H * 0.3);
    for (let i = 0; i < 5; i++) { const ky = (((t * 0.5 + i / 5) % 1)); x.strokeStyle = rgba(P.acc, 0.6 * (1 - ky)); x.lineWidth = 2; x.beginPath(); x.ellipse(tx, gy - H * 0.3 - ky * H * 0.45, 24 + ky * 24, 6, 0, 0, 7); x.stroke(); }
    x.globalCompositeOperation = "source-over";
  }
  for (let i = 0; i < 2; i++) robot(x, W * (0.16 + i * 0.09), gy + i * H * 0.012, H / 400, "#0a1320", eye, 1, 0.5 * Math.sin(t * 5 + i * 2));
}
function sceneStorm(x: Cx, W: number, H: number, u: number, t: number, P: any, type: string, eye: string) {
  sceneSurface(x, W, H, u, t, P, type, eye, true); const hz = H * 0.62, gy = hz + H * 0.07;
  x.fillStyle = "rgba(0,0,0,.38)"; x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = "lighter"; x.lineWidth = 1.4; for (let i = 0; i < 110; i++) { const sp = 700 + rnd(i) * 900, px = ((rnd(i + 3) * W * 1.5 - t * sp) % (W * 1.5) + W * 1.5) % (W * 1.5) - W * 0.2, py = rnd(i + 9) * H; x.strokeStyle = rgba(P.acc, 0.1 + rnd(i + 5) * 0.25); x.beginPath(); x.moveTo(px, py); x.lineTo(px - 60 - rnd(i) * 60, py + 14); x.stroke(); }
  if (Math.sin(t * 3.1) > 0.94) { x.fillStyle = "rgba(220,235,255,.22)"; x.fillRect(0, 0, W, H); x.strokeStyle = "rgba(230,240,255,.9)"; x.lineWidth = 2.4; let bx = W * (0.3 + rnd(Math.floor(t * 3.1)) * 0.5), by = 0; x.beginPath(); x.moveTo(bx, by); while (by < hz) { by += H * 0.06; bx += (rnd(Math.floor(by) + 7) - 0.5) * 50; x.lineTo(bx, by); } x.stroke(); }
  x.globalCompositeOperation = "source-over"; x.save(); x.translate(W * 0.24, gy); x.rotate(-0.1 + Math.sin(t * 6) * 0.015); robot(x, 0, 0, H / 340, "#0a1320", eye, 1, 0.1); x.restore();
  const hg = x.createLinearGradient(0, hz - H * 0.1, 0, H); hg.addColorStop(0, rgba(P.acc, 0)); hg.addColorStop(1, rgba(P.acc, 0.18)); x.fillStyle = hg; x.fillRect(0, hz - H * 0.1, W, H);
}
function sceneSignal(x: Cx, W: number, H: number, u: number, t: number, P: any, eye: string) {
  space(x, W, H, t, 0.5, P.glow);
  const ex = W * 0.2, ey = H * 0.28; sphere(x, ex, ey, H * 0.13, "40,110,200", "110,190,255", -40, 0, true, t);
  const gy = H * 0.8; x.fillStyle = "#04060a"; x.beginPath(); x.moveTo(0, H); x.lineTo(0, gy); for (let i = 0; i <= 24; i++) x.lineTo(W * i / 24, gy - Math.sin(i * 0.9) * H * 0.03 - rnd(i) * H * 0.02); x.lineTo(W, H); x.closePath(); x.fill();
  const dx = W * 0.66, dy = gy - H * 0.02; x.strokeStyle = "#1a2433"; x.lineWidth = 5; x.beginPath(); x.moveTo(dx, dy); x.lineTo(dx, dy - H * 0.14); x.stroke();
  const ang = Math.atan2(ey - (dy - H * 0.16), ex - dx); x.save(); x.translate(dx, dy - H * 0.16); x.rotate(ang + Math.PI); x.fillStyle = "#26344a"; x.beginPath(); x.ellipse(0, 0, H * 0.025, H * 0.09, 0, 0, 7); x.fill(); x.restore();
  x.globalCompositeOperation = "lighter"; x.fillStyle = Math.sin(t * 4) > 0 ? "rgba(255,90,90,.95)" : "rgba(255,90,90,.2)"; x.fillRect(dx - 2, dy - H * 0.15, 4, 4);
  const sx0 = dx, sy0 = dy - H * 0.16, cxp = (sx0 + ex) / 2, cyp = Math.min(sy0, ey) - H * 0.2;
  const at = (p: number) => ({ px: (1 - p) * (1 - p) * sx0 + 2 * (1 - p) * p * cxp + p * p * ex, py: (1 - p) * (1 - p) * sy0 + 2 * (1 - p) * p * cyp + p * p * ey });
  x.setLineDash([3, 9]); x.strokeStyle = rgba(P.acc, 0.35); x.lineWidth = 1.4; x.beginPath(); x.moveTo(sx0, sy0); x.quadraticCurveTo(cxp, cyp, ex, ey); x.stroke(); x.setLineDash([]);
  for (let i = 0; i < 6; i++) { const p = (t * 0.3 + i / 6) % 1, q = at(p); x.fillStyle = rgba(P.acc, 0.9 * Math.sin(p * 3.14)); x.beginPath(); x.arc(q.px, q.py, 4, 0, 7); x.fill(); }
  if (u > 0.6) { for (let i = 0; i < 3; i++) { const p = 1 - ((t * 0.3 + i / 3) % 1), q = at(p); x.fillStyle = "rgba(190,255,200,.9)"; x.beginPath(); x.arc(q.px, q.py, 5, 0, 7); x.fill(); } const rr = ((u - 0.6) * 3) % 1; x.strokeStyle = `rgba(190,255,200,${0.6 * (1 - rr)})`; x.lineWidth = 2; x.beginPath(); x.arc(ex, ey, H * 0.13 * (1 + rr * 0.8), 0, 7); x.stroke(); }
  x.globalCompositeOperation = "source-over"; robot(x, W * 0.52, gy + H * 0.06, H / 460, "#0a1320", eye, 1, 0.1);
}
function sceneWarning(x: Cx, W: number, H: number, u: number, t: number, P: any, cat: string) {
  x.fillStyle = "#04030a"; x.fillRect(0, 0, W, H); const pu = 0.5 + 0.5 * Math.sin(t * 5);
  x.globalCompositeOperation = "lighter"; const rg = x.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 1.0); rg.addColorStop(0, "rgba(255,40,60,0)"); rg.addColorStop(1, `rgba(255,40,60,${0.18 + 0.2 * pu})`); x.fillStyle = rg; x.fillRect(0, 0, W, H); x.globalCompositeOperation = "source-over";
  x.globalAlpha = 0.28; if (cat === "ship") capital(x, W * 0.5, H * 0.3, H / 280, 0, "255,80,100", t); else alien(x, W * 0.5, H * 1.0, H / 110 * (0.8 + 0.3 * u), String(P.id || "x").length % 6, "255,60,80", t); x.globalAlpha = 1;
  const cx = W * 0.5, cy = H * 0.52, r = H * 0.32; x.strokeStyle = "rgba(255,120,130,.5)"; x.lineWidth = 1.4; for (let i = 1; i <= 4; i++) { x.beginPath(); x.arc(cx, cy, r * i / 4, 0, 7); x.stroke(); } x.beginPath(); x.moveTo(cx - r, cy); x.lineTo(cx + r, cy); x.moveTo(cx, cy - r); x.lineTo(cx, cy + r); x.stroke();
  const sa = t * 2.2; x.globalCompositeOperation = "lighter"; for (let i = 0; i < 16; i++) { x.strokeStyle = `rgba(255,90,110,${0.5 * (1 - i / 16)})`; x.lineWidth = 3; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(sa - i * 0.05) * r, cy + Math.sin(sa - i * 0.05) * r); x.stroke(); }
  for (let i = 0; i < 8; i++) { const a = rnd(i + 12) * 6.28, d = r * (0.95 - 0.55 * u) * (0.5 + rnd(i + 21) * 0.5); let dd = ((sa - a) % 6.28 + 6.28) % 6.28; const f = Math.max(0, 1 - dd / 2.4); x.fillStyle = `rgba(255,70,90,${0.9 * f})`; x.fillRect(cx + Math.cos(a) * d - 3, cy + Math.sin(a) * d - 3, 6, 6); }
  x.globalCompositeOperation = "source-over"; for (const by of [H * 0.14, H * 0.82]) { x.save(); x.beginPath(); x.rect(0, by, W, 10); x.clip(); x.fillStyle = "#e8b020"; x.fillRect(0, by, W, 10); x.fillStyle = "#1a1005"; for (let i = -2; i < 40; i++) { poly(x, [[i * 36 - t * 20 % 36, by + 10], [i * 36 + 12 - t * 20 % 36, by + 10], [i * 36 + 24 - t * 20 % 36, by], [i * 36 + 12 - t * 20 % 36, by]]); x.fill(); } x.restore(); }
}
function sceneDawn(x: Cx, W: number, H: number, u: number, t: number, P: any, eye: string) {
  const hz = H * 0.66, sy = hz + H * 0.1 - u * H * 0.24, sx = W * 0.5;
  const g = x.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, "#0a1030"); g.addColorStop(0.6, rgba(P.glow, 0.35)); g.addColorStop(1, "rgb(255,170,90)"); x.fillStyle = g; x.fillRect(0, 0, W, hz + 2);
  for (const s of STARS) if (s.y < 0.45) { x.fillStyle = `rgba(255,255,255,${0.5 * (1 - u * 0.8) * s.z})`; x.fillRect(s.x * W, s.y * H, 1.3, 1.3); }
  x.globalCompositeOperation = "lighter"; const sg = x.createRadialGradient(sx, sy, 0, sx, sy, H * 0.9); sg.addColorStop(0, "rgba(255,245,210,.95)"); sg.addColorStop(0.15, "rgba(255,190,90,.55)"); sg.addColorStop(1, "rgba(255,120,40,0)"); x.fillStyle = sg; x.fillRect(0, 0, W, hz + 2);
  for (let i = 0; i < 12; i++) { const a = -Math.PI + (i + 0.5) / 12 * Math.PI + Math.sin(t * 0.3 + i) * 0.03; x.fillStyle = `rgba(255,220,150,${0.07 + 0.04 * Math.sin(t + i)})`; x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + Math.cos(a - 0.03) * H * 1.4, sy + Math.sin(a - 0.03) * H * 1.4); x.lineTo(sx + Math.cos(a + 0.03) * H * 1.4, sy + Math.sin(a + 0.03) * H * 1.4); x.closePath(); x.fill(); }
  x.fillStyle = "rgba(255,250,225,.95)"; x.beginPath(); x.arc(sx, sy, H * 0.06, 0, 7); x.fill(); x.globalCompositeOperation = "source-over";
  x.fillStyle = "#05070c"; x.beginPath(); x.moveTo(0, H); x.lineTo(0, hz); for (let i = 0; i <= 20; i++) x.lineTo(W * i / 20, hz - Math.sin(i * 0.8) * H * 0.02 - rnd(i + 30) * H * 0.02); x.lineTo(W, H); x.closePath(); x.fill();
  x.globalCompositeOperation = "lighter"; for (let i = 0; i < 18; i++) { x.fillStyle = `rgba(255,214,120,${0.4 + 0.4 * Math.sin(t * 2 + i)})`; x.fillRect(W * (0.6 + rnd(i) * 0.3), hz + H * 0.01 + rnd(i + 4) * H * 0.04, 2, 2); } x.globalCompositeOperation = "source-over";
  for (let i = 0; i < 4; i++) robot(x, W * (0.12 + i * 0.06), hz + H * (0.17 + (i % 2) * 0.025), H / 400, "#05070c", eye, 0.4, 0.05);
  const fx = W * 0.8; x.strokeStyle = "#0a0d14"; x.lineWidth = 4; x.beginPath(); x.moveTo(fx, hz + H * 0.2); x.lineTo(fx, hz - H * 0.15); x.stroke(); x.fillStyle = rgba(P.acc, 0.9); x.beginPath(); x.moveTo(fx, hz - H * 0.15); for (let i = 0; i <= 8; i++) x.lineTo(fx + i * 7, hz - H * 0.15 + Math.sin(t * 3 - i * 0.5) * 4 + i * 0.6); for (let i = 8; i >= 0; i--) x.lineTo(fx + i * 7, hz - H * 0.15 + H * 0.06 + Math.sin(t * 3 - i * 0.5) * 4 + i * 0.6); x.closePath(); x.fill();
}
export const AdventureCine = memo(function AdventureCine({ P, lang, me, colorway, onDone }: any) {
  const plan = useRef(cinePlan(P)).current; const total = plan.reduce((a, q) => a + q.dur, 0); const starts = useRef((() => { let a = 0; return plan.map(s => { const v = a; a += s.dur; return v; }); })()).current;
  const [needTap, setNeedTap] = useState(false), [vkick, setVkick] = useState(0); const audioRef = useRef<any>(null);   // a phone may start the sound muted until the first touch
  const [rot, setRot] = useState(false); useEffect(() => { const chk = () => setRot(window.innerHeight > window.innerWidth); const id = setTimeout(chk, 700); window.addEventListener("resize", chk); return () => { clearTimeout(id); window.removeEventListener("resize", chk); }; }, []);   // a phone that will not turn: the film is turned instead
  const cvRef = useRef<HTMLCanvasElement>(null); const [idx, setIdx] = useState(0); const idxRef = useRef(0); const t0 = useRef(performance.now()); const skipTo = useRef(0);
  const type = TYPE[P.id] || "jungle"; const eye = hexRgb(colorway && colorway.glow ? colorway.glow : "#7fe8ff"); const objIdx = plan.length - 1;
  const t = (th: string, en: string, zh: string) => T3(lang, th, en, zh);
  // Voice-over and subtitles (owner, 2026-10-12): both follow the player's language by default, and two buttons in the top-left corner change them on the fly.
  const readPref = (k: string) => { try { const v = localStorage.getItem(k); if (v === "th" || v === "en" || v === "zh" || v === "off") return v; } catch (e) {} return lang; };
  const [voice, setVoice] = useState<string>(() => readPref("tg_adv_vo")), [sub, setSub] = useState<string>(() => readPref("tg_adv_sub"));
  const ORDER = ["th", "en", "zh", "off"]; const flip = (cur: string) => ORDER[(ORDER.indexOf(cur) + 1) % ORDER.length];
  const sl = sub === "off" ? lang : sub;   // the other on-screen words (titles, goals) follow the subtitle language unless the subtitles are off
  useEffect(() => {
    const cv = cvRef.current; if (!cv) return undefined; const x = cv.getContext("2d"); if (!x) return undefined; let raf = 0;
    const fit = () => { const r = cv.getBoundingClientRect(), d = Math.min(1.5, window.devicePixelRatio || 1); cv.width = Math.max(320, Math.round(r.width * d)); cv.height = Math.max(180, Math.round(r.height * d)); }; fit(); window.addEventListener("resize", fit);
    const audio = createCineAudio(P.id, plan); audioRef.current = audio; const chk = setTimeout(() => { if (audio && !audio.running()) setNeedTap(true); }, 900);
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame); const el = (now - t0.current) / 1000 + skipTo.current; let i = 0; for (let k = 0; k < plan.length; k++) if (el >= starts[k]) i = k;
      if ((P.prologue || P.finale) && el >= total) { raf = 0; cancelAnimationFrame(raf); onDone(); return; }
      if (i !== idxRef.current) { idxRef.current = i; setIdx(i); }
      const W = cv.width, H = cv.height, s = plan[i], local = el - starts[i], u = Math.min(1, local / Math.max(0.1, s.dur));
      x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = "source-over"; x.fillStyle = "#000"; x.fillRect(0, 0, W, H);
      const k = (s as any).as || s.kind, vv = (s as any).v || 0, lt = local + vv * 2.3;
      x.save(); const zoom = vv % 2 ? 1.12 - 0.08 * u : 1 + 0.07 * u, pan = (vv % 3 === 1 ? -1 : vv % 3 === 2 ? 1 : 0) * W * 0.035 * (u - 0.5), tilt = vv === 3 ? 0.014 * Math.sin(u * 3) : 0; const en = cineEnergy(plan, i), shk = (CINE_ACTION.includes(k) && local < 0.6 ? (1 - local / 0.6) * W * 0.012 * en : en > 0.75 ? W * 0.0015 : 0); x.translate(W / 2 + pan + Math.sin(el * 91) * shk, H / 2 + Math.cos(el * 77) * shk); x.rotate(tilt); x.scale(zoom, zoom); x.translate(-W / 2, -H / 2);
      switch (k) {
        case "pad": scenePad(x, W, H, u, lt); break; case "liftoff": sceneLiftoff(x, W, H, u, lt); break; case "earthfade": sceneEarthFade(x, W, H, u, lt, P); break;
        case "earth": sceneEarth(x, W, H, u, lt); break; case "factory": sceneFactory(x, W, H, u, lt, eye); break; case "launch": sceneLaunch(x, W, H, u, lt, P.glow); break;
        case "contact": sceneHarvest(x, W, H, u, lt, P, 0); break; case "mind": sceneAI(x, W, H, u, lt, P); break;
        case "lore": { const th = (s as any).theme; if (th === "ai") sceneAI(x, W, H, u, lt, P); else if (th === "friend") sceneFriend(x, W, H, u, lt, P); else if (th === "reactor") sceneReactor(x, W, H, u, lt, P); else if (th === "dark") sceneDark(x, W, H, u, lt, P); else sceneHarvest(x, W, H, u, lt, P, 1.7); break; }
        case "approach": sceneApproach(x, W, H, u, lt, P); break; case "boss": sceneBoss(x, W, H, u, lt, P); break; case "objective": sceneObjective(x, W, H, lt, P); break;
        case "survey": sceneSurvey(x, W, H, u, lt, P); break; case "descent": sceneDescent(x, W, H, u, lt, P); break; case "landing": sceneLanding(x, W, H, u, lt, P, type, eye); break;
        case "howto": sceneCrew(x, W, H, u, lt, P, eye); drawHowto(x, W, H, lt); break;
        case "crew": sceneCrew(x, W, H, u, lt, P, eye); break; case "work": sceneWork(x, W, H, u, lt, P, type, eye); break; case "storm": sceneStorm(x, W, H, u, lt, P, type, eye); break;
        case "signal": sceneSignal(x, W, H, u, lt, P, eye); break; case "warning": sceneWarning(x, W, H, u, lt, P, catOf(P)); break; case "dawn": sceneDawn(x, W, H, u, lt, P, eye); break;
        default: sceneSurface(x, W, H, u, lt, P, type, eye);
      }
      x.restore();
      overlay(x, W, H, lt, (s as any).ov);
      hypeCut(x, W, H, local, s.kind);
      epicLook(x, W, H, el, k, P); punch(x, W, H, el, local, k, cineEnergy(plan, i)); bloom(x, W, H); realLook(x, W, H, el);
      const v = x.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.95); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.6)"); x.fillStyle = v; x.fillRect(0, 0, W, H);
      x.fillStyle = "rgba(255,255,255,.035)"; for (let k = 0; k < 220; k++) x.fillRect(Math.random() * W, Math.random() * H, 1.1, 1.1);   // film grain
      const bar = H * 0.13; x.fillStyle = "#000"; x.fillRect(0, 0, W, bar); x.fillRect(0, H - bar, W, bar);
      const fade = Math.max(0, 1 - local / 0.4, Math.min(1, (local - (s.dur - 0.3)) / 0.3) * (s.kind === "objective" ? 0 : 1)); if (fade > 0) { x.fillStyle = `rgba(0,0,0,${fade})`; x.fillRect(0, 0, W, H); }
    };
    raf = requestAnimationFrame(frame);
    (window as any).__advCine = { shot: () => idxRef.current, kinds: () => plan.map(s => s.kind), render: (id: string, mission: string, boss: boolean, max?: number) => renderCinePreview(id, cinePlan({ id, mission, boss: boss ? ["x", "x", "x"] : ["-", "-", "-"] }, false).slice(0, max || 99)), jump: (i: number) => { i = Math.max(0, Math.min(plan.length - 1, i | 0)); skipTo.current = starts[i] - (performance.now() - t0.current) / 1000 + 0.05; }, total: starts[objIdx] };
    return () => { clearTimeout(chk); cancelAnimationFrame(raf); window.removeEventListener("resize", fit); if (audio) audio.stop(); try { delete (window as any).__advCine; } catch (e) {} };
  }, []);
  const kind = plan[Math.min(idx, plan.length - 1)].kind, ek = (plan[Math.min(idx, plan.length - 1)] as any).as || kind, capFor = (lg: string) => captionFor(P.finale ? { ...P, __theme: (plan[Math.min(idx, plan.length - 1)] as any).theme } : P, kind, lg), cap = sub === "off" ? "" : capFor(sub), goals = GOAL[P.id] || GOAL.luma;
  const voText = (lg: string) => kind === "objective" ? T3(lg, "ภารกิจ: ", "Mission: ", "任务：") + T3(lg, P.th, P.en, P.zh).split(" · ")[0] + ". " + goals.map((g: any) => T3(lg, g[0], g[1], g[2])).join(". ") : capFor(lg);
  useEffect(() => {
    if (voice === "off") { stopSpeaking(); return undefined; }
    const txt = voText(voice); if (!txt) { stopSpeaking(); return undefined; }
    const rate = voice === "th" ? 1.4 : 1;   // owner 2026-10-15: Thai a fast 1.4x, English and Chinese at normal speed
    const id = setTimeout(() => { try { speakNarration(txt, voice, undefined, () => setNeedTap(true), 1, rate); } catch (e) {} }, 350);
    (window as any).__advVo = { lang: voice, text: txt, rate }; return () => clearTimeout(id);
  }, [idx, voice, vkick]);
  useEffect(() => () => { try { stopSpeaking(); } catch (e) {} }, []);
  const unlock = () => { const a = audioRef.current; if (a && !a.running()) { a.resume(); setTimeout(() => { if (a.running()) { setNeedTap(false); setVkick(k => k + 1); } }, 250); } else if (needTap) { setNeedTap(false); setVkick(k => k + 1); } };
  const next = () => { if (idxRef.current < objIdx) skipTo.current = starts[idxRef.current + 1] - (performance.now() - t0.current) / 1000 + 0.05; };
  return (
    <div className={"adv-cine" + (rot ? " rot" : "")} onPointerDown={(e) => { unlock(); if ((e.target as HTMLElement).closest("button")) return; next(); }}>
      <canvas ref={cvRef} />
      <div className="ac-lang">
        <button aria-label="voice language" data-vo={voice} onClick={() => setVoice(v => { const n = flip(v); try { localStorage.setItem("tg_adv_vo", n); } catch (e) {} return n; })}>🎙<b>{voice === "off" ? t("ปิด", "OFF", "关") : voice.toUpperCase()}</b></button>
        <button aria-label="subtitle language" data-sub={sub} onClick={() => setSub(v => { const n = flip(v); try { localStorage.setItem("tg_adv_sub", n); } catch (e) {} return n; })}>CC<b>{sub === "off" ? t("ปิด", "OFF", "关") : sub.toUpperCase()}</b></button>
      </div>
      {needTap && <button className="ac-snd" onClick={(e) => { e.stopPropagation(); unlock(); setNeedTap(false); }}>🔊 {t("แตะเพื่อเปิดเสียงและเพลง", "Tap to turn the sound on", "点一下开启声音与音乐")}</button>}
      <button className="ac-skip" onClick={() => { stopSpeaking(); onDone(); }} aria-label="skip">{t("ข้าม ⏭", "Skip ⏭", "跳过 ⏭")}</button>
      {kind === "approach" && <div key="ttl" className="ac-title"><small>{t("บทที่ ", "CHAPTER ", "第") + (CH.indexOf(P.id) + 1) + t("", "", "章") + " · " + t("ปลายทาง", "DESTINATION", "目的地")}</small><b>{T3(sl, P.th, P.en, P.zh).split(" · ")[0]}</b></div>}
      {(ek === "lore" || ek === "contact" || ek === "mind") && (plan[idx] as any).theme && <div key={"t" + idx} className="ac-tag" data-theme={(plan[idx] as any).theme}>{T3(lang, THEME_TAG[(plan[idx] as any).theme][0], THEME_TAG[(plan[idx] as any).theme][1], THEME_TAG[(plan[idx] as any).theme][2])}</div>}
      {cap && kind !== "objective" && <div key={"c" + idx} className={"ac-cap" + (ek === "lore" || ek === "contact" || ek === "mind" ? " low" : "")}>{cap}</div>}
      {kind === "objective" && (
        <div className="ac-obj">
          <div className="ac-hero"><CyberAvatar model={me} yaw={22} pose="ready" glow={colorway && colorway.glow} accent={colorway && colorway.accent} held={null} hat={null} acc={null} /></div>
          <div className="ac-goal"><small>{t("ภารกิจ", "MISSION", "任务")}</small><b>{T3(lang, P.th, P.en, P.zh).split(" · ")[0]}</b>
            <ul>{goals.map((g, i) => <li key={i} style={{ animationDelay: 0.25 * i + "s" }}>{T3(sl, g[0], g[1], g[2])}</li>)}</ul>
            <button className="adv-btn go" autoFocus onClick={() => onDone()}>▶ {t("เริ่มภารกิจ", "START MISSION", "开始任务")}</button></div>
        </div>)}
    </div>
  );
});
export { renderCinePreview };
export default AdventureCine;
