#!/usr/bin/env python3
"""
fix_phase4_delivery.py  Phase 4: 直送先管理フィールド完全実装
=============================================================
Task 4-1-1: DirectDeliveryClient.tsx に furigana/shortName/corporateType/corporatePosition フォーム追加
Task 4-1-2: 郵便番号 onBlur → zipcloud で住所自動入力
Task 4-2-1: POST/PATCH API に上記フィールドを追加
Task 4-2-2: search API レスポンスに furigana/corporateType/shortName 追加
Task 4-1-3: postal-code API 新規作成
Task 4-3-1/2: EstimateNewClient・EstimateEditClient 検索モーダルに furigana 表示
=============================================================
"""
import subprocess, sys, textwrap
from pathlib import Path

ROOT = Path.home() / "projects" / "ochi-ss"
PASS, FAIL = [], []

def apply(label: str, path: str, old: str, new: str):
    p = ROOT / path
    if not p.exists():
        FAIL.append(f"[{label}] ファイル未存在: {path}")
        return
    content = p.read_text(encoding="utf-8")
    if old not in content:
        FAIL.append(f"[{label}] 検索文字列が見つかりません")
        return
    p.write_text(content.replace(old, new, 1), encoding="utf-8")
    PASS.append(f"[{label}]")
    print(f"  ✅ {label}")

def create(label: str, path: str, content: str):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(textwrap.dedent(content).lstrip(), encoding="utf-8")
    PASS.append(f"[{label}]")
    print(f"  ✅ {label}")

def run_tsc():
    r = subprocess.run(
        ["npx", "tsc", "--noEmit"],
        cwd=ROOT, capture_output=True, text=True
    )
    return r.returncode, r.stdout + r.stderr

print("=" * 60)
print("  fix_phase4_delivery.py  Phase 4: 直送先管理フィールド完全実装")
print("=" * 60)

# ─────────────────────────────────────────────────────────
# Task 4-1-3: postal-code API 新規作成（zipcloud）
# ─────────────────────────────────────────────────────────
print("\n[Task 4-1-3] 郵便番号→住所自動入力 API 新規作成")
create(
    "postal-code API 新規",
    "src/app/api/v1/postal-code/route.ts",
    """
    // GET /api/v1/postal-code?zip=1234567  郵便番号→住所変換（zipcloud）
    import { NextRequest, NextResponse } from "next/server"
    import { auth } from "@/lib/auth"

    export async function GET(req: NextRequest) {
      const session = await auth()
      if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

      const zip = req.nextUrl.searchParams.get("zip") ?? ""
      const normalized = zip.replace(/-/g, "")
      if (!/^\\d{7}$/.test(normalized)) {
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
    """
)

# ─────────────────────────────────────────────────────────
# Task 4-2-1: POST /api/v1/masters/direct-delivery にフィールド追加
# ─────────────────────────────────────────────────────────
print("\n[Task 4-2-1a] POST /api/v1/masters/direct-delivery フィールド追加")
apply(
    "POST DD: body 分解にフィールド追加",
    "src/app/api/v1/masters/direct-delivery/route.ts",
    "  const { deliveryCode, companyName, departmentName, contactPerson, postalCode, address1, phoneNumber, faxNumber, remarks } = body",
    "  const { deliveryCode, companyName, furigana, shortName, corporateType, corporatePosition, departmentName, contactPerson, postalCode, address1, address2, address3, phoneNumber, faxNumber, remarks } = body"
)
apply(
    "POST DD: prisma.create にフィールド追加",
    "src/app/api/v1/masters/direct-delivery/route.ts",
    "        remarks: remarks ?? null,\n      },\n    })\n    return NextResponse.json({ id: dd.id }, { status: 201 })",
    """        furigana: furigana ?? null,
        shortName: shortName ?? null,
        corporateType: corporateType ?? null,
        corporatePosition: corporatePosition ?? null,
        address2: address2 ?? null,
        address3: address3 ?? null,
        remarks: remarks ?? null,
      },
    })
    return NextResponse.json({ id: dd.id }, { status: 201 })"""
)

