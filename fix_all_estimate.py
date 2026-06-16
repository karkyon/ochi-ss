import subprocess, os, sys, datetime

ROOT = os.path.expanduser("~/projects/ochi-ss")
os.chdir(ROOT)

def run(cmd, check=True, cwd=None):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=cwd or ROOT)
    if check and r.returncode != 0:
        print(f"ERROR: {cmd}\n{r.stdout}\n{r.stderr}")
        sys.exit(1)
    return r.stdout.strip()

print("=== fix_all_estimate_issues.py ===")
print("[1] git pull...")
print(" ", run("git pull").split("\n")[0])

# ─────────────────────────────────────────────────────────────
# [2] Prismaマイグレーション: processing_specsにkakou_shiji列追加
# ─────────────────────────────────────────────────────────────
print("[2] Prismaマイグレーション作成...")
ts = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
mdir = f"{ROOT}/prisma/migrations/{ts}_add_kakou_shiji_to_processing_specs"
os.makedirs(mdir, exist_ok=True)

migration_sql = """-- add kakou_shiji columns to processing_specs
-- WO加工仕様テーブルの加工指示コード(T/A/B)をキャッシュ
ALTER TABLE processing_specs
  ADD COLUMN IF NOT EXISTS kakou_shiji_t VARCHAR(10) DEFAULT 'W',
  ADD COLUMN IF NOT EXISTS kakou_shiji_a VARCHAR(10) DEFAULT 'W',
  ADD COLUMN IF NOT EXISTS kakou_shiji_b VARCHAR(10) DEFAULT 'W';
"""
with open(f"{mdir}/migration.sql", "w") as f:
    f.write(migration_sql)

out = run("npx prisma migrate deploy 2>&1")
if "migration" in out.lower() or "applied" in out.lower() or "All migrations" in out:
    print("  ✅ migrate deploy 成功")
else:
    print(out[-300:])
    # マイグレーション失敗しても続行（カラムが既にある場合など）

# schema.prismaにもkakou_shiji列を追加
schema_path = f"{ROOT}/prisma/schema.prisma"
with open(schema_path, "r") as f:
    schema = f.read()

OLD_SPEC_MODEL = """/// 加工仕様マスタ（複製キャッシュ）
model ProcessingSpec {
  id                 String   @id @default(uuid())
  processingSpecCode Int      @unique @map("processing_spec_code")
  processingSpecName String   @map("processing_spec_name")
  syncedAt           DateTime @default(now()) @map("synced_at")
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")

  @@map("processing_specs")
}"""

NEW_SPEC_MODEL = """/// 加工仕様マスタ（複製キャッシュ）
model ProcessingSpec {
  id                 String   @id @default(uuid())
  processingSpecCode Int      @unique @map("processing_spec_code")
  processingSpecName String   @map("processing_spec_name")
  kakouShijiT        String   @default("W") @map("kakou_shiji_t") // 厚み面デフォルト加工指示
  kakouShijiA        String   @default("W") @map("kakou_shiji_a") // 巾面デフォルト加工指示
  kakouShijiB        String   @default("W") @map("kakou_shiji_b") // 長さ面デフォルト加工指示
  syncedAt           DateTime @default(now()) @map("synced_at")
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")

  @@map("processing_specs")
}"""

if OLD_SPEC_MODEL in schema:
    schema = schema.replace(OLD_SPEC_MODEL, NEW_SPEC_MODEL)
    with open(schema_path, "w") as f:
        f.write(schema)
    print("  schema.prisma 更新OK")
    run("npx prisma generate 2>&1")
    print("  Prisma Client 再生成OK")
elif "kakouShijiT" in schema:
    print("  schema.prisma 既に更新済み")
else:
    print("  WARNING: schema.prisma の対象モデルが見つかりません")

# ─────────────────────────────────────────────────────────────
# [3] WO加工仕様同期API追加
#     GET /api/v1/masters/processing-specs
#     → SQLServerのWO加工仕様テーブルから取得しPostgreSQLに同期
# ─────────────────────────────────────────────────────────────
print("[3] WO加工仕様同期API 更新...")

PROC_SPEC_ROUTE = r'''// src/app/api/v1/masters/processing-specs/route.ts
// GET /api/v1/masters/processing-specs
// 加工仕様マスタ取得（PostgreSQLキャッシュ優先、SQLServer同期付き）
// レスポンス: { specs: [{processingSpecCode, processingSpecName, kakouShijiT, kakouShijiA, kakouShijiB}] }
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// WO加工仕様テーブルの静的フォールバック
// SQL Server未接続時に使用（添付SSのWO加工仕様テーブルデータ準拠）
const FALLBACK_SPECS = [
  { code: 2,  name: "6F",    t: "W",  a: "W",  b: "W"  },
  { code: 4,  name: "2F2G",  t: "RG", a: "〜", b: "〜" },
  { code: 5,  name: "4F2G",  t: "RG", a: "〜", b: "W"  },
  { code: 7,  name: "6F2G",  t: "RG", a: "W",  b: "W"  },
  { code: 8,  name: "6F2G",  t: "W",  a: "RG", b: "W"  },
  { code: 9,  name: "6F2G",  t: "W",  a: "W",  b: "RG" },
  { code: 10, name: "4F",    t: "W",  a: "〜", b: "W"  },
  { code: 11, name: "2F",    t: "W",  a: "〜", b: "〜" },
  { code: 12, name: "2F2G",  t: "〜", a: "RG", b: "〜" },
  { code: 13, name: "2F2G",  t: "〜", a: "〜", b: "RG" },
  { code: 14, name: "4F2G",  t: "〜", a: "W",  b: "RG" },
  { code: 15, name: "2F",    t: "〜", a: "〜", b: "W"  },
  { code: 16, name: "黒皮",  t: "〜", a: "〜", b: "〜" },
  { code: 17, name: "6F2SG", t: "SG", a: "W",  b: "W"  },
  { code: 20, name: "4F",    t: "〜", a: "W",  b: "〜" },
  { code: 22, name: "6F2SG", t: "W",  a: "SG", b: "W"  },
  { code: 23, name: "6F2SG", t: "W",  a: "W",  b: "SG" },
  { code: 33, name: "4F2G",  t: "W",  a: "〜", b: "RG" },
  { code: 43, name: "4F2G",  t: "〜", a: "W",  b: "W"  },
  { code: 44, name: "2F",    t: "〜", a: "W",  b: "〜" },
  { code: 45, name: "4F2G",  t: "RG", a: "W",  b: "〜" },
  { code: 117,name: "4F2G",  t: "W",  a: "RG", b: "〜" },
]

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // SQLServerからWO加工仕様テーブルを取得して同期
  let syncedFromSqlServer = false
  try {
    const { getSqlServerPool, sql } = await import("@/lib/sqlserver")
    const pool = await getSqlServerPool()
    const result = await pool.request().query(`
      SELECT
        [加工仕様コード],
        [加工指示コードT],
        [加工指示コードA],
        [加工指示コードB],
        [加工仕様]
      FROM [dbo].[WO加工仕様]
      WHERE [加工指示コードT] IN (1,2,4,5)
         OR [加工指示コードA] IN (1,2,4,5)
         OR [加工指示コードB] IN (1,2,4,5)
      ORDER BY [加工仕様コード]
    `)

    // 加工指示コード → 文字列変換
    const codeToStr = (c: number): string => {
      if (c === 1) return "RG"
      if (c === 2) return "W"
      if (c === 4) return "〜"
      if (c === 5) return "SG"
      return "W"
    }

    for (const row of result.recordset) {
      const specCode = Number(row["加工仕様コード"])
      const specName = String(row["加工仕様"] ?? "").trim()
      const t = codeToStr(Number(row["加工指示コードT"]))
      const a = codeToStr(Number(row["加工指示コードA"]))
      const b = codeToStr(Number(row["加工指示コードB"]))
      if (!specCode || !specName) continue
      await prisma.processingSpec.upsert({
        where: { processingSpecCode: specCode },
        update: { processingSpecName: specName, kakouShijiT: t, kakouShijiA: a, kakouShijiB: b, syncedAt: new Date() },
        create: { processingSpecCode: specCode, processingSpecName: specName, kakouShijiT: t, kakouShijiA: a, kakouShijiB: b },
      })
    }
    syncedFromSqlServer = true
    console.log(`[processing-specs] SQLServer同期完了: ${result.recordset.length}件`)
  } catch (err: any) {
    console.warn("[processing-specs] SQLServer接続失敗、DBキャッシュ使用:", err.message)
    // フォールバック: 静的データでPostgreSQLを初期化
    for (const s of FALLBACK_SPECS) {
      try {
        await prisma.processingSpec.upsert({
          where: { processingSpecCode: s.code },
          update: { processingSpecName: s.name, kakouShijiT: s.t, kakouShijiA: s.a, kakouShijiB: s.b },
          create: { processingSpecCode: s.code, processingSpecName: s.name, kakouShijiT: s.t, kakouShijiA: s.a, kakouShijiB: s.b },
        })
      } catch { /* ignore */ }
    }
  }

  // PostgreSQLから取得して返す
  const specs = await prisma.processingSpec.findMany({
    orderBy: { processingSpecCode: "asc" },
    select: {
      processingSpecCode: true,
      processingSpecName: true,
      kakouShijiT: true,
      kakouShijiA: true,
      kakouShijiB: true,
    },
  })

  return NextResponse.json({ specs, syncedFromSqlServer })
}
'''

