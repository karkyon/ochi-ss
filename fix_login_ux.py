import subprocess, os, sys, base64, datetime

ROOT = os.path.expanduser("~/projects/ochi-ss")
os.chdir(ROOT)

def run(cmd, check=True):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if check and r.returncode != 0:
        print(f"ERROR: {cmd}\n{r.stdout}\n{r.stderr}")
        sys.exit(1)
    return r.stdout.strip()

print("=== fix_login_ux.py ===")
print("[1] git pull...")
out = run("git pull")
print(" ", out.split("\n")[0])

# LoginClient.tsx 完全書き直し
LOGIN_CLIENT = r'''"use client"
import { useState, useRef, FormEvent, useEffect } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"

// ─────────────────────────────────────────────
// エラーコード → 表示設定マッピング
// ─────────────────────────────────────────────
type ErrLevel = "error" | "warning" | "info" | "server"
interface ErrDisplay {
  level: ErrLevel
  icon: string
  title: string
  body: string
  /** フォーカスを移すフィールド */
  focus?: "companyCode" | "userId" | "password"
}

function getErrDisplay(code: number, msg?: string): ErrDisplay {
  switch (code) {
    case -4:
      return {
        level: "error",
        icon: "🏢",
        title: "企業コードが正しくありません",
        body: "入力した企業コードは登録されていません。5桁の数字を確認してください。",
        focus: "companyCode",
      }
    case -3:
      return {
        level: "warning",
        icon: "🚫",
        title: "このアカウントはログインできません",
        body: "企業のログインが停止されています。管理者にお問い合わせください。",
      }
    case -2:
      return {
        level: "warning",
        icon: "🔒",
        title: "アカウントがロックされています",
        body: "パスワードを連続して間違えたためロックされました。30分後に再度お試しください。",
        focus: "password",
      }
    case -1:
      return {
        level: "error",
        icon: "❌",
        title: "ユーザーIDまたはパスワードが正しくありません",
        body: "入力内容をご確認のうえ、再度お試しください。5回連続で失敗するとアカウントがロックされます。",
        focus: "userId",
      }
    case -99:
    default:
      return {
        level: "server",
        icon: "⚠️",
        title: "サーバーエラーが発生しました",
        body: msg ?? "しばらく時間をおいてから再度お試しください。解決しない場合は管理者にお問い合わせください。",
      }
  }
}

// ─────────────────────────────────────────────
// エラーバナーコンポーネント
// ─────────────────────────────────────────────
const LEVEL_STYLE: Record<ErrLevel, { bg: string; border: string; title: string; body: string; bar: string }> = {
  error:  { bg: "#fff1f2", border: "#fca5a5", title: "#991b1b", body: "#7f1d1d", bar: "#ef4444" },
  warning:{ bg: "#fffbeb", border: "#fcd34d", title: "#78350f", body: "#92400e", bar: "#f59e0b" },
  info:   { bg: "#eff6ff", border: "#93c5fd", title: "#1e3a8a", body: "#1e40af", bar: "#3b82f6" },
  server: { bg: "#fdf4ff", border: "#d8b4fe", title: "#581c87", body: "#6b21a8", bar: "#a855f7" },
}

function ErrorBanner({
  display,
  onClose,
}: {
  display: ErrDisplay
  onClose: () => void
}) {
  const s = LEVEL_STYLE[display.level]
  return (
    <div style={{
      border: `1px solid ${s.border}`,
      borderLeft: `4px solid ${s.bar}`,
      borderRadius: "8px",
      background: s.bg,
      padding: "12px 14px",
      marginBottom: "16px",
      position: "relative",
    }}>
      <button
        onClick={onClose}
        style={{
          position: "absolute", top: "8px", right: "10px",
          background: "none", border: "none", cursor: "pointer",
          fontSize: "14px", color: "#9ca3af", lineHeight: 1,
        }}
        aria-label="閉じる"
      >✕</button>
      <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", paddingRight: "20px" }}>
        <span style={{ fontSize: "18px", flexShrink: 0, marginTop: "1px" }}>{display.icon}</span>
        <div>
          <div style={{ fontSize: "13px", fontWeight: 700, color: s.title, marginBottom: "3px" }}>
            {display.title}
          </div>
          <div style={{ fontSize: "12px", color: s.body, lineHeight: "1.6" }}>
            {display.body}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// ローディングスピナー付きログインボタン
// ─────────────────────────────────────────────
function SubmitButton({ loading }: { loading: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      style={{
        width: "100%", height: "40px",
        background: loading ? "#6b7280" : "#1d4ed8",
        color: "#fff", border: "none", borderRadius: "6px",
        fontSize: "14px", fontWeight: 600,
        cursor: loading ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
        transition: "background 0.15s",
      }}
    >
      {loading && (
        <span style={{
          width: "16px", height: "16px",
          border: "2px solid rgba(255,255,255,0.4)",
          borderTopColor: "#fff",
          borderRadius: "50%",
          display: "inline-block",
          animation: "spin 0.8s linear infinite",
        }} />
      )}
      {loading ? "確認中..." : "ログイン"}
    </button>
  )
}

// ─────────────────────────────────────────────
// メインコンポーネント
// ─────────────────────────────────────────────
export default function LoginClient() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [companyCode, setCompanyCode] = useState("")
  const [userId, setUserId]           = useState("")
  const [password, setPassword]       = useState("")
  const [rememberMe, setRememberMe]   = useState(false)
  const [showPw, setShowPw]           = useState(false)
  const [errDisplay, setErrDisplay]   = useState<ErrDisplay | null>(null)
  const [loading, setLoading]         = useState(false)

  const companyCodeRef = useRef<HTMLInputElement>(null)
  const userIdRef      = useRef<HTMLInputElement>(null)
  const passwordRef    = useRef<HTMLInputElement>(null)

  const isTimeout   = searchParams.get("timeout") === "1"
  const isLoggedOut = searchParams.get("loggedout") === "1"
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard"

  const nextFocus = (ref: React.RefObject<HTMLInputElement | null>) =>
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") { e.preventDefault(); ref.current?.focus() }
    }

  // エラー発生時にフォーカス移動
  useEffect(() => {
    if (!errDisplay?.focus) return
    const map = { companyCode: companyCodeRef, userId: userIdRef, password: passwordRef }
    setTimeout(() => map[errDisplay.focus!]?.current?.focus(), 100)
  }, [errDisplay])

  const showError = (code: number, msg?: string) => {
    setErrDisplay(getErrDisplay(code, msg))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrDisplay(null)

    // フロントバリデーション
    if (!companyCode) {
      setErrDisplay({ level: "error", icon: "🏢", title: "企業コードを入力してください", body: "5桁の数字を入力してください。", focus: "companyCode" })
      return
    }
    if (!userId) {
      setErrDisplay({ level: "error", icon: "👤", title: "ユーザーIDを入力してください", body: "ログイン用ユーザーIDを入力してください。", focus: "userId" })
      return
    }
    if (!password) {
      setErrDisplay({ level: "error", icon: "🔑", title: "パスワードを入力してください", body: "パスワードを入力してください。", focus: "password" })
      return
    }

    setLoading(true)
    try {
      // ① pre-check（企業コード・ID・PW確認）
      let preData: { ok: boolean; code?: number; msg?: string }
      try {
        const preRes = await fetch("/api/v1/auth/pre-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyCode, userId, password }),
        })
        // HTTPエラー（500系）もJSONとして受け取る
        preData = await preRes.json()
      } catch {
        // fetchそのものが失敗（オフライン・サービス停止）
        showError(-98, "サーバーに接続できません。ネットワーク接続またはサービスの稼働状況を確認してください。")
        return
      }

      if (!preData.ok) {
        showError(preData.code ?? -99, preData.msg)
        return
      }

      // ② NextAuth signIn
      const res = await signIn("credentials", {
        companyCode, userId, password,
        rememberMe: String(rememberMe),
        redirect: false,
      })

      if (res?.ok) {
        router.push(callbackUrl)
        router.refresh()
        return
      }

      // signInが失敗（通常はpre-checkで止まるのでここには来ないはずだが念のため）
      showError(-99, "セッション開始に失敗しました。再度ログインしてください。")
    } catch (err: unknown) {
      showError(-98, "予期しないエラーが発生しました。ページを再読み込みしてから再試行してください。")
      console.error("[login] error:", err)
    } finally {
      setLoading(false)
    }
  }

  const inp: React.CSSProperties = {
    width: "100%", height: "36px", border: "1px solid #d1d5db",
    borderRadius: "5px", padding: "0 10px", fontSize: "13px",
    background: "#f8fafc", outline: "none",
    transition: "border-color 0.15s, background 0.15s", boxSizing: "border-box",
  }
  const inp2: React.CSSProperties = {
    ...inp, textAlign: "center", fontFamily: "monospace",
    fontWeight: 600, letterSpacing: "2px",
    border: "2px solid #93c5fd", background: "#eff6ff",
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <div style={{ width: "100%", maxWidth: "360px" }}>
        {/* ロゴ */}
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "6px" }}>
            <div style={{ width: "32px", height: "32px", background: "#f97316", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "15px" }}>越</div>
            <span style={{ fontSize: "13px", color: "#64748b" }}>株式会社越智製作所</span>
          </div>
          <div style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "1px" }}>
            <span style={{ color: "#f97316" }}>OCHI</span><span style={{ color: "#1e3a5f" }}>WEB</span>{" "}<span style={{ color: "#1e293b" }}>オーダーシステム</span>
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "28px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          {/* セッション系通知 */}
          {isTimeout && (
            <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderLeft: "4px solid #f59e0b", borderRadius: "6px", padding: "8px 12px", fontSize: "12px", color: "#92400e", marginBottom: "14px" }}>
              ⏱ セッションがタイムアウトしました。再度ログインしてください。
            </div>
          )}
          {isLoggedOut && (
            <div style={{ background: "#eff6ff", border: "1px solid #93c5fd", borderLeft: "4px solid #3b82f6", borderRadius: "6px", padding: "8px 12px", fontSize: "12px", color: "#1e40af", marginBottom: "14px" }}>
              ✓ ログアウトしました。
            </div>
          )}

          {/* エラーバナー（コード別詳細表示） */}
          {errDisplay && (
            <ErrorBanner display={errDisplay} onClose={() => setErrDisplay(null)} />
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* 企業コード */}
            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#1d4ed8", marginBottom: "5px" }}>
                企業コード <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                ref={companyCodeRef}
                type="text" inputMode="numeric" maxLength={5}
                value={companyCode}
                onChange={e => setCompanyCode(e.target.value.replace(/\D/g, ""))}
                onKeyDown={nextFocus(userIdRef)}
                placeholder="00000" style={inp2} disabled={loading}
                onFocus={e => { e.target.style.borderColor = "#f59e0b"; e.target.style.background = "#ffffcc" }}
                onBlur={e => { e.target.style.borderColor = "#93c5fd"; e.target.style.background = "#eff6ff" }}
              />
              <div style={{ fontSize: "10px", color: "#16a34a", marginTop: "2px" }}>例: 00010, 12345</div>
            </div>

            <div style={{ borderTop: "1px solid #e2e8f0", margin: "12px 0" }} />

            {/* ユーザーID */}
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "11px", color: "#374151", marginBottom: "4px" }}>ユーザーID</label>
              <input
                ref={userIdRef}
                type="text" value={userId}
                onChange={e => setUserId(e.target.value)}
                onKeyDown={nextFocus(passwordRef)}
                placeholder="ユーザーIDを入力" style={inp} disabled={loading}
                onFocus={e => { e.target.style.borderColor = "#f59e0b"; e.target.style.background = "#ffffcc" }}
                onBlur={e => { e.target.style.borderColor = "#d1d5db"; e.target.style.background = "#f8fafc" }}
              />
            </div>

            {/* パスワード */}
            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "11px", color: "#374151", marginBottom: "4px" }}>パスワード</label>
              <div style={{ position: "relative" }}>
                <input
                  ref={passwordRef}
                  type={showPw ? "text" : "password"} value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSubmit(e as unknown as FormEvent) } }}
                  placeholder="パスワードを入力"
                  style={{ ...inp, paddingRight: "36px" }} disabled={loading}
                  onFocus={e => { e.target.style.borderColor = "#f59e0b"; e.target.style.background = "#ffffcc" }}
                  onBlur={e => { e.target.style.borderColor = "#d1d5db"; e.target.style.background = "#f8fafc" }}
                />
                <button type="button" onClick={() => setShowPw(p => !p)} tabIndex={-1}
                  style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "14px", color: "#9ca3af" }}>
                  {showPw ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {/* ログイン状態保持 */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "14px" }}>
              <input type="checkbox" id="rememberMe" checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)} disabled={loading}
                style={{ width: "14px", height: "14px" }} />
              <label htmlFor="rememberMe" style={{ fontSize: "12px", color: "#6b7280", cursor: "pointer" }}>ログイン状態を保持する</label>
            </div>

            <SubmitButton loading={loading} />
          </form>

          <p style={{ marginTop: "14px", textAlign: "center", fontSize: "10px", color: "#9ca3af", lineHeight: "1.6" }}>
            ※企業コード・ユーザーID・パスワードをすべて入力してログインしてください<br />
            ※ログインに関するお問い合わせは管理者までご連絡ください
          </p>
        </div>
        <p style={{ marginTop: "16px", textAlign: "center", fontSize: "10px", color: "#94a3b8" }}>
          {`© ${new Date().getFullYear()} 越智製作所. All rights reserved.`}
        </p>
      </div>
    </div>
  )
}
'''

TARGET = f"{ROOT}/src/app/(auth)/login/LoginClient.tsx"
with open(TARGET, "w", encoding="utf-8") as f:
    f.write(LOGIN_CLIENT)
print(f"  OK: {TARGET}")

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
r = subprocess.run('git commit -m "fix: ログインエラーUI改善 — エラー種別ごとに明確なメッセージ表示"',
                   shell=True, capture_output=True, text=True, cwd=ROOT)
print(" ", r.stdout.strip().split("\n")[0])
run("git push")
print("  PUSH OK")
print("✅ 完了!")
