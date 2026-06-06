// Mysten Seal client + helpers: encrypt before Walrus upload, decrypt on view.
//
// Identity scoping:
//   The Move `seal_approve(id, group, ctx)` policy requires `id` to start with
//   the group's object ID bytes. We use exactly the BCS-encoded group id (32 bytes)
//   as the identity, which means all photos in a group share the same identity —
//   any current member can decrypt any of them. This is the right model for Fam.

import { SealClient, SessionKey } from "@mysten/seal";
import { Transaction } from "@mysten/sui/transactions";
import { fromHex, toHex } from "@mysten/sui/utils";
import { makeSuiClient } from "./sui";
import { PACKAGE_ID, MODULE } from "./contract";

const KEY_SERVER_1 = process.env.NEXT_PUBLIC_SEAL_KEY_SERVER_1!;
const KEY_SERVER_2 = process.env.NEXT_PUBLIC_SEAL_KEY_SERVER_2!;
const THRESHOLD = Number(process.env.NEXT_PUBLIC_SEAL_THRESHOLD || 2);

let _seal: SealClient | null = null;

export function getSealClient(): SealClient {
  if (_seal) return _seal;
  _seal = new SealClient({
    suiClient: makeSuiClient() as any,
    serverConfigs: [
      { objectId: KEY_SERVER_1, weight: 1 },
      { objectId: KEY_SERVER_2, weight: 1 },
    ],
    verifyKeyServers: false,
  });
  return _seal;
}

/** Identity bytes for a group: the 32-byte object id (hex without 0x). */
export function groupIdentityHex(groupObjectId: string): string {
  return groupObjectId.startsWith("0x") ? groupObjectId.slice(2) : groupObjectId;
}

export async function encryptForGroup(
  data: Uint8Array,
  groupObjectId: string,
): Promise<Uint8Array> {
  const client = getSealClient();
  const id = groupIdentityHex(groupObjectId);
  const { encryptedObject } = await client.encrypt({
    threshold: THRESHOLD,
    packageId: PACKAGE_ID,
    id,
    data,
  });
  return encryptedObject;
}

/** Build the seal_approve tx kind used as proof when fetching decryption keys. */
export async function buildSealApproveTxBytes(
  groupObjectId: string,
): Promise<Uint8Array> {
  const tx = new Transaction();
  const id = groupIdentityHex(groupObjectId);
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE}::seal_approve`,
    arguments: [
      tx.pure.vector("u8", Array.from(fromHex(id))),
      tx.object(groupObjectId),
    ],
  });
  const client = makeSuiClient() as any;
  return tx.build({ client, onlyTransactionKind: true });
}

export async function decryptForGroup(
  encryptedObject: Uint8Array,
  groupObjectId: string,
  sessionKey: SessionKey,
): Promise<Uint8Array> {
  const client = getSealClient();
  const txBytes = await buildSealApproveTxBytes(groupObjectId);
  const decrypted = await client.decrypt({
    data: encryptedObject,
    sessionKey,
    txBytes,
  });
  return decrypted;
}

export { SessionKey };
export { toHex, fromHex };
