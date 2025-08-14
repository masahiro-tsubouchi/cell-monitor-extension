# JupyterLab拡張機能 ⇔ FastAPIサーバー データ連携仕様

> **バージョン**: 1.0.0
> **最終更新日**: 2025-01-19
> **対象**: フロントエンド・バックエンド開発者

## 📋 概要

JupyterLab Cell Monitor Extension とFastAPIサーバー間のデータ連携仕様を体系化したドキュメントです。イベント送信、API呼び出し、データベース保存の全フローを網羅し、現状の課題と改善提案も含めています。

## 🔄 データフロー概要

```
JupyterLab拡張機能 → FastAPIサーバー → データベース群
        ↑                     ↓
        └── WebSocket ← リアルタイム更新
```

## 📊 1. イベント送信とAPI対応表

### 1.1 セル実行イベント
| **拡張機能イベント** | **送信先API** | **HTTPメソッド** | **データ形式** | **バックエンド処理** | **保存先DB** |
|---------------------|--------------|----------------|---------------|-------------------|-------------|
| `cell_execution_start` | `/api/v1/events` | POST | ```json { "event_type": "cell_execution_start", "student_id": "user123", "session_id": "sess-abc", "notebook_path": "/notebooks/assignment1.ipynb", "cell_id": "cell-123", "execution_count": 1, "code": "print('hello')", "timestamp": "2025-01-19T12:00:00Z" } ``` | - イベント検証<br>- セッション管理<br>- 実行開始記録 | `cell_executions`<br>`student_progress` (InfluxDB) |
| `cell_execution_complete` | `/api/v1/events` | POST | ```json { "event_type": "cell_execution_complete", "student_id": "user123", "session_id": "sess-abc", "notebook_path": "/notebooks/assignment1.ipynb", "cell_id": "cell-123", "execution_count": 1, "output": {"data": "hello", "execution_count": 1}, "duration_ms": 150, "success": true, "timestamp": "2025-01-19T12:00:01Z" } ``` | - 実行結果記録<br>- 進捗更新<br>- WebSocket通知 | `cell_executions`<br>`student_progress` (InfluxDB) |
| `cell_execution_error` | `/api/v1/events` | POST | ```json { "event_type": "cell_execution_error", "student_id": "user123", "session_id": "sess-abc", "notebook_path": "/notebooks/assignment1.ipynb", "cell_id": "cell-123", "execution_count": 1, "error": {"name": "NameError", "message": "name 'x' is not defined", "traceback": "..."}, "timestamp": "2025-01-19T12:00:01Z" } ``` | - エラー記録<br>- エラー統計更新<br>- アラート送信 | `cell_executions`<br>`error_logs` |

### 1.2 LMS機能関連API
| **拡張機能操作** | **送信先API** | **HTTPメソッド** | **リクエスト形式** | **レスポンス形式** | **データソース** |
|-----------------|--------------|----------------|-------------------|-------------------|----------------|
| 課題一覧表示 | `/api/v1/assignments` | GET | ```json { "class_id": "class-123", "student_id": "user123", "status": "active" } ``` | ```json { "assignments": [ { "id": "assgn-123", "title": "Python入門", "description": "基本構文を学習", "due_date": "2025-04-30T23:59:59Z", "notebook_path": "/assignments/python_intro.ipynb", "submission_status": "not_submitted" } ] } ``` | `class_assignments`<br>`assignment_submissions` |
| 課題提出 | `/api/v1/submissions` | POST | ```json { "assignment_id": "assgn-123", "student_id": "user123", "notebook_content": { "cells": [...], "metadata": {...}, "nbformat": 4, "nbformat_minor": 2 }, "submitted_at": "2025-01-19T12:00:00Z", "submission_comment": "完了しました" } ``` | ```json { "submission_id": "sub-456", "status": "submitted", "submitted_at": "2025-01-19T12:00:00Z", "message": "提出が完了しました" } ``` | `assignment_submissions`<br>`notebook_versions` |
| 提出履歴確認 | `/api/v1/submissions` | GET | ```json { "student_id": "user123", "assignment_id": "assgn-123" } ``` | ```json { "submissions": [ { "id": "sub-456", "submitted_at": "2025-01-19T12:00:00Z", "status": "graded", "score": 85, "feedback": "よくできています" } ] } ``` | `assignment_submissions` |

