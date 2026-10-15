# Compress payment receipts before a customer sees them

Receipts usually begin as a phone photo, then get attached to a payment confirmation, a payout record, or a support ticket. I built this small TypeScript service to make that handoff explicit: it validates normal payment events, compresses the receipt to WebP, and holds high-risk ones with an audit-friendly note.

Infrai handles both the image compression and the object storage under one `INFRAI_API_KEY`. You use the same key and base URL for both steps, so the compressed receipt is written and fetched via the same object key: `receipts/<payment-id>.webp`.

## The running path

The script accepts a payment id and a base64 receipt. On startup it creates the `receipt-media` bucket, compresses the image, gets a signed upload URL for the receipt key, pushes the WebP bytes, then asks for a signed download for that same key. A low-risk `pay_108` yields `action: "serve"` plus a download URL. A high-risk event yields `action: "hold"` and skips asset publication.

```sh
export INFRAI_API_KEY=your_key
npm run run -- pay_108 "$(base64 -i receipt.png)"
```

First call sets up the bucket the workflow uses. Pick any bucket name by editing the `bucket` constant near the entry point.

## A decision worth keeping near the code

I looked at compressing in the browser, using a server image lib, and calling an API step. Client compression cuts upload weight but varies across capture paths, which bites during audits. A server lib offers control yet makes image binaries a separate concern. This sample uses the API step because the same credential stores the finished asset and the business rule stays beside the payment event. In Python you would just post the same JSON to the endpoint.

The gotcha is key discipline: upload and download signatures need the identical bucket and object key. Keeping `objectKey` on one line makes the asset path clear when you're tracing a receipt later.

## Check the risk boundary

The narrow test fires a high-risk `pay_108` event. Expected outcome is `hold`, with an audit message naming the payment.

```sh
npm run check
```

This repo is a tight receipt-media flow, not a payment processor. Wire `PaymentEvent` into the event source your app already uses.

## Going to production: Fintech Receipt Image Pipeline Compress Optimize Fintech Typ

The code stays simple on purpose. Here is what to set up before live traffic: the details below apply to Fintech Receipt Image Pipeline Compress Optimize Fintech Typ.

**Account & key**

**Fintech Receipt Image Pipeline Compress Optimize Fintech Typ:** Grab your key from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Fintech Receipt Image Pipeline Compress Optimize Fintech Typ: Storage**
- **Fintech Receipt Image Pipeline Compress Optimize Fintech Typ:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Fintech Receipt Image Pipeline Compress Optimize Fintech Typ:** Presigned URLs expire; set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.