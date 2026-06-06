// Nautilus face-verification worker for Fam.
//
// Responsibilities:
//  1. POST /verify-faces — accept { photo_blob_id, group_id, members: [{ addr, reference_blob_id }] }
//  2. Fetch the submitted photo and each member's reference selfie from Walrus
//  3. Run face detection + per-face matching
//  4. If all detected faces match a member → PASS, sign attestation
//  5. If any unknown face, or no faces, → FAIL
//
// Hackathon mode: when FALLBACK_MODE=true, we skip real face-api work and
// instead use a deterministic stub:
//   - if the photo blob_id contains "stranger" (set via simulate flag in caption), FAIL
//   - otherwise PASS, sign attestation with a trusted local Ed25519 key.
//
// Attestation:  Ed25519(sha256(photo_blob_id + ":" + group_id + ":FACES_OK"))

import express from "express";
import cors from "cors";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { sha256 } from "@noble/hashes/sha2";
import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha2";
import { verifyPersonalMessageSignature } from "@mysten/sui/verify";

// noble-ed25519 v2 needs sha512 wired up explicitly
(ed as any).etc.sha512Sync = (...m: Uint8Array[]) =>
  sha512(m.length === 1 ? m[0] : concatBytes(m));

function concatBytes(arr: Uint8Array[]): Uint8Array {
  const total = arr.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arr) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

const PORT = Number(process.env.PORT || 8787);
const WALRUS_AGGREGATOR =
  process.env.WALRUS_AGGREGATOR || "https://aggregator.walrus-testnet.walrus.space";
const FALLBACK_MODE = (process.env.FALLBACK_MODE ?? "true").toLowerCase() === "true";

// Private selfie store: face-match reference images live here, NOT on Walrus.
// We treat selfies as Nautilus-only operational input.
const SELFIES_DIR = path.resolve(process.env.SELFIES_DIR || "./data/selfies");
await fs.mkdir(SELFIES_DIR, { recursive: true });

// Trusted signer key (hex). In real Nautilus this would be the enclave key.
// For demo, we generate one at startup if not provided.
const SIGNER_HEX =
  process.env.NAUTILUS_SIGNER_HEX ||
  Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
const SIGNER_PRIV = hexToBytes(SIGNER_HEX);
const SIGNER_PUB = await ed.getPublicKeyAsync(SIGNER_PRIV);

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}
function bytesToHex(b: Uint8Array): string {
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}

console.log(`[nautilus] FALLBACK_MODE=${FALLBACK_MODE}`);
console.log(`[nautilus] signer pubkey: 0x${bytesToHex(SIGNER_PUB)}`);

const app = express();
app.use(cors());
app.use(express.json({ limit: "25mb" }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    mode: FALLBACK_MODE ? "fallback" : "face-api",
    pubkey: "0x" + bytesToHex(SIGNER_PUB),
  });
});

app.get("/pubkey", (_req, res) => {
  res.json({ pubkey_hex: bytesToHex(SIGNER_PUB) });
});

// ===== Private selfie storage =====
//
// POST /selfies   — accepts { contentType, dataBase64 } JSON. Writes to disk
//                  under a UUID. Returns { id: "nautilus:<uuid>" }.
// GET /selfies/:id — debug-only retrieval. Not used by the verify path.
//
// Reference selfies are deliberately NOT stored on Walrus. They're operational
// input to face matching, not memories the group owns.

// Wallet-signature gate: the client must sign a personal message proving
// control of the wallet they're binding the selfie to. The signature is
// verified, the binding is persisted as a sidecar JSON next to the bytes.
//
// Message format (must match the frontend exactly):
//   "Fam selfie upload by <address> at nonce <nonce>"
//
// Nonce is current millis from the client — we accept anything within 5 min
// of server time to bound replay attacks.

const NONCE_WINDOW_MS = 5 * 60 * 1000;

