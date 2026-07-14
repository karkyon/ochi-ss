#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
部分注文対応の実装。

背景: これまでは見積ヘッダー全体(estimateStatus)を見て「注文済みかどうか」を
判定しており、Order.estimateHeaderId も @unique（見積1件につき受注1件のみ）
だったため、明細の一部だけ先に注文し、残りを後から注文することが構造的に
不可能だった（注文APIはestimateIdのみを受け取り、見積の全明細を常に
丸ごと注文していた）。

今回の変更:
  1. schema.prisma
     - Order.estimateHeaderId の @unique を撤廃（1見積に複数受注可）
     - EstimateDetail に orderId / orderedOrderNo を追加
       （明細ごとに「どの受注に属するか」を直接持つ）
  2. POST /api/v1/orders
     - detailIds（注文対象の明細ID配列）を受け取れるようにする
     - 対象明細だけを orderId で紐づけ、残りの明細はそのまま未注文で残す
     - 見積の全明細が注文済みになった場合のみ estimateStatus を "ordered" に、
       一部だけなら "saved" のままにして編集・追加注文を可能にする
  3. PUT /api/v1/estimates/[id]
     - 明細の削除・再作成処理から、注文済み(orderId設定済み)の明細を除外し、
       DBの既存内容をそのまま保持する（クライアントが何を送っても不変）
  4. estimates/[id]/edit/page.tsx
     - isOrdered/orderedOrderNo をヘッダーステータスからの推測ではなく、
       明細自身の orderId/orderedOrderNo から判定する
  5. EstimateNewClient.tsx
     - 注文確認画面へ遷移する際に選択した明細IDを渡す（部分注文対応）
     - 注文済み明細の納期保証期限表示をブランクにする
  6. orders/confirm/page.tsx
     - detailIds クエリパラメータを読み取り、注文APIへ渡す

スコープ外（今回未対応・要フォローアップ）:
  - 見積書PDFへの「注文済」明示
  - 注文確認画面(orders/confirm)での明細一覧表示自体を選択分だけに絞る
    UI側フィルタリング（機能的には選択分のみが正しく注文されるが、
    確認画面には見積の全明細が一覧表示される）
