"use client";

export function PartnerReadOnlyBanner({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-amber-300/90 bg-amber-50/95 text-amber-950 px-4 py-3 text-sm shadow-sm">
      <p className="font-semibold">View only</p>
      <p className="mt-1 text-amber-950/90">{message}</p>
    </div>
  );
}
