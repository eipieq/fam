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
  Copy,
  Drop,
  UserPlus,
} from "@phosphor-icons/react";
import { Header } from "@/components/Header";
import {
  CardShell,
  Segment,
  PixelHeading,
  Label,
  Button,
  Input,
} from "@/components/ui";
import { useGroup } from "@/hooks/useGroup";
import { buildInviteMember, buildBuyFuel } from "@/lib/contract";

const FUEL_PRICE_MIST = 5_000_000_000n;

export default function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const groupQ = useGroup(id);
  const group = groupQ.data;

  const [invitee, setInvitee] = useState("");
  const [bundles, setBundles] = useState(1);
  const [busy, setBusy] = useState<"" | "invite" | "fuel">("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isAdmin = !!group && group.admin === account?.address;
  const inviteUrl =
    typeof window !== "undefined" ? `${window.location.origin}/invite/${id}` : "";

  async function invite() {
    if (!group) return;
    setBusy("invite");
    setMsg(null);
    setError(null);
    try {
      const tx = buildInviteMember({ groupObjectId: id, invitee: invitee.trim() });
      const result = await signAndExecute({ transaction: tx });
      await client.waitForTransaction({ digest: result.digest });
      setMsg("Invited. Share the invite link.");
      setInvitee("");
      groupQ.refetch();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy("");
    }
  }

  async function buyFuel() {
    if (!group) return;
    setBusy("fuel");
    setMsg(null);
    setError(null);
    try {
      const tx = buildBuyFuel({
        groupObjectId: id,
        amountMist: FUEL_PRICE_MIST * BigInt(bundles),
      });
      const result = await signAndExecute({ transaction: tx });
      await client.waitForTransaction({ digest: result.digest });
      setMsg(`Added ${bundles * 50} photos of fuel.`);
      groupQ.refetch();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy("");
    }
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <main className="flex flex-1 flex-col">
      <Header />

      <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-8 space-y-4">
        <Link
          href={`/group/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900"
        >
          <CaretLeft size={16} weight="regular" /> back to album
        </Link>

        <div className="space-y-1">
          <PixelHeading className="text-2xl sm:text-3xl">
            Settings
          </PixelHeading>
          {group && (
            <p className="text-sm text-neutral-500">{group.name}</p>
          )}
        </div>

        {!group && <p className="text-sm text-neutral-400">Loading…</p>}

        {group && (
          <>
            {/* invite */}
            <CardShell>
              <Segment position="top" className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Invite a member</Label>
                  <UserPlus size={20} weight="regular" className="text-neutral-400" />
                </div>
                {!isAdmin && (
                  <p className="text-xs text-neutral-400">
                    Only the admin can invite.
                  </p>
                )}
                <Input
                  disabled={!isAdmin}
                  placeholder="0x… invitee address"
                  value={invitee}
                  onChange={(e) => setInvitee(e.target.value)}
                />
                <Button
                  disabled={!isAdmin || busy === "invite" || !invitee.trim()}
                  onClick={invite}
                >
                  {busy === "invite" ? "Inviting…" : "Send invite"}
                </Button>
              </Segment>
              <Segment position="bottom" tone="subtle" className="space-y-2">
                <Label>Invite link</Label>
                <div className="flex items-center gap-2 rounded-md ring-1 ring-inset ring-black/10 bg-white px-3 py-2">
                  <code className="text-xs font-mono text-neutral-500 truncate flex-1">
                    {inviteUrl}
                  </code>
                  <button
                    onClick={copyInvite}
                    className="text-xs font-medium text-neutral-900 hover:text-blue-600 flex items-center gap-1"
                  >
                    <Copy size={14} weight="regular" />
                    {copied ? "copied" : "copy"}
                  </button>
                </div>
              </Segment>
            </CardShell>

            {/* fuel */}
            <CardShell>
              <Segment position="top" className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Buy fuel</Label>
                  <Drop size={20} weight="regular" className="text-neutral-400" />
                </div>
                <p className="text-xs text-neutral-400">
                  Each bundle (5 SUI) adds 50 photos. Current fuel:{" "}
                  <span className="text-neutral-900 font-medium tabular-nums">{group.fuel}</span>
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    value={bundles}
                    onChange={(e) => setBundles(Math.max(1, Number(e.target.value || 1)))}
                    className="w-24"
                  />
                  <span className="text-xs text-neutral-500">
                    bundle{bundles === 1 ? "" : "s"} = {bundles * 50} photos · {bundles * 5} SUI
                  </span>
                </div>
              </Segment>
              <Segment position="bottom" tone="subtle">
                <Button onClick={buyFuel} disabled={busy === "fuel"}>
                  {busy === "fuel" ? "Buying…" : "Buy fuel"}
                </Button>
              </Segment>
            </CardShell>

            {msg && <p className="text-xs text-emerald-600">{msg}</p>}
            {error && <p className="text-xs text-red-500">{error}</p>}
          </>
        )}
      </div>
    </main>
  );
}
