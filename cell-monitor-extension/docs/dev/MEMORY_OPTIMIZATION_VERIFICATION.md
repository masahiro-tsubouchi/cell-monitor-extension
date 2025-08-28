# メモリ最適化機能の手動検証ガイド

**作成日**: 2025-08-27  
**対象**: TimerPool最適化 + ログ最適化 (v1.1.3)  
**検証時間**: 約20-30分

## 📋 検証概要

このガイドでは、新しく実装されたメモリ最適化機能を手動で検証する方法を説明します：

- **TimerPool最適化**: Promise蓄積防止、同時実行制限
- **ログ最適化**: 循環バッファによるメモリ使用量制限

---

## 🚀 事前準備

### 1. 拡張機能の確認
```bash
# 最新ビルドファイルの確認
ls -la cell-monitor-extension/dist/
# 期待結果: cell_monitor-1.1.3-py3-none-any.whl が存在
```

### 2. Docker環境の起動
```bash
cd /Users/tsubouchi/windsurf/jupyter-extensionver2-claude-code
docker compose up jupyterlab

# JupyterLabが起動したら以下のURLにアクセス
# http://localhost:8888?token=easy
```

### 3. 開発者ツールの準備
1. ブラウザで**F12**キーを押す
2. **Console**タブを開く
3. **Network**タブも開いておく（通信確認用）

---

## 🧪 検証手順

### Step 1: TimerPool最適化の検証 ⭐⭐⭐

#### 1.1 基本動作確認

**新しいノートブックを作成し、以下のセルを実行:**

```python
# セル1: タイムスタンプ付き実行確認
import time
print(f"実行時刻: {time.strftime('%H:%M:%S.%f')[:-3]}")
print("TimerPool最適化テスト - セル1")
```

```python  
# セル2: 連続実行テスト
for i in range(3):
    print(f"ループ {i+1}: {time.strftime('%H:%M:%S.%f')[:-3]}")
    
print("TimerPool最適化テスト - セル2完了")
```

#### 1.2 Console確認

**ブラウザ開発者ツールのConsoleで以下のログを確認:**

```
✅ 期待されるログ:
[CellMonitor][TimerPool][DEBUG] Timer created {activeCount: 1, delayMs: 1565}
[CellMonitor][LoadDistributionService][DEBUG] Load distribution delay calculated {...}

❌ 問題があるログ:
Error: Timer creation failed
Uncaught TypeError: TimerPool is not defined
```

#### 1.3 同時実行制限テスト

**複数のセルを短時間で連続実行 (Shift+Enter連打):**

```python
# セル3-7: 5つのセルを素早く連続実行
print("同時実行テスト - セル3")
```
```python
print("同時実行テスト - セル4") 
```
```python
print("同時実行テスト - セル5")
```

**確認ポイント:**
- Console に `waiting for available slot` ログが出るか
- `activeCount` が10を超えないか
- セル実行が正常に完了するか

---

### Step 2: ログ最適化の検証 ⭐⭐⭐

#### 2.1 ログバッファ統計の確認

**ブラウザConsoleで実行:**

```javascript
// ログ統計の取得 (開発者ツールのConsoleに貼り付けて実行)
console.log('=== ログ最適化検証 ===');

// 現在のログ統計を確認
if (window.cellMonitor && window.cellMonitor.logger) {
    const stats = window.cellMonitor.logger.getBufferStats();
    console.log('Buffer Stats:', stats);
    console.log('Expected: currentEntries <= 20, memoryEstimateMB < 0.05');
} else {
    console.warn('Logger not accessible via window.cellMonitor');
}
```

#### 2.2 ログ蓄積テスト

**大量ログ生成テスト:**

```python
# セル: 大量のログを生成して循環バッファをテスト
import time

print("大量ログ生成開始...")
for i in range(50):  # 50回実行でバッファ制限(20件)をテスト
    print(f"ログ生成テスト {i+1}/50: {time.strftime('%H:%M:%S.%f')[:-3]}")
    if i % 10 == 9:
        print(f"進捗: {i+1}/50 完了")

print("大量ログ生成完了 - バッファ制限テスト")
```

