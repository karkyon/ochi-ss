#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fix_admin_mojibake_and_ordered_detail_flags.py

【対象リポジトリ】 karkyon/ochi-ss のプロジェクトルートで実行すること。

【問題1: CMSの文字化け】
  AdminShell.tsxのヘッダー部分で、一部のテキストを \\uXXXX 形式の
  Unicodeエスケープのまま「JSXの地の文（タグの間の裸のテキスト）」として
  書いてしまっていた。JSXの地の文はJS文字列リテラルではないため
  \\uXXXX エスケープは解釈されず、"\\u7ba1\\u7406\\u8005" のような
  文字列がそのまま画面に表示されてしまっていた
  （サイドバーのナビ項目は配列内の文字列リテラルとして書いていたため
   正しく "ダッシュボード" 等に解釈され、こちらは問題なかった）。
  対象箇所を実際の日本語リテラルに置き換えて修正する。

  あわせて、CMSサイドバーから 📋見積一覧・📦注文一覧・🚚直送先管理 の
  3項目を削除する（ダッシュボードと自社情報設定のみ残す）。

【問題2: 注文済み明細のチェックボックス無効化・状態表示】
  EstimateNewClient.tsx 側には既に
    d.isOrdered → 「注文済」バッジ + 注文No表示、チェックボックス非表示
    !d.isOrdered → 通常のチェックボックス表示
  というロジックが実装済みだったが、見積編集画面
  (/estimates/[id]/edit/page.tsx) が渡すcopySourceの明細データに
  isOrdered / orderedOrderNo を一切含めていなかったため、
  常に「未注文」として扱われチェックボックスが有効なままだった。

  受注(Order)は本システムでは「見積単位」で1:1に紐づく
  (Order.estimateHeaderId は unique)ため、見積のestimateStatusが
  "ordered" であれば、その見積に含まれる明細は全て注文済みとして扱う。
  該当の注文番号(orderNo)を取得し、全明細に isOrdered / orderedOrderNo
  を設定するよう修正する。

  本スクリプトは、AdminShell.tsxをこのファイル単体の意図的な全文差し替え
  （文字化け修正+メニュー削減のデザイン成果物のため）、
  edit/page.tsxを差分パッチで修正する。
  適用後、tsc --noEmit --skipLibCheck でコンパイルエラー0件を確認した場合のみ
  git commit & push を自動実行する。エラーがある場合はpushしない。
  実行後、このスクリプト自身を削除する。
