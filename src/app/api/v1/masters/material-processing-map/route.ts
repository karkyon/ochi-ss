// src/app/api/v1/masters/material-processing-map/route.ts
// GET /api/v1/masters/material-processing-map
// 材料コード → 利用可能な加工仕様コード一覧を返す
//
// レスポンス例:
//   {
//     "map": {
//       "SUS304": [1, 2, 3],
//       "SPCC":   [1, 4, 5],
//       ...
//     }
//   }
//
// 実装方針:
//   - まず ChamferRule テーブル（material_code × processing_spec_code）から
//     既存の対応関係を取得する
//   - ChamferRule がない場合は全 ProcessingSpec を返す（全材料対応）
//   - フォールバック: ChamferRule が0件なら全 processingSpec を全 material に対応させる

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    // ChamferRule から材料×加工仕様の対応を取得
    const chamferRules = await prisma.chamferRule.findMany({
      select: {
        materialCode:       true,
        processingSpecCode: true,
      },
      distinct: ["materialCode", "processingSpecCode"],
    })

    // 全加工仕様
    const allSpecs = await prisma.processingSpec.findMany({
      orderBy: { processingSpecCode: "asc" },
      select: { processingSpecCode: true },
    })
    const allSpecCodes = allSpecs.map(s => s.processingSpecCode)

    const map: Record<string, number[]> = {}

    if (chamferRules.length > 0) {
      // ChamferRule がある → 材料ごとにフィルタ
      for (const rule of chamferRules) {
        if (!map[rule.materialCode]) {
          map[rule.materialCode] = []
        }
        if (!map[rule.materialCode].includes(rule.processingSpecCode)) {
          map[rule.materialCode].push(rule.processingSpecCode)
        }
      }
      // ChamferRule に登録されていない材料は全加工仕様を返す
      // （フォールバック: 全材料を取得して map に追加）
      const allMaterials = await prisma.material.findMany({
        select: { materialCode: true },
      })
      for (const mat of allMaterials) {
        if (!map[mat.materialCode]) {
          map[mat.materialCode] = allSpecCodes
        }
      }
    } else {
      // ChamferRule が0件 → 全材料に全加工仕様を返す
      const allMaterials = await prisma.material.findMany({
        select: { materialCode: true },
      })
      for (const mat of allMaterials) {
        map[mat.materialCode] = allSpecCodes
      }
    }

    return NextResponse.json({ map })
  } catch (e: any) {
    console.error("[material-processing-map] エラー:", e)
    return NextResponse.json({ error: "Internal Server Error", detail: e.message }, { status: 500 })
  }
}
