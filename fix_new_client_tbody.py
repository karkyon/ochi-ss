#!/usr/bin/env python3
"""
fix_new_client_tbody.py
EstimateNewClient の tbody に公差・面取りセルを追加
（実際のコードパターン: px-3 py-2.5 text-right text-gray-600 {d.quantity}）
"""

import os

def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()

def write(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  ✅ 書き込み完了: {path}")

def patch(content, old, new, label):
    if old not in content:
        print(f"  ⚠️  [{label}] 未発見")
        return content, False
    result = content.replace(old, new, 1)
    print(f"  ✅ [{label}] 適用")
    return result, True

path = "src/app/(app)/estimates/new/EstimateNewClient.tsx"

content = read(path)

# 既に適用済み確認
if "kousaTUpper ||" in content:
    print("  ℹ️  公差セルは既に適用済み（スキップ）")
    exit(0)

# 実際のパターン（プロジェクトナレッジから確認）:
# <td className="px-3 py-2.5 text-right text-gray-600">{d.quantity}</td>
# の前に公差・面取りを挿入

old = (
    '                    <td className="px-3 py-2.5 text-right text-gray-600">{d.quantity}</td>\n'
    '                    <td className="px-3 py-2.5 text-right text-gray-700">\n'
    '                      {d.unitPrice != null ? `¥${d.unitPrice.toLocaleString()}` : "—"}'
)
new = (
    '                    <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-[10px]">\n'
    '                      {d.kousaTUpper || d.kousaTLower ? `+${d.kousaTUpper||0}/-${d.kousaTLower||0}` : "–"}\n'
    '                    </td>\n'
    '                    <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-[10px]">\n'
    '                      {d.kousaAUpper || d.kousaALower ? `+${d.kousaAUpper||0}/-${d.kousaALower||0}` : "–"}\n'
    '                    </td>\n'
    '                    <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-[10px]">\n'
    '                      {d.kousaBUpper || d.kousaBLower ? `+${d.kousaBUpper||0}/-${d.kousaBLower||0}` : "–"}\n'
    '                    </td>\n'
    '                    <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-[10px]">{d.mentori4 || "–"}</td>\n'
    '                    <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-[10px]">{d.mentori8 || "–"}</td>\n'
    '                    <td className="px-3 py-2.5 text-right text-gray-600">{d.quantity}</td>\n'
    '                    <td className="px-3 py-2.5 text-right text-gray-700">\n'
    '                      {d.unitPrice != null ? `¥${d.unitPrice.toLocaleString()}` : "—"}'
)
content, ok = patch(content, old, new, "New tbody: 公差・面取りセル追加（py-2.5/gray-600版）")

if ok:
    write(path, content)
    print("\n次ステップ:")
    print("  npx tsc --noEmit")
    print("  git add -A && git commit -m 'fix: NewClient tbody 公差・面取りセル追加'")
    print("  git push")
else:
    # パターンが見つからない場合、前後コンテキストを表示
    idx = content.find("{d.quantity}")
    if idx >= 0:
        start = max(0, idx - 200)
        end = min(len(content), idx + 300)
        print("\n  実際のコンテキスト:")
        print(repr(content[start:end]))
