#!/usr/bin/env python3
"""
fix_session15d.py — 3ファイル一括修正（貼り付けコードから正確なアンカー確認済み）
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
# FIX 1: EstimatesClient.tsx — 壊れたHTMLを正しい注文ボタンに修正
# ============================================================
def fix1():
    print("\n[FIX 1] EstimatesClient.tsx 壊れたHTML修正 + 注文ボタン正しく追加")

    # 壊れた箇所を正しいコードに置換
    rep(
        "src/app/(app)/estimates/EstimatesClient.tsx",
        """\
                          <Link
                            <a
                              href={`/orders/confirm?estimateId=${e.id}`}
                              className="px-2 py-1 text-xs rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors whitespace-nowrap"
                            >
                              🛒 注文
                            </a>
                            href={`/estimates/new?copyFrom=${est.id}`}
                            className="px-2.5 py-1 text-xs rounded border border-sky-300 text-sky-700 hover:bg-sky-50 transition-colors whitespace-nowrap"
                          >
                            コピー
                          </Link>""",
        """\
                          <Link
                            href={`/orders/confirm?estimateId=${est.id}`}
                            className="px-2.5 py-1 text-xs rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors whitespace-nowrap"
                          >
                            🛒 注文
                          </Link>
                          <Link
                            href={`/estimates/new?copyFrom=${est.id}`}
                            className="px-2.5 py-1 text-xs rounded border border-sky-300 text-sky-700 hover:bg-sky-50 transition-colors whitespace-nowrap"
                          >
                            コピー
                          </Link>""",
        "EstimatesClient 壊れたHTML修正"
    )

# ============================================================
# FIX 2: EstimateNewClient — savedEstimateId セット（正確なアンカー）
# ============================================================
def fix2():
    print("\n[FIX 2] EstimateNewClient savedEstimateId セット")

    path = "src/app/(app)/estimates/new/EstimateNewClient.tsx"
    content = read(path)

    # setSavedEstimateId が既に存在するか確認
    if "setSavedEstimateId" not in content:
        print("  ❌ setSavedEstimateId が未存在 — state追加から")
        return

    # router.push の行を探して savedEstimateId セットに置換
    # 実際のコードパターンを複数試行
    patterns = [
        (
            "      setSaveMessage({ type: \"success\", text: `見積を保存しました（見積No: ${saved.estimateNo}）` })\n      router.push(`/estimates/${saved.estimateId}/edit`)",
            "      setSaveMessage({ type: \"success\", text: `見積を保存しました（見積No: ${saved.estimateNo}）` })\n      setSavedEstimateId(saved.estimateId)"
        ),
        (
            "setSaveMessage({ type: \"success\", text: `見積を保存しました（見積No: ${saved.estimateNo}）` })\n      router.push(`/estimates/${saved.estimateId}/edit`)",
            "setSaveMessage({ type: \"success\", text: `見積を保存しました（見積No: ${saved.estimateNo}）` })\n      setSavedEstimateId(saved.estimateId)"
        ),
    ]
    for old, new in patterns:
        if old in content:
            content = content.replace(old, new, 1)
            (ROOT / path).write_text(content, encoding="utf-8")
            print("  ✅ savedEstimateId セット + router.push 削除")
            return

    # router.push のみ単独で探す
    if "router.push(`/estimates/${saved.estimateId}/edit`)" in content:
        content = content.replace(
            "router.push(`/estimates/${saved.estimateId}/edit`)",
            "setSavedEstimateId(saved.estimateId)",
            1
        )
        (ROOT / path).write_text(content, encoding="utf-8")
        print("  ✅ router.push → setSavedEstimateId 置換")
        return

    # 保存成功後の遷移を全パターンで検索
    import re
    m = re.search(r'router\.push\(`/estimates/\$\{saved\.\w+\}/edit`\)', content)
    if m:
        content = content[:m.start()] + "setSavedEstimateId(saved.estimateId)" + content[m.end():]
        (ROOT / path).write_text(content, encoding="utf-8")
        print("  ✅ router.push (regex) → setSavedEstimateId 置換")
        return

    print("  ❌ router.push アンカー未発見 — 手動確認要")

# ============================================================
# FIX 3: EstimateEditClient — 保存ボタン行に注文ボタン追加
# ============================================================
def fix3():
    print("\n[FIX 3] EstimateEditClient 注文ボタン追加")
    path = "src/app/(app)/estimates/[id]/edit/EstimateEditClient.tsx"
    content = read(path)

    if "orders/confirm" in content:
        print("  ⏭️  既に存在")
        return

    # ナレッジから確認: bg-[#1a2744] text-white の保存ボタン
    # 保存ボタンの className で探す
    save_btn_marker = 'className="px-6 py-2.5 text-sm font-medium rounded-lg bg-[#1a2744] text-white hover:bg-[#1a3a6e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"'

    if save_btn_marker in content:
        # <button の開始を探す
        btn_start = content.rfind('\n            <button', 0, content.find(save_btn_marker))
        if btn_start > 0:
            order_btn = """\
            {estimateData.estimateStatus !== "ordered" && estimateData.estimateStatus !== "cancelled" && (
              <a
                href={`/orders/confirm?estimateId=${estimateData.id}`}
                className="px-5 py-2.5 text-sm rounded-lg font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
              >
                🛒 注文する
              </a>
            )}\n"""
            content = content[:btn_start+1] + order_btn + content[btn_start+1:]
            (ROOT / path).write_text(content, encoding="utf-8")
            print("  ✅ 注文するボタン追加")
            return

    # フォールバック: "保存する" テキストを含む button を探す
    for marker in ['"保存する"', '"保存中..."', 'saveLoading ? "保存中..."']:
        if marker in content:
            idx = content.find(marker)
            btn_start = content.rfind('\n            <button', 0, idx)
            if btn_start < 0:
                btn_start = content.rfind('\n          <button', 0, idx)
            if btn_start > 0:
                order_btn = """\
            {estimateData.estimateStatus !== "ordered" && estimateData.estimateStatus !== "cancelled" && (
              <a
                href={`/orders/confirm?estimateId=${estimateData.id}`}
                className="px-5 py-2.5 text-sm rounded-lg font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
              >
                🛒 注文する
              </a>
            )}\n"""
                content = content[:btn_start+1] + order_btn + content[btn_start+1:]
                (ROOT / path).write_text(content, encoding="utf-8")
                print(f"  ✅ 注文するボタン追加（フォールバック: {marker}）")
                return

    print("  ❌ 挿入位置未発見")

# ============================================================
# メイン
# ============================================================
def main():
    print("=" * 60)
    print("fix_session15d.py 開始")
    print("=" * 60)
    fix1()
    fix2()
    fix3()

    print("\n→ tscチェック中...")
    result = subprocess.run(["npx", "tsc", "--noEmit"], capture_output=True, text=True, cwd=str(ROOT))
    if result.returncode != 0:
        print("❌ tscエラー:")
        print((result.stdout + result.stderr)[-6000:])
        sys.exit(1)

    print("✅ tscエラーなし → git add & push")
    subprocess.run(["git", "add", "-A"], check=True, cwd=str(ROOT))
    subprocess.run(["git", "commit", "-m",
        "fix: EstimatesClient壊れたHTML修正 + 注文ボタン全画面追加"],
        check=True, cwd=str(ROOT))
    subprocess.run(["git", "push"], check=True, cwd=str(ROOT))
    print("✅ push完了")

if __name__ == "__main__":
    main()
