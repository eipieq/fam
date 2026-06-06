"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSignPersonalMessage,
  useSuiClient,
} from "@mysten/dapp-kit";
import { CheckCircle, Warning } from "@phosphor-icons/react";
import { Header } from "@/components/Header";
import {
  CardShell,
  Segment,
  PixelHeading,
  Label,
  Button,
  Input,
  Chip,
  short,
} from "@/components/ui";
import { useGroup } from "@/hooks/useGroup";
import { uploadSelfieToNautilus } from "@/lib/selfie";
import { buildRegisterSelfie } from "@/lib/contract";

export default function InvitePage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = use(params);
  const account = useCurrentAccount();
  const client = useSuiClient();
  const router = useRouter();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const { mutateAsync: signPersonal } = useSignPersonalMessage();

  const groupQ = useGroup(groupId);
  const group = groupQ.data;

  const [displayName, setDisplayName] = useState("");
  const [selfie, setSelfie] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isInvited = !!group && !!account && group.invited.includes(account.address);
  const isMember = !!group && !!account && group.members.some((m) => m.addr === account.address);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!account || !group) return;
    if (!selfie) return setError("Upload a reference selfie.");
    if (!displayName.trim()) return setError("Pick a display name.");
    setBusy(true);
    setError(null);
    try {
      const selfieRef = await uploadSelfieToNautilus({
        file: selfie,
        address: account.address,
        signPersonalMessage: (message) =>
          signPersonal({ message }) as Promise<{ signature: string }>,
      });
      const tx = buildRegisterSelfie({
        groupObjectId: group.objectId,
        displayName: displayName.trim(),
        referenceBlobId: selfieRef,
      });
      const result = await signAndExecute({ transaction: tx });
      await client.waitForTransaction({ digest: result.digest });
      router.push(`/group/${group.objectId}`);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col">
      <Header />

      <div className="max-w-md mx-auto w-full px-4 sm:px-6 py-10 space-y-4">
        {!group && (
          <p className="text-sm text-neutral-400">Loading invitation…</p>
        )}
        {group && (
          <>
            <div className="space-y-2">
              <p className="text-xs font-mono uppercase tracking-tight text-neutral-400">
                You've been invited to
              </p>
              <PixelHeading className="text-2xl">{group.name}</PixelHeading>
              <div className="flex flex-wrap gap-1">
                <Chip>{group.members.length} members</Chip>
                <Chip>admin {short(group.admin)}</Chip>
              </div>
            </div>

            {isMember && (
              <CardShell>
                <Segment position="only" className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={20} weight="regular" className="text-emerald-600" />
                    <span className="text-sm text-neutral-900">
                      You're already a member.
                    </span>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => router.push(`/group/${group.objectId}`)}
                  >
                    Go to album
                  </Button>
                </Segment>
              </CardShell>
            )}

            {!isMember && account && !isInvited && (
              <CardShell>
                <Segment position="only" className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Warning size={20} weight="regular" className="text-orange-600" />
                    <Label>Not on the invite list</Label>
                  </div>
                  <div className="text-sm text-neutral-900">
                    Your address ({short(account.address, 6, 4)}) isn't on the invite list.
                  </div>
                  <div className="text-xs text-neutral-400">
                    Ask the admin to invite you, then come back.
                  </div>
                </Segment>
              </CardShell>
            )}

            {!isMember && isInvited && (
              <CardShell>
                <form onSubmit={join}>
                  <Segment position="top" className="space-y-3">
                    <Label>Display name</Label>
                    <Input
                      placeholder="What your friends call you"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </Segment>
                  <Segment position="middle" className="space-y-2">
                    <Label>Reference selfie</Label>
                    <div className="flex items-center gap-3 rounded-md ring-1 ring-inset ring-black/10 bg-white px-3 py-2">
                      <input
                        id="selfie"
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => setSelfie(e.target.files?.[0] || null)}
                      />
                      <label
                        htmlFor="selfie"
                        className="cursor-pointer text-xs font-medium text-neutral-900 rounded-md ring-1 ring-inset ring-black/10 bg-white px-2 py-1 hover:bg-neutral-50"
                      >
                        Choose file
                      </label>
                      <span className="text-xs text-neutral-400 truncate">
                        {selfie ? selfie.name : "no file selected"}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400">
                      Nautilus uses this to verify your face in future group photos.
                    </p>
                  </Segment>
                  <Segment position="bottom" tone="subtle" className="space-y-2">
                    <Button type="submit" disabled={busy} className="w-full">
                      {busy ? "Joining…" : "Join group"}
                    </Button>
                    {error && <p className="text-xs text-red-500">{error}</p>}
                  </Segment>
                </form>
              </CardShell>
            )}

            {!account && (
              <CardShell>
                <Segment position="only">
                  <div className="text-sm text-neutral-500">
                    Connect your wallet to accept the invite.
                  </div>
                </Segment>
              </CardShell>
            )}
          </>
        )}
      </div>
    </main>
  );
}
