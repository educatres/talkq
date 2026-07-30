# TalkQ Firebase 開發規格

## 1. 目的

TalkQ 是 GitHub Pages 靜態網站，使用 Firebase Anonymous Authentication 與 Cloud Firestore 取代 Google Form／Google Sheet 中繼流程。

## 2. 頁面

- `index.html`：建立三天有效的問題留言板，產生三組網址、QR Code 與六位數管理密鑰。
- `ask.html`：聽眾輸入暱稱與問題，匿名送出。
- `moderator.html`：講師以管理密鑰取得權限、審核公開或隱藏問題。
- `public.html`：即時顯示已公開問題。

## 3. Firebase 架構

```text
talks/{talkId}
  talk_id, title, default_publish_mode, owner_uid, created_at, expires_at
  admins/{uid}
    talk_id, uid, expires_at
  questions/{questionId}/
    question_id, owner_uid, nickname, question_text
    submitter_allows_public, visibility, created_at, updated_at, expires_at

moderatorKeys/{talkId}
  talk_id, key, expires_at
moderatorClaims/{talkId_uid}
  talk_id, uid, key, expires_at
talkDirectory/{talkId}
  talk_id, created_at, expires_at
```

管理頁可讀取完整 `questions`；公開頁的查詢必須同時限制 `visibility == published` 與 `submitter_allows_public == true`，安全規則會拒絕其他資料。首頁右下角的鑰匙入口只讀取 `talkDirectory`，因此不會公開標題、管理密鑰或使用者 UID。

## 4. 權限

1. 所有資料操作都需先完成 Firebase 匿名驗證。
2. 任一匿名使用者可在未到期的留言板建立問題，但建立後不可自行修改。
3. 只有 `admins/{uid}` 為 `true` 的匿名 UID 可讀取所有問題或變更狀態。
4. 新 UID 必須先提交正確六位數密鑰至 `moderatorClaims`，才能加入 `admins`。
5. 公開頁的 Firestore 查詢與規則雙重限制，只能讀取已公開且投稿者同意公開的問題。

## 5. 三天到期

`expires_at = created_at + 72 小時`。安全規則在到期後立即拒絕一般讀寫。開啟中的頁面會在到期時計時清除主記錄與已載入的問題；若當時沒有頁面開啟，下一次開啟活動連結會立即執行清除。Firestore 伺服器端 TTL 需啟用計費，免費 Spark 方案不使用該功能。

## 6. 部署與驗證

```bash
firebase deploy --only firestore --project talkq2026
python3 -m http.server 8080
```

Firebase 專案顯示名稱為 `talkQ`，Project ID 為 `talkq2026`，資料庫區域為 `asia-southeast1`。
