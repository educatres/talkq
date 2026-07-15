# GitHub Pages + Google Form / Google Sheet 演講提問器｜開發規格書

版本：v1.0  
參考專案：`educatres/classPop`  
用途：交由 Codex／開發者改寫實作  
目標平台：GitHub Pages 靜態網站  
資料儲存：Google Form 寫入 + Google Sheet 公開讀取  
登入機制：不需登入，以暱稱提問  

---

## 1. 專案目標

本專案要將 ClassPop 課堂即時回答系統改寫為「演講提問器」。

主辦人或講師先完成 Google Form、Google Sheet 與欄位設定，建立一組唯一的 `talk_id`（演講 ID），系統隨即產生三組網址與 QR Code：

1. **提問專用頁面**：聽眾輸入暱稱與問題，選擇是否願意公開。
2. **講師管理頁面**：講師可查看該場演講的全部提問，依時間排序，並決定哪些問題公開顯示。
3. **公開問題清單**：所有人可查看講師已公開的問題，依時間排序。

系統不建立後端伺服器、不使用資料庫、不使用 Apps Script、不使用 Google OAuth。所有寫入透過 Google Form 完成，所有讀取透過公開 Google Sheet 完成。

---

## 2. 核心設計原則

1. 僅使用 GitHub Pages 靜態網頁。
2. 不建立後端伺服器。
3. 不使用 Apps Script。
4. 不使用 Google OAuth。
5. 聽眾不需註冊或登入。
6. Google Form 作為資料寫入入口。
7. Google Sheet 作為公開唯讀資料來源。
8. 採用 Event Log 模式，不直接修改既有資料列。
9. 每次提問、公開、隱藏等操作，都新增一筆事件。
10. 所有頁面只處理 URL 中指定的 `talk_id`。
11. 顯示順序以提問建立時間為準，預設由早到晚。
12. 講師可選擇：
    - 新問題預設直接公開。
    - 新問題預設待審核。
13. 聽眾勾選「是否公開」代表投稿者意願；最終是否公開仍由講師控制。
14. 系統定位為活動互動工具，不作為機密或敏感資訊收集系統。

---

## 3. 使用角色

### 3.1 主辦人／講師

負責：

- 建立 Google Form。
- 將 Google Form 回應連結到 Google Sheet。
- 將 Google Sheet 設為「知道連結的人可以檢視」。
- 在設定頁輸入 Google Form、Google Sheet 與 entry ID。
- 建立或指定演講 ID。
- 設定新提問預設公開或待審核。
- 取得三組網址與 QR Code。
- 查看所有提問。
- 公開、隱藏或重新公開問題。
- 在演講現場投影公開問題清單。

### 3.2 聽眾

負責：

- 掃描提問 QR Code。
- 輸入暱稱。
- 輸入問題。
- 選擇是否願意公開顯示。
- 送出問題。
- 查看送出結果。

### 3.3 一般觀看者

負責：

- 掃描公開清單 QR Code。
- 查看講師已核准公開的問題。

---

## 4. 系統頁面與網址

建議包含四個頁面：

```text
/index.html
/ask.html
/moderator.html
/public.html
```

### 4.1 `index.html`：演講設定頁

用途：設定 Google Form／Sheet，建立演講 ID，產生三個網址及 QR Code。

主要功能：

1. 輸入演講名稱。
2. 輸入或自動產生 `talk_id`。
3. 輸入 Google Sheet ID。
4. 輸入 Sheet 名稱或 gid。
5. 輸入 Google Form submit URL。
6. 貼上預填連結，自動解析各欄位 entry ID。
7. 選擇預設公開模式：
   - `auto_public`：投稿後直接公開。
   - `moderated`：投稿後等待講師審核。
8. 產生三個網址：
   - 提問網址。
   - 講師管理網址。
   - 公開問題清單網址。
9. 為三個網址分別產生 QR Code。
10. 提供複製網址與下載 QR Code 圖片。
11. 將設定儲存在 localStorage。
12. 提供重新載入上次設定功能。

> 注意：講師管理網址本身不具真正安全驗證。應提醒講師不要公開分享管理網址。

### 4.2 `ask.html`：聽眾提問頁