### 1.3 進捗監視・通知
| **イベント種別** | **WebSocketチャンネル** | **データ形式** | **トリガー条件** | **拡張機能の処理** |
|----------------|----------------------|---------------|-----------------|-------------------|
| 実行状態更新 | `progress:{student_id}` | ```json { "event": "execution_update", "student_id": "user123", "notebook_path": "/notebooks/assignment1.ipynb", "cell_id": "cell-123", "status": "executing", "timestamp": "2025-01-19T12:00:00Z" } ``` | セル実行開始時 | 進捗バーの更新 |
| 課題採点完了 | `notifications:{student_id}` | ```json { "event": "assignment_graded", "assignment_id": "assgn-123", "submission_id": "sub-456", "score": 85, "feedback": "よくできています", "graded_at": "2025-01-19T15:00:00Z" } ``` | 教員による採点完了時 | 通知バナー表示 |

## 📋 2. データベーステーブル対応表

### 2.1 学生・セッション管理
| **拡張機能データ** | **DBテーブル** | **カラム** | **型** | **必須** | **説明** |
|------------------|---------------|------------|--------|----------|----------|
| `student_id` | `students` | `user_id` | String(50) | ✅ | JupyterHub/LDAPユーザーID |
| `student_name` | `students` | `name` | String(100) |  | 学生氏名 |
| `email` | `students` | `email` | String(255) |  | メールアドレス |
| `session_id` | `sessions` | `session_id` | UUID | ✅ | JupyterLabセッション識別子 |
| `notebook_path` | `sessions` | `notebook_path` | String(500) | ✅ | ノートブックファイルパス |

### 2.2 ノートブック・セル管理
| **拡張機能データ** | **DBテーブル** | **カラム** | **型** | **必須** | **説明** |
|------------------|---------------|------------|--------|----------|----------|
| `notebook_path` | `notebooks` | `path` | String(500) | ✅ | ノートブックファイルパス |
| `notebook_name` | `notebooks` | `name` | String(200) | ✅ | ノートブック表示名 |
| `cell_id` | `cells` | `cell_id` | String(100) | ✅ | セル一意識別子 |
| `cell_type` | `cells` | `cell_type` | String(20) | ✅ | code/markdown/raw |
| `execution_count` | `cell_executions` | `execution_count` | Integer |  | セル実行回数 |
| `code` | `cell_executions` | `code` | Text |  | セルのソースコード |
| `output` | `cell_executions` | `output` | JSONB |  | セル実行結果 |

### 2.3 LMS機能データ
| **拡張機能データ** | **DBテーブル** | **カラム** | **型** | **必須** | **説明** |
|------------------|---------------|------------|--------|----------|----------|
| `assignment_id` | `class_assignments` | `id` | UUID | ✅ | 課題識別子 |
| `assignment_title` | `class_assignments` | `title` | String(200) | ✅ | 課題タイトル |
| `due_date` | `class_assignments` | `due_date` | DateTime |  | 提出期限 |
| `notebook_content` | `assignment_submissions` | `notebook_content` | JSONB | ✅ | 提出されたノートブック内容 |
| `submission_comment` | `assignment_submissions` | `submission_comment` | Text |  | 提出時コメント |
| `score` | `assignment_submissions` | `score` | Integer |  | 採点結果（0-100） |
| `feedback` | `assignment_submissions` | `feedback` | Text |  | 教員フィードバック |

## 🚨 3. 現状の課題と不足データ

