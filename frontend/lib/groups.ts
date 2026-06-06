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

  const summaries: GroupSummary[] = [];
  for (const e of events.data || []) {
    const j = e.parsedJson;
    if (!j) continue;
    const groupId = Number(j.group_id);
    const groupObjectId = await resolveGroupObjectId(groupId);
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