用途：讓聽眾使用手機送出問題。

主要功能：

1. 顯示演講名稱。
2. 顯示暱稱欄位。
3. 顯示問題輸入欄位。
4. 顯示「我同意公開顯示這則問題」選項。
5. 送出前檢查：
   - 暱稱不可為空。
   - 問題不可為空。
   - 問題長度不可超過設定值。
6. 送出 `question_submit` 事件。
7. 投稿成功後顯示：
   - 已收到問題。
   - 若為自動公開，提示稍後將顯示於公開清單。
   - 若為審核模式，提示需等待講師審核。
8. 提供「再提一題」按鈕。
9. 防止連續重複送出。
10. 可選擇在本機記住暱稱。

### 4.3 `moderator.html`：講師管理頁

用途：讓講師查看全部提問並控制公開狀態。

主要功能：

1. 顯示演講名稱與 `talk_id`。
2. 顯示提問頁 QR Code。
3. 顯示公開清單 QR Code。
4. 顯示所有提問，依提問時間由早到晚排序。
5. 每題顯示：
   - 提問時間。
   - 暱稱。
   - 問題內容。
   - 投稿者是否同意公開。
   - 目前公開狀態。
6. 篩選：
   - 全部。
   - 待審核。
   - 已公開。
   - 已隱藏。
   - 投稿者不同意公開。
7. 關鍵字搜尋。
8. 每題操作：
   - 公開。
   - 隱藏。
   - 重新公開。
9. 批次操作：
   - 公開所有符合條件的問題。
   - 隱藏所有符合條件的問題。
10. 顯示統計：
    - 總提問數。
    - 待審核數。
    - 已公開數。
    - 已隱藏數。
11. 每 3 秒同步 Google Sheet。
12. 提供手動重新整理。
13. 可切換排序：
    - 最早優先。
    - 最新優先。
14. 可使用大字模式，方便講師在台上操作。

### 4.4 `public.html`：公開問題清單

用途：提供聽眾與投影畫面查看公開問題。

主要功能：

1. 只顯示目前狀態為公開的問題。
2. 依原始提問時間排序。
3. 預設由早到晚。
4. 每題顯示：
   - 提問時間。
   - 暱稱。
   - 問題內容。
5. 不顯示投稿者是否同意公開、管理狀態或其他內部欄位。
6. 每 3 秒自動同步。
7. 顯示最後更新時間。
8. 無公開問題時顯示：
   ```text
   目前還沒有公開的問題
   歡迎掃描 QR Code 提問
   ```
9. 可支援投影模式：
   - 大字。
   - 高對比。
   - 自動捲動至最新公開問題。
10. 可選擇隱藏暱稱，只顯示問題內容。

---

## 5. 三組網址格式

### 5.1 提問頁

```text
/ask.html?talk_id=talk_abcd1234&sheet_id=xxxx&sheet_name=Form%20Responses%201&form_url=xxxx&...
```

### 5.2 講師管理頁

```text
/moderator.html?talk_id=talk_abcd1234&sheet_id=xxxx&sheet_name=Form%20Responses%201&form_url=xxxx&...
```

### 5.3 公開問題清單

```text
/public.html?talk_id=talk_abcd1234&sheet_id=xxxx&sheet_name=Form%20Responses%201
```

公開清單只需讀取資料，原則上不必包含 `form_url` 與 entry ID，以縮短網址並降低設定資訊外流。

---

## 6. Google Form 欄位設計

Google Form 所有欄位使用「簡答」或「段落」，且不要設為必填，避免事件操作因空白欄位失敗。

| 欄位名稱 | 建議型態 | 說明 |
|---|---|---|
| talk_id | 簡答 | 演講 ID |
| event_type | 簡答 | 事件類型 |
| question_id | 簡答 | 問題唯一 ID |
| nickname | 簡答 | 投稿暱稱 |
| question_text | 段落 | 問題內容 |
| submitter_allows_public | 簡答 | 投稿者是否同意公開，`true` / `false` |
| visibility | 簡答 | 事件指定的公開狀態 |
| client_timestamp | 簡答 | 前端 ISO 時間 |
| actor_session_id | 簡答 | 匿名瀏覽器 ID |
| talk_title | 簡答 | 演講名稱 |
| default_publish_mode | 簡答 | `auto_public` / `moderated` |
| extra_json | 段落 | 保留欄位 |

