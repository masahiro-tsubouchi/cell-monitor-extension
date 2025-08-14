# Cell Monitor Extension - 運用ガイド

## 📋 概要

このドキュメントは、Cell Monitor Extensionの日常運用、特に**社内オンプレミス環境**での運用に関するガイドです。

## 🏢 **社内オンプレミス環境での運用パターン**

### 基本的な運用方針

**前提条件**:
- 教育中：FastAPIサーバー稼働中（データ収集・学習管理が必要）
- 教育時間外：FastAPIサーバー停止状態（学習管理不要、コスト削減）

## ✅ **教育時間外のサーバー停止運用について**

### サーバー停止時のJupyterLab利用可否

**結論**: **問題なし** - 受講生は教育時間外もJupyterLabを通常通り利用可能

#### 技術的動作確認

**1. JupyterLabの基本機能（すべて正常動作）**
```python
# これらの機能は拡張機能に関係なく動作
print("Hello, World!")           # ✅ セル実行
import pandas as pd             # ✅ ライブラリインポート
df = pd.read_csv("data.csv")    # ✅ ファイル操作
plt.plot([1, 2, 3])            # ✅ 可視化
# ノートブック保存、読み込み      # ✅ すべて正常
```

**2. 拡張機能の動作（データ送信失敗するが影響なし）**
```typescript
// src/index.ts での実際の動作
try {
  // サーバーへのデータ送信を試行
  await axios.post(globalSettings.serverUrl, data);
  // ↑ サーバー停止のため失敗
} catch (error) {
  // エラーはコンソールログのみ（JupyterLab動作に影響なし）
  console.error('Failed to send student progress data:', error);
  // JupyterLabは正常に動作し続ける
}
```

**3. 受講生への実際の影響**
```
セル実行時の体験:
1. セルをクリックして実行 → 即座に実行開始
2. 拡張機能が裏でデータ送信を試行 → 失敗（但し受講生には見えない）
3. セルの実行結果が正常に表示
4. JupyterLabの全機能が引き続き利用可能

影響度: 実質的に影響なし
```

### 現在の拡張機能の動作詳細

**データ送信失敗時のリトライ処理**:
```typescript
// 最大3回のリトライ（合計約7秒）
let retries = 0;
while (retries <= globalSettings.retryAttempts) {
  try {
    await axios.post(globalSettings.serverUrl, data);
    break; // 成功時は抜ける
  } catch (error) {
    retries++;
    if (retries > globalSettings.retryAttempts) {
      // 3回失敗後はデータを破棄（JupyterLabは正常継続）
      console.error('Max retry attempts reached. Progress data will be lost.');
      break;
    }
    // 1秒、2秒、4秒の待機
    await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries - 1)));
  }
}
```

**受講生への影響評価**:
- ⚠️ **軽微な遅延**: セル実行後、約7秒間の内部処理時間
- ✅ **機能制限なし**: すべてのJupyterLab機能が利用可能
- ✅ **データ保存**: ノートブック自体の保存は正常
- ✅ **学習継続**: プログラミング学習に支障なし

## 🎯 **推奨運用方法**

### 1. 基本運用（現状のままで十分実用的）

```bash
# サーバー停止コマンド（教育時間外）
docker-compose stop fastapi-server

# サーバー起動コマンド（教育開始前）
docker-compose start fastapi-server
```

### 2. 最適化運用（オプション）

サーバー接続状態を監視し、停止時は送信を一時停止する改良版：

```typescript
// サーバー接続状態を監視し、停止時は送信を一時停止
class ServerConnectionManager {
  private isServerAvailable = true;
  private consecutiveFailures = 0;

  async checkServerHealth() {
    if (this.consecutiveFailures > 3) {
      // 3回連続失敗後は送信を一時停止
      console.log('Server appears offline, pausing data collection');
      return false;
    }
    return true;
  }

  async sendData(data: IStudentProgressData[]) {
    if (!await this.checkServerHealth()) {
      // サーバー停止状態では送信をスキップ
      console.log('Data collection paused - server offline');
      return;
    }

    // 通常の送信処理
    try {
      await axios.post(globalSettings.serverUrl, data);
      this.consecutiveFailures = 0; // 成功時はカウンタリセット
    } catch (error) {
      this.consecutiveFailures++;
      throw error;
    }
  }
}
```

