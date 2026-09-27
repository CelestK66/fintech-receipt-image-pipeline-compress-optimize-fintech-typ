import { decideReceiptPublication } from "./payment_image_decision.ts";

const decision = decideReceiptPublication({
  paymentId: "pay_108",
  amountCents: 1299,
  currency: "USD",
  risk: "high",
});

if (decision.action !== "hold") {
  throw new Error("Expected a high-risk payment receipt to remain held.");
}

if (decision.auditMessage !== "Receipt for pay_108 is held for risk review.") {
  throw new Error("Expected the audit message to name the held payment.");
}

console.log("high-risk receipt stays held");
