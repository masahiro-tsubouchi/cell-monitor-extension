# Phase 2実装の統合テスト手順

## 🔧 事前準備

### 1. JupyterLab環境でのテスト環境構築
```bash
# Docker Composeでテスト環境を起動
cd /Users/tsubouchi/windsurf/jupyter-extensionver2-claude-code
docker compose up jupyterlab fastapi

# 別ターミナルで拡張機能のインストール確認
docker exec -it jupyter-extensionver2-claude-code-jupyterlab-1 bash
jupyter labextension list
```

## 📊 Phase 2.1: HTTP接続プール最適化の検証

### テスト1: 接続プール使用の確認

#### 🎯 目的
毎回新しい接続を作成せず、同一接続を再利用していることを確認

#### 📝 詳細手順（初心者向け）

##### ステップ1: JupyterLab環境を起動
```bash
# ターミナルで以下を実行
cd /Users/tsubouchi/windsurf/jupyter-extensionver2-claude-code
docker compose up jupyterlab fastapi
```

**確認ポイント**: 
- `jupyterlab_1  | [I 2025-XX-XX XX:XX:XX.XXX ServerApp] Jupyter Server XX.X.X is running` が表示される
- エラーメッセージが出ていない

##### ステップ2: ブラウザでJupyterLabを開く
1. **ブラウザを開く**（Chrome推奨）
2. **アドレスバーに入力**: `http://localhost:8888`
3. **パスワード入力**: `easy` と入力してLogin

**確認ポイント**: JupyterLabの画面が正常に表示される

##### ステップ3: ブラウザ開発者ツールを開く
1. **F12キーを押す** （またはブラウザメニュー → その他のツール → デベロッパーツール）
2. **Networkタブをクリック**
3. **🔍重要な設定を行う:**
   - 📌 **「Preserve log」にチェックを入れる**
     - 理由: ページが更新されてもログが消えないように
   - 📌 **「Disable cache」にチェックを入れる** 
     - 理由: キャッシュの影響を除外するため
   - 📌 **フィルタを「Fetch/XHR」に設定**
     - 理由: APIリクエストのみを表示するため

**確認ポイント**: Networkタブが空の状態で待機していることを確認

##### ステップ4: 新しいノートブックを作成
1. **File → New → Notebook** をクリック
2. **Kernel選択**: Python 3 を選択
3. **新しいセルに以下のコードを入力**:
   ```python
   print("Phase 2 Test - Cell 1")
   ```
4. **Shift + Enter で実行**

##### ステップ5: Networkタブで最初のリクエストを確認
**📋 確認手順:**
1. Networkタブに新しいエントリが追加されたことを確認
2. **エントリをクリック**して詳細を表示
3. **Headers タブ**をクリック

**🔍 確認すべき項目:**
- **Request URL**: `http://localhost:8000/api/v1/events` または類似のURL
- **Request Headers セクション**で以下を確認:
  ```
  ✅ Connection: keep-alive  ← これが重要！
  ✅ Content-Type: application/json
  ```

**❌ もし `Connection: close` になっている場合 → Phase 2.1の実装に問題あり**

##### ステップ6: 複数セルで接続再利用を確認
1. **2つ目のセルを作成**:
   ```python
   print("Phase 2 Test - Cell 2")
   ```
2. **Shift + Enter で実行**
3. **3つ目のセルを作成**:
   ```python
   print("Phase 2 Test - Cell 3")
   ```
4. **Shift + Enter で実行**

##### ステップ7: 接続再利用の詳細確認
**📋 Networkタブでの確認手順:**
1. **各リクエストエントリをクリック**
2. **Timing タブをクリック**
3. **以下の時間を記録:**

**🔍 1回目のリクエスト（初回）:**
```
✅ DNS Lookup: 0.5ms - 5ms （初回のみ発生）
✅ Initial Connection: 1ms - 10ms （初回のみ発生）
✅ SSL: 2ms - 20ms （初回のみ発生）  
✅ Request sent: 0.1ms
✅ Waiting (TTFB): 10ms - 100ms
✅ Content Download: 0.1ms - 1ms
```

