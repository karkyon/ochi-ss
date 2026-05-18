// src/app/(app)/masters/chamfer-rules/page.tsx
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import ChamferRulesClient from "./ChamferRulesClient"

export default async function ChamferRulesPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const roleLevel = (session.user as any).role ?? 0
  if (roleLevel < 3) redirect("/access-denied")
  return <ChamferRulesClient />
}
