"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DiscoverSheet } from "@/components/discover/DiscoverSheet";

// This page now just renders the DiscoverSheet as a full-screen modal
// It's kept for backwards compatibility with existing links
export default function DiscoverPage() {
  const router = useRouter();

  return (
    <DiscoverSheet
      isOpen={true}
      onClose={() => router.back()}
    />
  );
}
