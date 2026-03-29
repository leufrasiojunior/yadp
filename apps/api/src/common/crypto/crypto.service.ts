import { Inject, Injectable } from "@nestjs/common";

import { AppEnvService } from "../../config/app-env";
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

type EncryptedPayload = {
  ciphertext: string;
  iv: string;
  tag: string;
};

@Injectable()
export class CryptoService {
  private readonly secretKey: Buffer;
  private readonly sessionKey: Buffer;

  constructor(@Inject(AppEnvService) env: AppEnvService) {
    this.secretKey = this.deriveKey(env.values.APP_ENCRYPTION_KEY, "secret");
    this.sessionKey = this.deriveKey(env.values.SESSION_SECRET, "session");
  }

  encryptSecret(plaintext: string) {
    return this.encrypt(plaintext, this.secretKey);
  }

  decryptSecret(payload: string) {
    return this.decrypt(payload, this.secretKey);
  }

  encryptSession<T>(value: T) {
    return this.encrypt(JSON.stringify(value), this.sessionKey);
  }

  decryptSession<T>(payload: string) {
    return JSON.parse(this.decrypt(payload, this.sessionKey)) as T;
  }

  createToken(length = 32) {
    return randomBytes(length).toString("base64url");
  }

  hashPassword(password: string) {
    const salt = randomBytes(16);
    const hash = scryptSync(password, salt, 64);

    return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
  }

  verifyPassword(password: string, storedHash: string) {
    const [algorithm, saltValue, hashValue] = storedHash.split("$");

    if (algorithm !== "scrypt" || !saltValue || !hashValue) {
      return false;
    }

    const salt = Buffer.from(saltValue, "base64url");
    const expectedHash = Buffer.from(hashValue, "base64url");
    const candidateHash = scryptSync(password, salt, expectedHash.length);

    return timingSafeEqual(candidateHash, expectedHash);
  }

  private deriveKey(secret: string, salt: string) {
    return createHash("sha256").update(`${salt}:${secret}`).digest();
  }

  private encrypt(plaintext: string, key: Buffer) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    const payload: EncryptedPayload = {
      ciphertext: ciphertext.toString("base64url"),
      iv: iv.toString("base64url"),
      tag: tag.toString("base64url"),
    };

    return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  }

  private decrypt(payload: string, key: Buffer) {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as EncryptedPayload;
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(parsed.iv, "base64url"));
    decipher.setAuthTag(Buffer.from(parsed.tag, "base64url"));

    return Buffer.concat([decipher.update(Buffer.from(parsed.ciphertext, "base64url")), decipher.final()]).toString(
      "utf8",
    );
  }
}
