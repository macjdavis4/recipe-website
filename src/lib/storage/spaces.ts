import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { isValidKey, type StorageAdapter } from "./adapter";

export type SpacesConfig = {
  key: string;
  secret: string;
  region: string;
  endpoint: string;
  bucket: string;
  cdnUrl: string;
};

/** Production storage: DigitalOcean Spaces (S3 compatible), served from its CDN. */
export function createSpacesStorage(config: SpacesConfig, client?: S3Client): StorageAdapter {
  const s3 =
    client ??
    new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: { accessKeyId: config.key, secretAccessKey: config.secret },
    });
  const prefix = `${config.cdnUrl.replace(/\/+$/, "")}/`;

  const keyFromUrl = (url: string) => {
    if (!url.startsWith(prefix)) return null;
    const key = url.slice(prefix.length);
    return isValidKey(key) ? key : null;
  };

  return {
    async save(key, data, contentType) {
      if (!isValidKey(key)) throw new Error("Invalid storage key");
      await s3.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: data,
          ContentType: contentType,
          ACL: "public-read",
          // Keys are random and never reused, so files can be cached forever.
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
      return `${prefix}${key}`;
    },
    async delete(url) {
      const key = keyFromUrl(url);
      if (key) await s3.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    },
    keyFromUrl,
  };
}
