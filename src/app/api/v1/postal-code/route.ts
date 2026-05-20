// GET /api/v1/postal-code?zip=1234567  郵便番号→住所変換（zipcloud）
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const zip = req.nextUrl.searchParams.get("zip") ?? ""
  const normalized = zip.replace(/-/g, "")
  if (!/^\d{7}$/.test(normalized)) {
    return NextResponse.json({ error: "郵便番号は7桁の数字で入力してください" }, { status: 400 })
  }

  try {
    const res = await fetch(
      `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${normalized}`,
      { next: { revalidate: 86400 } }
    )
    if (!res.ok) throw new Error(`zipcloud HTTP ${res.status}`)
    const data = await res.json()

    if (data.status !== 200 || !data.results || data.results.length === 0) {
      return NextResponse.json({ error: "住所が見つかりませんでした" }, { status: 404 })
    }

    const r = data.results[0]
    return NextResponse.json({
      address1: r.address1 ?? "",   // 都道府県
      address2: r.address2 ?? "",   // 市区町村
      address3: r.address3 ?? "",   // 町域
    })
  } catch (e: any) {
    console.error("[postal-code] error:", e.message)
    return NextResponse.json({ error: "住所検索に失敗しました" }, { status: 500 })
  }
}
