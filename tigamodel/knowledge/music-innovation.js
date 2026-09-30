/* ── tigamodel/knowledge/music-innovation.js — plan v3.5 6.13 (KB นวัตกรรมดนตรี)
   The fifth knowledge pillar the owner asked for: how piano/music innovation
   actually happened worldwide and why — instruments (Bartolomeo Cristofori's
   fortepiano → pianoforte → modern grand/upright; Moog/DDS synth lineage),
   mechanisms (double-escapement, cross-stringing, sostenuto, player roll),
   notation (Guido d'Arezzo staff + solfège; tablature; Braille music; MIDI),
   distribution (piano roll → radio → LP → digital workstation → streaming →
   DAW-era creation), pedagogy tools (étude method books, ABRSM/TCL grades,
   Synthesia-game apps, MIDI visualizers) — and how an idea becomes
   "innovation" (needs → constraint → invention → adoption).
   กติกาเหล็ก: เชิงคุณภาพล้วน — ไม่มีสถิติ/เปอร์เซ็นต์/ตัวเลขอ้างว่างใด ๆ (No invented data)
   ทุก entry เป็นความรู้ที่ยอมรับกว้าง ตรวจย้อนได้จากชื่อผู้คิด/ชื่อกลไกจริง ·
   เขียน 3 ภาษา (th/en/zh) ตามกติกาแผน: ภาษาหลักใน title/body, en/zh อยู่ใน gloss ── */

