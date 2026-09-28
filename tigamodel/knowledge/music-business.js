/* ── tigamodel/knowledge/music-business.js — plan v3.4 6.7 (KB ธุรกิจดนตรี)
   กลไกอุตสาหกรรมเชิงคุณภาพ: สตรีมมิ่ง · ลิขสิทธิ์/publishing · sync licensing ·
   เศรษฐศาสตร์งานสด · การจับมือแบรนด์
   กติกาเหล็ก: ไม่มีสถิติ/ตัวเลขอ้างว่างแม้แต่ตัวเดียว (No invented data) —
   อธิบาย 'กลไก' และ 'ความสัมพันธ์' เท่านั้น ซึ่งเป็นความรู้ที่ยอมรับกว้างในวงการ ── */

export function seedMusicBusiness(kb) {
  /* ── สตรีมมิ่งทำงานอย่างไร (กลไก ไม่ใช่ตัวเลข) ── */
  const STREAMING = [
    ["mechanics", "สตรีมมิ่งจ่ายตามการเล่นจริง", "รายได้สตรีมมิ่งมาจาก 'สัดส่วนการเล่น' ของแพลตฟอร์ม — ยิ่งถูกเล่นมากเท่าไรยิ่งได้ส่วนแบ่งมากเท่านั้น ไม่มีราคาต่อครั้งคงที่แบบขายแผ่น",
      "Streaming pays by share of total plays — more plays, bigger slice; there's no fixed per-play price like record sales.",
      "流媒体按播放占比分成——播放越多份额越大，不像卖唱片有固定单价。"],
    ["two-sides", "รายได้แบ่งเป็นสองฝั่ง: บันทึกเสียง vs แต่งเพลง", "เมื่อเพลงถูกเล่น รายได้แยกเป็นสองสาย: ฝั่ง 'การบันทึกเสียง' (คนเล่น/ค่าย) และฝั่ง 'การแต่งเพลง' (คนแต่ง/สำนักพิมพ์เพลง) — คนเดียวที่เขียนเองเล่นเองได้ทั้งสองสาย",
      "One stream pays two lines: the recording side (performers/label) and the composition side (writers/publishers) — a self-written, self-played artist collects both.",
      "一次播放两条收益线：录音侧（表演者/厂牌）与创作侧（词曲/版权代理）——自写自弹的音乐人两头都收。"],
    ["playlist-logic", "เพลย์ลิสต์คือช่องทางค้นพบหลัก", "ยุคนี้ผู้ฟังค้นพบเพลงใหม่ผ่านเพลย์ลิสต์เป็นหลัก — ตัวเพลงต้อง 'เข้ากับบรรยากาศของห้องเพลย์ลิสต์' ไม่ใช่แค่ดัง",
      "Today listeners discover music mainly through playlists — a track must fit the playlist's mood, not just be popular.",
      "如今听众主要通过歌单发现音乐——歌曲要契合歌单氛围，不只是红。"],
    ["consistency", "ความสม่ำเสมอชนะระเบิดครั้งเดียว", "ศิลปินที่ปล่อยเพลงสม่ำเสมอสะสมผู้ฟังได้ดีกว่าที่รอเพลง 'ระเบิด' เพียงครั้งเดียวแล้วหายไป — อัลกอริทึมและผู้ฟังชอบความน่าเชื่อถือ",
      "Consistent releases build audiences better than one explosion followed by silence — algorithms and listeners reward reliability.",
      "稳定发歌比一发即逝更能积累听众——算法和听众都奖励稳定。"],
  ];
  for (const [id, th, bodyTh, en, zh] of STREAMING) {
    kb.add({
      id: `biz:streaming:${id}`, type: "fact", domain: "music-business",
      title: `สตรีมมิ่ง: ${th}`,
      body: `${bodyTh} (EN: ${en}) (ZH: ${zh})`,
      teach: "อธิบายผ่านเพลงที่ผู้เรียนฟัง: 'เพลงนี้อยู่เพลย์ลิสต์ไหน ทำไมเขาเลือกเพลงนี้' — สอนกลไกจากของจริงที่หูได้ยิน",
      confidence: 0.7, source: "tiga-industry-craft",
      tags: ["business", "streaming", id], meta: { family: "streaming" },
    });
  }

  /* ── ลิขสิทธิ์ / publishing ── */
  const RIGHTS = [
    ["copyright-auto", "ลิขสิทธิ์เกิดอัตโนมัติเมื่อสร้าง", "แต่งเพลงจบ = มีลิขสิทธิ์ทันทีตามกฎหมายส่วนใหญ่ของโลก ไม่ต้องจด — แต่การมีหลักฐาน (เดโม่/ไฟล์/วันที่) ช่วยพิสูจน์ยามมีข้อพิพาท",
      "Finishing a song creates copyright automatically in most legal systems — evidence (demos, dated files) still matters in disputes.",
      "写完歌即自动拥有版权（大多数法域）——但演示、带日期的文件在纠纷时仍是证据。"],
    ["publishing-role", "สำนักพิมพ์เพลงทำหน้าที่ 'เก็บเงินให้คนแต่ง'", "publishing คือธุรกิจที่ตามเก็บรายได้การแต่งเพลงจากทุกช่องทาง (เพลย์/ร้องคลุก/ซิงค์) แลกกับส่วนแบ่ง — คนแต่งเข้าใจกลไกนี้ก่อนเซ็นทุกครั้ง",
      "Publishing exists to collect composition income from every channel (plays, covers, sync) for a share — writers should understand this before signing anything.",
      "版权代理的存在是从所有渠道（播放、翻唱、同步授权）为创作者收取收入并分成——创作者签约前必须懂。"],
    ["cover-royalty", "ร้องคลุกเพลงคนอื่น คนแต่งก็ได้ส่วน", "การร้อง/เล่นเพลงของคนอื่นเปิดเผย (คัฟเวอร์) โดยชอบด้วยกฎหมายในหลายระบบ แต่รายได้การแต่งต้องไปถึงคนเขียนต้นฉบับ — กลไกนี้เรียกว่า mechanical/performance royalties",
      "Covering others' songs is lawful in many systems, but composition income must reach the original writers — mechanical/performance royalties.",
      "翻唱他人歌曲在多数体系合法，但创作收入必须到达原词曲作者——即机械/表演版税。"],
    ["sync-meaning", "Sync licensing คือ 'เช่าเพลงให้ภาพ'", "วางเพลงลงหนัง/โฆษณา/เกม ต้องขออนุญาตสองชั้น: จากเจ้าของบันทึกเสียง และเจ้าของการแต่ง — เพลงเสียงต้นฉบับหนึ่งเพลงจึงมีเจ้าของให้ต่อรองสองฝั่ง",
      "Placing a song in film/ads/games needs two clearances: the recording owner and the composition owner — one master, two negotiation tables.",
      "把歌放进影视/广告/游戏需要两层授权：录音所有者与词曲所有者——一首母带，两张谈判桌。"],
  ];
  for (const [id, th, bodyTh, en, zh] of RIGHTS) {
    kb.add({
      id: `biz:rights:${id}`, type: "fact", domain: "music-business",
      title: `ลิขสิทธิ์: ${th}`,
      body: `${bodyTh} (EN: ${en}) (ZH: ${zh})`,
      teach: "ใช้ตอบคำถามจริงของผู้เรียนที่เริ่มแต่งเพลง/อัปโหลดคัฟเวอร์ — เน้น 'เข้าใจก่อนเซ็น' เสมอ ไม่ให้คำแนะนำกฎหมายเฉพาะกรณี",
      confidence: 0.7, source: "tiga-industry-craft",
      tags: ["business", "rights", id], meta: { family: "rights" },
    });
  }

  /* ── เศรษฐศาสตร์งานสด ── */
  const LIVE = [
    ["live-is-core", "งานสดคือเสาหลักรายได้ของนักดนตรีอิสระ", "ยุคสตรีมมิ่ง รายได้หลักของนักดนตรีส่วนใหญ่ย้ายมาที่การแสดงสด — ทักษะ 'เล่นให้คนฟังได้จริง' จึงเป็นทักษะธุรกิจโดยตรง",
      "In the streaming era, most independent musicians' income moved to live performance — 'playable for a real audience' is now a direct business skill.",
      "流媒体时代，独立音乐人的收入主要转向现场演出——'能真正弹给观众听'本身就是商业技能。"],
    ["small-venue-ladder", "บันไดเวที: จากร้านเล็กสู่เวทีใหญ่", "เส้นทางมาตรฐานคือเวทีเล็ก → จนได้เวทีกลาง → เทศกาลดนตรี — แต่ละขั้นพิสูจน์ด้วย 'คนดูกลับมาอีก' ไม่ใช่ตัวเลขผู้ติดตาม",
      "The standard ladder: small venue → mid venue → festivals — each rung proven by returning audiences, not follower counts.",
      "标准阶梯：小场地→中型场地→音乐节——每级都靠回头观众证明，而非粉丝数。"],
    ["door-deal-vs-guarantee", "สองแบบจ่าย: ส่วนแบ่งหน้าประตู หรือค่าจ้างคงที่", "เวทีเล็กมักจ่าย 'ส่วนแบ่งยอดคนเข้า' เวทีใหญ่มักจ่ายค่าจ้างคงที่ — นักดนตรีเข้าใจข้อตกลงก่อนขึ้นเวทีทุกครั้ง",
      "Small stages often pay a door split; bigger stages pay flat guarantees — musicians read the deal before taking the stage.",
      "小场地常按门票分成，大场地常付固定酬金——音乐人上台前先看清条款。"],
  ];
  for (const [id, th, bodyTh, en, zh] of LIVE) {
    kb.add({
      id: `biz:live:${id}`, type: "fact", domain: "music-business",
      title: `งานสด: ${th}`,
      body: `${bodyTh} (EN: ${en}) (ZH: ${zh})`,
      teach: "ผูกกับจุดหมายผู้เรียน: 'อยากเล่นให้คนฟังได้จริง' — ชี้ว่าทุกเพลงที่ซ้อมวันนี้คือหุ้นลงทุนเวทีวันหน้า",
      confidence: 0.7, source: "tiga-industry-craft",
      tags: ["business", "live", id], meta: { family: "live" },
    });
  }

  /* ── การจับมือแบรนด์และคอนเทนต์ ── */
  const BRAND = [
    ["brand-fit", "แบรนด์ซื้อ 'ความรู้สึก' ของศิลปิน ไม่ใช่แค่เพลง", "แบรนด์จับมือกับศิลปินเมื่อโลกภาพของทั้งคู่เข้ากัน — ศิลปินที่รู้ว่าตัวเองคือใคร (positioning) เจรจาได้ดีกว่าที่เก่งแต่ไม่มีทิศทาง",
      "Brands partner on feeling, not just songs — artists who know who they are negotiate better than the skilled-but-aimless.",
      "品牌买的是艺术家的气质，不只是歌——知道自己是谁的艺术家比只会技巧没有定位的更有议价力。"],
    ["content-home", "คอนเทนต์คือหน้าร้านของนักดนตรียุคนี้", "คลิปเล่นสั้น ๆ เป็นวิธีที่ผู้ฟังรู้จักศิลปินใหม่เป็นจำนวนมาก — 'เล่นให้ดูได้ทุกวัน' จึงเป็นทักษะอาชีพเดียวกับการซ้อม",
      "Short playing clips are how many listeners discover new artists — 'showing up daily' is as professional as rehearsing.",
      "短视频是许多听众发现新音乐人的方式——'每天出现'与练琴同样是职业素养。"],
    ["diversify", "อาชีพนักดนตรียุคนี้คือพอร์ตโฟลิโอ", "รายได้นักดนตรีมาจากหลายสายรวมกัน: สอน · รับจ้างเล่น · แต่งขาย · คอนเทนต์ · งานสด — พึ่งสายเดียวเปราะ ผสมหลายสายยั่งยืน",
      "A modern music career is a portfolio: teaching, session work, writing, content, live — one stream is fragile, several are sustainable.",
      "现代音乐生涯是组合：教学、伴奏、创作、内容、演出——单一收入脆弱，多线并存可持续。"],
  ];
  for (const [id, th, bodyTh, en, zh] of BRAND) {
    kb.add({
      id: `biz:brand:${id}`, type: "principle", domain: "music-business",
      title: `อาชีพดนตรี: ${th}`,
      body: `${bodyTh} (EN: ${en}) (ZH: ${zh})`,
      teach: "ตอบคำถาม 'เรียนแล้วไปได้อะไร' ด้วยกรอบพอร์ตโฟลิโอ — หลีกเลี่ยงการสรุปแทนผู้เรียน ให้เห็นตัวเลือกทั้งหมด (6.9 อ้าง entry กลุ่มนี้)",
      confidence: 0.72, source: "tiga-industry-craft",
      tags: ["business", "career", id], meta: { family: "career" },
    });
  }
}
