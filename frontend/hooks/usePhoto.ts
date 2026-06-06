"use client";

import { useQuery } from "@tanstack/react-query";
import { useSuiClient } from "@mysten/dapp-kit";
import { fetchPhoto, ParsedPhoto } from "@/lib/contract";

export function usePhoto(groupObjectId: string | undefined, photoId: number | undefined) {
  const client = useSuiClient();
  return useQuery<ParsedPhoto | null>({
    queryKey: ["photo", groupObjectId, photoId],
    enabled: !!groupObjectId && photoId !== undefined,
    queryFn: async () => {
      if (!groupObjectId || photoId === undefined) return null;
      return fetchPhoto(client as any, groupObjectId, photoId);
    },
    refetchInterval: 5000,
  });
}

export function useAllPhotos(groupObjectId: string | undefined, photoCount: number) {
  const client = useSuiClient();
  return useQuery<ParsedPhoto[]>({
    queryKey: ["all-photos", groupObjectId, photoCount],
    enabled: !!groupObjectId && photoCount >= 0,
    queryFn: async () => {
      if (!groupObjectId) return [];
      const ids = Array.from({ length: photoCount }, (_, i) => i);
      const results = await Promise.all(
        ids.map((id) => fetchPhoto(client as any, groupObjectId, id).catch(() => null)),
      );
      return results.filter((p): p is ParsedPhoto => !!p);
    },
    refetchInterval: 5000,
  });
}