## 📋 **運用シナリオ例**

### 平日の典型的な運用パターン

```
08:00 サーバー起動（管理者が授業準備）
09:00-12:00 【授業A】データ収集・学習管理有効
12:00-13:00 昼休み（サーバー稼働継続 or 停止選択可能）
13:00-16:00 【授業B】データ収集・学習管理有効
16:00 サーバー停止（コスト削減、セキュリティ向上）

16:00-翌日08:00
↓
受講生の自習・復習時間
- JupyterLab利用可能 ✅
- ノートブック作成・編集可能 ✅
- ライブラリ学習可能 ✅
- データ送信のみ無効（問題なし） ✅
```

### 週末・長期休暇の運用

```
金曜16:00 サーバー完全停止
↓
土日・祝日・長期休暇中
- 受講生の自主学習継続可能
- JupyterLab全機能利用可能
- サーバー運用コスト0円
- セキュリティリスク最小化
↓
授業再開日08:00 サーバー再起動
```

## 🎉 **教育時間外サーバー停止のメリット**

### 1. コスト削減
- サーバーリソース使用量0
- 電力コスト削減
- DB書き込み処理負荷0

### 2. セキュリティ向上
- 攻撃対象サーバーが停止状態
- 内部ネットワークのセキュリティ向上
- データ漏洩リスク最小化

### 3. システム保守性
- サーバーメンテナンス時間の確保
- システム更新の安全な実施
- ログ分析・バックアップ作業時間

### 4. 受講生体験
- 自習時間の確保（データ収集のプレッシャーなし）
- JupyterLab学習環境の継続利用
- プライベートな学習空間の提供

## 📊 **機能影響度まとめ**

| 項目 | 教育中（サーバー稼働） | 教育時間外（サーバー停止） |
|-----|-------------------|----------------------|
| JupyterLab基本機能 | ✅ 正常 | ✅ 正常 |
| セル実行 | ✅ 正常 | ✅ 正常 |
| ファイル操作 | ✅ 正常 | ✅ 正常 |
| ライブラリ使用 | ✅ 正常 | ✅ 正常 |
| ノートブック保存 | ✅ 正常 | ✅ 正常 |
| データ送信 | ✅ 正常 | ❌ 失敗（影響なし） |
| 学習記録 | ✅ 有効 | ❌ 無効（意図的） |
| システム応答性 | ✅ 高速 | ✅ 高速（送信処理なし） |

## 🚨 **トラブルシューティング**

### よくある問題と対処法

#### Q1: サーバー停止後にJupyterLabが重い
**A1**: 通常は発生しません。もし発生した場合：
```bash
# JupyterLabを再起動
jupyter lab --ip=0.0.0.0 --port=8888 --no-browser --allow-root
```

#### Q2: 授業開始時にデータが記録されない
**A2**: サーバー起動を確認してください：
```bash
# サーバー状態確認
docker-compose ps

# サーバー起動
docker-compose start fastapi-server

# ログ確認
docker-compose logs -f fastapi-server
```

#### Q3: ブラウザコンソールにエラーが大量表示
**A3**: サーバー停止時の正常な動作です。問題ありません。
```javascript
// 表示されるエラー（正常）
Failed to send student progress data: AxiosError: Network Error
Max retry attempts reached. Progress data will be lost.
```

## 📞 **サポート・連絡先**

### 緊急時の連絡手順
1. **システム管理者**: [内部連絡先]
2. **技術サポート**: [内部連絡先]
3. **教務担当**: [内部連絡先]

### 定期メンテナンス
- **頻度**: 月1回
- **時間**: 土曜日 深夜2:00-4:00
- **内容**: システム更新、ログクリーンアップ、バックアップ確認

**総合評価**: 教育時間外のサーバー停止運用は**技術的に問題なし**であり、むしろコスト・セキュリティ・保守性の観点で**推奨される運用方法**です。
