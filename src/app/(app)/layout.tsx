import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { SessionProvider } from "next-auth/react"
import Header from "@/components/layout/Header"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  return (
    <SessionProvider session={session}>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <main className="flex-1">
          {children}
        </main>
      </div>
    </SessionProvider>
  )
}
