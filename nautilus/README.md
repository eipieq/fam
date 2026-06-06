# Fam — Nautilus Face-Verification Worker

Express service that:

1. Accepts `POST /verify-faces`
2. Fetches submitted photo + member reference selfies from Walrus
3. Runs face detection (face-api.js) and matches each detected face against members
4. Signs an Ed25519 attestation `sha256(blob_id:group_id:FACES_OK)` if all faces match
5. Returns `{ passed, reason, matched_members, attestation_hex, signer_pubkey_hex }`

## Modes

- `FALLBACK_MODE=true` (default) — skips face-api, returns deterministic pass/fail.
  - `simulate: "fail_unknown_face"` in request body → returns failure (for the demo).
- `FALLBACK_MODE=false` — uses `@vladmandic/face-api` + `@tensorflow/tfjs-node` + `canvas` (must install separately and download model files into `./models`).

## Run

```bash
pnpm install
pnpm dev          # → http://localhost:8787
```

Health: `GET /health`
Pubkey: `GET /pubkey`

## Env

- `PORT` — default `8787`
- `WALRUS_AGGREGATOR` — default Walrus testnet aggregator
- `FALLBACK_MODE` — default `true`
- `NAUTILUS_SIGNER_HEX` — hex-encoded Ed25519 priv key (32 bytes). If unset, one is generated at startup (NOT persisted).

## Real Nautilus

In production this would run inside a Nautilus enclave so the signer key is attested. For the hackathon we use a trusted local signer; the smart contract verifies the signature against a stored pubkey.
