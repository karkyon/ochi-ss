// =============================================================
//  src/proxy.ts — 認証チェック + セキュリティヘッダー + CSRF Origin検証
// =============================================================
import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export default auth((req) => {
  const { nextUrl, auth: session } = req
  const isLoggedIn = !!session

  const isLoginPage  = nextUrl.pathname === "/login"
  const isApiAuth    = nextUrl.pathname.startsWith("/api/auth")
  const isApiRoute   = nextUrl.pathname.startsWith("/api/")
  const isStaticFile = nextUrl.pathname.startsWith("/_next/")

  // NextAuth 内部 API は常に通過
  if (isApiAuth || isStaticFile) return NextResponse.next()

  // CSRF: POST/PUT/PATCH/DELETE の API に Origin 検証
  if (isApiRoute && ["POST","PUT","PATCH","DELETE"].includes(req.method ?? "")) {
    const origin  = req.headers.get("origin")  ?? ""
    const host    = req.headers.get("host")    ?? ""
    const referer = req.headers.get("referer") ?? ""

    const allowedOrigins = [
      process.env.NEXTAUTH_URL ?? "",
      `https://${host}`,
      `http://${host}`,
    ].filter(Boolean)

    const originOk   = !origin  || allowedOrigins.some(o => origin.startsWith(o))
    const refererOk  = !referer || allowedOrigins.some(o => referer.startsWith(o))

    if (!originOk && !refererOk) {
      return NextResponse.json({ error: "CSRF validation failed" }, { status: 403 })
    }
  }

  // 認証チェック
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl))
  }

  if (!isLoggedIn && !isLoginPage) {
    const loginUrl = new URL("/login", nextUrl)
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
