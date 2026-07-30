# TalkQ 演講提問器

TalkQ 是可部署於 GitHub Pages 的即時提問工具。資料改由 Firebase Authentication 與 Cloud Firestore 處理，不再需要 Google Form 或 Google Sheet。

## 功能

- 聽眾不需註冊；網頁在背景使用 Firebase 匿名驗證。
- 講師建立留言板後取得提問、管理、公開清單三組網址與 QR Code。
- 六位數管理密鑰保護管理操作。
- 問題即時同步，可設為自動公開或講師審核。
- 講師可隨時關閉或重新開啟提問、下載全部提問 CSV，也可永久刪除整個留言板。
- 投稿者不同意公開時，問題只在管理頁顯示。
- 每個留言板有效 72 小時；到期後安全規則立即拒絕存取，頁面計時器或下一次開啟會自動清除主記錄。
- 首頁右下角的鑰匙入口可查看目前尚未到期的調查 ID 與剩餘時間。

## Firebase 專案

- 顯示名稱：`talkQ`
- Project ID：`talkq2026`
- Cloud Firestore：新加坡 `asia-southeast1`
- Web 設定：`js/firebase-config.js`
- 安全規則：`firestore.rules`

Firebase Console 需啟用 Authentication 的「匿名」登入方式。部署規則：

```bash
firebase deploy --only firestore --project talkq2026
```

目前專案使用免費 Spark 方案。Firestore 的伺服器端 TTL 需要啟用計費，因此本版採參考專案相同的用戶端到期清除策略；即使清除尚待頁面觸發，安全規則也會在第 72 小時立即讓資料失效且不可讀取。

## 本機預覽

```bash
python3 -m http.server 8080
```

開啟 <http://localhost:8080/>。請勿直接以 `file://` 開啟 HTML。

## 基本檢查

```bash
node --check js/setup.js
node --check js/ask.js
node --check js/moderator.js
node --check js/public.js
node --check js/firebase-store.js
node -e "JSON.parse(require('fs').readFileSync('firestore.indexes.json', 'utf8'))"
git diff --check
```

## License

MIT