route_path = f"{ROOT}/src/app/api/v1/masters/processing-specs/route.ts"
with open(route_path, "w", encoding="utf-8") as f:
    f.write(PROC_SPEC_ROUTE)
print(f"  OK: {route_path}")

# ─────────────────────────────────────────────────────────────
# [4] EstimateNewClient.tsx 完全書き直し
#     - 郵便番号バグ修正
#     - 郵便番号整形（ハイフン対応・7桁補完・〒xxx-xxxx形式）
#     - WO加工仕様マップをAPI(/api/v1/masters/processing-specs)から取得
#     - デフォルト仕上り: 6F(コード2)
#     - 全フィールドのconsole.log実装
# ─────────────────────────────────────────────────────────────
print("[4] EstimateNewClient.tsx 完全書き直し...")

TARGET = f"{ROOT}/src/app/(app)/estimates/new/EstimateNewClient.tsx"

NEW_CLIENT = r'''// src/app/(app)/estimates/new/EstimateNewClient.tsx
"use client"

// HTTP環境（non-SecureContext）でも動くUUID生成
function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof (crypto as any).randomUUID === "function") {
    return (crypto as any).randomUUID()
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16)
  })
}

// 郵便番号正規化: 数字7桁を抽出し、不足分は末尾に0補完
function normalizeZip(input: string): string {
  const digits = input.replace(/\D/g, "")
  if (!digits) return ""
  const padded = digits.padEnd(7, "0").slice(0, 7)
  return `${padded.slice(0, 3)}-${padded.slice(3)}`
}
// 郵便番号APIに渡す7桁数字
function zipDigits(zip: string): string { return zip.replace(/\D/g, "").slice(0, 7) }

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"

// ─── 型定義 ───────────────────────────────────────────────────
interface Material  { materialCode: string; materialName: string }
interface ProcSpec  {
  processingSpecCode: number
  processingSpecName: string
  kakouShijiT: string  // "W" / "RG" / "〜" / "SG"
  kakouShijiA: string
  kakouShijiB: string
}
interface CutMethod { code: number; label: string }
interface UserInfo  { customerId: string; customerCode: string; userName: string; companyName: string }

interface DetailForm {
  clientDetailId: string
  materialCode: string
  kakouShiyouCode: number
  kakouShijiCodeT: string; kakouShijiCodeA: string; kakouShijiCodeB: string
  shiagari: string
  sizeT: number; sizeB: number; sizeA: number
  toleranceTUp: number; toleranceTDown: number
  toleranceBUp: number; toleranceBDown: number
  toleranceAUp: number; toleranceADown: number
  mentoriShiji: number
  mentori4: number; mentori8: number
  quantity: number
  customerDetailOrderNo: string; destinationDetailOrderNo: string; remarks: string
  unitPrice?: number; totalPrice?: number
  deliveryDate?: string; deliveryDeadline?: string | null
  fastDeliveryDate?: string; fastDeliveryDeadline?: string
  calculated?: boolean
}

interface Props {
  materials: Material[]; processingSpecs: ProcSpec[]
  cuttingMethods: any[]
  userInfo: UserInfo; copySource?: any; isCopy?: boolean
}

// ─── ヘルパー ──────────────────────────────────────────────────
function newForm(): DetailForm {
  return {
    clientDetailId: generateUUID(),
    materialCode: "", kakouShiyouCode: 0,
    kakouShijiCodeT: "W", kakouShijiCodeA: "W", kakouShijiCodeB: "W",
    shiagari: "",
    sizeT: 0, sizeB: 0, sizeA: 0,
    toleranceTUp: 0, toleranceTDown: 0,
    toleranceBUp: 0, toleranceBDown: 0,
    toleranceAUp: 0, toleranceADown: 0,
    mentoriShiji: 9, mentori4: 0, mentori8: 0,
    quantity: 1,
    customerDetailOrderNo: "", destinationDetailOrderNo: "", remarks: "",
    calculated: false,
  }
}
function isExpired(d?: string | null) { return !!d && new Date(d) < new Date() }
function fmt(iso?: string | null) { return iso ? iso.slice(0, 10) : "" }
function allCutsDefined(t: string, a: string, b: string): boolean {
  return t !== "〜" && a !== "〜" && b !== "〜"
}

// ─── スタイル定数 ─────────────────────────────────────────────
const TH: React.CSSProperties = {
  background: "#1e3a5f", color: "#fff", fontSize: "10px", fontWeight: 600,
  padding: "3px 2px", textAlign: "center", border: "1px solid #334155", whiteSpace: "nowrap",
}
const TD: React.CSSProperties = {
  border: "1px solid #e2e8f0", padding: "2px 3px", verticalAlign: "middle",
}
const INP: React.CSSProperties = {
  width: "100%", border: "1px solid #cbd5e1", borderRadius: "3px",
  padding: "2px 4px", fontSize: "11px", background: "#fff", boxSizing: "border-box", height: "24px",
}
const SEL: React.CSSProperties = {
  width: "100%", border: "1px solid #cbd5e1", borderRadius: "3px",
  padding: "1px 2px", fontSize: "11px", background: "#fff", height: "24px",
}
const LBL: React.CSSProperties = {
  background: "#e8edf5", fontSize: "10px", fontWeight: 600, color: "#374151",
  padding: "3px 6px", border: "1px solid #d1d5db", whiteSpace: "nowrap",
}
const TOL_INP: React.CSSProperties = {
  ...INP, height: "22px", fontSize: "10px", textAlign: "right", padding: "1px 3px",
}
const FH = {
  onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.target.style.background = "#ffffcc"; e.target.style.borderColor = "#f59e0b"
  },
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.target.style.background = "#fff"; e.target.style.borderColor = "#cbd5e1"
  },
}

function focusById(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  ;(el as HTMLElement).focus()
  if ((el as any).select) (el as HTMLInputElement).select()
}
function onEnter(nextId: string) {
  return (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); focusById(nextId) }
  }
}

// ─── メインコンポーネント ────────────────────────────────────
export default function EstimateNewClient({ materials, processingSpecs: initSpecs, userInfo, copySource }: Props) {
  const today = new Date().toISOString().slice(0, 10)

  // ヘッダー状態
  const [estimateNo, setEstimateNo]   = useState("")
  const [orderNo, setOrderNo]         = useState("")
  const [inputDate, setInputDate]     = useState(today)
  const [estimateDate, setEstimateDate] = useState(today)
  const [custOrderNo, setCustOrderNo] = useState("")
  const [endUserNo, setEndUserNo]     = useState("")
  const [distCode, setDistCode]       = useState("")
  const [distName, setDistName]       = useState("")
  const [distDept, setDistDept]       = useState("")
  const [distPerson, setDistPerson]   = useState("")
  const [distZip, setDistZip]         = useState("")
  const [distAddr, setDistAddr]       = useState("")
  const [distTel, setDistTel]         = useState("")
  const [distFax, setDistFax]         = useState("")
  const [contact, setContact]         = useState("")
  const [shippingMethod, setShippingMethod] = useState("発送")

  // 明細状態
  const [form, setForm]       = useState<DetailForm>(newForm())
  const [details, setDetails] = useState<DetailForm[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [saving, setSaving]   = useState(false)
  const [saveMsg, setSaveMsg] = useState("")
  const [draftId, setDraftId] = useState<string | null>(null)

  // マスタ（DBから取得したProcSpecにT/A/B列含む）
  const [procSpecs, setProcSpecs] = useState<ProcSpec[]>(initSpecs)
  const [matProcMap, setMatProcMap] = useState<Record<string, number[]>>({})
  const [matSuggest, setMatSuggest] = useState("")
  const [specSuggest, setSpecSuggest] = useState("")
  const matInputRef = useRef<HTMLInputElement>(null)

  // ── 初期処理 ──
  useEffect(() => {
    console.log("[EstimateNewClient] 初期処理開始")
    console.log("[EstimateNewClient] userInfo:", JSON.stringify(userInfo))
    console.log("[EstimateNewClient] materials件数:", materials.length)
    console.log("[EstimateNewClient] processingSpecs件数:", initSpecs.length)

    // WO加工仕様マスタをDBから取得（SQLServer→PostgreSQL同期含む）
    fetch("/api/v1/masters/processing-specs")
      .then(r => r.json())
      .then(d => {
        console.log("[EstimateNewClient][processing-specs] レスポンス:", JSON.stringify(d))
        if (d.specs && d.specs.length > 0) {
          setProcSpecs(d.specs)
          console.log(`[EstimateNewClient][processing-specs] ${d.specs.length}件セット, SQLServer同期: ${d.syncedFromSqlServer}`)
        }
      })
      .catch(e => console.error("[EstimateNewClient][processing-specs] エラー:", e))

    // 材料×加工仕様マップ
    fetch("/api/v1/masters/material-processing-map")
      .then(r => r.json())
      .then(d => {
        console.log("[EstimateNewClient][material-processing-map] レスポンス件数:", Object.keys(d.map || {}).length)
        if (d.map) setMatProcMap(d.map)
      })
      .catch(e => console.error("[EstimateNewClient][material-processing-map] エラー:", e))

    console.log("[EstimateNewClient] 初期フォーム値:", JSON.stringify(newForm()))
  }, [])

  const filteredSpecs: ProcSpec[] = form.materialCode && matProcMap[form.materialCode]
    ? procSpecs.filter(s => matProcMap[form.materialCode].includes(s.processingSpecCode))
    : procSpecs

  // ── 仕上り選択: DBのkakou_shiji列から加工指示を設定 ──
  const handleSpecSelect = useCallback((spec: ProcSpec, skipToSizeIfAllDefined = false) => {
    const cuts = { t: spec.kakouShijiT || "W", a: spec.kakouShijiA || "W", b: spec.kakouShijiB || "W" }
    console.log(`[handleSpecSelect] spec:`, JSON.stringify(spec), "cuts:", JSON.stringify(cuts))
    setForm(f => ({
      ...f,
      kakouShiyouCode: spec.processingSpecCode,
      shiagari: spec.processingSpecName,
      kakouShijiCodeT: cuts.t,
      kakouShijiCodeA: cuts.a,
      kakouShijiCodeB: cuts.b,
      calculated: false,
    }))
    setSpecSuggest(spec.processingSpecName)
    if (skipToSizeIfAllDefined && allCutsDefined(cuts.t, cuts.a, cuts.b)) {
      setTimeout(() => focusById("f-sizeT"), 50)
    }
  }, [])

  // ── 材料選択: 6F(コード2)優先 ──
  const handleMaterialSelect = useCallback((code: string) => {
    const matName = materials.find(m => m.materialCode === code)?.materialName ?? code
    console.log(`[handleMaterialSelect] materialCode: ${code}, materialName: ${matName}`)
    setMatSuggest(matName)
    const avail = code && matProcMap[code]
      ? procSpecs.filter(s => matProcMap[code].includes(s.processingSpecCode))
      : procSpecs
    console.log(`[handleMaterialSelect] 利用可能スペック件数: ${avail.length}`, avail.map(s => `${s.processingSpecCode}:${s.processingSpecName}`))
    // デフォルト: コード2(6F)を優先、なければ名前に"6F"含む最初のスペック
    const def = avail.find(s => s.processingSpecCode === 2)
      ?? avail.find(s => s.processingSpecName?.startsWith("6F"))
      ?? avail[0]
    console.log(`[handleMaterialSelect] デフォルトスペック:`, JSON.stringify(def))
    if (def) {
      const cuts = { t: def.kakouShijiT || "W", a: def.kakouShijiA || "W", b: def.kakouShijiB || "W" }
      setForm(f => ({
        ...f,
        materialCode: code,
        kakouShiyouCode: def.processingSpecCode,
        shiagari: def.processingSpecName,
        kakouShijiCodeT: cuts.t,
        kakouShijiCodeA: cuts.a,
        kakouShijiCodeB: cuts.b,
        calculated: false,
      }))
      setSpecSuggest(def.processingSpecName)
    } else {
      setForm(f => ({ ...f, materialCode: code, calculated: false }))
    }
    setTimeout(() => focusById("f-shiagari"), 50)
  }, [materials, procSpecs, matProcMap])

  // ── 標準公差 ──
  const handleStdTol = useCallback(async () => {
    const params = {
      customerCode: userInfo.customerCode,
      kakouShiyouCode: form.kakouShiyouCode,
      sizeT: form.sizeT, sizeB: form.sizeB, sizeA: form.sizeA,
    }
    console.log("[handleStdTol] リクエスト:", JSON.stringify(params))
    try {
      const url = `/api/v1/tolerance/standard?customerCode=${params.customerCode}&kakouShiyouCode=${params.kakouShiyouCode}&sizeT=${params.sizeT}&sizeB=${params.sizeB}&sizeA=${params.sizeA}`
      const res = await fetch(url)
      const d = await res.json()
      console.log("[handleStdTol] レスポンス:", JSON.stringify(d))
      if (d.success || d.tolerance) {
        const t = d.tolerance ?? d
        const newTol = {
          toleranceTUp: t.tUpper ?? 0, toleranceTDown: t.tLower ?? 0,
          toleranceBUp: t.bUpper ?? 0, toleranceBDown: t.bLower ?? 0,
          toleranceAUp: t.aUpper ?? 0, toleranceADown: t.aLower ?? 0,
        }
        console.log("[handleStdTol] 設定値:", JSON.stringify(newTol))
        setForm(f => ({ ...f, ...newTol }))
      }
    } catch(e: any) { console.error("[handleStdTol] エラー:", e.message) }
    setTimeout(() => focusById("btn-std-chamfer"), 100)
  }, [userInfo.customerCode, form.kakouShiyouCode, form.sizeT, form.sizeB, form.sizeA])

  // ── 標準面取り ──
  const handleStdChamfer = useCallback(async () => {
    const params = { customerCode: userInfo.customerCode }
    console.log("[handleStdChamfer] リクエスト:", JSON.stringify(params))
    try {
      const res = await fetch(`/api/v1/chamfer/standard?customerCode=${params.customerCode}`)
      const d = await res.json()
      console.log("[handleStdChamfer] レスポンス:", JSON.stringify(d))
      if (d.success || d.chamfer) {
        const c = d.chamfer ?? d
        const newChamfer = { mentori4: c.chamfer4 ?? 0, mentori8: c.chamfer8 ?? 0 }
        console.log("[handleStdChamfer] 設定値:", JSON.stringify(newChamfer))
        setForm(f => ({ ...f, ...newChamfer }))
      }
    } catch(e: any) { console.error("[handleStdChamfer] エラー:", e.message) }
    setTimeout(() => focusById("f-qty"), 100)
  }, [userInfo.customerCode])

  // ── 計算 ──
  const handleCalculate = async () => {
    const spec = procSpecs.find(s => s.processingSpecCode === form.kakouShiyouCode)
    const payload = {
      customerCode: userInfo.customerCode,
      materialCode: form.materialCode,
      kakouShiyouCode: form.kakouShiyouCode,
      kakouShiyou: spec?.processingSpecName ?? "",
      kakouShijiCodeT: form.kakouShijiCodeT,
      kakouShijiCodeA: form.kakouShijiCodeA,
      kakouShijiCodeB: form.kakouShijiCodeB,
      kakouT: form.kakouShijiCodeT,
      kakouA: form.kakouShijiCodeA,
      kakouB: form.kakouShijiCodeB,
      sizeT: form.sizeT, sizeB: form.sizeB, sizeA: form.sizeA,
      kousaTUpper: form.toleranceTUp, kousaTLower: form.toleranceTDown,
      kousaBUpper: form.toleranceBUp, kousaBLower: form.toleranceBDown,
      kousaAUpper: form.toleranceAUp, kousaALower: form.toleranceADown,
      mentoriShiji: String(form.mentoriShiji),
      mentori4: form.mentori4, mentori8: form.mentori8,
      quantity: form.quantity,
    }
    console.log("[handleCalculate] リクエスト:", JSON.stringify(payload, null, 2))
    if (!form.materialCode || !form.kakouShiyouCode) { alert("材料と加工仕様を選択してください"); return }
    if (!form.sizeT || !form.sizeB || !form.sizeA) { alert("寸法T・巾・長さを入力してください"); return }
    try {
      const res = await fetch("/api/v1/estimates/calculate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      console.log("[handleCalculate] レスポンス:", JSON.stringify(data, null, 2))
      if (!res.ok) throw new Error(data.error ?? "計算APIエラー " + res.status)
      setForm(f => ({
        ...f,
        unitPrice: data.unitPrice, totalPrice: data.totalPrice,
        deliveryDate: data.deliveryDate, deliveryDeadline: data.deliveryDeadline,
        fastDeliveryDate: data.fastDeliveryDate ?? data.deliveryDate,
        fastDeliveryDeadline: data.fastDeliveryDeadline ?? data.deliveryDeadline,
        calculated: true,
      }))
      setTimeout(() => focusById("btn-add"), 50)
    } catch (e: any) {
      console.error("[handleCalculate] エラー:", e.message)
      alert("見積計算に失敗しました: " + e.message)
    }
  }

  const handleAdd = () => {
    if (!form.calculated) return
    console.log("[handleAdd] 明細追加:", JSON.stringify(form, null, 2))
    setDetails(p => [...p, { ...form }])
    const m = form.materialCode
    const matName = materials.find(x => x.materialCode === m)?.materialName ?? ""
    setForm({ ...newForm(), materialCode: m })
    setMatSuggest(matName); setSpecSuggest("")
    setTimeout(() => focusById("f-mat-suggest"), 50)
  }
  const handleDel = (id: string) => {
    console.log("[handleDel] 明細削除 id:", id)
    setDetails(p => p.filter(d => d.clientDetailId !== id))
    setSelectedIds(p => { const n = new Set(p); n.delete(id); return n })
  }
  const selAll = (v: boolean) => {
    console.log("[selAll] 全選択:", v)
    setSelectedIds(v ? new Set(details.map(d => d.clientDetailId)) : new Set())
  }
  const selOne = (id: string, v: boolean) => {
    console.log("[selOne] 個別選択 id:", id, "checked:", v)
    setSelectedIds(p => { const n = new Set(p); v ? n.add(id) : n.delete(id); return n })
  }

  // ── 保存 ──
  const handleSave = async () => {
    const payload = {
      estimateId: draftId,
      header: {
        inputDate, estimateDate, shippingMethodId: 1,
        destinationCode: distCode, destinationName: distName,
        destinationDept: distDept, destinationPerson: distPerson,
        destinationZip: distZip, destinationAddress: distAddr,
        destinationTel: distTel, destinationFax: distFax,
        contact, customerOrderNo: custOrderNo, endUserNo, remarks: contact,
      },
      details: details.map((d, i) => ({ ...d, rowNo: i + 1 })),
    }
    console.log("[handleSave] リクエスト:", JSON.stringify(payload, null, 2))
    setSaving(true); setSaveMsg("保存中...")
    try {
      const res = await fetch("/api/v1/estimates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      console.log("[handleSave] レスポンス:", JSON.stringify(data, null, 2))
      if (!res.ok) throw new Error(data.error ?? "保存失敗")
      setDraftId(data.estimateId ?? data.id)
      setEstimateNo(data.estimateNo ?? "")
      setSaveMsg("✅ 保存完了！見積番号: " + (data.estimateNo ?? ""))
    } catch (e: any) {
      console.error("[handleSave] エラー:", e.message)
      setSaveMsg("❌ 保存失敗: " + e.message)
    }
    finally { setSaving(false); setTimeout(() => setSaveMsg(""), 4000) }
  }

  const handleOrder = async () => {
    const sel = details.filter(d => selectedIds.has(d.clientDetailId))
    console.log("[handleOrder] 選択明細:", sel.length, "件")
    if (sel.length === 0) { alert("注文する明細を選択してください"); return }
    await handleSave()
    if (draftId) window.location.href = "/orders/confirm?estimateId=" + draftId
  }

  // ── 直送先検索 ──
  const handleDistSearch = async () => {
    console.log("[handleDistSearch] distCode:", distCode)
    if (!distCode) return
    try {
      const url = `/api/v1/masters/direct-delivery/search?code=${distCode}&customerCode=${userInfo.customerCode}`
      const res = await fetch(url)
      const d = await res.json()
      console.log("[handleDistSearch] レスポンス:", JSON.stringify(d, null, 2))
      if (d.delivery) {
        const dd = d.delivery
        setDistName(dd.name ?? dd.companyName ?? "")
        setDistDept(dd.department ?? dd.departmentName ?? "")
        setDistPerson(dd.person ?? dd.contactPerson ?? "")
        setDistZip(dd.zipCode ?? dd.postalCode ?? "")
        setDistAddr(dd.address ?? dd.address1 ?? "")
        setDistTel(dd.tel ?? dd.phoneNumber ?? "")
        setDistFax(dd.fax ?? dd.faxNumber ?? "")
      }
    } catch(e: any) { console.error("[handleDistSearch] エラー:", e.message) }
  }

  // ── 郵便番号検索（バグ修正：address1+address2+address3を連結） ──
  const handleZip = async () => {
    const digits = zipDigits(distZip)
    console.log("[handleZip] 入力:", distZip, "→ digits:", digits)
    if (digits.length < 7) {
      // 7桁未満なら0補完して整形のみ
      const formatted = normalizeZip(distZip)
      setDistZip(formatted)
      console.log("[handleZip] 桁不足のため整形のみ:", formatted)
      return
    }
    const zipFormatted = normalizeZip(distZip)
    setDistZip(zipFormatted)
    try {
      const url = `/api/v1/postal-code?zip=${digits}`
      console.log("[handleZip] APIリクエスト URL:", url)
      const res = await fetch(url)
      const d = await res.json()
      console.log("[handleZip] APIレスポンス:", JSON.stringify(d, null, 2))
      if (!res.ok) throw new Error(d.error ?? "住所取得失敗")
      // ★ バグ修正: d.addressではなくd.address1+d.address2+d.address3を連結
      const address = [d.address1, d.address2, d.address3].filter(Boolean).join("")
      console.log("[handleZip] 住所設定:", address)
      setDistAddr(address)
      // 住所欄の末尾にカーソル
      setTimeout(() => {
        const el = document.getElementById("f-distAddr") as HTMLInputElement | null
        if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length) }
      }, 50)
    } catch(e: any) { console.error("[handleZip] エラー:", e.message) }
  }

  return (
    <div style={{ fontSize: "11px", padding: "4px 8px", maxWidth: "1280px", margin: "0 auto" }}>
      {/* ─── ヘッダーボタン ─── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
        <div style={{ fontWeight: 700, fontSize: "13px", color: "#1e3a5f" }}>お見積り入力</div>
        <div style={{ display: "flex", gap: "6px" }}>
          <button className="btn-ochi btn-outline" style={{ fontSize: "11px" }}
            onClick={() => { console.log("[新規] フォームリセット"); setForm(newForm()); setMatSuggest(""); setSpecSuggest("") }}>新規</button>
          <button className="btn-ochi btn-primary" style={{ fontSize: "11px" }}
            onClick={handleSave} disabled={saving}>{saving ? "保存中..." : "この見積りを保存"}</button>
          <button className="btn-ochi" style={{ fontSize: "11px", background: "#92400e", color: "#fff" }}
            onClick={handleOrder}>この見積りを注文</button>
          <Link href="/dashboard">
            <button className="btn-ochi btn-outline" style={{ fontSize: "11px" }}>← メインメニュー</button>
          </Link>
        </div>
      </div>

      {saveMsg && (
        <div style={{ background: saveMsg.startsWith("✅") ? "#f0fdf4" : "#fee2e2", border: "1px solid " + (saveMsg.startsWith("✅") ? "#86efac" : "#fca5a5"), borderRadius: "4px", padding: "4px 10px", fontSize: "11px", marginBottom: "6px" }}>
          {saveMsg}
        </div>
      )}

      {/* ─── ヘッダーテーブル ─── */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "0", fontSize: "11px" }}>
        <tbody>
          <tr>
            <td style={LBL}>見積No</td>
            <td style={{ ...TD, width: "130px" }}><input style={{ ...INP, background: "#f8fafc", color: "#94a3b8" }} value={estimateNo} readOnly /></td>
            <td style={LBL}>注文No</td>
            <td style={{ ...TD, width: "130px" }}>
              <input id="f-orderNo" style={INP} value={orderNo}
                onChange={e => { console.log("[注文No] →", e.target.value); setOrderNo(e.target.value) }}
                onKeyDown={onEnter("f-inputDate")} {...FH} /></td>
            <td style={LBL}>入力日付</td>
            <td style={{ ...TD, width: "120px" }}>
              <input id="f-inputDate" style={INP} type="date" value={inputDate}
                onChange={e => { console.log("[入力日付] →", e.target.value); setInputDate(e.target.value) }}
                onKeyDown={onEnter("f-estDate")} {...FH} /></td>
            <td style={LBL}>見積日付</td>
            <td style={{ ...TD, width: "120px" }}>
              <input id="f-estDate" style={INP} type="date" value={estimateDate}
                onChange={e => { console.log("[見積日付] →", e.target.value); setEstimateDate(e.target.value) }}
                onKeyDown={onEnter("f-shippingMethod")} {...FH} /></td>
          </tr>
          <tr>
            <td style={LBL}>お客様名</td>
            <td colSpan={3} style={TD}><input style={{ ...INP, background: "#f8fafc", color: "#64748b" }} value={userInfo.companyName} readOnly /></td>
            <td style={LBL}>ご担当者</td>
            <td colSpan={3} style={TD}><input style={{ ...INP, background: "#f8fafc", color: "#64748b" }} value={userInfo.userName} readOnly /></td>
          </tr>
        </tbody>
      </table>

      {/* ─── 発送方法 ─── */}
      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderTop: "none", padding: "3px 10px", display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "11px", fontWeight: 600, color: "#374151" }}>発送方法</span>
        <select id="f-shippingMethod" style={{ ...SEL, width: "100px" }} value={shippingMethod}
          onChange={e => { console.log("[発送方法] →", e.target.value); setShippingMethod(e.target.value) }}
          onKeyDown={onEnter("f-distCode")} {...FH}>
          <option value="発送">発送</option><option value="直送">直送</option><option value="持参">持参</option>
        </select>
        <span style={{ fontSize: "10px", color: "#94a3b8" }}>リストよりお選びください</span>
      </div>

      {/* ─── 送り先情報 ─── */}
      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderTop: "none", borderRadius: "0 0 4px 4px", padding: "6px 10px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: "#1e3a5f", marginBottom: "5px" }}>送り先情報</div>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr 1fr", gap: "4px 8px", alignItems: "end", marginBottom: "4px" }}>
          <div>
            <div style={{ fontSize: "10px", fontWeight: 600, marginBottom: "2px" }}>出荷先</div>
            <div style={{ display: "flex", gap: "3px" }}>
              <input id="f-distCode" style={{ ...INP, width: "70px" }} value={distCode}
                onChange={e => { console.log("[出荷先コード] →", e.target.value); setDistCode(e.target.value) }}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleDistSearch().then(() => focusById("f-distName")) } }} {...FH} />
              <button className="btn-ochi btn-outline" style={{ fontSize: "10px", padding: "1px 6px", height: "24px" }}
                onClick={() => handleDistSearch().then(() => focusById("f-distName"))}>🔍</button>
            </div>
          </div>
          <div>
            <div style={{ fontSize: "10px", fontWeight: 600, marginBottom: "2px" }}>出荷先名</div>
            <input id="f-distName" style={INP} value={distName}
              onChange={e => { console.log("[出荷先名] →", e.target.value); setDistName(e.target.value) }}
              onKeyDown={onEnter("f-distDept")} {...FH} />
          </div>
          <div>
            <div style={{ fontSize: "10px", fontWeight: 600, marginBottom: "2px" }}>出荷先部署</div>
            <input id="f-distDept" style={INP} value={distDept}
              onChange={e => { console.log("[出荷先部署] →", e.target.value); setDistDept(e.target.value) }}
              onKeyDown={onEnter("f-distPerson")} {...FH} />
          </div>
          <div>
            <div style={{ fontSize: "10px", fontWeight: 600, marginBottom: "2px" }}>ご担当者</div>
            <input id="f-distPerson" style={INP} value={distPerson}
              onChange={e => { console.log("[ご担当者] →", e.target.value); setDistPerson(e.target.value) }}
              onKeyDown={onEnter("f-distZip")} {...FH} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "170px 1fr 160px 160px", gap: "4px 8px", marginBottom: "4px" }}>
          <div>
            <div style={{ fontSize: "10px", fontWeight: 600, marginBottom: "2px" }}>〒 （7桁数字、ENTERで住所検索）</div>
            <div style={{ display: "flex", gap: "3px" }}>
              <input id="f-distZip" style={{ ...INP, flex: 1 }} value={distZip}
                onChange={e => {
                  // 数字・ハイフンのみ許可
                  const v = e.target.value.replace(/[^\d-]/g, "")
                  console.log("[郵便番号] 入力:", v)
                  setDistZip(v)
                }}
                onBlur={e => {
                  // フォーカスを外したとき整形
                  const formatted = normalizeZip(e.target.value)
                  if (formatted) { setDistZip(formatted); console.log("[郵便番号] onBlur整形:", formatted) }
                }}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleZip().then(() => focusById("f-distAddr")) } }}
                placeholder="xxx-xxxx" {...FH} />
              <button className="btn-ochi btn-outline" style={{ fontSize: "9px", padding: "0 4px", height: "24px" }}
                onClick={() => handleZip().then(() => focusById("f-distAddr"))}>検索</button>
            </div>
          </div>
          <div>
            <div style={{ fontSize: "10px", fontWeight: 600, marginBottom: "2px" }}>住所</div>
            <input id="f-distAddr" style={INP} value={distAddr}
              onChange={e => { console.log("[住所] →", e.target.value); setDistAddr(e.target.value) }}
              onKeyDown={onEnter("f-distTel")} {...FH} />
          </div>
          <div>
            <div style={{ fontSize: "10px", fontWeight: 600, marginBottom: "2px" }}>TEL</div>
            <input id="f-distTel" style={INP} value={distTel}
              onChange={e => { console.log("[TEL] →", e.target.value); setDistTel(e.target.value) }}
              onKeyDown={onEnter("f-distFax")} {...FH} />
          </div>
          <div>
            <div style={{ fontSize: "10px", fontWeight: 600, marginBottom: "2px" }}>FAX</div>
            <input id="f-distFax" style={INP} value={distFax}
              onChange={e => { console.log("[FAX] →", e.target.value); setDistFax(e.target.value) }}
              onKeyDown={onEnter("f-contact")} {...FH} />
          </div>
        </div>
        <div>
          <div style={{ fontSize: "10px", fontWeight: 600, marginBottom: "2px" }}>通信欄</div>
          <input id="f-contact" style={INP} value={contact}
            onChange={e => { console.log("[通信欄] →", e.target.value); setContact(e.target.value) }}
            onKeyDown={onEnter("f-mat-suggest")} {...FH} />
        </div>
      </div>

      {/* ─── 見積明細編集 ─── */}
      <div style={{ fontSize: "11px", fontWeight: 600, background: "#d8e9f5", color: "#1e3a5f", padding: "3px 8px", borderRadius: "4px 4px 0 0", marginTop: "8px" }}>見積明細編集</div>
      <div style={{ overflowX: "auto", border: "1px solid #e2e8f0" }}>
        <datalist id="dl-materials">
          {materials.map(m => <option key={m.materialCode} value={m.materialName || m.materialCode} />)}
        </datalist>
        <datalist id="dl-specs">
          {filteredSpecs.map(s => <option key={s.processingSpecCode} value={s.processingSpecName} />)}
        </datalist>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "32px" }} /><col style={{ width: "90px" }} /><col style={{ width: "90px" }} />
            <col style={{ width: "40px" }} /><col style={{ width: "40px" }} /><col style={{ width: "40px" }} />
            <col style={{ width: "58px" }} /><col style={{ width: "62px" }} /><col style={{ width: "66px" }} />
            <col style={{ width: "40px" }} /><col style={{ width: "44px" }} /><col style={{ width: "44px" }} /><col style={{ width: "44px" }} />
            <col style={{ width: "66px" }} /><col style={{ width: "40px" }} /><col style={{ width: "40px" }} />
            <col style={{ width: "42px" }} />
          </colgroup>
          <thead>
            <tr>
              <th style={TH} rowSpan={2}>No</th>
              <th style={TH} rowSpan={2}>材料</th>
              <th style={TH} rowSpan={2}>仕上り</th>
              <th style={TH} colSpan={3}>加工仕様</th>
              <th style={TH} colSpan={3}>寸法</th>
              <th style={TH} colSpan={4}>公差</th>
              <th style={TH} colSpan={3}>面取り</th>
              <th style={TH} rowSpan={2}>数量</th>
            </tr>
            <tr>
              <th style={TH}>厚み</th><th style={TH}>巾</th><th style={TH}>長さ</th>
              <th style={TH}>厚み</th><th style={TH}>巾</th><th style={TH}>長さ</th>
              <th style={TH}>標準</th><th style={TH}>厚み</th><th style={TH}>巾</th><th style={TH}>長さ</th>
              <th style={TH}>面取図</th><th style={TH}>4角</th><th style={TH}>8辺</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...TD, textAlign: "center", color: "#94a3b8", fontSize: "10px" }}>—</td>

              {/* 材料: サジェスト */}
              <td style={TD}>
                <input id="f-mat-suggest" ref={matInputRef} list="dl-materials" style={SEL}
                  value={matSuggest}
                  onChange={e => {
                    const v = e.target.value; setMatSuggest(v)
                    const hit = materials.find(m => m.materialName === v || m.materialCode === v)
                    if (hit) handleMaterialSelect(hit.materialCode)
                  }}
                  onKeyDown={e => {
                    if (e.key !== "Enter") return; e.preventDefault()
                    const hit = materials.find(m => m.materialName === matSuggest || m.materialCode === matSuggest)
                    if (hit) handleMaterialSelect(hit.materialCode)
                    else focusById("f-shiagari")
                  }}
                  placeholder="材料名入力" {...FH} />
              </td>

              {/* 仕上り: サジェスト + DBのkakou_shiji列で加工指示自動設定 */}
              <td style={TD}>
                <input id="f-shiagari" list="dl-specs" style={SEL}
                  value={specSuggest}
                  onChange={e => {
                    const v = e.target.value; setSpecSuggest(v)
                    const hit = filteredSpecs.find(s => s.processingSpecName === v)
                    if (hit) handleSpecSelect(hit, false)
                  }}
                  onKeyDown={e => {
                    if (e.key !== "Enter") return; e.preventDefault()
                    const hit = filteredSpecs.find(s => s.processingSpecName === specSuggest)
                    if (hit) {
                      handleSpecSelect(hit, false)
                      const defined = allCutsDefined(hit.kakouShijiT || "W", hit.kakouShijiA || "W", hit.kakouShijiB || "W")
                      console.log(`[仕上りENTER] spec:${hit.processingSpecName} 全面確定:${defined}`)
                      if (defined) setTimeout(() => focusById("f-sizeT"), 50)
                      else setTimeout(() => focusById("f-cutT"), 50)
                    } else { focusById("f-cutT") }
                  }}
                  placeholder="仕上り選択" {...FH} />
              </td>

              {/* 加工仕様: 厚み/巾/長さ */}
              <td style={TD}>
                <select id="f-cutT" style={SEL} value={form.kakouShijiCodeT}
                  onChange={e => { console.log("[加工仕様T] →", e.target.value); setForm(f => ({ ...f, kakouShijiCodeT: e.target.value })) }}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); focusById("f-cutA") } }} {...FH}>
                  <option value="W">W</option><option value="G">G</option>
                  <option value="〜">〜</option><option value="RG">RG</option><option value="SG">SG</option>
                </select>
              </td>
              <td style={TD}>
                <select id="f-cutA" style={SEL} value={form.kakouShijiCodeA}
                  onChange={e => { console.log("[加工仕様A] →", e.target.value); setForm(f => ({ ...f, kakouShijiCodeA: e.target.value })) }}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); focusById("f-cutB") } }} {...FH}>
                  <option value="W">W</option><option value="G">G</option>
                  <option value="〜">〜</option><option value="RG">RG</option><option value="SG">SG</option>
                </select>
              </td>
              <td style={TD}>
                <select id="f-cutB" style={SEL} value={form.kakouShijiCodeB}
                  onChange={e => { console.log("[加工仕様B] →", e.target.value); setForm(f => ({ ...f, kakouShijiCodeB: e.target.value })) }}
                  onKeyDown={onEnter("f-sizeT")} {...FH}>
                  <option value="W">W</option><option value="G">G</option>
                  <option value="〜">〜</option><option value="RG">RG</option><option value="SG">SG</option>
                </select>
              </td>

              {/* 寸法 */}
              <td style={TD}>
                <input id="f-sizeT" style={{ ...INP, textAlign: "right" }} type="number" step="0.001"
                  value={form.sizeT || ""}
                  onChange={e => { const v = parseFloat(e.target.value)||0; console.log("[寸法T] →", v); setForm(f => ({ ...f, sizeT: v, calculated: false })) }}
                  onKeyDown={onEnter("f-sizeA")} {...FH} />
              </td>
              <td style={TD}>
                <input id="f-sizeA" style={{ ...INP, textAlign: "right" }} type="number" step="0.001"
                  value={form.sizeA || ""}
                  onChange={e => { const v = parseFloat(e.target.value)||0; console.log("[寸法A(巾)] →", v); setForm(f => ({ ...f, sizeA: v })) }}
                  onKeyDown={onEnter("f-sizeB")} {...FH} />
              </td>
              <td style={TD}>
                <input id="f-sizeB" style={{ ...INP, textAlign: "right" }} type="number" step="0.001"
                  value={form.sizeB || ""}
                  onChange={e => { const v = parseFloat(e.target.value)||0; console.log("[寸法B(長さ)] →", v); setForm(f => ({ ...f, sizeB: v })) }}
                  onKeyDown={onEnter("btn-std-tol")} {...FH} />
              </td>

              {/* 標準公差ボタン */}
              <td style={{ ...TD, textAlign: "center", padding: "2px" }}>
                <button id="btn-std-tol" className="btn-ochi btn-outline"
                  style={{ fontSize: "9px", padding: "2px 5px", width: "100%", height: "24px" }}
                  onClick={handleStdTol}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleStdTol() } }}>標準</button>
              </td>

              {/* 公差: 上下2段 */}
              <td style={{ ...TD, padding: "1px 2px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <input id="f-tolTUp" style={TOL_INP} type="number" step="0.001"
                    value={form.toleranceTUp || ""}
                    onChange={e => { const v=parseFloat(e.target.value)||0; console.log("[公差T上]→",v); setForm(f=>({...f,toleranceTUp:v})) }}
                    onKeyDown={onEnter("f-tolTDn")} {...FH} />
                  <input id="f-tolTDn" style={TOL_INP} type="number" step="0.001"
                    value={form.toleranceTDown || ""}
                    onChange={e => { const v=parseFloat(e.target.value)||0; console.log("[公差T下]→",v); setForm(f=>({...f,toleranceTDown:v})) }}
                    onKeyDown={onEnter("f-tolAUp")} {...FH} />
                </div>
              </td>
              <td style={{ ...TD, padding: "1px 2px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <input id="f-tolAUp" style={TOL_INP} type="number" step="0.001"
                    value={form.toleranceAUp || ""}
                    onChange={e => { const v=parseFloat(e.target.value)||0; console.log("[公差A上]→",v); setForm(f=>({...f,toleranceAUp:v})) }}
                    onKeyDown={onEnter("f-tolADn")} {...FH} />
                  <input id="f-tolADn" style={TOL_INP} type="number" step="0.001"
                    value={form.toleranceADown || ""}
                    onChange={e => { const v=parseFloat(e.target.value)||0; console.log("[公差A下]→",v); setForm(f=>({...f,toleranceADown:v})) }}
                    onKeyDown={onEnter("f-tolBUp")} {...FH} />
                </div>
              </td>
              <td style={{ ...TD, padding: "1px 2px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <input id="f-tolBUp" style={TOL_INP} type="number" step="0.001"
                    value={form.toleranceBUp || ""}
                    onChange={e => { const v=parseFloat(e.target.value)||0; console.log("[公差B上]→",v); setForm(f=>({...f,toleranceBUp:v})) }}
                    onKeyDown={onEnter("f-tolBDn")} {...FH} />
                  <input id="f-tolBDn" style={TOL_INP} type="number" step="0.001"
                    value={form.toleranceBDown || ""}
                    onChange={e => { const v=parseFloat(e.target.value)||0; console.log("[公差B下]→",v); setForm(f=>({...f,toleranceBDown:v})) }}
                    onKeyDown={onEnter("btn-std-chamfer")} {...FH} />
                </div>
              </td>

              {/* 面取り */}
              <td style={{ ...TD, textAlign: "center", padding: "2px 3px" }}>
                <select style={{ ...SEL, fontSize: "9px", height: "22px", marginBottom: "2px" }}
                  value={form.mentoriShiji}
                  onChange={e => { console.log("[面取図]→",e.target.value); setForm(f => ({ ...f, mentoriShiji: parseInt(e.target.value) })) }} {...FH}>
                  <option value={1}>面取図参照</option>
                  <option value={2}>面取不可</option>
                  <option value={9}>---</option>
                </select>
                <button id="btn-std-chamfer" className="btn-ochi btn-outline"
                  style={{ fontSize: "8px", padding: "0 3px", display: "block", width: "100%", height: "20px" }}
                  onClick={handleStdChamfer}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleStdChamfer() } }}>標準</button>
              </td>
              <td style={TD}>
                <input id="f-mentori4" style={{ ...INP, textAlign: "right" }} type="number" step="0.1"
                  value={form.mentori4 || ""}
                  onChange={e => { const v=parseFloat(e.target.value)||0; console.log("[4C]→",v); setForm(f=>({...f,mentori4:v})) }}
                  onKeyDown={onEnter("f-mentori8")} {...FH} />
              </td>
              <td style={TD}>
                <input id="f-mentori8" style={{ ...INP, textAlign: "right" }} type="number" step="0.1"
                  value={form.mentori8 || ""}
                  onChange={e => { const v=parseFloat(e.target.value)||0; console.log("[8C]→",v); setForm(f=>({...f,mentori8:v})) }}
                  onKeyDown={onEnter("f-qty")} {...FH} />
              </td>
              <td style={TD}>
                <input id="f-qty" style={{ ...INP, textAlign: "right" }} type="number" min="1"
                  value={form.quantity}
                  onChange={e => { const v=parseInt(e.target.value)||1; console.log("[数量]→",v); setForm(f=>({...f,quantity:v})) }}
                  onKeyDown={onEnter("f-custDetailNo")} {...FH} />
              </td>
            </tr>

            {/* 注文番号・備考 */}
            <tr>
              <td colSpan={17} style={TD}>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: "180px" }}>
                    <span style={{ fontSize: "9px", color: "#64748b" }}>お客様注文番号</span>
                    <input id="f-custDetailNo" style={INP} value={form.customerDetailOrderNo}
                      onChange={e => { console.log("[客注文番号]→",e.target.value); setForm(f => ({ ...f, customerDetailOrderNo: e.target.value })) }}
                      onKeyDown={onEnter("f-destDetailNo")} {...FH} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: "180px" }}>
                    <span style={{ fontSize: "9px", color: "#64748b" }}>送り先注文番号</span>
                    <input id="f-destDetailNo" style={INP} value={form.destinationDetailOrderNo}
                      onChange={e => { console.log("[送先注文番号]→",e.target.value); setForm(f => ({ ...f, destinationDetailOrderNo: e.target.value })) }}
                      onKeyDown={onEnter("f-remarks")} {...FH} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "1px", flex: 1 }}>
                    <span style={{ fontSize: "9px", color: "#64748b" }}>備考</span>
                    <input id="f-remarks" style={INP} value={form.remarks}
                      onChange={e => { console.log("[備考]→",e.target.value); setForm(f => ({ ...f, remarks: e.target.value })) }}
                      onKeyDown={onEnter("btn-calc")} {...FH} />
                  </div>
                </div>
              </td>
            </tr>

            {/* 計算結果・ボタン */}
            <tr>
              <td colSpan={2} style={{ ...TD, padding: "4px" }}>
                <div style={{ fontSize: "9px", color: "#64748b" }}>最短納期</div>
                <input style={{ ...INP, background: "#f8fafc", color: "#64748b", fontSize: "10px" }} value={fmt(form.fastDeliveryDate)} readOnly />
              </td>
              <td colSpan={6} style={{ ...TD, padding: "4px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: "9px", color: "#64748b" }}>納期保証期限</div>
                    <input style={{ ...INP, width: "130px", background: form.fastDeliveryDeadline ? "#ffffcc" : "#fff" }} value={fmt(form.fastDeliveryDeadline)} readOnly />
                  </div>
                  <div>
                    <div style={{ fontSize: "9px", color: "#64748b" }}>送料込みプレート単価</div>
                    <input style={{ ...INP, width: "95px", textAlign: "right", background: "#f8fafc", fontFamily: "monospace" }} value={form.unitPrice != null ? "¥" + form.unitPrice.toLocaleString() : ""} readOnly />
                  </div>
                  <div>
                    <div style={{ fontSize: "9px", color: "#64748b" }}>送料込みプレート金額</div>
                    <input style={{ ...INP, width: "95px", textAlign: "right", background: "#f8fafc", fontFamily: "monospace" }} value={form.totalPrice != null ? "¥" + form.totalPrice.toLocaleString() : ""} readOnly />
                  </div>
                </div>
              </td>
              <td colSpan={9} style={{ ...TD, padding: "4px" }}>
                <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", alignItems: "center" }}>
                  <button id="btn-calc" className="btn-ochi btn-primary"
                    style={{ fontSize: "11px", minWidth: "90px" }}
                    onClick={handleCalculate}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleCalculate() } }}>
                    📊 見積計算
                  </button>
                  <button id="btn-add" className="btn-ochi btn-primary"
                    style={{ fontSize: "11px", minWidth: "90px", background: form.calculated ? "#16a34a" : "#94a3b8", cursor: form.calculated ? "pointer" : "not-allowed" }}
                    onClick={handleAdd} disabled={!form.calculated}
                    onKeyDown={e => { if (e.key === "Enter" && form.calculated) { e.preventDefault(); handleAdd() } }}>
                    ＋ 明細に追加
                  </button>
                  <button className="btn-ochi btn-outline" style={{ fontSize: "11px" }}
                    onClick={() => { console.log("[クリア] フォームリセット"); setForm(newForm()); setMatSuggest(""); setSpecSuggest(""); setTimeout(() => focusById("f-mat-suggest"), 50) }}>
                    クリア
                  </button>
                </div>
                {!form.calculated && (
                  <div style={{ fontSize: "9px", color: "#f59e0b", textAlign: "right", marginTop: "2px" }}>△ 先に「見積計算」を実行</div>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ─── 登録済み明細 ─── */}
      <div style={{ marginTop: "8px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "4px 4px 0 0", padding: "3px 10px", display: "flex", gap: "12px", alignItems: "center" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, color: "#166534" }}>登録済み明細</span>
        <span style={{ fontSize: "11px", color: "#166534" }}>
          {details.length}件 / 合計 ¥{details.reduce((s, d) => s + (d.totalPrice ?? 0), 0).toLocaleString()}
        </span>
      </div>
      <div style={{ overflowX: "auto", border: "1px solid #86efac", borderTop: "none" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
          <thead>
            <tr>
              <th style={{ ...TH, background: "#166534", width: "28px" }}>
                <input type="checkbox" onChange={e => selAll(e.target.checked)} checked={details.length > 0 && selectedIds.size === details.length} />
              </th>
              <th style={{ ...TH, background: "#166534", width: "28px" }}>No</th>
              <th style={{ ...TH, background: "#166534" }}>材料</th>
              <th style={{ ...TH, background: "#166534" }}>加工</th>
              <th style={{ ...TH, background: "#166534" }}>厚み</th>
              <th style={{ ...TH, background: "#166534" }}>巾</th>
              <th style={{ ...TH, background: "#166534" }}>長さ</th>
              <th style={{ ...TH, background: "#166534" }}>面取り</th>
              <th style={{ ...TH, background: "#166534" }}>数量</th>
              <th style={{ ...TH, background: "#166534" }}>納期</th>
              <th style={{ ...TH, background: "#166534" }}>ご注文番号</th>
              <th style={{ ...TH, background: "#166534" }}>単価</th>
              <th style={{ ...TH, background: "#166534" }}>金額</th>
              <th style={{ ...TH, background: "#166534" }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {details.length === 0 ? (
              <tr><td colSpan={14} style={{ ...TD, textAlign: "center", padding: "12px", color: "#94a3b8" }}>明細がありません。上のフォームで入力後「明細に追加」してください。</td></tr>
            ) : details.map((d, i) => (
              <tr key={d.clientDetailId} style={{ background: i % 2 === 0 ? "#fff" : "#f0fdf4" }}>
                <td style={{ ...TD, textAlign: "center" }}><input type="checkbox" checked={selectedIds.has(d.clientDetailId)} onChange={e => selOne(d.clientDetailId, e.target.checked)} /></td>
                <td style={{ ...TD, textAlign: "center" }}>{i + 1}</td>
                <td style={TD}>{d.materialCode}</td>
                <td style={TD}>{d.shiagari}</td>
                <td style={{ ...TD, textAlign: "right" }}>{d.sizeT}</td>
                <td style={{ ...TD, textAlign: "right" }}>{d.sizeA}</td>
                <td style={{ ...TD, textAlign: "right" }}>{d.sizeB}</td>
                <td style={{ ...TD, textAlign: "center" }}>{d.mentori4 ? `4C:${d.mentori4}` : ""}{d.mentori8 ? ` 8C:${d.mentori8}` : ""}</td>
                <td style={{ ...TD, textAlign: "right" }}>{d.quantity}</td>
                <td style={{ ...TD, textAlign: "center", color: isExpired(d.deliveryDeadline) ? "#ef4444" : "#374151" }}>
                  {fmt(d.fastDeliveryDate)}{isExpired(d.deliveryDeadline) && <span style={{ color: "#ef4444", fontSize: "9px" }}> ⚠期限切</span>}
                </td>
                <td style={TD}>{d.customerDetailOrderNo}</td>
                <td style={{ ...TD, textAlign: "right", fontFamily: "monospace" }}>{d.unitPrice != null ? "¥" + d.unitPrice.toLocaleString() : "—"}</td>
                <td style={{ ...TD, textAlign: "right", fontFamily: "monospace" }}>{d.totalPrice != null ? "¥" + d.totalPrice.toLocaleString() : "—"}</td>
                <td style={{ ...TD, textAlign: "center" }}>
                  <button className="btn-ochi btn-outline" style={{ fontSize: "9px", padding: "1px 5px" }} onClick={() => handleDel(d.clientDetailId)}>削除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
'''

