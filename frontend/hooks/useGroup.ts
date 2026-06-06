"use client";

import { useQuery } from "@tanstack/react-query";
import { useSuiClient } from "@mysten/dapp-kit";
import { parseGroup, ParsedGroup } from "@/lib/contract";

export function useGroup(groupObjectId: string | undefined) {
  const client = useSuiClient();
  return useQuery<ParsedGroup | null>({
    queryKey: ["group", groupObjectId],
    enabled: !!groupObjectId,
    queryFn: async () => {
      if (!groupObjectId) return null;
      const obj = await client.getObject({
        id: groupObjectId,
        options: { showContent: true, showType: true },
      });
      return parseGroup(obj);
    },
    refetchInterval: 5000,
  });
}
