# Basic Usage Examples

**対象**: JupyterLab拡張機能の基本的な使用方法を学びたいユーザー  
**前提**: Cell Monitor Extension がインストール済み

---

## 🚀 基本的な使用フロー

### 1. 設定確認・初期化

```python
# Step 1: 設定確認用セル
import os
import json

print("=== Cell Monitor Extension 設定確認 ===")
print(f"ユーザー名: {os.getenv('JUPYTER_USER', 'Anonymous')}")
print(f"接続確認: Settings → Advanced Settings → Cell Monitor で確認")
```

```python
# Step 2: 接続テスト
import datetime

print(f"接続テスト実行時刻: {datetime.datetime.now()}")
print("このセル実行がダッシュボードに表示されているか確認してください")
```

### 2. 基本的なコード実行監視

```python
# Example 1: シンプルな計算
a = 10
b = 20
result = a + b
print(f"計算結果: {result}")

# この実行がイベントとして記録されます
```

```python
# Example 2: データ処理
import pandas as pd
import numpy as np

# サンプルデータ作成
data = {
    'name': ['Alice', 'Bob', 'Charlie'],
    'age': [25, 30, 35],
    'score': [85, 92, 78]
}

df = pd.DataFrame(data)
print("データフレーム作成完了:")
print(df)
```

```python
# Example 3: 可視化
import matplotlib.pyplot as plt

# グラフ作成
plt.figure(figsize=(8, 5))
plt.bar(df['name'], df['score'])
plt.title('学生スコア')
plt.ylabel('点数')
plt.show()

print("グラフ表示完了")
```

---

## 🆘 ヘルプ機能の使用

### ヘルプ要請の基本パターン

#### パターン 1: エラーが発生した場合
```python
# 意図的なエラー例
try:
    # エラーが発生するコード
    result = 10 / 0
except ZeroDivisionError as e:
    print(f"エラーが発生しました: {e}")
    print("🆘 ヘルプボタンを押して講師に質問してください")
```

#### パターン 2: 概念が理解できない場合
```python
# 理解に困っている例
print("Q: このコードの動作がよく分からない...")
print("🆘 ヘルプボタンを押して説明を求めましょう")

# for文の例
for i in range(5):
    print(f"ループ {i+1} 回目")
```

#### パターン 3: 実装方法が分からない場合
```python
print("Q: リストの中から最大値を見つけたいのですが...")
print("🆘 ヘルプボタンでアドバイスを求めてみましょう")

numbers = [3, 7, 2, 9, 1, 5]
# ここで実装に困っている状態
```

---

## 📊 学習進捗の確認

### 自分の進捗確認
```python
# 学習セッションの開始
print("=== 学習セッション開始 ===")
print("今日の目標: Python基礎文法の理解")

# セルを実行するたびに進捗が記録されます
```

```python
# 中間チェックポイント
print("=== 中間チェックポイント ===")
print("✅ 変数の使い方を理解")
print("✅ 条件分岐 (if文) を理解")
print("🔄 ループ処理を学習中")
print("⏳ 関数定義は今後学習予定")
```

```python
# 学習セッションの終了
print("=== 学習セッション終了 ===")
print("今日の学習内容:")
print("- Python基本文法")
print("- データ型の理解")
print("- 簡単な計算処理")
print("\n明日の予定: 関数とモジュール")
```

---

## 🎯 実践的な課題例

### 課題 1: 基本計算プログラム
```python
# 課題: 消費税込み価格の計算プログラム
print("=== 消費税計算プログラム ===")

# 商品価格（税抜き）
price = 1000
tax_rate = 0.10  # 10%

# 税込み価格の計算
total_price = price * (1 + tax_rate)

print(f"税抜き価格: {price}円")
print(f"消費税率: {tax_rate*100}%")
print(f"税込み価格: {total_price}円")
```

### 課題 2: データ分析入門
```python
# 課題: 学生の成績データ分析
print("=== 成績データ分析 ===")

# 学生の成績データ
students = [
    {'name': 'Alice', 'math': 85, 'english': 90, 'science': 78},
    {'name': 'Bob', 'math': 92, 'english': 85, 'science': 95},
    {'name': 'Charlie', 'math': 78, 'english': 88, 'science': 82}
]

# 平均点の計算
for student in students:
    average = (student['math'] + student['english'] + student['science']) / 3
    print(f"{student['name']}の平均点: {average:.1f}点")
```

