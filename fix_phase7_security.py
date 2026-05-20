#!/usr/bin/env python3
"""
fix_phase7_security.py  Phase 7: 認証・セキュリティ強化
=============================================================
Task 7-1-4: 企業コード input に font-family: 'Courier New' 追加（login/page.tsx）
Task 7-3-1: User に loginFailCount / lockedUntil フィールド追加 + migrate
Task 7-3-2: 失敗5回で accountLocked=true + lockedUntil=now+30分
Task 7-3-3: ロック中ログイン時に「アカウントがロックされています」メッセージ
=============================================================
"""
import subprocess
from pathlib import Path

ROOT = Path.home() / "projects" / "ochi-ss"
PASS, FAIL = [], []

def apply(label, path, old, new):
    p = ROOT / path
    if not p.exists():
        FAIL.append(f"[{label}] ファイル未存在")
        return
    c = p.read_text(encoding="utf-8")
    if old not in c:
        FAIL.append(f"[{label}] パターン不一致")
        print(f"  ❌ {label}")
        return
    p.write_text(c.replace(old, new, 1), encoding="utf-8")
    PASS.append(label)
    print(f"  ✅ {label}")

def run(cmd, cwd=ROOT):
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)

print("=" * 60)
print("  fix_phase7_security.py  Phase 7: セキュリティ強化")
print("=" * 60)

# ─────────────────────────────────────────────────────────
# Task 7-1-4: 企業コード入力に等幅フォント適用
# ─────────────────────────────────────────────────────────
print("\n[Task 7-1-4] 企業コード入力 等幅フォント適用")
apply(
    "login: 企業コード Courier New 適用",
    "src/app/(auth)/login/page.tsx",
    'className="w-full h-11 px-4 text-[15px] border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A4080]/30 focus:border-[#1A4080] transition-colors placeholder:text-[#C4C9D4] disabled:bg-gray-50"\n                disabled={isLoading}\n              />\n            \n            <p className="text-[11px] text-[#9CA3AF] mt-1">例: 00010（5桁の数字）</p>',
    'className="w-full h-11 px-4 text-[15px] border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A4080]/30 focus:border-[#1A4080] transition-colors placeholder:text-[#C4C9D4] disabled:bg-gray-50 font-mono tracking-widest text-center"\n                disabled={isLoading}\n              />\n            \n            <p className="text-[11px] text-[#9CA3AF] mt-1">例: 00010（5桁の数字）</p>'
)

# ─────────────────────────────────────────────────────────
# Task 7-3-1: schema.prisma に loginFailCount / lockedUntil 追加
# ─────────────────────────────────────────────────────────
print("\n[Task 7-3-1] prisma/schema.prisma User モデルにフィールド追加")
apply(
    "schema: User に loginFailCount/lockedUntil 追加",
    "prisma/schema.prisma",
    """  accountLocked Boolean   @default(false) @map("account_locked")
  userRole      Int       @default(1) @map("user_role")
  // 0:Guest / 1:User / 2:Manager / 3:Admin / 4:SuperAdmin
  lastLoginAt   DateTime? @map("last_login_at")""",
    """  accountLocked    Boolean   @default(false) @map("account_locked")
  loginFailCount   Int       @default(0) @map("login_fail_count")  // 連続失敗回数
  lockedUntil      DateTime? @map("locked_until")                   // ロック解除日時
  userRole         Int       @default(1) @map("user_role")
  // 0:Guest / 1:User / 2:Manager / 3:Admin / 4:SuperAdmin
  lastLoginAt      DateTime? @map("last_login_at")"""
)

# migrate 実行
print("\n[Task 7-3-1] prisma migrate dev 実行")
r = run(["npx", "prisma", "migrate", "dev", "--name", "add_login_fail_fields"])
if r.returncode == 0:
    PASS.append("prisma migrate")
    print("  ✅ prisma migrate 完了")
