// src/lib/formatNumber.ts — 数値入力フォーマットユーティリティ

/** フォーカス時: コンマを除去して生の数値文字列を返す */
export function removeCommas(value: string): string {
  return value.replace(/,/g, "")
}

/** フォーカスアウト時: 数値を3桁コンマ区切りにフォーマット */
export function formatWithCommas(value: string, decimals = 0): string {
  const num = parseFloat(value.replace(/,/g, ""))
  if (isNaN(num)) return value
  return decimals > 0
    ? num.toLocaleString("ja-JP", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : num.toLocaleString("ja-JP")
}

/** 金額表示: ¥ プレフィックス + コンマ区切り */
export function formatCurrency(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value
  if (isNaN(num)) return "—"
  return `¥${num.toLocaleString("ja-JP")}`
}

/** 寸法フォーマット: 3桁小数点 */
export function formatDimension(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value
  if (isNaN(num)) return "0.000"
  return num.toFixed(3)
}
