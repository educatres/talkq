export function qs(name) {
  return new URLSearchParams(location.search).get(name) || '';
}

export function randomId(prefix = 'id') {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const suffix = [...bytes].map((byte) => byte.toString(36).padStart(2, '0')).join('');
  return `${prefix}_${Date.now().toString(36)}_${suffix}`;
}

export function randomPin(length = 6) {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return [...bytes].map((value) => String(value % 10)).join('');
}

export function talkIdFromUrl() {
  const talkId = qs('talk_id');
  if (!/^talk_[a-z0-9_]+$/i.test(talkId)) {
    throw new Error('網址缺少有效的演講 ID，請向講師索取正確連結。');
  }
  return talkId;
}

export function buildTalkUrl(page, talkId, extra = {}) {
  const url = new URL(page, new URL('.', location.href));
  url.searchParams.set('talk_id', talkId);
  Object.entries(extra).forEach(([name, value]) => {
    if (value) url.searchParams.set(name, value);
  });
  return url.toString();
}

export function formatTime(value) {
  const date = new Date(Number(value));
  return Number.isNaN(date.getTime())
    ? '時間不明'
    : new Intl.DateTimeFormat('zh-TW', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date);
}

export function formatRemaining(expiresAt) {
  const remaining = Number(expiresAt) - Date.now();
  if (remaining <= 0) return '已到期';
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  return `${days} 天 ${hours} 小時 ${minutes} 分`;
}

export function setNotice(element, message, type = '') {
  element.textContent = message;
  element.className = `notice ${type}`.trim();
  element.classList.remove('hidden');
}

export function copyText(text) {
  return navigator.clipboard?.writeText(text).catch(() => fallbackCopy(text)) || fallbackCopy(text);
}

function fallbackCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.append(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
  return Promise.resolve();
}

export function debounce(fn, milliseconds) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), milliseconds);
  };
}

export function downloadCanvas(canvas, name) {
  const link = document.createElement('a');
  link.download = name;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
