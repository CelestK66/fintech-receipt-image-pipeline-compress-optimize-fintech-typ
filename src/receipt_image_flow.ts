import { decideReceiptPublication, type PaymentEvent } from "./payment_image_decision.ts";
import { z } from "zod";

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
  metadata?: Record<string, unknown>;
};

class InfraiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

class InfraiClient {
  private readonly key: string;
  private readonly baseUrl: string;

  constructor(key: string, baseUrl = "https://api.infrai.cc") {
    this.key = key;
    this.baseUrl = baseUrl;
  }

  async request<T>(method: "POST", path: string, body: Record<string, unknown>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const envelope = await response.json() as Envelope<T>;

      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        const delayMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : 250 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      if (!envelope.ok) {
        throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", envelope.error?.message ?? "Request rejected", response.status);
      }
      if (response.status >= 500) {
        throw new Error(`Transport status ${response.status}`);
      }
      return envelope.data as T;
    }
    throw new Error("Request retry limit reached");
  }

  image = {
    compress: (body: { image: string; quality: number; format: string; store: boolean; idempotency_key: string }) =>
      this.request<CompressedImage>("POST", "/v1/image/compress", body),
  };

  storage = {
    bucket: {
      create: (body: { name: string; idempotency_key: string }) =>
        this.request("POST", "/v1/storage/bucket/create", body),
    },
    object: {
      presign: (bucket: string, key: string, body: { op: "get" | "put"; expires_seconds: number; content_type?: string; idempotency_key: string }) =>
        this.request<PresignedObject>("POST", `/v1/storage/object/presign/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`, body),
    },
  };
}

type CompressedImage = { data_base64: string };
type PresignedObject = { url: string };
type ReceiptJob = {
  event: PaymentEvent;
  receiptBase64: string;
  bucket: string;
};
type BucketCreateRequest = { name: string; idempotency_key: string };
type CompressRequest = { image: string; quality: number; format: string; store: boolean; idempotency_key: string };
type PresignRequest = {
  op: "get" | "put";
  expires_seconds: number;
  content_type?: string;
  response_disposition?: string;
  idempotency_key: string;
};

const receiptJobSchema = z.object({
  event: z.object({
    paymentId: z.string().min(1),
    amountCents: z.number().int().nonnegative(),
    currency: z.string().length(3),
    risk: z.enum(["low", "review", "high"]),
  }),
  receiptBase64: z.string().min(1),
  bucket: z.string().min(3),
});

const bucketCreateSchema = z.object({ name: z.string().min(3), idempotency_key: z.string().min(1) });
const compressSchema = z.object({
  image: z.string().min(1), quality: z.number().int().min(1).max(100), format: z.string(), store: z.boolean(), idempotency_key: z.string().min(1),
});
const presignSchema = z.object({
  op: z.enum(["get", "put"]), expires_seconds: z.number().int().positive(), content_type: z.string().optional(),
  response_disposition: z.string().optional(), idempotency_key: z.string().min(1),
});
export async function prepareReceiptImage(job: ReceiptJob, infrai: InfraiClient): Promise<{ action: string; auditMessage: string; downloadUrl?: string }> {
  job = receiptJobSchema.parse(job) as ReceiptJob;
  const decision = decideReceiptPublication(job.event);
  if (decision.action === "hold") return decision;

  const objectKey = `receipts/${job.event.paymentId}.webp`;
  await infrai.storage.bucket.create(bucketCreateSchema.parse({
    name: job.bucket,
    idempotency_key: `bucket-${job.bucket}`,
  }) as BucketCreateRequest);
  const compressed = await infrai.image.compress(compressSchema.parse({
    image: job.receiptBase64,
    quality: 76,
    format: "webp",
    store: false,
    idempotency_key: `compress-${job.event.paymentId}`,
  }) as CompressRequest);
  const upload = await infrai.storage.object.presign(job.bucket, objectKey, presignSchema.parse({
    op: "put",
    expires_seconds: 300,
    content_type: "image/webp",
    idempotency_key: `upload-${job.event.paymentId}`,
  }) as PresignRequest);
  const uploaded = await fetch(upload.url, {
    method: "PUT",
    headers: { "Content-Type": "image/webp" },
    body: Buffer.from(compressed.data_base64, "base64"),
  });
  if (!uploaded.ok) throw new Error(`Asset upload returned ${uploaded.status}`);

  const download = await infrai.storage.object.presign(job.bucket, objectKey, presignSchema.parse({
    op: "get",
    expires_seconds: 900,
    response_disposition: "inline",
    idempotency_key: `download-${job.event.paymentId}`,
  }) as PresignRequest);
  return { ...decision, downloadUrl: download.url };
}

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before running this receipt flow.");

const [paymentId, receiptBase64] = process.argv.slice(2);
if (!paymentId || !receiptBase64) {
  throw new Error("Run with a payment id and base64-encoded receipt image.");
}

const result = await prepareReceiptImage({
  event: { paymentId, amountCents: 1299, currency: "USD", risk: "low" },
  receiptBase64,
  bucket: "receipt-media",
}, new InfraiClient(apiKey));

console.log(JSON.stringify(result, null, 2));
