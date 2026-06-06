"use client";

import { useEffect, useState } from "react";
import { Lock, ShieldCheck, Warning } from "@phosphor-icons/react";
import { fetchBlob, getBlobUrl } from "@/lib/walrus";
import { decryptForGroup } from "@/lib/seal";
import { useSealSession } from "@/hooks/useSealSession";

// Tiny in-memory cache so the album doesn't re-decrypt on every render.
const cache = new Map<string, string>();
// Blob IDs that turned out to NOT be Seal envelopes — fall back to plain URL.
const plaintextBlobs = new Set<string>();

function looksLikeSealEnvelope(bytes: Uint8Array): boolean {
  // Real image magic bytes — if we see these, definitely NOT encrypted.
  if (bytes.length < 4) return false;
  // JPEG
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return false;
  // PNG
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
    return false;
  // GIF
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return false;
  // WEBP (RIFF)
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46
  )
    return false;
  return true;
}

type Mode = "encrypted" | "plain";

/**
 * Renders a photo stored on Walrus. If the blob is Seal-encrypted (default
 * for new photos), it first ensures a Seal SessionKey exists (one wallet sig
 * per page session), then decrypts and shows it. If the blob predates Seal
 * adoption, just shows the public Walrus URL.
 */
export function SealedImage({
  blobId,
  groupObjectId,
  alt,
  className = "",
  mode = "encrypted",
}: {
  blobId: string;
  groupObjectId: string;
  alt: string;
  className?: string;
  mode?: Mode;
}) {
  const { session, ensureSession, busy: sessionBusy } = useSealSession();
  const [url, setUrl] = useState<string | null>(
    mode === "plain" ? getBlobUrl(blobId) : cache.get(blobId) || null,
  );
  const [error, setError] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);

  useEffect(() => {
    if (mode === "plain") return;
    if (cache.has(blobId)) {
      setUrl(cache.get(blobId)!);
      return;
    }
    if (plaintextBlobs.has(blobId)) {
      setUrl(getBlobUrl(blobId));
      return;
    }

    let cancelled = false;
    (async () => {
      setDecrypting(true);
      setError(null);
      try {
        const buf = await fetchBlob(blobId);
        const bytes = new Uint8Array(buf);

        // Legacy / pre-Seal photo — render directly.
        if (!looksLikeSealEnvelope(bytes)) {
          plaintextBlobs.add(blobId);
          if (!cancelled) setUrl(getBlobUrl(blobId));
          return;
        }

        // Need a Seal session before decrypt
        if (!session) {
          if (!cancelled) setDecrypting(false);
          return;
        }

        try {
          const decrypted = await decryptForGroup(bytes, groupObjectId, session);
          const blob = new Blob([new Uint8Array(decrypted)]);
          const objectUrl = URL.createObjectURL(blob);
          cache.set(blobId, objectUrl);
          if (!cancelled) setUrl(objectUrl);
        } catch (e: any) {
          // BCS parse error → not actually a Seal envelope, fall back to plain.
          const msg = String(e?.message || e);
          if (msg.includes("Unknown value") || msg.includes("Ciphertext")) {
            plaintextBlobs.add(blobId);
            if (!cancelled) setUrl(getBlobUrl(blobId));
            return;
          }
          throw e;
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setDecrypting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [blobId, groupObjectId, session, mode]);

  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={alt} className={className} loading="lazy" />;
  }

  if (mode === "plain") return <div className={className} />;

  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 bg-neutral-100 text-neutral-400 ${className}`}
    >
      {error ? (
        <>
          <Warning size={20} weight="regular" className="text-red-500" />
          <span className="text-[11px] text-red-500 px-2 text-center">
            {error.length > 60 ? error.slice(0, 60) + "…" : error}
          </span>
        </>
      ) : decrypting ? (
        <>
          <ShieldCheck size={20} weight="regular" className="text-blue-500 animate-pulse" />
          <span className="text-[11px]">decrypting…</span>
        </>
      ) : !session ? (
        <button
          onClick={() => ensureSession()}
          disabled={sessionBusy}
          className="flex flex-col items-center gap-1 hover:text-neutral-900 disabled:opacity-50"
        >
          <Lock size={20} weight="regular" />
          <span className="text-[11px]">{sessionBusy ? "signing…" : "unlock to view"}</span>
        </button>
      ) : (
        <>
          <Lock size={20} weight="regular" />
          <span className="text-[11px]">queued…</span>
        </>
      )}
    </div>
  );
}