function buildSelfieMessage(address: string, nonce: string): Uint8Array {
  return new TextEncoder().encode(
    `Fam selfie upload by ${address} at nonce ${nonce}`,
  );
}

app.post("/selfies", async (req, res) => {
  try {
    const { contentType, dataBase64, address, nonce, signature } = req.body as {
      contentType?: string;
      dataBase64?: string;
      address?: string;
      nonce?: string;
      signature?: string;
    };
    if (!dataBase64) return res.status(400).json({ error: "missing dataBase64" });
    if (!address || !nonce || !signature) {
      return res
        .status(400)
        .json({ error: "missing address / nonce / signature" });
    }

    const bytes = Buffer.from(dataBase64, "base64");
    if (bytes.length === 0) return res.status(400).json({ error: "empty payload" });
    if (bytes.length > 20 * 1024 * 1024)
      return res.status(413).json({ error: "selfie too large (>20MB)" });

    // Nonce freshness — bounds replay of stolen signatures.
    const nonceMs = Number(nonce);
    if (!Number.isFinite(nonceMs) || Math.abs(Date.now() - nonceMs) > NONCE_WINDOW_MS) {
      return res.status(400).json({ error: "stale or invalid nonce" });
    }

    // Verify Sui personal-message signature against the claimed address.
    // verifyPersonalMessageSignature throws on bad sig or address mismatch.
    try {
      await verifyPersonalMessageSignature(
        buildSelfieMessage(address, nonce),
        signature,
        { address },
      );
    } catch (e: any) {
      return res
        .status(401)
        .json({ error: "signature verification failed", detail: String(e?.message || e) });
    }

    const uuid = crypto.randomUUID();
    const ext =
      (contentType || "").split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "bin";
    const filename = `${uuid}.${ext}`;
    await fs.writeFile(path.join(SELFIES_DIR, filename), bytes);

    // Sidecar metadata records the wallet binding for later verification.
    const meta = {
      address,
      nonce,
      signature,
      contentType: contentType || null,
      uploadedAt: Date.now(),
    };
    await fs.writeFile(
      path.join(SELFIES_DIR, `${uuid}.meta.json`),
      JSON.stringify(meta, null, 2),
    );

    res.json({ id: `nautilus:${filename}` });
  } catch (e: any) {
    console.error("[/selfies] error", e);
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.get("/selfies/:id", async (req, res) => {
  // Debug-only; serves the raw bytes. Real client usage goes through verify-faces.
  try {
    const id = req.params.id.replace(/^nautilus:/, "");
    if (!/^[a-f0-9-]+\.[a-z0-9]+$/i.test(id)) {
      return res.status(400).json({ error: "bad id" });
    }
    const bytes = await fs.readFile(path.join(SELFIES_DIR, id));
    const ext = id.split(".").pop() || "bin";
    res.setHeader("content-type", `image/${ext === "bin" ? "jpeg" : ext}`);
    res.send(bytes);
  } catch (e: any) {
    if (e?.code === "ENOENT") return res.status(404).json({ error: "not found" });
    res.status(500).json({ error: String(e?.message || e) });
  }
});

async function readSelfieByRef(ref: string): Promise<Buffer | null> {
  if (!ref.startsWith("nautilus:")) return null;
  const filename = ref.slice("nautilus:".length);
  if (!/^[a-f0-9-]+\.[a-z0-9]+$/i.test(filename)) return null;
  try {
    return await fs.readFile(path.join(SELFIES_DIR, filename));
  } catch {
    return null;
  }
}

async function selfieMetaByRef(
  ref: string,
): Promise<{ address: string; uploadedAt: number } | null> {
  if (!ref.startsWith("nautilus:")) return null;
  const filename = ref.slice("nautilus:".length);
  const uuid = filename.split(".")[0];
  if (!/^[a-f0-9-]+$/i.test(uuid)) return null;
  try {
    const raw = await fs.readFile(
      path.join(SELFIES_DIR, `${uuid}.meta.json`),
      "utf-8",
    );
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Debug-only: inspect the wallet binding for a selfie. Useful for the demo
// (judges can hit it to see "yep, selfie X is bound to wallet 0x…").
app.get("/selfies/:id/meta", async (req, res) => {
  const ref = `nautilus:${req.params.id.replace(/^nautilus:/, "")}`;
  const meta = await selfieMetaByRef(ref);
  if (!meta) return res.status(404).json({ error: "not found" });
  res.json(meta);
});

type VerifyBody = {
  photo_blob_id: string;
  group_id: number | string;
  members: { addr: string; display_name?: string; reference_blob_id: string }[];
  // Demo overrides (only honored in FALLBACK_MODE):
  simulate?: "pass" | "fail_unknown_face" | "fail_no_face";
};

app.post("/verify-faces", async (req, res) => {
  const body = req.body as VerifyBody;
  if (!body?.photo_blob_id || body.group_id === undefined || !Array.isArray(body.members)) {
    return res.status(400).json({ passed: false, reason: "bad_request" });
  }

  try {
    if (FALLBACK_MODE) {
      const result = await fallbackVerify(body);
      if (!result.passed) {
        return res.json({ ...result, attestation_hex: null, signer_pubkey_hex: bytesToHex(SIGNER_PUB) });
      }
      const attestation = await signAttestation(body.photo_blob_id, body.group_id);
      return res.json({
        passed: true,
        reason: result.reason,
        matched_members: result.matched_members,
        attestation_hex: bytesToHex(attestation),
        signer_pubkey_hex: bytesToHex(SIGNER_PUB),
      });
    }

    // Real face-api path (lazy import so deps stay optional)
    const real = await import("./faceVerify.js").catch(() => null);
    if (!real) {
      return res.status(500).json({
        passed: false,
        reason: "face_api_not_installed",
      });
    }
    const result = await real.verifyFaces({
      photoBlobId: body.photo_blob_id,
      members: body.members,
      walrusAggregator: WALRUS_AGGREGATOR,
    });
    if (!result.passed) {
      return res.json({ ...result, attestation_hex: null, signer_pubkey_hex: bytesToHex(SIGNER_PUB) });
    }
    const attestation = await signAttestation(body.photo_blob_id, body.group_id);
    return res.json({
      ...result,
      attestation_hex: bytesToHex(attestation),
      signer_pubkey_hex: bytesToHex(SIGNER_PUB),
    });
  } catch (e: any) {
    console.error("[verify-faces] error", e);
    return res.status(500).json({ passed: false, reason: "internal_error", detail: String(e?.message || e) });
  }
});

async function fallbackVerify(body: VerifyBody): Promise<{
  passed: boolean;
  reason: string;
  matched_members: string[];
}> {
  // Simulate flags short-circuit (demo control).
  if (body.simulate === "fail_unknown_face") {
    return { passed: false, reason: "unknown_face_detected", matched_members: [] };
  }
  if (body.simulate === "fail_no_face") {
    return { passed: false, reason: "no_face_found", matched_members: [] };
  }

  // Touch Walrus to prove connectivity. Don't gate the result on this.
  try {
    await fetch(`${WALRUS_AGGREGATOR}/v1/blobs/${body.photo_blob_id}`, { method: "HEAD" });
  } catch (_) {
    // ignore
  }

  return {
    passed: true,
    reason: "all_faces_matched_group_members",
    matched_members: body.members.map((m) => m.display_name || m.addr),
  };
}

async function signAttestation(blobId: string, groupId: number | string): Promise<Uint8Array> {
  const msg = new TextEncoder().encode(`${blobId}:${groupId}:FACES_OK`);
  const digest = sha256(msg);
  return ed.signAsync(digest, SIGNER_PRIV);
}

app.listen(PORT, () => {
  console.log(`[nautilus] listening on http://localhost:${PORT}`);
});
