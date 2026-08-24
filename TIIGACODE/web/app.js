const state = {
  messages: [],
  models: [],
  currentModel: null,
};

const el = {
  messages: document.getElementById('messages'),
  input: document.getElementById('input'),
  sendBtn: document.getElementById('sendBtn'),
  modelSelect: document.getElementById('modelSelect'),
  clearBtn: document.getElementById('clearBtn'),
  errorBanner: document.getElementById('errorBanner'),
};

function renderMessages() {
  el.messages.innerHTML = '';
  for (const m of state.messages) {
    const bubble = document.createElement('div');
    bubble.className = `bubble ${m.role}`;
    bubble.textContent = m.content;
    el.messages.appendChild(bubble);
  }
  el.messages.scrollTop = el.messages.scrollHeight;
}

function showError(message) {
  el.errorBanner.textContent = message;
  el.errorBanner.hidden = false;
}

function clearError() {
  el.errorBanner.hidden = true;
}

function showTyping() {
  const bubble = document.createElement('div');
  bubble.className = 'bubble assistant typing';
  bubble.id = 'typingBubble';
  bubble.textContent = 'กำลังพิมพ์…';
  el.messages.appendChild(bubble);
  el.messages.scrollTop = el.messages.scrollHeight;
}

function hideTyping() {
  document.getElementById('typingBubble')?.remove();
}

async function loadModels() {
  const res = await fetch('/api/models');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  state.models = data.models;
  state.currentModel = data.defaultModel;
  el.modelSelect.innerHTML = state.models.map((m) => `<option value="${m.id}">${m.label}</option>`).join('');
  el.modelSelect.value = state.currentModel;
}

el.modelSelect.addEventListener('change', () => {
  state.currentModel = el.modelSelect.value;
});

el.clearBtn.addEventListener('click', () => {
  state.messages = [];
  renderMessages();
  clearError();
});

async function sendMessage() {
  const text = el.input.value.trim();
  if (!text) return;
  clearError();
  state.messages.push({ role: 'user', content: text });
  el.input.value = '';
  el.input.style.height = 'auto';
  renderMessages();
  el.sendBtn.disabled = true;
  showTyping();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ modelId: state.currentModel, messages: state.messages }),
    });
    const data = await res.json();
    hideTyping();
    if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
    state.messages.push({ role: 'assistant', content: data.content });
    renderMessages();
  } catch (err) {
    hideTyping();
    showError(err.message);
  } finally {
    el.sendBtn.disabled = false;
  }
}

el.sendBtn.addEventListener('click', sendMessage);
el.input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
el.input.addEventListener('input', () => {
  el.input.style.height = 'auto';
  el.input.style.height = `${Math.min(el.input.scrollHeight, 200)}px`;
});

loadModels().catch((err) => showError(`โหลดรายชื่อโมเดลไม่สำเร็จ: ${err.message}`));
