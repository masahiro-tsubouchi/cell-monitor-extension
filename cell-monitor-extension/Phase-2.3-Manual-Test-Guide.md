# Phase 2.3 手動テスト手順書

**実装機能**: 継続HELP送信システム + バルククリーンアップ機能  
**テスト環境**: Docker JupyterLab + FastAPI Server  
**所要時間**: 15-20分

## 🚀 事前準備

### 1. Docker環境の起動
```bash
cd /Users/tsubouchi/windsurf/jupyter-extensionver2-claude-code
docker compose up jupyterlab fastapi
```

**確認ポイント**:
- ✅ JupyterLab: `http://localhost:8888` でアクセス可能
- ✅ FastAPI Server: `http://localhost:8000` でアクセス可能
- ✅ Password: `easy`

### 2. 拡張機能のインストール状況確認
```bash
# 別ターミナルで実行
docker exec -it $(docker ps -q --filter "name=jupyterlab") bash
jupyter labextension list | grep cell-monitor
```

**期待結果**: `cell-monitor v1.1.3 enabled OK (python, cell-monitor)`

---

## 📊 Phase 2.3: 継続HELP送信機能テスト

### テスト1: 継続HELP送信の基本動作確認

#### 📝 手順
1. **JupyterLabを開く** → `http://localhost:8888` (password: `easy`)
2. **新しいノートブック作成** → File > New > Notebook
3. **セルに以下を入力**:
   ```python
   print("Phase 2.3 継続HELP送信テスト開始")
   ```
4. **セルを実行** → Shift + Enter

5. **ヘルプボタンを確認**:
   - ツールバーに「🆘 講師に助けを求める」ボタンがあることを確認

6. **ヘルプセッション開始**:
   - 🆘 ボタンをクリック
   - ボタンが「🆘 ヘルプ要請中...」に変化することを確認

#### 🔍 確認項目

##### A. 即座のHELP送信確認（ブラウザ開発者ツール使用）
1. **F12キーで開発者ツールを開く**
2. **Networkタブをクリック**
3. **フィルタを「Fetch/XHR」に設定**
4. **「Preserve log」にチェック**

5. **ヘルプボタンクリック後すぐに確認**:
   ```
   ✅ 期待結果:
   - URL: http://localhost:8000/api/v1/events へのPOSTリクエスト
   - Request Body に eventType: "help" が含まれている
   - 即座（1秒以内）にリクエストが送信される
   ```

##### B. 継続送信確認（10秒間隔）
1. **ヘルプボタンクリック後、Networkタブを監視**
2. **10秒間待機**
3. **さらに10秒間待機**

```
✅ 期待結果:
- 0秒: 初回HELP送信（ボタンクリック時）
- 10秒後: 2回目のHELP送信
- 20秒後: 3回目のHELP送信
- 30秒後: 4回目のHELP送信

各リクエストの内容:
- eventType: "help"
- 同じnotebookPath
- 異なるeventId (UUID)
- 現在時刻のeventTime
```

##### C. Console ログ確認
1. **Consoleタブをクリック**
2. **以下のログを確認**:
   ```
   ✅ 期待するログ:
   [CellMonitor][EventManager][INFO] Continuous help session started
   [CellMonitor][EventManager][DEBUG] Continuous help event sent
   [CellMonitor][EventManager][DEBUG] Continuous help event sent
   ...（10秒間隔で継続）
   ```

---

### テスト2: ヘルプセッション停止機能確認

#### 📝 手順
1. **継続HELP送信中の状態から開始**（テスト1の続き）
2. **ヘルプボタンを再度クリック**（停止）
3. **ボタンが元の状態に戻ることを確認**

#### 🔍 確認項目

##### A. 停止動作確認
```
✅ 期待結果:
- ボタンテキスト: 「🆘 ヘルプ要請中...」→「🆘 講師に助けを求める」
- help_stopイベントが即座に送信される
- 継続送信が完全に停止する
```

##### B. 継続送信停止確認
1. **停止後30秒間Networkタブを監視**
2. **追加のHELPイベント送信がないことを確認**

```
✅ 期待結果:
- 停止時点で help_stop イベントが1回送信される
- その後HELPイベントの送信が完全に停止する
- Consoleに停止ログが出力される
```

---

