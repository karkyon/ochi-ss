import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { SessionProvider } from "next-auth/react"
import Header from "@/components/layout/Header"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect("/login")

  // 未読お知らせ件数（ヘッダーバッジ用）
  let notificationCount = 0
  try {
    const session2 = await auth()
    const customerId = session2?.user?.customerId
    const now = new Date()
    const allNotifs = await prisma.notification.findMany({
      where: {
        isDeleted: false,
        publishedAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
      },
      select: { id: true },
    })
    if (customerId && allNotifs.length > 0) {
      try {
        const reads = await (prisma as any).notificationRead.findMany({
          where: { customerId, notificationId: { in: allNotifs.map((n: any) => n.id) } },
          select: { notificationId: true },
        })
        notificationCount = allNotifs.length - reads.length
      } catch {
        notificationCount = allNotifs.length
      }
    } else {
      notificationCount = allNotifs.length
    }
  } catch { /* silent */ }

  return (
    <SessionProvider session={session}>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header notificationCount={notificationCount} />
        <main className="flex-1">
          {children}
        </main>
      </div>
    </SessionProvider>
  )
}
