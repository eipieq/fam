"use client";

import { use } from "react";
import Link from "next/link";
import { useCurrentAccount } from "@mysten/dapp-kit";
import {
  CameraPlus,
  GearSix,
  ShieldCheck,
  Drop,
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
  Chip,
  short,
} from "@/components/ui";
import { SealedImage } from "@/components/SealedImage";
import { useGroup } from "@/hooks/useGroup";
import { useAllPhotos } from "@/hooks/usePhoto";

export default function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const account = useCurrentAccount();
  const groupQ = useGroup(id);
  const group = groupQ.data;
  const photosQ = useAllPhotos(id, group?.photoCount ?? 0);
  const photos = photosQ.data ?? [];

  const sealed = photos.filter((p) => p.sealed);
  const pending = photos.filter((p) => !p.sealed);
  const isMember = group?.members.some((m) => m.addr === account?.address);
  const isAdmin = group?.admin === account?.address;

  return (
    <main className="flex flex-1 flex-col">
      <Header />

      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-10 space-y-4">
        {groupQ.isLoading && <p className="text-sm text-neutral-400">Loading group…</p>}
        {!groupQ.isLoading && !group && (
          <p className="text-sm text-red-500">Group not found.</p>
        )}

        {group && (
          <>
            {/* group header card */}
            <CardShell>
              <Segment position="top" className="space-y-3">
                <p className="font-mono text-sm text-neutral-400 tabular-nums">
                  #{String(group.groupId).padStart(4, "0")}
                </p>
                <PixelHeading className="text-2xl sm:text-3xl">
                  {group.name}
                </PixelHeading>
                <div className="flex flex-wrap gap-1">
                  <Chip>{group.members.length} members</Chip>
                  <Chip>{group.photoCount} photos</Chip>
                  <Chip>{group.fuel} fuel</Chip>
                  {group.invited.length > 0 && (
                    <Chip>+{group.invited.length} invited</Chip>
                  )}
                </div>
                <p className="text-xs font-mono text-neutral-400 break-all">
                  {short(group.objectId, 6, 6)} · admin {short(group.admin)}
                </p>
              </Segment>

              <Segment position="bottom" tone="subtle" className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-xs text-neutral-500">
                  {isMember
                    ? "You're a member of this group."
                    : "Read-only view. Not a member."}
                </div>
                <div className="flex items-center gap-2">
                  {isMember && (
                    <Link href={`/group/${id}/submit`}>
                      <Button variant="primary">
                        <CameraPlus size={16} weight="regular" />
                        Submit
                      </Button>
                    </Link>
                  )}
                  {isAdmin && (
                    <Link href={`/group/${id}/settings`}>
                      <Button variant="secondary">
                        <GearSix size={16} weight="regular" />
                      </Button>
                    </Link>
                  )}
                </div>
              </Segment>
            </CardShell>

            {/* stats row */}
            <CardShell>
              <div className="grid grid-cols-3 gap-1">
                <Stat
                  label="Members"
                  value={group.members.length}
                  icon={<ShieldCheck size={16} weight="regular" />}
                  detail={
                    group.invited.length > 0
                      ? `+${group.invited.length} invited`
                      : `${5 - group.members.length} seats open`
                  }
                  position={0}
                />
                <Stat
                  label="Sealed"
                  value={sealed.length}
                  detail={pending.length > 0 ? `${pending.length} pending` : "no pending"}
                  position={1}
                />
                <Stat
                  label="Fuel"
                  value={group.fuel}
                  icon={<Drop size={16} weight="regular" />}
                  detail="photos remaining"
                  position={2}
                />
              </div>
            </CardShell>

            {/* members */}
            <CardShell>
              <Segment position="only" className="space-y-3">
                <Label>Members</Label>
                <div className="flex flex-wrap gap-2">
                  {group.members.map((m) => (
                    <div
                      key={m.addr}
                      className="flex items-center gap-2.5 rounded-md bg-white pl-1 pr-3 py-1"
                    >
                      <Avatar name={m.displayName} size={28} />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-neutral-900 leading-tight">
                          {m.displayName}
                        </div>
                        <div className="text-[11px] font-mono text-neutral-400 leading-tight">
                          {short(m.addr)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Segment>
            </CardShell>

            {/* pending */}
            {pending.length > 0 && (
              <CardShell>
                <Segment position="top" className="flex items-center gap-2">
                  <Label>Pending votes</Label>
                  <StatusPill tone="warn">{pending.length}</StatusPill>
                </Segment>
                <Segment position="bottom">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {pending.map((p) => (
                      <PhotoTile
                        key={p.id}
                        groupId={id}
                        photo={p}
                        memberCount={group.members.length}
                      />
                    ))}
                  </div>
                </Segment>
              </CardShell>
            )}

            {/* sealed */}
            <CardShell>
              <Segment position="top" className="flex items-center gap-2">
                <Label>Sealed forever</Label>
                <StatusPill tone="ok">{sealed.length}</StatusPill>
              </Segment>
              <Segment position="bottom">
                {sealed.length === 0 ? (
                  <div className="text-sm text-neutral-400 px-1 py-3">
                    No sealed photos yet. Submit one and get everyone to approve.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {sealed.map((p) => (
                      <PhotoTile
                        key={p.id}
                        groupId={id}
                        photo={p}
                        memberCount={group.members.length}
                      />
                    ))}
                  </div>
                )}
              </Segment>
            </CardShell>
          </>
        )}
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  icon,
  detail,
  position,
}: {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  detail?: string;
  position: 0 | 1 | 2;
}) {
  // 3-column row with asymmetric outer radii
  const rounding =
    position === 0
      ? "rounded-tl-[10px] rounded-tr-[5px] rounded-br-[5px] rounded-bl-[10px]"
      : position === 2
        ? "rounded-tl-[5px] rounded-tr-[10px] rounded-br-[10px] rounded-bl-[5px]"
        : "rounded-[5px]";
  return (
    <div className={`bg-neutral-100 p-3.5 space-y-2 ${rounding}`}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs uppercase text-neutral-400 tracking-tight">{label}</span>
        {icon && <span className="text-neutral-400">{icon}</span>}
      </div>
      <div className="font-pixel-square text-2xl text-neutral-900 tabular-nums">{value}</div>
      {detail && (
        <div className="text-xs font-medium text-neutral-500">{detail}</div>
      )}
    </div>
  );
}

function PhotoTile({
  groupId,
  photo,
  memberCount,
}: {
  groupId: string;
  photo: {
    id: number;
    blobId: string;
    caption: string;
    approvals: string[];
    rejections: string[];
    sealed: boolean;
  };
  memberCount: number;
}) {
  return (
    <Link href={`/group/${groupId}/photo/${photo.id}`} className="block group">
      <div className="rounded-xl bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] p-1 space-y-1">
        <div className="relative aspect-square rounded-t-[10px] rounded-b-[5px] bg-neutral-100 overflow-hidden">
          <SealedImage
            blobId={photo.blobId}
            groupObjectId={groupId}
            alt={photo.caption}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="bg-neutral-100 rounded-t-[5px] rounded-b-[10px] px-3 py-2 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-neutral-700 truncate min-w-0">
            {photo.caption || "no caption"}
          </span>
          {photo.sealed ? (
            <StatusPill tone="ok">sealed</StatusPill>
          ) : (
            <StatusPill tone="warn">
              {photo.approvals.length}/{memberCount}
            </StatusPill>
          )}
        </div>
      </div>
    </Link>
  );
}
