/* Adventure Mode cinematics (owner, 2026-10-11: "a film before every map, beautiful CG, telling the story and what the mission is,
   with music and sound effects, to make people want to play"). Drawn live on a canvas from code, so nothing is downloaded: Earth in
   2100, the factory that builds the pioneer robots, the fleet leaving, the approach to the planet, the surface (its own look per world),
   the guardian when there is one, and an objective card with the player's own robot. Subtitles in th/en/zh (there is no voice-over),
   an original score and sound effects from adventure-music.ts. Tap = next shot, Skip = straight into the map. */
import { useEffect, useRef, useState, memo } from "react";
import { CyberAvatar } from "./cyber-avatar";
import { createCineAudio, renderCinePreview, type CineShot } from "./adventure-music";
import { speakDeviceOrNative, stopSpeaking } from "./speech";

const T3 = (lang: string, th: string, en: string, zh: string) => (lang === "th" ? th : lang === "zh" ? zh : en);
const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

const COMMON = {
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
const LORE_THEME: Record<string, string> = { kindred: "friend", darkforge: "dark", shadow: "harvest", luma: "harvest", ferro: "ai", jovia: "reactor", kryo: "friend", pyra: "reactor", nexa: "harvest", cobalt: "ai", helios: "ai", dyson: "dark", ashfall: "harvest", voidgate: "harvest", asteroids: "friend", gasskim: "reactor", starharvest: "dark", solarcharge: "reactor", dysondock: "ai", gaspump: "reactor", warpjump: "harvest", blackhole: "dark" };
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
  solarcharge: ["แบตเตอรีของยานรั่วไหลตลอดเวลา ถ้าหมดกลางทางก็ไม่มีใครมารับเรา", "The ship's battery bleeds all the time. If it runs dry out here, nobody is coming for us.", "飞船电池一直在流失，如果在这里耗尽，没人会来接我们。"],
  dysondock: ["ไดสันสเฟียร์ต้องการพลังงานเติมไม่รู้จบ เราคือคนส่งของให้มัน", "The Dyson sphere never stops asking for power. We are the couriers who feed it.", "戴森球需要源源不断的能量，我们就是给它送能的信使。"],
  gaspump: ["ก๊าซจากดาวยักษ์คือเชื้อเพลิงของฟิวชัน ทุกถังที่สูบคือหนึ่งวันของ TIGA", "Gas from the giants fuels our fusion. Every tank we pump is one more day for TIGA.", "巨行星的气体是聚变燃料，每抽满一罐都是 TIGA 多一天的能量。"],
  warpjump: ["ฮาร์เวสเตอร์เห็นเราได้ทุกที่ในจักรวาลนี้ จึงต้องไปให้ไกลเกินสายตาพวกมัน", "The Harvesters see us everywhere in this universe, so we must go beyond their sight.", "收割者能在这个宇宙里看到我们，所以必须去它们看不到的地方。"],
  blackhole: ["ไม่มีใครเคยกลับมาจากหลุมดำ แต่ที่ขอบของมันมีประตูสู่จักรวาลอื่น", "No one has returned from a black hole, but at its edge lies a door to another universe.", "从来没人能从黑洞返回，但它的边缘有通往另一个宇宙的门。"],
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
  solarcharge: ["ยานอยู่ไกลจากโลก พลังงานเหลือน้อย ต้องหาแผงโซลาร์ที่ลอยอยู่แถวนี้", "Far from Earth with the battery low: solar panels drift through this sector.", "远离地球，电量不足：这片区域漂浮着太阳能板。"],
  dysondock: ["ไดสันสเฟียร์ที่ล้อมดาวฤกษ์ดวงนี้มีท่าจอดสำหรับส่งพลังงานเข้าโครงข่าย", "The Dyson sphere around this star has docking ports that feed power into the grid.", "这颗恒星外的戴森球有对接口，可把能量送入电网。"],
  gaspump: ["เมฆก๊าซของดาวยักษ์ดวงนี้หนาแน่น มีหัวสูบที่เรามาติดตั้งไว้สามจุด", "This giant's clouds are dense, and we have set three pump nozzles in them.", "这颗巨行星的云层浓密，我们在其中布置了三个抽取口。"],
  warpjump: ["เครื่องยนต์วาร์ปพร้อมแล้ว บินผ่านประตูวาร์ปให้ครบเพื่อเปิดทางข้ามจักรวาล", "The warp drive is ready: fly the warp gates in order to open the way across.", "曲速引擎就绪：依次穿过曲速门，打开跨越之路。"],
  blackhole: ["หลุมดำดึงทุกอย่างเข้าไป ยานต้องดิ้นสู้แรงโน้มถ่วงให้ได้ก่อนประตูจะเปิด", "The black hole drags everything in. Hold out against its pull until the door opens.", "黑洞会吞噬一切，在门打开之前要抵抗它的引力。"],
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
  solarcharge: ["เก็บแผงโซลาร์ให้ครบ ก่อนแบตเตอรีจะหมดและเครื่องยนต์ดับ", "Gather the solar panels before the battery drains and the engines die.", "在电量耗尽、引擎熄火之前收集足够的太阳能板。"],
  dysondock: ["ลอยเข้าวงแหวนท่าจอดทีละจุด ส่งพลังงานเข้าไดสันสเฟียร์ ระวังแสงแฟลร์ที่ผ่านมา", "Glide into each docking ring and feed the Dyson sphere, and watch for flares sweeping past.", "依次飞入对接环向戴森球送能，当心扫过的耀斑。"],
  gaspump: ["เข้าไปในวงแหวนหัวสูบทีละจุดจนถังเต็ม ใต้พายุที่ไม่เคยหยุด", "Hold in each pump ring until the tank fills, under storms that never rest.", "在每个抽取环内停留直到罐满，头顶是永不停歇的风暴。"],
  warpjump: ["บินทะลุประตูวาร์ปทั้งสามบาน ถ้าพลาดประตูจะเปิดใหม่ แล้วพุ่งเข้าพอร์ทัลสุดท้าย", "Fly through all three warp gates (a missed gate comes round again), then dive into the final portal.", "穿过三道曲速门（错过会再次出现），然后冲入最后的传送门。"],
  blackhole: ["ต้านแรงดึงให้นานพอ เก็บคริสตัลที่ขอบ เมื่อประตูสว่างให้พุ่งเข้าไปตรงกลาง", "Resist the pull, gather crystals at the rim, and when the door lights up, dive into the centre.", "抵抗引力，在边缘收集水晶，门亮起时冲向中心。"],
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
  solarcharge: [["เก็บแผงโซลาร์ให้ครบ 8 แผง", "Collect 8 solar panels", "收集 8 块太阳能板"], ["อย่าให้แบตเตอรีหมด", "Never let the battery run dry", "别让电池耗尽"], ["หลบอุกกาบาตและยานเอเลี่ยน", "Dodge rocks and alien ships", "躲开陨石和外星飞船"]],
  dysondock: [["ลอยเข้าวงแหวนท่าจอดให้ครบ 3 จุด", "Dock at all 3 rings", "在 3 个对接环完成对接"], ["หลบแสงแฟลร์ที่กวาดผ่าน", "Avoid the sweeping flares", "避开扫过的耀斑"], ["ส่งพลังงานเข้าไดสันสเฟียร์", "Feed the Dyson sphere", "向戴森球输送能量"]],
  gaspump: [["เข้าวงแหวนหัวสูบให้ครบ 3 จุด", "Fill at all 3 pump rings", "在 3 个抽取环完成抽取"], ["หลบพายุและฟ้าผ่า", "Avoid the storm bands", "避开风暴带"], ["เก็บถังก๊าซส่งกลับโลก", "Send the gas home", "把气体送回地球"]],
  warpjump: [["บินผ่านประตูวาร์ปทั้ง 3 บาน", "Fly through all 3 warp gates", "穿过全部 3 道曲速门"], ["หลบเศษซากในอวกาศวาร์ป", "Dodge the warp debris", "躲开曲速碎片"], ["พุ่งเข้าพอร์ทัลไปอีกกาแล็กซี", "Dive into the portal to another galaxy", "冲入传送门前往另一个星系"]],
  blackhole: [["ต้านแรงดึงของหลุมดำ", "Resist the black hole's pull", "抵抗黑洞的引力"], ["อย่าเข้าใกล้ขอบก่อนประตูเปิด", "Stay off the horizon until the door opens", "门开启前别靠近视界"], ["พุ่งเข้าตรงกลางเมื่อประตูสว่าง", "Dive into the centre when it lights up", "门亮起时冲向中心"]],
  departure: [["ยิงหรือหลบก้อนหินและเศษขยะ", "Shoot or dodge the rocks and debris", "击碎或躲开岩石与碎片"], ["รักษาตัวยานไว้จนถึงวงโคจร", "Keep the ship intact all the way to orbit", "保持飞船完好直至入轨"], ["เก็บคริสตัลที่ลอยมา", "Pick up the crystals that drift by", "收集漂浮的水晶"]],
  asteroids: [["ยิงหินให้แตกเป็นแร่", "Blast rocks into ore", "把岩石击碎成矿石"], ["เก็บแร่ให้ครบ 16 ก้อน", "Collect 16 ore", "收集 16 块矿石"], ["ระวังโจรอวกาศ", "Beware of space pirates", "小心太空海盗"]],
  dyson: [["ทุบหินหาแร่ด้วยปุ่ม ⛏", "Break rocks for ore with the ⛏ button", "用 ⛏ 按钮敲碎岩石获取矿石"], ["ประกอบแผงไดสัน 4 แผงที่โครงเหล็ก", "Bolt 4 Dyson panels onto the frames", "在框架上装配 4 块戴森板"], ["ส่งพลังงานกลับโลกที่เสาส่งขวาสุด", "Beam the energy to Earth from the far-right relay", "在最右中继塔把能量传回地球"]],
  ashfall: [["ปล่อยหัวรบ 3 ลูกให้โดนฐานมากที่สุด", "Drop 3 warheads on as many bases as you can", "用 3 枚弹头摧毁尽可能多的基地"], ["ฐานที่โดนจะไม่มีทหารตอนบุก", "Destroyed bases have no defenders", "被摧毁的基地没有守军"], ["ลงพื้นที่แล้วล้มผู้บัญชาการ", "Land and defeat the commander", "降落并击败指挥官"]],
  voidgate: [["บังคับยานหลบกระสุนและยิงฝูงเอเลี่ยน", "Fly, dodge and shoot down the alien swarm", "驾驶战机闪避并击落外星机群"], ["เก็บคริสตัลและของที่ดรอปไว้ขายเป็นเงิน", "Collect crystals and loot to sell for coins", "收集水晶与战利品换取金币"], ["ล้มเรือแม่ให้ได้ก่อนยานคุณพัง", "Destroy the mothership before your ship falls", "在战机被毁前击落母舰"]],
  kindred: [["ขุดแร่ให้ได้ 10 ก้อนขึ้นไป", "Gather at least 10 ore", "至少采集 10 块矿"], ["ส่งแคปซูลแลกเทคโนโลยี", "Launch the trade capsule", "发射交易货舱"], ["สู้กับสัตว์ป่าระหว่างทาง", "Fight the wildlife on the way", "击退沿途野兽"]],
  darkforge: [["ทุบหินหาแร่ด้วยปุ่ม ⛏", "Break rocks for ore with the ⛏ button", "用 ⛏ 按钮敲碎岩石获取矿石"], ["ประกอบภาชนะสสารมืด 4 ชิ้น", "Assemble 4 dark-matter vessels", "组装 4 个暗物质容器"], ["หลบเปลวพลังงานที่ปะทุ", "Dodge the energy flares", "躲开爆发的能量耀斑"]],
  shadow: [["ห้ามยิง — ยานต้องเงียบ", "No shooting: the ship stays dark", "禁止开火——飞船保持静默"], ["หลบลำแสงสแกนทั้งแนวนอนและแนวตั้ง", "Dodge scan beams, across and down", "躲开横向与纵向的扫描光束"], ["รอดให้ครบ 50 วินาที", "Survive 50 seconds", "存活满 50 秒"]],
};
const TYPE: Record<string, string> = { kindred: "ice", darkforge: "belt", shadow: "orbit", luma: "jungle", ferro: "desert", jovia: "gas", kryo: "ice", pyra: "lava", nexa: "wreck", cobalt: "belt", helios: "sun", ashfall: "strike", voidgate: "orbit", dyson: "sun", departure: "liftoff", asteroids: "belt", gasskim: "gas", starharvest: "sun", solarcharge: "sun", dysondock: "sun", gaspump: "gas", warpjump: "orbit", blackhole: "orbit" };

