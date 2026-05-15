// src/app/api/v1/estimates/calculate/route.ts
// ============================================================
// 見積計算 API
//   POST /api/v1/estimates/calculate
//   → usp_ASP_EstimateAmountCalculation_get を呼び出して
//     単価・合計・納期・有効期限を返す
// ============================================================

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getSqlServerPool, sql } from "@/lib/sqlserver"

// ────────────────────────────────────────────────
// リクエスト型
// ────────────────────────────────────────────────
interface CalculateRequest {
  // 明細識別
  rowId?: number
  estOrderNo?: string
  editMode: "New" | "Edit" | "Copy"

  // 材料
  materialCode: string
  materialName?: string

  // 加工仕様
  kakouShiyouCode: number
  kakouShiyou?: string

  // 加工指示（T/A/B）
  kakouT?: string
  kakouA?: string
  kakouB?: string
  kakouShijiCodeT?: string
  kakouShijiCodeA?: string
  kakouShijiCodeB?: string

  // 寸法 (DECIMAL 7,3)
  sizeT: number
  sizeA: number
  sizeB: number

  // 公差（6値）
  kousaTUpper?: number
  kousaTLower?: number
  kousaAUpper?: number
  kousaALower?: number
  kousaBUpper?: number
  kousaBLower?: number

  // 面取り
  mentoriShiji?: string
  mentori4?: number
  mentori8?: number

  // 数量・希望納期
  quantity: number
  requestNouki?: string

  // 顧客・直送先（セッションから補完するが上書き可）
  endUserNo?: string
  customerNo?: string
  endUserCd?: string
  tyokusousakiCd?: string
  tyokusousakiName?: string
  tyokusousakiYubin?: string
  tyokusousakiAddress?: string
  tyokusousakiTanto?: string
  tyokusousakiTel?: string
  tyokusousakiFax?: string
}

