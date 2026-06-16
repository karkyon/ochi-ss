// src/app/(auth)/login/LoginClient.tsx
"use client"
import { useState, useRef, FormEvent, useEffect } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"

function getErrorMessage(error: string | undefined | null): string {
  if (!error) return "ログインに失敗しました"
  if (error.includes("-4") || error.includes("CredentialsSignin")) return "企業コードが正しくありません"
  if (error.includes("-3")) return "この企業のログインは現在無効です。管理者にお問い合わせください"
  if (error.includes("-2")) return "アカウントがロックされています。30分後に再度お試しください"
  if (error.includes("-1")) return "ユーザーIDまたはパスワードが正しくありません"
  return "企業コード・ユーザーID・パスワードをご確認ください"
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 5000); return () => clearTimeout(t) }, [onClose])
  return (
    <div style={{ position:"fixed", top:"16px", left:"50%", transform:"translateX(-50%)", zIndex:9999, minWidth:"320px", maxWidth:"480px", background:"#991b1b", color:"#fff", borderRadius:"8px", padding:"12px 16px", boxShadow:"0 4px 16px rgba(0,0,0,0.25)", display:"flex", alignItems:"center", gap:"10px", fontSize:"13px", fontWeight:500 }}>
      <span>✕</span>
      <span style={{ flex:1 }}>{message}</span>
      <button onClick={onClose} style={{ background:"rgba(255,255,255,0.2)", border:"none", color:"#fff", borderRadius:"4px", padding:"2px 8px", cursor:"pointer", fontSize:"12px" }}>閉じる</button>
    </div>
  )
}

