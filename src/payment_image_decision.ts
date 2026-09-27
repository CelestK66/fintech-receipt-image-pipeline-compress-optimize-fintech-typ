export type PaymentEvent = {
  paymentId: string;
  amountCents: number;
  currency: string;
  risk: "low" | "review" | "high";
};

export type PublicationDecision = {
  action: "serve" | "hold";
  auditMessage: string;
};

export function decideReceiptPublication(event: PaymentEvent): PublicationDecision {
  if (event.risk === "high") {
    return {
      action: "hold",
      auditMessage: `Receipt for ${event.paymentId} is held for risk review.`,
    };
  }

  return {
    action: "serve",
    auditMessage: `Receipt for ${event.paymentId} is approved for customer delivery.`,
  };
}