/* 1) กำเนิดเปียโนและกลไก — ตรวจย้อนได้จากชื่อผู้คิดจริง */
export function genInnovationPianoGenesis(kb) {
  const out = [];
  const GEN = [
    ["cristofori", "เปียโนเกิดจากการแก้ปัญหาของฮาร์ปซิคอร์ด",
      "ก่อนเปียโน ฮาร์ปซิคอร์ดดีดสายด้วยเปียจึงควบคุมความดังไม่ได้ — Bartolomeo Cristofori (ช่างดูแลเครื่องดนตรีของเมดิชิแห่งฟลอเรนซ์) คิดกลไกค้อนตีสายที่ \"ตีแล้วปล่อย\" ให้เล่นดัง-เบาได้ตามนิ้ว ชื่อเดิม gravicembalo col piano e forte จึงกลายเป็นคำว่า pianoforte → เปียโน",
      "Before the piano, the harpsichord plucked strings and could not control loudness — Bartolomeo Cristofori (the Medici's keeper of musical instruments in Florence) built a hammer mechanism that strikes and releases, letting the finger control volume: gravicembalo col piano e forte became \"pianoforte\".",
      "在钢琴之前，羽管键琴拨弦而无法控制音量——佛罗伦萨美第奇家的乐器保管员巴托洛梅奥·克里斯托福里发明了击弦后放开的小槌机械，让手指能控制强弱：gravicembalo col piano e forte 由此得名\"钢琴\"。"],
    ["escapement", "กลไก double-escapement — ทำให้เล่นซ้ำเร็วได้",
      "Sébastien Érard (ปารีส) คิด double-escapement: ค้อนถอยเพียงเล็กน้อยหลังตี จึงตีซ้ำได้ก่อนกุญแจขึ้นเต็มที่ — เปียโนสมัยใหม่เกือบทั้งหมดยังใช้หลักนี้ นี่คือตัวอย่างชั้นดีของ \"แก้คอขวดของผู้เล่น = นวัตกรรมที่อยู่รอด\"",
      "Sébastien Érard (Paris) invented the double-escapement: the hammer resets only slightly after striking, so a note can repeat before the key fully returns — almost every modern piano still uses it. A textbook case of \"fix the player's bottleneck = an innovation that survives.\"",
      "塞巴斯蒂安·埃拉尔（巴黎）发明了复式进退机构：琴槌击弦后只需小幅复位，琴键未完全回弹也能快速重复——现代钢琴几乎都沿用此原理。\"解决演奏者的瓶颈=能存活的创新\"的典范。"],
    ["cross-stringing", "การไขสายไขว้ (cross-stringing) ให้เสียงใหญ่ขึ้น",
      " Steinway & Sons ใช้การไขสายเบสข้ามสายกลาง/สายทริเบิลแบบเฉียง (overstrung scale) ให้เฟรมรับแรงสายได้มากขึ้น — เสียงเปียโนคอนเสิร์ตกรุงเสียงลึกและดังพอยืนเหนือออร์เคสตรา เพราะวิศวกรรมเฟรมเหล็กกับการจัดสายพัฒนาร่วมกัน",
      "Steinway & Sons crossed the bass strings diagonally over the middle/treble strings (overstrung scale) so a stronger frame could take more string tension — the modern concert grand owes its depth and power to frame engineering and scale design evolving together.",
      "施坦威把低音弦斜向交叉在中高音弦上方（overstrung 布局），使更坚固的铸铁框架能承受更大张力——现代音乐会大钢琴的深度与音量来自框架工程与弦列设计的共同演进。"],
    ["upright-mass", "เปียโนตั้งพากเปียโนเข้าบ้านทั่วไป",
      "ยุบกลไกให้ตั้งพื้น (upright) ทำให้เปียโนเข้าบ้านและห้องเรียนได้ ไม่ต้องมีห้องโถง — บทเรียนนวัตกรรม: ย่อขนาด/ลดราคา มักเปลี่ยน \"เครื่องของชนชั้นเลือก\" ให้เป็น \"เครื่องของทุกคน\"",
      "Shrinking the action into an upright put pianos in homes and classrooms without a hall — innovation lesson: shrinking size/cost often turns a class instrument into everyone's instrument.",
      "把击弦机压缩成立式钢琴，让钢琴进入家庭与教室，无需大厅——创新启示：缩小体积与成本常把\"阶层的乐器\"变成\"每个人的乐器\"。"],
    ["sostenuto", "แป้นเหยียบกลาง — ลิขสิทธิ์เฉพาะของเปียโน",
      "แป้นกลาง (sostenuto) เกิดช้ากว่าแป้นอื่นและยังเป็นเอกลักษณ์ของกรุง: เหยียบค้างไว้ให้เฉพาะคีย์ที่กดอยู่ค้างเสียง ผู้แต่งยุคหลังใช้สร้างเสียงเลเยอร์ที่แป้นซ้าย-ขวาทำไม่ได้ — นวัตกรรมบางชิ้น \"เกิดทีหลังแต่เปิดภาษาใหม่ของเครื่อง\"",
      "The middle (sostenuto) pedal arrived late and stays a grand-piano signature: it holds only the keys pressed, letting later composers layer sounds neither outer pedal can — some innovations arrive late but open a new voice of the instrument.",
      "中踏板（延音踏板）出现较晚，仍是三角钢琴的标志：只延音已按下的琴键，让后世作曲家做出两侧踏板都做不到的声层——有些创新虽迟，却开启了乐器的新声音。"],
  ];
  for (const [id, th, bodyTh, en, zh] of GEN) {
    kb.add({
      id: `inn:piano:${id}`, type: "fact", domain: "music-innovation",
      title: `กำเนิดเปียโน: ${th}`,
      body: `${bodyTh} (EN: ${en}) (ZH: ${zh})`,
      teach: "ชวนผู้เรียนเปิดฝากรุง (เมื่อปลอดภัย) ดูค้อนกับสาย แล้วเล่าว่า \"กลไกที่เห็นนี้คือคำตอบของปัญหาเดิม\" — นวัตกรรมสอนได้จากของจริงหน้าตักดีกว่าจากประวัติศาสตร์เฉย ๆ",
      confidence: 0.8, source: "tiga-industry-craft",
      tags: ["innovation", "piano-genesis", id], meta: { family: "piano-genesis" },
    });
    out.push(`inn:piano:${id}`);
  }
  return out;
}