export default function LoginClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [companyCode, setCompanyCode] = useState("")
  const [userId, setUserId] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const userIdRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const loginBtnRef = useRef<HTMLButtonElement>(null)

  const isTimeout = searchParams.get("timeout") === "1"
  const isLoggedOut = searchParams.get("loggedout") === "1"
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard"

  const nextFocus = (ref: React.RefObject<HTMLInputElement | null>) =>
    (e: React.KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); ref.current?.focus() } }
  const submitOnEnter = (e: React.KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); loginBtnRef.current?.click() } }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!companyCode || !userId || !password) { setToast("企業コード・ユーザーID・パスワードを入力してください"); return }
    setLoading(true)
    try {
      const res = await signIn("credentials", { companyCode, userId, password, rememberMe: String(rememberMe), redirect: false })
      if (res?.ok) { router.push(callbackUrl); router.refresh(); return }
      setToast(getErrorMessage(res?.error))
    } catch (err: unknown) {
      setToast(getErrorMessage(err instanceof Error ? err.message : String(err)))
    } finally {
      setLoading(false)
    }
  }

  const inp: React.CSSProperties = { width:"100%", height:"34px", border:"1px solid #d1d5db", borderRadius:"5px", padding:"0 10px", fontSize:"13px", background:"#f8fafc", outline:"none", transition:"border-color 0.15s, background 0.15s" }
  const inp2: React.CSSProperties = { ...inp, textAlign:"center", fontFamily:"monospace", fontWeight:600, letterSpacing:"2px", border:"2px solid #93c5fd", background:"#eff6ff" }

  return (
    <div style={{ minHeight:"100vh", background:"#f1f5f9", display:"flex", alignItems:"center", justifyContent:"center", padding:"16px" }}>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      <div style={{ width:"100%", maxWidth:"360px" }}>
        <div style={{ textAlign:"center", marginBottom:"20px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"10px", marginBottom:"6px" }}>
            <div style={{ width:"32px", height:"32px", background:"#f97316", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:700, fontSize:"15px" }}>越</div>
            <span style={{ fontSize:"13px", color:"#64748b" }}>株式会社越智製作所</span>
          </div>
          <div style={{ fontSize:"20px", fontWeight:700, letterSpacing:"1px" }}>
            <span style={{ color:"#f97316" }}>OCHI</span><span style={{ color:"#1e3a5f" }}>WEB</span>{" "}<span style={{ color:"#1e293b" }}>オーダーシステム</span>
          </div>
        </div>
        <div style={{ background:"#fff", borderRadius:"12px", border:"1px solid #e2e8f0", padding:"28px", boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
          {isTimeout && <div style={{ background:"#fffbeb", border:"1px solid #fcd34d", borderRadius:"6px", padding:"8px 12px", fontSize:"12px", color:"#92400e", marginBottom:"14px" }}>⚠ セッションがタイムアウトしました。再度ログインしてください。</div>}
          {isLoggedOut && <div style={{ background:"#eff6ff", border:"1px solid #93c5fd", borderRadius:"6px", padding:"8px 12px", fontSize:"12px", color:"#1e40af", marginBottom:"14px" }}>✓ ログアウトしました。</div>}
          <form onSubmit={handleSubmit} noValidate>
            <div style={{ marginBottom:"14px" }}>
              <label style={{ display:"block", fontSize:"11px", fontWeight:600, color:"#1d4ed8", marginBottom:"5px" }}>企業コード <span style={{ color:"#ef4444" }}>*</span></label>
              <input type="text" inputMode="numeric" maxLength={5} value={companyCode} onChange={e => setCompanyCode(e.target.value.replace(/\D/g, ""))} onKeyDown={nextFocus(userIdRef)} placeholder="00000" style={inp2} disabled={loading} onFocus={e => { e.target.style.borderColor="#f59e0b"; e.target.style.background="#ffffcc" }} onBlur={e => { e.target.style.borderColor="#93c5fd"; e.target.style.background="#eff6ff" }} />
              <div style={{ fontSize:"10px", color:"#16a34a", marginTop:"2px" }}>例: 00010, 12345</div>
            </div>
            <div style={{ borderTop:"1px solid #e2e8f0", margin:"12px 0" }} />
            <div style={{ marginBottom:"12px" }}>
              <label style={{ display:"block", fontSize:"11px", color:"#374151", marginBottom:"4px" }}>ユーザーID</label>
              <input ref={userIdRef} type="text" value={userId} onChange={e => setUserId(e.target.value)} onKeyDown={nextFocus(passwordRef)} placeholder="ユーザーIDを入力" style={inp} disabled={loading} onFocus={e => { e.target.style.borderColor="#f59e0b"; e.target.style.background="#ffffcc" }} onBlur={e => { e.target.style.borderColor="#d1d5db"; e.target.style.background="#f8fafc" }} />
            </div>
            <div style={{ marginBottom:"14px" }}>
              <label style={{ display:"block", fontSize:"11px", color:"#374151", marginBottom:"4px" }}>パスワード</label>
              <div style={{ position:"relative" }}>
                <input ref={passwordRef} type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={submitOnEnter} placeholder="パスワードを入力" style={{ ...inp, paddingRight:"36px" }} disabled={loading} onFocus={e => { e.target.style.borderColor="#f59e0b"; e.target.style.background="#ffffcc" }} onBlur={e => { e.target.style.borderColor="#d1d5db"; e.target.style.background="#f8fafc" }} />
                <button type="button" onClick={() => setShowPw(p => !p)} tabIndex={-1} style={{ position:"absolute", right:"8px", top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:"14px", color:"#9ca3af" }}>{showPw ? "🙈" : "👁️"}</button>
              </div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"14px" }}>
              <input type="checkbox" id="rememberMe" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} disabled={loading} style={{ width:"14px", height:"14px" }} />
              <label htmlFor="rememberMe" style={{ fontSize:"12px", color:"#6b7280", cursor:"pointer" }}>ログイン状態を保持する</label>
            </div>
            <button ref={loginBtnRef} type="submit" disabled={loading} style={{ width:"100%", height:"38px", background:"#1d4ed8", color:"#fff", border:"none", borderRadius:"6px", fontSize:"14px", fontWeight:600, cursor:loading ? "not-allowed" : "pointer", opacity:loading ? 0.65 : 1 }} onMouseEnter={e => { if (!loading)(e.target as HTMLButtonElement).style.background="#1e40af" }} onMouseLeave={e => { (e.target as HTMLButtonElement).style.background="#1d4ed8" }}>
              {loading ? "ログイン中..." : "ログイン"}
            </button>
          </form>
          <p style={{ marginTop:"14px", textAlign:"center", fontSize:"10px", color:"#9ca3af", lineHeight:"1.6" }}>
            ※企業コード・ユーザーID・パスワードをすべて入力してログインしてください<br />
            ※ログインに関するお問い合わせは管理者までご連絡ください
          </p>
        </div>
        <p style={{ marginTop:"16px", textAlign:"center", fontSize:"10px", color:"#94a3b8" }}>© {new Date().getFullYear()} 越智製作所. All rights reserved.</p>
      </div>
    </div>
  )
}
