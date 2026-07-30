import {
  getTalkSettings,
  scheduleExpiryCleanup,
  subscribeToPublishedQuestions,
} from './firebase-store.js';
import { formatRemaining, formatTime, setNotice, talkIdFromUrl } from './utils.js';

const $ = (id) => document.getElementById(id);
let talkId;
let settings;
let questions = [];
let lastCount = 0;

function render() {
  $('list').innerHTML = '';
  if (!questions.length) {
    $('list').innerHTML = '<div class="card empty">目前還沒有公開的問題<br>歡迎掃描 QR Code 提問</div>';
  } else {
    questions.forEach((question, index) => {
      const card = document.createElement('article');
      card.className = 'question-card';
      card.dataset.status = 'published';
      const meta = document.createElement('div');
      meta.className = 'question-meta';
      const number = document.createElement('strong');
      number.textContent = `Q${index + 1}`;
      const time = document.createElement('span');
      time.textContent = formatTime(question.created_at);
      meta.append(number, time);
      if (!$('hideName').checked) {
        const name = document.createElement('span');
        name.textContent = question.nickname;
        meta.append(name);
      }
      const text = document.createElement('div');
      text.className = 'question-text';
      text.textContent = question.question_text;
      card.append(meta, text);
      $('list').append(card);
    });
  }
  $('sync').textContent = `共 ${questions.length} 題｜即時同步｜剩餘 ${formatRemaining(settings.expires_at)}`;
  if (questions.length > lastCount && $('autoScroll').checked) {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }
  lastCount = questions.length;
}

function showExpired() {
  questions = [];
  $('list').innerHTML = '<div class="card empty">這個問題留言板已到期並清除</div>';
  $('sync').textContent = '已到期';
  setNotice($('notice'), '留言板建立已超過三天，資料已停止顯示。', 'warn');
}

async function initialize() {
  try {
    talkId = talkIdFromUrl();
    settings = await getTalkSettings(talkId);
    if (!settings) throw new Error('找不到這個問題留言板，可能已到期並清除。');
    $('title').textContent = `${settings.title}｜公開問題`;
    document.title = `${settings.title}｜TalkQ 公開問題`;
    if (Date.now() >= Number(settings.expires_at)) {
      scheduleExpiryCleanup(talkId, settings, showExpired);
      return;
    }
    scheduleExpiryCleanup(talkId, settings, showExpired, () => questions.map((item) => item.question_id));
    await subscribeToPublishedQuestions(talkId, (items) => {
      questions = items;
      render();
    }, () => setNotice($('notice'), '即時同步中斷，請重新整理頁面。', 'error'));
  } catch (error) {
    setNotice($('notice'), error.message, 'error');
    showExpired();
  }
}

$('hideName').onchange = render;
$('refresh').onclick = () => location.reload();
initialize();