/* 2) นวัตกรรมการบันทึก/แผ่นเสียง — บันไดของการจับเสียง */
export function genInnovationRecording(kb) {
  const out = [];
  const REC = [
    ["roll", "ม้วนเปียโน (player piano) คือ \"ไฟล์ MIDI ยุคแรก\"",
      "ม้วนกระดาษเจาะรูคือคำสั่งให้เครื่องเล่นแทนคน — กลางศตวรรษที่ผ่านมามันคือ \"สื่อบันทึกการเล่น\" ที่เล็กที่สุดก่อนไฟล์ดิจิทัล มองย้อนได้ว่าแนวคิด \"เก็บการเล่นเป็นข้อมูลแล้วสั่งเครื่องเล่นซ้ำ\" มีมาก่อนคอมพิวเตอร์ดนตรี",
      "The perforated paper roll is the machine's instruction — an early \"recording\" of a performance, and a way to see that \"store playing as data, replay on a machine\" predates computer music.",
      "打孔纸卷是机器的指令——一种早期\"演奏记录\"，可见\"把演奏存为数据再由机器重放\"早于计算机音乐。"],
    ["electric", "จากคลื่นเสียงกลไก → เสียงไฟฟ้า",
      "โมเดลเปียโนไฟฟ้า/สังเคราะห์เสียง (เช่นยุคของ Moog และรุ่นอื่น ๆ) เปลี่ยนคำถามจาก \"ตีสายอย่างไร\" เป็น \"สร้างคลื่นเสียงอย่างไร\" — เครื่องดนตรีขยายจากการเลียนแบบเสียงเดิมไปสู่เสียงที่ยังไม่มีใครได้ยิน",
      "Electric/synthesizer instruments (the Moog era and others) changed the question from \"how do we strike strings\" to \"how do we build the sound wave\" — instruments expanded from imitating old sounds to sounds nobody had heard.",
      "电钢琴/合成器（穆格时代等）把问题从\"如何击弦\"变成\"如何构建声波\"——乐器从模仿旧声音扩展到从未听过的声音。"],
    ["daw", "สตูดิโอในคอมพิวเตอร์ (DAW) ทำให้ผู้เรียนเป็นทั้งนักเล่นและโปรดิวเซอร์",
      "DAW + MIDI keyboard ยุบขั้นตอน \"อัดเดโมในสตูดิโอ\" ให้เหลือบนโต๊ะเดียว — ผู้เรียนเปียโนวันนี้ฝึกเล่น อัด ตัดต่อ และเผยแพร่ได้คนเดียว โครงการเรียนรู้จึงออกแบบให้จบวงจร \"เล่น → บันทึก → แชร์\" ได้",
      "DAW + MIDI keyboard collapsed \"book studio time\" onto one desk — today's piano learner can play, record, edit, and publish alone, so learning projects should close the loop: play → record → share.",
      "数字音频工作站+MIDI键盘把\"录音棚\"压缩到一张桌上——今天的琴童可独自完成演奏、录音、剪辑与发布，学习项目应走完\"弹→录→分享\"。"],
    ["streaming", "การเผยแพร่ยุคสตรีมมิงเปลี่ยน \"จบเพลง\" ให้มีความหมายใหม่",
      "เมื่อผู้ฟังเจอเพลงใหม่วินาทีหลังเลื่อนหน้า การเล่นจบเพลงหนึ่งอย่างสมบูรณ์และสวยงามคือ \"สินค้า\" ที่หายาก — นวัตกรรมเผยแพร่ไม่ได้แค่เปลี่ยนช่องทาง แต่เปลี่ยนว่าอะไรถือเป็น \"ผลงานชิ้นเอกของผู้เรียน\"",
      "When listeners meet a new song seconds after swiping, one completely and beautifully finished performance is the rare commodity — distribution innovation doesn't just change the channel, it changes what counts as a learner's \"masterpiece.\"",
      "当听众滑动屏幕几秒就换歌时，完整而优美地弹完一首曲子成了稀缺品——传播创新不只改变渠道，还改变什么算\"学习者的代表作\"。"],
  ];
  for (const [id, th, bodyTh, en, zh] of REC) {
    kb.add({
      id: `inn:rec:${id}`, type: "principle", domain: "music-innovation",
      title: `สื่อและการบันทึก: ${th}`,
      body: `${bodyTh} (EN: ${en}) (ZH: ${zh})`,
      teach: "ยกเคสเดียวพอต่อคาบ: เล่าเส้นเวลาจากม้วนเปียโนถึงไฟล์เสียง แล้วถามว่า \"ถ้าเป็นเรา จะเก็บการเล่นวันนี้ไว้ยังไง\" — เชื่อมประวัติศาสตร์กับการซ้อมของผู้เรียนเอง",
      confidence: 0.75, source: "tiga-industry-craft",
      tags: ["innovation", "recording", id], meta: { family: "recording" },
    });
    out.push(`inn:rec:${id}`);
  }
  return out;
}

