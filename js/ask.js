import {
  getTalkSettings,
  scheduleExpiryCleanup,
  submitQuestion,
  subscribeToTalkSettings,
} from './firebase-store.js';
import { formatRemaining, setNotice, talkIdFromUrl } from './utils.js';

const $ = (id) => document.getElementById(id);
const notice = $('notice');
let talkId;
let settings;
let expiryInterval;
let submitting = false;

function updateAvailability() {
  const active = settings && Date.now() < Number(settings.expires_at);
  const questionsOpen = active && settings.questions_open !== false;
  $('submitBtn').disabled = submitting || !questionsOpen;
  if (active && !questionsOpen) {
    setNotice($('availabilityNotice'), '講師目前已關閉提問；重新開啟後即可繼續送出問題。', 'warn');
  } else {
    $('availabilityNotice').classList.add('hidden');
  }
}

function showExpired() {
  clearInterval(expiryInterval);
  $('askForm').classList.add('hidden');
  setNotice(notice, '這個問題留言板已超過三天並到期，無法再送出提問。', 'warn');
  $('remaining').textContent = '已到期';
}

function showDeleted() {
  clearInterval(expiryInterval);
  $('askForm').classList.add('hidden');
  $('availabilityNotice').classList.add('hidden');
  setNotice(notice, '這個問題留言板已被講師刪除。', 'warn');
  $('remaining').textContent = '已刪除';
}

function updateRemaining() {
  if (!settings) return;
  $('remaining').textContent = formatRemaining(settings.expires_at);
  if (Date.now() >= Number(settings.expires_at)) showExpired();
  else updateAvailability();
}

async function initialize() {
  try {
    talkId = talkIdFromUrl();
    settings = await getTalkSettings(talkId);
    if (!settings) throw new Error('找不到這個問題留言板，可能已到期並清除。');
    $('title').textContent = settings.title;
    document.title = `${settings.title}｜TalkQ 提問`;
    const remembered = localStorage.getItem('talkq:nickname');
    if (remembered) $('nickname').value = remembered;
    updateRemaining();
    expiryInterval = setInterval(updateRemaining, 60000);
    scheduleExpiryCleanup(talkId, settings, showExpired);
    await subscribeToTalkSettings(talkId, (nextSettings) => {
      if (!nextSettings) return showDeleted();
      settings = nextSettings;
      updateRemaining();
    }, () => setNotice(notice, '提問狀態同步中斷，請重新整理頁面。', 'error'));
  } catch (error) {
    setNotice(notice, error.message, 'error');
    $('askForm').classList.add('hidden');
  }
}

$('question').addEventListener('input', () => {
  $('count').textContent = $('question').value.length;
});
$('askForm').addEventListener('reset', () => setTimeout(() => {
  $('count').textContent = '0';
}));
$('askForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const nickname = $('nickname').value.trim();
  const questionText = $('question').value.trim();
  const allowsPublic = $('allowPublic').checked;
  if (!settings || Date.now() >= Number(settings.expires_at)) return showExpired();
  if (settings.questions_open === false) return setNotice(notice, '講師目前已關閉提問。', 'warn');
  if (!nickname || !questionText) return setNotice(notice, '請填寫暱稱與問題。', 'error');
  const recent = Number(localStorage.getItem('talkq:last-submit') || 0);
  if (Date.now() - recent < 5000) return setNotice(notice, '請稍候幾秒再送出下一題。', 'warn');

  submitting = true;
  updateAvailability();
  try {
    const question = await submitQuestion(talkId, {
      nickname,
      questionText,
      allowsPublic,
      defaultPublishMode: settings.default_publish_mode,
    });
    localStorage.setItem('talkq:last-submit', String(Date.now()));
    if ($('rememberName').checked) localStorage.setItem('talkq:nickname', nickname);
    else localStorage.removeItem('talkq:nickname');
    $('question').value = '';
    $('count').textContent = '0';
    const message = question.visibility === 'published'
      ? '已送出提問，現在會顯示於公開清單。'
      : question.visibility === 'private'
        ? '已送出提問；這則問題只供講師查看。'
        : '已送出提問，請等待講師審核。';
    setNotice(notice, message, 'success');
  } catch (error) {
    const message = settings?.questions_open === false
      ? '講師目前已關閉提問。'
      : `送出失敗：${error.message || '請檢查網路後再試。'}`;
    setNotice(notice, message, settings?.questions_open === false ? 'warn' : 'error');
  } finally {
    setTimeout(() => {
      submitting = false;
      updateAvailability();
    }, 1200);
  }
});

$('submitBtn').disabled = true;
initialize();