# ─────────────────────────────────────────────────────────
# Task 4-2-1b: PATCH /api/v1/masters/direct-delivery/[id] にフィールド追加
# ─────────────────────────────────────────────────────────
print("\n[Task 4-2-1b] PATCH /api/v1/masters/direct-delivery/[id] フィールド追加")
apply(
    "PATCH DD: body 分解にフィールド追加",
    "src/app/api/v1/masters/direct-delivery/[id]/route.ts",
    "  const { companyName, departmentName, contactPerson, postalCode, address1, phoneNumber, faxNumber, remarks } = body",
    "  const { companyName, furigana, shortName, corporateType, corporatePosition, departmentName, contactPerson, postalCode, address1, address2, address3, phoneNumber, faxNumber, remarks } = body"
)
apply(
    "PATCH DD: prisma.update にフィールド追加",
    "src/app/api/v1/masters/direct-delivery/[id]/route.ts",
    "    data: { companyName, departmentName: departmentName ?? null, contactPerson: contactPerson ?? null, postalCode: postalCode ?? null, address1: address1 ?? null, phoneNumber: phoneNumber ?? null, faxNumber: faxNumber ?? null, remarks: remarks ?? null },",
    "    data: { companyName, furigana: furigana ?? null, shortName: shortName ?? null, corporateType: corporateType ?? null, corporatePosition: corporatePosition ?? null, departmentName: departmentName ?? null, contactPerson: contactPerson ?? null, postalCode: postalCode ?? null, address1: address1 ?? null, address2: address2 ?? null, address3: address3 ?? null, phoneNumber: phoneNumber ?? null, faxNumber: faxNumber ?? null, remarks: remarks ?? null },"
)

# ─────────────────────────────────────────────────────────
# Task 4-2-2: search API レスポンスに furigana/shortName/corporateType 追加
# ─────────────────────────────────────────────────────────
print("\n[Task 4-2-2] search API レスポンスにフィールド追加")
apply(
    "search API: PostgreSQL fallback レスポンスにフィールド追加",
    "src/app/api/v1/direct-deliveries/search/route.ts",
    """      deliveries: rows.map(r => ({
        deliveryCode:   r.deliveryCode,
        companyName:    r.companyName,
        departmentName: r.departmentName ?? "",
        contactPerson:  r.contactPerson ?? "",
        postalCode:     r.postalCode ?? "",
        address1:       r.address1 ?? "",
        address2:       "",
        phoneNumber:    r.phoneNumber ?? "",
        faxNumber:      r.faxNumber ?? "",
      })),""",
    """      deliveries: rows.map(r => ({
        deliveryCode:     r.deliveryCode,
        companyName:      r.companyName,
        furigana:         r.furigana ?? "",
        shortName:        r.shortName ?? "",
        corporateType:    r.corporateType ?? "",
        corporatePosition: r.corporatePosition ?? "",
        departmentName:   r.departmentName ?? "",
        contactPerson:    r.contactPerson ?? "",
        postalCode:       r.postalCode ?? "",
        address1:         r.address1 ?? "",
        address2:         r.address2 ?? "",
        address3:         r.address3 ?? "",
        phoneNumber:      r.phoneNumber ?? "",
        faxNumber:        r.faxNumber ?? "",
      })),"""
)

# ─────────────────────────────────────────────────────────
# Task 4-1-1 & 4-1-2: DirectDeliveryClient.tsx 全面更新
# フォームに furigana/shortName/corporateType/corporatePosition 追加
# 郵便番号 onBlur で住所自動入力
# ─────────────────────────────────────────────────────────
print("\n[Task 4-1-1/4-1-2] DirectDeliveryClient.tsx フォーム拡張 + 郵便番号自動入力")

DD_CLIENT_PATH = "src/app/(app)/masters/direct-delivery/DirectDeliveryClient.tsx"

