import {
  claimModeratorAccess,
  deleteTalk,
  getTalkSettings,
  isCurrentUserModerator,
  scheduleExpiryCleanup,
  setQuestionVisibility,
  setTalkQuestionsOpen,
  subscribeToQuestions,
  subscribeToTalkSettings,
} from './firebase-store.js';
import { renderQr } from './qr.js';
import {
  buildTalkUrl,
  debounce,
  formatRemaining,
  formatTime,
  qs,
  setNotice,
  talkIdFromUrl,
} from './utils.js';

const $ = (id) => document.getElementById(id);
let talkId;
let settings;
let questions = [];
let stopQuestionsSubscription;
let stopSettingsSubscription;

function statusText(value) {
  return ({ pending: '待審核', published: '已公開', hidden: '已隱藏', private: '不公開' })[value] || value;
}

function updateStats() {
  $('sTotal').textContent = questions.length;
  $('sPending').textContent = questions.filter((item) => item.visibility === 'pending').length;
  $('sPublished').textContent = questions.filter((item) => item.visibility === 'published').length;
  $('sHidden').textContent = questions.filter((item) => ['hidden', 'private'].includes(item.visibility)).length;
  $('sync').textContent = `即時同步｜自動刪除時間：剩餘 ${formatRemaining(settings.expires_at)}`;
}