Google Sheet 會自動增加第一欄 `Timestamp`。

---

## 7. Google Sheet 欄位設計

| 欄位 | 說明 | 範例 |
|---|---|---|
| Timestamp | Google Form 自動時間 | 2026/07/15 下午8:30:00 |
| talk_id | 演講 ID | talk_ai_2026 |
| event_type | 事件類型 | question_submit |
| question_id | 問題 ID | q_1721041234_a8k2 |
| nickname | 暱稱 | 小明 |
| question_text | 問題內容 | AI 會取代哪些工作？ |
| submitter_allows_public | 是否同意公開 | true |
| visibility | 公開狀態 | pending |
| client_timestamp | 前端時間 | 2026-07-15T12:30:00.000Z |
| actor_session_id | 匿名裝置 ID | usr_x7f9k2 |
| talk_title | 演講名稱 | AI 與未來教育 |
| default_publish_mode | 預設模式 | moderated |
| extra_json | 保留資料 | {} |

---

## 8. 事件類型

### 8.1 演講設定事件

| event_type | 說明 |
|---|---|
| talk_create | 建立演講 |
| talk_setting_update | 更新演講設定 |

### 8.2 聽眾事件

| event_type | 說明 |
|---|---|
| question_submit | 送出新問題 |

### 8.3 講師管理事件

| event_type | 說明 |
|---|---|
| question_publish | 公開問題 |
| question_hide | 隱藏問題 |
| question_restore | 重新公開問題 |

第一版不直接刪除問題，避免 Event Log 無法追蹤與誤刪。

---

## 9. 問題建立與公開規則

### 9.1 問題送出

聽眾送出時，建立 `question_submit` 事件。

系統產生：

```text
question_id = q_ + timestamp + "_" + randomString
```

例如：

```text
q_1721041234567_a8k2
```

### 9.2 初始公開狀態

#### 模式 A：預設直接公開

當：

```text
default_publish_mode = auto_public
```

且：

```text
submitter_allows_public = true
```

則初始狀態：

```text
published
```

若投稿者不同意公開，初始狀態仍為：

```text
private
```

#### 模式 B：審核後公開

當：

```text
default_publish_mode = moderated
```

則初始狀態：

```text
pending
```

若投稿者不同意公開，初始狀態：

```text
private
```

### 9.3 講師操作

講師按下「公開」時，新增：

```text
event_type = question_publish
visibility = published
```

講師按下「隱藏」時，新增：

```text
event_type = question_hide
visibility = hidden
```

講師按下「重新公開」時，新增：

```text
event_type = question_restore
visibility = published
```

### 9.4 投稿者不同意公開的處理

建議第一版採取較保守規則：

- `submitter_allows_public = false` 的問題，講師仍可在管理頁看到。
- 管理頁不得提供「公開」按鈕。
- 公開清單永遠不得顯示該問題。

---

## 10. 狀態還原規則

### 10.1 過濾演講

只處理：

```text
row.talk_id === URL.talk_id
```

### 10.2 建立問題

以每一筆 `question_submit` 建立問題主體。

同一 `question_id` 若出現多筆 `question_submit`：

```text
只採用時間最早的一筆
```

### 10.3 還原目前狀態

針對每一個 `question_id`：

1. 找到最早的 `question_submit`。
2. 依時間排列後續管理事件。
3. 取最新一筆有效的公開狀態事件。
4. 若沒有管理事件，使用投稿時的初始狀態。

### 10.4 時間排序優先順序

排序依序使用：

1. `client_timestamp`
2. Google Form `Timestamp`
3. Google Sheet 列序

### 10.5 公開清單判斷

問題必須同時符合：

```text
current_visibility === "published"
submitter_allows_public === true
```

才可顯示於 `public.html`。

### 10.6 顯示排序

講師頁與公開頁應以問題原始投稿時間排序，而不是以最後一次審核時間排序。

預設：

```text
oldest first
```

---

## 11. 前端資料結構

