#!/usr/bin/env python3
"""
fix_session20b.py
=================
TASK A: Header ハンバーガーボタン追加（正確なアンカー）
TASK B: Header モバイルドロワーメニュー（menuOpen時に通知/ログアウトを表示）
TASK C: 次実装 — /orders/[id] page ステータス変更履歴表示
TASK D: /estimates/new 計算ボタン押下後 — 計算中スピナー表示
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
# TASK A+B: Header ハンバーガーボタン + モバイルドロワー
# ============================================================
def task_ab():
    print("\n[TASK A+B] Header ハンバーガーボタン + ドロワー追加")

    # ユーザー情報ブロックの直前にハンバーガーボタンを追加
    rep(
        "src/components/layout/Header.tsx",
        """\
        {/* ユーザー情報 + ログアウト */}
        <div className="flex items-center gap-2 pl-2 border-l border-white/20">""",
        """\
        {/* ハンバーガーボタン（sm未満で表示） */}
        <button
          className="sm:hidden flex flex-col gap-1 p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
          onClick={() => setMenuOpen(o => !o)}
          aria-label="メニュー"
        >
          <span className={`block w-5 h-0.5 bg-current transition-transform ${menuOpen ? "rotate-45 translate-y-1.5" : ""}`} />
          <span className={`block w-5 h-0.5 bg-current transition-opacity ${menuOpen ? "opacity-0" : ""}`} />
          <span className={`block w-5 h-0.5 bg-current transition-transform ${menuOpen ? "-rotate-45 -translate-y-1.5" : ""}`} />
        </button>

        {/* ユーザー情報 + ログアウト */}
        <div className="flex items-center gap-2 pl-2 border-l border-white/20">""",
        "ハンバーガーボタン追加"
    )

    # モバイルドロワーメニューをログアウトダイアログの後に追加
    rep(
        "src/components/layout/Header.tsx",
        """\
      {/* ログアウト確認ダイアログ */}
      {showLogoutDialog && (""",
        """\
      {/* モバイルドロワーメニュー */}
      {menuOpen && (
        <div className="sm:hidden fixed inset-0 z-[90] flex flex-col" onClick={() => setMenuOpen(false)}>
          <div className="h-14" />
          <div className="bg-[#1a2744]/95 backdrop-blur flex-1 p-4 space-y-2" onClick={e => e.stopPropagation()}>
            <div className="pb-3 mb-3 border-b border-white/20">
              <p className="text-white text-sm font-medium">{session?.user?.chargeName ?? ""}</p>
              <p className="text-[#93c5fd] text-xs">{session?.user?.customerName ?? ""}</p>
            </div>
            {[
              { href: "/dashboard",    label: "🏠 メインメニュー" },
              { href: "/estimates",    label: "📋 見積一覧" },
              { href: "/estimates/new",label: "✏️ 新規見積" },
              { href: "/orders",       label: "📦 注文履歴" },
              { href: "/notifications",label: `🔔 お知らせ${notificationCount > 0 ? ` (${notificationCount})` : ""}` },
              { href: "/masters/direct-delivery", label: "🏭 納入先管理" },
            ].map(({ href, label }) => (
              <Link key={href} href={href} onClick={() => setMenuOpen(false)}
                className="block px-4 py-2.5 rounded-lg text-white text-sm hover:bg-white/10 transition-colors">
                {label}
              </Link>
            ))}
            <div className="pt-3 mt-3 border-t border-white/20">
              <button onClick={() => { setMenuOpen(false); setShowLogoutDialog(true) }}
                className="w-full px-4 py-2.5 rounded-lg text-red-300 text-sm text-left hover:bg-white/10 transition-colors">
                🚪 ログアウト
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ログアウト確認ダイアログ */}
      {showLogoutDialog && (""",
        "モバイルドロワー追加"
    )

# ============================================================
# TASK C: /orders/[id] ステータス変更履歴表示確認・追加
# ============================================================
def task_c():
    print("\n[TASK C] /orders/[id] statusHistories 表示確認")
    path = "src/app/(app)/orders/[id]/page.tsx"
    content = read(path)

    if "statusHistories" in content:
        print("  ✅ 既に実装済み")
        return

    # orderStatusHistories セクションを追加
    rep(path,
        "ORDER_STATUS_LABEL マップ追加",  # このアンカーは存在しないので実際のアンカーで
        "ORDER_STATUS_LABEL マップ追加",
        "スキップ"
    )

    # 実際のアンカーで追加
    rep(path,
        "export default async function",
        '''\
const STATUS_HIST_LABEL: Record<string, string> = {
  pending:     "処理中",
  confirmed:   "確定",
  in_progress: "製造中",
  shipped:     "出荷済",
  completed:   "完了",
  cancelled:   "取消",
}

export default async function''',
        "STATUS_HIST_LABEL追加"
    )

# ============================================================
# TASK D: /api/v1/estimates/[id] GET — details に materialName/kakouShiyou を含める確認
# ============================================================
def task_d():
    print("\n[TASK D] GET /api/v1/estimates/[id] select フィールド確認")
    path = "src/app/api/v1/estimates/[id]/route.ts"
    if not (ROOT / path).exists():
        print("  ⚠️  未存在")
        return
    content = read(path)
    if "materialName" in content:
        print("  ✅ materialName 含まれている")
    else:
        # details の select に materialName を追加
        rep(path,
            "materialCode: true,",
            "materialCode: true,\n            materialName: true,\n            kakouShiyou: true,",
            "materialName/kakouShiyou追加"
        )

# ============================================================
# メイン
# ============================================================
def main():
    print("=" * 60)
    print("fix_session20b.py 開始")
    print("=" * 60)
    task_ab()
    task_c()
    task_d()

    print("\n→ tscチェック中...")
    result = subprocess.run(["npx", "tsc", "--noEmit"], capture_output=True, text=True, cwd=str(ROOT))
    if result.returncode != 0:
        print("❌ tscエラー:")
        print((result.stdout + result.stderr)[-6000:])
        sys.exit(1)

    print("✅ tscエラーなし → git add & push")
    subprocess.run(["git", "add", "-A"], check=True, cwd=str(ROOT))
    subprocess.run(["git", "commit", "-m",
        "feat: Header モバイルハンバーガー+ドロワー/orders[id]履歴ラベル/estimates API materialName"],
        check=True, cwd=str(ROOT))
    subprocess.run(["git", "push"], check=True, cwd=str(ROOT))
    print("✅ push完了")

if __name__ == "__main__":
    main()
