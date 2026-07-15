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
import { getSqlServerPool } from "@/lib/sqlserver"
import { runEstimateCalculation, strToKakouCode } from "@/lib/server/estimate-calc-engine"

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

// 加工指示コード 文字列→整数 逆引き(strToKakouCode)は
// src/lib/server/estimate-calc-engine.ts に共通化済み(重複実装を避けるため)。

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
    const sessionId    = session.user.userId ?? ""
    const tokuisakiCd  = session.user.companyCode ?? ""

    const kakouTCode = strToKakouCode(body.kakouShijiCodeT)
    const kakouACode = strToKakouCode(body.kakouShijiCodeA)
    const kakouBCode = strToKakouCode(body.kakouShijiCodeB)
    console.log("[calculate] 加工指示コード逆変換:", {
      T: { from: body.kakouShijiCodeT, to: kakouTCode },
      A: { from: body.kakouShijiCodeA, to: kakouACode },
      B: { from: body.kakouShijiCodeB, to: kakouBCode },
    })

    // ── SP実行本体は共通エンジン(estimate-calc-engine.ts)に委譲 ──
    // 見積保存時のサーバー側金額再検証(estimate-revalidate.ts)と全く同じ経路で
    // SPを呼び出すことで、パラメータ組み立てのズレによる不整合を防ぐ。
    const calcResult = await runEstimateCalculation(
      pool,
      {
        editMode: body.editMode,
        rowId: body.rowId,
        estOrderNo: body.estOrderNo,
        materialCode: body.materialCode,
        materialName: body.materialName,
        kakouShiyouCode: body.kakouShiyouCode,
        kakouShiyou: body.kakouShiyou,
        kakouShijiCodeT: body.kakouShijiCodeT,
        kakouShijiCodeA: body.kakouShijiCodeA,
        kakouShijiCodeB: body.kakouShijiCodeB,
        sizeT: body.sizeT,
        sizeA: body.sizeA,
        sizeB: body.sizeB,
        kousaTUpper: body.kousaTUpper,
        kousaTLower: body.kousaTLower,
        kousaAUpper: body.kousaAUpper,
        kousaALower: body.kousaALower,
        kousaBUpper: body.kousaBUpper,
        kousaBLower: body.kousaBLower,
        mentoriShiji: body.mentoriShiji,
        mentori4: body.mentori4,
        mentori8: body.mentori8,
        quantity: body.quantity,
        requestNouki: body.requestNouki,
        endUserNo: body.endUserNo,
        customerNo: body.customerNo,
        endUserCd: body.endUserCd,
        tyokusousakiCd: body.tyokusousakiCd,
        tyokusousakiName: body.tyokusousakiName,
        tyokusousakiYubin: body.tyokusousakiYubin,
        tyokusousakiAddress: body.tyokusousakiAddress,
        tyokusousakiPost: body.tyokusousakiPost,
        tyokusousakiCharge: body.tyokusousakiCharge,
      },
      { sessionId, tokuisakiCd }
    )

    // ── SP実行結果をログ出力（デバッグ用）──
    console.log("========== [calculate] SP実行結果 ==========")
    console.log("[calculate] 実行済みストアドプロシージャ名:", "usp_ASP_EstimateAmountCalculation_get")
    console.log("[calculate] 再計算結果:", JSON.stringify(calcResult, null, 2))
    console.log("================================================")

    const unitPrice: number     = calcResult.unitPrice
    const sumPrice: number      = calcResult.sumPrice
    const shortestNouki: string = calcResult.shortestNouki
    const deliveryDeadline      = calcResult.deliveryDeadline
    // ── 以降の処理(エラー判定・intermediate組み立て等)は既存コードのまま、
    //    "out[...]" 参照との互換のため、計算結果を同じキー名に詰め直す ──
    const out: Record<string, unknown> = {
      Exists_OUT: calcResult.existsFlag,
      OutOfRange_OUT: calcResult.outOfRange,
      ZairyouSizeT_OUT: calcResult.materialSizeT,
      ZairyouSizeA_OUT: calcResult.materialSizeA,
      ZairyouSizeB_OUT: calcResult.materialSizeB,
      ZairyouUWeight_OUT: calcResult.materialUnitWeight,
      ZairyouWeight_OUT: calcResult.materialTotalWeight,
      ProductUWeight_OUT: calcResult.productUnitWeight,
      ProductWeight_OUT: calcResult.productTotalWeight,
      "6FKakouPrice_OUT": calcResult.processingCost6f,
      KakouPriceSummary_OUT: calcResult.processingCostTotal,
    }

    if (unitPrice <= 0) {
      // ★2026/07/13 修正: 「計算結果が不正です」という汎用メッセージだけでは
      // ユーザーがシステム不具合と誤解するため、SPが返す Exists_OUT / OutOfRange_OUT /
      // ZairyouSizeT_OUT等から原因を判定し、具体的な理由をエラーメッセージに含める。
      const existsFlag = out["Exists_OUT"]
      const outOfRange = out["OutOfRange_OUT"]
      const zSizeT = out["ZairyouSizeT_OUT"]
      const zSizeA = out["ZairyouSizeA_OUT"]
      const zSizeB = out["ZairyouSizeB_OUT"]
      console.warn("[calculate] SP実行結果が不正(unitPrice<=0):", {
        unitPrice, shortestNouki, existsFlag, outOfRange, zSizeT, zSizeA, zSizeB,
      })

      let reason: string
      let reasonCode: string
      const sizeLabel = `厚み(T)=${body.sizeT} 幅(A)=${body.sizeA} 長さ(B)=${body.sizeB}`
      if (outOfRange === true || outOfRange === 1) {
        reason = `入力された寸法（${sizeLabel}）が、材料コード「${body.materialCode}」の価格設定範囲を超えています。寸法をご確認いただくか、営業担当までお問い合わせください。`
        reasonCode = "OUT_OF_RANGE"
      } else if (existsFlag === false || existsFlag === 0) {
        reason = `材料コード「${body.materialCode}」・寸法（${sizeLabel}）に該当する価格設定が見つかりませんでした。材料または寸法をご確認ください。`
        reasonCode = "NOT_FOUND"
      } else {
        reason = `計算結果の単価が0円になりました。材料コード「${body.materialCode}」・加工仕様・寸法（${sizeLabel}）の組み合わせをご確認ください。`
        reasonCode = "ZERO_PRICE"
      }

      return NextResponse.json(
        {
          error: reason,
          reasonCode,
          diagnostics: { exists: existsFlag, outOfRange, materialSizeT: zSizeT, materialSizeA: zSizeA, materialSizeB: zSizeB },
        },
        { status: 422 }
      )
    }
    if (!shortestNouki) {
      console.warn("[calculate] shortestNouki が空 → 空文字で続行（SP仕様上一部組合せで返らない）")
      // shortestNouki空でも unitPrice>0 なら計算成功とみなす
    }

    // ── SSMS貼り付け用EXEC文（デバッグ・SSMS再現用。SP実行自体は共通エンジン側で完了済み）──
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
    const nullOrStr2 = (v: any) => v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`
    const nullOrNum2 = (v: any) => v === null || v === undefined ? "NULL" : String(v)
    const p = spParams as any
    const ssmsExecSql = [
      "USE [ochidb_dev]",
      "GO",
      "",
      "DECLARE\t@return_value int,",
      "\t\t@ShortestNouki varchar(10),",
      "\t\t@UnitPrice money,",
      "\t\t@SumPrice money,",
      "\t\t@DeliveryDeadline datetime2(7),",
      "\t\t@ZairyouSizeT_OUT decimal(7, 3),",
      "\t\t@ZairyouSizeA_OUT decimal(7, 3),",
      "\t\t@ZairyouSizeB_OUT decimal(7, 3),",
      "\t\t@ColNo_OUT int,",
      "\t\t@RowNo_OUT int,",
      "\t\t@Exists_OUT bit,",
      "\t\t@OutOfRange_OUT bit,",
      "\t\t@Index_OUT decimal(5, 1),",
      "\t\t@Price_OUT money,",
      "\t\t@Index2_OUT decimal(5, 1),",
      "\t\t@Price2_OUT money,",
      "\t\t@ExceptSetting_OUT bit,",
      "\t\t@ZairyouUWeight_OUT decimal(18, 6),",
      "\t\t@ZairyouWeight_OUT decimal(18, 6),",
      "\t\t@ProductUWeight_OUT decimal(18, 6),",
      "\t\t@ProductWeight_OUT decimal(18, 6),",
      "\t\t@ZaishitsuEx_OUT decimal(4, 2),",
      "\t\t@ShiyouEx_OUT decimal(4, 2),",
      "\t\t@ItaatsuEx_OUT decimal(4, 2),",
      "\t\t@TorishiroEx_T_OUT decimal(4, 2),",
      "\t\t@TorishiroEx_A_OUT decimal(4, 2),",
      "\t\t@TorishiroEx_B_OUT decimal(4, 2),",
      "\t\t@Variation_T_OUT decimal(6, 2),",
      "\t\t@Variation_A_OUT decimal(6, 2),",
      "\t\t@Variation_B_OUT decimal(6, 2),",
      "\t\t@SuryouEx_OUT decimal(4, 2),",
      "\t\t@TokuisakiEx_OUT decimal(4, 2),",
      "\t\t@TyokusousakiEx_OUT decimal(4, 2),",
      "\t\t@KPatternCd_OUT decimal(18, 6),",
      "\t\t@KPColNo_OUT int,",
      "\t\t@KPRowNo_OUT int,",
      "\t\t@KPExists_OUT bit,",
      "\t\t@KPIndex_OUT decimal(5, 1),",
      "\t\t@6FKakouPrice_OUT money,",
      "\t\t@KakouPrice_OUT money,",
      "\t\t@SGKakouPrice_OUT money,",
      "\t\t@SGKakouPrice_T_OUT decimal(10, 2),",
      "\t\t@SGKakouPrice_A_OUT decimal(10, 2),",
      "\t\t@SGKakouPrice_B_OUT decimal(10, 2),",
      "\t\t@KakouPriceSummary_OUT money,",
      "\t\t@DeliveryUCost_OUT money,",
      "\t\t@DeliveryCost_OUT money,",
      "\t\t@PatternCd_OUT int,",
      "\t\t@IndexNo_OUT int,",
      "\t\t@BaseCost_OUT money,",
      "\t\t@RegionCd_OUT varchar(3),",
      "\t\t@Adderess_OUT varchar(130),",
      "\t\t@AreaCd_OUT int,",
      "\t\t@Area_OUT varchar(20),",
      "\t\t@Prefectures_OUT varchar(20),",
      "\t\t@Coefficient_OUT decimal(3, 1)",
      "",
      `EXEC\t@return_value = [dbo].[usp_ASP_EstimateAmountCalculation_get]`,
      `\t\t@SessionID = ${nullOrStr2(p.SessionID)},`,
      `\t\t@RowID = ${nullOrNum2(p.RowID)},`,
      `\t\t@WOEstimateNo = ${nullOrStr2(p.WOEstimateNo)},`,
      `\t\t@ZairyouCd = ${nullOrStr2(p.ZairyouCd)},`,
      `\t\t@ZairyouName = ${nullOrStr2(p.ZairyouName)},`,
      `\t\t@KakouShiyouCd = ${nullOrNum2(p.KakouShiyouCd)},`,
      `\t\t@KakouShiyou = ${nullOrStr2(p.KakouShiyou)},`,
      `\t\t@Kakou_T = ${nullOrNum2(p.Kakou_T)},`,
      `\t\t@Kakou_A = ${nullOrNum2(p.Kakou_A)},`,
      `\t\t@Kakou_B = ${nullOrNum2(p.Kakou_B)},`,
      `\t\t@KakouShijiCd_T = ${nullOrNum2(p.KakouShijiCd_T)},`,
      `\t\t@KakouShijiCd_A = ${nullOrNum2(p.KakouShijiCd_A)},`,
      `\t\t@KakouShijiCd_B = ${nullOrNum2(p.KakouShijiCd_B)},`,
      `\t\t@Size_T = ${nullOrNum2(p.Size_T)},`,
      `\t\t@Size_A = ${nullOrNum2(p.Size_A)},`,
      `\t\t@Size_B = ${nullOrNum2(p.Size_B)},`,
      `\t\t@Kousa_T_U = ${nullOrNum2(p.Kousa_T_U)},`,
      `\t\t@Kousa_A_U = ${nullOrNum2(p.Kousa_A_U)},`,
      `\t\t@Kousa_B_U = ${nullOrNum2(p.Kousa_B_U)},`,
      `\t\t@Kousa_T_L = ${nullOrNum2(p.Kousa_T_L)},`,
      `\t\t@Kousa_A_L = ${nullOrNum2(p.Kousa_A_L)},`,
      `\t\t@Kousa_B_L = ${nullOrNum2(p.Kousa_B_L)},`,
      `\t\t@MentoriShiji = ${nullOrStr2(p.MentoriShiji)},`,
      `\t\t@Mentori_4 = ${nullOrNum2(p.Mentori_4)},`,
      `\t\t@Mentori_8 = ${nullOrNum2(p.Mentori_8)},`,
      `\t\t@Suryou = ${nullOrNum2(p.Suryou)},`,
      `\t\t@RequestPrice = ${nullOrNum2(p.RequestPrice)},`,
      `\t\t@RequestNouki = ${nullOrStr2(p.RequestNouki)},`,
      `\t\t@CustomerNo = ${nullOrStr2(p.CustomerNo)},`,
      `\t\t@EndUserNo = ${nullOrStr2(p.EndUserNo)},`,
      `\t\t@Refer = ${nullOrStr2(p.Refer)},`,
      `\t\t@TokuisakiCd = ${nullOrStr2(p.TokuisakiCd)},`,
      `\t\t@EndUserCd = ${nullOrStr2(p.EndUserCd)},`,
      `\t\t@TyokusousakiCd = ${nullOrStr2(p.TyokusousakiCd)},`,
      `\t\t@TyokusousakiName = ${nullOrStr2(p.TyokusousakiName)},`,
      `\t\t@TyokusousakiZipCd = ${nullOrStr2(p.TyokusousakiZipCd)},`,
      `\t\t@TyokusousakiAddr = ${nullOrStr2(p.TyokusousakiAddr)},`,
      `\t\t@TyokusousakiPost = ${nullOrStr2(p.TyokusousakiPost)},`,
      `\t\t@TyokusousakiCharge = ${nullOrStr2(p.TyokusousakiCharge)},`,
      `\t\t@EditMode = ${nullOrStr2(p.EditMode)},`,
      "\t\t@ShortestNouki = @ShortestNouki OUTPUT,",
      "\t\t@UnitPrice = @UnitPrice OUTPUT,",
      "\t\t@SumPrice = @SumPrice OUTPUT,",
      "\t\t@DeliveryDeadline = @DeliveryDeadline OUTPUT,",
      "\t\t@ZairyouSizeT_OUT = @ZairyouSizeT_OUT OUTPUT,",
      "\t\t@ZairyouSizeA_OUT = @ZairyouSizeA_OUT OUTPUT,",
      "\t\t@ZairyouSizeB_OUT = @ZairyouSizeB_OUT OUTPUT,",
      "\t\t@ColNo_OUT = @ColNo_OUT OUTPUT,",
      "\t\t@RowNo_OUT = @RowNo_OUT OUTPUT,",
      "\t\t@Exists_OUT = @Exists_OUT OUTPUT,",
      "\t\t@OutOfRange_OUT = @OutOfRange_OUT OUTPUT,",
      "\t\t@Index_OUT = @Index_OUT OUTPUT,",
      "\t\t@Price_OUT = @Price_OUT OUTPUT,",
      "\t\t@Index2_OUT = @Index2_OUT OUTPUT,",
      "\t\t@Price2_OUT = @Price2_OUT OUTPUT,",
      "\t\t@ExceptSetting_OUT = @ExceptSetting_OUT OUTPUT,",
      "\t\t@ZairyouUWeight_OUT = @ZairyouUWeight_OUT OUTPUT,",
      "\t\t@ZairyouWeight_OUT = @ZairyouWeight_OUT OUTPUT,",
      "\t\t@ProductUWeight_OUT = @ProductUWeight_OUT OUTPUT,",
      "\t\t@ProductWeight_OUT = @ProductWeight_OUT OUTPUT,",
      "\t\t@ZaishitsuEx_OUT = @ZaishitsuEx_OUT OUTPUT,",
      "\t\t@ShiyouEx_OUT = @ShiyouEx_OUT OUTPUT,",
      "\t\t@ItaatsuEx_OUT = @ItaatsuEx_OUT OUTPUT,",
      "\t\t@TorishiroEx_T_OUT = @TorishiroEx_T_OUT OUTPUT,",
      "\t\t@TorishiroEx_A_OUT = @TorishiroEx_A_OUT OUTPUT,",
      "\t\t@TorishiroEx_B_OUT = @TorishiroEx_B_OUT OUTPUT,",
      "\t\t@Variation_T_OUT = @Variation_T_OUT OUTPUT,",
      "\t\t@Variation_A_OUT = @Variation_A_OUT OUTPUT,",
      "\t\t@Variation_B_OUT = @Variation_B_OUT OUTPUT,",
      "\t\t@SuryouEx_OUT = @SuryouEx_OUT OUTPUT,",
      "\t\t@TokuisakiEx_OUT = @TokuisakiEx_OUT OUTPUT,",
      "\t\t@TyokusousakiEx_OUT = @TyokusousakiEx_OUT OUTPUT,",
      "\t\t@KPatternCd_OUT = @KPatternCd_OUT OUTPUT,",
      "\t\t@KPColNo_OUT = @KPColNo_OUT OUTPUT,",
      "\t\t@KPRowNo_OUT = @KPRowNo_OUT OUTPUT,",
      "\t\t@KPExists_OUT = @KPExists_OUT OUTPUT,",
      "\t\t@KPIndex_OUT = @KPIndex_OUT OUTPUT,",
      "\t\t@6FKakouPrice_OUT = @6FKakouPrice_OUT OUTPUT,",
      "\t\t@KakouPrice_OUT = @KakouPrice_OUT OUTPUT,",
      "\t\t@SGKakouPrice_OUT = @SGKakouPrice_OUT OUTPUT,",
      "\t\t@SGKakouPrice_T_OUT = @SGKakouPrice_T_OUT OUTPUT,",
      "\t\t@SGKakouPrice_A_OUT = @SGKakouPrice_A_OUT OUTPUT,",
      "\t\t@SGKakouPrice_B_OUT = @SGKakouPrice_B_OUT OUTPUT,",
      "\t\t@KakouPriceSummary_OUT = @KakouPriceSummary_OUT OUTPUT,",
      "\t\t@DeliveryUCost_OUT = @DeliveryUCost_OUT OUTPUT,",
      "\t\t@DeliveryCost_OUT = @DeliveryCost_OUT OUTPUT,",
      "\t\t@PatternCd_OUT = @PatternCd_OUT OUTPUT,",
      "\t\t@IndexNo_OUT = @IndexNo_OUT OUTPUT,",
      "\t\t@BaseCost_OUT = @BaseCost_OUT OUTPUT,",
      "\t\t@RegionCd_OUT = @RegionCd_OUT OUTPUT,",
      "\t\t@Adderess_OUT = @Adderess_OUT OUTPUT,",
      "\t\t@AreaCd_OUT = @AreaCd_OUT OUTPUT,",
      "\t\t@Area_OUT = @Area_OUT OUTPUT,",
      "\t\t@Prefectures_OUT = @Prefectures_OUT OUTPUT,",
      "\t\t@Coefficient_OUT = @Coefficient_OUT OUTPUT",
      "",
      "SELECT\t@ShortestNouki as N'@ShortestNouki',",
      "\t\t@UnitPrice as N'@UnitPrice',",
      "\t\t@SumPrice as N'@SumPrice',",
      "\t\t@DeliveryDeadline as N'@DeliveryDeadline'",
      "",
      "SELECT\t'Return Value' = @return_value",
      "",
      "GO",
    ].join("\n")

    return NextResponse.json({
      success: true,
      unitPrice,
      sumPrice,
      shortestDelivery: shortestNouki,
      ssmsExecSql,
      // ★ タイムゾーン変換を防ぐため toISOString() を使わない。
      // mssqlがDatetime2をJSのDateに変換する際、SQL ServerのローカルタイムがUTCとして
      // 扱われtoISOString()でさらにズレが生じる。
      // 代わりにDateオブジェクトの各フィールドを直接取得してJST文字列を組み立てる。
      deliveryDeadline: deliveryDeadline ? (() => {
        const d = deliveryDeadline as Date
        // mssqlはSQL ServerのDateTime2値をそのままJSのDateに変換するが、
        // SQL Server側はJST(UTC+9)で動いているためgetUTCxxx()で取ると正しいJST時刻が取れる
        const Y = d.getUTCFullYear()
        const M = String(d.getUTCMonth()+1).padStart(2,"0")
        const D = String(d.getUTCDate()).padStart(2,"0")
        const h = String(d.getUTCHours()).padStart(2,"0")
        const m = String(d.getUTCMinutes()).padStart(2,"0")
        const s = String(d.getUTCSeconds()).padStart(2,"0")
        return `${Y}-${M}-${D}T${h}:${m}:${s}`
      })() : null,
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