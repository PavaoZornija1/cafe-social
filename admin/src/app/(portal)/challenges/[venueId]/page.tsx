"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

/** Legacy route — superseded by the venue CMS editor. Redirect to the canonical path. */
export default function LegacyChallengesAdminPage() {
  const { venueId } = useParams<{ venueId: string }>();
  const router = useRouter();

  useEffect(() => {
    if (venueId) {
      router.replace(`/venues/${venueId}/challenges`);
    }
  }, [router, venueId]);

  return null;
}