/* 3) สัญกรณ์และเครื่องมือ — จากบันไดโน้ตจนถึงจอ */
export function genInnovationNotation(kb) {
  const out = [];
  const NOT = [
    ["guido", "บันไดโน้ตและโซลเฟจ — เครื่องมือเรียนรู้ที่เปลี่ยนทุกอย่าง",
      "Guido d'Arezzo พัฒนาเส้นบันไดโน้ตและระบบซ้อมโน้ตด้วยคำร้อง (ที่โตแยกสายเสียงของเพลงสวด) ให้อ่านเพลงใหม่ได้เร็วขึ้นมหาศาล — นี่คือ \"เทคโนโลยีการเรียนรู้\" ที่เก่าที่สุดและยังใช้อยู่ทุกห้องเรียนโน้ตดนตรี",
      "Guido d'Arezzo's staff lines and syllable-based sight-singing (grown from chant lines) made reading new music far faster — the oldest \"learning technology\" still in every notation classroom.",
      "圭多·达莱佐的五线谱与唱名视唱（源自圣咏的线谱）让读新谱大幅提速——这是至今仍在每个乐理教室使用的最古老\"学习技术\"。"],
    ["braille", "สัญกรณ์เบรลล์ — ดนตรีไปถึงผู้เรียนทุกคน",
      "สัญกรณ์เบรลล์สำหรับดนตรีพิสูจน์ว่า \"ผู้พิการทางการมองเห็นเล่นอ่านโน้ตได้เต็มระบบ\" — นวัตกรรมที่ดีมักเป็นการเปิดประตูให้คนที่เครื่องมือเดิมไม่ได้คุ้มครอง",
      "Braille music notation proved visually impaired learners can read music as a full system — great innovation is often opening the door for people the old tools left out.",
      "盲文乐谱证明了视障学习者也能完整读谱——伟大的创新常常是为旧工具忽略的人打开大门。"],
    ["midi", "MIDI — ภาษากลางที่ทำให้เครื่องดนตรีพูดกันได้",
      "MIDI ไม่ใช่เสียง แต่คือ \"ข้อความ\" บอกว่ากดคีย์ไหน แรงเท่าไร นานเท่าไร — ทำให้คีย์บอร์ด คอมพิวเตอร์ และโปรแกรมเรียนรู้คุยกันได้ แอปเรียนเปียโนทุกยุค (รวมแอปนี้) ยังยืนอยู่บนภาษานี้",
      "MIDI is not sound but messages — which key, how hard, how long — letting keyboards, computers, and learning apps talk; every modern piano app (this one included) stands on this language.",
      "MIDI 不是声音而是消息——哪个键、多大力、多久——让键盘、电脑与学习应用互通；现代钢琴应用（包括本应用）都建立在这门语言上。"],
    ["visualizer", "จอวิชวลไลเซอร์ — โน้ตที่ \"ตกลงมา\" ไม่ใช่เรื่องบังเอิญ",
      "จอโน้ตตก/ค้างบนคีย์ (แนวคิดยอดนิยมของแอปเรียนเปียโน) ย้ายภาระจาก \"จำตำแหน่งบนกระดาษ\" ไป \"ตามทิศทางที่เห็น\" — เป็นนวัตกรรมการเรียนรู้ที่เปิดประตูมือใหม่ แต่ครูที่ดียังชี้ว่า \"อ่านโน้ตจริง\" คือทักษะระยะยาวที่ต้องค่อย ๆ สร้างคู่ไป",
      "Falling/fixed note displays (popular in piano apps) shift the load from \"remembering paper positions\" to \"following what you see\" — a learning innovation that opens doors, while good teachers note real notation reading is the long-term skill to grow alongside it.",
      "下落/固定音符显示（钢琴应用常用）把负担从\"记忆纸上位置\"转为\"跟随所见\"——这是入门创新，但好老师会强调真正的读谱是需同步培养的长期技能。"],
    ["grade-systems", "ระบบเกรดสอบ (ABRSM/Trinity) คือนวัตกรรมเชิงโครงสร้าง",
      "ABRSM (ลอนดอน) และ Trinity วางบันไดเกรดที่ชัดเจนจากง่ายไปยาก ทำให้ \"ความก้าวหน้า\" มีรูปธรรมร่วมกันทั้งครู ผู้เรียน และผู้ปกครองทั่วโลก — นวัตกรรมไม่ต้องเป็นเครื่องจักร: การออกแบบบันไดความก้าวหน้าก็คือเทคโนโลยีทางการศึกษา",
      "ABRSM (London) and Trinity built a clear grade ladder that made \"progress\" concrete for teachers, learners, and parents worldwide — innovation needn't be a machine: designing a progress ladder is education technology.",
      "英皇（伦敦）与圣三一建立了清晰的考级阶梯，让教师、学习者与家长对\"进步\"有共同依据——创新不必是机器：设计进步阶梯本身就是教育技术。"],
  ];
  for (const [id, th, bodyTh, en, zh] of NOT) {
    kb.add({
      id: `inn:notation:${id}`, type: "fact", domain: "music-innovation",
      title: `สัญกรณ์และเครื่องมือ: ${th}`,
      body: `${bodyTh} (EN: ${en}) (ZH: ${zh})`,
      teach: "ผูกกับการซ้อมเสมอ: เล่า Guido แล้วให้ลองอ่านโน้ต 5 นาที; เล่า MIDI แล้วให้เชื่อมอัดเสียงเล่นของผู้เรียน — เสร็จคาบต้องได้ทักษะคู่กับเรื่องเล่า",
      confidence: 0.8, source: "tiga-industry-craft",
      tags: ["innovation", "notation", id], meta: { family: "notation" },
    });
    out.push(`inn:notation:${id}`);
  }
  return out;
}