function csvValue(value) {
  const text = String(value ?? '');
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

function csvTime(value) {
  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

function downloadQuestionsCsv() {
  const columns = ['調查 ID', '演講名稱', '提問 ID', '暱稱', '問題內容', '同意公開', '狀態', '提問時間', '最後更新時間'];
  const rows = questions.map((question) => [
    talkId,
    settings.title,
    question.question_id,
    question.nickname,
    question.question_text,
    question.submitter_allows_public ? '是' : '否',
    statusText(question.visibility),
    csvTime(question.created_at),
    csvTime(question.updated_at),
  ]);
  const csv = [columns, ...rows].map((row) => row.map(csvValue).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeTitle = settings.title.replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 60) || 'TalkQ';
  link.href = url;
  link.download = `${safeTitle}-${talkId}-全部提問.csv`;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  setNotice($('notice'), `已下載 ${questions.length} 筆提問資料。`, 'success');
}

function updateTalkControls() {
  const questionsOpen = settings?.questions_open !== false;
  const state = $('questionsState');
  const toggle = $('toggleQuestions');
  state.textContent = questionsOpen ? '提問開放中' : '提問已關閉';
  state.className = `badge ${questionsOpen ? 'open' : 'closed'}`;
  toggle.textContent = questionsOpen ? '關閉提問' : '重新開啟提問';
  toggle.className = `btn ${questionsOpen ? 'btn-danger' : 'btn-success'}`;
}

function render() {
  const filter = $('filter').value;
  const search = $('search').value.trim().toLowerCase();
  const descending = $('sort').value === 'desc';
  let items = questions.filter((question) => (
    (filter === 'all' || question.visibility === filter)
    && (!search || question.nickname.toLowerCase().includes(search) || question.question_text.toLowerCase().includes(search))
  ));
  if (descending) items = [...items].reverse();
  $('list').innerHTML = '';
  if (!items.length) {
    $('list').innerHTML = '<div class="empty">沒有符合條件的問題</div>';
    return;
  }
  for (const question of items) {
    const card = document.createElement('article');
    card.className = 'question-card';
    card.dataset.status = question.visibility;
    const meta = document.createElement('div');
    meta.className = 'question-meta';
    const time = document.createElement('span');
    time.textContent = formatTime(question.created_at);
    const nickname = document.createElement('strong');
    nickname.textContent = question.nickname;
    const allow = document.createElement('span');
    allow.textContent = `同意公開：${question.submitter_allows_public ? '是' : '否'}`;
    meta.append(time, nickname, allow);
    const text = document.createElement('div');
    text.className = 'question-text';
    text.textContent = question.question_text;
    const badge = document.createElement('span');
    badge.className = `badge ${question.visibility}`;
    badge.textContent = statusText(question.visibility);
    const row = document.createElement('div');
    row.className = 'button-row';
    row.style.marginTop = '12px';
    if (question.submitter_allows_public && question.visibility !== 'published') {
      const publish = document.createElement('button');
      publish.className = 'btn btn-success';
      publish.textContent = question.visibility === 'hidden' ? '重新公開' : '公開';
      publish.onclick = () => changeVisibility(question, 'published', publish);
      row.append(publish);
    }
    if (!['hidden', 'private'].includes(question.visibility)) {
      const hide = document.createElement('button');
      hide.className = 'btn btn-danger';
      hide.textContent = '隱藏';
      hide.onclick = () => changeVisibility(question, 'hidden', hide);
      row.append(hide);
    }
    card.append(meta, text, badge, row);
    $('list').append(card);
  }
}

async function changeVisibility(question, visibility, button) {
  button.disabled = true;
  try {
    await setQuestionVisibility(talkId, question, visibility);
    setNotice($('notice'), visibility === 'published' ? '問題已公開。' : '問題已隱藏。', 'success');
  } catch (error) {
    setNotice($('notice'), `操作失敗：${error.message}`, 'error');
    button.disabled = false;
  }
}

function showExpired() {
  $('workspace').classList.add('hidden');
  $('authGate').classList.add('hidden');
  setNotice($('notice'), '這個問題留言板已超過三天並到期，資料已停止顯示。', 'warn');
}

async function enterModerator(key = '') {
  let hasAccess = await isCurrentUserModerator(talkId);
  if (!hasAccess && key) {
    await claimModeratorAccess(talkId, key);
    hasAccess = await isCurrentUserModerator(talkId);
  }
  if (!hasAccess) return false;
  $('authGate').classList.add('hidden');
  $('workspace').classList.remove('hidden');
  stopSettingsSubscription?.();
  stopQuestionsSubscription?.();
  stopSettingsSubscription = await subscribeToTalkSettings(talkId, (nextSettings) => {
    if (!nextSettings) {
      $('workspace').classList.add('hidden');
      setNotice($('notice'), '這個問題留言板已被刪除。', 'warn');
      return;
    }
    settings = nextSettings;
    updateTalkControls();
    updateStats();
  }, () => setNotice($('notice'), '提問狀態同步中斷，請重新整理頁面。', 'error'));
  stopQuestionsSubscription = await subscribeToQuestions(talkId, (items) => {
    questions = items;
    updateStats();
    render();
  }, () => setNotice($('notice'), '即時同步中斷，請重新整理頁面。', 'error'));
  return true;
}

async function toggleQuestions() {
  const button = $('toggleQuestions');
  const nextOpen = settings.questions_open === false;
  button.disabled = true;
  try {
    await setTalkQuestionsOpen(talkId, nextOpen);
    settings.questions_open = nextOpen;
    updateTalkControls();
    setNotice($('notice'), nextOpen ? '已重新開啟提問。' : '已關閉提問，聽眾暫時無法投稿。', 'success');
  } catch (error) {
    setNotice($('notice'), `操作失敗：${error.message}`, 'error');
  } finally {
    button.disabled = false;
  }
}

async function removeTalk() {
  if (!window.confirm(`確定要永久刪除「${settings.title}」與所有提問嗎？此操作無法復原。`)) return;
  const deleteButton = $('deleteTalk');
  deleteButton.disabled = true;
  $('toggleQuestions').disabled = true;
  try {
    await deleteTalk(talkId);
    window.location.assign('./index.html');
  } catch (error) {
    setNotice($('notice'), `刪除失敗：${error.message}`, 'error');
    deleteButton.disabled = false;
    $('toggleQuestions').disabled = false;
  }
}

async function initialize() {
  try {
    talkId = talkIdFromUrl();
    settings = await getTalkSettings(talkId);
    if (!settings) throw new Error('找不到這個問題留言板，可能已到期並清除。');
    $('title').textContent = `${settings.title}｜提問管理`;
    document.title = `${settings.title}｜TalkQ 管理`;
    if (Date.now() >= Number(settings.expires_at)) {
      scheduleExpiryCleanup(talkId, settings, showExpired);
      return;
    }
    scheduleExpiryCleanup(talkId, settings, showExpired, () => questions.map((item) => item.question_id));
    const askUrl = buildTalkUrl('ask.html', talkId);
    const publicUrl = buildTalkUrl('public.html', talkId);
    $('askLink').href = askUrl;
    $('publicLink').href = publicUrl;
    renderQr($('askQr'), askUrl);
    renderQr($('publicQr'), publicUrl);
    const key = qs('moderator_key');
    try {
      if (await enterModerator(key)) return;
    } catch {
      setNotice($('notice'), '管理密鑰不正確，請重新輸入。', 'error');
    }
    $('authGate').classList.remove('hidden');
  } catch (error) {
    setNotice($('notice'), error.message, 'error');
    $('workspace').classList.add('hidden');
  }
}

$('loginButton').onclick = async () => {
  const key = $('moderatorKeyInput').value.trim();
  $('loginButton').disabled = true;
  try {
    if (!await enterModerator(key)) throw new Error('密鑰驗證失敗。');
  } catch (error) {
    setNotice($('notice'), error.message, 'error');
  } finally {
    $('loginButton').disabled = false;
  }
};
$('filter').onchange = render;
$('sort').onchange = render;
$('search').oninput = debounce(render, 150);
$('refresh').onclick = () => location.reload();
$('downloadCsv').onclick = downloadQuestionsCsv;
$('toggleQuestions').onclick = toggleQuestions;
$('deleteTalk').onclick = removeTalk;
initialize();
