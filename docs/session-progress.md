# Ochi-ss 開発進捗サマリー

最終更新: 2026-05-19  
最新コミット: 9ccf8f8〜（fix_session25以降）

## 実装完了機能

### 認証・セキュリティ
- [x] ログイン（企業コード/ユーザーID/PW）パスワード表示トグル付き
- [x] セッションタイムアウト警告（残り25分でヘッダーに表示）
- [x] NextAuth.js v5 beta
- [x] CSPヘッダー/CSRF Origin検証/AES-256-GCM 暗号化（住所・TEL・FAX）
- [x] HTTPS自己署名証明書（開発環境）

### 見積機能
- [x] /estimates/new 新規作成（計算スピナー/直送先検索/明細追加/複写）
- [x] /estimates/[id]/edit 編集（納期有効期限チェック/check-deadline）
- [x] /estimates 一覧（検索・ページネーション・注文/コピー/見積書/取消ボタン）
- [x] /estimates/[id]/pdf 見積書HTML（印刷でPDF）
- [x] POST /api/v1/estimates/[id]/cancel 見積キャンセル
- [x] 保存後 estimateNo 表示

### 注文機能
- [x] /orders/confirm 注文確認（納期有効期限チェック/明細テーブル/409二重注文防止）
- [x] /orders/complete 注文完了（注文No表示）
- [x] /orders 注文一覧（検索・ページネーション）
- [x] /orders/[id] 注文詳細（ステータス変更履歴/仕様変更履歴）
- [x] /orders/[id]/pdf 注文書HTML
- [x] orderNo 採番（Z+YYYYMMDD+3桁連番）
- [x] Outbox Pattern（order.placed/estimate.created → SQL Server）

### マスタ管理
- [x] /masters/direct-delivery 直送先CRUD
- [x] /masters/chamfer-rules 面取りルール管理（Admin専用）
- [x] cutting-methods/direct-deliveries PostgreSQL fallback実装

### お知らせ
- [x] /notifications 一覧（通知区分フィルタ/未読のみ/既読のみ/ページネーション）
- [x] /notifications/[id] 詳細（自動既読処理）
- [x] notification_reads 既読管理テーブル
- [x] ヘッダー未読バッジ
- [x] dashboard お知らせパネル（フィルタ/未読のみ）

### 共通UI
- [x] 共通ヘッダー（ベルアイコン/未読バッジ/ハンバーガーメニュー/タイムアウト警告）
- [x] Toast共通コンポーネント
- [x] Skip link（アクセシビリティ）
- [x] レスポンシブモバイルドロワーメニュー

### 管理者機能
- [x] /admin/debug-config デバッグ設定管理（完全実装）
- [x] /access-denied アクセス拒否ページ（発生日時/ユーザー情報/戻るボタン）

### インフラ・品質
- [x] Prisma $extends AES暗号化
- [x] SystemSetting モデル
- [x] notification_reads モデル
- [x] ChamferRule モデル
- [x] formatNumber ユーティリティ（removeCommas/formatWithCommas/formatCurrency）
- [x] E2Eテスト用 seed スクリプト
- [x] E2Eテストチェックリスト（36項目）

## 残課題（低優先度）
- [ ] /notifications 返信フォーム（返信可能な場合）
- [ ] 数値入力フォームへの formatNumber ユーティリティ適用
- [ ] React Hook Form + Zod バリデーション（現状は手動バリデーション）
- [ ] SQL Server 接続時の cutting-methods/direct-deliveries 本番動作確認
- [ ] sync-service 本番環境での動作確認（SQL Server VPN接続）
- [ ] WebSocket/SSE リアルタイム通知（将来対応）
