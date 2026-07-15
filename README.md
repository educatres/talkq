# TalkQ 演講提問器

一個可直接部署在 GitHub Pages 的演講提問工具。聽眾不需登入即可提問，講師可審核並選擇公開問題。資料由 Google Form 寫入 Google Sheet，網站本身不需要後端、Apps Script、OAuth 或資料庫。

## 四個頁面

- `index.html`：建立演講 ID，設定 Google Form／Sheet，產生三組網址與 QR Code。
- `ask.html`：聽眾提問頁。
- `moderator.html`：講師查看所有問題並公開或隱藏。
- `public.html`：只顯示已公開問題。

## Google Form 欄位

建立以下 12 個欄位，型態使用「簡答」或「段落」，全部不要設為必填：

```text
talk_id
event_type
question_id
nickname
question_text
submitter_allows_public
visibility
client_timestamp
actor_session_id
talk_title
default_publish_mode
extra_json
```

## 設定步驟

1. 建立 Google Form，依序加入上述欄位。
2. 在 Google Form「回覆」頁籤建立回應試算表。
3. 將 Google Sheet 權限改為「知道連結的任何人」且角色為「檢視者」。
4. 在 Google Form 選擇「預先填寫表單」，每個欄位填入其欄位名稱，例如 `talk_id` 欄填入 `talk_id`。
5. 取得預填連結，貼入 TalkQ 設定頁，自動解析 `entry.xxxxx`。
6. 貼上 Google Sheet 分享網址，輸入工作表名稱及 Google Form 網址。
7. 選擇「直接公開」或「審核後公開」。
8. 產生提問頁、講師管理頁、公開清單三組網址與 QR Code。

## GitHub Pages 部署

1. 建立新的 GitHub repository。
2. 將本專案所有檔案上傳到 repository 根目錄。
3. 到 `Settings → Pages`。
4. `Source` 選擇 `Deploy from a branch`。
5. Branch 選擇 `main`，資料夾選擇 `/ (root)`。
6. 儲存後開啟 GitHub Pages 網址。

也可以使用 Git：

```bash
git init
git add .
git commit -m "Initial TalkQ release"
git branch -M main
git remote add origin https://github.com/你的帳號/你的專案.git
git push -u origin main
```

## 公開規則

- `moderated`：問題先進入待審核，講師公開後才顯示。
- `auto_public`：投稿者勾選同意公開時，問題直接顯示。
- 投稿者若不同意公開，講師管理頁仍看得到，但系統不提供公開按鈕。
- 公開清單依原始提問時間排序。

## 重要限制

- 管理網址沒有帳號登入或真正權限驗證，請勿公開分享。
- 公開 Google Sheet 的原始資料可能被知道網址的人讀取。
- 請勿要求聽眾填寫真實姓名、Email、電話或敏感資訊。
- Google Form 寫入 Google Sheet 可能有數秒延遲。
- 純前端架構無法徹底防止惡意投稿或冒用暱稱。
- Google Form 使用 `no-cors` 寫入，瀏覽器無法確認伺服器是否真正接受資料。

## 本機測試

由於 ES Modules 通常不能直接透過 `file://` 執行，請啟動簡單靜態伺服器：

```bash
python3 -m http.server 8080
```

再開啟：

```text
http://localhost:8080
```

## License

MIT
