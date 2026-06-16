// src/lib/with-tenant.ts
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
