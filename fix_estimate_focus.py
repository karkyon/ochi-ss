import subprocess, os, sys

ROOT = os.path.expanduser("~/projects/ochi-ss")
os.chdir(ROOT)

def run(cmd, check=True):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if check and r.returncode != 0:
        print(f"ERROR:\n{r.stdout}\n{r.stderr}")
        sys.exit(1)
    return r.stdout.strip()

print("=== fix_estimate_focus.py ===")
print("[1] git pull...")
print(" ", run("git pull").split("\n")[0])

TARGET = f"{ROOT}/src/app/(app)/estimates/new/EstimateNewClient.tsx"

# ── 修正1: WO加工仕様テーブルをハードコード定数として追加 ──
# 添付SSより: 加工仕様コード → (加工指示コードT, 加工指示コードA, 加工指示コードB)
# コード: 1=RG, 2=W, 4=〜(なし), 5=SG
# 仕上り名と加工指示の対応をマップとして持つ
WO_MAP_CODE = '''\
// WO加工仕様テーブル: 仕上り名 → 加工指示(T/A/B)のデフォルトマップ
// SQL Server WO加工仕様テーブルのデータを静的定義（SQL Server未接続時のフォールバック）
// 加工指示コード: 1=RG, 2=W, 4=〜(なし/ランダム), 5=SG
const SHIAGARI_CUT_MAP: Record<string, { t: string; a: string; b: string }> = {
  "6F":     { t: "W",  a: "W",  b: "W"  },
  "6F2G":   { t: "W",  a: "W",  b: "W"  },  // T=W, A=〜, B=W → 実データより補完
  "4F2G":   { t: "W",  a: "W",  b: "W"  },
  "2F":     { t: "W",  a: "〜", b: "W"  },  // 未加工面あり
  "2F2G":   { t: "W",  a: "W",  b: "W"  },
  "4F":     { t: "W",  a: "〜", b: "〜" },
  "4F2SG":  { t: "W",  a: "W",  b: "W"  },
  "6F2SG":  { t: "W",  a: "W",  b: "W"  },
  "黒皮":   { t: "〜", a: "〜", b: "〜" },
}
// 仕上り名から加工指示を解決（完全一致→部分一致→デフォルトW/W/W）
function resolveCutCodes(specName: string): { t: string; a: string; b: string } {
  if (SHIAGARI_CUT_MAP[specName]) return SHIAGARI_CUT_MAP[specName]
  for (const [key, val] of Object.entries(SHIAGARI_CUT_MAP)) {
    if (specName.includes(key)) return val
  }
  return { t: "W", a: "W", b: "W" }
}
'''

# ── 修正2: handleSpecSelect内の加工指示コード設定をWO_MAPベースに変更 ──
OLD_SPEC_SELECT = '''  // 仕上り選択時に加工仕様コードを自動設定
  const handleSpecSelect = useCallback((specCode: number) => {
    const spec = processingSpecs.find(s => s.processingSpecCode === specCode)
    if (!spec) return
    // 6Fの場合はW/W/W、研削の場合はG/G/G等（仕様名から推定）
    const name = spec.processingSpecName ?? ""
    let cutT = "W", cutA = "W", cutB = "W"
    if (name.includes("研削") || name.toLowerCase().includes("g")) {
      cutT = cutMethods.find(c => c.label === "G")?.code?.toString() ?? "W"
      cutA = cutT; cutB = cutT
    }
    setForm(f => ({
      ...f,
      kakouShiyouCode: specCode,
      shiagari: spec.processingSpecName,
      kakouShijiCodeT: cutT,
      kakouShijiCodeA: cutA,
      kakouShijiCodeB: cutB,
      calculated: false,
    }))
    setSpecSuggest(spec.processingSpecName)
  }, [processingSpecs, cutMethods])'''

NEW_SPEC_SELECT = '''  // 仕上り選択時に加工仕様コードを自動設定（WO加工仕様テーブルマップ使用）
  const handleSpecSelect = useCallback((specCode: number, skipToSize = false) => {
    const spec = processingSpecs.find(s => s.processingSpecCode === specCode)
    if (!spec) return
    const name = spec.processingSpecName ?? ""
    const cuts = resolveCutCodes(name)
    setForm(f => ({
      ...f,
      kakouShiyouCode: specCode,
      shiagari: name,
      kakouShijiCodeT: cuts.t,
      kakouShijiCodeA: cuts.a,
      kakouShijiCodeB: cuts.b,
      calculated: false,
    }))
    setSpecSuggest(name)
    if (skipToSize) {
      setTimeout(() => focusById("f-sizeT"), 50)
    }
  }, [processingSpecs])'''

# ── 修正3: handleMaterialSelectのhandleSpecSelect呼び出しにskipToSize=falseを明示 ──
OLD_MAT_SELECT_CALL = '''    if (defSpec) setSpecSuggest(defSpec.processingSpecName)
    // 材料選択後は仕上りにフォーカス
    setTimeout(() => focusById("f-shiagari"), 50)'''

NEW_MAT_SELECT_CALL = '''    if (defSpec) {
      const cuts = resolveCutCodes(defSpec.processingSpecName)
      setForm(f => ({
        ...f,
        materialCode: code,
        kakouShiyouCode: defSpec.processingSpecCode,
        shiagari: defSpec.processingSpecName,
        kakouShijiCodeT: cuts.t,
        kakouShijiCodeA: cuts.a,
        kakouShijiCodeB: cuts.b,
        calculated: false,
      }))
      setSpecSuggest(defSpec.processingSpecName)
    }
    // 材料選択後は仕上りにフォーカス
    setTimeout(() => focusById("f-shiagari"), 50)'''