const CH = ["luma", "ferro", "jovia", "kryo", "pyra", "nexa", "cobalt", "helios", "dyson", "ashfall", "voidgate", "departure", "asteroids", "gasskim", "starharvest", "solarcharge", "dysondock", "gaspump", "warpjump", "blackhole", "kindred", "darkforge", "shadow"];
const seenPrologue = () => { try { return localStorage.getItem("tg_adv_prologue") === "1"; } catch (e) { return false; } };
/* longer shots (owner, 2026-10-11): every shot but the objective card runs 1.6x as long as first drawn */
export function cinePlan(P: any, short?: boolean): CineShot[] { return basePlan(P, short).map(q => (q.kind === "objective" ? q : { ...q, dur: Math.round(q.dur * 1.6 * 10) / 10 })); }
function basePlan(P: any, short?: boolean): CineShot[] {
  if (P.id === "departure") return [{ kind: "pad", dur: 7 }, { kind: "liftoff", dur: 7 }, { kind: "earthfade", dur: 7 }, { kind: "objective", dur: 6 }];
  if (P.finale) return [{ kind: "lore", dur: 5.2, theme: "friend" }, { kind: "lore", dur: 5.2, theme: "dark" }, { kind: "lore", dur: 5.2, theme: "harvest" }, { kind: "mind", dur: 5.6, theme: "ai" }];
  if (P.prologue) return [{ kind: "earth", dur: 4.2 }, { kind: "factory", dur: 4.2 }, { kind: "launch", dur: 3.6 }, { kind: "contact", dur: 5, theme: "harvest" }, { kind: "mind", dur: 5, theme: "ai" }];
  if (short === undefined) short = seenPrologue();
  if (short) { const q: CineShot[] = [{ kind: "approach", dur: 4.4 }, { kind: P.mission === "strike" ? "strike" : "surface", dur: 5.2 }]; if (LORE_THEME[P.id]) q.push({ kind: "lore", dur: 4.6, theme: LORE_THEME[P.id] }); if (P.boss && P.boss[0] !== "-") q.push({ kind: "boss", dur: 3.8 }); q.push({ kind: "objective", dur: 6 }); return q; }
  const plan: CineShot[] = [{ kind: "earth", dur: 4.2 }, { kind: "factory", dur: 4.2 }, { kind: "launch", dur: 3.6 }, { kind: "approach", dur: 4.4 }, { kind: P.mission === "strike" ? "strike" : "surface", dur: 5.2 }];
  if (LORE_THEME[P.id]) plan.push({ kind: "lore", dur: 4.6, theme: LORE_THEME[P.id] });
  if (P.boss && P.boss[0] !== "-") plan.push({ kind: "boss", dur: 3.8 });
  plan.push({ kind: "objective", dur: 6 });
  return plan;
}
const FINALE_TXT: Record<string, L3> = {
  friend: ["มนุษย์ไม่ได้โดดเดี่ยวอีกต่อไป — ไคนด์เรดแบ่งความรู้ให้เรา และเราเรียนรู้ซึ่งกันและกันอย่างเท่าเทียม", "Humanity is no longer alone. The Kindred share their knowledge, and we learn from each other as equals.", "人类不再孤单——友族与我们分享知识，我们平等地互相学习。"],
  dark: ["สสารมืดเริ่มเลี้ยง TIGA แทนดาวฤกษ์ — ดวงดาวหลายดวงถูกปล่อยให้ส่องแสงต่อไป", "Dark matter begins to feed TIGA in place of stars, and many suns are left to shine.", "暗物质开始取代恒星为 TIGA 供能，许多恒星得以继续发光。"],
  harvest: ["ฮาร์เวสเตอร์ยังไม่เห็นเรา — แต่มันกำลังหันมาทางนี้ ศึกจริงยังไม่เริ่มต้น", "The Harvesters have not seen us yet, but they are turning this way. The real war has not begun.", "收割者还没有发现我们——但它们正转向这里，真正的战争尚未开始。"],
  ai: ["TIGA ถามว่า ถ้าเรารอดจากสิ่งนี้ได้ ข้างหน้ามีอะไรรออยู่ — เรื่องราวยังไม่จบ", "TIGA asks what lies ahead if we survive this. The story is not over.", "TIGA 问：如果我们撑过这一关，前方还有什么？故事还没有结束。"],
};
const captionFor = (P: any, kind: string, lang: string) => {
  const g = (a: L3) => T3(lang, a[0], a[1], a[2]);
  if (P.finale && (kind === "lore" || kind === "mind")) return g(FINALE_TXT[(P as any).__theme || "friend"]);
  if (kind === "earth" || kind === "factory" || kind === "launch" || kind === "contact" || kind === "mind") return g((COMMON as any)[kind]);
  if (kind === "lore") return g(LORE[P.id] || LORE.luma);
  if (kind === "approach") return g(INTRO[P.id] || INTRO.luma);
  if (kind === "surface" || kind === "strike") return g(STORY[P.id] || STORY.luma);
  if (kind === "pad" || kind === "liftoff" || kind === "earthfade") return g((DEPART as any)[kind]);
  if (kind === "boss") return T3(lang, "ที่ปลายทาง มี " + P.boss[0] + " รออยู่", "At the end of the road, " + P.boss[1] + " is waiting.", "路的尽头，" + P.boss[2] + "正在等候。");
  return "";
};

