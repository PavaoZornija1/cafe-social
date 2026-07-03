function truthy(raw: string | undefined): boolean {
  const v = raw?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Guest receipt photo → staff review. Off unless NEXT_PUBLIC_RECEIPT_SUBMISSIONS_ENABLED is set. */
export function isReceiptSubmissionsEnabled(): boolean {
  return truthy(process.env.NEXT_PUBLIC_RECEIPT_SUBMISSIONS_ENABLED);
}
