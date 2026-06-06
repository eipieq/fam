"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import {
  CaretLeft,
  CheckCircle,
  CloudArrowUp,
  ShieldCheck,
  XCircle,
} from "@phosphor-icons/react";
import { Header } from "@/components/Header";
import {
  CardShell,
  Segment,
  PixelHeading,
  Label,
  Button,
  Input,
  StatusPill,
} from "@/components/ui";
import { useGroup } from "@/hooks/useGroup";
import { uploadBlob, getBlobUrl } from "@/lib/walrus";
import { buildSubmitPhoto } from "@/lib/contract";
import { encryptForGroup } from "@/lib/seal";

const NAUTILUS_URL =
  process.env.NEXT_PUBLIC_NAUTILUS_URL || "http://localhost:8788";

type Stage =
  | "idle"
  | "encrypting"
  | "uploading"
  | "verifying"
  | "sealing"
  | "done"
  | "failed";

export default function SubmitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const account = useCurrentAccount();
  const client = useSuiClient();
  const router = useRouter();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const groupQ = useGroup(id);
  const group = groupQ.data;

  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [simulate, setSimulate] = useState<"pass" | "fail_unknown_face" | "fail_no_face">("pass");
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [photoBlobId, setPhotoBlobId] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<any>(null);

  function pickFile(f: File | null) {
    setFile(f);
    if (f) setPreviewUrl(URL.createObjectURL(f));
  }

  async function submit() {
    if (!account) return setError("Connect your wallet first.");
    if (!group) return setError("Group not loaded.");
    if (!file) return setError("Choose a photo first.");
    setError(null);
    try {
      setStage("encrypting");
      const fileBytes = new Uint8Array(await file.arrayBuffer());
      const encrypted = await encryptForGroup(fileBytes, id);

      setStage("uploading");
      const { blobId } = await uploadBlob(encrypted);
      setPhotoBlobId(blobId);

      setStage("verifying");
      const verifyRes = await fetch(`${NAUTILUS_URL}/verify-faces`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          photo_blob_id: blobId,
          group_id: group.groupId,
          members: group.members.map((m) => ({
            addr: m.addr,
            display_name: m.displayName,
            reference_blob_id: m.referenceBlobId,
          })),
          simulate,
        }),
      });
      const verifyJson = await verifyRes.json();
      setVerifyResult(verifyJson);

      if (!verifyJson.passed) {
        setStage("failed");
        setError(`Nautilus rejected this photo: ${verifyJson.reason}`);
        return;
      }

      setStage("sealing");
      const attestation = hexToBytes(verifyJson.attestation_hex);
      const tx = buildSubmitPhoto({
        groupObjectId: id,
        blobId,
        caption,
        nautilusAttestation: attestation,
      });
      const result = await signAndExecute({ transaction: tx });
      await client.waitForTransaction({ digest: result.digest });
      setStage("done");
      setTimeout(() => router.push(`/group/${id}`), 1200);
    } catch (e: any) {
      setStage("failed");
      setError(e?.message || String(e));
    }
  }

  const steps: { key: Stage; label: string }[] = [
    { key: "encrypting", label: "Seal encrypt" },
    { key: "uploading", label: "Walrus upload" },
    { key: "verifying", label: "Nautilus verify" },
    { key: "sealing", label: "On-chain submit" },
  ];
  const stageIndex = [
    "idle",
    "encrypting",
    "uploading",
    "verifying",
    "sealing",
    "done",
  ].indexOf(stage);

  return (
    <main className="flex flex-1 flex-col">
      <Header />

      <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 space-y-4">
        <Link
          href={`/group/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900"
        >
          <CaretLeft size={16} weight="regular" /> back to album
        </Link>

        <div className="space-y-1">
          <PixelHeading className="text-2xl sm:text-3xl">
            Submit a photo
          </PixelHeading>
          <p className="text-sm text-neutral-500">
            Encrypt with Seal, upload to Walrus, verify faces with Nautilus, send on-chain for unanimous vote.
          </p>
        </div>

        <div className="grid md:grid-cols-[1.4fr_1fr] gap-4">
          {/* form */}
          <CardShell>
            <Segment position="top" className="space-y-3">
              <Label>Photo</Label>
              {previewUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="preview"
                    className="rounded-md max-h-80 object-contain mx-auto bg-white"
                  />
                  <label
                    htmlFor="photo"
                    className="block text-xs text-neutral-500 hover:text-neutral-900 cursor-pointer text-center font-medium"
                  >
                    replace photo
                  </label>
                </>
              ) : (
                <label
                  htmlFor="photo"
                  className="flex flex-col items-center justify-center gap-2 rounded-md bg-white py-12 cursor-pointer hover:bg-neutral-50 transition-colors"
                >
                  <CloudArrowUp size={20} weight="regular" className="text-neutral-400" />
                  <span className="text-xs text-neutral-400">click to choose</span>
                </label>
              )}
              <input
                id="photo"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => pickFile(e.target.files?.[0] || null)}
              />
            </Segment>

            <Segment position="middle" className="space-y-2">
              <Label>Caption</Label>
              <Input
                placeholder="optional"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
            </Segment>

            <Segment position="middle" className="space-y-2">
              <Label>Demo · simulate Nautilus result</Label>
              <div className="flex flex-wrap gap-1.5">
                {(["pass", "fail_unknown_face", "fail_no_face"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSimulate(s)}
                    className={`text-xs font-medium rounded-md px-2.5 py-1 transition-colors ${
                      simulate === s
                        ? "bg-neutral-900 text-white"
                        : "bg-white text-neutral-500 ring-1 ring-inset ring-black/10 hover:text-neutral-900"
                    }`}
                  >
                    {s.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-neutral-400">
                Only honored while Nautilus runs in FALLBACK_MODE.
              </p>
            </Segment>

            <Segment position="bottom" tone="subtle" className="space-y-2">
              <Button
                onClick={submit}
                disabled={stage !== "idle" && stage !== "failed"}
                className="w-full"
              >
                {stage === "idle" && "Encrypt, verify & submit"}
                {stage === "encrypting" && "Encrypting with Seal…"}
                {stage === "uploading" && "Uploading to Walrus…"}
                {stage === "verifying" && "Verifying faces…"}
                {stage === "sealing" && "Sending on-chain…"}
                {stage === "done" && (<><CheckCircle size={16} weight="regular" /> Done</>)}
                {stage === "failed" && "Try again"}
              </Button>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </Segment>
          </CardShell>

          {/* pipeline */}
          <CardShell>
            <Segment position="top">
              <Label>Pipeline</Label>
            </Segment>
            <Segment position="middle" className="space-y-1.5 bg-neutral-100">
              {steps.map((s, i) => {
                const isDone = stageIndex > i + 1 || stage === "done";
                const isActive = stage === s.key;
                return (
                  <div
                    key={s.key}
                    className={`flex items-center gap-2.5 rounded-md bg-white px-3 py-2 ${
                      isActive ? "ring-1 ring-inset ring-neutral-900" : ""
                    }`}
                  >
                    <span
                      className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-medium tabular-nums ${
                        isDone
                          ? "bg-emerald-50 text-emerald-600"
                          : isActive
                            ? "bg-blue-50 text-blue-600"
                            : "bg-neutral-100 text-neutral-400"
                      }`}
                    >
                      {isDone ? "✓" : i + 1}
                    </span>
                    <span
                      className={`text-sm ${
                        isDone || isActive
                          ? "text-neutral-900 font-medium"
                          : "text-neutral-400"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </Segment>

            {(photoBlobId || verifyResult) && (
              <Segment position="bottom" tone="subtle" className="space-y-3">
                {photoBlobId && (
                  <div>
                    <Label>Walrus blob</Label>
                    <a
                      href={getBlobUrl(photoBlobId)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block text-xs font-mono text-neutral-900 hover:text-blue-600 break-all"
                    >
                      {photoBlobId}
                    </a>
                  </div>
                )}
                {verifyResult && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Nautilus</Label>
                      {verifyResult.passed ? (
                        <StatusPill tone="ok">
                          <CheckCircle size={12} weight="regular" /> passed
                        </StatusPill>
                      ) : (
                        <StatusPill tone="bad">
                          <XCircle size={12} weight="regular" /> failed
                        </StatusPill>
                      )}
                    </div>
                    <div className="text-xs text-neutral-500">{verifyResult.reason}</div>
                    {verifyResult.matched_members?.length > 0 && (
                      <div className="text-xs text-neutral-900">
                        matched: {verifyResult.matched_members.join(", ")}
                      </div>
                    )}
                    {verifyResult.attestation_hex && (
                      <div className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                        <ShieldCheck size={14} weight="regular" />
                        <code className="font-mono break-all">
                          {verifyResult.attestation_hex.slice(0, 24)}…
                        </code>
                      </div>
                    )}
                  </div>
                )}
              </Segment>
            )}
          </CardShell>
        </div>
      </div>
    </main>
  );
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++)
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}
