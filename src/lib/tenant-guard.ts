// src/lib/tenant-guard.ts
// 共通テナントガード — 全APIルートで使用
import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export interface TenantContext {
  customerId: string
  userId: string
  userName: string
  role: number
  isSuperAdmin: boolean
  companyCode: string
}

/**
 * セッション検証 + テナントコンテキスト取得
 * 未認証の場合は error に 401 Response を返す
 */
export async function getTenantCtx(): Promise<
  { ctx: TenantContext; error: null } | { ctx: null; error: NextResponse }
> {
  const session = await auth()
  if (!session?.user?.customerId) {
    return { ctx: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  return {
    ctx: {
      customerId:   session.user.customerId,
      userId:       session.user.id ?? "",
      userName:     session.user.userName ?? "",
      role:         session.user.role ?? 1,
      isSuperAdmin: (session.user.role ?? 1) >= 4,
      companyCode:  session.user.companyCode ?? "",
    },
    error: null,
  }
}

/**
 * 取得レコードの所有テナント確認 (2重チェック)
 * RLSで防がれているはずだが念のため
 */
export function assertOwner(
  record: { customerId?: string } | null | undefined,
  customerId: string,
  isSuperAdmin = false
): NextResponse | null {
  if (!record) return NextResponse.json({ error: "Not Found" }, { status: 404 })
  if (!isSuperAdmin && record.customerId && record.customerId !== customerId) {
    console.error(`[SECURITY] テナント不一致 record:${record.customerId} session:${customerId}`)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}