**🔍 2回目以降のリクエスト（接続再利用）:**
```
✅ DNS Lookup: 0ms （再利用のため0になる）
✅ Initial Connection: 0ms （再利用のため0になる）
✅ SSL: 0ms （再利用のため0になる）
✅ Request sent: 0.1ms
✅ Waiting (TTFB): 10ms - 100ms
✅ Content Download: 0.1ms - 1ms
```

##### ステップ8: 結果の判定

**✅ 成功の条件:**
1. **Connection Header**: `keep-alive` が設定されている
2. **DNS Lookup時間**: 2回目以降が0ms
3. **Initial Connection時間**: 2回目以降が0ms  
4. **SSL時間**: 2回目以降が0ms
5. **全体の応答時間**: 2回目以降が30-50%短縮

**❌ 失敗の条件:**
1. `Connection: close` が設定されている
2. 毎回DNS LookupやInitial Connectionが発生している
3. 応答時間が短縮されていない

##### 📸 スクリーンショット撮影（記録用）
**推奨する記録:**
1. Networkタブ全体のスクリーンショット
2. 1回目のリクエストのTimingタブ
3. 3回目のリクエストのTimingタブ
4. HeadersタブのConnection項目

#### ✅ 期待結果の詳細説明

**🎯 正常動作時の特徴:**
- **初回**: DNS + Connection + SSL で合計5-35ms
- **2回目以降**: DNS, Connection, SSL が全て0ms
- **ヘッダー**: `Connection: keep-alive` が確認できる
- **全体速度**: 明らかに高速化が体感できる

**⚠️ 問題がある場合の特徴:**
- 毎回同じような接続時間がかかる
- `Connection: close` になっている  
- 全体の応答時間に改善が見られない

---

### テスト2: 接続プール効率化の測定

#### 🎯 目的
接続確立時間が短縮されていることを定量的に確認

#### 📝 詳細手順（初心者向け）

##### ステップ1: 前のテストの続きから実行
- **前提**: テスト1が完了し、Networkタブが開いている状態

##### ステップ2: パフォーマンス測定の準備
1. **Networkタブで「Clear」ボタンをクリック**してログをクリア
2. **新しいセルを作成**し、以下を入力:
   ```python
   import time
   print("Performance Test - First execution:", time.time())
   ```
3. **実行前に時計を確認** → 実行開始時刻を記録

##### ステップ3: 初回実行と時間測定
1. **Shift + Enter で実行**
2. **すぐにNetworkタブを確認**
3. **新しいリクエストエントリをクリック**
4. **Timingタブで以下を記録**:
   ```
   📊 初回実行の時間:
   DNS Lookup: _____ ms
   Initial Connection: _____ ms  
   SSL: _____ ms
   Request sent: _____ ms
   Waiting: _____ ms
   Content Download: _____ ms
   ---------------------------
   Total: _____ ms  ← これを記録
   ```

##### ステップ4: 連続実行テスト（手動版）
**🔄 5回連続でセル実行を行います:**

1. **2回目**: 新しいセルで実行
   ```python
   print("Performance Test - Second execution:", time.time())
   ```

2. **3回目**: 新しいセルで実行
   ```python
   print("Performance Test - Third execution:", time.time())
   ```

3. **4回目, 5回目も同様に実行**

**📋 各実行後にNetworkタブで時間を記録:**
```
📊 2回目の時間:
DNS Lookup: _____ ms （0msになっているか？）
Initial Connection: _____ ms （0msになっているか？）
SSL: _____ ms （0msになっているか？）
Total: _____ ms

📊 3回目の時間:
Total: _____ ms

📊 4回目の時間: 
Total: _____ ms

📊 5回目の時間:
Total: _____ ms
```

##### ステップ5: 自動連続実行テスト（上級者向け）
**より高度なテスト**（任意）:
```python
import time
print("=== 連続実行パフォーマンステスト開始 ===")
for i in range(2, 8):
    print(f"Execution {i}: {time.time()}")
    time.sleep(0.3)  # 0.3秒待機
print("=== テスト完了 ===")
```

