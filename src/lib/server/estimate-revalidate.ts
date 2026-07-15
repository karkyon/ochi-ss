// src/lib/server/estimate-revalidate.ts
// ============================================================
// 見積保存時のサーバー側金額再検証
//
// 背景（ochi-ss_システム分析レポート.md 優先対応1）:
//   POST/PUT /api/v1/estimates は unitPrice/totalPrice をクライアント送信値
//   そのままPrisma.Decimal化して保存しており、ブラウザの開発者ツールや
//   API直叩きで金額を書き換えて保存できてしまう欠陥があった。
//
// 対応方針:
//   保存直前に明細1件ずつ usp_ASP_EstimateAmountCalculation_get を
//   サーバー側で再実行し、その結果を正として保存する。
//   クライアントが送ってきた unitPrice/totalPrice は「表示用の参考値」
//   として扱い、DBに書き込む値は必ずこの再計算結果で上書きする。
//   SP側で有効な単価が得られない場合（材料・寸法の組合せがマスタに
//   存在しない等）は、その明細を含む保存自体を拒否する。
//
//   既に受注済み(orderId確定済み)の明細は対象外（呼び出し側でフィルタ
//   してから渡すこと）。
// ============================================================

import { getSqlServerPool } from "@/lib/sqlserver"
import { runEstimateCalculation } from "./estimate-calc-engine"

export interface RevalidateDetailInput {
  rowNo: number
  materialCode: string
  materialName?: string | null
  kakouShiyouCode: number
  kakouShiyou?: string | null
  kakouShijiCodeT?: string | null
  kakouShijiCodeA?: string | null
  kakouShijiCodeB?: string | null
  sizeT: number
  sizeA: number
  sizeB: number
  kousaTUpper?: number | null
  kousaTLower?: number | null
  kousaAUpper?: number | null
  kousaALower?: number | null
  kousaBUpper?: number | null
  kousaBLower?: number | null
  mentoriShiji?: string | null
  mentori4?: number | null
  mentori8?: number | null
  quantity: number
  unitPrice: number
  totalPrice: number
  requestNouki?: string | null
  endUserNo?: string | null
  customerNo?: string | null
  endUserCd?: string | null
  tyokusousakiCd?: string | null
  tyokusousakiName?: string | null
  tyokusousakiYubin?: string | null
  tyokusousakiAddress?: string | null
  tyokusousakiPost?: string | null
  tyokusousakiCharge?: string | null
}

export interface RevalidatedDetail {
  rowNo: number
  ok: boolean
  reason?: string
  verifiedUnitPrice?: number
  verifiedTotalPrice?: number
  verifiedShortestDelivery?: string
  verifiedDeliveryDeadline?: Date | null
}

export interface RevalidateOutcome {
  hasError: boolean
  results: RevalidatedDetail[]
  // rowNo をキーにした参照用マップ（保存処理側での上書きに使う）
  byRowNo: Map<number, RevalidatedDetail>
}

// 金額比較時の許容誤差（円）。SP側の丸め誤差を吸収するためのログ用しきい値であり、
// 保存を拒否するかどうかの判定には使わない（常にサーバー再計算値を正として上書きする）。
const PRICE_DIFF_LOG_TOLERANCE = 1