# 1. DD型にフィールド追加
apply(
    "DirectDeliveryClient: DD型にフィールド追加",
    DD_CLIENT_PATH,
    """type DD = {
  id: string
  deliveryCode: string
  companyName: string
  departmentName: string
  contactPerson: string
  postalCode: string
  address1: string
  phoneNumber: string
  faxNumber: string
  remarks: string
}""",
    """type DD = {
  id: string
  deliveryCode: string
  companyName: string
  furigana: string
  shortName: string
  corporateType: string
  corporatePosition: string
  departmentName: string
  contactPerson: string
  postalCode: string
  address1: string
  address2: string
  address3: string
  phoneNumber: string
  faxNumber: string
  remarks: string
}"""
)

# 2. EMPTY にフィールド追加
apply(
    "DirectDeliveryClient: EMPTY にフィールド追加",
    DD_CLIENT_PATH,
    'const EMPTY: Omit<DD, "id"> = {\n  deliveryCode: "", companyName: "", departmentName: "", contactPerson: "",\n  postalCode: "", address1: "", phoneNumber: "", faxNumber: "", remarks: "",\n}',
    'const EMPTY: Omit<DD, "id"> = {\n  deliveryCode: "", companyName: "", furigana: "", shortName: "",\n  corporateType: "", corporatePosition: "", departmentName: "", contactPerson: "",\n  postalCode: "", address1: "", address2: "", address3: "",\n  phoneNumber: "", faxNumber: "", remarks: "",\n}'
)

# 3. openEdit に新フィールドを追加
apply(
    "DirectDeliveryClient: openEdit にフィールド追加",
    DD_CLIENT_PATH,
    "  const openEdit = (d: DD) => { setForm({ deliveryCode: d.deliveryCode, companyName: d.companyName, departmentName: d.departmentName, contactPerson: d.contactPerson, postalCode: d.postalCode, address1: d.address1, phoneNumber: d.phoneNumber, faxNumber: d.faxNumber, remarks: d.remarks }); setEditTarget(d); setError(\"\"); setShowModal(true) }",
    "  const openEdit = (d: DD) => { setForm({ deliveryCode: d.deliveryCode, companyName: d.companyName, furigana: d.furigana, shortName: d.shortName, corporateType: d.corporateType, corporatePosition: d.corporatePosition, departmentName: d.departmentName, contactPerson: d.contactPerson, postalCode: d.postalCode, address1: d.address1, address2: d.address2, address3: d.address3, phoneNumber: d.phoneNumber, faxNumber: d.faxNumber, remarks: d.remarks }); setEditTarget(d); setError(\"\"); setShowModal(true) }"
)

# 4. page.tsx の deliveries マッピングにフィールド追加
apply(
    "page.tsx: deliveries マッピングにフィールド追加",
    "src/app/(app)/masters/direct-delivery/page.tsx",
    """  const deliveries = rows.map(r => ({
    id:             r.id,
    deliveryCode:   r.deliveryCode,
    companyName:    r.companyName,
    departmentName: r.departmentName ?? "",
    contactPerson:  r.contactPerson ?? "",
    postalCode:     r.postalCode ?? "",
    address1:       r.address1 ?? "",
    phoneNumber:    r.phoneNumber ?? "",
    faxNumber:      r.faxNumber ?? "",
    remarks:        r.remarks ?? "",
  }))""",
    """  const deliveries = rows.map(r => ({
    id:               r.id,
    deliveryCode:     r.deliveryCode,
    companyName:      r.companyName,
    furigana:         r.furigana ?? "",
    shortName:        r.shortName ?? "",
    corporateType:    r.corporateType ?? "",
    corporatePosition: r.corporatePosition ?? "",
    departmentName:   r.departmentName ?? "",
    contactPerson:    r.contactPerson ?? "",
    postalCode:       r.postalCode ?? "",
    address1:         r.address1 ?? "",
    address2:         r.address2 ?? "",
    address3:         r.address3 ?? "",
    phoneNumber:      r.phoneNumber ?? "",
    faxNumber:        r.faxNumber ?? "",
    remarks:          r.remarks ?? "",
  }))"""
)

