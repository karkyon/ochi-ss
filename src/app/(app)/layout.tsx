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
    const now = new Date()
    notificationCount = await prisma.notification.count({
      where: {
        isDeleted: false,
        publishedAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
      },
    })
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
