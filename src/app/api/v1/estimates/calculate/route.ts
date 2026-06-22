// src/app/api/v1/estimates/calculate/route.ts
// ============================================================
// 見積計算 API
//   POST /api/v1/estimates/calculate
//   → usp_ASP_EstimateAmountCalculation_get を呼び出して
//     単価・合計・納期・有効期限を返す
//
// SP実定義（SSMSで確認済み）の主な変更点:
//   - @Size_T/A/B は DECIMAL(8,3)（旧コードは7,3）
//   - @Kousa の順序: T_U, A_U, B_U, T_L, A_L, B_L
//   - @TyokusousakiAddr（旧コードの TyokusousakiAddress）
//   - @TyokusousakiPost（旧コードにない → 追加）
//   - @TyokusousakiCharge（旧コードにない → 追加）
//   - @TyokusousakiFax → SPに存在しないので削除
//   - @RequestPrice（省略可 MONEY = 0）→ 追加
//   - OUTPUT: @ColNo_OUT/@RowNo_OUT/@Exists_OUT/@OutOfRange_OUT 等多数追加
// ============================================================

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getSqlServerPool, sql } from "@/lib/sqlserver"

interface CalculateRequest {
  rowId?: number
  estOrderNo?: string
  editMode: "New" | "Edit" | "Copy"
  materialCode: string
  materialName?: string
  kakouShiyouCode: number
  kakouShiyou?: string
  kakouT?: string
  kakouA?: string
  kakouB?: string
  kakouShijiCodeT?: string
  kakouShijiCodeA?: string
  kakouShijiCodeB?: string
  sizeT: number
  sizeA: number
  sizeB: number
  kousaTUpper?: number
  kousaTLower?: number
  kousaAUpper?: number
  kousaALower?: number
  kousaBUpper?: number
  kousaBLower?: number
  mentoriShiji?: string
  mentori4?: number
  mentori8?: number
  quantity: number
  requestNouki?: string
  endUserNo?: string
  customerNo?: string
  endUserCd?: string
  tyokusousakiCd?: string
  tyokusousakiName?: string
  tyokusousakiYubin?: string
  tyokusousakiAddress?: string
  tyokusousakiPost?: string
  tyokusousakiCharge?: string
}

