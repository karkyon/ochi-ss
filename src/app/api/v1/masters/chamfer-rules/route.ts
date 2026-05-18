// src/app/api/v1/masters/chamfer-rules/route.ts
// Admin専用: 面取りルール一覧取得 / 新規登録
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

function isAdmin(session: any) {
  const level = session?.user?.roleLevel ?? 0
  return level >= 3
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = req.nextUrl
  const materialCode = searchParams.get("materialCode") ?? undefined
  const specCode     = searchParams.get("specCode") ?? undefined

  const rows = await prisma.chamferRule.findMany({
    where: {
      isDeleted: false,
      ...(materialCode ? { materialCode } : {}),
      ...(specCode     ? { processingSpecCode: parseInt(specCode) } : {}),
    },
    orderBy: [{ materialCode: "asc" }, { processingSpecCode: "asc" }],
  })
  return NextResponse.json({ total: rows.length, rules: rows })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const { materialCode, processingSpecCode, sizeAFrom, sizeATo, sizeBFrom, sizeBTo,
          limitChamfer4, limitChamfer8, maxChamfer4, maxChamfer8, priority } = body

  if (!materialCode || !processingSpecCode) {
    return NextResponse.json({ error: "materialCode, processingSpecCode は必須" }, { status: 400 })
  }

  const rule = await prisma.chamferRule.create({
    data: {
      materialCode,
      processingSpecCode: Number(processingSpecCode),
      sizeAFrom: sizeAFrom != null ? Number(sizeAFrom) : null,
      sizeATo:   sizeATo   != null ? Number(sizeATo)   : null,
      sizeBFrom: sizeBFrom != null ? Number(sizeBFrom) : null,
      sizeBTo:   sizeBTo   != null ? Number(sizeBTo)   : null,
      limitChamfer4: limitChamfer4 != null ? Number(limitChamfer4) : null,
      limitChamfer8: limitChamfer8 != null ? Number(limitChamfer8) : null,
      maxChamfer4:   maxChamfer4   != null ? Number(maxChamfer4)   : null,
      maxChamfer8:   maxChamfer8   != null ? Number(maxChamfer8)   : null,
      priority: priority != null ? Number(priority) : 0,
    }
  })
  return NextResponse.json(rule, { status: 201 })
}
