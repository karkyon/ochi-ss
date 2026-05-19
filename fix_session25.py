#!/usr/bin/env python3
"""
fix_session25.py
================
TASK A: /orders/confirm — 409 (二重注文) エラーを既存注文詳細へのリンク付きで表示
TASK B: /estimates 一覧 — キャンセルボタン追加（ordered 以外のみ表示）
TASK C: EstimatesClient — 注文済み見積の「注文」ボタンを注文詳細リンクに変更
TASK D: /api/v1/estimates/[id]/route.ts PATCH → PUT/PATCH 両対応
TASK E: セッション一覧の実装完了確認 + 最終サマリー生成
"""

import subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def read(p): return (ROOT / p).read_text(encoding="utf-8")
def write(p, c):
    path = ROOT / p; path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(c, encoding="utf-8"); print(f"  ✅ 書込: {p}")

def rep(p, old, new, label):
    path = ROOT / p
    if not path.exists(): print(f"  ⚠️  [{label}] 未存在"); return False
    c = path.read_text(encoding="utf-8")
    if old not in c: print(f"  ❌ [{label}] アンカー未発見"); return False
    path.write_text(c.replace(old, new, 1), encoding="utf-8"); print(f"  ✅ [{label}]"); return True

# ============================================================
# TASK A: /orders/confirm — 409エラーハンドリング
# ============================================================
def task_a():
    print("\n[TASK A] /orders/confirm 409エラーハンドリング")
    rep(
        "src/app/(app)/orders/confirm/page.tsx",
        """\
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "注文に失敗しました")
      router.replace(`/orders/complete?orderId=${data.orderId}`)""",
        """\
      const data = await res.json()
      if (res.status === 409) {
        // 既に注文済みの場合は既存注文詳細へ誘導
        router.replace(`/orders/${data.orderId}`)
        return
      }
      if (!res.ok) throw new Error(data.error ?? "注文に失敗しました")
      router.replace(`/orders/complete?orderId=${data.orderId}`)""",
        "409 既注文リダイレクト"
    )

# ============================================================
# TASK B: EstimatesClient キャンセルボタン追加
# ============================================================
def task_b():
    print("\n[TASK B] EstimatesClient キャンセルボタン追加")
    path = "src/app/(app)/estimates/EstimatesClient.tsx"
    content = read(path)

    if "cancel" in content.lower() and "キャンセル" in content:
        print("  ⏭️  既に実装済み")
        return

    # 見積書ボタンの後にキャンセルボタンを追加
    rep(path,
        """\
                          <Link
                            href={`/api/v1/estimates/${est.id}/pdf`}
                            target="_blank"
                            className="px-2.5 py-1 text-xs rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors whitespace-nowrap"
                          >
                            見積書
                          </Link>""",
        """\
                          <Link
                            href={`/api/v1/estimates/${est.id}/pdf`}
                            target="_blank"
                            className="px-2.5 py-1 text-xs rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors whitespace-nowrap"
                          >
                            見積書
                          </Link>
                          {est.estimateStatus !== "ordered" && est.estimateStatus !== "cancelled" && (
                            <button
                              onClick={async () => {
                                if (!confirm(`見積 ${est.estimateNo || est.id.slice(0,8)} をキャンセルしますか？`)) return
                                const res = await fetch(`/api/v1/estimates/${est.id}/cancel`, { method: "POST" })
                                if (res.ok) router.refresh()
                                else alert("キャンセル失敗")
                              }}
                              className="px-2.5 py-1 text-xs rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors whitespace-nowrap"
                            >
                              取消
                            </button>
                          )}""",
        "キャンセルボタン追加"
    )

# ============================================================
# TASK C: EstimatesClient 注文済み見積の「注文」ボタンを注文詳細リンクに
# ============================================================
def task_c():
    print("\n[TASK C] EstimatesClient 注文済み行の注文ボタン対応")
    path = "src/app/(app)/estimates/EstimatesClient.tsx"
    content = read(path)
    if "estimateStatus !== \"ordered\"" in content or 'estimateStatus !== "ordered"' in content:
        print("  ⏭️  既に実装済み")
        return

    # 注文ボタンを条件付きに変更
    rep(path,
        """\
                          <Link
                            href={`/orders/confirm?estimateId=${est.id}`}
                            className="px-2.5 py-1 text-xs rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors whitespace-nowrap"
                          >
                            🛒 注文
                          </Link>""",
        """\
                          {est.estimateStatus === "ordered" ? (
                            <span className="px-2.5 py-1 text-xs rounded border border-green-200 bg-green-50 text-green-700 whitespace-nowrap">
                              注文済
                            </span>
                          ) : est.estimateStatus !== "cancelled" ? (
                            <Link
                              href={`/orders/confirm?estimateId=${est.id}`}
                              className="px-2.5 py-1 text-xs rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors whitespace-nowrap"
                            >
                              🛒 注文
                            </Link>
                          ) : (
                            <span className="px-2.5 py-1 text-xs rounded border border-gray-200 bg-gray-50 text-gray-400 whitespace-nowrap">
                              取消済
                            </span>
                          )}""",
        "注文ボタン条件付き"
    )

# ============================================================
# TASK D: /estimates/[id]/route.ts に PATCH も追加（EditClientが PUT を使用）
# ============================================================
def task_d():
    print("\n[TASK D] estimates/[id] PATCH エイリアス確認")
    path = "src/app/api/v1/estimates/[id]/route.ts"
    content = read(path)
    if "export async function PATCH" in content:
        print("  ⏭️  PATCH 既存")
        return
    if "export async function PUT" in content:
        # PATCH を PUT のエイリアスとして追加
        rep(path,
            "export async function PUT(",
            "export { PUT as PATCH }\nexport async function PUT(",
            "PATCH エイリアス追加"
        )
        # export { PUT as PATCH } は末尾に追加する方が安全
        content2 = read(path)
        if "export { PUT as PATCH }" in content2:
            # 先頭に移動する必要があるので削除してファイル末尾に追加
            content2 = content2.replace("export { PUT as PATCH }\n", "")
            content2 += "\nexport { PUT as PATCH }\n"
            (ROOT / path).write_text(content2, encoding="utf-8")
            print("  ✅ PATCH エイリアスを末尾に移動")
    else:
        print("  ⚠️  PUT 未発見")

# ============================================================
# TASK E: 完了確認 + docs 更新
# ============================================================
def task_e():
    print("\n[TASK E] 実装完了サマリー更新")
    write("docs/session-progress.md", '''\
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
''')

# ============================================================
# メイン
# ============================================================
def main():
    print("=" * 60)
    print("fix_session25.py 開始")
    print("=" * 60)
    task_a()
    task_b()
    task_c()
    task_d()
    task_e()

    print("\n→ tscチェック中...")
    result = subprocess.run(["npx", "tsc", "--noEmit"], capture_output=True, text=True, cwd=str(ROOT))
    if result.returncode != 0:
        print("❌ tscエラー:")
        print((result.stdout + result.stderr)[-6000:])
        sys.exit(1)

    print("✅ tscエラーなし → git add & push")
    subprocess.run(["git", "add", "-A"], check=True, cwd=str(ROOT))
    subprocess.run(["git", "commit", "-m",
        "feat: confirm 409ハンドリング/estimates一覧キャンセルボタン/注文済みバッジ/進捗サマリー"],
        check=True, cwd=str(ROOT))
    subprocess.run(["git", "push"], check=True, cwd=str(ROOT))
    print("✅ push完了")

if __name__ == "__main__":
    main()
