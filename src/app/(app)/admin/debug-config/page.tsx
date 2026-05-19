import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import DebugConfigClient from "./DebugConfigClient"

export default async function DebugConfigPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (((session.user as any).role ?? 0) < 5) redirect("/access-denied")
  return <DebugConfigClient />
}