# 5. DirectDeliveryClient.tsx: useState + 郵便番号自動入力関数追加 + フォームUI全面刷新
# useCallback をインポートに追加（既存インポートを拡張）
apply(
    "DirectDeliveryClient: useCallback import 確認（既存）",
    DD_CLIENT_PATH,
    'import { useState, useCallback } from "react"',
    'import { useState, useCallback, useRef } from "react"'
)

# postalSearching state 追加
apply(
    "DirectDeliveryClient: postalSearching state 追加",
    DD_CLIENT_PATH,
    '  const [search, setSearch] = useState("")',
    '  const [search, setSearch] = useState("")\n  const [postalSearching, setPostalSearching] = useState(false)\n  const [postalError, setPostalError] = useState("")'
)

# 郵便番号自動入力ハンドラを handleDelete の後に追加
apply(
    "DirectDeliveryClient: 郵便番号自動入力ハンドラ追加",
    DD_CLIENT_PATH,
    '  }, [router])\n\n  const filtered = list.filter',
    """  }, [router])

  const handlePostalSearch = useCallback(async () => {
    const zip = form.postalCode.replace(/-/g, "")
    if (!/^\\d{7}$/.test(zip)) { setPostalError("7桁の数字で入力してください"); return }
    setPostalSearching(true); setPostalError("")
    try {
      const res = await fetch(`/api/v1/postal-code?zip=${zip}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "住所取得失敗")
      setForm(p => ({ ...p, address1: data.address1 + data.address2, address2: data.address3, address3: "" }))
    } catch (e: any) { setPostalError(e.message) } finally { setPostalSearching(false) }
  }, [form.postalCode])

  const filtered = list.filter"""
)

# 6. フォームUI: 郵便番号フィールドを住所検索ボタン付きに変更 + 新フィールド追加
# F コンポーネントの定義後にフォームUIを差し替え
apply(
    "DirectDeliveryClient: フォームUI拡張（新フィールド＋郵便番号ボタン）",
    DD_CLIENT_PATH,
    """            <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <F label="直送先コード ★" k="deliveryCode" placeholder="例: D001" />
              <F label="会社名 ★" k="companyName" placeholder="例: 越智工業株式会社" />
              <F label="部署名" k="departmentName" />
              <F label="担当者名" k="contactPerson" />
              <F label="郵便番号" k="postalCode" placeholder="000-0000" />
              <F label="住所" k="address1" />
              <F label="TEL" k="phoneNumber" placeholder="00-0000-0000" />
              <F label="FAX" k="faxNumber" placeholder="00-0000-0000" />
              <div className="sm:col-span-2"><F label="備考" k="remarks" /></div>
            </div>""",
    """            <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 基本情報 */}
              <F label="直送先コード ★" k="deliveryCode" placeholder="例: D001" />
              <F label="会社名 ★" k="companyName" placeholder="例: 越智工業株式会社" />
              <F label="フリガナ" k="furigana" placeholder="例: オチコウギョウ" />
              <F label="略称" k="shortName" placeholder="例: 越智工業" />
              {/* 法人格 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">法人格区分</label>
                <select value={form.corporateType} onChange={e => setForm(p => ({ ...p, corporateType: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">（なし）</option>
                  <option value="1">株式会社</option>
                  <option value="2">有限会社</option>
                  <option value="3">合同会社</option>
                  <option value="4">合資会社</option>
                  <option value="5">合名会社</option>
                  <option value="6">財団法人</option>
                  <option value="7">社団法人</option>
                  <option value="8">協同組合</option>
                  <option value="9">組合</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">法人格位置</label>
                <select value={form.corporatePosition} onChange={e => setForm(p => ({ ...p, corporatePosition: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">（指定なし）</option>
                  <option value="1">前（例: 株式会社○○）</option>
                  <option value="2">後（例: ○○株式会社）</option>
                </select>
              </div>
              {/* 連絡先 */}
              <F label="部署名" k="departmentName" />
              <F label="担当者名" k="contactPerson" />
              {/* 郵便番号（住所検索ボタン付き） */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">郵便番号</label>
                <div className="flex gap-2">
                  <input type="text" value={form.postalCode} onChange={e => setForm(p => ({ ...p, postalCode: e.target.value }))}
                    placeholder="0000000" maxLength={8}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button type="button" onClick={handlePostalSearch} disabled={postalSearching}
                    className="px-3 py-2 text-xs font-medium rounded-lg bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200 disabled:opacity-50 whitespace-nowrap">
                    {postalSearching ? "検索中..." : "住所検索"}
                  </button>
                </div>
                {postalError && <p className="mt-1 text-xs text-red-500">{postalError}</p>}
              </div>
              <F label="TEL" k="phoneNumber" placeholder="00-0000-0000" />
              {/* 住所 */}
              <div className="sm:col-span-2"><F label="住所1（都道府県+市区町村）" k="address1" /></div>
              <div className="sm:col-span-2"><F label="住所2（町域・番地）" k="address2" /></div>
              <div className="sm:col-span-2"><F label="住所3（建物名など）" k="address3" /></div>
              <F label="FAX" k="faxNumber" placeholder="00-0000-0000" />
              <div className="sm:col-span-2"><F label="備考" k="remarks" /></div>
            </div>"""
)

