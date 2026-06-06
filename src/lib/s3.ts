import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

let _client: S3Client | null = null;

function client() {
  if (_client) return _client;
  _client = new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: env("S3_ENDPOINT"),
    credentials: {
      accessKeyId: env("S3_ACCESS_KEY_ID"),
      secretAccessKey: env("S3_SECRET_ACCESS_KEY"),
    },
    forcePathStyle: true,
  });
  return _client;
}

export function bucket() {
  return env("S3_BUCKET");
}

export async function presignUpload(key: string, contentType: string, expiresIn = 60 * 10) {
  const cmd = new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType });
  return getSignedUrl(client(), cmd, { expiresIn });
}

export async function presignDownload(
  key: string | null | undefined,
  expiresIn = 60 * 60,
): Promise<string | null> {
  if (!key) return null;
  const base = process.env.S3_PUBLIC_BASE_URL;
  if (base) return `${base.replace(/\/$/, "")}/${key}`;
  if (!isS3Configured()) return null;
  const cmd = new GetObjectCommand({ Bucket: bucket(), Key: key });
  return getSignedUrl(client(), cmd, { expiresIn });
}

export function isS3Configured() {
  return Boolean(
    process.env.S3_ENDPOINT &&
      process.env.S3_BUCKET &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY,
  );
}
