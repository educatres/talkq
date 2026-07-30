import { createTalk } from './firebase-store.js';
import { renderQr } from './qr.js';
import {
  buildTalkUrl,
  copyText,
  downloadCanvas,
  randomId,
  randomPin,
  setNotice,
} from './utils.js';

const $ = (id) => document.getElementById(id);
const notice = $('notice');
const outputs = $('outputs');

function newTalkId() {
  $('talkId').value = randomId('talk');
}

function linkCard(label, url, key) {
  const box = document.createElement('div');
  box.className = 'link-box';
  const heading = document.createElement('h3');
  heading.textContent = label;
  const qr = document.createElement('div');
  qr.className = 'qr';
  const output = document.createElement('div');
  output.className = 'url-output';
  output.textContent = url;
  const row = document.createElement('div');
  row.className = 'button-row';
  row.style.justifyContent = 'center';

  const copy = document.createElement('button');
  copy.className = 'btn';
  copy.textContent = '複製網址';
  copy.onclick = () => copyText(url).then(() => setNotice(notice, '網址已複製。', 'success'));

  const download = document.createElement('button');
  download.className = 'btn';
  download.textContent = '下載 QR';
  download.onclick = () => {
    const canvas = qr.querySelector('canvas');
    if (canvas) downloadCanvas(canvas, `${key}-qr.png`);
  };

  const open = document.createElement('a');
  open.className = 'btn btn-primary';
  open.textContent = '開啟';
  open.href = url;
  open.target = '_blank';
  open.rel = 'noopener';
  row.append(copy, download, open);
  box.append(heading, qr, output, row);
  setTimeout(() => renderQr(qr, url), 0);
  return box;
}

function rememberTalk(talk) {
  const key = 'talkq:created-talks:v2';
  let talks = [];
  try {
    talks = JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    talks = [];
  }
  talks = [talk, ...talks.filter((item) => item.talkId !== talk.talkId)].slice(0, 20);
  localStorage.setItem(key, JSON.stringify(talks));
}

async function generate() {
  const talkId = $('talkId').value.trim();
  const talkTitle = $('talkTitle').value.trim();
  const defaultPublishMode = $('publishMode').value;
  if (!talkId || !talkTitle) {
    setNotice(notice, '請填寫演講名稱與演講 ID。', 'error');
    return;
  }

  const button = $('generate');
  button.disabled = true;
  setNotice(notice, '正在建立三天有效的 Firebase 問題留言板…');
  try {
    const moderatorKey = randomPin(6);
    const settings = await createTalk({ talkId, talkTitle, defaultPublishMode, moderatorKey });
    const askUrl = buildTalkUrl('ask.html', talkId);
    const moderatorUrl = buildTalkUrl('moderator.html', talkId, { moderator_key: moderatorKey });
    const publicUrl = buildTalkUrl('public.html', talkId);

    outputs.innerHTML = '';
    outputs.append(
      linkCard('1. 提問專用頁', askUrl, 'ask'),
      linkCard('2. 講師管理頁', moderatorUrl, 'moderator'),
      linkCard('3. 公開問題清單', publicUrl, 'public'),
    );
    outputs.classList.remove('hidden');
    $('moderatorKey').textContent = moderatorKey;
    $('expiresAt').textContent = new Date(settings.expires_at).toLocaleString('zh-TW');
    $('credentials').classList.remove('hidden');
    rememberTalk({ talkId, talkTitle, moderatorKey, moderatorUrl, expiresAt: settings.expires_at });
    setNotice(notice, '留言板已建立。請妥善保存講師管理網址；三天後資料會到期並清除。', 'success');
    newTalkId();
  } catch (error) {
    const message = error?.code === 'PERMISSION_DENIED'
      ? '建立失敗：請確認 Firebase 匿名驗證與資料庫規則已部署。'
      : `建立失敗：${error.message || '請稍後再試。'}`;
    setNotice(notice, message, 'error');
  } finally {
    button.disabled = false;
  }
}

newTalkId();
$('newId').onclick = newTalkId;
$('generate').onclick = generate;
