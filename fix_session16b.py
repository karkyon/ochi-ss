#!/usr/bin/env python3
"""
fix_session16b.py
=================
FIX 1: .next/dev/types/routes.d.ts を module として認識させる
        (export {} を末尾に追加、または tsconfig exclude で除外)
FIX 2: POST /api/v1/orders Outbox Event INSERT (正確なアンカー)
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
# FIX 1: tsconfig.json の exclude に .next を追加
# ============================================================
def fix1():
    print("\n[FIX 1] tsconfig.json .next exclude 追加")
    path = ROOT / "tsconfig.json"
    if not path.exists():
        print("  ⚠️  tsconfig.json 未存在")
        return

    import json
    with open(path, encoding="utf-8") as f:
        content = f.read()

    try:
        # コメント付き JSON は通常の json.loads で失敗するので文字列操作
        if '".next"' in content:
            print("  ⏭️  .next は既に exclude 済み")
            return

        # "exclude" キーがあれば追加、なければ新規作成
        if '"exclude"' in content:
            # 既存 exclude 配列の最初の要素の前に追加
            content = content.replace(
                '"exclude": [',
                '"exclude": [\n    ".next",',
                1
            )
        else:
            # compilerOptions の後に exclude を追加
            content = content.replace(
                '}\n}',
                '},\n  "exclude": [".next", "node_modules"]\n}',
                1
            )

        path.write_text(content, encoding="utf-8")
        print("  ✅ .next を tsconfig exclude に追加")
    except Exception as e:
        print(f"  ❌ tsconfig 編集失敗: {e}")

# ============================================================
# FIX 2: POST /api/v1/orders Outbox Event INSERT
# ============================================================
def fix2():
    print("\n[FIX 2] POST /api/v1/orders Outbox Event INSERT")
    path = "src/app/api/v1/orders/route.ts"
    content = read(path)

    if "outboxEvent" in content or "outbox" in content.lower():
        print("  ⏭️  既に outbox 実装済み")
        return

    # 現在のファイルの末尾付近の return 文を探す
    # "return NextResponse.json" で 201 を返している行
    import re

    # 201 Created を返す行を探す
    patterns = [
        r'return NextResponse\.json\(\s*\{[^}]*orderId[^}]*\}\s*,\s*\{\s*status:\s*201\s*\}\s*\)',
        r'return NextResponse\.json\(\{[^}]*orderId',
    ]

    for pat in patterns:
        m = re.search(pat, content, re.DOTALL)
        if m:
            old_return = m.group(0)
            new_return = '''\
// Outbox Event — SQL Server WEBデータ確認へ非同期送信
    try {
      await prisma.outboxEvent.create({
        data: {
          aggregateType: "order",
          aggregateId:   order.id,
          eventType:     "order.placed",
          payload:       JSON.parse(JSON.stringify({
            orderNo:         order.orderNo,
            customerCode:    session.user.companyCode,
            orderDate:       order.orderDate?.toISOString(),
          })),
          status: "pending",
        },
      })
    } catch (e) {
      console.error("[POST /orders] outbox create failed:", e)
    }

    ''' + old_return
            content = content[:m.start()] + new_return + content[m.end():]
            (ROOT / path).write_text(content, encoding="utf-8")
            print("  ✅ outbox event CREATE 追加")
            return

    # フォールバック: ファイル末尾の } の前に追加
    # 最後の "return NextResponse.json" を探す
    idx = content.rfind("return NextResponse.json")
    if idx > 0:
        line_end = content.find("\n", idx)
        if line_end < 0:
            line_end = len(content)
        old_line = content[idx:line_end]
        outbox_block = '''\
// Outbox Event
    try {
      await prisma.outboxEvent.create({
        data: {
          aggregateType: "order",
          aggregateId:   order.id,
          eventType:     "order.placed",
          payload:       { orderNo: order.orderNo, customerCode: session.user.companyCode },
          status:        "pending",
        },
      })
    } catch (e) { console.error("[POST /orders] outbox failed:", e) }

    '''
        content = content[:idx] + outbox_block + content[idx:]
        (ROOT / path).write_text(content, encoding="utf-8")
        print("  ✅ outbox event CREATE 追加（フォールバック）")
        return

    print("  ❌ return 文アンカー未発見")

# ============================================================
# メイン
# ============================================================
def main():
    print("=" * 60)
    print("fix_session16b.py 開始")
    print("=" * 60)
    fix1()
    fix2()

    print("\n→ tscチェック中...")
    result = subprocess.run(["npx", "tsc", "--noEmit"], capture_output=True, text=True, cwd=str(ROOT))
    if result.returncode != 0:
        print("❌ tscエラー:")
        print((result.stdout + result.stderr)[-6000:])
        sys.exit(1)

    print("✅ tscエラーなし → git add & push")
    subprocess.run(["git", "add", "-A"], check=True, cwd=str(ROOT))
    subprocess.run(["git", "commit", "-m",
        "fix: tsconfig .next除外/Outbox Event INSERT実装"],
        check=True, cwd=str(ROOT))
    subprocess.run(["git", "push"], check=True, cwd=str(ROOT))
    print("✅ push完了")

if __name__ == "__main__":
    main()
