"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import {
  CaretLeft,
  CheckCircle,
  XCircle,
  Lock,
} from "@phosphor-icons/react";
import { Header } from "@/components/Header";
import {
  CardShell,
  Segment,
  PixelHeading,
  Label,
  Button,
  StatusPill,
  Avatar,
  short,
} from "@/components/ui";
import { SealedImage } from "@/components/SealedImage";
import { useGroup } from "@/hooks/useGroup";
import { usePhoto } from "@/hooks/usePhoto";
import { getBlobUrl } from "@/lib/walrus";
import { buildVotePhoto } from "@/lib/contract";

export default function PhotoPage({
  params,
}: {
  params: Promise<{ id: string; photoId: string }>;
}) {
  const { id, photoId } = use(params);
  const photoIdNum = Number(photoId);
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const groupQ = useGroup(id);
  const photoQ = usePhoto(id, photoIdNum);

  const group = groupQ.data;
  const photo = photoQ.data;

  const [voting, setVoting] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function vote(approve: boolean) {
    if (!account) return setError("Connect your wallet first.");
    setVoting(approve ? "approve" : "reject");
    setError(null);
    try {
      const tx = buildVotePhoto({
        groupObjectId: id,
        photoId: photoIdNum,
        approve,
      });
      const result = await signAndExecute({ transaction: tx });
      await client.waitForTransaction({ digest: result.digest });
      await photoQ.refetch();
      await groupQ.refetch();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setVoting(null);
    }
  }

  const memberCount = group?.members.length ?? 0;
  const isMember = group?.members.some((m) => m.addr === account?.address);
  const hasVoted =
    photo?.approvals.includes(account?.address || "") ||
    photo?.rejections.includes(account?.address || "");

  return (
    <main className="flex flex-1 flex-col">
      <Header />

      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 space-y-4">
        <Link
          href={`/group/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900"
        >
          <CaretLeft size={16} weight="regular" /> back to album
        </Link>

        {photo && group ? (
          <div className="grid md:grid-cols-[1.4fr_1fr] gap-4">
            {/* photo */}
            <CardShell>
              <div className="bg-neutral-100 rounded-[10px] overflow-hidden">
                <SealedImage
                  blobId={photo.blobId}
                  groupObjectId={id}
                  alt={photo.caption}
                  className="w-full object-contain max-h-[70vh]"
                />
              </div>
            </CardShell>

            {/* info */}
            <CardShell>
              <Segment position="top" className="space-y-3">
                <p className="font-mono text-sm text-neutral-400 tabular-nums">
                  #{String(photo.id).padStart(4, "0")}
                </p>
                <PixelHeading className="text-xl">
                  {photo.caption || "(no caption)"}
                </PixelHeading>
                <div className="flex items-center gap-2">
                  {photo.sealed ? (
                    <StatusPill tone="ok">
                      <Lock size={12} weight="regular" /> sealed
                    </StatusPill>
                  ) : (
                    <StatusPill tone="warn">
                      {photo.approvals.length}/{memberCount} approvals
                    </StatusPill>
                  )}
                </div>
              </Segment>

              <Segment position="middle" className="space-y-2">
                <Label>Walrus blob</Label>
                <a
                  href={getBlobUrl(photo.blobId)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-mono text-neutral-900 hover:text-blue-600 break-all underline-offset-2 hover:underline"
                >
                  {short(photo.blobId, 6, 6)}
                </a>
                <div className="pt-1">
                  <Label>Submitted by</Label>
                  <div className="mt-1 text-xs font-mono text-neutral-500 break-all">
                    {short(photo.submittedBy, 8, 8)}
                  </div>
                </div>
              </Segment>

              <Segment position="middle" className="space-y-2">
                <Label>Votes</Label>
                <ul className="space-y-1.5">
                  {group.members.map((m) => {
                    const approved = photo.approvals.includes(m.addr);
                    const rejected = photo.rejections.includes(m.addr);
                    return (
                      <li
                        key={m.addr}
                        className="flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar name={m.displayName} size={20} />
                          <span className="text-sm text-neutral-900 truncate">
                            {m.displayName}
                          </span>
                        </div>
                        {approved && (
                          <StatusPill tone="ok">
                            <CheckCircle size={12} weight="regular" /> approved
                          </StatusPill>
                        )}
                        {rejected && (
                          <StatusPill tone="bad">
                            <XCircle size={12} weight="regular" /> rejected
                          </StatusPill>
                        )}
                        {!approved && !rejected && (
                          <StatusPill>pending</StatusPill>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Segment>

              {!photo.sealed && isMember && !hasVoted && (
                <Segment position="bottom" tone="subtle" className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => vote(true)}
                      disabled={!!voting}
                      variant="primary"
                    >
                      <CheckCircle size={16} weight="regular" />
                      {voting === "approve" ? "voting…" : "approve"}
                    </Button>
                    <Button
                      onClick={() => vote(false)}
                      disabled={!!voting}
                      variant="secondary"
                    >
                      <XCircle size={16} weight="regular" />
                      {voting === "reject" ? "voting…" : "reject"}
                    </Button>
                  </div>
                  {error && <p className="text-xs text-red-500">{error}</p>}
                </Segment>
              )}
              {!photo.sealed && hasVoted && (
                <Segment position="bottom" tone="subtle">
                  <div className="text-xs text-neutral-400">
                    You've already voted on this photo.
                  </div>
                </Segment>
              )}
            </CardShell>
          </div>
        ) : (
          <p className="text-sm text-neutral-400">Loading photo…</p>
        )}
      </div>
    </main>
  );
}