**ブラウザConsoleで再確認:**

```javascript
// ログ蓄積後の統計確認
const stats = window.cellMonitor?.logger?.getBufferStats();
console.log('After bulk logging:', stats);

// 最近のログエントリ確認
const recentLogs = window.cellMonitor?.logger?.getRecentLogs(5);
console.log('Recent logs (should be max 5):', recentLogs);
```

---

### Step 3: メモリ使用量の測定 ⭐⭐⭐

#### 3.1 初期メモリ測定

**ブラウザConsoleで実行:**

```javascript
// 初期メモリ使用量を記録
console.log('=== メモリ使用量測定 ===');

if (performance.memory) {
    const initialMemory = performance.memory;
    console.log('初期メモリ使用量:', {
        used: Math.round(initialMemory.usedJSHeapSize / 1024 / 1024) + ' MB',
        total: Math.round(initialMemory.totalJSHeapSize / 1024 / 1024) + ' MB',
        limit: Math.round(initialMemory.jsHeapSizeLimit / 1024 / 1024) + ' MB'
    });
    
    // 後で比較するため保存
    window.initialMemoryUsage = initialMemory.usedJSHeapSize;
} else {
    console.warn('performance.memory not available (use Chrome/Edge)');
}
```

#### 3.2 負荷テスト

**長時間動作シミュレーション:**

```python
# セル: 授業時間をシミュレートした長時間テスト
import time
import random

print("授業シミュレーション開始 (100回実行)")
print("=" * 40)

for i in range(100):
    # 実際の授業での操作をシミュレート
    operation = random.choice(['計算', 'データ処理', 'グラフ作成', 'ヘルプ要請'])
    print(f"[{i+1:3d}/100] {operation}: {time.strftime('%H:%M:%S')}")
    
    # 授業ペースでの実行間隔
    time.sleep(0.05)  # 50ms間隔
    
    if i % 20 == 19:
        elapsed = (i+1) * 0.05
        print(f"  📊 進捗: {i+1}/100 完了 (経過: {elapsed:.1f}秒)")

print("\n✅ 授業シミュレーション完了")
```

#### 3.3 最終メモリ測定

**ブラウザConsoleで実行:**

```javascript
// 負荷テスト後のメモリ使用量を測定
if (performance.memory && window.initialMemoryUsage) {
    const finalMemory = performance.memory;
    const memoryIncrease = finalMemory.usedJSHeapSize - window.initialMemoryUsage;
    
    console.log('最終メモリ使用量:', {
        used: Math.round(finalMemory.usedJSHeapSize / 1024 / 1024) + ' MB',
        increase: Math.round(memoryIncrease / 1024 / 1024 * 10) / 10 + ' MB',
        increasePercent: Math.round(memoryIncrease / window.initialMemoryUsage * 1000) / 10 + '%'
    });
    
    // 判定
    const increaseMB = memoryIncrease / 1024 / 1024;
    if (increaseMB < 5) {
        console.log('✅ PASS: メモリ増加が5MB未満 (正常)');
    } else if (increaseMB < 10) {
        console.log('⚠️ CAUTION: メモリ増加が5-10MB (要注意)');
    } else {
        console.log('❌ FAIL: メモリ増加が10MB超過 (問題あり)');
    }
}
```

---

### Step 4: 機能統合テスト ⭐⭐

#### 4.1 ヘルプボタン動作確認

1. **ヘルプボタンをクリック**
2. **10秒後に再度クリック** (継続送信が停止されるか)
3. **ブラウザConsole**で以下を確認:

```
期待されるログ:
[CellMonitor][EventManager][DEBUG] Continuous help session started
[CellMonitor][EventManager][DEBUG] Continuous help event sent
[CellMonitor][EventManager][DEBUG] Help session stopped with bulk cleanup
```

#### 4.2 エラーハンドリングテスト

**意図的なエラー発生:**