##### ステップ6: 結果の分析と計算
**📊 計算シート:**
```
初回実行時間: _____ ms (A)
2回目実行時間: _____ ms (B)  
3回目実行時間: _____ ms (C)
4回目実行時間: _____ ms (D)
5回目実行時間: _____ ms (E)

平均実行時間（2-5回目）: (B+C+D+E)/4 = _____ ms (F)
改善率: ((A-F)/A) × 100 = ______ %

✅ 期待値: 30-50%の改善
```

##### ステップ7: 詳細分析（トラブルシューティング用）
**🔍 DNS Lookup確認:**
- 2回目以降が全て0msになっているか？
- もし0msでない場合 → DNS設定に問題の可能性

**🔍 Initial Connection確認:**
- 2回目以降が全て0msになっているか？  
- もし0msでない場合 → 接続プール設定に問題

**🔍 SSL確認:**
- 2回目以降が全て0msになっているか？
- もし0msでない場合 → TLS再利用に問題

#### ✅ 期待結果の詳細

**🎯 正常動作の数値目安:**
- **初回**: 50-150ms（接続確立込み）
- **2回目以降**: 20-80ms（接続再利用）
- **改善率**: 30-50%短縮
- **DNS/Connection/SSL**: 2回目以降は全て0ms

**⚠️ 問題がある場合:**
- 改善率が20%未満
- DNS/Connection/SSLが毎回発生
- 応答時間にばらつきが大きい

---

## 📊 Phase 2.2: HTTP重複送信防止の検証

### テスト3: 重複送信防止の動作確認

#### 🎯 目的
同一セルの短時間内重複実行が適切に処理されることを確認

#### 📝 詳細手順（初心者向け）

##### ステップ1: テスト環境の準備
1. **前のテストの続きから開始**
2. **Networkタブで「Clear」をクリック**してログをクリア
3. **Consoleタブも確認可能な状態にする:**
   - F12の開発者ツールで**「Console」タブもクリック**
   - NetworkタブとConsoleタブを両方見れる状態にする

##### ステップ2: 重複送信テスト用のセルを作成
**新しいセルを作成し、以下のコードを入力:**
```python
import time
print("=== 重複送信テスト開始 ===")
print("開始時刻:", time.time())
time.sleep(1.5)  # 1.5秒待機（重複送信を発生させやすくする）
print("完了時刻:", time.time())
print("=== テスト完了 ===")
```

**📋 この長時間実行コードを使う理由:**
- 1.5秒の実行時間中に重複実行すると、Phase 2.2の重複送信防止機能が作動するため

##### ステップ3: 重複実行の実施
**🚀 重要: 以下を素早く実行してください**

1. **上記セルを選択した状態で待機**
2. **タイマーを用意**（スマートフォンのストップウォッチなど）
3. **以下を2秒以内に連続で実行:**
   ```
   操作1: Shift + Enter を押す （1回目実行）
   操作2: すぐに Shift + Enter を押す （2回目実行） 
   操作3: すぐに Shift + Enter を押す （3回目実行）
   ```

**⏰ タイミングが重要:** 3回の操作を2秒以内に完了させてください

##### ステップ4: Networkタブでリクエスト数を確認
**📋 確認手順:**
1. **Networkタブを確認**
2. **`events` または `cell-monitor` を含むリクエストを探す**
3. **リクエスト数をカウント**

**🔍 期待される結果:**
```
✅ 正常動作: 1つまたは2つのリクエストのみ表示
❌ 問題あり: 3つのリクエストが表示される
```

##### ステップ5: Consoleログで重複検出を確認
**📋 Consoleタブでの確認:**
1. **Consoleタブをクリック**
2. **以下のようなログを探す:**
   ```
   ✅ 正常ログ例:
   [CellMonitor][DataTransmissionService][DEBUG] Duplicate request detected, waiting...
   [CellMonitor][DataTransmissionService][DEBUG] Duplicate request detected, waiting...
   ```