"""
import subprocess
import sys
import time
from pathlib import Path

REPO_ROOT = Path("/home/karkyon/projects/ochi-ss")

FILE_SCHEMA      = REPO_ROOT / "prisma/schema.prisma"
FILE_ORDERS      = REPO_ROOT / "src/app/api/v1/orders/route.ts"
FILE_PUT         = REPO_ROOT / "src/app/api/v1/estimates/[id]/route.ts"
FILE_EDIT_PAGE   = REPO_ROOT / "src/app/(app)/estimates/[id]/edit/page.tsx"
FILE_CLIENT      = REPO_ROOT / "src/app/(app)/estimates/new/EstimateNewClient.tsx"
FILE_CONFIRM     = REPO_ROOT / "src/app/(app)/orders/confirm/page.tsx"

MARKER = "部分注文対応"


def die(msg: str):
    print(f"[NG] {msg}")
    sys.exit(1)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count == 0:
        die(f"パッチ対象文字列が見つかりません ({label})。処理を中断します。")
    if count > 1:
        die(f"パッチ対象文字列が複数箇所に一致しました ({label})。安全のため処理を中断します。")
    return text.replace(old, new, 1)


def already_patched(path: Path) -> bool:
    return MARKER in path.read_text(encoding="utf-8")


# ── 1. schema.prisma ──
def patch_schema():
    if already_patched(FILE_SCHEMA):
        print(f"[SKIP] 既に適用済み: {FILE_SCHEMA.relative_to(REPO_ROOT)}")
        return
    text = FILE_SCHEMA.read_text(encoding="utf-8")

    old_unique = '  estimateHeaderId String    @unique @map("estimate_header_id")\n'
    new_unique = '  estimateHeaderId String    @map("estimate_header_id") // 部分注文対応: 1見積に複数受注を許可\n'
    text = replace_once(text, old_unique, new_unique, "Order.estimateHeaderIdのunique撤廃")

    old_idx = (
        '  @@index([customerId, orderStatus])\n'
        '  @@map("orders")\n'
        '}\n'
    )
    new_idx = (
        '  @@index([customerId, orderStatus])\n'
        '  @@index([estimateHeaderId])\n'
        '  @@map("orders")\n'
        '}\n'
    )
    text = replace_once(text, old_idx, new_idx, "Order.estimateHeaderIdへのインデックス追加")

    old_detail = (
        '  destinationFax      String?   @map("indiv_destination_fax")\n'
        '  // 計算中間値（デバッグ・監査用）\n'
    )
    new_detail = (
        '  destinationFax      String?   @map("indiv_destination_fax")\n'
        '  // ★2026/07/14 部分注文対応: 明細単位の注文済み管理。\n'
        '  // 見積ヘッダーのestimateStatusに頼らず、明細自身がどの受注に属するかを持つ。\n'
        '  orderId             String?   @map("order_id")\n'
        '  orderedOrderNo      String?   @map("ordered_order_no")\n'
        '  // 計算中間値（デバッグ・監査用）\n'
    )
    text = replace_once(text, old_detail, new_detail, "EstimateDetailにorderId/orderedOrderNo追加")

    FILE_SCHEMA.write_text(text, encoding="utf-8")
    print(f"[OK] パッチ適用完了: {FILE_SCHEMA.relative_to(REPO_ROOT)}")


# ── 2. POST /api/v1/orders ──
def patch_orders_route():
    if already_patched(FILE_ORDERS):
        print(f"[SKIP] 既に適用済み: {FILE_ORDERS.relative_to(REPO_ROOT)}")
        return
    text = FILE_ORDERS.read_text(encoding="utf-8")

    old_a = (
        '  const body = await req.json()\n'
        '  const { estimateId } = body as { estimateId: string }\n'
        '  if (!estimateId) return NextResponse.json({ error: "estimateId required" }, { status: 400 })\n'
    )
    new_a = (
        '  const body = await req.json()\n'
        '  // ★2026/07/14 部分注文対応\n'
        '  const { estimateId, detailIds } = body as { estimateId: string; detailIds?: string[] }\n'
        '  if (!estimateId) return NextResponse.json({ error: "estimateId required" }, { status: 400 })\n'
    )
    text = replace_once(text, old_a, new_a, "orders POST: detailIds受け取り")

    old_b = (
        '  const ownerErr = assertOwner(estimate, ctx.customerId, ctx.isSuperAdmin)\n'
        '  if (ownerErr) return ownerErr\n'
        '  if (estimate.estimateStatus === "ordered")\n'
        '    return NextResponse.json({ error: "この見積は既に注文済みです" }, { status: 409 })\n'
        '  if (estimate.details.length === 0)\n'
        '    return NextResponse.json({ error: "明細が1件もありません" }, { status: 400 })\n'
        '\n'
        '  const totalAmount = estimate.details.reduce((s: number, d: any) => s + Number(d.totalPrice ?? 0), 0)\n'
        '  const detailCount = estimate.details.length\n'
    )
    new_b = (
        '  const ownerErr = assertOwner(estimate, ctx.customerId, ctx.isSuperAdmin)\n'
        '  if (ownerErr) return ownerErr\n'
        '  // ★2026/07/14 部分注文対応: 見積ヘッダー全体のestimateStatusではなく、\n'
        '  // 明細ごとのorderId(注文済みかどうか)で判定する。detailIdsが指定されれば\n'
        '  // その明細のみ、未指定なら未注文の明細すべてを対象にする。\n'
        '  const targetDetails = estimate.details.filter((d: any) =>\n'
        '    !d.orderId && (!detailIds || detailIds.includes(d.id))\n'
        '  )\n'
        '  if (targetDetails.length === 0)\n'
        '    return NextResponse.json({ error: "注文可能な明細がありません（すべて注文済みか、対象の明細が見つかりません）" }, { status: 409 })\n'
        '\n'
        '  const totalAmount = targetDetails.reduce((s: number, d: any) => s + Number(d.totalPrice ?? 0), 0)\n'
        '  const detailCount = targetDetails.length\n'
    )
    text = replace_once(text, old_b, new_b, "orders POST: 明細単位の注文可否判定")

    old_c = (
        '  const order = await withTenant(ctx.customerId, ctx.isSuperAdmin, async (tx) => {\n'
        '    const o = await (tx as any).order.create({\n'
        '      data: { orderNo, estimateHeaderId: estimateId, customerId: ctx.customerId, orderStatus: "pending", totalAmount, detailCount },\n'
        '    })\n'
        '    await (tx as any).estimateHeader.update({ where: { id: estimateId }, data: { estimateStatus: "ordered" } })\n'
        '    return o\n'
        '  })\n'
    )
    new_c = (
        '  const order = await withTenant(ctx.customerId, ctx.isSuperAdmin, async (tx) => {\n'
        '    const o = await (tx as any).order.create({\n'
        '      data: { orderNo, estimateHeaderId: estimateId, customerId: ctx.customerId, orderStatus: "pending", totalAmount, detailCount },\n'
        '    })\n'
        '    // ★2026/07/14 部分注文対応: 対象明細だけを注文済みにし、残りの未注文明細はそのまま残す\n'
        '    await (tx as any).estimateDetail.updateMany({\n'
        '      where: { id: { in: targetDetails.map((d: any) => d.id) } },\n'
        '      data: { orderId: o.id, orderedOrderNo: orderNo },\n'
        '    })\n'
        '    // 見積の全明細が注文済みになった場合のみ見積ステータスを"ordered"にする。\n'
        '    // 一部だけ注文済みの場合は"saved"のままにし、残りの明細を編集・追加注文できるようにする。\n'
        '    const remaining = await (tx as any).estimateDetail.count({\n'
        '      where: { estimateHeaderId: estimateId, isDeleted: false, orderId: null },\n'
        '    })\n'
        '    await (tx as any).estimateHeader.update({\n'
        '      where: { id: estimateId },\n'
        '      data: { estimateStatus: remaining === 0 ? "ordered" : "saved" },\n'
        '    })\n'
        '    return o\n'
        '  })\n'
    )
    text = replace_once(text, old_c, new_c, "orders POST: 対象明細のみorderId更新+ヘッダーステータス再計算")

    FILE_ORDERS.write_text(text, encoding="utf-8")
    print(f"[OK] パッチ適用完了: {FILE_ORDERS.relative_to(REPO_ROOT)}")


# ── 3. PUT /api/v1/estimates/[id] ──
def patch_put_route():
    if already_patched(FILE_PUT):
        print(f"[SKIP] 既に適用済み: {FILE_PUT.relative_to(REPO_ROOT)}")
        return
    text = FILE_PUT.read_text(encoding="utf-8")

    old_del = '      await (tx as any).estimateDetail.deleteMany({ where: { estimateHeaderId: id } })\n'
    new_del = (
        '      // ★2026/07/14 部分注文対応: 注文済み(orderId設定済み)明細は削除対象から除外し、\n'
        '      // DBの既存内容をそのまま保持する。\n'
        '      await (tx as any).estimateDetail.deleteMany({ where: { estimateHeaderId: id, orderId: null } })\n'
    )
    text = replace_once(text, old_del, new_del, "PUT: 注文済み明細を削除対象から除外")

    old_create = (
        '        data: body.details.map((d: any, idx: number) => ({\n'
        '          estimateHeaderId: id, rowNo: idx + 1,\n'
    )
    new_create = (
        '        // ★2026/07/14 部分注文対応: 注文済み明細(d.isOrdered)はここで再作成しない\n'
        '        // (DBの既存行をそのまま保持)。rowNoはクライアントが全明細（注文済み含む）に\n'
        '        // 対して採番した値をそのまま使い、既存の注文済み行のrowNoと衝突しないようにする。\n'
        '        data: body.details.filter((d: any) => !d.isOrdered).map((d: any) => ({\n'
        '          estimateHeaderId: id, rowNo: d.rowNo,\n'
    )
    text = replace_once(text, old_create, new_create, "PUT: 注文済み明細を再作成対象から除外")

    FILE_PUT.write_text(text, encoding="utf-8")
    print(f"[OK] パッチ適用完了: {FILE_PUT.relative_to(REPO_ROOT)}")


# ── 4. estimates/[id]/edit/page.tsx ──
def patch_edit_page():
    if already_patched(FILE_EDIT_PAGE):
        print(f"[SKIP] 既に適用済み: {FILE_EDIT_PAGE.relative_to(REPO_ROOT)}")
        return
    text = FILE_EDIT_PAGE.read_text(encoding="utf-8")

    old_related = (
        '  // 2026/07/13 追加: 見積が既に注文済み(estimateStatus==="ordered")の場合、\n'
        '  // 明細一覧に「注文済」バッジ・注文Noを表示しチェックボックスを無効化するため、\n'
        '  // 紐づく注文(Order)を取得する。受注は見積単位で1:1(estimateHeaderId unique)のため、\n'
        '  // 見積が注文済みならその見積の全明細が注文済み扱いとなる。\n'
        '  const relatedOrder = estimate.estimateStatus === "ordered"\n'
        '    ? await prisma.order.findFirst({ where: { estimateHeaderId: estimate.id }, select: { orderNo: true } })\n'
        '    : null\n'
    )
    new_related = (
        '  // ★2026/07/14 部分注文対応: isOrdered/orderedOrderNoは明細自身が持つ\n'
        '  // orderId/orderedOrderNoから判定するため、ここでの受注取得は不要になった。\n'
    )
    text = replace_once(text, old_related, new_related, "edit/page.tsx: relatedOrder取得の削除")

    old_isordered = (
        '      // 2026/07/13 追加: 見積が注文済みなら全明細を注文済み扱いにし、\n'
        '      // チェックボックスを無効化して「注文済」+注文Noを表示する\n'
        '      isOrdered: estimate.estimateStatus === "ordered",\n'
        '      orderedOrderNo: relatedOrder?.orderNo ?? undefined,\n'
    )
    new_isordered = (
        '      // ★2026/07/14 部分注文対応: ヘッダーステータスからの推測ではなく、\n'
        '      // 明細自身が持つorderId/orderedOrderNoで判定する。\n'
        '      isOrdered: !!(d as any).orderId,\n'
        '      orderedOrderNo: (d as any).orderedOrderNo ?? undefined,\n'
    )
    text = replace_once(text, old_isordered, new_isordered, "edit/page.tsx: isOrdered判定を明細ベースに変更")

    FILE_EDIT_PAGE.write_text(text, encoding="utf-8")
    print(f"[OK] パッチ適用完了: {FILE_EDIT_PAGE.relative_to(REPO_ROOT)}")


# ── 5. EstimateNewClient.tsx ──
def patch_client():
    if already_patched(FILE_CLIENT):
        print(f"[SKIP] 既に適用済み: {FILE_CLIENT.relative_to(REPO_ROOT)}")
        return
    text = FILE_CLIENT.read_text(encoding="utf-8")

    old_order = (
        '  const handleOrder = async () => {\n'
        '    const sel = details.filter(d => selectedIds.has(d.clientDetailId))\n'
        '    console.log("[handleOrder] 選択明細:", sel.length, "件")\n'
        '    if (sel.length === 0) { alert("注文する明細を選択してください"); return }\n'
        '    // パターン3のみ注文可能チェック\n'
        '    const nonOrderable = sel.filter(d => detailPattern(d) !== 3)\n'
        '    if (nonOrderable.length > 0) { alert("注文できない明細が含まれています。\\n金額・納期が両方算出された明細のみ注文できます。"); return }\n'
        '    await handleSave()\n'
        '    if (draftId) window.location.href = "/orders/confirm?estimateId=" + draftId\n'
        '  }\n'
    )
    new_order = (
        '  const handleOrder = async () => {\n'
        '    const sel = details.filter(d => selectedIds.has(d.clientDetailId))\n'
        '    console.log("[handleOrder] 選択明細:", sel.length, "件")\n'
        '    if (sel.length === 0) { alert("注文する明細を選択してください"); return }\n'
        '    // パターン3のみ注文可能チェック\n'
        '    const nonOrderable = sel.filter(d => detailPattern(d) !== 3)\n'
        '    if (nonOrderable.length > 0) { alert("注文できない明細が含まれています。\\n金額・納期が両方算出された明細のみ注文できます。"); return }\n'
        '    await handleSave()\n'
        '    // ★2026/07/14 部分注文対応: 選択した明細IDだけを注文確認画面へ渡す\n'
        '    const detailIdsParam = sel.map(d => d.clientDetailId).join(",")\n'
        '    if (draftId) window.location.href = "/orders/confirm?estimateId=" + draftId + "&detailIds=" + encodeURIComponent(detailIdsParam)\n'
        '  }\n'
    )
    text = replace_once(text, old_order, new_order, "handleOrder: detailIdsを渡す")

    old_deadline = (
        '                <td style={{ ...TD, textAlign: "center" }}>\n'
        '                  {d.deliveryDeadline ? (\n'
        '                    <>\n'
        '                      <div style={{ fontSize: "10px", color: isExpired(d.deliveryDeadline) ? "#ef4444" : "#334155", fontWeight: 600 }}>{fmtDt(d.deliveryDeadline)}</div>\n'
        '                      <div style={{ fontSize: "9px", fontWeight: 700, color: remainingLabel(d.deliveryDeadline).color }}>{remainingLabel(d.deliveryDeadline).text}</div>\n'
        '                    </>\n'
        '                  ) : "—"}\n'
        '                </td>\n'
    )
    new_deadline = (
        '                <td style={{ ...TD, textAlign: "center" }}>\n'
        '                  {/* ★2026/07/14 部分注文対応: 注文済み明細は納期保証期限をブランク表示にする */}\n'
        '                  {!d.isOrdered && d.deliveryDeadline ? (\n'
        '                    <>\n'
        '                      <div style={{ fontSize: "10px", color: isExpired(d.deliveryDeadline) ? "#ef4444" : "#334155", fontWeight: 600 }}>{fmtDt(d.deliveryDeadline)}</div>\n'
        '                      <div style={{ fontSize: "9px", fontWeight: 700, color: remainingLabel(d.deliveryDeadline).color }}>{remainingLabel(d.deliveryDeadline).text}</div>\n'
        '                    </>\n'
        '                  ) : "—"}\n'
        '                </td>\n'
    )
    text = replace_once(text, old_deadline, new_deadline, "注文済み明細の納期保証期限をブランク表示")

    FILE_CLIENT.write_text(text, encoding="utf-8")
    print(f"[OK] パッチ適用完了: {FILE_CLIENT.relative_to(REPO_ROOT)}")


# ── 6. orders/confirm/page.tsx ──
def patch_confirm_page():
    if already_patched(FILE_CONFIRM):
        print(f"[SKIP] 既に適用済み: {FILE_CONFIRM.relative_to(REPO_ROOT)}")
        return
    text = FILE_CONFIRM.read_text(encoding="utf-8")

    old_sp = '  const estimateId = sp.get("estimateId")\n'
    new_sp = (
        '  const estimateId = sp.get("estimateId")\n'
        '  // ★2026/07/14 部分注文対応: 未指定なら未注文の明細すべてが対象になる\n'
        '  const detailIdsParam = sp.get("detailIds")\n'
    )
    text = replace_once(text, old_sp, new_sp, "confirm/page.tsx: detailIdsパラメータ取得")

    old_post = (
        '      const res = await fetch("/api/v1/orders", {\n'
        '        method: "POST",\n'
        '        headers: { "Content-Type": "application/json" },\n'
        '        body: JSON.stringify({ estimateId }),\n'
        '      })\n'
        '      const data = await res.json()\n'
        '      if (res.status === 409) {\n'
    )
    new_post = (
        '      const res = await fetch("/api/v1/orders", {\n'
        '        method: "POST",\n'
        '        headers: { "Content-Type": "application/json" },\n'
        '        body: JSON.stringify({ estimateId, detailIds: detailIdsParam ? detailIdsParam.split(",") : undefined }),\n'
        '      })\n'
        '      const data = await res.json()\n'
        '      if (res.status === 409) {\n'
    )
    text = replace_once(text, old_post, new_post, "confirm/page.tsx: detailIdsを注文APIへ渡す")

    FILE_CONFIRM.write_text(text, encoding="utf-8")
    print(f"[OK] パッチ適用完了: {FILE_CONFIRM.relative_to(REPO_ROOT)}")


def prisma_and_tsc():
    print("[INFO] npx prisma db push を実行します（新カラム・スキーマ変更をDBへ反映）...")
    r1 = subprocess.run(["npx", "prisma", "db", "push", "--skip-generate"],
                         cwd=str(REPO_ROOT), capture_output=True, text=True)
    print(r1.stdout)
    if r1.returncode != 0:
        print(r1.stderr)
        die("prisma db push に失敗しました。GitHubへのPushは行いません。")

    print("[INFO] npx prisma generate を実行します...")
    r2 = subprocess.run(["npx", "prisma", "generate"], cwd=str(REPO_ROOT),
                         capture_output=True, text=True)
    print(r2.stdout)
    if r2.returncode != 0:
        print(r2.stderr)
        die("prisma generate に失敗しました。")

    print("[INFO] tsc --noEmit --skipLibCheck を実行します...")
    r3 = subprocess.run(["npx", "tsc", "--noEmit", "--skipLibCheck"],
                         cwd=str(REPO_ROOT), capture_output=True, text=True)
    if r3.returncode != 0:
        print("[NG] コンパイルエラーが検出されました。GitHubへのPushは行いません。")
        print(r3.stdout)
        print(r3.stderr)
        sys.exit(1)
    print("[OK] コンパイルエラー0件を確認しました。")


def git_commit_and_push():
    msg = "feat: 部分注文対応（一部明細を先行注文し、残りは後から注文できるようにする）"
    files = [
        "prisma/schema.prisma",
        "src/app/api/v1/orders/route.ts",
        "src/app/api/v1/estimates/[id]/route.ts",
        "src/app/(app)/estimates/[id]/edit/page.tsx",
        "src/app/(app)/estimates/new/EstimateNewClient.tsx",
        "src/app/(app)/orders/confirm/page.tsx",
    ]
    subprocess.run(["git", "add", *files], cwd=str(REPO_ROOT), check=True)
    commit = subprocess.run(["git", "commit", "-m", msg], cwd=str(REPO_ROOT),
                             capture_output=True, text=True)
    print(commit.stdout)
    if commit.returncode != 0:
        print(commit.stderr)
        die("git commit に失敗しました。")
    push = subprocess.run(["git", "push"], cwd=str(REPO_ROOT), capture_output=True, text=True)
    print(push.stdout)
    print(push.stderr)
    if push.returncode != 0:
        die("git push に失敗しました。")
    print("[OK] GitHubへのpushが完了しました。")


def restart_dev_server():
    port = 3050
    log_file = REPO_ROOT / "dev-server.log"
    result = subprocess.run(["lsof", "-t", f"-i:{port}"], capture_output=True, text=True)
    pids = [p for p in result.stdout.strip().split("\n") if p]
    for pid in pids:
        subprocess.run(["kill", "-9", pid])
    if pids:
        time.sleep(1)
    with open(log_file, "w", encoding="utf-8") as log:
        subprocess.Popen(["npm", "run", "dev"], cwd=str(REPO_ROOT),
                          stdout=log, stderr=subprocess.STDOUT,
                          stdin=subprocess.DEVNULL, start_new_session=True)
    print(f"[OK] 開発サーバーを再起動しました（ログ: {log_file}）。")


def main():
    patch_schema()
    patch_orders_route()
    patch_put_route()
    patch_edit_page()
    patch_client()
    patch_confirm_page()
    prisma_and_tsc()
    git_commit_and_push()
    restart_dev_server()
    try:
        Path(__file__).unlink()
        print("[OK] スクリプト自身を削除しました。")
    except Exception as e:
        print(f"[WARN] スクリプト自身の削除に失敗: {e}")


if __name__ == "__main__":
    main()