### 課題 3: エラー処理の実践
```python
# 課題: 安全な数値入力プログラム
print("=== 安全な数値入力プログラム ===")

def safe_input(prompt):
    """安全に数値を入力する関数"""
    while True:
        try:
            value = float(input(prompt))
            return value
        except ValueError:
            print("無効な入力です。数値を入力してください。")

# 実際の使用例（デモ用にハードコーディング）
number1 = 10.0  # safe_input("1つ目の数値を入力: ")
number2 = 3.0   # safe_input("2つ目の数値を入力: ")

print(f"入力された数値: {number1}, {number2}")
print(f"合計: {number1 + number2}")
print(f"平均: {(number1 + number2) / 2}")
```

---

## 🔍 デバッグ・トラブルシューティング例

### 一般的なエラーパターンと対処法

#### 1. インデントエラー
```python
# ❌ 間違った例
if True:
print("インデントが正しくありません")

# ✅ 正しい例  
if True:
    print("インデントが正しく設定されています")
```

#### 2. 変数名エラー
```python
# ❌ 間違った例
name = "Alice"
print(naem)  # 変数名のタイプミス

# ✅ 正しい例
name = "Alice"
print(name)  # 正しい変数名
```

#### 3. 型エラー
```python
# ❌ 間違った例
age = "25"
next_age = age + 1  # 文字列と数値の演算はエラー

# ✅ 正しい例
age = 25  # 数値型
next_age = age + 1
print(f"来年の年齢: {next_age}")
```

---

## 🎓 チーム学習での活用

### ペア・プログラミング例
```python
# ペア作業: 一人が運転手（Driver）、一人がナビゲーター（Navigator）
print("=== ペアプログラミング セッション ===")
print("運転手: コードを実際に書く人")
print("ナビゲーター: コードをレビュー・提案する人")

# 課題: FizzBuzz問題
def fizzbuzz(n):
    """1からnまでのFizzBuzz"""
    for i in range(1, n + 1):
        if i % 15 == 0:
            print("FizzBuzz")
        elif i % 3 == 0:
            print("Fizz")
        elif i % 5 == 0:
            print("Buzz")
        else:
            print(i)

# テスト実行
fizzbuzz(15)
```

### チーム内進捗共有
```python
# チーム進捗レポート
print("=== チーム1 進捗レポート ===")
print("メンバー: Alice, Bob, Charlie")
print("今週の目標: Python基礎マスター")
print()
print("個別進捗:")
print("Alice: ✅ 変数・条件分岐完了 → ループ学習中")
print("Bob: ✅ 全基礎文法完了 → 関数学習中")  
print("Charlie: 🆘 条件分岐で質問あり")
print()
print("次回までの目標: 全員が関数定義まで完了")
```

---

## 📈 学習データの活用

### 自己振り返り用コード
```python
import datetime

# 学習記録テンプレート
learning_log = {
    'date': datetime.date.today().strftime('%Y-%m-%d'),
    'topics_learned': [
        'Python基本文法',
        'データ型',
        '条件分岐'
    ],
    'difficulties': [
        'インデントの理解',
        'エラーメッセージの読み方'
    ],
    'achievements': [
        '基本的な計算プログラム作成',
        'エラー修正の経験'
    ],
    'next_goals': [
        'ループ処理のマスター',
        '関数定義の理解'
    ]
}

print("=== 本日の学習記録 ===")
for key, value in learning_log.items():
    print(f"{key}: {value}")
```

---

## 🔄 継続学習のコツ

### 毎回の学習セッションで実行する習慣
```python
# 学習開始ルーチン
print("🚀 学習開始!")
print(f"日時: {datetime.datetime.now()}")
print("今日のモチベーション: 新しいことを一つでも覚える!")
```

```python
# 学習終了ルーチン  
print("🎉 学習終了!")
print("今日学んだこと:")
print("- [ここに学習内容を記録]")
print("- [つまずいた点があれば記録]")
print("- [明日への課題があれば記録]")
print("\n明日も頑張りましょう! 💪")
```

---

## 🔗 関連リソース

### 次に読むべきドキュメント
- [Advanced Scenarios](advanced-scenarios.md) - 高度な活用法
- [Custom Events](custom-events.md) - カスタムイベント
- [Educator Handbook](../guides/educator-handbook.md) - 教育者向けガイド
- [Troubleshooting](../guides/troubleshooting.md) - 問題解決

### 学習リソース
- **Python公式チュートリアル**: https://docs.python.org/ja/3/tutorial/
- **Pandas公式ドキュメント**: https://pandas.pydata.org/docs/
- **Matplotlib公式ドキュメント**: https://matplotlib.org/stable/contents.html

**最終更新**: 2025-08-29