/* 4) นวัตกรรมวิธีเรียนวิธีสอน — จากเอทิวด์ถึง AI
   (เก็บต่างเมือง: ญี่ปุ่น/เกาหลี/จีน และโรงเรียนรัสเซียเป็น \"ของจริงที่เล่าได้\") */
export function genInnovationPedagogy(kb) {
  const out = [];
  const PED = [
    ["etude-books", "หนังสือเอทิวด์คือ \"แอปฝึก\" ยุคก่อนแอป",
      "Czerny, Hanon, Burgmüller และรุ่นหลังอย่าง Czerny op. หรือระบบเฉพาะทาง จัดชุดท่อนฝึกไว้ตามปัญหาเทคนิค — นี่คือ \"แคตตาล็อกโจทย์แยกตามอาการ\" เหมือนที่แอปทำกับผู้เรียนวันนี้ แต่ทำด้วยกระดาษเมื่อร้อยปีก่อน",
      "Czerny, Hanon, Burgmüller and later specialists organized drill pieces by technical problem — a \"catalog of exercises by symptom,\" exactly what an app does for learners today, done on paper a century ago.",
      "车尔尼、哈农、布格缪勒及后来的专门体系按技术问题编排练习曲——\"按症状索引的练习目录\"，正是今天应用做的事，一百年前用纸完成。"],
    ["suzuki", "Suzuki — วิธีภาษาแม่จากญี่ปุ่น",
      "Shinichi Suzuki มองว่าเด็กพูดภาษาแม่ได้เพราะได้ยินทุกวันในบริบทรัก — เล่นได้ก่อนอ่านได้ ฟังมากก่อน ผู้ปกครองเป็นครูบ้าน สถาบัน Suzuki แผ่ไปทั่วโลก เพราะแปล \"สิ่งที่ธรรมชาติทำได้อยู่แล้ว\" เป็นวิธีสอน",
      "Shinichi Suzuki saw children speak their mother tongue because they hear it daily in a loving context — play before reading, heavy listening, parents as home teachers; Suzuki institutions spread worldwide by translating \"what nature already does\" into a method.",
      "铃木镇一看到孩子在充满爱的环境里每天听母语就会说话——先会弹再识谱、大量聆听、家长是家庭教师；铃木法把\"自然已做的事\"翻译成了教学法而传遍世界。"],
    ["russian-school", "โรงเรียนรัสเซีย — ระบบฝึกที่ยึดเสียงก่อนกลไก",
      "สายรัสเซีย (ราชมานีนอฟ เลนินกราด/มอสโก จนถึงรุ่นปัจจุบัน) ให้ \"การฟังในหัว\" (inner hearing) นำการซ้อม — ซ้อมเพลงด้วยเสียงที่ได้ยินก่อนในหัว แล้วมือตาม นี่คือนวัตกรรมที่กลายเป็นมาตรฐานการแข่งขันและวิทยาลัยดนตรีทั่วโลก",
      "The Russian school (Rachmaninoff, Moscow/Leningrad lineages to today) puts \"inner hearing\" before mechanics — hear the piece in your head, then let the hands follow; it became the standard of competitions and conservatories worldwide.",
      "俄罗斯学派（拉赫玛尼诺夫、莫斯科/列宁格勒一脉至今）让\"内心听觉\"先于机械动作——先在脑中听见乐曲，再让手跟随；它成为全球比赛与音乐学院的标准。"],
    ["group-lesson", "คาบเรียนกลุ่มและคีย์บอร์ดชุด — เปลี่ยนเศรษฐศาสตร์ของการเรียน",
      "การจัดห้องเรียนกลุ่มพร้อมคีย์บอร์ดรายคน (ยุค Yamaha/คาซิโอแพร่หลาย) ทำให้ค่าเรียนต่อคนลดลงและเด็กเรียนร่วมกันสนุกกว่า — นวัตกรรม \"รูปแบบการจัดคาบ\" ที่ยืนยาวเพราะแก้ปัญหาจริง: ครูไม่พอ",
      "Group rooms with per-student keyboards (as Yamaha/Casio spread) cut per-learner cost and made shared learning fun — a \"lesson-format\" innovation that lasts because it solved a real problem: teacher shortage.",
      "配备每人一台键盘的集体课（雅马哈/卡西欧普及时代）降低人均成本并让共同学习更有趣——\"课堂形式\"创新因解决真问题（师资不足）而长久。"],
    ["app-era", "ยุคแอป/AI — ครูที่ 2 ที่อยู่ในกระเป๋า",
      "แอปฝึกเปียโน + AI วัดจังหวะ/ความแม่นได้รายโน้ต ทำให้เกิด \"ครูที่สอง\" คอยชี้จุดผิดระหว่างคาบกับครู — หลักการที่ซินธิไซเซอร์สอน (สร้างเสียงใหม่ได้) กับที่แอปสอน (สร้างรอบความสนใจใหม่ได้) เหมือนกัน: เทคโนโลยีขยายสิ่งที่คนทำได้ ไม่ใช่แทนที่คน",
      "Piano apps + AI note-level rhythm/accuracy measurement create a \"second teacher\" between lessons — the synth's lesson (create new sounds) and the app's lesson (create new attention) are the same: technology extends what people do, it doesn't replace them.",
      "钢琴应用+AI 逐音符的节奏/准确测量带来课间\"第二位老师\"——合成器的启示（创造新声音）与应用的启示（创造新注意力）相同：技术扩展人的能力，而非取代人。"],
  ];
  for (const [id, th, bodyTh, en, zh] of PED) {
    kb.add({
      id: `inn:ped:${id}`, type: "principle", domain: "music-innovation",
      title: `นวัตกรรมวิธีสอน: ${th}`,
      body: `${bodyTh} (EN: ${en}) (ZH: ${zh})`,
      teach: "เลือกเล่าหนึ่งสายต่อคาบแล้วจบด้วยการลองทำจริงตามแนวคิดนั้น (ฟังก่อนเล่นแบบรัสเซีย / เล่นก่อนอ่านแบบซูซูกิ) — เรื่องเล่าประวัติศาสตร์ต้องจบที่มือของผู้เรียน",
      confidence: 0.75, source: "tiga-industry-craft",
      tags: ["innovation", "pedagogy", id], meta: { family: "pedagogy" },
    });
    out.push(`inn:ped:${id}`);
  }
  return out;
}