```python
# セル: エラーを発生させてエラーハンドリングをテスト
print("エラーハンドリングテスト開始")

# 意図的なエラー1: 未定義変数
try:
    print(undefined_variable)
except NameError as e:
    print(f"NameError処理: {e}")

# 意図的なエラー2: ゼロ除算  
try:
    result = 10 / 0
except ZeroDivisionError as e:
    print(f"ZeroDivisionError処理: {e}")

print("エラーハンドリングテスト完了")
```

**Console確認:**
- エラーログが適切にバッファリングされているか
- システムがクラッシュしていないか

---

## 📊 期待される検証結果

### ✅ 成功基準

| 項目 | 期待値 | 確認方法 |
|------|--------|----------|
| **TimerPool制限** | activeCount ≤ 10 | Console logs |
| **ログエントリ数** | currentEntries ≤ 20 | `getBufferStats()` |
| **ログメモリ** | memoryEstimateMB < 0.05 | `getBufferStats()` |
| **総メモリ増加** | < 5MB (100回実行後) | `performance.memory` |
| **機能動作** | エラーなし | 全機能正常動作 |
| **応答性** | 操作遅延なし | 体感チェック |

### ⚠️ 注意すべき警告

```javascript
// 以下の警告は正常 (無視してOK)
console.warn('[CellMonitor] peer dependencies incorrectly met');
console.warn('UserWarning: Duplicate name in zipfile');

// 以下のエラーは問題 (要調査)  
console.error('TimerPool creation failed');
console.error('Logger buffer overflow');
console.error('Memory leak detected');
```

---

## 🔧 トラブルシューティング

### 問題1: ログが表示されない

**解決方法:**
```javascript
// デバッグモードを有効化
localStorage.setItem('cellMonitorDebug', 'true');
location.reload();
```

### 問題2: メモリが大幅増加

**調査方法:**
1. **ブラウザ再起動**でリフレッシュ
2. **別のブラウザ**で同じテストを実行
3. **Docker再起動**: `docker compose restart jupyterlab`

### 問題3: TimerPoolが動作しない

**確認項目:**
1. TypeScriptコンパイルエラーがないか
2. import文が正しいか
3. ファイルパスが正確か

**緊急時の復旧:**
```bash
# 変更を一時的に戻す
git stash

# 問題解決後に復元
git stash pop
```

---

## 📈 パフォーマンス比較テスト

### Before/After比較

**比較テスト手順:**
1. **現在のバージョン**でStep 1-3を実行
2. **メモリ使用量**を記録
3. **古いバージョン**に戻して同じテストを実行
4. **結果を比較**

**比較表テンプレート:**

| 項目 | 最適化前 | 最適化後 | 改善率 |
|------|----------|----------|--------|
| 初期メモリ | ___MB | ___MB | __% |
| 100回実行後 | ___MB | ___MB | __% |
| メモリ増加 | ___MB | ___MB | __% |
| Timer数制限 | なし | 10個 | ✅ |
| ログ制限 | なし | 20件 | ✅ |

---

## 🎯 検証完了チェックリスト

- [ ] TimerPool制限が正常動作している
- [ ] ログバッファが20件で制限されている  
- [ ] メモリ使用量増加が5MB未満
- [ ] ヘルプボタンが正常動作している
- [ ] エラー時にもシステムがクラッシュしない
- [ ] 100回セル実行後も応答性が維持されている
- [ ] Console エラーが致命的でない

---

## 📝 検証レポート

**検証実施者**: _________________  
**実施日時**: _________________  
**ブラウザ**: _________________  
**OS**: _________________  

### 結果サマリー
- [ ] 全項目PASS - 本番利用可能
- [ ] 一部CAUTION - 要改善点あり
- [ ] FAIL - 追加修正必要

### 備考
```
[検証時に気づいた点や問題を記載]

```

---

## 🔗 関連ドキュメント

- [Memory Safe Functionality Improvements](../plan/memory-safe-functionality-improvements.md)
- [Memory Optimization Priority Plan](../plan/memory-optimization-priority-plan.md)
- [Known Issues](../maintenance/KNOWN_ISSUES.md)
- [Operations Guide](../OPERATIONS_GUIDE.md)

**作成日**: 2025-08-27  
**次回更新推奨**: 2025-09-27 (1ヶ月後)