**📊 ログの意味:**
- 1回のログ = 1回の重複が検出された
- 2回のログ = 2回の重複が検出された（3回実行→1回送信）

##### ステップ6: 結果の詳細分析
**📊 結果判定シート:**
```
実行回数: 3回
Networkタブのリクエスト数: _____ 個
Consoleの重複検出ログ数: _____ 個

📊 計算:
送信されたリクエスト数 = 実行回数 - 重複検出ログ数
= 3 - _____ = _____ 個

✅ 期待値: 1個のリクエスト送信
```

##### ステップ7: より確実なテスト（追加確認）
**🔄 別のセルでも同じテストを実行:**

1. **新しいセルを作成:**
   ```python
   import time
   print("=== 2回目の重複テスト ===")
   time.sleep(2)  # 2秒待機
   print("=== 2回目テスト完了 ===")
   ```

2. **同じように3回連続で実行**
3. **結果を記録**

**📊 2回目の結果:**
```
Networkタブのリクエスト数: _____ 個
重複検出ログ数: _____ 個
```

##### ステップ8: トラブルシューティング
**❌ もし期待通りにならない場合:**

1. **タイミング確認:**
   - 3回の実行が本当に2秒以内だったか？
   - 1回目の実行が完了する前に2回目、3回目を実行したか？

2. **ログレベル確認:**
   ```javascript
   // Consoleに入力して実行
   console.log('Phase 2.2 テスト用ログレベル確認');
   ```

3. **セルの選択確認:**
   - 毎回同じセルを実行していたか？
   - 異なるセルを実行していた場合は重複防止が作動しない

#### ✅ 期待結果の詳細

**🎯 完全に成功の場合:**
- **リクエスト数**: 1個のみ送信
- **重複ログ**: 2回表示
- **実行結果**: 1回分の出力のみ

**🎯 部分的成功の場合:**
- **リクエスト数**: 2個送信
- **重複ログ**: 1回表示  
- **説明**: 1回は重複が防がれた

**❌ 失敗の場合:**
- **リクエスト数**: 3個全て送信
- **重複ログ**: 0回（ログなし）
- **説明**: 重複送信防止が動作していない

---

### テスト4: 異なるセルでの独立送信確認

#### 🎯 目的
異なるセルの実行は重複送信防止の影響を受けないことを確認

#### 📝 手順
1. **複数セルの準備**
   ```python
   # セル1
   print("Cell 1 execution")
   
   # セル2  
   print("Cell 2 execution")
   
   # セル3
   print("Cell 3 execution")
   ```

2. **同時実行テスト**
   ```
   手順：
   1. セル1を選択してShift+Enter
   2. すぐにセル2を選択してShift+Enter  
   3. すぐにセル3を選択してShift+Enter
   4. Networkタブで送信リクエスト数を確認
   ```

#### ✅ 期待結果
- 3つのセルに対して3つのHTTPリクエストが送信される
- 重複送信防止ログは出力されない

---

## 📊 Phase 2統合テスト

### テスト5: 実使用シナリオでの統合動作確認

#### 🎯 目的
実際の授業環境を想定した負荷での動作確認

#### 📝 手順
1. **高頻度セル実行シミュレーション**
   ```python
   # 複数セルを作成し、順次実行
   cells = []
   for i in range(10):
       cells.append(f"""
   # Cell {i+1}
   import random
   import time
   result = random.randint(1, 100)
   time.sleep(0.1)
   print(f"Cell {i+1} result: {{result}}")
   """)
   ```

2. **連続実行とメモリ監視**
   ```javascript
   // ブラウザコンソールでメモリ使用量監視
   function monitorMemory() {
       const memory = performance.memory;
       console.log({
           used: Math.round(memory.usedJSHeapSize / 1024 / 1024) + 'MB',
           total: Math.round(memory.totalJSHeapSize / 1024 / 1024) + 'MB',
           timestamp: new Date().toISOString()
       });
   }
   
   // 5秒間隔でメモリ監視
   const memoryInterval = setInterval(monitorMemory, 5000);
   ```