/* 5) ดนตรีไทยในกระแสโลก — บทเรียนการผสมสำเนียง
   (ประเด็นข้ามภูมิภาค: ลูกทุ่งบนเปียโน = นวัตกรรมสำเนียงที่ผู้เรียนไทยเข้าถึงได้ทันที) */
export function genInnovationThaiGlobal(kb) {
  const out = [];
  const TH = [
    ["accordion-lukthung", "แอคคอร์เดียนในลูกทุ่ง — เครื่องตะวันตกพูดสำเนียงไทย",
      "แอคคอร์เดียนเดินทางมากับการค้าแล้วกลายเป็นเสียงเอกลักษณ์ของลูกทุ่ง เพราะนักดนตรีเอามันมาเล่นทำนองและสำเนียงไทย ไม่ใช่เลียนแบบฝรั่ง — บทเรียนนวัตกรรม: ของใหม่รอดเมื่อ \"เราเล่นมันแบบเรา\"",
      "The accordion arrived by trade and became a lukthung signature because Thai players made it speak Thai melody and accent, not imitate the West — innovation lesson: new tools survive when \"we play them our way.\"",
      "手风琴随贸易而来，因泰国乐手用它演奏泰式旋律与腔调而成为卢通歌的标志——创新启示：新工具以\"我们自己的方式演奏\"才能存活。"],
    ["thai-scale-piano", "โน้ตไทยบนคีย์บอร์ด — ขยายขอบเขตโดยไม่ต้องเลิกของเดิม",
      "เอาขุน/เดี่ยววงคลาสสิกไทยมาเรียบเรียงบนเปียโน (ทำได้เพราะระบบเสียงใกล้กันพอจะอ่านได้) เปิดทางให้ผู้เรียนไทยเชื่อมบ้านกับคอร์ดเรียนได้ทันที — นวัตกรรมที่ดีไม่จำเป็นต้อง \"ล้มของเก่า\" แค่ \"ต่อสะพาน\"",
      "Arranging Thai classical/homrong repertoire on piano (possible because the tuning systems are close enough to read across) lets Thai learners bridge home and lesson instantly — good innovation needn't dethrone the old, just bridge.",
      "把泰国古典/霍朗曲目改编到钢琴上（因音律接近而可互读）让泰国学习者瞬间连接家庭与课堂——好的创新不必推倒旧物，只需搭桥。"],
  ];
  for (const [id, th, bodyTh, en, zh] of TH) {
    kb.add({
      id: `inn:th:${id}`, type: "strategy", domain: "music-innovation",
      title: `ไทย-โลก: ${th}`,
      body: `${bodyTh} (EN: ${en}) (ZH: ${zh})`,
      teach: "ให้ผู้เรียนเลือกเพลงไทยที่รักแล้วจัดเป็นเวอร์ชันเปียโนของตัวเอง (เวอร์ชันง่ายพอที่จบได้) — ให้ผู้เรียน \"เป็นนวัตกร\" ของสำเนียงบ้านตัวเอง",
      confidence: 0.72, source: "tiga-industry-craft",
      tags: ["innovation", "thai-global", id], meta: { family: "thai-global" },
    });
    out.push(`inn:th:${id}`);
  }
  return out;
}

/* Seed entry point — called from web.js next to the other pillar seeds */
export function seedMusicInnovation(kb) {
  genInnovationPianoGenesis(kb);
  genInnovationRecording(kb);
  genInnovationNotation(kb);
  genInnovationPedagogy(kb);
  genInnovationThaiGlobal(kb);
}