else:
    FAIL.append(f"prisma migrate エラー: {r.stdout[-500:]}{r.stderr[-500:]}")
    print(f"  ❌ prisma migrate エラー:\n{r.stdout[-500:]}\n{r.stderr[-500:]}")

# ─────────────────────────────────────────────────────────
# Task 7-3-2/3: auth.ts にロック判定・カウントアップ・ロック処理追加
# ─────────────────────────────────────────────────────────
print("\n[Task 7-3-2/3] auth.ts アカウントロック処理追加")

# User select に loginFailCount / lockedUntil を追加
apply(
    "auth: User select に loginFailCount/lockedUntil 追加",
    "src/lib/auth.ts",
    """            id: true,
            username: true,
            chargeName: true,
            passwordHash: true,
            userStatus: true,
            accountLocked: true,
            userRole: true,""",
    """            id: true,
            username: true,
            chargeName: true,
            passwordHash: true,
            userStatus: true,
            accountLocked: true,
            loginFailCount: true,
            lockedUntil: true,
            userRole: true,"""
)

# accountLocked チェックの後に lockedUntil 期限切れ確認を挿入
apply(
    "auth: lockedUntil 期限切れ自動解除 + ロック中メッセージ追加",
    "src/lib/auth.ts",
    """        // ⑤ アカウント有効性確認（userStatus=1 が有効）
        if (user.accountLocked || user.userStatus !== 1) {
          await recordLoginHistory({
            userId: user.id,
            customerCode: customer.customerCode,
            ipAddress,
            userAgent,
            result: -2,
            failReason: "ユーザー無効/ロック",
          })
          await recordSecurityLog({
            eventType: "Login_UserDisabled",
            message: `ユーザー無効/ロック: username=${userId}, customerCode=${customer.customerCode}`,
            ipAddress,
            username: userId,
            logLevel: "WARNING",
          })
          throw new Error("-2")
        }""",
    """        // ⑤ アカウント有効性確認（userStatus=1 が有効）
        // ⑤-a ロック期限切れの場合は自動解除
        if (user.accountLocked && user.lockedUntil && new Date() > new Date(user.lockedUntil)) {
          await prisma.user.update({
            where: { id: user.id },
            data: { accountLocked: false, loginFailCount: 0, lockedUntil: null },
          })
          user.accountLocked = false
          user.loginFailCount = 0
        }
        // ⑤-b ロック中確認
        if (user.accountLocked || user.userStatus !== 1) {
          await recordLoginHistory({
            userId: user.id,
            customerCode: customer.customerCode,
            ipAddress,
            userAgent,
            result: -2,
            failReason: user.accountLocked ? "アカウントロック" : "ユーザー無効",
          })
          await recordSecurityLog({
            eventType: "Login_UserLocked",
            message: `アカウントロック中: username=${userId}, customerCode=${customer.customerCode}, lockedUntil=${user.lockedUntil?.toISOString() ?? "indefinite"}`,
            ipAddress,
            username: userId,
            logLevel: "WARNING",
          })
          throw new Error("-2")
        }"""
)