## 📊 Phase 2.3: バルククリーンアップ機能テスト

### テスト3: バルククリーンアップ機能確認

#### 📝 手順（高度なテスト）
1. **複数ノートブックでヘルプセッション開始**:
   - ノートブック1でヘルプ開始
   - 新しいタブでノートブック2作成
   - ノートブック2でもヘルプ開始

2. **Console でメモリ状況確認**:
   ```javascript
   // Consoleに以下を入力して実行
   console.log('Help Sessions:', window.eventManager?.helpSession?.size || 'N/A');
   console.log('Memory Usage:', performance.memory ? 
     Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + 'MB' : 'N/A');
   ```

3. **1つのノートブックでヘルプ停止**
4. **Console で再度メモリ状況確認**

#### 🔍 確認項目

```
✅ 期待結果:
- ヘルプ停止時に「bulk cleanup」関連のログが出力される
- メモリ使用量の削減が確認できる
- 他のノートブックの継続送信は影響を受けない
```

---

## 📊 Phase 2.3: エラー処理テスト

### テスト4: ネットワークエラー耐性確認

#### 📝 手順
1. **FastAPIサーバーを停止**:
   ```bash
   # Docker Compose環境で
   docker compose stop fastapi
   ```

2. **ヘルプセッション開始を試行**
3. **FastAPIサーバーを再起動**:
   ```bash
   docker compose start fastapi
   ```

#### 🔍 確認項目
```
✅ 期待結果:
- サーバー停止中でもUIがクラッシュしない
- エラーログが適切に出力される
- サーバー復旧後、正常に送信が再開される
```

---

## 📊 統合動作テスト

### テスト5: フルワークフローテスト

#### 📝 手順（15分間の総合テスト）
```
1分目:  ヘルプセッション開始 → 継続送信確認
5分目:  新しいノートブックでもヘルプ開始
10分目: 1つ目のヘルプを停止 → バルククリーンアップ確認
12分目: 2つ目のヘルプも停止
15分目: メモリ使用量の最終確認
```

#### 🔍 最終確認項目
```
✅ システム安定性:
- 15分間でクラッシュやフリーズが発生しない
- メモリリークが発生しない
- 継続送信が正確に10秒間隔で動作する

✅ 機能完全性:
- 複数ノートブックでの独立動作
- バルククリーンアップによるメモリ削減
- エラー時の適切な回復動作
```

---

## 🎯 成功判定基準

### ✅ 必須クリア項目
1. **継続送信機能**: 10秒間隔でのHELP送信が動作する
2. **停止機能**: help_stopイベント送信と継続送信停止が動作する  
3. **バルククリーンアップ**: メモリ削減効果が確認できる
4. **UI安定性**: ボタン状態変更とクラッシュしない

### ⚠️ 問題発生時のトラブルシューティング

#### 問題1: 継続送信が動作しない
- **確認**: ConsoleでsetInterval関連のエラーがないか
- **対処**: ブラウザを再起動してから再テスト

#### 問題2: ヘルプボタンが表示されない
- **確認**: 拡張機能が正しくインストールされているか
- **対処**: `jupyter labextension list` で確認

#### 問題3: サーバーにリクエストが届かない
- **確認**: FastAPIサーバーが正常に動作しているか  
- **対処**: `curl http://localhost:8000/health` で確認

---

## 📋 テスト結果記録シート

```
🕒 テスト実行日時: ___________
👤 テスト実行者: ___________

✅ Phase 2.3 継続HELP送信機能:
□ 即座のHELP送信動作 → □ 成功 □ 失敗
□ 10秒間隔での継続送信 → □ 成功 □ 失敗  
□ ヘルプ停止機能 → □ 成功 □ 失敗

✅ Phase 2.3 バルククリーンアップ機能:
□ メモリクリーンアップ動作 → □ 成功 □ 失敗
□ 複数セッション管理 → □ 成功 □ 失敗

✅ システム安定性:
□ 15分間の連続動作 → □ 成功 □ 失敗
□ エラー耐性 → □ 成功 □ 失敗

📊 総合評価: □ 成功 □ 部分成功 □ 失敗

📝 備考:
_________________________________
_________________________________
```

この手動テストにより、Phase 2.3の実装が正しく動作しているかを確実に検証できます。