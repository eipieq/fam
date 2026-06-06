// Find Group object IDs by querying GroupCreated events emitted by our package.
// Used to power the landing page list and to map a user's address → their groups.

import { suiRpc } from "./tatum";
import { PACKAGE_ID, MODULE } from "./contract";

export type GroupSummary = {
  groupId: number;
  groupObjectId: string;
  name: string;
  admin: string;
  createdAtMs: number;
};

// Once a group is created on-chain, its object ID is immutable. Tatum's
// load-balanced fullnodes occasionally serve from a slightly-stale node and
// return null for dynamic-field reads on freshly-created groups — that's what
// caused groups to flicker in/out of the landing page. We cache resolved
// IDs in sessionStorage so a single successful resolve is enough to keep the
// group visible for the rest of the session.
const CACHE_KEY = "fam:groupIdCache:v1";

function readCache(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(sessionStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeCache(c: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    /* ignore quota */
  }
}

export async function listAllGroups(): Promise<GroupSummary[]> {
  if (!PACKAGE_ID) return [];

  // Get all GroupCreated events
  const events = await suiRpc<{
    data: Array<{
      parsedJson?: { group_id: string; admin: string; name: string };
      timestampMs: string;
    }>;
  }>("suix_queryEvents", [
    { MoveEventType: `${PACKAGE_ID}::${MODULE}::GroupCreated` },
    null,
    100,
    true,
  ]);

  const cache = readCache();
  const summaries: GroupSummary[] = [];
  let cacheDirty = false;

  for (const e of events.data || []) {
    const j = e.parsedJson;
    if (!j) continue;
    const groupId = Number(j.group_id);

    let groupObjectId = cache[String(groupId)];
    if (!groupObjectId) {
      const resolved = await resolveGroupObjectId(groupId);
      if (resolved) {
        groupObjectId = resolved;
        cache[String(groupId)] = resolved;
        cacheDirty = true;
      }
    }

    if (groupObjectId) {
      summaries.push({
        groupId,
        groupObjectId,
        name: j.name,
        admin: j.admin,
        createdAtMs: Number(e.timestampMs || 0),
      });
    }
  }

  if (cacheDirty) writeCache(cache);
  return summaries;
}

// FamState.groups Table maps group_id -> Group object address.
// We dynamically resolve via the dynamic field on the FamState's `groups` table.
export async function resolveGroupObjectId(groupId: number): Promise<string | null> {
  const FAM_STATE = process.env.NEXT_PUBLIC_FAM_STATE!;
  if (!FAM_STATE) return null;
  try {
    const state = await suiRpc<{
      data?: { content?: { fields?: { groups?: { fields?: { id?: { id?: string } } } } } };
    }>("sui_getObject", [
      FAM_STATE,
      { showType: true, showContent: true },
    ]);
    const tableId = state?.data?.content?.fields?.groups?.fields?.id?.id;
    if (!tableId) return null;
    const dyn = await suiRpc<{ data?: { content?: { fields?: { value?: string } } } }>(
      "suix_getDynamicFieldObject",
      [
        tableId,
        { type: "u64", value: String(groupId) },
      ],
    );
    return dyn?.data?.content?.fields?.value ?? null;
  } catch {
    return null;
  }
}
