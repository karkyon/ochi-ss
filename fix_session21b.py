#!/usr/bin/env python3
import subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent

def rep(p, old, new, label):
    path = ROOT / p
    c = path.read_text(encoding="utf-8")
    if old not in c: print(f"  ❌ [{label}]"); return False
    path.write_text(c.replace(old, new, 1), encoding="utf-8"); print(f"  ✅ [{label}]"); return True

def main():
    print("fix_session21b.py 開始")

    # showPw state を isLoading の直後に追加（貼り付けコードより正確なアンカー確認済み）
    rep(
        "src/app/(auth)/login/page.tsx",
        "  const [isLoading, setIsLoading] = useState(false)",
        "  const [isLoading, setIsLoading] = useState(false)\n  const [showPw, setShowPw]     = useState(false)",
        "showPw state追加"
    )

    # パスワードフィールドの直後にトグルボタンを追加（relative div でラップ）
    # 現在: <input id="password" ... /> の後に </div> がある
    # → input を div でラップしてトグルボタンを重ねる
    rep(
        "src/app/(auth)/login/page.tsx",
        """\
              <input
                id="password"
                ref={passwordRef}
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワードを入力"
                autoComplete="current-password"
                maxLength={50}
                className="w-full h-11 px-4 text-[15px] border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A4080]/30 focus:border-[#1A4080] transition-colors placeholder:text-[#C4C9D4] disabled:bg-gray-50"
                disabled={isLoading}
              />""",
        """\
              <div className="relative">
                <input
                  id="password"
                  ref={passwordRef}
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="パスワードを入力"
                  autoComplete="current-password"
                  maxLength={50}
                  className="w-full h-11 px-4 pr-11 text-[15px] border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A4080]/30 focus:border-[#1A4080] transition-colors placeholder:text-[#C4C9D4] disabled:bg-gray-50"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm select-none"
                  tabIndex={-1}
                  aria-label={showPw ? "パスワードを隠す" : "パスワードを表示"}
                >
                  {showPw ? "🙈" : "👁️"}
                </button>
              </div>""",
        "パスワードトグルボタン追加"
    )

    print("→ tscチェック中...")
    r = subprocess.run(["npx", "tsc", "--noEmit"], capture_output=True, text=True, cwd=str(ROOT))
    if r.returncode != 0:
        print("❌ tscエラー:"); print((r.stdout + r.stderr)[-4000:]); sys.exit(1)

    print("✅ → git push")
    subprocess.run(["git", "add", "-A"], check=True, cwd=str(ROOT))
    subprocess.run(["git", "commit", "-m", "feat: Toast/skiplink/login PW toggle完全実装"], check=True, cwd=str(ROOT))
    subprocess.run(["git", "push"], check=True, cwd=str(ROOT))
    print("✅ push完了")

if __name__ == "__main__":
    main()
