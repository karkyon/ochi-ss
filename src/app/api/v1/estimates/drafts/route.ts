// src/app/api/v1/estimates/drafts/route.ts
// GET /api/v1/estimates/drafts — 自分の有効期限内 Draft 一覧
//
// レスポンス 200:
//   { drafts: [ { estimateId, destinationName, detailCount, draftSavedAt, draftExpiresAt } ] }
//
// ルール:
//  - isDraftOnly = true かつ draftExpiresAt > now のみ
//  - customerId = session.user.customerId のみ（他ユーザーは混入しない）
//  - 最大5件（降順）

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const now = new Date()

  const drafts = await prisma.estimateHeader.findMany({
    where: {
      customerId:    session.user.customerId!,
      estimateStatus: "draft",
      isDraftOnly:   true,
      isDeleted:     false,
      draftExpiresAt: { gt: now },
    },
    orderBy: { draftSavedAt: "desc" },
    take: 5,
    select: {
      id:              true,
      destinationName: true,
      draftSavedAt:    true,
      draftExpiresAt:  true,
      details: {
        where: { isDeleted: false },
        select: { id: true },
      },
    },
  })

  return NextResponse.json({
    drafts: drafts.map((d) => ({
      estimateId:    d.id,
      destinationName: d.destinationName ?? null,
      detailCount:   d.details.length,
      draftSavedAt:  d.draftSavedAt?.toISOString() ?? null,
      draftExpiresAt: d.draftExpiresAt?.toISOString() ?? null,
    })),
  })
}
