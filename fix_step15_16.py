#!/usr/bin/env python3
"""
STEP15（直送先検索モーダル）+ STEP16（見積番号採番）+ JWT延長 + shortestNouki空対応
一括修正スクリプト

実行方法:
  cd ~/projects/ochi-ss
  python3 /tmp/fix_step15_16.py

修正内容:
  1. src/lib/auth.ts              → jwt.maxAge 15分→140分
  2. src/app/api/v1/estimates/route.ts → 見積番号採番（W+YYYYMMDD+2桁）
  3. src/app/api/v1/estimates/calculate/route.ts → shortestNouki空時422回避
  4. src/app/(app)/estimates/new/EstimateNewClient.tsx
       → 直送先検索モーダル完全実装
       → ヘッダーstateに zip/address/tel/fax 追加
       → 保存payloadに zip/address/tel/fax 追加
"""

import os
import sys

errors = []

def fix_file(path, replacements, label=""):
    if not os.path.exists(path):
        errors.append(f"❌ ファイル不存在: {path}")
        return False
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    original = content
    for i, (old, new) in enumerate(replacements):
        if old in content:
            content = content.replace(old, new)
            print(f"  ✅ [{label}] 置換{i+1}成功: {old[:55].strip()}...")
        else:
            msg = f"  ❌ [{label}] 置換{i+1}失敗: {old[:55].strip()}..."
            print(msg)
            errors.append(msg)
    if content != original:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  💾 [{label}] 書き込み完了: {path}")
        return True
    print(f"  ⚠ [{label}] 変更なし（既に適用済み？）")
    return False

print("=" * 65)
print("Ochi-ss 一括修正: STEP15/16/JWT/shortestNouki")
print("=" * 65)

# ============================================================
# 1. auth.ts: jwt.maxAge 15分→140分
# ============================================================
print("\n[1] auth.ts: JWT maxAge 延長")
fix_file(
    'src/lib/auth.ts',
    [
        (
            '  jwt: {\n    maxAge: 15 * 60,\n  },',
            '  jwt: {\n    maxAge: 140 * 60,  // 15*60→140*60 (sessionTimeoutMinに合わせる)\n  },'
        ),
    ],
    label="auth.ts"
)

# ============================================================
# 2. estimates/route.ts: 見積番号採番
# ============================================================
print("\n[2] estimates/route.ts: 見積番号採番実装")
fix_file(
    'src/app/api/v1/estimates/route.ts',
    [
        (
            '  // ── トランザクション保存 ──\n  try {\n    const saved = await prisma.$transaction(async (tx) => {',
            r'''  // ── 見積番号採番ロジック ──
  // フォーマット: W + YYYYMMDD + 2桁連番 (例: W2026051701)
  // ※ Prisma.TransactionClient 型は tx として使用
  async function generateEstimateNo(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], inputDate: string): Promise<string> {
    const d = new Date(inputDate)
    const yyyymmdd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
    const prefix = `W${yyyymmdd}`
    const last = await tx.estimateHeader.findFirst({
      where: { estimateNo: { startsWith: prefix } },
      orderBy: { estimateNo: 'desc' },
      select: { estimateNo: true },
    })
    let seq = 1
    if (last?.estimateNo) {
      const lastSeq = parseInt(last.estimateNo.slice(-2), 10)
      if (!isNaN(lastSeq)) seq = lastSeq + 1
    }
    if (seq > 99) throw new Error('本日の見積番号が上限（99件）に達しました')
    return `${prefix}${String(seq).padStart(2, '0')}`
  }

  // ── トランザクション保存 ──
  try {
    const saved = await prisma.$transaction(async (tx) => {'''
        ),
        (
            '      // 見積ヘッダー作成\n      const header = await tx.estimateHeader.create({',
            '''      // 見積番号採番
      const estimateNo = await generateEstimateNo(tx, body.inputDate)
      console.log('[POST /estimates] 採番見積番号:', estimateNo)

      // 見積ヘッダー作成
      const header = await tx.estimateHeader.create({'''
        ),
        (
            '          customerId:      session.user.customerId!,\n          customerCode:    session.user.companyCode ?? "",',
            '          estimateNo:      estimateNo,\n          customerId:      session.user.customerId!,\n          customerCode:    session.user.companyCode ?? "",'
        ),
    ],
    label="estimates/route.ts"
)