```typescript
type PublishMode = 'auto_public' | 'moderated';

type QuestionVisibility =
  | 'pending'
  | 'published'
  | 'hidden'
  | 'private';

type TalkConfig = {
  talkId: string;
  talkTitle: string;
  sheetId: string;
  sheetName?: string;
  gid?: string;
  formUrl: string;
  defaultPublishMode: PublishMode;
  fields: {
    talk_id: string;
    event_type: string;
    question_id: string;
    nickname: string;
    question_text: string;
    submitter_allows_public: string;
    visibility: string;
    client_timestamp: string;
    actor_session_id: string;
    talk_title: string;
    default_publish_mode: string;
    extra_json?: string;
  };
};
```

```typescript
type QuestionEventType =
  | 'talk_create'
  | 'talk_setting_update'
  | 'question_submit'
  | 'question_publish'
  | 'question_hide'
  | 'question_restore';

type QuestionEvent = {
  timestamp_server?: string;
  talk_id: string;
  event_type: QuestionEventType;
  question_id: string;
  nickname: string;
  question_text: string;
  submitter_allows_public: boolean;
  visibility: QuestionVisibility | '';
  client_timestamp: string;
  actor_session_id: string;
  talk_title: string;
  default_publish_mode: PublishMode | '';
  extra_json?: string;
  row_index?: number;
};
```

```typescript
type QuestionState = {
  talkId: string;
  questionId: string;
  nickname: string;
  questionText: string;
  submittedAt: string;
  submitterAllowsPublic: boolean;
  visibility: QuestionVisibility;
  lastUpdatedAt: string;
};
```

---

## 12. Google Form 寫入

使用：

```text
fetch + mode: "no-cors"
```

範例：

```javascript
async function submitEvent(config, event) {
  const formData = new FormData();

  formData.append(config.fields.talk_id, event.talk_id || '');
  formData.append(config.fields.event_type, event.event_type || '');
  formData.append(config.fields.question_id, event.question_id || '');
  formData.append(config.fields.nickname, event.nickname || '');
  formData.append(config.fields.question_text, event.question_text || '');
  formData.append(
    config.fields.submitter_allows_public,
    String(event.submitter_allows_public ?? '')
  );
  formData.append(config.fields.visibility, event.visibility || '');
  formData.append(
    config.fields.client_timestamp,
    event.client_timestamp || new Date().toISOString()
  );
  formData.append(
    config.fields.actor_session_id,
    event.actor_session_id || ''
  );
  formData.append(config.fields.talk_title, event.talk_title || '');
  formData.append(
    config.fields.default_publish_mode,
    event.default_publish_mode || ''
  );

  if (config.fields.extra_json) {
    formData.append(config.fields.extra_json, event.extra_json || '{}');
  }

  await fetch(config.formUrl, {
    method: 'POST',
    mode: 'no-cors',
    body: formData,
  });
}
```

因 `no-cors` 無法取得實際回應狀態，畫面應顯示：

```text
已送出提問，資料同步可能需要幾秒鐘。
```

---

## 13. Google Sheet 讀取

優先使用 GViz JSON：

```javascript
async function fetchSheetRows(sheetId, sheetName) {
  const url =
    `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq` +
    `?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;

  const response = await fetch(url, { cache: 'no-store' });
  const text = await response.text();

  const jsonText = text.substring(
    text.indexOf('{'),
    text.lastIndexOf('}') + 1
  );

  return parseGvizRows(JSON.parse(jsonText));
}
```

替代方案使用 CSV：

```text
https://docs.google.com/spreadsheets/d/{sheetId}/export?format=csv&gid={gid}
```

---

## 14. 同步策略

```text
SYNC_INTERVAL_MS = 3000
```

1. 講師管理頁每 3 秒同步。
2. 公開清單每 3 秒同步。
3. 提問頁送出後採樂觀更新。
4. 所有頁面提供手動重新整理。
5. 顯示：
   - 同步中。
   - 已更新。
   - 讀取失敗。
   - 最後更新時間。

---

## 15. 防止重複與濫用

第一版可實作基本前端防護：

1. 每個瀏覽器建立匿名 `actor_session_id`。
2. 送出後 5 秒內禁止再次投稿。
3. 相同問題文字在短時間內不可重複送出。
4. 問題字數限制建議 300 字。
5. 暱稱字數限制建議 30 字。
6. 對輸出內容做 HTML escape，避免 XSS。
7. 不使用 `innerHTML` 插入使用者文字。
8. 可加入簡單敏感字提示，但不要宣稱能完整過濾不當內容。
9. README 應說明：純前端架構無法徹底防止惡意灌票或大量投稿。

---

## 16. 講師管理頁 UI

### 頁首

顯示：

- 演講名稱。
- 演講 ID。
- 提問 QR Code。
- 公開清單 QR Code。
- 總提問數。
- 待審核數。
- 已公開數。

### 問題卡片

每張卡片顯示：

```text
10:32　小明
AI 是否會取代教師？

