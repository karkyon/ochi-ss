#!/usr/bin/env python3
"""
fix_phase9_ops.py  Phase 9: 運用基盤・品質向上
=============================================================
Task 9-1-2: docker-compose.yml に cron コンテナ追加
Task 9-2-1: POST /api/v1/orders/[id]/cancel 実装（新規ファイル）
Task 9-2-2: orders/[id]/page.tsx にキャンセルボタン追加
=============================================================
"""
import subprocess
from pathlib import Path
import textwrap

ROOT = Path.home() / "projects" / "ochi-ss"
PASS, FAIL = [], []

def apply(label, path, old, new):
    p = ROOT / path
    if not p.exists():
        FAIL.append(f"[{label}] ファイル未存在")
        print(f"  ❌ {label}")
        return False
    c = p.read_text(encoding="utf-8")
    if old not in c:
        FAIL.append(f"[{label}] パターン不一致")
        print(f"  ❌ {label}")
        return False
    p.write_text(c.replace(old, new, 1), encoding="utf-8")
    PASS.append(label)
    print(f"  ✅ {label}")
    return True

def create(label, path, content):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(textwrap.dedent(content).lstrip(), encoding="utf-8")
    PASS.append(label)
    print(f"  ✅ {label}")

def run_tsc():
    r = subprocess.run(["npx","tsc","--noEmit"], cwd=ROOT, capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr

print("=" * 60)
print("  fix_phase9_ops.py  Phase 9: 運用基盤")
print("=" * 60)

# ─────────────────────────────────────────────────────────
# Task 9-1-2: docker-compose.yml に cron コンテナ追加
# ─────────────────────────────────────────────────────────
print("\n[Task 9-1-2] docker-compose.yml cron コンテナ追加")
apply(
    "docker-compose: cron サービス追加",
    "docker/docker-compose.yml",
    """  # -----------------------------------------------------------
  # Caddy（リバースプロキシ + 自動HTTPS）
  # -----------------------------------------------------------""",
    """  # -----------------------------------------------------------
  # Cron（Draft クリーンアップ・定期バッチ）
  # -----------------------------------------------------------
  cron:
    image: node:20-alpine
    container_name: ochi_cron
    restart: unless-stopped
    working_dir: /app
    volumes:
      - ../:/app:ro
      - cron_logs:/var/log/ochi
    environment:
      DATABASE_URL: postgresql://ochi_app:${POSTGRES_PASSWORD}@postgres:5432/ochi_ss
      TZ: Asia/Tokyo
    depends_on:
      postgres:
        condition: service_healthy
    # 毎日0時にDraft期限切れクリーンアップを実行
    command: >
      sh -c "
        apk add --no-cache dcron &&
        echo '0 0 * * * cd /app && npx ts-node --project tsconfig.json scripts/cleanup-expired-drafts.ts >> /var/log/ochi/cleanup.log 2>&1' | crontab - &&
        crond -f -l 2
      "
    networks:
      - ochi_internal

  # -----------------------------------------------------------
  # Caddy（リバースプロキシ + 自動HTTPS）
  # -----------------------------------------------------------"""
)

# docker-compose volumes に cron_logs 追加
apply(
    "docker-compose: cron_logs volume 追加",
    "docker/docker-compose.yml",
    """volumes:
  pgdata:
  redisdata:
  caddy_data:
  caddy_config:""",
    """volumes:
  pgdata:
  redisdata:
  caddy_data:
  caddy_config:
  cron_logs:"""
)

# ─────────────────────────────────────────────────────────
# Task 9-2-1: POST /api/v1/orders/[id]/cancel 新規実装
# ─────────────────────────────────────────────────────────
print("\n[Task 9-2-1] POST /api/v1/orders/[id]/cancel 新規作成")
create(
    "orders cancel API 新規",
    "src/app/api/v1/orders/[id]/cancel/route.ts",
    """
    // POST /api/v1/orders/[id]/cancel — 注文キャンセル
    import { NextRequest, NextResponse } from "next/server"
    import { auth } from "@/lib/auth"
    import { prisma } from "@/lib/prisma"

    interface Props { params: Promise<{ id: string }> }

    export async function POST(
      _req: NextRequest,
      { params }: Props
    ) {
      const session = await auth()
      if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

      const { id } = await params
      const order = await (prisma as any).order.findFirst({
        where: { id, customerId: session.user.customerId!, isDeleted: false },
      })
      if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 })

      // キャンセル可能ステータス: pending / confirmed のみ
      if (!["pending", "confirmed"].includes(order.orderStatus)) {
        return NextResponse.json(
          { error: `${order.orderStatus} の注文はキャンセルできません（製造中・出荷済・完了・取消）` },
          { status: 422 }
        )
      }

      // トランザクション: 注文キャンセル + 見積ステータスを saved に戻す
      await (prisma as any).$transaction(async (tx: any) => {
        await tx.order.update({
          where: { id },
          data: { orderStatus: "cancelled" },
        })
        await tx.estimateHeader.update({
          where: { id: order.estimateHeaderId },
          data: { estimateStatus: "saved" },
        })
        // ステータス履歴記録
        await tx.orderStatusHistory.create({
          data: {
            orderId:      id,
            fromStatus:   order.orderStatus,
            toStatus:     "cancelled",
            changedBy:    session.user.userId ?? "system",
            changeReason: "顧客によるキャンセル",
          },
        }).catch(() => { /* OrderStatusHistory が存在しない場合はスキップ */ })
      })

      return NextResponse.json({ cancelled: true, id, orderStatus: "cancelled" })
    }
    """
)

# ─────────────────────────────────────────────────────────
# Task 9-2-2: orders/[id]/page.tsx にキャンセルボタン追加
# Server Component なので "use client" の OrderCancelButton を別途作成
# ─────────────────────────────────────────────────────────
print("\n[Task 9-2-2] OrderCancelButton クライアントコンポーネント作成")
create(
    "OrderCancelButton コンポーネント",
    "src/app/(app)/orders/[id]/OrderCancelButton.tsx",
    """
    "use client"
    import { useRouter } from "next/navigation"
    import { useState } from "react"

    export default function OrderCancelButton({ orderId, orderNo }: { orderId: string; orderNo: string }) {
      const router = useRouter()
      const [loading, setLoading] = useState(false)

      const handleCancel = async () => {
        if (!confirm(`注文 ${orderNo} をキャンセルしますか？\\nキャンセル後は取り消せません。`)) return
        setLoading(true)
        try {
          const res = await fetch(`/api/v1/orders/${orderId}/cancel`, { method: "POST" })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error ?? "キャンセル失敗")
          router.refresh()
        } catch (e: any) {
          alert(`エラー: ${e.message}`)
        } finally {
          setLoading(false)
        }
      }

      return (
        <button
          onClick={handleCancel}
          disabled={loading}
          className="px-4 py-2 rounded-lg border border-red-300 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "処理中..." : "🚫 注文キャンセル"}
        </button>
      )
    }
    """
)

print("\n[Task 9-2-2] orders/[id]/page.tsx にキャンセルボタン統合")
# page.tsx の import に OrderCancelButton を追加
apply(
    "orders/[id]/page.tsx: import 追加",
    "src/app/(app)/orders/[id]/page.tsx",
    'import Link from "next/link"',
    'import Link from "next/link"\nimport OrderCancelButton from "./OrderCancelButton"'
)

# 「注文書PDF」ボタンの近くにキャンセルボタンを追加
# 既存のアクションボタン行を探す
apply(
    "orders/[id]/page.tsx: キャンセルボタン追加",
    "src/app/(app)/orders/[id]/page.tsx",
    '          <Link href={`/api/v1/orders/${order.id}/pdf`} target="_blank"\n            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors">\n            🖨️ 注文書PDF\n          </Link>',
    '          <Link href={`/api/v1/orders/${order.id}/pdf`} target="_blank"\n            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors">\n            🖨️ 注文書PDF\n          </Link>\n          {["pending", "confirmed"].includes(order.orderStatus) && (\n            <OrderCancelButton orderId={order.id} orderNo={order.orderNo ?? order.id.slice(0, 8)} />\n          )}'
)

# ─────────────────────────────────────────────────────────
# TypeScript チェック
# ─────────────────────────────────────────────────────────
print("\n[TypeScript チェック]")
code, out = run_tsc()
if code == 0:
    print("  ✅ tsc --noEmit: エラーなし")
else:
    print(f"  ❌ tsc エラー:\n{out}")
    FAIL.append("tsc")

print("\n" + "=" * 60)
print(f"  完了: {len(PASS)}件  失敗: {len(FAIL)}件")
if FAIL:
    print("\n  ❌ 失敗:")
    for f in FAIL: print(f"    {f}")
if not any("tsc" in f for f in FAIL):
    print("""
  ✅ Phase 9 実装完了！
  git add -A && git commit -m 'feat: Phase9 cron/注文キャンセルAPI/キャンセルボタン'
  git push
""")
print("=" * 60)