3. **長時間稼働テスト**
   ```
   手順：
   1. 上記セルを30分間連続実行
   2. メモリ使用量の推移を記録
   3. HTTPリクエストの応答時間を記録
   4. エラーログの有無を確認
   ```

#### ✅ 期待結果
- メモリ使用量が一定範囲内で安定（Phase 1効果込みで10-15MB以下）
- HTTP応答時間が一定（接続プール効果）
- 重複送信によるサーバー負荷増大がない
- エラーやクラッシュが発生しない

---

## 🔍 パフォーマンステスト

### テスト6: Phase 2前後の比較測定

#### 🎯 目的
Phase 2実装によるメモリ削減効果を定量測定

#### 📝 手順
1. **Phase 1のみのベースライン測定**
   ```javascript
   // Phase 2機能を無効化した状態でのテスト
   // （実装前のバックアップから復元してテスト）
   ```

2. **Phase 2実装後の測定**
   ```javascript
   // 現在の実装でのテスト
   function measurePhase2Impact() {
       const start = performance.memory.usedJSHeapSize;
       
       // 100回のセル実行をシミュレーション
       // ... テストコード ...
       
       const end = performance.memory.usedJSHeapSize;
       return end - start;
   }
   ```

#### ✅ 期待結果
- HTTPリクエストオブジェクト蓄積: 85%削減
- 重複リクエスト数: 95%削減  
- 全体メモリ使用量: 10MB削減（Phase 2目標）

## 🚀 テスト実行コマンド

```bash
# ユニットテストの実行
cd cell-monitor-extension
npm test

# 統合テスト用環境起動
docker compose up --build

# メモリプロファイリング
# ブラウザ開発者ツール → Performance → Memory タブを使用
```

## 📋 テスト結果記録シート

### Phase 2.1: HTTP接続プール最適化
```
✅ テスト1: 接続プール使用確認
□ Connection: keep-alive ヘッダー確認済み
□ DNS Lookup時間: 初回 ___ms → 2回目以降 ___ms  
□ Initial Connection時間: 初回 ___ms → 2回目以降 ___ms
□ SSL時間: 初回 ___ms → 2回目以降 ___ms

✅ テスト2: 効率化測定
□ 初回実行時間: ___ms
□ 平均実行時間（2-5回目）: ___ms  
□ 改善率: ___%
□ 期待値達成: □ Yes □ No
```

### Phase 2.2: HTTP重複送信防止
```
✅ テスト3: 重複送信防止確認
□ 3回実行→送信リクエスト数: ___個
□ 重複検出ログ数: ___回
□ 期待値達成: □ Yes □ No

✅ テスト4: 独立送信確認  
□ 3つの異なるセル→送信リクエスト数: ___個
□ 期待値（3個）達成: □ Yes □ No
```

### 総合評価
```
□ Phase 2.1: 接続プール最適化 → □ 成功 □ 部分成功 □ 失敗
□ Phase 2.2: 重複送信防止 → □ 成功 □ 部分成功 □ 失敗
□ 全体評価 → □ 成功 □ 要改善 □ 失敗

記録者: _______________
記録日: _______________
```

## 🎯 よくある質問（FAQ）

**Q1: Networkタブにリクエストが表示されない**
A1: フィルタが「Fetch/XHR」になっているか、Preserve logがチェックされているか確認

**Q2: Connection: keep-aliveが表示されない**  
A2: Phase 2.1の実装に問題がある可能性。コードの確認が必要

**Q3: 重複送信防止が働かない**
A3: セル実行のタイミングが遅すぎる可能性。より素早く連続実行してください

**Q4: 改善率が期待値に達しない**
A4: ローカル環境では差が小さい場合があります。実際のネットワーク環境では大きな差が出ます

この包括的なテスト戦略により、Phase 2実装の正確性と効果を確実に検証できます。