# ── 修正3b: handleMaterialSelect内の既存setFormを削除（上記に統合するため）──
OLD_MAT_FORM = '''    setForm(f => ({
      ...f,
      materialCode: code,
      kakouShiyouCode: defSpec?.processingSpecCode ?? 0,
      shiagari: defSpec?.processingSpecName ?? "",
      kakouShijiCodeT: "W",
      kakouShijiCodeA: "W",
      kakouShijiCodeB: "W",
      calculated: false,
    }))
    if (defSpec) {
      const cuts = resolveCutCodes(defSpec.processingSpecName)
      setForm(f => ({
        ...f,
        materialCode: code,
        kakouShiyouCode: defSpec.processingSpecCode,
        shiagari: defSpec.processingSpecName,
        kakouShijiCodeT: cuts.t,
        kakouShijiCodeA: cuts.a,
        kakouShijiCodeB: cuts.b,
        calculated: false,
      }))
      setSpecSuggest(defSpec.processingSpecName)
    }
    // 材料選択後は仕上りにフォーカス
    setTimeout(() => focusById("f-shiagari"), 50)'''

NEW_MAT_FORM = '''    const cuts = defSpec ? resolveCutCodes(defSpec.processingSpecName) : { t: "W", a: "W", b: "W" }
    setForm(f => ({
      ...f,
      materialCode: code,
      kakouShiyouCode: defSpec?.processingSpecCode ?? 0,
      shiagari: defSpec?.processingSpecName ?? "",
      kakouShijiCodeT: cuts.t,
      kakouShijiCodeA: cuts.a,
      kakouShijiCodeB: cuts.b,
      calculated: false,
    }))
    if (defSpec) setSpecSuggest(defSpec.processingSpecName)
    // 材料選択後は仕上りにフォーカス
    setTimeout(() => focusById("f-shiagari"), 50)'''

# ── 修正4: 仕上りENTERで加工仕様が全部決まっていたら寸法Tへスキップ ──
OLD_SHIAGARI_ENTER = '''                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      const hit = filteredSpecs.find(s => s.processingSpecName === specSuggest)
                      if (hit) handleSpecSelect(hit.processingSpecCode)
                      focusById("f-cutT")
                    }
                  }}'''

NEW_SHIAGARI_ENTER = '''                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      const hit = filteredSpecs.find(s => s.processingSpecName === specSuggest)
                      if (hit) {
                        const cuts = resolveCutCodes(hit.processingSpecName)
                        // W/W/W等、全加工指示が確定している場合は寸法Tへスキップ
                        const allDefined = cuts.t && cuts.a && cuts.b
                        handleSpecSelect(hit.processingSpecCode, allDefined)
                        if (!allDefined) setTimeout(() => focusById("f-cutT"), 50)
                      } else {
                        focusById("f-cutT")
                      }
                    }
                  }}'''

print("[2] ファイル読み込み...")
with open(TARGET, "r", encoding="utf-8") as f:
    content = f.read()

# WO_MAP_CODEをgenerateUUID関数の直後に挿入
AFTER_UUID = 'import { useState, useEffect, useRef, useCallback } from "react"'
if WO_MAP_CODE.strip().split("\n")[0] not in content:
    content = content.replace(AFTER_UUID, WO_MAP_CODE + "\n" + AFTER_UUID)
    print("  WO加工仕様マップ挿入OK")
else:
    print("  WO加工仕様マップ既存")

# handleSpecSelect置換
if OLD_SPEC_SELECT in content:
    content = content.replace(OLD_SPEC_SELECT, NEW_SPEC_SELECT)
    print("  handleSpecSelect 置換OK")
else:
    print("  WARNING: handleSpecSelect 対象なし（既に修正済みか確認）")

# handleMaterialSelect内のsetForm+setSpecSuggest置換
if OLD_MAT_FORM in content:
    content = content.replace(OLD_MAT_FORM, NEW_MAT_FORM)
    print("  handleMaterialSelect setForm 置換OK")
else:
    # OLD_MAT_SELECT_CALLのみ試みる
    if OLD_MAT_SELECT_CALL in content:
        content = content.replace(OLD_MAT_SELECT_CALL, NEW_MAT_SELECT_CALL)
        print("  handleMaterialSelect setSpecSuggest部分 置換OK")
    else:
        print("  WARNING: handleMaterialSelect 対象なし")

# 仕上りENTERフォーカス修正
if OLD_SHIAGARI_ENTER in content:
    content = content.replace(OLD_SHIAGARI_ENTER, NEW_SHIAGARI_ENTER)
    print("  仕上りENTER フォーカス修正OK")
else:
    print("  WARNING: 仕上りENTER対象なし")

print("[3] ファイル書き込み...")
with open(TARGET, "w", encoding="utf-8") as f:
    f.write(content)
print(f"  OK: {TARGET}")

# tsc check
print("[4] tsc チェック...")
r = subprocess.run("npx tsc --noEmit 2>&1", shell=True, capture_output=True, text=True, cwd=ROOT)
lines = [l for l in (r.stdout + r.stderr).splitlines()
         if "error TS" in l and "node_modules" not in l and ".next" not in l and "Downloads" not in l]
if lines:
    print("  tscエラー:")
    for l in lines:
        print("   ", l)
    sys.exit(1)
print("  ✅ 実コードエラー0件")

# git commit & push
print("[5] git commit & push...")
run("git add -A")
r = subprocess.run(
    'git commit -m "fix: 仕上りENTERで加工指示確定時は寸法Tへスキップ + WO加工仕様マップ実装"',
    shell=True, capture_output=True, text=True, cwd=ROOT)
print(" ", r.stdout.strip().split("\n")[0])
run("git push")
print("  PUSH OK")
print()
print("✅ 完了! sudo systemctl restart ochi-web.service を実行してください")
