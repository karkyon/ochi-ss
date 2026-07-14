#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
前回スクリプト(fix_add_detail_individual_destination.py)が
estimates/new/page.tsx のパッチで中断した状態からの再開スクリプト。

- schema.prisma / estimates/route.ts(POST) / estimates/[id]/route.ts(PUT) は
  既にパッチ適用済みのため、マーカー文字列(useIndividualDestination)の有無で
  検知してスキップする（冪等）。
- estimates/new/page.tsx は、前回の完全一致文字列が実ファイルと食い違って
  失敗したため、正規表現ベースの柔軟なマッチに変更して再挑戦する。
- 残り(estimates/[id]/edit/page.tsx, EstimateNewClient.tsx)も同様に
  マーカーでスキップ判定しつつ適用する。
"""
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path("/home/karkyon/projects/ochi-ss")

FILE_SCHEMA    = REPO_ROOT / "prisma/schema.prisma"
FILE_POST      = REPO_ROOT / "src/app/api/v1/estimates/route.ts"
FILE_PUT       = REPO_ROOT / "src/app/api/v1/estimates/[id]/route.ts"
FILE_NEW_PAGE  = REPO_ROOT / "src/app/(app)/estimates/new/page.tsx"
FILE_EDIT_PAGE = REPO_ROOT / "src/app/(app)/estimates/[id]/edit/page.tsx"
FILE_CLIENT    = REPO_ROOT / "src/app/(app)/estimates/new/EstimateNewClient.tsx"

MARKER = "useIndividualDestination"


def die(msg: str):
    print(f"[NG] {msg}")
    sys.exit(1)


def already_patched(path: Path, marker: str = MARKER) -> bool:
    return marker in path.read_text(encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count == 0:
        die(f"パッチ対象文字列が見つかりません ({label})。処理を中断します。")
    if count > 1:
        die(f"パッチ対象文字列が複数箇所に一致しました ({label})。安全のため処理を中断します。")
    return text.replace(old, new, 1)


DEST_HYDRATE_LINES = (
    'useIndividualDestination: (d as any).useIndividualDestination ?? false,\n'
    '{i}destinationCode:    (d as any).destinationCode    ?? "",\n'
    '{i}destinationName:    (d as any).destinationName    ?? "",\n'
    '{i}destinationDept:    (d as any).destinationDept    ?? "",\n'
    '{i}destinationPerson:  (d as any).destinationPerson  ?? "",\n'
    '{i}destinationZip:     (d as any).destinationZip     ?? "",\n'
    '{i}destinationAddress: (d as any).destinationAddress ?? "",\n'
    '{i}destinationTel:     (d as any).destinationTel     ?? "",\n'
    '{i}destinationFax:     (d as any).destinationFax     ?? "",\n'
)


def patch_schema_if_needed():
    if already_patched(FILE_SCHEMA):
        print(f"[SKIP] 既に適用済み: {FILE_SCHEMA.relative_to(REPO_ROOT)}")
        return
    die(f"{FILE_SCHEMA} が未適用ですが、この再開スクリプトの対象外です。前回スクリプトを再実行してください。")


def patch_post_if_needed():
    if already_patched(FILE_POST):
        print(f"[SKIP] 既に適用済み: {FILE_POST.relative_to(REPO_ROOT)}")
        return
    die(f"{FILE_POST} が未適用です。想定外の状態のため中断します。")


def patch_put_if_needed():
    if already_patched(FILE_PUT):
        print(f"[SKIP] 既に適用済み: {FILE_PUT.relative_to(REPO_ROOT)}")
        return
    die(f"{FILE_PUT} が未適用です。想定外の状態のため中断します。")


def patch_new_page():
    if already_patched(FILE_NEW_PAGE):
        print(f"[SKIP] 既に適用済み: {FILE_NEW_PAGE.relative_to(REPO_ROOT)}")
        return
    text = FILE_NEW_PAGE.read_text(encoding="utf-8")

    # customerDetailOrderNo/destinationDetailOrderNo/remarks の3行ブロックを
    # 正規表現で柔軟に検出し、直後に個別直送先フィールドを挿入する。
    # インデント幅は実ファイルの remarks 行から動的に検出する。
    pattern = re.compile(
        r'([ \t]*)customerDetailOrderNo:\s*\(d as any\)\.customerDetailOrderNo\s*\?\?\s*"",\n'
        r'[ \t]*destinationDetailOrderNo:\s*\(d as any\)\.destinationDetailOrderNo\s*\?\?\s*"",\n'
        r'[ \t]*remarks:\s*\(d as any\)\.remarks\s*\?\?\s*"",\n'
    )
    m = pattern.search(text)
    if not m:
        die(f"正規表現でも対象ブロックが見つかりません ({FILE_NEW_PAGE})。手動確認が必要です。")
    indent = m.group(1)
    insert = "".join(
        f"{indent}{line}\n" if line else ""
        for line in DEST_HYDRATE_LINES.format(i=indent).split("\n")
    )
    # 末尾の余分な空行除去のため素直に組み立て直す
    insert_lines = DEST_HYDRATE_LINES.format(i=indent).rstrip("\n").split("\n")
    insert_block = indent + ("\n" + indent).join(insert_lines) + "\n"

    new_block = m.group(0) + insert_block
    text = text[:m.start()] + new_block + text[m.end():]
    FILE_NEW_PAGE.write_text(text, encoding="utf-8")
    print(f"[OK] パッチ適用完了: {FILE_NEW_PAGE.relative_to(REPO_ROOT)}")


def patch_edit_page():
    if already_patched(FILE_EDIT_PAGE):
        print(f"[SKIP] 既に適用済み: {FILE_EDIT_PAGE.relative_to(REPO_ROOT)}")
        return
    text = FILE_EDIT_PAGE.read_text(encoding="utf-8")

    pattern = re.compile(
        r'([ \t]*)customerDetailOrderNo:\s*\(d as any\)\.customerDetailOrderNo\s*\?\?\s*"",\n'
        r'[ \t]*destinationDetailOrderNo:\s*\(d as any\)\.destinationDetailOrderNo\s*\?\?\s*"",\n'
        r'[ \t]*remarks:\s*\(d as any\)\.remarks\s*\?\?\s*"",\n'
    )
    m = pattern.search(text)
    if not m:
        die(f"正規表現でも対象ブロックが見つかりません ({FILE_EDIT_PAGE})。手動確認が必要です。")
    indent = m.group(1)
    insert_lines = DEST_HYDRATE_LINES.format(i=indent).rstrip("\n").split("\n")
    insert_block = indent + ("\n" + indent).join(insert_lines) + "\n"

    new_block = m.group(0) + insert_block
    text = text[:m.start()] + new_block + text[m.end():]
    FILE_EDIT_PAGE.write_text(text, encoding="utf-8")
    print(f"[OK] パッチ適用完了: {FILE_EDIT_PAGE.relative_to(REPO_ROOT)}")


def patch_client():
    if already_patched(FILE_CLIENT):
        print(f"[SKIP] 既に適用済み: {FILE_CLIENT.relative_to(REPO_ROOT)}")
        return
    text = FILE_CLIENT.read_text(encoding="utf-8")

    # 1. Fragment を react から import
    old_import = 'import { useState, useEffect, useRef, useCallback } from "react"'
    new_import = 'import { useState, useEffect, useRef, useCallback, Fragment } from "react"'
    text = replace_once(text, old_import, new_import, "Fragment import追加")

    # 2. DetailForm型に個別直送先フィールド追加
    old_type = (
        '  // 注文済み情報\n'
        '  isOrdered?: boolean        // 注文済みフラグ\n'
        '  orderedOrderNo?: string    // 注文番号\n'
        '  // 履歴\n'
        '  historyLog?: Array<{ at: string; action: string; detail: string }>\n'
        '}\n'
    )
    new_type = (
        '  // 注文済み情報\n'
        '  isOrdered?: boolean        // 注文済みフラグ\n'
        '  orderedOrderNo?: string    // 注文番号\n'
        '  // 履歴\n'
        '  historyLog?: Array<{ at: string; action: string; detail: string }>\n'
        '  // ★2026/07/14 追加: 明細単位の個別直送先設定\n'
        '  // 未設定(false)の場合は見積ヘッダーの共通送り先情報が使われる\n'
        '  useIndividualDestination?: boolean\n'
        '  destinationCode?: string\n'
        '  destinationName?: string\n'
        '  destinationDept?: string\n'
        '  destinationPerson?: string\n'
        '  destinationZip?: string\n'
        '  destinationAddress?: string\n'
        '  destinationTel?: string\n'
        '  destinationFax?: string\n'
        '}\n'
    )
    text = replace_once(text, old_type, new_type, "DetailForm型に個別直送先フィールド追加")

    # 3. newForm() デフォルト値追加
    old_newform = (
        '    customerDetailOrderNo: "", destinationDetailOrderNo: "", remarks: "",\n'
        '    calculated: false,\n'
        '  }\n'
        '}\n'
    )
    new_newform = (
        '    customerDetailOrderNo: "", destinationDetailOrderNo: "", remarks: "",\n'
        '    calculated: false,\n'
        '    useIndividualDestination: false,\n'
        '    destinationCode: "", destinationName: "", destinationDept: "", destinationPerson: "",\n'
        '    destinationZip: "", destinationAddress: "", destinationTel: "", destinationFax: "",\n'
        '  }\n'
        '}\n'
    )
    text = replace_once(text, old_newform, new_newform, "newForm()デフォルト値追加")

    # 4. 明細行編集エリアに「直送先個別設定」ボタン＋展開パネルを追加
    old_row = (
        '            {/* 注文番号・備考 */}\n'
        '            <tr>\n'
        '              <td colSpan={17} style={TD}>\n'
        '                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>\n'
        '                  <div style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: "180px" }}>\n'
        '                    <span style={{ fontSize: "9px", color: "#64748b" }}>お客様注文番号</span>\n'
        '                    <input id="f-custDetailNo" style={INP} value={form.customerDetailOrderNo}\n'
        '                      onChange={e => { console.log("[客注文番号]→",e.target.value); setForm(f => ({ ...f, customerDetailOrderNo: e.target.value })) }}\n'
        '                      onKeyDown={onEnter("f-destDetailNo")} {...FH} />\n'
        '                  </div>\n'
        '                  <div style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: "180px" }}>\n'
        '                    <span style={{ fontSize: "9px", color: "#64748b" }}>送り先注文番号</span>\n'
        '                    <input id="f-destDetailNo" style={INP} value={form.destinationDetailOrderNo}\n'
        '                      onChange={e => { console.log("[送先注文番号]→",e.target.value); setForm(f => ({ ...f, destinationDetailOrderNo: e.target.value })) }}\n'
        '                      onKeyDown={onEnter("f-remarks")} {...FH} />\n'
        '                  </div>\n'
        '                  <div style={{ display: "flex", flexDirection: "column", gap: "1px", flex: 1 }}>\n'
        '                    <span style={{ fontSize: "9px", color: "#64748b" }}>備考</span>\n'
        '                    <input id="f-remarks" style={INP} value={form.remarks}\n'
        '                      onChange={e => { console.log("[備考]→",e.target.value); setForm(f => ({ ...f, remarks: e.target.value })) }}\n'
        '                      onKeyDown={onEnter("btn-calc")} {...FH} />\n'
        '                  </div>\n'
        '                </div>\n'
        '              </td>\n'
        '            </tr>\n'
    )
    new_row = old_row + (
        '\n'
        '            {/* ★2026/07/14 追加: 明細単位の直送先個別設定\n'
        '                基本は共通の送り先情報（見積ヘッダー）を使うが、この行だけ\n'
        '                別の送り先を指定したい場合にボタンで展開できるようにする。\n'
        '                内容は共通項目の送り先情報と同じ項目構成。 */}\n'
        '            <tr>\n'
        '              <td colSpan={17} style={{ ...TD, padding: "4px 6px", background: form.useIndividualDestination ? "#eff6ff" : "transparent" }}>\n'
        '                <button type="button"\n'
        '                  onClick={() => setForm(f => ({ ...f, useIndividualDestination: !f.useIndividualDestination }))}\n'
        '                  style={{\n'
        '                    fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "4px", cursor: "pointer",\n'
        '                    border: form.useIndividualDestination ? "1.5px solid #2563eb" : "1px solid #cbd5e1",\n'
        '                    background: form.useIndividualDestination ? "#2563eb" : "#f8fafc",\n'
        '                    color: form.useIndividualDestination ? "#fff" : "#374151",\n'
        '                  }}>\n'
        '                  📍 直送先個別設定{form.useIndividualDestination ? "（有効）" : ""}\n'
        '                </button>\n'
        '                {!form.useIndividualDestination && (\n'
        '                  <span style={{ fontSize: "10px", color: "#94a3b8", marginLeft: "8px" }}>\n'
        '                    未設定時は共通の送り先情報が使われます\n'
        '                  </span>\n'
        '                )}\n'
        '\n'
        '                {form.useIndividualDestination && (\n'
        '                  <div style={{ marginTop: "6px", padding: "8px", background: "#fff", border: "1.5px solid #93c5fd", borderRadius: "6px" }}>\n'
        '                    <div style={{ fontSize: "10px", fontWeight: 700, color: "#1d4ed8", marginBottom: "4px" }}>\n'
        '                      この明細だけの送り先（共通の送り先情報とは別に指定）\n'
        '                    </div>\n'
        '                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "flex-end" }}>\n'
        '                      <div style={{ display: "flex", flexDirection: "column", gap: "1px", width: "80px" }}>\n'
        '                        <span style={{ fontSize: "9px", color: "#64748b" }}>出荷先</span>\n'
        '                        <input style={INP} value={form.destinationCode ?? ""}\n'
        '                          onChange={e => setForm(f => ({ ...f, destinationCode: e.target.value }))} />\n'
        '                      </div>\n'
        '                      <div style={{ display: "flex", flexDirection: "column", gap: "1px", width: "150px" }}>\n'
        '                        <span style={{ fontSize: "9px", color: "#64748b" }}>出荷先名</span>\n'
        '                        <input style={INP} value={form.destinationName ?? ""}\n'
        '                          onChange={e => setForm(f => ({ ...f, destinationName: e.target.value }))} />\n'
        '                      </div>\n'
        '                      <div style={{ display: "flex", flexDirection: "column", gap: "1px", width: "120px" }}>\n'
        '                        <span style={{ fontSize: "9px", color: "#64748b" }}>出荷先部署</span>\n'
        '                        <input style={INP} value={form.destinationDept ?? ""}\n'
        '                          onChange={e => setForm(f => ({ ...f, destinationDept: e.target.value }))} />\n'
        '                      </div>\n'
        '                      <div style={{ display: "flex", flexDirection: "column", gap: "1px", width: "100px" }}>\n'
        '                        <span style={{ fontSize: "9px", color: "#64748b" }}>ご担当者</span>\n'
        '                        <input style={INP} value={form.destinationPerson ?? ""}\n'
        '                          onChange={e => setForm(f => ({ ...f, destinationPerson: e.target.value }))} />\n'
        '                      </div>\n'
        '                      <div style={{ display: "flex", flexDirection: "column", gap: "1px", width: "90px" }}>\n'
        '                        <span style={{ fontSize: "9px", color: "#64748b" }}>郵便番号</span>\n'
        '                        <input style={INP} value={form.destinationZip ?? ""}\n'
        '                          onChange={e => setForm(f => ({ ...f, destinationZip: e.target.value }))} />\n'
        '                      </div>\n'
        '                      <div style={{ display: "flex", flexDirection: "column", gap: "1px", flex: 1, minWidth: "200px" }}>\n'
        '                        <span style={{ fontSize: "9px", color: "#64748b" }}>住所</span>\n'
        '                        <input style={INP} value={form.destinationAddress ?? ""}\n'
        '                          onChange={e => setForm(f => ({ ...f, destinationAddress: e.target.value }))} />\n'
        '                      </div>\n'
        '                      <div style={{ display: "flex", flexDirection: "column", gap: "1px", width: "110px" }}>\n'
        '                        <span style={{ fontSize: "9px", color: "#64748b" }}>TEL</span>\n'
        '                        <input style={INP} value={form.destinationTel ?? ""}\n'
        '                          onChange={e => setForm(f => ({ ...f, destinationTel: e.target.value }))} />\n'
        '                      </div>\n'
        '                      <div style={{ display: "flex", flexDirection: "column", gap: "1px", width: "110px" }}>\n'
        '                        <span style={{ fontSize: "9px", color: "#64748b" }}>FAX</span>\n'
        '                        <input style={INP} value={form.destinationFax ?? ""}\n'
        '                          onChange={e => setForm(f => ({ ...f, destinationFax: e.target.value }))} />\n'
        '                      </div>\n'
        '                    </div>\n'
        '                  </div>\n'
        '                )}\n'
        '              </td>\n'
        '            </tr>\n'
    )
    text = replace_once(text, old_row, new_row, "明細行編集エリア: 直送先個別設定ボタン＋パネル追加")

    # 5. 登録済み明細一覧: 各行をFragmentで包み、個別直送先サマリー行を追加
    old_list_row = (
        '            ) : details.map((d, i) => (\n'
        '              <tr key={d.clientDetailId} style={{ background: d.isOrdered ? "#fefce8" : i % 2 === 0 ? "#fff" : "#f0fdf4" }}>\n'
        '                <td style={{ ...TD, textAlign: "center", width: "60px" }}>\n'
        '                  {d.isOrdered ? (\n'
        '                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>\n'
        '                      <span style={{ background: "#16a34a", color: "#fff", fontSize: "9px", fontWeight: 700, padding: "1px 5px", borderRadius: "9999px", whiteSpace: "nowrap" }}>注文済</span>\n'
        '                      {d.orderedOrderNo && <span style={{ fontSize: "9px", color: "#166534", fontWeight: 600 }}>{d.orderedOrderNo}</span>}\n'
        '                    </div>\n'
        '                  ) : detailPattern(d) === 3 ? (\n'
        '                    <input type="checkbox" checked={selectedIds.has(d.clientDetailId)} onChange={e => selOne(d.clientDetailId, e.target.checked)} title="注文可能" />\n'
        '                  ) : (\n'
        '                    <span title={detailPattern(d) === 1 ? "金額未算出のため注文不可" : "納期未回答のため注文不可"}\n'
        '                      style={{ fontSize: "9px", color: "#94a3b8", cursor: "default" }}>\n'
        '                      {detailPattern(d) === 1 ? "❶" : "❷"}\n'
        '                    </span>\n'
        '                  )}\n'
        '                </td>\n'
        '                <td style={{ ...TD, textAlign: "center" }}>{i + 1}</td>\n'
        '                <td style={TD}>{materials.find(m => m.materialCode === d.materialCode)?.materialName ?? d.materialCode}</td>\n'
        '                <td style={TD}>\n'
        '                  <div style={{ fontWeight: 700 }}>{d.shiagari}</div>\n'
        '                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#334155", marginTop: "2px" }}>\n'
        '                    T:{d.kakouShijiCodeT || "-"} A:{d.kakouShijiCodeA || "-"} B:{d.kakouShijiCodeB || "-"}\n'
        '                  </div>\n'
        '                </td>\n'
        '                <td style={{ ...TD, textAlign: "right" }}>{d.sizeT}</td>\n'
        '                <td style={{ ...TD, textAlign: "right" }}>{d.sizeA}</td>\n'
        '                <td style={{ ...TD, textAlign: "right" }}>{d.sizeB}</td>\n'
        '                <td style={{ ...TD, textAlign: "center" }}>{d.mentori4 ? `4C:${d.mentori4}` : ""}{d.mentori8 ? ` 8C:${d.mentori8}` : ""}</td>\n'
        '                <td style={{ ...TD, textAlign: "right" }}>{d.quantity}</td>\n'
        '                <td style={{ ...TD, textAlign: "center", color: !d.fastDeliveryDate ? "#b45309" : isExpired(d.deliveryDeadline) ? "#ef4444" : "#374151" }}>\n'
        '                  {d.fastDeliveryDate\n'
        '                    ? <>{fmt(d.fastDeliveryDate)}{isExpired(d.deliveryDeadline) && <span style={{ color: "#ef4444", fontSize: "9px" }}> ⚠期限切</span>}</>\n'
        '                    : <span style={{ fontWeight: 700, fontSize: "10px" }}>納期回答待ち</span>}\n'
        '                </td>\n'
        '                <td style={{ ...TD, textAlign: "center" }}>\n'
        '                  {d.deliveryDeadline ? (\n'
        '                    <>\n'
        '                      <div style={{ fontSize: "10px", color: isExpired(d.deliveryDeadline) ? "#ef4444" : "#334155", fontWeight: 600 }}>{fmtDt(d.deliveryDeadline)}</div>\n'
        '                      <div style={{ fontSize: "9px", fontWeight: 700, color: remainingLabel(d.deliveryDeadline).color }}>{remainingLabel(d.deliveryDeadline).text}</div>\n'
        '                    </>\n'
        '                  ) : "—"}\n'
        '                </td>\n'
        '                <td style={TD}>{d.customerDetailOrderNo}</td>\n'
        '                <td style={{ ...TD, textAlign: "right", fontFamily: "monospace" }}>{d.unitPrice != null ? "¥" + d.unitPrice.toLocaleString() : "—"}</td>\n'
        '                <td style={{ ...TD, textAlign: "right", fontFamily: "monospace" }}>{d.totalPrice != null ? "¥" + d.totalPrice.toLocaleString() : "—"}</td>\n'
        '                <td style={{ ...TD, textAlign: "center" }}>\n'
        '                  <div style={{ display: "flex", gap: "4px", justifyContent: "center", flexWrap: "wrap" }}>\n'
        '                    {!d.isOrdered && (\n'
        '                      <>\n'
        '                        <button className="btn-ochi btn-blue" style={{ fontSize: "11px", padding: "2px 8px", height: "26px" }} onClick={() => handleEditDetail(d.clientDetailId)}>✏️ 編集</button>\n'
        '                        <button className="btn-ochi btn-gray" style={{ fontSize: "11px", padding: "2px 8px", height: "26px" }} onClick={() => handleDuplicateDetail(d.clientDetailId)}>📋 複写</button>\n'
        '                        <button className="btn-ochi btn-red" style={{ fontSize: "11px", padding: "2px 8px", height: "26px" }} onClick={() => handleDel(d.clientDetailId)}>🗑️ 削除</button>\n'
        '                      </>\n'
        '                    )}\n'
        '                    {d.isOrdered && (\n'
        '                      <button className="btn-ochi btn-gray" style={{ fontSize: "11px", padding: "2px 8px", height: "26px" }} onClick={() => handleDuplicateDetail(d.clientDetailId)}>📋 複写</button>\n'
        '                    )}\n'
        '                    <button className="btn-ochi btn-outline" style={{ fontSize: "11px", padding: "2px 8px", height: "26px" }}\n'
        '                      onClick={() => setHistoryModal({ id: d.clientDetailId, log: d.historyLog ?? [] })}\n'
        '                      title="変更履歴">📋 履歴</button>\n'
        '                  </div>\n'
        '                </td>\n'
        '              </tr>\n'
        '            ))}\n'
    )
    new_list_row = (
        '            ) : details.map((d, i) => (\n'
        '              <Fragment key={d.clientDetailId}>\n'
        '              <tr style={{ background: d.isOrdered ? "#fefce8" : i % 2 === 0 ? "#fff" : "#f0fdf4" }}>\n'
        '                <td style={{ ...TD, textAlign: "center", width: "60px" }}>\n'
        '                  {d.isOrdered ? (\n'
        '                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>\n'
        '                      <span style={{ background: "#16a34a", color: "#fff", fontSize: "9px", fontWeight: 700, padding: "1px 5px", borderRadius: "9999px", whiteSpace: "nowrap" }}>注文済</span>\n'
        '                      {d.orderedOrderNo && <span style={{ fontSize: "9px", color: "#166534", fontWeight: 600 }}>{d.orderedOrderNo}</span>}\n'
        '                    </div>\n'
        '                  ) : detailPattern(d) === 3 ? (\n'
        '                    <input type="checkbox" checked={selectedIds.has(d.clientDetailId)} onChange={e => selOne(d.clientDetailId, e.target.checked)} title="注文可能" />\n'
        '                  ) : (\n'
        '                    <span title={detailPattern(d) === 1 ? "金額未算出のため注文不可" : "納期未回答のため注文不可"}\n'
        '                      style={{ fontSize: "9px", color: "#94a3b8", cursor: "default" }}>\n'
        '                      {detailPattern(d) === 1 ? "❶" : "❷"}\n'
        '                    </span>\n'
        '                  )}\n'
        '                </td>\n'
        '                <td style={{ ...TD, textAlign: "center" }}>{i + 1}</td>\n'
        '                <td style={TD}>{materials.find(m => m.materialCode === d.materialCode)?.materialName ?? d.materialCode}</td>\n'
        '                <td style={TD}>\n'
        '                  <div style={{ fontWeight: 700 }}>{d.shiagari}</div>\n'
        '                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#334155", marginTop: "2px" }}>\n'
        '                    T:{d.kakouShijiCodeT || "-"} A:{d.kakouShijiCodeA || "-"} B:{d.kakouShijiCodeB || "-"}\n'
        '                  </div>\n'
        '                </td>\n'
        '                <td style={{ ...TD, textAlign: "right" }}>{d.sizeT}</td>\n'
        '                <td style={{ ...TD, textAlign: "right" }}>{d.sizeA}</td>\n'
        '                <td style={{ ...TD, textAlign: "right" }}>{d.sizeB}</td>\n'
        '                <td style={{ ...TD, textAlign: "center" }}>{d.mentori4 ? `4C:${d.mentori4}` : ""}{d.mentori8 ? ` 8C:${d.mentori8}` : ""}</td>\n'
        '                <td style={{ ...TD, textAlign: "right" }}>{d.quantity}</td>\n'
        '                <td style={{ ...TD, textAlign: "center", color: !d.fastDeliveryDate ? "#b45309" : isExpired(d.deliveryDeadline) ? "#ef4444" : "#374151" }}>\n'
        '                  {d.fastDeliveryDate\n'
        '                    ? <>{fmt(d.fastDeliveryDate)}{isExpired(d.deliveryDeadline) && <span style={{ color: "#ef4444", fontSize: "9px" }}> ⚠期限切</span>}</>\n'
        '                    : <span style={{ fontWeight: 700, fontSize: "10px" }}>納期回答待ち</span>}\n'
        '                </td>\n'
        '                <td style={{ ...TD, textAlign: "center" }}>\n'
        '                  {d.deliveryDeadline ? (\n'
        '                    <>\n'
        '                      <div style={{ fontSize: "10px", color: isExpired(d.deliveryDeadline) ? "#ef4444" : "#334155", fontWeight: 600 }}>{fmtDt(d.deliveryDeadline)}</div>\n'
        '                      <div style={{ fontSize: "9px", fontWeight: 700, color: remainingLabel(d.deliveryDeadline).color }}>{remainingLabel(d.deliveryDeadline).text}</div>\n'
        '                    </>\n'
        '                  ) : "—"}\n'
        '                </td>\n'
        '                <td style={TD}>{d.customerDetailOrderNo}</td>\n'
        '                <td style={{ ...TD, textAlign: "right", fontFamily: "monospace" }}>{d.unitPrice != null ? "¥" + d.unitPrice.toLocaleString() : "—"}</td>\n'
        '                <td style={{ ...TD, textAlign: "right", fontFamily: "monospace" }}>{d.totalPrice != null ? "¥" + d.totalPrice.toLocaleString() : "—"}</td>\n'
        '                <td style={{ ...TD, textAlign: "center" }}>\n'
        '                  <div style={{ display: "flex", gap: "4px", justifyContent: "center", flexWrap: "wrap" }}>\n'
        '                    {!d.isOrdered && (\n'
        '                      <>\n'
        '                        <button className="btn-ochi btn-blue" style={{ fontSize: "11px", padding: "2px 8px", height: "26px" }} onClick={() => handleEditDetail(d.clientDetailId)}>✏️ 編集</button>\n'
        '                        <button className="btn-ochi btn-gray" style={{ fontSize: "11px", padding: "2px 8px", height: "26px" }} onClick={() => handleDuplicateDetail(d.clientDetailId)}>📋 複写</button>\n'
        '                        <button className="btn-ochi btn-red" style={{ fontSize: "11px", padding: "2px 8px", height: "26px" }} onClick={() => handleDel(d.clientDetailId)}>🗑️ 削除</button>\n'
        '                      </>\n'
        '                    )}\n'
        '                    {d.isOrdered && (\n'
        '                      <button className="btn-ochi btn-gray" style={{ fontSize: "11px", padding: "2px 8px", height: "26px" }} onClick={() => handleDuplicateDetail(d.clientDetailId)}>📋 複写</button>\n'
        '                    )}\n'
        '                    <button className="btn-ochi btn-outline" style={{ fontSize: "11px", padding: "2px 8px", height: "26px" }}\n'
        '                      onClick={() => setHistoryModal({ id: d.clientDetailId, log: d.historyLog ?? [] })}\n'
        '                      title="変更履歴">📋 履歴</button>\n'
        '                  </div>\n'
        '                </td>\n'
        '              </tr>\n'
        '              {/* ★2026/07/14 追加: 個別直送先が設定されている行にコンパクトなサマリーを表示 */}\n'
        '              {d.useIndividualDestination && (\n'
        '                <tr style={{ background: i % 2 === 0 ? "#fff" : "#f0fdf4" }}>\n'
        '                  <td colSpan={15} style={{ ...TD, padding: "3px 8px", background: "#eff6ff" }}>\n'
        '                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10px", color: "#1d4ed8", flexWrap: "wrap" }}>\n'
        '                      <span style={{ fontWeight: 700, background: "#2563eb", color: "#fff", padding: "1px 6px", borderRadius: "9999px", fontSize: "9px", whiteSpace: "nowrap" }}>📍 個別直送先</span>\n'
        '                      <span style={{ fontWeight: 600 }}>{d.destinationName || "(名称未設定)"}</span>\n'
        '                      {d.destinationDept && <span style={{ color: "#64748b" }}>／{d.destinationDept}</span>}\n'
        '                      {d.destinationPerson && <span style={{ color: "#64748b" }}>／{d.destinationPerson}様</span>}\n'
        '                      {d.destinationZip && <span style={{ color: "#64748b" }}>／〒{d.destinationZip}</span>}\n'
        '                      {d.destinationAddress && <span style={{ color: "#64748b" }}>{d.destinationAddress}</span>}\n'
        '                      {d.destinationTel && <span style={{ color: "#64748b" }}>／TEL:{d.destinationTel}</span>}\n'
        '                      {d.destinationFax && <span style={{ color: "#64748b" }}>／FAX:{d.destinationFax}</span>}\n'
        '                    </div>\n'
        '                  </td>\n'
        '                </tr>\n'
        '              )}\n'
        '              </Fragment>\n'
        '            ))}\n'
    )
    text = replace_once(text, old_list_row, new_list_row, "登録済み明細一覧: 個別直送先サマリー行追加")

    FILE_CLIENT.write_text(text, encoding="utf-8")
    print(f"[OK] パッチ適用完了: {FILE_CLIENT.relative_to(REPO_ROOT)}")


def run_prisma_and_tsc():
    print("[INFO] npx prisma db push を実行します（新カラムをDBへ反映）...")
    r1 = subprocess.run(["npx", "prisma", "db", "push", "--skip-generate"],
                         cwd=str(REPO_ROOT), capture_output=True, text=True)
    print(r1.stdout)
    if r1.returncode != 0:
        print(r1.stderr)
        die("prisma db push に失敗しました。GitHubへのPushは行いません。")

    print("[INFO] npx prisma generate を実行します（Prisma Clientの型更新）...")
    r2 = subprocess.run(["npx", "prisma", "generate"],
                         cwd=str(REPO_ROOT), capture_output=True, text=True)
    print(r2.stdout)
    if r2.returncode != 0:
        print(r2.stderr)
        die("prisma generate に失敗しました。GitHubへのPushは行いません。")

    print("[INFO] tsc --noEmit --skipLibCheck を実行します...")
    r3 = subprocess.run(["npx", "tsc", "--noEmit", "--skipLibCheck"],
                         cwd=str(REPO_ROOT), capture_output=True, text=True)
    if r3.returncode != 0:
        print("[NG] コンパイルエラーが検出されました。GitHubへのPushは行いません。")
        print(r3.stdout)
        print(r3.stderr)
        sys.exit(1)
    print("[OK] コンパイルエラー0件を確認しました。")


def git_commit_and_push():
    msg = "feat: 見積明細単位の直送先個別設定機能を追加"
    files = [
        "prisma/schema.prisma",
        "src/app/api/v1/estimates/route.ts",
        "src/app/api/v1/estimates/[id]/route.ts",
        "src/app/(app)/estimates/new/page.tsx",
        "src/app/(app)/estimates/[id]/edit/page.tsx",
        "src/app/(app)/estimates/new/EstimateNewClient.tsx",
    ]
    subprocess.run(["git", "add", *files], cwd=str(REPO_ROOT), check=True)
    commit = subprocess.run(["git", "commit", "-m", msg], cwd=str(REPO_ROOT),
                             capture_output=True, text=True)
    print(commit.stdout)
    if commit.returncode != 0:
        print(commit.stderr)
        die("git commit に失敗しました（適用済みで差分が無い可能性があります）。")
    push = subprocess.run(["git", "push"], cwd=str(REPO_ROOT),
                           capture_output=True, text=True)
    print(push.stdout)
    print(push.stderr)
    if push.returncode != 0:
        die("git push に失敗しました。")
    print("[OK] GitHubへのpushが完了しました。")


def main():
    patch_schema_if_needed()
    patch_post_if_needed()
    patch_put_if_needed()
    patch_new_page()
    patch_edit_page()
    patch_client()
    run_prisma_and_tsc()
    git_commit_and_push()
    try:
        Path(__file__).unlink()
        print("[OK] スクリプト自身を削除しました。")
    except Exception as e:
        print(f"[WARN] スクリプト自身の削除に失敗: {e}")


if __name__ == "__main__":
    main()
