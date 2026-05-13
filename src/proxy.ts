// =============================================================
//  src/proxy.ts  （Next.js 16 では middleware.ts → proxy.ts）
//
//  Next.js 16 で "middleware" ファイル名規約が deprecated になり
//  "proxy" に変更されました。
//  機能は同一: 未認証アクセス → /login にリダイレクト
// =============================================================

import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const { nextUrl, auth: session } = req
  const isLoggedIn = !!session

  const isLoginPage = nextUrl.pathname === "/login"
  const isApiAuth = nextUrl.pathname.startsWith("/api/auth")

  // NextAuth の内部 API は常に通過
  if (isApiAuth) return NextResponse.next()

  // ログイン済みで /login にアクセス → /dashboard へ
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl))
  }

  // 未認証で保護ページにアクセス → /login へ
  if (!isLoggedIn && !isLoginPage) {
    const loginUrl = new URL("/login", nextUrl)
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
