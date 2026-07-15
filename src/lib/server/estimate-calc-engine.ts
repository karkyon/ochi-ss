// src/lib/server/estimate-calc-engine.ts
// ============================================================
// usp_ASP_EstimateAmountCalculation_get 呼び出し共通エンジン
//
// src/app/api/v1/estimates/calculate/route.ts (フロント表示用の計算API)と、
// 見積保存時のサーバー側金額再検証 (src/lib/server/estimate-revalidate.ts) の
// 両方から呼び出される。パラメータ組み立て・SP実行・OUTPUT解析は
// 元々 calculate/route.ts に実装されていたものをそのまま抽出しており、
// ロジックの重複実装によるズレ（＝再検証の意味が失われること）を防ぐため、
// 新しく計算処理を書く場合は必ずこの関数を経由すること。
// ============================================================

import { getSqlServerPool, sql } from "@/lib/sqlserver"

type SqlPool = Awaited<ReturnType<typeof getSqlServerPool>>

export interface EstimateCalcInput {
  rowId?: number
  estOrderNo?: string
  editMode: "New" | "Edit" | "Copy"
  materialCode: string
  materialName?: string
  kakouShiyouCode: number
  kakouShiyou?: string
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

export interface EstimateCalcSession {
  sessionId: string
  tokuisakiCd: string
}

export interface EstimateCalcResult {
  unitPrice: number
  sumPrice: number
  shortestNouki: string
  deliveryDeadline: Date | null
  existsFlag: unknown
  outOfRange: unknown
  materialSizeT: number
  materialSizeA: number
  materialSizeB: number
  materialUnitWeight: number
  materialTotalWeight: number
  productUnitWeight: number
  productTotalWeight: number
  processingCost6f: number
  processingCostTotal: number
}

// ── 加工指示コード 文字列→整数 逆引き ──
// src/app/api/v1/masters/processing-specs/route.ts の codeToStr() と対になる変換。
// SQL Server「WO加工仕様」テーブルの加工指示コードT/A/B(int)を、表示用に
// codeToStr()で "RG"/"W"/"〜"/"SG" に変換した結果がフロントに渡っているため、
// SP実行前にその逆変換で整数に戻す必要がある。
export function strToKakouCode(s: string | undefined | null): number | null {
  switch (s) {
    case "RG": return 1
    case "W":  return 2
    case "〜": return 4
    case "SG": return 5
    default:   return null
  }
}

/**
 * usp_ASP_EstimateAmountCalculation_get を実行し、単価・合計・納期等を返す。
 * pool は呼び出し側で取得済みのものを渡す（接続エラーのハンドリングは呼び出し側の責務）。
 */
export async function runEstimateCalculation(
  pool: SqlPool,
  input: EstimateCalcInput,
  session: EstimateCalcSession
): Promise<EstimateCalcResult> {
  const request = pool.request()

  const kakouTCode = strToKakouCode(input.kakouShijiCodeT)
  const kakouACode = strToKakouCode(input.kakouShijiCodeA)
  const kakouBCode = strToKakouCode(input.kakouShijiCodeB)

  request.input("SessionID",           sql.VarChar(30),      session.sessionId ?? "")
  request.input("RowID",               sql.Int,              input.rowId ?? 0)
  request.input("WOEstimateNo",        sql.VarChar(20),      input.estOrderNo ?? "")
  request.input("ZairyouCd",           sql.VarChar(4),       input.materialCode)
  request.input("ZairyouName",         sql.VarChar(20),      input.materialName ?? "")
  request.input("KakouShiyouCd",       sql.SmallInt,         input.kakouShiyouCode)
  request.input("KakouShiyou",         sql.VarChar(10),      input.kakouShiyou ?? "")
  request.input("Kakou_T",             sql.Int,              kakouTCode)
  request.input("Kakou_A",             sql.Int,              kakouACode)
  request.input("Kakou_B",             sql.Int,              kakouBCode)
  request.input("KakouShijiCd_T",      sql.Int,              kakouTCode)
  request.input("KakouShijiCd_A",      sql.Int,              kakouACode)
  request.input("KakouShijiCd_B",      sql.Int,              kakouBCode)
  request.input("Size_T",              sql.Decimal(8, 3),    input.sizeT)
  request.input("Size_A",              sql.Decimal(8, 3),    input.sizeA)
  request.input("Size_B",              sql.Decimal(8, 3),    input.sizeB)
  request.input("Kousa_T_U",           sql.Decimal(8, 3),    input.kousaTUpper ?? 0)
  request.input("Kousa_A_U",           sql.Decimal(8, 3),    input.kousaAUpper ?? 0)
  request.input("Kousa_B_U",           sql.Decimal(8, 3),    input.kousaBUpper ?? 0)
  request.input("Kousa_T_L",           sql.Decimal(8, 3),    input.kousaTLower ?? 0)
  request.input("Kousa_A_L",           sql.Decimal(8, 3),    input.kousaALower ?? 0)
  request.input("Kousa_B_L",           sql.Decimal(8, 3),    input.kousaBLower ?? 0)
  request.input("MentoriShiji",        sql.VarChar(10),      input.mentoriShiji ?? "")
  request.input("Mentori_4",           sql.Decimal(8, 3),    input.mentori4 ?? 0)
  request.input("Mentori_8",           sql.Decimal(8, 3),    input.mentori8 ?? 0)
  request.input("Suryou",              sql.Int,              input.quantity)
  request.input("RequestPrice",        sql.Money,            0)
  request.input("RequestNouki",        sql.VarChar(10),      input.requestNouki ?? "")
  request.input("CustomerNo",          sql.VarChar(100),     input.customerNo ?? "")
  request.input("EndUserNo",           sql.VarChar(100),     input.endUserNo ?? "")
  request.input("Refer",               sql.VarChar(255),     "")
  request.input("TokuisakiCd",         sql.VarChar(6),       session.tokuisakiCd ?? "")
  request.input("EndUserCd",           sql.VarChar(6),       input.endUserCd ?? "")
  request.input("TyokusousakiCd",      sql.VarChar(6),       input.tyokusousakiCd ?? "")
  request.input("TyokusousakiName",    sql.VarChar(80),      input.tyokusousakiName ?? "")
  request.input("TyokusousakiZipCd",   sql.VarChar(10),      input.tyokusousakiYubin ?? "")
  request.input("TyokusousakiAddr",    sql.VarChar(255),     input.tyokusousakiAddress ?? "")
  request.input("TyokusousakiPost",    sql.VarChar(50),      input.tyokusousakiPost ?? "")
  request.input("TyokusousakiCharge",  sql.VarChar(20),      input.tyokusousakiCharge ?? "")
  request.input("EditMode",            sql.VarChar(10),      input.editMode)

  request.output("ShortestNouki",       sql.VarChar(10))
  request.output("UnitPrice",           sql.Money)
  request.output("SumPrice",            sql.Money)
  request.output("DeliveryDeadline",    sql.DateTime2)
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

  const result = await request.execute("usp_ASP_EstimateAmountCalculation_get")
  const out = result.output

  return {
    unitPrice:            Number(out["UnitPrice"] ?? 0),
    sumPrice:             Number(out["SumPrice"] ?? 0),
    shortestNouki:        out["ShortestNouki"] ?? "",
    deliveryDeadline:     (out["DeliveryDeadline"] as Date | undefined) ?? null,
    existsFlag:           out["Exists_OUT"],
    outOfRange:           out["OutOfRange_OUT"],
    materialSizeT:        Number(out["ZairyouSizeT_OUT"] ?? 0),
    materialSizeA:        Number(out["ZairyouSizeA_OUT"] ?? 0),
    materialSizeB:        Number(out["ZairyouSizeB_OUT"] ?? 0),
    materialUnitWeight:   Number(out["ZairyouUWeight_OUT"] ?? 0),
    materialTotalWeight:  Number(out["ZairyouWeight_OUT"] ?? 0),
    productUnitWeight:    Number(out["ProductUWeight_OUT"] ?? 0),
    productTotalWeight:   Number(out["ProductWeight_OUT"] ?? 0),
    processingCost6f:     Number(out["6FKakouPrice_OUT"] ?? 0),
    processingCostTotal:  Number(out["KakouPriceSummary_OUT"] ?? 0),
  }
}
