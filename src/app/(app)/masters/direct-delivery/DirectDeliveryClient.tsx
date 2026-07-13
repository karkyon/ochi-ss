// DirectDeliveryClient.tsx — 直送先CRUD UI
"use client"
import { useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"

type DD = {
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
}

const EMPTY: Omit<DD, "id"> = {
  deliveryCode: "", companyName: "", furigana: "", shortName: "",
  corporateType: "", corporatePosition: "", departmentName: "", contactPerson: "",
  postalCode: "", address1: "", address2: "", address3: "",
  phoneNumber: "", faxNumber: "", remarks: "",
}

interface Props {
  deliveries: DD[]
  customerCode: string
  customerId: string
}

export default function DirectDeliveryClient({ deliveries: initial, customerCode, customerId }: Props) {
  const router = useRouter()
  const [list, setList] = useState<DD[]>(initial)
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<DD | null>(null)
  const [form, setForm] = useState<Omit<DD, "id">>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [postalSearching, setPostalSearching] = useState(false)
  const [postalError, setPostalError] = useState("")

  const openNew = () => { setForm(EMPTY); setEditTarget(null); setError(""); setShowModal(true) }
  const openEdit = (d: DD) => { setForm({ deliveryCode: d.deliveryCode, companyName: d.companyName, furigana: d.furigana, shortName: d.shortName, corporateType: d.corporateType, corporatePosition: d.corporatePosition, departmentName: d.departmentName, contactPerson: d.contactPerson, postalCode: d.postalCode, address1: d.address1, address2: d.address2, address3: d.address3, phoneNumber: d.phoneNumber, faxNumber: d.faxNumber, remarks: d.remarks }); setEditTarget(d); setError(""); setShowModal(true) }

  const handleSave = useCallback(async () => {
    if (!form.deliveryCode || !form.companyName) { setError("直送先コード・名称は必須です"); return }
    setSaving(true); setError("")
    try {
      const url = editTarget ? `/api/v1/masters/direct-delivery/${editTarget.id}` : "/api/v1/masters/direct-delivery"
      const method = editTarget ? "PATCH" : "POST"
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, customerCode, customerId }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "保存失敗")
      setShowModal(false)
      router.refresh()
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }, [form, editTarget, customerCode, customerId, router])

  const handleDelete = useCallback(async (d: DD) => {
    if (!confirm(`「${d.companyName}」を削除しますか？`)) return
    const res = await fetch(`/api/v1/masters/direct-delivery/${d.id}`, { method: "DELETE" })
    if (res.ok) { setList(p => p.filter(x => x.id !== d.id)); router.refresh() }
    else { const err = await res.json().catch(() => ({})); alert("削除失敗: " + (err.error ?? res.status)) }
  }, [router])

  const handlePostalSearch = useCallback(async () => {
    const zip = form.postalCode.replace(/-/g, "")
    if (!/^\d{7}$/.test(zip)) { setPostalError("7桁の数字で入力してください"); return }
    setPostalSearching(true); setPostalError("")
    try {
      const res = await fetch(`/api/v1/postal-code?zip=${zip}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "住所取得失敗")
      setForm(p => ({ ...p, address1: data.address1 + data.address2, address2: data.address3, address3: "" }))
    } catch (e: any) { setPostalError(e.message) } finally { setPostalSearching(false) }
  }, [form.postalCode])

  const filtered = list.filter(d =>
    !search || d.companyName.includes(search) || d.deliveryCode.includes(search) || d.address1.includes(search)
  )

  const F = ({ label, k, placeholder = "" }: { label: string; k: keyof typeof EMPTY; placeholder?: string }) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input type="text" value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  )

  return (
    <>
      {/* 検索+新規 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4 flex gap-3 items-center">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="会社名・コード・住所で絞り込み"
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button onClick={openNew} className="px-4 py-2 text-sm font-medium rounded-lg bg-[#1a2744] text-white hover:bg-[#243561] transition-colors whitespace-nowrap">
          ＋ 新規登録
        </button>
      </div>

      {/* 一覧 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">納入先一覧 ({filtered.length}件)</p>
        </div>
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">登録された納入先がありません</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">コード</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">会社名</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">部署名</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">担当者</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">TEL</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">住所</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{d.deliveryCode}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{d.companyName}</td>
                    <td className="px-4 py-3 text-gray-600">{d.departmentName || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{d.contactPerson || "—"}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{d.phoneNumber || "—"}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{d.postalCode ? `〒${d.postalCode} ` : ""}{d.address1 || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 justify-center">
                        <button onClick={() => openEdit(d)} className="px-2.5 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors">編集</button>
                        <button onClick={() => handleDelete(d)} className="px-2.5 py-1 text-xs rounded border border-red-300 text-red-600 hover:bg-red-50 transition-colors">削除</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* モーダル */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="font-bold text-gray-800">{editTarget ? "納入先編集" : "納入先新規登録"}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              {/* ★2026/07/13 修正: 郵便番号入力欄が flex-1 で幅を取りすぎ、
                  「住所検索」ボタンが隣のTEL欄に重なって見える不具合を修正。
                  郵便番号欄を固定幅(w-28)にし、ボタンは shrink-0 で確保する。 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">郵便番号</label>
                <div className="flex gap-2 items-center">
                  <input type="text" value={form.postalCode} onChange={e => setForm(p => ({ ...p, postalCode: e.target.value }))}
                    placeholder="0000000" maxLength={8}
                    className="w-28 shrink-0 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button type="button" onClick={handlePostalSearch} disabled={postalSearching}
                    className="shrink-0 px-3 py-2 text-xs font-medium rounded-lg bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200 disabled:opacity-50 whitespace-nowrap">
                    {postalSearching ? "検索中..." : "📍 住所検索"}
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
            </div>
            {error && <p className="px-6 pb-3 text-sm text-red-600">{error}</p>}
            <div className="flex gap-3 justify-end px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">キャンセル</button>
              <button onClick={handleSave} disabled={saving} className="px-5 py-2 text-sm font-medium rounded-lg bg-[#1a2744] text-white hover:bg-[#243561] disabled:opacity-50">
                {saving ? "保存中..." : "💾 保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
