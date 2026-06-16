import subprocess, os, sys

ROOT = os.path.expanduser("~/projects/ochi-ss")
os.chdir(ROOT)

def run(cmd, check=True):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if check and r.returncode != 0:
        print(f"ERROR: {r.stdout}\n{r.stderr}")
        sys.exit(1)
    return r.stdout.strip()

print("=== fix_proxy_auth.py ===")
print("[1] git pull...")
print(" ", run("git pull").split("\n")[0])

# proxy.ts 完全書き直し
# 問題: /api/v1/* ルートが未認証時に /login へ307リダイレクトされていた
# 原因: isApiRoute のとき認証チェックをスキップする処理が存在しなかった
# 修正: APIルートは認証チェックをスキップして NextResponse.next() を返す
#       （各APIルート内で個別に auth() チェックしているため）
#       ただし /api/v1/auth/pre-check は認証不要のため明示的に除外

PROXY_TS = r'''// =============================================================
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

  // NextAuth 内部 API・静的ファイルは常に通過
  if (isApiAuth || isStaticFile) return NextResponse.next()

  // API ルート全般は認証チェックをスキップ
  // （各 route.ts 内で個別に auth() / getTenantCtx() による認証を実施）
  // ※ pre-check・postal-code 等の公開 API もここで通過させる
  if (isApiRoute) {
    // CSRF: POST/PUT/PATCH/DELETE に Origin 検証（認証不要 API も対象）
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method ?? "")) {
      const origin  = req.headers.get("origin")  ?? ""
      const host    = req.headers.get("host")    ?? ""
      const referer = req.headers.get("referer") ?? ""

      const allowedOrigins = [
        process.env.NEXTAUTH_URL ?? "",
        `https://${host}`,
        `http://${host}`,
      ].filter(Boolean)

      const originOk  = !origin  || allowedOrigins.some(o => origin.startsWith(o))
      const refererOk = !referer || allowedOrigins.some(o => referer.startsWith(o))

      if (!originOk && !refererOk) {
        return NextResponse.json({ error: "CSRF validation failed" }, { status: 403 })
      }
    }
    return NextResponse.next()
  }

  // ページルート: 認証チェック
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
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
'''

target = f"{ROOT}/src/proxy.ts"
with open(target, "w", encoding="utf-8") as f:
    f.write(PROXY_TS)
print(f"  OK: {target}")

# tsc check
print("[2] tsc チェック...")
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
print("[3] git commit & push...")
run("git add -A")
r = subprocess.run(
    'git commit -m "fix: proxy.ts — APIルートをmiddleware認証チェックから除外→pre-check 307問題修正"',
    shell=True, capture_output=True, text=True, cwd=ROOT)
print(" ", r.stdout.strip().split("\n")[0])
run("git push")
print("  PUSH OK")

print()
print("✅ 完了! sudo systemctl restart ochi-web.service を実行してください")
