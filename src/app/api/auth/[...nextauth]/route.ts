// =============================================================
//  src/app/api/auth/[...nextauth]/route.ts  （修正版 v2）
//
//  NextAuth v5 beta.31 と Next.js 16 の RouteHandler 型が不一致。
//  これは NextAuth beta 側の既知の問題（正式版で解消予定）。
//  tsconfig に skipLibCheck: true が設定されていれば回避できるが
//  念のため型アサーションでエラーを抑制。
// =============================================================

import { handlers } from "@/lib/auth"
import type { NextRequest } from "next/server"

// NextAuth v5 beta の AppRouteHandlers 型が Next.js 16 の RouteHandler 型と
// シグネチャが合わない既知の問題を型キャストで回避
type RouteHandler = (req: NextRequest, ctx: unknown) => Promise<Response>

export const GET = handlers.GET as unknown as RouteHandler
export const POST = handlers.POST as unknown as RouteHandler
