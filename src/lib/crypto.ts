/**
 * Ochi-ss — アプリケーションレベル暗号化ユーティリティ
 *
 * - 住所・TEL・FAX: AES-256-GCM（対称暗号化）
 * - メールアドレス: AES-256-GCM + HMAC-SHA256（検索インデックス用）
 * - パスワード: bcrypt（このファイルには含まない）
 *
 * 環境変数:
 *   ENCRYPTION_KEY  ... 64文字のhex文字列 (32バイト)
 *   HMAC_KEY        ... 64文字のhex文字列 (32バイト)
 */

import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "crypto";

// ---------------------------------------------------------------------------
//  設定
// ---------------------------------------------------------------------------
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;  // GCM推奨 96bit
const TAG_LENGTH = 16; // GCM 認証タグ 128bit

function getEncryptionKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("ENCRYPTION_KEY is not set or invalid (must be 64-char hex)");
  }
  return Buffer.from(hex, "hex");
}

function getHmacKey(): Buffer {
  const hex = process.env.HMAC_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("HMAC_KEY is not set or invalid (must be 64-char hex)");
  }
  return Buffer.from(hex, "hex");
}

// ---------------------------------------------------------------------------
//  AES-256-GCM 暗号化
// ---------------------------------------------------------------------------

/**
 * 平文を AES-256-GCM で暗号化し base64 文字列を返す
 * フォーマット: <iv_hex>:<ciphertext_base64>:<tag_hex>
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${encrypted.toString("base64")}:${tag.toString("hex")}`;
}

/**
 * encrypt() で暗号化された文字列を復号して返す
 */
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const [ivHex, encryptedB64, tagHex] = ciphertext.split(":");

  if (!ivHex || !encryptedB64 || !tagHex) {
    throw new Error("Invalid ciphertext format");
  }

  const iv = Buffer.from(ivHex, "hex");
  const encryptedBuf = Buffer.from(encryptedB64, "base64");
  const tag = Buffer.from(tagHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(encryptedBuf).toString("utf8") + decipher.final("utf8");
}

/**
 * null/undefined を透過する encrypt ラッパー
 */
export function encryptNullable(value: string | null | undefined): string | null {
  if (value == null) return null;
  return encrypt(value);
}

/**
 * null/undefined を透過する decrypt ラッパー
 */
export function decryptNullable(value: string | null | undefined): string | null {
  if (value == null) return null;
  return decrypt(value);
}

// ---------------------------------------------------------------------------
//  HMAC（メールアドレス検索インデックス用）
// ---------------------------------------------------------------------------

/**
 * メールアドレスを小文字正規化した上で HMAC-SHA256 を返す
 * DB の email_hmac カラムに保存し、ログイン時の突合に使用
 */
export function hmacEmail(email: string): string {
  const key = getHmacKey();
  return createHmac("sha256", key)
    .update(email.toLowerCase().trim())
    .digest("hex");
}

// ---------------------------------------------------------------------------
//  Prisma Middleware ヘルパー
//  使い方: prisma.$use(encryptionMiddleware)
// ---------------------------------------------------------------------------

/** 暗号化対象フィールドの定義 */
const ENCRYPTED_FIELDS: Record<string, string[]> = {
  EstimateHeader: ["destinationAddress", "destinationTel", "destinationFax"],
  DirectDelivery: ["address1", "address2", "address3", "phoneNumber", "faxNumber"],
};

/**
 * Prisma Middleware — 書き込み時に自動暗号化、読み取り時に自動復号
 *
 * @example
 * import { PrismaClient } from "@prisma/client";
 * import { encryptionMiddleware } from "@/lib/crypto";
 *
 * const prisma = new PrismaClient();
 * prisma.$use(encryptionMiddleware);
 */
export async function encryptionMiddleware(
  params: any,
  next: (params: any) => Promise<any>
): Promise<any> {
  const fields = ENCRYPTED_FIELDS[params.model];
  if (!fields || fields.length === 0) {
    return next(params);
  }

  // --- 書き込み時: 暗号化 ---
  const writeOps = ["create", "update", "upsert", "createMany", "updateMany"];
  if (writeOps.includes(params.action)) {
    const data = params.args?.data;
    if (data) {
      for (const field of fields) {
        if (data[field] != null) {
          data[field] = encrypt(String(data[field]));
        }
      }
    }
  }

  const result = await next(params);

  // --- 読み取り時: 復号 ---
  const readOps = ["findUnique", "findFirst", "findMany"];
  if (readOps.includes(params.action) && result) {
    const decrypt_ = (record: any) => {
      for (const field of fields) {
        if (record[field] != null) {
          try {
            record[field] = decrypt(record[field]);
          } catch {
            // 暗号化前の平文データが混在する移行期は無視
          }
        }
      }
    };
    if (Array.isArray(result)) {
      result.forEach(decrypt_);
    } else {
      decrypt_(result);
    }
  }

  return result;
}
