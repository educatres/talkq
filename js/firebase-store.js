import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { randomId } from './utils.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getFirestore(app);
let signInPromise;

export const TALK_LIFETIME_MS = 3 * 24 * 60 * 60 * 1000;

export async function ensureSignedIn() {
  if (auth.currentUser) return auth.currentUser;
  if (!signInPromise) {
    signInPromise = signInAnonymously(auth)
      .then((credential) => credential.user)
      .catch((error) => {
        throw new Error('無法完成匿名連線，請確認 Firebase Authentication 已啟用匿名登入。', { cause: error });
      })
      .finally(() => { signInPromise = undefined; });
  }
  return signInPromise;
}

function validateTalkId(talkId) {
  if (!/^talk_[a-z0-9_]+$/i.test(talkId)) throw new Error('演講 ID 格式不正確。');
}

function claimId(talkId, uid) {
  return `${talkId}_${uid}`;
}

export async function createTalk({ talkId, talkTitle, defaultPublishMode, moderatorKey }) {
  validateTalkId(talkId);
  if (!/^\d{6}$/.test(moderatorKey)) throw new Error('管理密鑰格式不正確。');
  if (!['moderated', 'auto_public'].includes(defaultPublishMode)) throw new Error('公開模式不正確。');
  const user = await ensureSignedIn();
  const createdAt = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(createdAt.toMillis() + TALK_LIFETIME_MS);
  const settings = {
    talk_id: talkId,
    title: String(talkTitle).trim().slice(0, 100),
    default_publish_mode: defaultPublishMode,
    owner_uid: user.uid,
    created_at: createdAt,
    expires_at: expiresAt,
  };
  const batch = writeBatch(database);
  batch.set(doc(database, 'talks', talkId), settings);
  batch.set(doc(database, 'talks', talkId, 'admins', user.uid), {
    talk_id: talkId,
    uid: user.uid,
    expires_at: expiresAt,
  });
  batch.set(doc(database, 'moderatorKeys', talkId), {
    talk_id: talkId,
    key: moderatorKey,
    expires_at: expiresAt,
  });
  await batch.commit();
  return { ...settings, created_at: createdAt.toMillis(), expires_at: expiresAt.toMillis() };
}

export async function getTalkSettings(talkId) {
  validateTalkId(talkId);
  await ensureSignedIn();
  const snapshot = await getDoc(doc(database, 'talks', talkId));
  if (!snapshot.exists()) return null;
  const value = snapshot.data();
  return {
    ...value,
    created_at: value.created_at.toMillis(),
    expires_at: value.expires_at.toMillis(),
  };
}

export async function claimModeratorAccess(talkId, moderatorKey) {
  validateTalkId(talkId);
  if (!/^\d{6}$/.test(moderatorKey)) throw new Error('講師管理密鑰必須是六位數字。');
  const user = await ensureSignedIn();
  const talk = await getDoc(doc(database, 'talks', talkId));
  if (!talk.exists()) throw new Error('找不到這個問題留言板。');
  const expiresAt = talk.data().expires_at;
  const batch = writeBatch(database);
  batch.set(doc(database, 'moderatorClaims', claimId(talkId, user.uid)), {
    talk_id: talkId,
    uid: user.uid,
    key: moderatorKey,
    expires_at: expiresAt,
  });
  batch.set(doc(database, 'talks', talkId, 'admins', user.uid), {
    talk_id: talkId,
    uid: user.uid,
    expires_at: expiresAt,
  });
  await batch.commit();
}

export async function isCurrentUserModerator(talkId) {
  const user = await ensureSignedIn();
  const talk = await getDoc(doc(database, 'talks', talkId));
  if (talk.exists() && talk.data().owner_uid === user.uid) return true;
  const snapshot = await getDoc(doc(database, 'talks', talkId, 'admins', user.uid));
  return snapshot.exists();
}

export async function submitQuestion(talkId, { nickname, questionText, allowsPublic, defaultPublishMode }) {
  const user = await ensureSignedIn();
  const talk = await getDoc(doc(database, 'talks', talkId));
  if (!talk.exists()) throw new Error('找不到這個問題留言板。');
  const now = Timestamp.now();
  const questionId = randomId('q');
  const visibility = !allowsPublic
    ? 'private'
    : defaultPublishMode === 'auto_public' ? 'published' : 'pending';
  const question = {
    question_id: questionId,
    talk_id: talkId,
    owner_uid: user.uid,
    nickname: String(nickname).trim().slice(0, 30),
    question_text: String(questionText).trim().slice(0, 300),
    submitter_allows_public: Boolean(allowsPublic),
    visibility,
    created_at: now,
    updated_at: now,
    expires_at: talk.data().expires_at,
  };
  await setDoc(doc(database, 'talks', talkId, 'questions', questionId), question);
  return { ...question, created_at: now.toMillis(), updated_at: now.toMillis() };
}

function normalizeQuestion(snapshot) {
  const value = snapshot.data();
  return {
    ...value,
    created_at: value.created_at.toMillis(),
    updated_at: value.updated_at.toMillis(),
    expires_at: value.expires_at.toMillis(),
  };
}

export async function setQuestionVisibility(talkId, question, visibility) {
  if (!['pending', 'published', 'hidden', 'private'].includes(visibility)) throw new Error('問題狀態不正確。');
  if (visibility === 'published' && !question.submitter_allows_public) {
    throw new Error('投稿者未同意公開這則問題。');
  }
  await ensureSignedIn();
  await updateDoc(doc(database, 'talks', talkId, 'questions', question.question_id), {
    visibility,
    updated_at: Timestamp.now(),
  });
}

export async function subscribeToQuestions(talkId, onQuestions, onError) {
  await ensureSignedIn();
  return onSnapshot(collection(database, 'talks', talkId, 'questions'), (snapshot) => {
    const questions = snapshot.docs.map(normalizeQuestion);
    questions.sort((first, second) => first.created_at - second.created_at);
    onQuestions(questions);
  }, onError);
}

export async function subscribeToPublishedQuestions(talkId, onQuestions, onError) {
  await ensureSignedIn();
  const published = query(
    collection(database, 'talks', talkId, 'questions'),
    where('visibility', '==', 'published'),
    where('submitter_allows_public', '==', true),
  );
  return onSnapshot(published, (snapshot) => {
    const questions = snapshot.docs.map(normalizeQuestion);
    questions.sort((first, second) => first.created_at - second.created_at);
    onQuestions(questions);
  }, onError);
}

export async function deleteExpiredTalk(talkId, settings, questionIds = []) {
  if (Date.now() < Number(settings.expires_at)) return false;
  await ensureSignedIn();
  const batch = writeBatch(database);
  for (const questionId of questionIds.slice(0, 450)) {
    batch.delete(doc(database, 'talks', talkId, 'questions', questionId));
  }
  batch.delete(doc(database, 'moderatorKeys', talkId));
  batch.delete(doc(database, 'talks', talkId));
  await batch.commit();
  return true;
}

export function scheduleExpiryCleanup(talkId, settings, onExpired, getQuestionIds = () => []) {
  const run = async () => {
    try {
      await deleteExpiredTalk(talkId, settings, getQuestionIds());
    } catch {
      // Security rules still make every expired board inaccessible even if physical cleanup is retried later.
    } finally {
      onExpired?.();
    }
  };
  const delay = Number(settings.expires_at) - Date.now();
  if (delay <= 0) {
    run();
    return () => {};
  }
  const timer = setTimeout(run, Math.min(delay + 1000, 2147483647));
  return () => clearTimeout(timer);
}
