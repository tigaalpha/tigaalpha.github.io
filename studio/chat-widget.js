/**
 * TIGA AI chat widget — embed anywhere with one script tag:
 *
 *   <div id="tiga-widget"></div>
 *   <script src="/studio/chat-widget.js"></script>
 *   <script>
 *     window.TIGA_WIDGET_CONFIG = {
 *       url: "https://<supabase-ref>.supabase.co/functions/v1/web-chat",
 *       secret: "<web_chat_secret จาก Settings>",
 *       title: "คุยกับ TIGA",
 *       subtitle: "ตอบไว พร้อมช่วยเรื่องคอร์สเรียนเปียโน",
 *     };
 *   </script>
 *
 * The secret is a shared site-embed key (integration_settings `web_chat_secret`),
 * by design visible in the page — it only gates the widget endpoint from
 * being hammered by strangers. No external dependencies.
 *
 * A tiny lead form (name + phone, both optional but encouraged) shows the
 * first time a visitor opens the chat. Whatever they type is sent with the
 * first message, so the visitor becomes a real CRM lead instead of an
 * anonymous conversation — the AI can then actually sell to them.
 */
(function () {
  var CONFIG = window.TIGA_WIDGET_CONFIG || {};
  var API_URL = CONFIG.url;
  var SECRET = CONFIG.secret || "";
  var TITLE = CONFIG.title || "คุยกับเรา";
  var SUBTITLE = CONFIG.subtitle || "ตอบไว เป็นกันเอง";

  if (!API_URL || !SECRET) {
    console.warn("[TIGA widget] ตั้งค่า window.TIGA_WIDGET_CONFIG (url + secret) ก่อน");
    return;
  }

  var STORAGE_KEY = "tiga_widget_conv";
  var LEAD_KEY = "tiga_widget_lead";
  var open = false;
  var messages = [];

  function conversationId() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function saveConversationId(id) {
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch (e) {}
  }

  function getLead() {
    try {
      var raw = localStorage.getItem(LEAD_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || (!parsed.name && !parsed.phone)) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function saveLead(name, phone) {
    try {
      localStorage.setItem(LEAD_KEY, JSON.stringify({ name: name, phone: phone }));
    } catch (e) {}
  }

  var host = document.getElementById("tiga-widget") || document.body;
  var style = document.createElement("style");
  style.textContent =
    "#tiga-widget *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif}" +
    ".tiga-btn{position:fixed;right:20px;bottom:20px;z-index:99990;width:60px;height:60px;border-radius:50%;border:none;cursor:pointer;background:#06c755;color:#fff;font-size:26px;box-shadow:0 6px 20px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center}" +
    ".tiga-btn:hover{transform:scale(1.05)}" +
    ".tiga-panel{position:fixed;right:20px;bottom:92px;z-index:99991;width:360px;max-width:calc(100vw - 40px);height:480px;max-height:calc(100vh - 130px);border-radius:16px;overflow:hidden;display:none;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,.3);background:#fff;border:1px solid rgba(0,0,0,.08)}" +
    ".tiga-panel.open{display:flex}" +
    ".tiga-head{background:#06c755;color:#fff;padding:14px 16px}" +
    ".tiga-head b{display:block;font-size:15px}" +
    ".tiga-head span{font-size:12px;opacity:.9}" +
    ".tiga-msgs{flex:1;overflow-y:auto;padding:14px;background:#d2e5f5;display:flex;flex-direction:column;gap:8px}" +
    ".tiga-msg{max-width:80%;padding:9px 12px;border-radius:14px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}" +
    ".tiga-msg.in{background:#fff;align-self:flex-start;border-bottom-left-radius:4px}" +
    ".tiga-msg.out{background:#06c755;color:#fff;align-self:flex-end;border-bottom-right-radius:4px}" +
    ".tiga-input{display:flex;gap:8px;padding:10px;border-top:1px solid rgba(0,0,0,.06);background:#fff}" +
    ".tiga-input textarea{flex:1;resize:none;border:1px solid rgba(0,0,0,.12);border-radius:10px;padding:9px 11px;font-size:14px;outline:none;font-family:inherit}" +
    ".tiga-input button{border:none;background:#06c755;color:#fff;border-radius:10px;padding:0 16px;font-size:14px;cursor:pointer;font-weight:600}" +
    ".tiga-lead{background:#e8f6ee;padding:10px 12px;border-bottom:1px solid rgba(6,199,85,.25);display:flex;flex-direction:column;gap:6px}" +
    ".tiga-lead input{border:1px solid rgba(0,0,0,.14);border-radius:8px;padding:7px 10px;font-size:13px;outline:none;font-family:inherit}" +
    ".tiga-lead button{border:none;background:#06c755;color:#fff;border-radius:8px;padding:7px 10px;font-size:13px;cursor:pointer;font-weight:600}" +
    ".tiga-lead small{font-size:11px;color:#5b6b5f}";
  document.head.appendChild(style);

  var btn = document.createElement("button");
  btn.className = "tiga-btn";
  btn.setAttribute("aria-label", TITLE);
  btn.textContent = "\uD83D\uDCAC";
  btn.onclick = function () {
    open = !open;
    panel.classList.toggle("open", open);
    if (open) {
      if (getLead()) input.focus();
      else leadName.focus();
    }
  };

  var panel = document.createElement("div");
  panel.className = "tiga-panel";
  var head = document.createElement("div");
  head.className = "tiga-head";
  head.innerHTML = "<b>" + escapeHtml(TITLE) + "</b><span>" + escapeHtml(SUBTITLE) + "</span>";

  // Lead form: shown until the visitor submits it once (persisted), then
  // never again on this browser. Submitting just saves — chatting stays open.
  var leadBar = document.createElement("div");
  leadBar.className = "tiga-lead";
  var leadName = document.createElement("input");
  leadName.placeholder = "ชื่อ (ไม่บังคับ)";
  leadName.maxLength = 80;
  var leadPhone = document.createElement("input");
  leadPhone.placeholder = "เบอร์โทร (ไม่บังคับ)";
  leadPhone.maxLength = 20;
  var leadSubmit = document.createElement("button");
  leadSubmit.textContent = "เริ่มคุย";
  leadSubmit.onclick = function () {
    saveLead(leadName.value.trim(), leadPhone.value.trim());
    leadBar.remove();
    input.focus();
  };
  leadName.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      leadSubmit.click();
    }
  });
  leadPhone.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      leadSubmit.click();
    }
  });
  leadBar.appendChild(leadName);
  leadBar.appendChild(leadPhone);
  leadBar.appendChild(leadSubmit);

  var msgs = document.createElement("div");
  msgs.className = "tiga-msgs";
  var inputRow = document.createElement("div");
  inputRow.className = "tiga-input";
  var input = document.createElement("textarea");
  input.rows = 1;
  input.placeholder = "พิมพ์ข้อความ…";
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });
  var sendBtn = document.createElement("button");
  sendBtn.textContent = "ส่ง";
  sendBtn.onclick = send;
  inputRow.appendChild(input);
  inputRow.appendChild(sendBtn);
  panel.appendChild(head);
  if (!getLead()) panel.appendChild(leadBar);
  panel.appendChild(msgs);
  panel.appendChild(inputRow);

  if (document.getElementById("tiga-widget")) host.appendChild(panel);
  else {
    document.body.appendChild(btn);
    document.body.appendChild(panel);
  }

  addMsg("สวัสดีค่ะ ยินดีช่วยเหลือเรื่องคอร์สเรียนเปียโน ถามได้เลยค่ะ 😊", "in");

  function send() {
    var text = input.value.trim();
    if (!text) return;
    addMsg(text, "out");
    input.value = "";
    var typing = addMsg("กำลังพิมพ์…", "in");
    sendBtn.disabled = true;

    var body = { conversationId: conversationId(), message: text };
    var lead = getLead();
    if (lead) body.lead = lead;

    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-web-chat-secret": SECRET },
      body: JSON.stringify(body),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (r) {
        typing.remove();
        if (r.ok && r.data && r.data.reply) {
          addMsg(r.data.reply, "in");
          if (r.data.conversationId) saveConversationId(r.data.conversationId);
        } else {
          addMsg("ขออภัยค่ะ ระบบขัดข้องชั่วคราว รบกวนลองใหม่อีกครั้งนะคะ", "in");
        }
      })
      .catch(function () {
        typing.remove();
        addMsg("ขออภัยค่ะ ระบบขัดข้องชั่วคราว รบกวนลองใหม่อีกครั้งนะคะ", "in");
      })
      .finally(function () {
        sendBtn.disabled = false;
        input.focus();
      });
  }

  function addMsg(text, kind) {
    var el = document.createElement("div");
    el.className = "tiga-msg " + kind;
    el.textContent = text;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
    return el;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
