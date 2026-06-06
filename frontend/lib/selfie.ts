// Private selfie upload, wallet-bound.
//
// The reference selfie is face-match input for Nautilus, not a memory the
// group owns — so the bytes never touch Walrus. They go to Nautilus's
// private store keyed by a wallet-signed personal message that proves the
// uploader controls the wallet they're binding to. The on-chain
// `reference_blob_id` becomes "nautilus:<uuid>.<ext>" — a Nautilus-internal
// pointer, never a public URL.

const NAUTILUS_URL =
  process.env.NEXT_PUBLIC_NAUTILUS_URL || "http://localhost:8788";

export type SignPersonalMessageFn = (
  message: Uint8Array,
) => Promise<{ signature: string }>;

export type UploadSelfieArgs = {
  file: File;
  address: string;
  signPersonalMessage: SignPersonalMessageFn;
};

// MUST match the Nautilus-side string format exactly.
function buildSelfieMessage(address: string, nonce: string): string {
  return `Fam selfie upload by ${address} at nonce ${nonce}`;
}

export async function uploadSelfieToNautilus({
  file,
  address,
  signPersonalMessage,
}: UploadSelfieArgs): Promise<string> {
  const nonce = String(Date.now());
  const message = buildSelfieMessage(address, nonce);
  const messageBytes = new TextEncoder().encode(message);

  const { signature } = await signPersonalMessage(messageBytes);

  const dataBase64 = await fileToBase64(file);
  const res = await fetch(`${NAUTILUS_URL}/selfies`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contentType: file.type || "image/jpeg",
      dataBase64,
      address,
      nonce,
      signature,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Nautilus selfie upload failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  if (!json.id) throw new Error("Nautilus did not return a selfie id");
  return json.id as string;
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function isNautilusRef(ref: string): boolean {
  return typeof ref === "string" && ref.startsWith("nautilus:");
}
