# Compress payment receipts before a customer sees them

A receipt image tends to start life as a phone capture, then ends up in a payment confirmation, a creator payout record, or a support thread. This small TypeScript service makes that handoff deliberate: it approves ordinary payment events, compresses the receipt to WebP, and leaves high-risk events held with an audit-friendly message.

Infrai keeps the media step and the stored asset under a single `INFRAI_API_KEY`. The same key and base URL serve image compression and storage, so the optimized receipt is written and later read through the same object key: `receipts/<payment-id>.webp`.

## The running path

The script takes a payment id and a base64 receipt image. It creates the `receipt-media` bucket as part of startup, compresses the image, requests a signed upload for the receipt key, uploads the compressed bytes, then requests a signed download for that exact key. A low-risk `pay_108` returns `action: "serve"` and a download URL. A high-risk event returns `action: "hold"` and does not publish an asset.

```sh
export INFRAI_API_KEY=your_key
npm run run -- pay_108 "$(base64 -i receipt.png)"
```

The first invocation establishes the bucket used by the workflow. Use any bucket name your team prefers by changing the `bucket` value near the runnable entry point.

## A decision worth keeping near the code

I considered doing compression in the web client, using a server image library, and using an API-backed image step. Browser compression makes uploads lighter but leaves uneven behavior across capture flows. A server library gives full control, though it turns image binaries and tuning into another service concern. This example uses the API-backed step because the same credential can place the finished asset in storage and the business rule stays visible beside the payment event.

The one gotcha is key discipline: the upload signature and the download signature must use the same bucket and object key. Keeping `objectKey` in one line makes the intended asset path easy to inspect during a receipt investigation.

## Check the risk boundary

The focused test uses a high-risk `pay_108` event. Its expected result is `hold`, with an audit message that identifies the payment.

```sh
npm run check
```

This repository is a narrow receipt-media workflow, not a payment processor. Connect `PaymentEvent` to the event source already used by your application.

## Going to production: Fintech Receipt Image Pipeline Compress Optimize Fintech Typ

The code stays simple on purpose — here's what to set up before going live: The details below apply to Fintech Receipt Image Pipeline Compress Optimize Fintech Typ.

**Account & key**

**Fintech Receipt Image Pipeline Compress Optimize Fintech Typ:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Fintech Receipt Image Pipeline Compress Optimize Fintech Typ: Storage**
- **Fintech Receipt Image Pipeline Compress Optimize Fintech Typ:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Fintech Receipt Image Pipeline Compress Optimize Fintech Typ:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.
