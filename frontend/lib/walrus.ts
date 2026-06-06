// Walrus testnet helpers — publisher PUT, aggregator GET.
// Docs: https://docs.walrus.site

const PUBLISHER =
  process.env.NEXT_PUBLIC_WALRUS_PUBLISHER ||
  "https://publisher.walrus-testnet.walrus.space";
const AGGREGATOR =
  process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR ||
  "https://aggregator.walrus-testnet.walrus.space";

const DEFAULT_EPOCHS = 5;

export type UploadResult = {
  blobId: string;
  size: number;
  raw: unknown;
};

export async function uploadBlob(
  data: Blob | ArrayBuffer | Uint8Array,
  opts: { epochs?: number } = {},
): Promise<UploadResult> {
  const epochs = opts.epochs ?? DEFAULT_EPOCHS;
  const url = `${PUBLISHER}/v1/blobs?epochs=${epochs}`;

  const body: BodyInit =
    data instanceof Blob
      ? data
      : data instanceof Uint8Array
        ? new Blob([data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer])
        : new Blob([data as ArrayBuffer]);

  const res = await fetch(url, { method: "PUT", body });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Walrus upload failed (${res.status}): ${text}`);
  }
  const json = await res.json();

  // Walrus returns either { newlyCreated: { blobObject: { blobId, size } } }
  // or { alreadyCertified: { blobId, ... } }
  const blobId: string | undefined =
    json?.newlyCreated?.blobObject?.blobId ||
    json?.alreadyCertified?.blobId ||
    json?.blobId;

  const size: number =
    json?.newlyCreated?.blobObject?.size ||
    json?.alreadyCertified?.size ||
    0;

  if (!blobId) throw new Error(`Walrus response missing blobId: ${JSON.stringify(json)}`);

  return { blobId, size, raw: json };
}

export async function fetchBlob(blobId: string): Promise<ArrayBuffer> {
  const res = await fetch(getBlobUrl(blobId));
  if (!res.ok) throw new Error(`Walrus fetch failed (${res.status}) for ${blobId}`);
  return res.arrayBuffer();
}

export function getBlobUrl(blobId: string): string {
  return `${AGGREGATOR}/v1/blobs/${blobId}`;
}

export async function uploadJson(obj: unknown, epochs?: number): Promise<UploadResult> {
  const blob = new Blob([JSON.stringify(obj)], { type: "application/json" });
  return uploadBlob(blob, { epochs });
}
