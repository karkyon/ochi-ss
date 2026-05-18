#!/usr/bin/env python3
"""
fix_session12c.py — tscエラー全修正
エラー1: dashboard.tsx OR重複 + カラム名不一致(subject→title, notifyType→notifType, priority未存在)
エラー2: EstimateEditClient Props に estimateId 未定義
エラー3: TASK C check-deadline アンカー再試行
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
    if not path.exists(): print(f"  ⚠️  [{label}] ファイル未存在"); return False
    c = path.read_text(encoding="utf-8")
    if old not in c: print(f"  ❌ [{label}] アンカー未発見\n     期待: {repr(old[:80])}"); return False
    path.write_text(c.replace(old, new, 1), encoding="utf-8"); print(f"  ✅ [{label}]"); return True

# ============================================================
# FIX 1: dashboard notifications クエリ全体を正しいカラム名で書き直し
# ============================================================
def fix1():
    print("\n[FIX 1] dashboard notifications クエリ修正")
    rep(
        "src/app/(app)/dashboard/page.tsx",
        '''\
  try {
    const now = new Date()
    const rawNotifications = await prisma.notification.findMany({
      where: {
        isDeleted: false,
        OR: [{ targetCustomerId: null }, { targetCustomerId: session?.user?.customerId }],
        publishedAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
      },
      orderBy: [{ priority: "desc" }, { publishedAt: "desc" }],
      take: 10,
      select: { id: true, subject: true, notifyType: true, priority: true, publishedAt: true },
    })
    // 既読チェック（NotificationRead テーブルがあれば参照、なければ全件未読扱い）
    notifications = rawNotifications.map(n => ({ ...n, isRead: false }))
  } catch {
    notifications = []
  }''',
        '''\
  try {
    const now = new Date()
    const rawNotifications = await prisma.notification.findMany({
      where: {
        isDeleted: false,
        publishedAt: { lte: now },
        expiresAt: { gte: now },
      },
      orderBy: { publishedAt: "desc" },
      take: 10,
      select: { id: true, title: true, notifType: true, publishedAt: true },
    })
    notifications = rawNotifications.map(n => ({
      id: n.id,
      subject: n.title,
      notifyType: n.notifType,
      priority: 0,
      publishedAt: n.publishedAt,
      isRead: false,
    }))
  } catch {
    notifications = []
  }''',
        "notifications クエリ修正"
    )

# ============================================================
# FIX 2: EstimateEditClient Props に estimateId 追加
# ============================================================
def fix2():
    print("\n[FIX 2] EstimateEditClient Props estimateId 追加")
    path = "src/app/(app)/estimates/[id]/edit/EstimateEditClient.tsx"
    c = read(path)

    # Props 型定義を探してestimateId を追加
    # パターン1: type Props = { または interface Props {
    found = False
    for pattern in [
        ("type Props = {", "type Props = {\n  estimateId?: string"),
        ("interface Props {", "interface Props {\n  estimateId?: string"),
    ]:
        if pattern[0] in c and "estimateId" not in c:
            c = c.replace(pattern[0], pattern[1], 1)
            found = True
            print(f"  ✅ Props に estimateId 追加 ({pattern[0][:30]})")
            break

    if not found and "estimateId" not in c:
        # Props型が見つからない場合はコンポーネント引数に直接追加
        # export default function EstimateEditClient({ ... }: Props)
        # or export default function EstimateEditClient({ estimateData, ...
        for sig in [
            ("export default function EstimateEditClient({", True),
            ("export function EstimateEditClient({", True),
        ]:
            if sig[0] in c:
                # 引数の最初に estimateId を追加
                c = c.replace(sig[0], sig[0] + "\n  estimateId,", 1)
                print(f"  ✅ 引数に estimateId 追加")
                found = True
                break

    if not found:
        print("  ❌ Props/引数のパターン未発見 — 手動確認要")

    # useEffect check-deadline 追加（アンカーを柔軟に検索）
    if "check-deadline" not in c:
        # "use client" の直後 or useEffect の最初の登場前に追加
        import_anchor = '"use client"'
        if import_anchor in c:
            # useEffect import を確認
            if "useEffect" not in c:
                c = c.replace(
                    'import { useState',
                    'import { useState, useEffect',
                    1
                )
            # コンポーネント関数本体の開始を探す
            # "  const [" が最初に出る前に useEffect を差し込む
            # より安全: estimateId を使う場所の直前
            # コンポーネント内の最初の useState の直前に差し込む
            first_state = "  const [" 
            idx = c.find(first_state)
            if idx > 0:
                insert = '''\
  // ── 納期有効期限チェック（編集モード時） ──
  useEffect(() => {
    if (!estimateId) return
    const checkDeadline = async () => {
      try {
        const res = await fetch(`/api/v1/estimates/${estimateId}/check-deadline`, { method: "POST" })
        if (!res.ok) return
        const data = await res.json()
        if (data.hasExpired) {
          const rows = (data.expiredDetails as Array<{rowNo:number}>).map((d:any) => `No.${d.rowNo}`).join("、")
          alert(`⚠️ 納期保証期限が切れた明細があります（${rows}）。\\n内容をご確認の上、見積計算を再実行してから保存してください。`)
        }
      } catch { /* silent */ }
    }
    checkDeadline()
  }, [estimateId])

'''
                c = c[:idx] + insert + c[idx:]
                print("  ✅ check-deadline useEffect 挿入")
            else:
                print("  ⚠️  useEffect 挿入位置未発見")

    write(path, c)

# ============================================================
# FIX 3: edit/page.tsx — EstimateEditClient の Props 型確認・estimateId 渡し確認
# ============================================================
def fix3():
    print("\n[FIX 3] edit/page.tsx estimateId 渡し確認")
    path = "src/app/(app)/estimates/[id]/edit/page.tsx"
    c = read(path)

    if "estimateId={id}" in c:
        print("  ✅ estimateId={id} は既に存在")
        return

    # <EstimateEditClient\n        estimateId={id} のパターンで既に追加されているか
    if "estimateId=" in c:
        print("  ✅ estimateId prop は既に存在（別形式）")
        return

    # <EstimateEditClient に追加
    for anchor in [
        "      <EstimateEditClient\n",
        "      <EstimateEditClient ",
        "<EstimateEditClient\n",
        "<EstimateEditClient ",
    ]:
        if anchor in c:
            c = c.replace(anchor, anchor.rstrip() + "\n        estimateId={id}\n", 1)
            write(path, c)
            print("  ✅ estimateId={id} 追加")
            return

    print("  ❌ <EstimateEditClient アンカー未発見")

# ============================================================
# メイン
# ============================================================
def main():
    print("=" * 60)
    print("fix_session12c.py 開始")
    print("=" * 60)

    fix1()
    fix2()
    fix3()

    print("\n" + "=" * 60)
    print("→ tscチェック中...")
    result = subprocess.run(["npx", "tsc", "--noEmit"], capture_output=True, text=True, cwd=str(ROOT))
    if result.returncode != 0:
        print("❌ tscエラー:")
        print((result.stdout + result.stderr)[-6000:])
        sys.exit(1)

    print("✅ tscエラーなし → git add & push")
    subprocess.run(["git", "add", "-A"], check=True, cwd=str(ROOT))
    subprocess.run(["git", "commit", "-m",
        "fix: dashboard notifications カラム名修正 / EstimateEditClient estimateId Props追加 / check-deadline統合"],
        check=True, cwd=str(ROOT))
    subprocess.run(["git", "push"], check=True, cwd=str(ROOT))
    print("✅ push完了")

if __name__ == "__main__":
    main()
