import {
  claimModeratorAccess,
  getTalkSettings,
  isCurrentUserModerator,
  scheduleExpiryCleanup,
  setQuestionVisibility,
  subscribeToQuestions,
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

function statusText(value) {
  return ({ pending: '待審核', published: '已公開', hidden: '已隱藏', private: '不公開' })[value] || value;
}

function updateStats() {
  $('sTotal').textContent = questions.length;
  $('sPending').textContent = questions.filter((item) => item.visibility === 'pending').length;
  $('sPublished').textContent = questions.filter((item) => item.visibility === 'published').length;
  $('sHidden').textContent = questions.filter((item) => ['hidden', 'private'].includes(item.visibility)).length;
  $('sync').textContent = `即時同步｜剩餘 ${formatRemaining(settings.expires_at)}`;
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
  await subscribeToQuestions(talkId, (items) => {
    questions = items;
    updateStats();
    render();
  }, () => setNotice($('notice'), '即時同步中斷，請重新整理頁面。', 'error'));
  return true;
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
initialize();