投稿者同意公開：是
目前狀態：待審核

[公開] [隱藏]
```

狀態標籤：

| 狀態 | 顯示文字 |
|---|---|
| pending | 待審核 |
| published | 已公開 |
| hidden | 已隱藏 |
| private | 不公開 |

### 排序

預設：

```text
最早提問在前
```

提供切換：

```text
最新提問在前
```

---

## 17. 公開清單 UI

公開頁適合手機與現場投影。

每一題顯示：

```text
Q12
10:32　小明
AI 是否會取代教師？
```

建議功能：

- 卡片式排版。
- 題號依公開清單排序動態產生。
- 新公開問題出現時顯示短暫提示。
- 可切換「自動捲到最新問題」。
- 可切換「隱藏暱稱」。
- 不顯示任何管理按鈕。
- 不把未公開問題寫入 DOM。

---

## 18. 建議檔案結構

```text
talk-question-tool/
├── index.html
├── ask.html
├── moderator.html
├── public.html
├── css/
│   └── styles.css
├── js/
│   ├── config.js
│   ├── google-form.js
│   ├── google-sheet.js
│   ├── question-store.js
│   ├── setup.js
│   ├── ask.js
│   ├── moderator.js
│   ├── public.js
│   ├── qr.js
│   └── utils.js
├── README.md
└── LICENSE
```

可直接沿用 ClassPop 的：

- Google Form entry ID 解析。
- Google Sheet GViz／CSV 讀取。
- URL 參數封裝。
- QR Code 產生。
- localStorage 設定保存。
- Event Log 狀態還原架構。

需要移除或改寫：

- 題目 A／B／C／D。
- 正確答案。
- 學生作答。
- 答對率統計。
- 題目開放／截止／公布流程。

---

## 19. 開發任務切分

### Task 1：複製並清理 ClassPop

- 保留共用工具與設定流程。
- 移除測驗專用欄位與 UI。
- 將 `class_id` 全面改為 `talk_id`。

### Task 2：設定頁

- 建立演講名稱與演講 ID。
- 設定自動公開或審核模式。
- 解析 Google Form entry ID。
- 產生三個網址及三個 QR Code。

### Task 3：提問頁

- 暱稱與問題表單。
- 是否同意公開選項。
- 表單驗證。
- `question_submit` 寫入。
- 成功與錯誤提示。

### Task 4：Question Store

- 解析 Event Log。
- 建立問題主體。
- 還原每題最新公開狀態。
- 依原始投稿時間排序。
- 過濾公開問題。

### Task 5：講師管理頁

- 顯示全部問題。
- 公開／隱藏／重新公開。
- 篩選、搜尋、排序。
- 統計數字。
- 自動同步。

### Task 6：公開清單頁

- 只顯示已公開且投稿者同意公開的問題。
- 依時間排序。
- 投影模式。
- 自動更新。

### Task 7：README 與操作手冊

內容至少包含：

- 專案介紹。
- Google Form 欄位建立方式。
- Google Sheet 共用設定。
- 預填連結與 entry ID 解析。
- 三種網址用途。
- 講師管理網址安全提醒。
- GitHub Pages 部署方式。
- 系統限制與個資提醒。

---

## 20. 驗收標準

### 設定頁

- 可建立或輸入演講 ID。
- 可選擇預設公開模式。
- 可產生三個正確網址。
- 可產生三個 QR Code。
- 公開清單網址不包含 Form 寫入參數。

### 提問頁

- 可輸入暱稱與問題。
- 可選擇是否同意公開。
- 可成功新增 Google Sheet 資料列。
- 空白或過長內容無法送出。
- 使用者文字不會以 HTML 執行。

### 講師管理頁

- 只顯示相同 `talk_id` 的資料。
- 可查看所有提問。
- 問題依原始提問時間排序。
- 可公開、隱藏、重新公開。
- 狀態在同步後正確還原。
- 投稿者不同意公開的問題不能被公開。

### 公開清單

- 只顯示 `published` 問題。
- 不顯示 `pending`、`hidden`、`private` 問題。
- 依原始提問時間排序。
- 講師公開或隱藏後，數秒內更新。
- 無問題時顯示清楚的空白狀態。

### 跨演講資料隔離

- 不同 `talk_id` 的提問不會混在一起。
- 相同 Google Sheet 可保存多場演講資料。

---

## 21. 安全性與限制

1. Google Sheet 設為公開檢視後，知道 Sheet 網址的人可能讀取原始資料。
2. 管理頁網址沒有真正登入或權限驗證。
3. 不應蒐集真實姓名、Email、電話或敏感資訊。
4. Google Form submit URL 外流後，可能被惡意投稿。
5. Google Form 寫入 Google Sheet 可能延遲數秒。
6. 純前端無法徹底防止灌入、冒用暱稱或跨裝置重複投稿。
7. 本系統不適用於機密會議、醫療諮詢或其他敏感活動。
8. 若要有真正的講師權限、刪除資料、封鎖使用者或防濫用功能，需要導入後端服務。

---

## 22. Codex 開發提示詞

```text
請以 https://github.com/educatres/classPop 為基礎，將專案改寫成可部署於 GitHub Pages 的「演講提問器」。

