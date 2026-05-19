#!/usr/bin/env python3
import subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent

def rep(p, old, new, label):
    path = ROOT / p
    c = path.read_text(encoding="utf-8")
    if old not in c: print(f"  ❌ [{label}]"); return False
    path.write_text(c.replace(old, new, 1), encoding="utf-8"); print(f"  ✅ [{label}]"); return True

def main():
    print("fix_session22b.py 開始")

    # 誤挿入されたコードを GETの if(!session) ブロックから削除
    rep(
        "src/app/api/v1/estimates/route.ts",
        """\
  if (!session) {
    // Outbox Event（非同期 — 失敗しても保存は成功扱い）
    try {
      await prisma.outboxEvent.create({
        data: {
          aggregateType: "estimate",
          aggregateId:   header.id,
          eventType:     "estimate.created",
          payload: {
            estimateNo:      header.estimateNo,
            customerCode:    session.user.companyCode,
            destinationName: body.destinationName ?? null,
            detailCount:     body.details?.length ?? 0,
          },
          status: "pending",
        },
      })
    } catch (e) { console.error("[POST /estimates] outbox create failed:", e) }

    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }""",
        """\
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }""",
        "GET if(!session) 誤挿入削除"
    )

    # POST の return NextResponse.json({ success: true, ... の直前に正しく挿入
    rep(
        "src/app/api/v1/estimates/route.ts",
        """\
    return NextResponse.json(
      { success: true, estimateId: saved.id },
      { status: 201 }
    )""",
        """\
    // Outbox Event（非同期 — 失敗しても保存は成功扱い）
    try {
      await prisma.outboxEvent.create({
        data: {
          aggregateType: "estimate",
          aggregateId:   saved.id,
          eventType:     "estimate.created",
          payload: {
            estimateNo:      saved.estimateNo,
            customerCode:    session.user.companyCode,
            destinationName: body.destinationName ?? null,
            detailCount:     body.details?.length ?? 0,
          },
          status: "pending",
        },
      })
    } catch (e) { console.error("[POST /estimates] outbox create failed:", e) }

    return NextResponse.json(
      { success: true, estimateId: saved.id, estimateNo: saved.estimateNo },
      { status: 201 }
    )""",
        "POST return直前に outbox INSERT"
    )

    print("→ tscチェック中...")
    r = subprocess.run(["npx", "tsc", "--noEmit"], capture_output=True, text=True, cwd=str(ROOT))
    if r.returncode != 0:
        print("❌ tscエラー:"); print((r.stdout + r.stderr)[-4000:]); sys.exit(1)

    print("✅ → git push")
    subprocess.run(["git", "add", "-A"], check=True, cwd=str(ROOT))
    subprocess.run(["git", "commit", "-m", "fix: estimates GET誤挿入削除/POST outbox正しい位置に再配置"], check=True, cwd=str(ROOT))
    subprocess.run(["git", "push"], check=True, cwd=str(ROOT))
    print("✅ push完了")

if __name__ == "__main__":
    main()