export async function revalidateEstimateDetails(
  details: RevalidateDetailInput[],
  session: { sessionId: string; tokuisakiCd: string }
): Promise<RevalidateOutcome> {
  const byRowNo = new Map<number, RevalidatedDetail>()

  if (details.length === 0) {
    return { hasError: false, results: [], byRowNo }
  }

  let pool: Awaited<ReturnType<typeof getSqlServerPool>>
  try {
    pool = await getSqlServerPool()
  } catch (err: any) {
    console.error("[estimate-revalidate] SQL Server 接続エラー:", err?.message ?? err)
    const results = details.map((d) => ({
      rowNo: d.rowNo,
      ok: false,
      reason: `明細${d.rowNo}行目: サーバー側金額再検証のためのDB接続に失敗しました。時間をおいて再度お試しください。`,
    }))
    for (const r of results) byRowNo.set(r.rowNo, r)
    return { hasError: true, results, byRowNo }
  }

  const results: RevalidatedDetail[] = []

  for (const d of details) {
    try {
      const calc = await runEstimateCalculation(
        pool,
        {
          // ★バグ修正: editModeは意図的に渡さない(NULL)。
          // 見積計算API(calculate/route.ts)の実績ある呼び出しと同じ経路にする。
          materialCode: d.materialCode,
          materialName: d.materialName ?? undefined,
          kakouShiyouCode: d.kakouShiyouCode,
          kakouShiyou: d.kakouShiyou ?? undefined,
          kakouShijiCodeT: d.kakouShijiCodeT ?? undefined,
          kakouShijiCodeA: d.kakouShijiCodeA ?? undefined,
          kakouShijiCodeB: d.kakouShijiCodeB ?? undefined,
          sizeT: d.sizeT,
          sizeA: d.sizeA,
          sizeB: d.sizeB,
          kousaTUpper: d.kousaTUpper ?? undefined,
          kousaTLower: d.kousaTLower ?? undefined,
          kousaAUpper: d.kousaAUpper ?? undefined,
          kousaALower: d.kousaALower ?? undefined,
          kousaBUpper: d.kousaBUpper ?? undefined,
          kousaBLower: d.kousaBLower ?? undefined,
          mentoriShiji: d.mentoriShiji ?? undefined,
          mentori4: d.mentori4 ?? undefined,
          mentori8: d.mentori8 ?? undefined,
          quantity: d.quantity,
          requestNouki: d.requestNouki ?? undefined,
          endUserNo: d.endUserNo ?? undefined,
          customerNo: d.customerNo ?? undefined,
          endUserCd: d.endUserCd ?? undefined,
          tyokusousakiCd: d.tyokusousakiCd ?? undefined,
          tyokusousakiName: d.tyokusousakiName ?? undefined,
          tyokusousakiYubin: d.tyokusousakiYubin ?? undefined,
          tyokusousakiAddress: d.tyokusousakiAddress ?? undefined,
          tyokusousakiPost: d.tyokusousakiPost ?? undefined,
          tyokusousakiCharge: d.tyokusousakiCharge ?? undefined,
        },
        session
      )

      if (calc.unitPrice <= 0) {
        results.push({
          rowNo: d.rowNo,
          ok: false,
          reason: `明細${d.rowNo}行目: サーバー側再計算で有効な単価が取得できませんでした。材料・加工仕様・寸法の組合せをご確認のうえ、画面で再計算してから保存してください。`,
        })
        continue
      }

      const verifiedTotal = calc.sumPrice
      if (Math.abs(verifiedTotal - d.totalPrice) > PRICE_DIFF_LOG_TOLERANCE) {
        // 保存自体は継続する（サーバー再計算値で上書きするため）が、
        // クライアント値との乖離は改ざん検知・不具合調査のため監査ログに残す。
        console.warn("[estimate-revalidate] クライアント送信値とサーバー再計算値が不一致", {
          rowNo: d.rowNo,
          clientUnitPrice: d.unitPrice,
          clientTotalPrice: d.totalPrice,
          serverUnitPrice: calc.unitPrice,
          serverTotalPrice: verifiedTotal,
        })
      }

      results.push({
        rowNo: d.rowNo,
        ok: true,
        verifiedUnitPrice: calc.unitPrice,
        verifiedTotalPrice: verifiedTotal,
        verifiedShortestDelivery: calc.shortestNouki,
        verifiedDeliveryDeadline: calc.deliveryDeadline,
      })
    } catch (err: any) {
      const detailMsg = err?.message || err?.originalError?.message || err?.originalError?.info?.message || String(err)
      console.error(`[estimate-revalidate] 明細${d.rowNo}行目 再計算エラー:`, detailMsg, err)
      results.push({
        rowNo: d.rowNo,
        ok: false,
        reason: `明細${d.rowNo}行目: サーバー側金額再検証中にエラーが発生しました。(詳細: ${detailMsg})`,
      })
    }
  }

  for (const r of results) byRowNo.set(r.rowNo, r)
  return { hasError: results.some((r) => !r.ok), results, byRowNo }
}
