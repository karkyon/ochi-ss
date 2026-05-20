#!/usr/bin/env python3
"""fix_final_edit_option.py - EditClient processingSpecs option 最終1件"""
from pathlib import Path

ROOT = Path.home() / "projects" / "ochi-ss"
EDIT_CLIENT = ROOT / "src/app/(app)/estimates/[id]/edit/EstimateEditClient.tsx"

# 実際のパターン（インライン形式）
OLD = """\
    {processingSpecs.map(s => (
                  <option key={s.processingSpecCode} value={s.processingSpecCode}>{s.processingSpecName}</option>
                ))}"""

NEW = """\
    {(materialProcessingMap[detailForm.materialCode]
                ? processingSpecs.filter(s =>
                    materialProcessingMap[detailForm.materialCode].includes(s.processingSpecCode))
                : processingSpecs
              ).map(s => (
                  <option key={s.processingSpecCode} value={s.processingSpecCode}>{s.processingSpecName}</option>
                ))}"""

content = EDIT_CLIENT.read_text(encoding="utf-8")

if "materialProcessingMap[detailForm.materialCode]" in content:
    print("✅ 既に適用済み")
elif OLD in content:
    content = content.replace(OLD, NEW, 1)
    EDIT_CLIENT.write_text(content, encoding="utf-8")
    print("✅ EstimateEditClient.tsx: processingSpecs option フィルタ適用")
    print()
    print("git add -A")
    print('git commit -m "feat(Task2-3): EditClient processingSpecs 動的フィルタ option 適用"')
    print("git push")
else:
    print("❌ パターン不一致。実際のコードを確認:")
    idx = content.find("processingSpecs.map(s =>")
    if idx >= 0:
        print(repr(content[idx-10:idx+200]))
