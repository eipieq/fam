// Tatum RPC + Data API helpers for Sui testnet.
// All on-chain reads/writes route through Tatum to fulfill the hackathon requirement.

const TATUM_RPC =
  process.env.NEXT_PUBLIC_TATUM_RPC_URL || "https://sui-testnet.gateway.tatum.io";
const TATUM_KEY = process.env.NEXT_PUBLIC_TATUM_API_KEY || "";

let _rpcId = 0;

export type RpcError = { code: number; message: string };

export async function suiRpc<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
  _rpcId += 1;
  const body = { jsonrpc: "2.0", id: _rpcId, method, params };

  const res = await fetch(TATUM_RPC, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(TATUM_KEY ? { "x-api-key": TATUM_KEY } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tatum RPC HTTP ${res.status}: ${text}`);
  }
  const json = await res.json();
  if (json.error) {
    const err = json.error as RpcError;
    throw new Error(`Tatum RPC error ${err.code}: ${err.message}`);
  }
  return json.result as T;
}

/** Helper: read a Sui object by id with default options. */
export async function getObject(
  objectId: string,
  options: Record<string, boolean> = {
    showType: true,
    showContent: true,
    showOwner: true,
  },
): Promise<unknown> {
  return suiRpc("sui_getObject", [objectId, options]);
}

/** Helper: dry-run / inspect a transaction (used for view function calls). */
export async function devInspect(senderAddress: string, txBytes: string): Promise<unknown> {
  return suiRpc("sui_devInspectTransactionBlock", [senderAddress, txBytes]);
}

/** Query on-chain events via Tatum/Sui RPC. */
export async function queryEvents(query: {
  MoveEventType?: string;
  MoveModule?: { package: string; module: string };
  Sender?: string;
}, cursor: unknown = null, limit = 50, descending = true): Promise<{
  data: unknown[];
  nextCursor: unknown;
  hasNextPage: boolean;
}> {
  return suiRpc("suix_queryEvents", [query, cursor, limit, descending]);
}

/** Get owned objects for an address (for finding the user's groups). */
export async function getOwnedObjects(address: string, filter?: Record<string, unknown>) {
  return suiRpc("suix_getOwnedObjects", [
    address,
    { filter, options: { showType: true, showContent: true, showOwner: true } },
  ]);
}