// ────────────────────────────────────────────────
// POST ハンドラ
// ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // ── 認証 ──
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // ── リクエスト解析 ──
  let body: CalculateRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // ── 必須バリデーション ──
  const errors: string[] = []
  if (!body.materialCode) errors.push("materialCode は必須です")
  if (!body.kakouShiyouCode) errors.push("kakouShiyouCode は必須です")
  if (body.sizeT == null || body.sizeT <= 0) errors.push("sizeT は 0 より大きい値が必要です")
  if (body.sizeA == null || body.sizeA <= 0) errors.push("sizeA は 0 より大きい値が必要です")
  if (body.sizeB == null || body.sizeB <= 0) errors.push("sizeB は 0 より大きい値が必要です")
  if (!body.quantity || body.quantity < 1) errors.push("quantity は 1 以上が必要です")
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(", ") }, { status: 400 })
  }

  // ── SQL Server 接続 ──
  let pool: Awaited<ReturnType<typeof getSqlServerPool>>
  try {
    pool = await getSqlServerPool()
  } catch (err: any) {
    console.error("[calculate] SQL Server 接続エラー:", err)
    return NextResponse.json({ error: "データベース接続に失敗しました" }, { status: 503 })
  }

  // ── SP 呼び出し ──
  try {
    const request = pool.request()
    // mssql の Request には timeout プロパティがないため
    // pool 生成時の requestTimeout (120000ms) が適用される
    // （sqlserver.ts の parseConnectionString で設定済み）

    // セッション情報
    const sessionId = session.user.userId ?? ""
    const tokuisakiCd = session.user.companyCode ?? ""

    // ── 入力パラメータ設定 ──
    request.input("SessionID",          sql.NVarChar(50),     sessionId)
    request.input("RowID",              sql.Int,              body.rowId ?? 0)
    request.input("WOEstimateNo",       sql.NVarChar(20),     body.estOrderNo ?? "")
    request.input("ZairyouCd",          sql.NVarChar(4),      body.materialCode)
    request.input("ZairyouName",        sql.NVarChar(100),    body.materialName ?? "")
    request.input("KakouShiyouCd",      sql.Int,              body.kakouShiyouCode)
    request.input("KakouShiyou",        sql.NVarChar(50),     body.kakouShiyou ?? "")
    request.input("Kakou_T",            sql.NVarChar(20),     body.kakouT ?? "")
    request.input("Kakou_A",            sql.NVarChar(20),     body.kakouA ?? "")
    request.input("Kakou_B",            sql.NVarChar(20),     body.kakouB ?? "")
    request.input("KakouShijiCd_T",     sql.NVarChar(10),     body.kakouShijiCodeT ?? "")
    request.input("KakouShijiCd_A",     sql.NVarChar(10),     body.kakouShijiCodeA ?? "")
    request.input("KakouShijiCd_B",     sql.NVarChar(10),     body.kakouShijiCodeB ?? "")
    request.input("Size_T",             sql.Decimal(7, 3),    body.sizeT)
    request.input("Size_A",             sql.Decimal(7, 3),    body.sizeA)
    request.input("Size_B",             sql.Decimal(7, 3),    body.sizeB)
    request.input("Kousa_T_U",          sql.Decimal(6, 3),    body.kousaTUpper ?? null)
    request.input("Kousa_T_L",          sql.Decimal(6, 3),    body.kousaTLower ?? null)
    request.input("Kousa_A_U",          sql.Decimal(6, 3),    body.kousaAUpper ?? null)
    request.input("Kousa_A_L",          sql.Decimal(6, 3),    body.kousaALower ?? null)
    request.input("Kousa_B_U",          sql.Decimal(6, 3),    body.kousaBUpper ?? null)
    request.input("Kousa_B_L",          sql.Decimal(6, 3),    body.kousaBLower ?? null)
    request.input("MentoriShiji",       sql.NVarChar(10),     body.mentoriShiji ?? "")
    request.input("Mentori_4",          sql.Decimal(5, 2),    body.mentori4 ?? null)
    request.input("Mentori_8",          sql.Decimal(5, 2),    body.mentori8 ?? null)
    request.input("Suryou",             sql.Int,              body.quantity)
    request.input("RequestNouki",       sql.NVarChar(10),     body.requestNouki ?? "")
    request.input("CustomerNo",         sql.NVarChar(10),     body.customerNo ?? "")
    request.input("EndUserNo",          sql.NVarChar(10),     body.endUserNo ?? "")
    request.input("Refer",              sql.NVarChar(10),     "")
    request.input("TokuisakiCd",        sql.NVarChar(6),      tokuisakiCd)
    request.input("EndUserCd",          sql.NVarChar(6),      body.endUserCd ?? "")
    request.input("TyokusousakiCd",     sql.NVarChar(20),     body.tyokusousakiCd ?? "")
    request.input("TyokusousakiName",   sql.NVarChar(100),    body.tyokusousakiName ?? "")
    request.input("TyokusousakiYubin",  sql.NVarChar(10),     body.tyokusousakiYubin ?? "")
    request.input("TyokusousakiAdd",    sql.NVarChar(130),    body.tyokusousakiAddress ?? "")
    request.input("TyokusousakiTanto",  sql.NVarChar(50),     body.tyokusousakiTanto ?? "")
    request.input("TyokusousakiTel",    sql.NVarChar(20),     body.tyokusousakiTel ?? "")
    request.input("TyokusousakiFax",    sql.NVarChar(20),     body.tyokusousakiFax ?? "")
    request.input("EditMode",           sql.NVarChar(10),     body.editMode)

    // ── 出力パラメータ設定 ──
    request.output("ShortestNouki",       sql.NVarChar(10))
    request.output("UnitPrice",           sql.Money)
    request.output("SumPrice",            sql.Money)
    request.output("DeliveryDeadline",    sql.DateTime2)
    request.output("ZairyouSizeT_OUT",    sql.Decimal(7, 3))
    request.output("ZairyouSizeA_OUT",    sql.Decimal(7, 3))
    request.output("ZairyouSizeB_OUT",    sql.Decimal(7, 3))
    request.output("ZairyouUWeight_OUT",  sql.Decimal(10, 4))
    request.output("ZairyouWeight_OUT",   sql.Decimal(10, 4))
    request.output("ProductUWeight_OUT",  sql.Decimal(10, 4))
    request.output("ProductWeight_OUT",   sql.Decimal(10, 4))
    request.output("6FKakouPrice_OUT",    sql.Money)
    request.output("KakouPriceSummary_OUT", sql.Money)

    // ── SP 実行 ──
    const result = await request.execute("usp_ASP_EstimateAmountCalculation_get")

    const out = result.output
    const unitPrice: number   = Number(out["UnitPrice"]  ?? 0)
    const sumPrice: number    = Number(out["SumPrice"]   ?? 0)
    const shortestNouki: string = out["ShortestNouki"] ?? ""
    const deliveryDeadline    = out["DeliveryDeadline"]  // Date | null

    // ── 結果検証 ──
    if (unitPrice <= 0 || !shortestNouki) {
      console.warn("[calculate] SP実行結果が不正:", out)
      return NextResponse.json(
        { error: "計算結果が不正です。材料コード・加工仕様・寸法を確認してください。" },
        { status: 422 }
      )
    }

    // ── レスポンス ──
    return NextResponse.json({
      success: true,
      unitPrice,
      sumPrice,
      shortestDelivery: shortestNouki,
      deliveryDeadline: deliveryDeadline
        ? (deliveryDeadline as Date).toISOString().slice(0, 10)
        : null,
      // 計算中間値（UI表示・デバッグ用）
      intermediate: {
        materialSizeT:       Number(out["ZairyouSizeT_OUT"]     ?? 0),
        materialSizeA:       Number(out["ZairyouSizeA_OUT"]     ?? 0),
        materialSizeB:       Number(out["ZairyouSizeB_OUT"]     ?? 0),
        materialUnitWeight:  Number(out["ZairyouUWeight_OUT"]   ?? 0),
        materialTotalWeight: Number(out["ZairyouWeight_OUT"]    ?? 0),
        productUnitWeight:   Number(out["ProductUWeight_OUT"]   ?? 0),
        productTotalWeight:  Number(out["ProductWeight_OUT"]    ?? 0),
        processingCost6f:    Number(out["6FKakouPrice_OUT"]     ?? 0),
        processingCostTotal: Number(out["KakouPriceSummary_OUT"] ?? 0),
      },
    })
  } catch (err: any) {
    // タイムアウト
    if (err.code === "ETIMEOUT" || err.message?.includes("timeout")) {
      console.error("[calculate] SP タイムアウト:", err)
      return NextResponse.json(
        { error: "計算処理がタイムアウトしました（120秒）" },
        { status: 504 }
      )
    }
    console.error("[calculate] SP 実行エラー:", err)
    return NextResponse.json(
      { error: "計算処理中にエラーが発生しました", detail: err.message },
      { status: 500 }
    )
  }
}