# ============================================================
# 3. calculate/route.ts: shortestNouki 空時の422回避
# ============================================================
print("\n[3] calculate/route.ts: shortestNouki空時対応")
fix_file(
    'src/app/api/v1/estimates/calculate/route.ts',
    [
        (
            '    if (!shortestNouki) {\n      return NextResponse.json({ error: "shortestNouki が空です" }, { status: 422 })',
            '    if (!shortestNouki) {\n      console.warn("[calculate] shortestNouki が空 → 空文字で続行（SP仕様上一部組合せで返らない）")\n      // return NextResponse.json({ error: "shortestNouki が空です" }, { status: 422 })'
        ),
    ],
    label="calculate/route.ts"
)

# ============================================================
# 4. EstimateNewClient.tsx: 直送先検索モーダル + フィールド追加
# ============================================================
print("\n[4] EstimateNewClient.tsx: 直送先検索モーダル実装")

DIRECT_DELIVERY_MODAL_CODE = '''
// ──────────────────────────────────────────────────────────────────
// 直送先検索モーダルコンポーネント
// ──────────────────────────────────────────────────────────────────
interface DirectDelivery {
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
}

interface DirectDeliveryModalProps {
  customerCode: string
  onSelect: (dd: DirectDelivery) => void
  onClose:  () => void
}

function DirectDeliveryModal({ customerCode, onSelect, onClose }: DirectDeliveryModalProps) {
  const [query,    setQuery]    = useState("")
  const [results,  setResults]  = useState<DirectDelivery[]>([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState("")
  const [searched, setSearched] = useState(false)

  const handleSearch = async () => {
    console.log("[直送先モーダル] 検索 query:", query)
    if (query.trim().length < 2) { setError("2文字以上入力してください"); return }
    setError(""); setLoading(true)
    try {
      const res = await fetch(`/api/v1/direct-deliveries/search?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      console.log("[直送先モーダル] 検索レスポンス:", data)
      if (!res.ok) throw new Error(data.error ?? "検索失敗")
      setResults(data.results ?? [])
      setSearched(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (dd: DirectDelivery) => {
    console.log("[直送先モーダル] 選択:", dd)
    onSelect(dd)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>

        {/* モーダルヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-800">🔍 直送先検索</h2>
          <button
            onClick={() => { console.log("[直送先モーダル] ×ボタン"); onClose() }}
            className="text-gray-400 hover:text-gray-700 text-xl font-bold leading-none px-1"
          >×</button>
        </div>

        {/* 検索フォーム */}
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={e => { console.log("[直送先モーダル] 入力:", e.target.value); setQuery(e.target.value) }}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="直送先名・コード・住所・電話番号（2文字以上）"
              autoFocus
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => { console.log("[直送先モーダル] 検索ボタン"); handleSearch() }}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
            >
              {loading ? "検索中..." : "🔍 検索"}
            </button>
            <button
              onClick={() => { console.log("[直送先モーダル] クリアボタン"); setQuery(""); setResults([]); setSearched(false); setError("") }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100"
            >クリア</button>
          </div>
          {error && <p className="mt-2 text-xs text-red-600">⚠ {error}</p>}
        </div>

        {/* 検索結果 */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!searched && (
            <p className="text-sm text-gray-400 text-center py-8">検索条件を入力して「検索」ボタンを押してください</p>
          )}
          {searched && results.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-8">該当する直送先が見つかりませんでした</p>
          )}
          {results.length > 0 && (
            <>
              <p className="text-xs text-gray-500 mb-3">{results.length}件見つかりました</p>
              <div className="space-y-2">
                {results.map((dd, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-3 hover:bg-blue-50 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{dd.deliveryCode}</span>
                          <span className="text-sm font-semibold text-gray-800 truncate">{dd.name}</span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {dd.departmentName && <span className="mr-3">部署: {dd.departmentName}</span>}
                          {dd.chargeName     && <span className="mr-3">担当: {dd.chargeName}</span>}
                          {dd.postalCode     && <span className="mr-3">〒{dd.postalCode}</span>}
                          <span>{[dd.address1, dd.address2, dd.address3].filter(Boolean).join("")}</span>
                          {dd.tel            && <span className="ml-3">☎ {dd.tel}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => handleSelect(dd)}
                        className="shrink-0 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                      >選択</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* フッター */}
        <div className="px-5 py-3 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100"
          >閉じる</button>
        </div>
      </div>
    </div>
  )
}

'''

