"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSignPersonalMessage,
  useSuiClient,
} from "@mysten/dapp-kit";
import { useQuery } from "@tanstack/react-query";
import { ImageSquare } from "@phosphor-icons/react";
import { Header } from "@/components/Header";
import {
  CardShell,
  Segment,
  PixelHeading,
  Label,
  Button,
  Input,
  short,
} from "@/components/ui";
import { uploadSelfieToNautilus } from "@/lib/selfie";
import { buildCreateGroup, PACKAGE_ID } from "@/lib/contract";
import { listAllGroups } from "@/lib/groups";

export default function LandingPage() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const router = useRouter();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const { mutateAsync: signPersonal } = useSignPersonalMessage();

  const [groupName, setGroupName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [selfie, setSelfie] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupsQuery = useQuery({
    queryKey: ["all-groups"],
    queryFn: listAllGroups,
    refetchInterval: 10_000,
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!account) return setError("Connect your wallet first.");
    if (!selfie) return setError("Add a reference selfie.");
    if (!groupName.trim() || !displayName.trim())
      return setError("Fill in group name and your display name.");
    setBusy(true);
    setError(null);
    try {
      const selfieRef = await uploadSelfieToNautilus({
        file: selfie,
        address: account.address,
        signPersonalMessage: (message) =>
          signPersonal({ message }) as Promise<{ signature: string }>,
      });
      const tx = buildCreateGroup({
        name: groupName.trim(),
        displayName: displayName.trim(),
        referenceBlobId: selfieRef,
      });
      const result = await signAndExecute({ transaction: tx });
      await client.waitForTransaction({ digest: result.digest });
      const tx2 = await client.getTransactionBlock({
        digest: result.digest,
        options: { showEvents: true, showObjectChanges: true },
      });
      const groupObj = (tx2 as any)?.objectChanges?.find(
        (c: any) => c.type === "created" && c.objectType?.includes("::groups::Group"),
      )?.objectId;
      if (groupObj) router.push(`/group/${groupObj}`);
      else groupsQuery.refetch();
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col">
      <Header />

      {/* hero */}
      <section className="flex flex-col items-center justify-center text-center px-4 sm:px-6 pt-6 sm:pt-10 pb-8 sm:pb-12 gap-4">
        <PixelHeading className="text-3xl sm:text-5xl max-w-2xl leading-tight">
          An album your group owns.
          <br />
          Forever.
        </PixelHeading>
        <p className="text-base text-neutral-500 max-w-lg leading-relaxed px-1">
          Every photo is face-verified by Nautilus, encrypted with Mysten Seal,
          and only goes on-chain after unanimous group approval. Stored on
          Walrus. Permanent.
        </p>
      </section>

      {/* polaroid stack + right column */}
      <section className="px-4 sm:px-6 pb-16">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-32 items-start">
          {/* left: polaroid stack */}
          <PolaroidStack />

          {/* right: recently created + create new group, stacked */}
          <div className="space-y-4">
            <CardShell>
              <Segment position="top" className="flex items-center justify-between">
                <Label>Recently created</Label>
                {groupsQuery.isLoading && (
                  <span className="text-xs font-mono text-neutral-400">syncing…</span>
                )}
              </Segment>
              <Segment position="bottom" className="space-y-2 max-h-[280px] overflow-y-auto">
                {!groupsQuery.isLoading && groupsQuery.data?.length === 0 && (
                  <div className="text-sm text-neutral-400 flex items-center gap-2 px-1 py-3">
                    <ImageSquare size={20} weight="regular" />
                    No groups yet. Be the first.
                  </div>
                )}
                {groupsQuery.data?.map((g) => (
                  <Link
                    key={g.groupObjectId}
                    href={`/group/${g.groupObjectId}`}
                    className="block rounded-md bg-white px-3 py-2.5 hover:bg-neutral-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-neutral-900 truncate">
                        {g.name}
                      </div>
                      <div className="text-xs font-mono text-neutral-400 mt-0.5 tabular-nums">
                        #{String(g.groupId).padStart(4, "0")} · admin {short(g.admin)}
                      </div>
                    </div>
                  </Link>
                ))}
              </Segment>
            </CardShell>

            <CardShell>
              <Segment position="top">
                <Label>Create a new group</Label>
                <p className="mt-2 text-sm text-neutral-500">
                  Up to 5 members. Photos seal only when everyone approves.
                </p>
              </Segment>
              <Segment position="bottom">
                <form className="space-y-3" onSubmit={handleCreate}>
                  <Input
                    placeholder="Group name"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  />
                  <Input
                    placeholder="Your display name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                  <FilePicker
                    label="Reference selfie"
                    file={selfie}
                    onChange={setSelfie}
                  />
                  <div className="pt-1">
                    <Button type="submit" disabled={busy || !account} className="w-full">
                      {busy
                        ? "Sealing…"
                        : account
                          ? "Create group"
                          : "Connect wallet first"}
                    </Button>
                  </div>
                  {error && <p className="text-xs text-red-500">{error}</p>}
                </form>
              </Segment>
            </CardShell>
          </div>
        </div>
      </section>

      {/* how it works */}
      <section className="px-4 sm:px-6 pb-20">
        <div className="max-w-3xl mx-auto">
          <CardShell>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1">
              {[
                {
                  step: "01",
                  title: "Snap & encrypt",
                  body: "Photo encrypted with Mysten Seal client-side before it touches the network. Walrus only ever sees ciphertext.",
                },
                {
                  step: "02",
                  title: "Faces verified",
                  body: "Nautilus matches every detected face against group selfies. Strangers stop the photo from ever reaching the vote.",
                },
                {
                  step: "03",
                  title: "Unanimous seal",
                  body: "All members must approve on chain. Sealed photos cannot be deleted, edited, or hidden by anyone.",
                },
              ].map(({ step, title, body }, i, arr) => (
                <div
                  key={step}
                  className={`bg-neutral-100 p-3.5 space-y-2 ${
                    i === 0
                      ? "rounded-tl-[10px] rounded-tr-[10px] rounded-br-[5px] rounded-bl-[5px] sm:rounded-tl-[10px] sm:rounded-tr-[5px] sm:rounded-br-[5px] sm:rounded-bl-[10px]"
                      : i === arr.length - 1
                        ? "rounded-tl-[5px] rounded-tr-[5px] rounded-br-[10px] rounded-bl-[10px] sm:rounded-tl-[5px] sm:rounded-tr-[10px] sm:rounded-br-[10px] sm:rounded-bl-[5px]"
                        : "rounded-[5px]"
                  }`}
                >
                  <p className="font-mono text-sm text-neutral-400 tabular-nums">{step}</p>
                  <p className="font-pixel-square text-base text-neutral-900">{title}</p>
                  <p className="text-sm font-medium text-neutral-500 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </CardShell>
        </div>
      </section>

      {/* footer ribbon */}
      <section className="px-4 sm:px-6 pb-10">
        <div className="max-w-3xl mx-auto">
          <CardShell>
            <Segment position="only" className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-pixel-square text-base text-neutral-900">
                  Built on Sui · Walrus · Nautilus · Seal
                </p>
                <p className="text-xs font-mono text-neutral-400 mt-1 break-all">
                  package {short(PACKAGE_ID, 6, 6)}
                </p>
              </div>
              <p className="text-xs font-mono text-neutral-400 shrink-0">
                routed through Tatum RPC
              </p>
            </Segment>
          </CardShell>
        </div>
      </section>
    </main>
  );
}

function PolaroidStack() {
  // Hero + scatter: one dominant centered photo anchors the composition,
  // three smaller scattered photos peek from the corners at varied angles.
  const photos: { src: string; rotate: string; position: string; width: string; z: number }[] = [
    // top-left scatter, small + tilted left hard
    {
      src: "/_ (1).jpeg",
      rotate: "-11deg",
      position: "top-[0%] left-[2%]",
      width: "w-[44%]",
      z: 1,
    },
    // top-right scatter, small + tilted right hard
    {
      src: "/_ (2).jpeg",
      rotate: "13deg",
      position: "top-[8%] right-[0%]",
      width: "w-[46%]",
      z: 2,
    },
    // HERO: largest, mostly upright, anchors the eye
    {
      src: "/_ (3).jpeg",
      rotate: "-3deg",
      position: "top-[30%] left-[14%]",
      width: "w-[64%]",
      z: 4,
    },
    // bottom-right scatter, peeking out from behind the hero
    {
      src: "/_.jpeg",
      rotate: "8deg",
      position: "bottom-[2%] right-[4%]",
      width: "w-[46%]",
      z: 3,
    },
  ];

  return (
    <div className="relative w-full aspect-[5/6] max-w-md mx-auto">
      {photos.map((p, i) => (
        <div
          key={i}
          className={`absolute ${p.position} ${p.width}`}
          style={{ transform: `rotate(${p.rotate})`, zIndex: p.z }}
        >
          <Polaroid src={p.src} />
        </div>
      ))}
    </div>
  );
}

function Polaroid({ src }: { src: string }) {
  return (
    <div className="rounded-xl bg-white p-1 shadow-[0_1px_4px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.08)]">
      <div className="aspect-square overflow-hidden rounded-[10px] bg-neutral-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          className="w-full h-full object-cover"
          draggable={false}
        />
      </div>
    </div>
  );
}

function FilePicker({
  label,
  file,
  onChange,
}: {
  label: string;
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  return (
    <label className="block">
      <div className="text-xs text-neutral-400 mb-1 font-mono uppercase tracking-tight">
        {label}
      </div>
      <div className="flex items-center gap-3 rounded-md ring-1 ring-inset ring-black/10 bg-white px-3 py-2">
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          id={`file-${label}`}
          onChange={(e) => onChange(e.target.files?.[0] || null)}
        />
        <label
          htmlFor={`file-${label}`}
          className="cursor-pointer text-xs font-medium text-neutral-900 rounded-md ring-1 ring-inset ring-black/10 bg-white px-2 py-1 hover:bg-neutral-50"
        >
          Choose file
        </label>
        <span className="text-xs text-neutral-400 truncate">
          {file ? file.name : "no file selected"}
        </span>
      </div>
    </label>
  );
}