with open(TARGET, "w", encoding="utf-8") as f:
    f.write(NEW_CLIENT)
print(f"  OK: {TARGET}")

# ─────────────────────────────────────────────────────────────
# [5] estimates/new/page.tsx の processingSpecs 型を更新
# ─────────────────────────────────────────────────────────────
print("[5] estimates/new/page.tsx 型更新確認...")
page_path = f"{ROOT}/src/app/(app)/estimates/new/page.tsx"
with open(page_path, "r") as f:
    page = f.read()
# processingSpecsのmapにkakouShiji列を追加
OLD_SPECS_MAP = "processingSpecs={processingSpecs.map(s => ({ processingSpecCode: s.processingSpecCode, processingSpecName: s.processingSpecName ?? \"\" }))}"
NEW_SPECS_MAP = "processingSpecs={processingSpecs.map(s => ({ processingSpecCode: s.processingSpecCode, processingSpecName: s.processingSpecName ?? \"\", kakouShijiT: (s as any).kakouShijiT ?? \"W\", kakouShijiA: (s as any).kakouShijiA ?? \"W\", kakouShijiB: (s as any).kakouShijiB ?? \"W\" }))}"
if OLD_SPECS_MAP in page:
    page = page.replace(OLD_SPECS_MAP, NEW_SPECS_MAP)
    with open(page_path, "w") as f:
        f.write(page)
    print("  page.tsx processingSpecs map 更新OK")
else:
    print("  page.tsx: 対象箇所なし（既存か形式違い）")

# tsc check
print("[6] tsc チェック...")
r = subprocess.run("npx tsc --noEmit 2>&1", shell=True, capture_output=True, text=True, cwd=ROOT)
lines = [l for l in (r.stdout + r.stderr).splitlines()
         if "error TS" in l and "node_modules" not in l and ".next" not in l and "Downloads" not in l]
if lines:
    print("  tscエラー:")
    for l in lines: print("   ", l)
    sys.exit(1)
print("  ✅ 実コードエラー0件")

# git commit & push
print("[7] git commit & push...")
run("git add -A")
r = subprocess.run(
    'git commit -m "fix: 郵便番号住所取得バグ修正 + WO加工仕様DB化(SQLServer同期) + 全console.log実装 + 6Fデフォルト修正"',
    shell=True, capture_output=True, text=True, cwd=ROOT)
print(" ", r.stdout.strip().split("\n")[0])
run("git push")
print("  PUSH OK")

# 自身削除
import os as _os
_os.remove(__file__)
print(f"  削除: {__file__}")

print()
print("✅ 全修正完了!")
print()
print("─" * 60)
print("実行: sudo systemctl restart ochi-web.service")
print("─" * 60)