### 3.1 データ連携の課題
| **課題** | **現状** | **影響** | **優先度** |
|---------|----------|----------|------------|
| **ノートブックバージョン管理不足** | 提出時のスナップショットのみ保存 | 編集履歴が追跡できない | 🔴 高 |
| **エラー詳細情報不足** | エラーメッセージのみ記録 | デバッグ・学習支援が困難 | 🟡 中 |
| **セル実行時間の精度** | ミリ秒単位だが開始・終了時刻なし | パフォーマンス分析が不十分 | 🟡 中 |
| **オフライン対応不足** | ネットワーク断絶時のデータ損失 | 学習データの欠損リスク | 🔴 高 |
| **バッチ処理の制限** | 1件ずつのイベント送信 | 大量実行時のパフォーマンス低下 | 🟡 中 |

### 3.2 不足しているデータ項目
| **データ項目** | **用途** | **提案する追加先** | **データ形式** |
|---------------|----------|-------------------|---------------|
| **ノートブック差分** | 編集履歴追跡・バージョン管理 | `notebook_versions` テーブル | ```json { "version": 1, "diff": {...}, "changed_cells": ["cell-1", "cell-3"] } ``` |
| **セル実行環境情報** | 環境依存問題の特定 | `cell_executions` テーブル | ```json { "python_version": "3.9.7", "packages": {"numpy": "1.21.0"}, "memory_usage": "45MB" } ``` |
| **学習時間統計** | 学習効率分析 | `learning_sessions` テーブル | ```json { "active_time_ms": 1800000, "idle_time_ms": 300000, "focus_score": 0.85 } ``` |
| **課題進捗率** | リアルタイム進捗表示 | `assignment_progress` テーブル | ```json { "completed_cells": 8, "total_cells": 10, "progress_rate": 0.8 } ``` |
| **エラー分類・頻度** | 学習支援・教材改善 | `error_patterns` テーブル | ```json { "error_category": "syntax_error", "frequency": 5, "common_solutions": [...] } ``` |

## 🔧 4. 改善提案

### 4.1 短期改善（1-2週間）
1. **バッチ処理対応**
   - 最大100件のイベントをまとめて送信
   - クライアント側バッファリング機能追加

2. **エラー詳細記録強化**
   - スタックトレース全体の保存
   - エラー発生コンテキスト（変数状態等）の記録

3. **オフライン対応基盤**
   - IndexedDBでのローカルキューイング
   - ネットワーク復旧時の自動同期

### 4.2 中期改善（1-2ヶ月）
1. **ノートブックバージョン管理**
   - Git風の差分管理システム導入
   - セル単位での変更履歴追跡

2. **学習分析機能強化**
   - 学習時間・集中度の自動計測
   - 個人別学習パターン分析

3. **リアルタイム進捗表示**
   - 課題進捗率のライブ更新
   - クラス全体の進捗ダッシュボード

### 4.3 長期改善（3-6ヶ月）
1. **AI支援機能**
   - エラーパターン学習による自動提案
   - 個人適応型学習支援

2. **高度な分析機能**
   - 学習効率最適化提案
   - 教材難易度自動調整

## 📈 5. パフォーマンス最適化

### 5.1 データ送信最適化
| **最適化項目** | **現状** | **改善案** | **期待効果** |
|---------------|----------|------------|-------------|
| **イベント圧縮** | 未実装 | gzip圧縮 + JSON最適化 | 70%サイズ削減 |
| **バッチ送信** | 1件ずつ | 最大100件バッチ | 90%リクエスト数削減 |
| **差分送信** | 全データ送信 | 変更分のみ送信 | 80%データ量削減 |

### 5.2 データベース最適化
| **最適化項目** | **現状** | **改善案** | **期待効果** |
|---------------|----------|------------|-------------|
| **インデックス追加** | 基本インデックスのみ | 複合インデックス追加 | 50%クエリ高速化 |
| **パーティショニング** | 単一テーブル | 日付別パーティション | 70%検索高速化 |
| **キャッシュ強化** | 基本キャッシュ | Redis多層キャッシュ | 80%応答速度向上 |

---

**このドキュメントは継続的に更新され、JupyterLab拡張機能とFastAPIサーバー間のデータ連携品質向上に活用されます。**
