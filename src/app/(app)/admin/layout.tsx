import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import AdminShell from "./AdminShell"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")
  const role = (session.user as any).role ?? 0
  if (role < 3) redirect("/dashboard")

  const userName = (session.user as any).chargeName ?? (session.user as any).userName ?? ""
  const companyName = (session.user as any).customerName ?? (session.user as any).companyName ?? ""

  return (
    <AdminShell userName={userName} companyName={companyName}>
      {children}
    </AdminShell>
  )
}
