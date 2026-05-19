// src/lib/zod-schemas.ts — 共通バリデーションスキーマ
import { z } from "zod"

// ────────────────────────────────────────
// 見積ヘッダースキーマ
// ────────────────────────────────────────
export const estimateHeaderSchema = z.object({
  inputDate:       z.string().min(1, "入力日付は必須です"),
  customerOrderNo: z.string().max(50, "お客様注文Noは50文字以内").optional(),
  endUserNo:       z.string().max(50, "エンドユーザーNoは50文字以内").optional(),
  destinationCode: z.string().max(10, "送り先コードは10文字以内").optional(),
  destinationName: z.string().max(100, "送り先名は100文字以内").optional(),
  destinationDept: z.string().max(50, "部署名は50文字以内").optional(),
  destinationPerson: z.string().max(50, "担当者名は50文字以内").optional(),
  destinationZip:  z.string().max(10, "郵便番号は10文字以内").optional(),
  destinationAddress: z.string().max(200, "住所は200文字以内").optional(),
  destinationTel:  z.string().max(20, "TELは20文字以内").optional(),
  destinationFax:  z.string().max(20, "FAXは20文字以内").optional(),
  requestNouki:    z.string().optional(),
  remarks:         z.string().max(500, "備考は500文字以内").optional(),
})

// ────────────────────────────────────────
// 明細スキーマ
// ────────────────────────────────────────
export const estimateDetailSchema = z.object({
  materialCode:    z.string().min(1, "材料コードは必須です"),
  kakouShiyouCode: z.number().int().nonnegative("加工仕様コードは0以上の整数"),
  sizeT: z.number().positive("厚みTは0より大きい値を入力してください").max(9999.999),
  sizeA: z.number().positive("幅Aは0より大きい値を入力してください").max(9999.999),
  sizeB: z.number().positive("長さBは0より大きい値を入力してください").max(9999.999),
  quantity: z.number().int().positive("数量は1以上の整数").max(99999),
  unitPrice: z.number().min(0, "単価は0以上").optional(),
  totalPrice: z.number().min(0, "合計は0以上").optional(),
})

export type EstimateHeaderInput = z.infer<typeof estimateHeaderSchema>
export type EstimateDetailInput = z.infer<typeof estimateDetailSchema>

// ────────────────────────────────────────
// ログインスキーマ
// ────────────────────────────────────────
export const loginSchema = z.object({
  companyCode: z.string().regex(/^\d{5}$/, "企業コードは5桁の数字で入力してください"),
  userId:      z.string().min(1, "ユーザーIDを入力してください").max(50),
  password:    z.string().min(1, "パスワードを入力してください").max(50),
})

// ────────────────────────────────────────
// 直送先スキーマ
// ────────────────────────────────────────
export const directDeliverySchema = z.object({
  deliveryCode:  z.string().min(1, "直送先コードは必須").max(10),
  companyName:   z.string().min(1, "直送先名は必須").max(100),
  departmentName: z.string().max(50).optional(),
  contactPerson:  z.string().max(50).optional(),
  postalCode:    z.string().max(8).optional(),
  address1:      z.string().max(100).optional(),
  phoneNumber:   z.string().max(20).optional(),
  faxNumber:     z.string().max(20).optional(),
  remarks:       z.string().max(200).optional(),
})

// ────────────────────────────────────────
// サーバーサイドバリデーションヘルパー
// ────────────────────────────────────────
export function validateWithZod<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data)
  if (result.success) return { success: true, data: result.data }
  const errors = result.error.issues.map((e: any) => `${e.path.join(".")}: ${e.message}`)
  return { success: false, errors }
}