path = 'src/app/(app)/estimates/new/EstimateNewClient.tsx'
if not os.path.exists(path):
    errors.append(f"❌ ファイル不存在: {path}")
else:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    original = content

    # --- モーダルコンポーネント挿入（型定義セクションの前） ---
    INSERT_MARKER = '// ──────────────────────────────────────────────────────────────────\n// 型定義\n// ──────────────────────────────────────────────────────────────────'
    if 'DirectDeliveryModal' not in content:
        if INSERT_MARKER in content:
            content = content.replace(INSERT_MARKER, DIRECT_DELIVERY_MODAL_CODE + INSERT_MARKER)
            print("  ✅ [EstimateNewClient] DirectDeliveryModal挿入完了")
        else:
            # フォールバック: "use client" の直後のimport群の後に挿入
            import_end = content.rfind('\nimport ')
            if import_end > 0:
                # 最後のimport行の末尾を探す
                next_nl = content.find('\n', import_end + 1)
                next_nl2 = content.find('\n', next_nl + 1)
                content = content[:next_nl2] + '\n' + DIRECT_DELIVERY_MODAL_CODE + content[next_nl2:]
                print("  ✅ [EstimateNewClient] DirectDeliveryModal挿入完了(フォールバック)")
            else:
                errors.append("  ❌ [EstimateNewClient] 挿入位置が見つからず")
    else:
        print("  ⚠ [EstimateNewClient] DirectDeliveryModal既に存在 → スキップ")

    # --- HeaderForm 型定義にフィールド追加 ---
    OLD_TYPE = '''type HeaderForm = {
  inputDate:        string
  customerOrderNo:  string
  endUserNo:        string
  destinationCode:  string
  destinationName:  string
  destinationDept:  string
  destinationPerson: string
  requestNouki:     string
  remarks:          string
}'''
    NEW_TYPE = '''type HeaderForm = {
  inputDate:        string
  customerOrderNo:  string
  endUserNo:        string
  destinationCode:  string
  destinationName:  string
  destinationDept:  string
  destinationPerson: string
  destinationZip:   string
  destinationAddress: string
  destinationTel:   string
  destinationFax:   string
  requestNouki:     string
  remarks:          string
}'''
    if OLD_TYPE in content:
        content = content.replace(OLD_TYPE, NEW_TYPE)
        print("  ✅ [EstimateNewClient] HeaderForm型にzip/address/tel/fax追加")
    elif 'destinationZip' not in content:
        errors.append("  ❌ [EstimateNewClient] HeaderForm型置換失敗")
    else:
        print("  ⚠ [EstimateNewClient] HeaderForm型: destinationZip既存")

    # --- useState初期値にフィールド追加 + showDDModal state ---
    OLD_STATE = '''  const [header, setHeader] = useState<HeaderForm>({
    inputDate:        today,
    customerOrderNo:  "",
    endUserNo:        "",
    destinationCode:  "",
    destinationName:  "",
    destinationDept:  "",
    destinationPerson: "",
    requestNouki:     "",
    remarks:          "",
  })'''
    NEW_STATE = '''  const [header, setHeader] = useState<HeaderForm>({
    inputDate:        today,
    customerOrderNo:  "",
    endUserNo:        "",
    destinationCode:  "",
    destinationName:  "",
    destinationDept:  "",
    destinationPerson: "",
    destinationZip:   "",
    destinationAddress: "",
    destinationTel:   "",
    destinationFax:   "",
    requestNouki:     "",
    remarks:          "",
  })
  const [showDDModal, setShowDDModal] = useState(false)'''
    if OLD_STATE in content:
        content = content.replace(OLD_STATE, NEW_STATE)
        print("  ✅ [EstimateNewClient] headerState初期値 + showDDModal追加")
    elif 'showDDModal' in content:
        print("  ⚠ [EstimateNewClient] showDDModal既存")
    else:
        errors.append("  ❌ [EstimateNewClient] headerState置換失敗")

    # --- 直送先検索ボタンのonClick更新 ---
    OLD_BTN = '''                  title="直送先検索（STEP12-D で実装）"
                onClick={() => console.log("[直送先検索ボタン] クリック")}
                >
                  🔍 直送先検索
                </button>'''
    NEW_BTN = '''                  title="直送先検索"
                onClick={() => { console.log("[直送先検索ボタン] クリック"); setShowDDModal(true) }}
                >
                  🔍 直送先検索
                </button>'''
    if OLD_BTN in content:
        content = content.replace(OLD_BTN, NEW_BTN)
        print("  ✅ [EstimateNewClient] 直送先検索ボタンonClick更新")
    elif 'setShowDDModal(true)' in content:
        print("  ⚠ [EstimateNewClient] ボタンonClick既に更新済み")
    else:
        errors.append("  ❌ [EstimateNewClient] 直送先検索ボタン置換失敗")

    # --- モーダルJSX挿入（ヘッダー入力セクションの前） ---
    OLD_MODAL_POS = '      {/* ──────── ヘッダー入力 ──────── */}'
    NEW_MODAL_POS = '''      {/* 直送先検索モーダル */}
      {showDDModal && (
        <DirectDeliveryModal
          customerCode={userInfo.customerCode}
          onSelect={(dd) => {
            console.log("[直送先選択] 自動入力:", dd)
            setHeader(h => ({
              ...h,
              destinationCode:    dd.deliveryCode,
              destinationName:    dd.name,
              destinationDept:    dd.departmentName,
              destinationPerson:  dd.chargeName,
              destinationZip:     dd.postalCode,
              destinationAddress: [dd.address1, dd.address2, dd.address3].filter(Boolean).join(""),
              destinationTel:     dd.tel,
              destinationFax:     dd.fax,
            }))
          }}
          onClose={() => setShowDDModal(false)}
        />
      )}

      {/* ──────── ヘッダー入力 ──────── */}'''
    if OLD_MODAL_POS in content:
        content = content.replace(OLD_MODAL_POS, NEW_MODAL_POS)
        print("  ✅ [EstimateNewClient] モーダルJSX挿入")
    elif 'DirectDeliveryModal\n          customerCode' in content:
        print("  ⚠ [EstimateNewClient] モーダルJSX既存")
    else:
        errors.append("  ❌ [EstimateNewClient] モーダルJSX挿入失敗")

    # --- handleSave payload に zip/address/tel/fax 追加 ---
    OLD_PAYLOAD = '      destinationPerson: header.destinationPerson,\n      requestNouki:  header.requestNouki,'
    NEW_PAYLOAD = '''      destinationPerson:  header.destinationPerson,
      destinationZip:     header.destinationZip,
      destinationAddress: header.destinationAddress,
      destinationTel:     header.destinationTel,
      destinationFax:     header.destinationFax,
      requestNouki:  header.requestNouki,'''
    if OLD_PAYLOAD in content:
        content = content.replace(OLD_PAYLOAD, NEW_PAYLOAD)
        print("  ✅ [EstimateNewClient] handleSave payload zip/address/tel/fax追加")
    elif 'destinationZip:     header.destinationZip' in content:
        print("  ⚠ [EstimateNewClient] payload既に更新済み")
    else:
        errors.append("  ❌ [EstimateNewClient] handleSave payload置換失敗")

    if content != original:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  💾 [EstimateNewClient] ファイル書き込み完了")
    else:
        print(f"  ⚠ [EstimateNewClient] 変更なし")

# ============================================================
# 結果サマリー
# ============================================================
print("\n" + "=" * 65)
if errors:
    print(f"⚠ {len(errors)}件の問題:")
    for e in errors:
        print(f"  {e}")
else:
    print("✅ 全修正完了・エラーなし")
print("=" * 65)

if errors:
    sys.exit(1)