核心限制：
1. 只能使用 HTML、CSS、JavaScript 靜態前端。
2. 不建立後端、不使用 Apps Script、不使用 OAuth。
3. 使用 Google Form 新增事件，使用公開 Google Sheet 讀取事件。
4. 沿用 Event Log 狀態還原模式。
5. 使用 talk_id 隔離不同演講。

請建立四個頁面：
- index.html：設定 Google Form、Google Sheet、演講 ID 與預設公開模式，產生三組網址及 QR Code。
- ask.html：聽眾輸入暱稱、問題、是否同意公開。
- moderator.html：講師查看全部問題，依原始提問時間排序，並公開、隱藏或重新公開問題。
- public.html：只顯示講師已公開且投稿者同意公開的問題，依原始提問時間排序。

資料欄位：
talk_id, event_type, question_id, nickname, question_text,
submitter_allows_public, visibility, client_timestamp,
actor_session_id, talk_title, default_publish_mode, extra_json。

事件類型：
talk_create, talk_setting_update, question_submit,
question_publish, question_hide, question_restore。

公開模式：
- auto_public：投稿者同意公開時，問題初始狀態為 published。
- moderated：問題初始狀態為 pending。
- 投稿者不同意公開時，狀態為 private，講師不得將其公開。

請保留並重用 ClassPop 中可用的：
- Google Form entry ID 解析。
- Google Sheet GViz／CSV 讀取。
- URL 參數處理。
- QR Code 產生。
- localStorage 設定保存。
- Event Log 狀態還原架構。

請移除測驗專用的四選項、正確答案、作答統計與公布答案功能。
每 3 秒同步 Google Sheet，並提供手動重新整理。
所有使用者輸入必須安全輸出，禁止直接用 innerHTML 插入。
完成完整專案、README、Google Form 設定教學及 GitHub Pages 部署說明。
```

---

## 23. 第一版結論

第一版聚焦於：

```text
GitHub Pages 靜態前端
+ Google Form 匿名投稿
+ Google Sheet 公開讀取
+ talk_id 演講隔離
+ 三組網址與 QR Code
+ 講師審核及公開控制
+ 公開問題清單
+ 依原始提問時間排序
```

這套架構可最大程度沿用 ClassPop 的設定流程、QR Code、Google Form／Sheet 連接方式與 Event Log 邏輯，只需將「測驗狀態」替換為「提問公開狀態」。