/* ── the look (owner, 2026-10-11): ruined cyber space age, Dune x Star Wars x Star Trek ── */
const DUST = Array.from({ length: 70 }, (_, i) => ({ x: rnd(i + 2000), y: rnd(i + 2100), s: 0.4 + rnd(i + 2200) * 1.6, v: 0.02 + rnd(i + 2300) * 0.06 }));
function epicLook(x: CanvasRenderingContext2D, W: number, H: number, t: number, kind: string, P: any) {
  const acc = P.acc || "255,190,90";
  x.save();
  // a grade: warm dusty highlights over cold shadows
  x.globalCompositeOperation = "soft-light"; const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "rgba(40,90,150,.45)"); g.addColorStop(1, "rgba(" + acc + ",.35)"); x.fillStyle = g; x.fillRect(0, 0, W, H);
  // drifting dust and ash
  x.globalCompositeOperation = "lighter"; for (const d of DUST) { const px = ((d.x - t * d.v * 3) % 1 + 1) % 1 * W, py = ((d.y + t * d.v) % 1) * H; x.fillStyle = "rgba(" + acc + ",.22)"; x.beginPath(); x.arc(px, py, d.s * (W / 900), 0, 7); x.fill(); }
  // an anamorphic streak from a light that slowly crosses the frame
  const lx = W * (0.2 + 0.6 * ((t * 0.03) % 1)), ly = H * 0.34; const sg = x.createLinearGradient(lx - W * 0.45, 0, lx + W * 0.45, 0); sg.addColorStop(0, "rgba(120,190,255,0)"); sg.addColorStop(0.5, "rgba(190,225,255,.5)"); sg.addColorStop(1, "rgba(120,190,255,0)"); x.fillStyle = sg; x.fillRect(lx - W * 0.45, ly - 1.5, W * 0.9, 3);
  // a capital ship (wedge hull, engine glow) gliding far away; bigger and lower in the space and launch shots
  if (kind === "launch" || kind === "approach" || kind === "boss" || kind === "earth") {
    const sc = kind === "boss" ? 1.4 : 1, sx = W * (1.15 - ((t * 0.035) % 1.5)), sy = H * 0.3, L = W * 0.5 * sc, Hh = H * 0.09 * sc;
    x.globalCompositeOperation = "source-over"; x.fillStyle = "rgba(8,12,22,.92)"; x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + L, sy - Hh * 0.2); x.lineTo(sx + L * 0.96, sy + Hh * 0.2); x.lineTo(sx, sy + Hh); x.closePath(); x.fill();
    x.fillStyle = "rgba(40,60,90,.7)"; x.fillRect(sx + L * 0.2, sy + Hh * 0.05, L * 0.5, 2);
    x.globalCompositeOperation = "lighter"; const eg = x.createRadialGradient(sx + L, sy, 0, sx + L, sy, Hh * 1.8); eg.addColorStop(0, "rgba(150,210,255,.8)"); eg.addColorStop(1, "rgba(80,140,255,0)"); x.fillStyle = eg; x.beginPath(); x.arc(sx + L, sy, Hh * 1.8, 0, 7); x.fill();
  }
  // holo-readout corners, like a bridge display
  x.globalCompositeOperation = "source-over"; x.strokeStyle = "rgba(140,210,255,.55)"; x.lineWidth = Math.max(1.5, W / 700); const m = W * 0.045, bh = H * 0.13 + 6, q = W * 0.03;
  for (const [cx, cy, sx2, sy2] of [[m, bh + m * 0.6, 1, 1], [W - m, bh + m * 0.6, -1, 1], [m, H - bh - m * 0.6, 1, -1], [W - m, H - bh - m * 0.6, -1, -1]] as number[][]) { x.beginPath(); x.moveTo(cx, cy + sy2 * q); x.lineTo(cx, cy); x.lineTo(cx + sx2 * q, cy); x.stroke(); }
  x.fillStyle = "rgba(140,210,255,.7)"; x.font = Math.round(W / 70) + "px monospace"; x.fillText("STARDATE 2100." + String(Math.floor(t * 7 + 114)).padStart(3, "0"), m + 4, bh + m * 0.6 + q + 18);
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
function sceneSurface(x: Cx, W: number, H: number, u: number, t: number, P: any, type: string, eye: string) {
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
  for (let i = 0; i < 5; i++) { const ex = W * (0.45 + i * 0.1) + Math.sin(t * 0.7 + i) * 8, on = Math.sin(t * 1.3 + i * 2) > -0.4; if (on) { x.globalCompositeOperation = "lighter"; x.fillStyle = rgba(P.acc, 0.9); x.fillRect(ex, hz - 6 - rnd(i) * 20, 3, 3); x.fillRect(ex + 7, hz - 6 - rnd(i) * 20, 3, 3); x.globalCompositeOperation = "source-over"; } }
  { const hk = Math.floor(rnd(String(P.id).length * 7 + P.id.charCodeAt(0)) * 6); for (let i = 0; i < 7; i++) { const ax = W * (0.36 + i * 0.09) + Math.sin(t * 0.6 + i) * 6 + pan * 0.5, k = (hk + i) % 6; alien(x, ax, k === 1 ? hz - H * 0.02 : hz + H * 0.04 + (i % 2) * H * 0.03, H / 260 * (0.55 + rnd(i + 31) * 0.5), k, P.acc, t + i); } }   // the horde: six body plans in a mix that depends on the world
  robot(x, W * 0.14 - pan, hz + H * 0.07, H / 300, "#0a1320", eye, 1, 0.2); x.globalCompositeOperation = "lighter"; for (let i = 0; i < 24; i++) { const a = ((rnd(i) * W - t * (20 + rnd(i + 3) * 40)) % W + W) % W; x.fillStyle = rgba(P.glow, 0.25); x.fillRect(a, hz * (0.3 + rnd(i + 5) * 0.9), 2, 2); } x.globalCompositeOperation = "source-over";
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

export const AdventureCine = memo(function AdventureCine({ P, lang, me, colorway, onDone }: any) {
  const plan = useRef(cinePlan(P)).current; const total = plan.reduce((a, q) => a + q.dur, 0); const starts = useRef((() => { let a = 0; return plan.map(s => { const v = a; a += s.dur; return v; }); })()).current;
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
    const audio = createCineAudio(P.id, plan);
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame); const el = (now - t0.current) / 1000 + skipTo.current; let i = 0; for (let k = 0; k < plan.length; k++) if (el >= starts[k]) i = k;
      if ((P.prologue || P.finale) && el >= total) { raf = 0; cancelAnimationFrame(raf); onDone(); return; }
      if (i !== idxRef.current) { idxRef.current = i; setIdx(i); }
      const W = cv.width, H = cv.height, s = plan[i], local = el - starts[i], u = Math.min(1, local / Math.max(0.1, s.dur));
      x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = "source-over"; x.fillStyle = "#000"; x.fillRect(0, 0, W, H);
      x.save(); const zoom = 1 + 0.07 * u; x.translate(W / 2, H / 2); x.scale(zoom, zoom); x.translate(-W / 2, -H / 2);
      switch (s.kind) {
        case "pad": scenePad(x, W, H, u, local); break; case "liftoff": sceneLiftoff(x, W, H, u, local); break; case "earthfade": sceneEarthFade(x, W, H, u, local, P); break;
        case "earth": sceneEarth(x, W, H, u, local); break; case "factory": sceneFactory(x, W, H, u, local, eye); break; case "launch": sceneLaunch(x, W, H, u, local, P.glow); break;
        case "contact": sceneHarvest(x, W, H, u, local, P, 0); break; case "mind": sceneAI(x, W, H, u, local, P); break;
        case "lore": { const th = (s as any).theme; if (th === "ai") sceneAI(x, W, H, u, local, P); else if (th === "friend") sceneFriend(x, W, H, u, local, P); else if (th === "reactor") sceneReactor(x, W, H, u, local, P); else if (th === "dark") sceneDark(x, W, H, u, local, P); else sceneHarvest(x, W, H, u, local, P, 1.7); break; }
        case "approach": sceneApproach(x, W, H, u, local, P); break; case "boss": sceneBoss(x, W, H, u, local, P); break; case "objective": sceneObjective(x, W, H, local, P); break;
        default: sceneSurface(x, W, H, u, local, P, type, eye);
      }
      x.restore();
      epicLook(x, W, H, el, s.kind, P); bloom(x, W, H);
      const v = x.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.95); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.6)"); x.fillStyle = v; x.fillRect(0, 0, W, H);
      x.fillStyle = "rgba(255,255,255,.035)"; for (let k = 0; k < 90; k++) x.fillRect(Math.random() * W, Math.random() * H, 1.4, 1.4);   // film grain
      const bar = H * 0.13; x.fillStyle = "#000"; x.fillRect(0, 0, W, bar); x.fillRect(0, H - bar, W, bar);
      const fade = Math.max(0, 1 - local / 0.4, Math.min(1, (local - (s.dur - 0.3)) / 0.3) * (s.kind === "objective" ? 0 : 1)); if (fade > 0) { x.fillStyle = `rgba(0,0,0,${fade})`; x.fillRect(0, 0, W, H); }
    };
    raf = requestAnimationFrame(frame);
    (window as any).__advCine = { shot: () => idxRef.current, kinds: () => plan.map(s => s.kind), render: (id: string, mission: string, boss: boolean) => renderCinePreview(id, cinePlan({ id, mission, boss: boss ? ["x", "x", "x"] : ["-", "-", "-"] }, false)), jump: (i: number) => { skipTo.current = starts[i] - (performance.now() - t0.current) / 1000 + 0.05; }, total: starts[objIdx] };
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", fit); if (audio) audio.stop(); try { delete (window as any).__advCine; } catch (e) {} };
  }, []);
  const kind = plan[Math.min(idx, plan.length - 1)].kind, capFor = (lg: string) => captionFor(P.finale ? { ...P, __theme: (plan[Math.min(idx, plan.length - 1)] as any).theme } : P, kind, lg), cap = sub === "off" ? "" : capFor(sub), goals = GOAL[P.id] || GOAL.luma;
  const CPS: Record<string, number> = { th: 11, en: 15, zh: 4.6 };   // spoken characters per second, to fit the line into its shot
  const voText = (lg: string) => kind === "objective" ? T3(lg, "ภารกิจ: ", "Mission: ", "任务：") + T3(lg, P.th, P.en, P.zh).split(" · ")[0] + ". " + goals.map((g: any) => T3(lg, g[0], g[1], g[2])).join(". ") : capFor(lg);
  useEffect(() => {
    if (voice === "off") { stopSpeaking(); return undefined; }
    const txt = voText(voice); if (!txt) { stopSpeaking(); return undefined; }
    const dur = plan[Math.min(idx, plan.length - 1)].dur, rate = Math.max(0.95, Math.min(1.45, (txt.length / (CPS[voice] || 12)) / Math.max(1, dur * 0.88)));
    const id = setTimeout(() => { try { speakDeviceOrNative(txt, voice, undefined, undefined, rate); } catch (e) {} }, 350);
    (window as any).__advVo = { lang: voice, text: txt, rate }; return () => clearTimeout(id);
  }, [idx, voice]);
  useEffect(() => () => { stopSpeaking(); }, []);
  const next = () => { if (idxRef.current < objIdx) skipTo.current = starts[idxRef.current + 1] - (performance.now() - t0.current) / 1000 + 0.05; };
  return (
    <div className={"adv-cine" + (rot ? " rot" : "")} onPointerDown={(e) => { if ((e.target as HTMLElement).closest("button")) return; next(); }}>
      <canvas ref={cvRef} />
      <div className="ac-lang">
        <button aria-label="voice language" data-vo={voice} onClick={() => setVoice(v => { const n = flip(v); try { localStorage.setItem("tg_adv_vo", n); } catch (e) {} return n; })}>🎙<b>{voice === "off" ? t("ปิด", "OFF", "关") : voice.toUpperCase()}</b></button>
        <button aria-label="subtitle language" data-sub={sub} onClick={() => setSub(v => { const n = flip(v); try { localStorage.setItem("tg_adv_sub", n); } catch (e) {} return n; })}>CC<b>{sub === "off" ? t("ปิด", "OFF", "关") : sub.toUpperCase()}</b></button>
      </div>
      <button className="ac-skip" onClick={() => { stopSpeaking(); onDone(); }} aria-label="skip">{t("ข้าม ⏭", "Skip ⏭", "跳过 ⏭")}</button>
      {kind === "approach" && <div key="ttl" className="ac-title"><small>{t("บทที่ ", "CHAPTER ", "第") + (CH.indexOf(P.id) + 1) + t("", "", "章") + " · " + t("ปลายทาง", "DESTINATION", "目的地")}</small><b>{T3(sl, P.th, P.en, P.zh).split(" · ")[0]}</b></div>}
      {(kind === "lore" || kind === "contact" || kind === "mind") && <div key={"t" + idx} className="ac-tag" data-theme={(plan[idx] as any).theme}>{T3(lang, THEME_TAG[(plan[idx] as any).theme][0], THEME_TAG[(plan[idx] as any).theme][1], THEME_TAG[(plan[idx] as any).theme][2])}</div>}
      {cap && kind !== "objective" && <div key={"c" + idx} className={"ac-cap" + (kind === "lore" || kind === "contact" || kind === "mind" ? " low" : "")}>{cap}</div>}
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