# パスワード不一致時: loginFailCount インクリメント + 5回でロック
apply(
    "auth: PW不一致時 failCount++、5回でロック",
    "src/lib/auth.ts",
    """        // ⑥ パスワード検証（bcrypt コスト12）
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash)
        if (!isPasswordValid) {
          await recordLoginHistory({
            userId: user.id,
            customerCode: customer.customerCode,
            ipAddress,
            userAgent,
            result: -1,
            failReason: "パスワード不一致",
          })
          await recordSecurityLog({
            eventType: "Login_Failure",
            message: `パスワード不一致: username=${userId}, customerCode=${customer.customerCode}`,
            ipAddress,
            username: userId,
            logLevel: "WARNING",
          })
          throw new Error("-1")
        }""",
    """        // ⑥ パスワード検証（bcrypt コスト12）
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash)
        if (!isPasswordValid) {
          // 失敗カウントを +1、5回でアカウントロック（30分）
          const newFailCount = (user.loginFailCount ?? 0) + 1
          const shouldLock = newFailCount >= 5
          await prisma.user.update({
            where: { id: user.id },
            data: {
              loginFailCount: newFailCount,
              ...(shouldLock && {
                accountLocked: true,
                lockedUntil: new Date(Date.now() + 30 * 60 * 1000),
              }),
            },
          })
          await recordLoginHistory({
            userId: user.id,
            customerCode: customer.customerCode,
            ipAddress,
            userAgent,
            result: -1,
            failReason: shouldLock
              ? `パスワード不一致 (${newFailCount}回目) → アカウントロック30分`
              : `パスワード不一致 (${newFailCount}回目)`,
          })
          await recordSecurityLog({
            eventType: shouldLock ? "Login_AccountLocked" : "Login_Failure",
            message: shouldLock
              ? `アカウントロック: username=${userId}, customerCode=${customer.customerCode}, failCount=${newFailCount}`
              : `パスワード不一致: username=${userId}, customerCode=${customer.customerCode}, failCount=${newFailCount}`,
            ipAddress,
            username: userId,
            logLevel: shouldLock ? "ALERT" : "WARNING",
          })
          throw new Error(shouldLock ? "-2" : "-1")
        }"""
)

# ログイン成功時: loginFailCount リセット + lastLoginAt 更新
apply(
    "auth: ログイン成功時 failCount リセット",
    "src/lib/auth.ts",
    """        // ⑦ 成功
        await recordLoginHistory({
          userId: user.id,
          customerCode: customer.customerCode,
          ipAddress,
          userAgent,
          result: 1,
        })
        await recordSecurityLog({
          eventType: "Login_Success",
          message: `ログイン成功: username=${userId}, customerCode=${customer.customerCode}`,
          ipAddress,
          username: userId,
          logLevel: "INFO",
        })""",
    """        // ⑦ 成功 — 失敗カウントリセット + 最終ログイン日時更新
        await prisma.user.update({
          where: { id: user.id },
          data: { loginFailCount: 0, lockedUntil: null, lastLoginAt: new Date() },
        })
        await recordLoginHistory({
          userId: user.id,
          customerCode: customer.customerCode,
          ipAddress,
          userAgent,
          result: 1,
        })
        await recordSecurityLog({
          eventType: "Login_Success",
          message: `ログイン成功: username=${userId}, customerCode=${customer.customerCode}`,
          ipAddress,
          username: userId,
          logLevel: "INFO",
        })"""
)

# ─────────────────────────────────────────────────────────
# ERROR_MESSAGES に -2 ロックメッセージを明確化（login/page.tsx）
# ─────────────────────────────────────────────────────────
print("\n[Task 7-3-3] login/page.tsx ロックメッセージ更新")
apply(
    "login: -2 エラーメッセージをロック専用に更新",
    "src/app/(auth)/login/page.tsx",
    '  "-2": "このアカウントは無効またはロックされています。管理者にお問い合わせください。",',
    '  "-2": "このアカウントはロックされています。30分後に再試行するか、管理者にお問い合わせください。",',
)

# ─────────────────────────────────────────────────────────
# TypeScript チェック
# ─────────────────────────────────────────────────────────
print("\n[TypeScript チェック]")
r = run(["npx", "tsc", "--noEmit"])
if r.returncode == 0:
    print("  ✅ tsc --noEmit: エラーなし")
else:
    print(f"  ❌ tsc エラー:\n{r.stdout}{r.stderr}")
    FAIL.append("tsc")

# ─────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print(f"  完了: {len(PASS)}件  失敗: {len(FAIL)}件")
if FAIL:
    print("\n  ❌ 失敗:")
    for f in FAIL: print(f"    {f}")
else:
    print("""
  ✅ Phase 7 実装完了！
  git add -A && git commit -m 'feat: Phase7 アカウントロック/失敗カウント/ログイン等幅フォント'
  git push
""")
print("=" * 60)
