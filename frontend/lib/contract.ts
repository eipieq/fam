// Typed helpers for building Move calls to fam::groups.
// Returns Transaction objects ready to be signed via the connected wallet.

import { Transaction } from "@mysten/sui/transactions";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

export const PACKAGE_ID = process.env.NEXT_PUBLIC_CONTRACT_PACKAGE || "";
export const FAM_STATE_ID = process.env.NEXT_PUBLIC_FAM_STATE || "";
export const MODULE = "groups";

if (!PACKAGE_ID) console.warn("NEXT_PUBLIC_CONTRACT_PACKAGE not set");
if (!FAM_STATE_ID) console.warn("NEXT_PUBLIC_FAM_STATE not set");

// Encode a vector<u8> from string (utf-8) for Move calls
function utf8(s: string): number[] {
  return Array.from(new TextEncoder().encode(s));
}

export function buildCreateGroup(args: {
  name: string;
  displayName: string;
  referenceBlobId: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE}::create_group`,
    arguments: [
      tx.object(FAM_STATE_ID),
      tx.pure.vector("u8", utf8(args.name)),
      tx.pure.vector("u8", utf8(args.displayName)),
      tx.pure.vector("u8", utf8(args.referenceBlobId)),
      tx.object("0x6"), // Clock
    ],
  });
  return tx;
}

export function buildInviteMember(args: {
  groupObjectId: string;
  invitee: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE}::invite_member`,
    arguments: [
      tx.object(args.groupObjectId),
      tx.pure.address(args.invitee),
    ],
  });
  return tx;
}

export function buildRegisterSelfie(args: {
  groupObjectId: string;
  displayName: string;
  referenceBlobId: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE}::register_selfie`,
    arguments: [
      tx.object(args.groupObjectId),
      tx.pure.vector("u8", utf8(args.displayName)),
      tx.pure.vector("u8", utf8(args.referenceBlobId)),
      tx.object("0x6"),
    ],
  });
  return tx;
}

export function buildBuyFuel(args: {
  groupObjectId: string;
  amountMist: bigint;
}): Transaction {
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [args.amountMist]);
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE}::buy_fuel`,
    arguments: [tx.object(args.groupObjectId), coin],
  });
  return tx;
}

export function buildSubmitPhoto(args: {
  groupObjectId: string;
  blobId: string;
  caption: string;
  nautilusAttestation: Uint8Array;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE}::submit_photo`,
    arguments: [
      tx.object(args.groupObjectId),
      tx.pure.vector("u8", utf8(args.blobId)),
      tx.pure.vector("u8", utf8(args.caption)),
      tx.pure.vector("u8", Array.from(args.nautilusAttestation)),
      tx.object("0x6"),
    ],
  });
  return tx;
}

export function buildVotePhoto(args: {
  groupObjectId: string;
  photoId: bigint | number;
  approve: boolean;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE}::vote_photo`,
    arguments: [
      tx.object(args.groupObjectId),
      tx.pure.u64(args.photoId),
      tx.pure.bool(args.approve),
    ],
  });
  return tx;
}

// ===== Reads =====
// Sui Move structs are returned via object content. Parse them lightly.

export type ParsedGroup = {
  objectId: string;
  groupId: number;
  name: string;
  members: ParsedMember[];
  photoCount: number;
  fuel: number;
  createdAt: number;
  admin: string;
  invited: string[];
};

export type ParsedMember = {
  addr: string;
  displayName: string;
  referenceBlobId: string;
  joinedAt: number;
};

export type ParsedPhoto = {
  id: number;
  blobId: string;
  caption: string;
  submittedBy: string;
  submittedAt: number;
  approvals: string[];
  rejections: string[];
  sealed: boolean;
  faceCheckPassed: boolean;
};

/** Parse a group object response from sui_getObject. */
export function parseGroup(raw: any): ParsedGroup | null {
  const fields = raw?.data?.content?.fields;
  if (!fields) return null;
  return {
    objectId: raw.data.objectId,
    groupId: Number(fields.group_id),
    name: fields.name,
    members: (fields.members || []).map((m: any) => ({
      addr: m.fields.addr,
      displayName: m.fields.display_name,
      referenceBlobId: m.fields.reference_blob_id,
      joinedAt: Number(m.fields.joined_at),
    })),
    photoCount: Number(fields.photo_count),
    fuel: Number(fields.fuel),
    createdAt: Number(fields.created_at),
    admin: fields.admin,
    invited: fields.invited || [],
  };
}

export async function fetchGroup(
  client: SuiJsonRpcClient,
  groupObjectId: string,
): Promise<ParsedGroup | null> {
  const obj = await client.getObject({
    id: groupObjectId,
    options: { showContent: true, showType: true },
  });
  return parseGroup(obj);
}

/** Fetch a photo from the group's photos Table via dynamic field. */
export async function fetchPhoto(
  client: SuiJsonRpcClient,
  groupObjectId: string,
  photoId: number,
): Promise<ParsedPhoto | null> {
  // Photos are stored in a Table<u64, Photo>. Read via dynamic field.
  const group = await client.getObject({
    id: groupObjectId,
    options: { showContent: true },
  });
  const photosTableId =
    (group as any)?.data?.content?.fields?.photos?.fields?.id?.id;
  if (!photosTableId) return null;

  const dyn = await client.getDynamicFieldObject({
    parentId: photosTableId,
    name: { type: "u64", value: String(photoId) },
  });
  const fields = (dyn as any)?.data?.content?.fields?.value?.fields;
  if (!fields) return null;
  return {
    id: Number(fields.id),
    blobId: fields.blob_id,
    caption: fields.caption,
    submittedBy: fields.submitted_by,
    submittedAt: Number(fields.submitted_at),
    approvals: fields.approvals || [],
    rejections: fields.rejections || [],
    sealed: fields.sealed,
    faceCheckPassed: fields.face_check_passed,
  };
}
