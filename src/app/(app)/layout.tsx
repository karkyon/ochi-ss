import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import OchiHeader from "@/components/ui/OchiHeader"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")
  const userName    = (session.user as any).userName    ?? ""
  const companyName = (session.user as any).companyName ?? ""
  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>
      <OchiHeader userName={userName} companyName={companyName} />
      <div>{children}</div>
    </div>
  )
}