"""

import subprocess
import sys
from pathlib import Path

ADMIN_SHELL_REL = "src/app/(app)/admin/AdminShell.tsx"
EDIT_PAGE_REL   = "src/app/(app)/estimates/[id]/edit/page.tsx"

ADMIN_SHELL_CONTENT = '''"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"

// 2026/07/13 修正: サイドバーは「ダッシュボード」「自社情報設定」のみに整理
// (見積一覧・注文一覧・直送先管理はメニューから削除。各画面へは既存の
//  グローバルメニューから遷移する運用のため、管理画面側では割愛)
const NAV_ITEMS = [
  { href: "/admin", icon: "\\ud83d\\udcca", label: "\\u30c0\\u30c3\\u30b7\\u30e5\\u30dc\\u30fc\\u30c9" },
  { href: "/admin/company", icon: "\\ud83c\\udfe2", label: "\\u81ea\\u793e\\u60c5\\u5831\\u8a2d\\u5b9a" },
]

interface Props {
  children: React.ReactNode
  userName: string
  companyName: string
}

export default function AdminShell({ children, userName, companyName }: Props) {
  const pathname = usePathname()

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f1f5f9" }}>
      {/* サイドバー */}
      <aside style={{ width: "230px", background: "#0f172a", color: "#e2e8f0", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "18px 16px", borderBottom: "1px solid #1e293b" }}>
          <div style={{ fontSize: "15px", fontWeight: 700, color: "#fff" }}>OCHIWEB 管理</div>
          <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "2px" }}>{companyName}</div>
        </div>
        <nav style={{ flex: 1, padding: "10px 8px" }}>
          {NAV_ITEMS.map(item => {
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href}
                style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "9px 12px", borderRadius: "6px", marginBottom: "2px",
                  fontSize: "12.5px", textDecoration: "none",
                  color: active ? "#fff" : "#cbd5e1",
                  background: active ? "#1d4ed8" : "transparent",
                  fontWeight: active ? 600 : 400,
                }}>
                <span>{item.icon}</span><span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
        <div style={{ padding: "12px 16px", borderTop: "1px solid #1e293b" }}>
          <Link href="/dashboard" style={{ fontSize: "11px", color: "#94a3b8", textDecoration: "none" }}>← メインメニューへ戻る</Link>
        </div>
      </aside>

      {/* メインエリア */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* ヘッダー */}
        <header style={{
          height: "56px", background: "#fff", borderBottom: "1px solid #e2e8f0",
          display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", flexShrink: 0,
        }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>管理者メニュー</div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "30px", height: "30px", borderRadius: "50%", background: "#e2e8f0",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", color: "#475569",
            }}>{"\\ud83d\\udc64"}</div>
            <div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>{userName || "管理者"}</div>
              <div style={{ fontSize: "10px", color: "#94a3b8" }}>管理者</div>
            </div>
          </div>
        </header>

        {/* メインコンテンツ */}
        <main style={{ flex: 1, padding: "20px", overflowY: "auto" }}>
          {children}
        </main>
      </div>
    </div>
  )
}
'''


def fail(msg: str) -> None:
    print(f"[FAIL] {msg}")
    sys.exit(1)


def rewrite_admin_shell(root: Path) -> None:
    target = root / ADMIN_SHELL_REL
    if not target.exists():
        fail(f"対象ファイルが見つかりません: {target}")
    original = target.read_text(encoding="utf-8")
    if original == ADMIN_SHELL_CONTENT:
        fail("既に適用済みです（内容に変化がありません）")
    target.write_text(ADMIN_SHELL_CONTENT, encoding="utf-8")
    print(f"[OK] 全文差し替え完了: {ADMIN_SHELL_REL}")


def patch_edit_page(root: Path) -> None:
    target = root / EDIT_PAGE_REL
    if not target.exists():
        fail(f"対象ファイルが見つかりません: {target}")
    text = target.read_text(encoding="utf-8")

    # --- 1. estimate取得直後に関連Orderを取得 ---
    anchor1 = '  if (!estimate) redirect("/estimates")\n\n  const copySource = {\n'
    if text.count(anchor1) != 1:
        fail(f"アンカー1が想定外の件数({text.count(anchor1)})で見つかりました: estimate取得直後")
    replacement1 = (
        '  if (!estimate) redirect("/estimates")\n'
        '\n'
        '  // 2026/07/13 追加: 見積が既に注文済み(estimateStatus==="ordered")の場合、\n'
        '  // 明細一覧に「注文済」バッジ・注文Noを表示しチェックボックスを無効化するため、\n'
        '  // 紐づく注文(Order)を取得する。受注は見積単位で1:1(estimateHeaderId unique)のため、\n'
        '  // 見積が注文済みならその見積の全明細が注文済み扱いとなる。\n'
        '  const relatedOrder = estimate.estimateStatus === "ordered"\n'
        '    ? await prisma.order.findFirst({ where: { estimateHeaderId: estimate.id }, select: { orderNo: true } })\n'
        '    : null\n'
        '\n'
        '  const copySource = {\n'
    )
    text = text.replace(anchor1, replacement1, 1)

    # --- 2. details.map に isOrdered / orderedOrderNo を追加 ---
    anchor2 = (
        '      deliveryDate:     d.shortestDelivery ?? undefined,\n'
        '      // ★2026/07/13 追加修正: EstimateNewClient.tsx の登録済み明細一覧「納期」列は\n'
        '      // deliveryDate ではなく fastDeliveryDate を参照している\n'
        '      // ({fmt(d.fastDeliveryDate)})。この行が無いと納期保証期限は表示されるのに\n'
        '      // 肝心の最短納期だけ常に空欄になる。/estimates/new/page.tsx と同じ形式に統一。\n'
        '      fastDeliveryDate: d.shortestDelivery ?? undefined,\n'
        '      // ★2026/07/13 修正: .slice(0, 10)で日付のみに切り詰めると時刻(17:30等)が\n'
        '      // 失われ、EstimateNewClient側のisExpired()判定で「すでに期限切れ」と\n'
        '      // 誤判定される致命的バグがあった。/estimates/new/page.tsx と同様に\n'
        '      // フルISO文字列(時刻付き)のまま渡すよう修正。\n'
        '      deliveryDeadline: d.deliveryDeadline\n'
        '        ? d.deliveryDeadline.toISOString()\n'
        '        : null,\n'
        '      calculated: true,\n'
        '    })),\n'
        '  }\n'
    )
    if text.count(anchor2) != 1:
        fail(f"アンカー2が想定外の件数({text.count(anchor2)})で見つかりました: details.map終端")
    replacement2 = (
        '      deliveryDate:     d.shortestDelivery ?? undefined,\n'
        '      fastDeliveryDate: d.shortestDelivery ?? undefined,\n'
        '      deliveryDeadline: d.deliveryDeadline\n'
        '        ? d.deliveryDeadline.toISOString()\n'
        '        : null,\n'
        '      // 2026/07/13 追加: 見積が注文済みなら全明細を注文済み扱いにし、\n'
        '      // チェックボックスを無効化して「注文済」+注文Noを表示する\n'
        '      isOrdered: estimate.estimateStatus === "ordered",\n'
        '      orderedOrderNo: relatedOrder?.orderNo ?? undefined,\n'
        '      calculated: true,\n'
        '    })),\n'
        '  }\n'
    )
    text = text.replace(anchor2, replacement2, 1)

    target.write_text(text, encoding="utf-8")
    print(f"[OK] パッチ適用完了: {EDIT_PAGE_REL}")


def main() -> None:
    root = Path.cwd()

    rewrite_admin_shell(root)
    patch_edit_page(root)

    print("[INFO] tsc --noEmit --skipLibCheck を実行します...")
    tsc = subprocess.run(
        ["npx", "tsc", "--noEmit", "--skipLibCheck"],
        cwd=root, capture_output=True, text=True
    )
    print(tsc.stdout)
    print(tsc.stderr)

    if tsc.returncode != 0:
        print("[NG] コンパイルエラーが検出されました。GitHubへのpushは行いません。")
        print("     ファイルへの変更は適用済みです。エラー内容を確認して修正してください。")
        sys.exit(1)

    print("[OK] コンパイルエラー0件を確認しました。")

    subprocess.run(["git", "add", ADMIN_SHELL_REL, EDIT_PAGE_REL], cwd=root, check=True)
    commit_msg = (
        "fix: CMSの文字化け修正+メニュー削減 / 注文済み明細のチェックボックス無効化\n\n"
        "- AdminShell.tsx: JSXの地の文で\\\\uエスケープが解釈されず文字化けして\n"
        "  いた箇所を実際の日本語リテラルに修正\n"
        "- サイドバーから見積一覧/注文一覧/直送先管理の3項目を削除\n"
        "  (ダッシュボード・自社情報設定のみ残す)\n"
        "- estimates/[id]/edit/page.tsx: 見積が注文済み(estimateStatus==='ordered')\n"
        "  の場合に関連Orderを取得し、全明細にisOrdered/orderedOrderNoを設定。\n"
        "  EstimateNewClient.tsx側の既存の表示ロジック(「注文済」バッジ+注文No表示、\n"
        "  チェックボックス無効化)が正しく機能するようになる"
    )
    commit = subprocess.run(
        ["git", "commit", "-m", commit_msg],
        cwd=root, capture_output=True, text=True
    )
    print(commit.stdout)
    print(commit.stderr)
    if commit.returncode != 0:
        print("[WARN] git commit に失敗、またはコミット対象がありません。push はスキップします。")
        sys.exit(1)

    push = subprocess.run(["git", "push"], cwd=root, capture_output=True, text=True)
    print(push.stdout)
    print(push.stderr)
    if push.returncode != 0:
        fail("git push に失敗しました。")

    print("[OK] GitHubへのpushが完了しました。")

    try:
        Path(__file__).unlink()
        print("[OK] スクリプト自身を削除しました。")
    except Exception as e:
        print(f"[WARN] スクリプト自身の削除に失敗しました: {e}")


if __name__ == "__main__":
    main()