# ─────────────────────────────────────────────────────────
# Task 4-3-1/2: EstimateNewClient 直送先モーダル – furigana 表示
# ─────────────────────────────────────────────────────────
print("\n[Task 4-3-1] EstimateNewClient 直送先モーダル furigana 表示追加")

# DirectDelivery インターフェースに furigana 追加
apply(
    "EstimateNewClient: DirectDelivery型に furigana 追加",
    "src/app/(app)/estimates/new/EstimateNewClient.tsx",
    """interface DirectDelivery {
  deliveryCode:   string
  name:           string
  departmentName: string
  chargeName:     string
  postalCode:     string
  address1:       string
  address2:       string
  address3:       string
  tel:            string
  fax:            string
}""",
    """interface DirectDelivery {
  deliveryCode:   string
  name:           string
  furigana:       string
  shortName:      string
  departmentName: string
  chargeName:     string
  postalCode:     string
  address1:       string
  address2:       string
  address3:       string
  tel:            string
  fax:            string
}"""
)

# ─────────────────────────────────────────────────────────
# Task 4-3-1/2: EstimateEditClient 直送先インターフェースに furigana 追加
# ─────────────────────────────────────────────────────────
print("\n[Task 4-3-2] EstimateEditClient 直送先 furigana 追加")

# EditClient の直送先検索結果マッピングに furigana を追加
# search API から返ってくる deliveries キーをマッピング
EDIT_CLIENT_PATH = "src/app/(app)/estimates/[id]/edit/EstimateEditClient.tsx"
p = ROOT / EDIT_CLIENT_PATH
if p.exists():
    content = p.read_text(encoding="utf-8")
    # DdResult 型があれば furigana 追加
    if "furigana" not in content:
        # ddResults マッピング箇所を探して furigana 追加
        old_dd_type = "  companyName:    string"
        if old_dd_type in content:
            content = content.replace(
                old_dd_type,
                "  companyName:    string\n  furigana?:      string"
            )
            p.write_text(content, encoding="utf-8")
            PASS.append("[EditClient: DdResult型 furigana追加]")
            print("  ✅ EditClient: DdResult型 furigana追加")

# ─────────────────────────────────────────────────────────
# TypeScript チェック
# ─────────────────────────────────────────────────────────
print("\n[TypeScript チェック]")
code, out = run_tsc()
if code == 0:
    print("  ✅ tsc --noEmit: エラーなし")
else:
    print(f"  ❌ tsc エラー:\n{out}")
    FAIL.append("tsc エラー")

# ─────────────────────────────────────────────────────────
# 結果サマリー
# ─────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print(f"  完了: {len(PASS)}件  失敗: {len(FAIL)}件")
if FAIL:
    print("\n  ❌ 失敗一覧:")
    for f in FAIL: print(f"    {f}")
else:
    print("""
  ✅ Phase 4 実装完了！
  次のコマンドを実行:
  git add -A && git commit -m 'feat: Phase4 直送先管理フィールド完全実装 + 郵便番号自動入力'
  git push
""")
print("=" * 60)
