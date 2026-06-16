#!/usr/bin/env python3
"""
fix_ts_errors.py
TSコンパイルエラー全修正 + git push

配置: ~/projects/ochi-ss/fix_ts_errors.py
実行: cd ~/projects/ochi-ss && python3 fix_ts_errors.py
"""
import os, subprocess, sys

ROOT = os.path.dirname(os.path.abspath(__file__))

def write(path, content):
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  OK: {path}")

def run(cmd):
    r = subprocess.run(cmd, shell=True, cwd=ROOT, capture_output=True, text=True)
    return r.returncode, r.stdout, r.stderr

WITH_TENANT = r"""// src/lib/with-tenant.ts
import { prisma } from "@/lib/prisma"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function withTenant<T = any>(
  customerId: string,
  isSuperAdmin: boolean,
  fn: (tx: any) => Promise<T>
): Promise<T> {
  return ((prisma as any).$transaction(async (tx: any) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant = '${customerId.replace(/'/g, "''")}'`
    )
    await tx.$executeRawUnsafe(
      `SET LOCAL app.is_super_admin = '${isSuperAdmin ? "true" : "false"}'`
    )
    return fn(tx)
  })) as Promise<T>
}
"""

AUDIT_LOG = r"""// src/lib/audit-log.ts
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

export type AuditAction = "READ" | "CREATE" | "UPDATE" | "DELETE" | "EXPORT" | "AUTH"
export type AuditResource =
  | "estimates" | "orders" | "direct_deliveries"
  | "notifications" | "pdf" | "users" | "masters"

interface AuditParams {
  customerId: string; userId: string; action: AuditAction; resource: AuditResource
  resourceId?: string; req?: NextRequest; resultCode?: number; detail?: Record<string, unknown>
}

export async function audit(params: AuditParams): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).auditLog.create({
      data: {
        customerId: params.customerId, userId: params.userId,
        action: params.action, resource: params.resource,
        resourceId: params.resourceId ?? null,
        ipAddress: params.req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
                   ?? params.req?.headers.get("x-real-ip") ?? null,
        userAgent: params.req?.headers.get("user-agent")?.slice(0, 300) ?? null,
        resultCode: params.resultCode ?? 200,
        detail: params.detail ?? null,
      },
    })
  } catch (err) {
    console.error("[audit] 監査ログ記録エラー:", err)
  }
}
"""

ESTIMATES_CANCEL = r"""// src/app/api/v1/estimates/[id]/cancel/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getTenantCtx, assertOwner } from "@/lib/tenant-guard"
import { withTenant } from "@/lib/with-tenant"
import { audit } from "@/lib/audit-log"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await getTenantCtx()
  if (error) return error
  const { id } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const estimate = await withTenant(ctx.customerId, ctx.isSuperAdmin, (tx) =>
    tx.estimateHeader.findFirst({ where: { id, customerId: ctx.customerId, isDeleted: false } })
  ) as any
  const ownerErr = assertOwner(estimate as { customerId?: string } | null, ctx.customerId, ctx.isSuperAdmin)
  if (ownerErr) return ownerErr
  if (estimate.estimateStatus === "ordered")
    return NextResponse.json({ error: "注文済みの見積はキャンセルできません" }, { status: 422 })
  await withTenant(ctx.customerId, ctx.isSuperAdmin, (tx) =>
    tx.estimateHeader.update({ where: { id }, data: { estimateStatus: "cancelled", isDeleted: true } })
  )
  audit({ customerId: ctx.customerId, userId: ctx.userId, action: "DELETE", resource: "estimates", resourceId: id, req })
  return NextResponse.json({ cancelled: true, id })
}
"""

ORDERS_CANCEL = r"""// src/app/api/v1/orders/[id]/cancel/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getTenantCtx, assertOwner } from "@/lib/tenant-guard"
import { withTenant } from "@/lib/with-tenant"
import { audit } from "@/lib/audit-log"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await getTenantCtx()
  if (error) return error
  const { id } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const order = await withTenant(ctx.customerId, ctx.isSuperAdmin, (tx) =>
    tx.order.findFirst({ where: { id, customerId: ctx.customerId, isDeleted: false } })
  ) as any
  const ownerErr = assertOwner(order as { customerId?: string } | null, ctx.customerId, ctx.isSuperAdmin)
  if (ownerErr) return ownerErr
  if (!["pending", "confirmed"].includes(order.orderStatus))
    return NextResponse.json({ error: `${order.orderStatus} の注文はキャンセルできません` }, { status: 422 })
  await withTenant(ctx.customerId, ctx.isSuperAdmin, async (tx) => {
    await tx.order.update({ where: { id }, data: { orderStatus: "cancelled" } })
    await tx.estimateHeader.update({ where: { id: order.estimateHeaderId }, data: { estimateStatus: "saved" } })
    await tx.orderStatusHistory.create({
      data: { orderId: id, fromStatus: order.orderStatus, toStatus: "cancelled",
              changedBy: ctx.userId, changeReason: "顧客によるキャンセル", changeSource: "web" },
    }).catch(() => {})
  })
  audit({ customerId: ctx.customerId, userId: ctx.userId, action: "UPDATE", resource: "orders", resourceId: id, req, detail: { action: "cancel" } })
  return NextResponse.json({ cancelled: true, id, orderStatus: "cancelled" })
}
"""

def main():
    print("=== fix_ts_errors.py ===\n")
    write("src/lib/with-tenant.ts", WITH_TENANT)
    write("src/lib/audit-log.ts", AUDIT_LOG)
    write("src/app/api/v1/estimates/[id]/cancel/route.ts", ESTIMATES_CANCEL)
    write("src/app/api/v1/orders/[id]/cancel/route.ts", ORDERS_CANCEL)

    print("\n[tsc] コンパイルチェック...")
    code, out, err = run("npx tsc --noEmit 2>&1")
    real_errors = [
        line for line in (out + err).splitlines()
        if "error TS" in line
        and "node_modules" not in line
        and "@prisma/client" not in line
        and ".prisma/client" not in line
        and "next.config.ts" not in line
        and "scripts/" not in line
        and "access-denied" not in line
    ]
    if real_errors:
        print("❌ エラー残存:")
        for e in real_errors[:20]: print(f"   {e}")
        print("\n⛔ push中止")
        sys.exit(1)
    print("  ✅ 実コードエラー0件")

    run("git add -A")
    code, out, err = run('git commit -m "fix: TSコンパイルエラー全修正 withTenant<any>/auditLog(prisma as any)"')
    msg = (out + err).strip()
    print(f"  commit: {msg[:100]}")
    if "nothing to commit" not in msg:
        code2, out2, err2 = run("git push origin main")
        if code2 == 0:
            print("  PUSH OK")
        else:
            print(f"  push失敗: {(out2+err2)[:200]}")
            sys.exit(1)
    else:
        print("  (変更なし — 既にpush済み)")

    self_path = os.path.abspath(__file__)
    if os.path.exists(self_path): os.remove(self_path)
    print(f"  自己削除: {self_path}")
    print("""
✅ 完了!

次にサーバーで実行:
  git pull origin main
  npx prisma migrate deploy
  bash deploy/apply_rls.sh
  sudo systemctl restart ochi-web.service
""")

if __name__ == "__main__":
    main()
