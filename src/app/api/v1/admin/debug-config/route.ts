// /api/v1/admin/debug-config — SystemAdmin専用デバッグ設定
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

function isSystemAdmin(session: any) {
  return (session?.user?.role ?? 0) >= 5
}

const DEFAULT_CONFIG = {
  debugMode: false,
  showEstimateCalcParams: false,
  showIntermediateValues: false,
  showSpSql: false,
  showRawApiResponse: false,
  logLevel: "INFO",
  spTimeoutSec: 120,
  pollingIntervalSec: 30,
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isSystemAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const setting = await (prisma as any).systemSetting.findFirst({
      where: { key: "debug_config" },
    })
    const config = setting ? JSON.parse(setting.value) : DEFAULT_CONFIG
    return NextResponse.json({ config })
  } catch {
    return NextResponse.json({ config: DEFAULT_CONFIG })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isSystemAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  try {
    await (prisma as any).systemSetting.upsert({
      where: { key: "debug_config" },
      create: { key: "debug_config", value: JSON.stringify(body) },
      update: { value: JSON.stringify(body) },
    })
    return NextResponse.json({ saved: true, config: body })
  } catch {
    return NextResponse.json({ saved: false, config: body })
  }
}
