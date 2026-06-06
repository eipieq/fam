// Sui JSON-RPC client wired through Tatum gateway with API key header.
import {
  SuiJsonRpcClient,
  JsonRpcHTTPTransport,
} from "@mysten/sui/jsonRpc";

const TATUM_RPC =
  process.env.NEXT_PUBLIC_TATUM_RPC_URL || "https://sui-testnet.gateway.tatum.io";
const TATUM_KEY = process.env.NEXT_PUBLIC_TATUM_API_KEY || "";

let _client: SuiJsonRpcClient | null = null;

export function getSuiClient(): SuiJsonRpcClient {
  if (_client) return _client;
  _client = makeSuiClient();
  return _client;
}

export function makeSuiClient(): SuiJsonRpcClient {
  // Tatum is our preferred path, but the unauthenticated free tier sometimes
  // 401s on the RPC methods Transaction.toJSON() needs for tx serialization.
  // When NEXT_PUBLIC_USE_FULLNODE=true we use the public Sui fullnode as a
  // fallback — handy for debugging wallet signing.
  const useFullnode = process.env.NEXT_PUBLIC_USE_FULLNODE === "true";
  const url = useFullnode ? "https://fullnode.testnet.sui.io:443" : TATUM_RPC;
  const transport = new JsonRpcHTTPTransport({
    url,
    rpc: {
      headers: !useFullnode && TATUM_KEY ? { "x-api-key": TATUM_KEY } : {},
    },
  });
  return new SuiJsonRpcClient({ transport, network: "testnet" });
}