// ── 加工指示コード 文字列→整数 逆引き ──
// src/app/api/v1/masters/processing-specs/route.ts の codeToStr() と対になる変換。
// SQL Server「WO加工仕様」テーブルの加工指示コードT/A/B(int)を、表示用に
// codeToStr()で "RG"/"W"/"〜"/"SG" に変換した結果がフロントに渡っているため、
// SP実行前にその逆変換で整数に戻す必要がある。
// 確定根拠: SP実行時の実エラー
//   "Conversion failed when converting the varchar value 'W' to data type int."
//   (procName: usp_ASP_EstimateAmountCalculation_get, lineNumber: 533)
// により、@Kakou_T/A/B, @KakouShijiCd_T/A/B は INT 系であることが判明した。
function strToKakouCode(s: string | undefined | null): number | null {
  switch (s) {
    case "RG": return 1
    case "W":  return 2
    case "〜": return 4
    case "SG": return 5
    default:   return null
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: CalculateRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  // ── REQ全内容をサーバーログに出力（デバッグ用）──
  console.log("========== [calculate] REQUEST受信 ==========")
  console.log("[calculate] URL:", req.url)
  console.log("[calculate] body全内容:", JSON.stringify(body, null, 2))
  console.log("===============================================")

  const errors: string[] = []
  if (!body.materialCode)    errors.push("materialCode は必須です")
  if (!body.kakouShiyouCode) errors.push("kakouShiyouCode は必須です")
  if (!body.sizeT || body.sizeT <= 0) errors.push("sizeT は 0 より大きい値が必要です")
  if (!body.sizeA || body.sizeA <= 0) errors.push("sizeA は 0 より大きい値が必要です")
  if (!body.sizeB || body.sizeB <= 0) errors.push("sizeB は 0 より大きい値が必要です")
  if (!body.quantity || body.quantity < 1) errors.push("quantity は 1 以上が必要です")
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(", ") }, { status: 400 })
  }

  let pool: Awaited<ReturnType<typeof getSqlServerPool>>
  try {
    pool = await getSqlServerPool()
  } catch (err: any) {
    console.error("[calculate] SQL Server 接続エラー:", err)
    return NextResponse.json({ error: "データベース接続に失敗しました" }, { status: 503 })
  }

  try {
    const request = pool.request()

    const sessionId    = session.user.userId ?? ""
    const tokuisakiCd  = session.user.companyCode ?? ""

    // ── 入力パラメータ（SP定義順に合わせる）──
    request.input("SessionID",           sql.VarChar(30),      sessionId)
    request.input("RowID",               sql.Int,              body.rowId ?? 0)
    request.input("WOEstimateNo",        sql.VarChar(20),      body.estOrderNo ?? "")
    request.input("ZairyouCd",           sql.VarChar(4),       body.materialCode)
    request.input("ZairyouName",         sql.VarChar(20),      body.materialName ?? "")
    request.input("KakouShiyouCd",       sql.SmallInt,         body.kakouShiyouCode)
    request.input("KakouShiyou",         sql.VarChar(10),      body.kakouShiyou ?? "")
    // SP実エラーで確定: @Kakou_T/A/B, @KakouShijiCd_T/A/B は INT 系。
    // フロントは "W"/"RG"/"SG"/"〜" の表示用文字列を保持しているため、
    // strToKakouCode() で元の整数コード(1/2/4/5)に逆変換してから渡す。
    const kakouTCode = strToKakouCode(body.kakouShijiCodeT)
    const kakouACode = strToKakouCode(body.kakouShijiCodeA)
    const kakouBCode = strToKakouCode(body.kakouShijiCodeB)
    console.log("[calculate] 加工指示コード逆変換:", {
      T: { from: body.kakouShijiCodeT, to: kakouTCode },
      A: { from: body.kakouShijiCodeA, to: kakouACode },
      B: { from: body.kakouShijiCodeB, to: kakouBCode },
    })
    request.input("Kakou_T",             sql.Int,             kakouTCode)
    request.input("Kakou_A",             sql.Int,             kakouACode)
    request.input("Kakou_B",             sql.Int,             kakouBCode)
    request.input("KakouShijiCd_T",      sql.Int,             kakouTCode)
    request.input("KakouShijiCd_A",      sql.Int,             kakouACode)
    request.input("KakouShijiCd_B",      sql.Int,             kakouBCode)
    // SP定義: DECIMAL(8,3)
    request.input("Size_T",              sql.Decimal(8, 3),    body.sizeT)
    request.input("Size_A",              sql.Decimal(8, 3),    body.sizeA)
    request.input("Size_B",              sql.Decimal(8, 3),    body.sizeB)
    // SP定義の公差順: T_U, A_U, B_U, T_L, A_L, B_L
    request.input("Kousa_T_U",           sql.Decimal(8, 3),    body.kousaTUpper ?? 0)
    request.input("Kousa_A_U",           sql.Decimal(8, 3),    body.kousaAUpper ?? 0)
    request.input("Kousa_B_U",           sql.Decimal(8, 3),    body.kousaBUpper ?? 0)
    request.input("Kousa_T_L",           sql.Decimal(8, 3),    body.kousaTLower ?? 0)
    request.input("Kousa_A_L",           sql.Decimal(8, 3),    body.kousaALower ?? 0)
    request.input("Kousa_B_L",           sql.Decimal(8, 3),    body.kousaBLower ?? 0)
    request.input("MentoriShiji",        sql.VarChar(10),      body.mentoriShiji ?? "")
    request.input("Mentori_4",           sql.Decimal(8, 3),    body.mentori4 ?? 0)
    request.input("Mentori_8",           sql.Decimal(8, 3),    body.mentori8 ?? 0)
    request.input("Suryou",              sql.Int,              body.quantity)
    request.input("RequestPrice",        sql.Money,            0)           // SP: MONEY = 0
    request.input("RequestNouki",        sql.VarChar(10),      body.requestNouki ?? "")
    request.input("CustomerNo",          sql.VarChar(100),     body.customerNo ?? "")
    request.input("EndUserNo",           sql.VarChar(100),     body.endUserNo ?? "")
    request.input("Refer",               sql.VarChar(255),     "")
    request.input("TokuisakiCd",         sql.VarChar(6),       tokuisakiCd)
    request.input("EndUserCd",           sql.VarChar(6),       body.endUserCd ?? "")
    request.input("TyokusousakiCd",      sql.VarChar(6),       body.tyokusousakiCd ?? "")
    request.input("TyokusousakiName",    sql.VarChar(80),      body.tyokusousakiName ?? "")
    request.input("TyokusousakiZipCd",   sql.VarChar(10),      body.tyokusousakiYubin ?? "")
    request.input("TyokusousakiAddr",    sql.VarChar(255),     body.tyokusousakiAddress ?? "")
    // SP定義に存在するが旧コードに欠落していたパラメータ
    request.input("TyokusousakiPost",    sql.VarChar(50),      body.tyokusousakiPost ?? "")
    request.input("TyokusousakiCharge",  sql.VarChar(20),      body.tyokusousakiCharge ?? "")
    request.input("EditMode",            sql.VarChar(10),      body.editMode)

    // ── 出力パラメータ（SP定義の全OUTPUTに合わせる）──
    request.output("ShortestNouki",       sql.VarChar(10))
    request.output("UnitPrice",           sql.Money)
    request.output("SumPrice",            sql.Money)
    request.output("DeliveryDeadline",    sql.DateTime2)
    // 中間値OUTPUT
    request.output("ZairyouSizeT_OUT",    sql.Decimal(7, 3))
    request.output("ZairyouSizeA_OUT",    sql.Decimal(7, 3))
    request.output("ZairyouSizeB_OUT",    sql.Decimal(7, 3))
    request.output("ColNo_OUT",           sql.Int)
    request.output("RowNo_OUT",           sql.Int)
    request.output("Exists_OUT",          sql.Bit)
    request.output("OutOfRange_OUT",      sql.Bit)
    request.output("Index_OUT",           sql.Decimal(5, 1))
    request.output("Price_OUT",           sql.Money)
    request.output("Index2_OUT",          sql.Decimal(5, 1))
    request.output("Price2_OUT",          sql.Money)
    request.output("ExceptSetting_OUT",   sql.Bit)
    request.output("ZairyouUWeight_OUT",  sql.Decimal(18, 6))
    request.output("ZairyouWeight_OUT",   sql.Decimal(18, 6))
    request.output("ProductUWeight_OUT",  sql.Decimal(18, 6))
    request.output("ProductWeight_OUT",   sql.Decimal(18, 6))
    request.output("ZaishitsuEx_OUT",     sql.Decimal(4, 2))
    request.output("ShiyouEx_OUT",        sql.Decimal(4, 2))
    request.output("ItaatsuEx_OUT",       sql.Decimal(4, 2))
    request.output("TorishiroEx_T_OUT",   sql.Decimal(4, 2))
    request.output("TorishiroEx_A_OUT",   sql.Decimal(4, 2))
    request.output("TorishiroEx_B_OUT",   sql.Decimal(4, 2))
    request.output("Variation_T_OUT",     sql.Decimal(6, 2))
    request.output("Variation_A_OUT",     sql.Decimal(6, 2))
    request.output("Variation_B_OUT",     sql.Decimal(6, 2))
    request.output("SuryouEx_OUT",        sql.Decimal(4, 2))
    request.output("TokuisakiEx_OUT",     sql.Decimal(4, 2))
    request.output("TyokusousakiEx_OUT",  sql.Decimal(4, 2))
    request.output("KPatternCd_OUT",      sql.Decimal(18, 6))
    request.output("KPColNo_OUT",         sql.Int)
    request.output("KPRowNo_OUT",         sql.Int)
    request.output("KPExists_OUT",        sql.Bit)
    request.output("KPIndex_OUT",         sql.Decimal(5, 1))
    request.output("6FKakouPrice_OUT",    sql.Money)
    request.output("KakouPrice_OUT",      sql.Money)
    request.output("SGKakouPrice_OUT",    sql.Money)
    request.output("SGKakouPrice_T_OUT",  sql.Decimal(10, 2))
    request.output("SGKakouPrice_A_OUT",  sql.Decimal(10, 2))
    request.output("SGKakouPrice_B_OUT",  sql.Decimal(10, 2))
    request.output("KakouPriceSummary_OUT", sql.Money)
    request.output("DeliveryUCost_OUT",   sql.Money)
    request.output("DeliveryCost_OUT",    sql.Money)
    request.output("PatternCd_OUT",       sql.Int)
    request.output("IndexNo_OUT",         sql.Int)
    request.output("BaseCost_OUT",        sql.Money)
    request.output("RegionCd_OUT",        sql.VarChar(3))
    request.output("Adderess_OUT",        sql.VarChar(130))
    request.output("AreaCd_OUT",          sql.Int)
    request.output("Area_OUT",            sql.VarChar(20))
    request.output("Prefectures_OUT",     sql.VarChar(20))
    request.output("Coefficient_OUT",     sql.Decimal(3, 1))

    // ── SPに渡す全パラメータ(85項目)をログ出力（デバッグ用）──
    const spParams = {
      SessionID: sessionId, RowID: body.rowId ?? 0, WOEstimateNo: body.estOrderNo ?? "",
      ZairyouCd: body.materialCode, ZairyouName: body.materialName ?? "",
      KakouShiyouCd: body.kakouShiyouCode, KakouShiyou: body.kakouShiyou ?? "",
      Kakou_T: kakouTCode, Kakou_A: kakouACode, Kakou_B: kakouBCode,
      KakouShijiCd_T: kakouTCode, KakouShijiCd_A: kakouACode, KakouShijiCd_B: kakouBCode,
      Size_T: body.sizeT, Size_A: body.sizeA, Size_B: body.sizeB,
      Kousa_T_U: body.kousaTUpper ?? 0, Kousa_A_U: body.kousaAUpper ?? 0, Kousa_B_U: body.kousaBUpper ?? 0,
      Kousa_T_L: body.kousaTLower ?? 0, Kousa_A_L: body.kousaALower ?? 0, Kousa_B_L: body.kousaBLower ?? 0,
      MentoriShiji: body.mentoriShiji ?? "", Mentori_4: body.mentori4 ?? 0, Mentori_8: body.mentori8 ?? 0,
      Suryou: body.quantity, RequestPrice: 0, RequestNouki: body.requestNouki ?? "",
      CustomerNo: body.customerNo ?? "", EndUserNo: body.endUserNo ?? "", Refer: "",
      TokuisakiCd: tokuisakiCd, EndUserCd: body.endUserCd ?? "",
      TyokusousakiCd: body.tyokusousakiCd ?? "", TyokusousakiName: body.tyokusousakiName ?? "",
      TyokusousakiZipCd: body.tyokusousakiYubin ?? "", TyokusousakiAddr: body.tyokusousakiAddress ?? "",
      TyokusousakiPost: body.tyokusousakiPost ?? "", TyokusousakiCharge: body.tyokusousakiCharge ?? "",
      EditMode: body.editMode,
    }
    const SP_NAME = "usp_ASP_EstimateAmountCalculation_get"
    console.log("========== [calculate] SP実行直前 ==========")
    console.log("[calculate] 実行ストアドプロシージャ名:", SP_NAME)
    console.log("[calculate] 全送信パラメータ(85項目):", JSON.stringify(spParams, null, 2))
    console.log("================================================")
    const result = await request.execute(SP_NAME)
    // ── SP実行結果(OUTPUT全項目)をログ出力（デバッグ用）──
    console.log("========== [calculate] SP実行結果 ==========")
    console.log("[calculate] 実行済みストアドプロシージャ名:", SP_NAME)
    console.log("[calculate] OUTPUT全項目:", JSON.stringify(result.output, null, 2))
    console.log("[calculate] recordsets件数:", result.recordsets?.length ?? 0)
    console.log("[calculate] rowsAffected:", JSON.stringify(result.rowsAffected))
    console.log("================================================")

    const out = result.output
    const unitPrice: number    = Number(out["UnitPrice"]      ?? 0)
    const sumPrice: number     = Number(out["SumPrice"]       ?? 0)
    const shortestNouki: string = out["ShortestNouki"]        ?? ""
    const deliveryDeadline     = out["DeliveryDeadline"]

    if (unitPrice <= 0) {
      console.warn("[calculate] SP実行結果が不正(unitPrice<=0):", { unitPrice, shortestNouki })
      return NextResponse.json(
        { error: "計算結果が不正です。材料コード・加工仕様・寸法を確認してください。" },
        { status: 422 }
      )
    }
    if (!shortestNouki) {
      console.warn("[calculate] shortestNouki が空 → 空文字で続行（SP仕様上一部組合せで返らない）")
      // shortestNouki空でも unitPrice>0 なら計算成功とみなす
    }

    return NextResponse.json({
      success: true,
      unitPrice,
      sumPrice,
      shortestDelivery: shortestNouki,
      deliveryDeadline: deliveryDeadline
        ? (deliveryDeadline as Date).toISOString().slice(0, 10)
        : null,
      intermediate: {
        materialSizeT:       Number(out["ZairyouSizeT_OUT"]      ?? 0),
        materialSizeA:       Number(out["ZairyouSizeA_OUT"]      ?? 0),
        materialSizeB:       Number(out["ZairyouSizeB_OUT"]      ?? 0),
        materialUnitWeight:  Number(out["ZairyouUWeight_OUT"]    ?? 0),
        materialTotalWeight: Number(out["ZairyouWeight_OUT"]     ?? 0),
        productUnitWeight:   Number(out["ProductUWeight_OUT"]    ?? 0),
        productTotalWeight:  Number(out["ProductWeight_OUT"]     ?? 0),
        processingCost6f:    Number(out["6FKakouPrice_OUT"]      ?? 0),
        processingCostTotal: Number(out["KakouPriceSummary_OUT"] ?? 0),
      },
    })
  } catch (err: any) {
    if (err.code === "ETIMEOUT" || err.message?.includes("timeout")) {
      console.error("[calculate] SP タイムアウト:", err)
      return NextResponse.json(
        { error: "計算処理がタイムアウトしました（120秒）" },
        { status: 504 }
      )
    }
    // mssql RequestError は message が空文字になることがあり、
    // 実際の詳細は originalError や number/state/class/procName/lineNumber に
    // 入っているケースがある。さらに err が通常のEnumerable propertyを
    // 持たない/circular構造を含む場合もあるため、
    // Object.getOwnPropertyNames で全プロパティを安全にダンプする。
    const dumpError = (e: any): Record<string, unknown> => {
      if (e === null || e === undefined) return { value: String(e) }
      if (typeof e !== "object") return { value: String(e), type: typeof e }
      const out: Record<string, unknown> = {}
      const seen = new WeakSet<object>()
      const safe = (v: unknown, depth: number): unknown => {
        if (v === null || v === undefined) return v
        if (typeof v !== "object") return v
        if (depth > 3) return "[depth limit]"
        if (seen.has(v as object)) return "[circular]"
        seen.add(v as object)
        if (v instanceof Error) {
          const inner: Record<string, unknown> = {}
          for (const k of Object.getOwnPropertyNames(v)) {
            inner[k] = safe((v as any)[k], depth + 1)
          }
          return inner
        }
        if (Array.isArray(v)) return v.map(item => safe(item, depth + 1))
        const objOut: Record<string, unknown> = {}
        for (const k of Object.getOwnPropertyNames(v)) {
          try { objOut[k] = safe((v as any)[k], depth + 1) } catch { objOut[k] = "[unreadable]" }
        }
        return objOut
      }
      for (const k of Object.getOwnPropertyNames(e)) {
        try { out[k] = safe(e[k], 0) } catch { out[k] = "[unreadable]" }
      }
      return out
    }
    const errorDump = dumpError(err)
    console.error("========== [calculate] SP 実行エラー: 全詳細ダンプ ==========")
    console.error("err instanceof Error:", err instanceof Error)
    console.error("typeof err:", typeof err)
    console.error(JSON.stringify(errorDump, null, 2))
    console.error("================================================================")

    const detailMessage =
      err?.message ||
      err?.originalError?.message ||
      err?.originalError?.info?.message ||
      (err?.number ? `SQLエラー番号: ${err.number}` : "") ||
      `不明なエラー。詳細: ${JSON.stringify(errorDump).slice(0, 500)}`
    return NextResponse.json(
      { error: "計算処理中にエラーが発生しました", detail: detailMessage, debugDump: errorDump },
      { status: 500 }
    )
  }
}