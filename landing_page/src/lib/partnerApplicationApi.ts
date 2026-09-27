export type SubmitPartnerApplicationPayload = {
  applicantEmail: string;
  applicantName: string;
  applicantPhone?: string;
  venueName: string;
  address: string;
  city: string;
  country: string;
};

export type SubmitPartnerApplicationResult = {
  id: string;
  status: "PENDING";
};

function apiBase(): string {
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
  if (!base) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }
  return base;
}

function parseApiError(text: string, fallback: string): string {
  try {
    const j = JSON.parse(text) as { message?: string | string[] };
    if (typeof j.message === "string") return j.message;
    if (Array.isArray(j.message)) return j.message.filter(Boolean).join("; ");
  } catch {
    /* not JSON */
  }
  return text?.trim() || fallback;
}

export async function submitPartnerApplication(
  payload: SubmitPartnerApplicationPayload,
): Promise<SubmitPartnerApplicationResult> {
  const res = await fetch(`${apiBase()}/partner-applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseApiError(text, res.statusText));
  }
  return JSON.parse(text) as SubmitPartnerApplicationResult;
}
