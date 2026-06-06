"use client";

import { useEffect, useRef, useState } from "react";
import {
  useConnectWallet,
  useCurrentAccount,
  useCurrentWallet,
  useDisconnectWallet,
  useWallets,
} from "@mysten/dapp-kit";
import { CaretDown, SignOut } from "@phosphor-icons/react";
import { short } from "./ui";

// Custom Sui-wallet connect button matching the pill / segmented-card design.
// Disconnected: primary pill that opens a wallet-picker dropdown.
// Connected: secondary pill showing the address, opens a tiny menu with Disconnect.
export function WalletButton() {
  const account = useCurrentAccount();
  const { currentWallet } = useCurrentWallet();
  const wallets = useWallets();
  const { mutate: connect } = useConnectWallet();
  const { mutate: disconnect } = useDisconnectWallet();

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // ===== Disconnected: connect button + wallet picker =====
  if (!account) {
    return (
      <div ref={wrapRef} className="relative">
        <PrimaryPill onClick={() => setOpen((v) => !v)}>
          Connect Wallet
        </PrimaryPill>

        {open && (
          <Dropdown>
            <DropdownHeader>Choose a wallet</DropdownHeader>
            <div className="space-y-1">
              {wallets.length === 0 && (
                <div className="px-2 py-2 text-xs text-neutral-400">
                  No Sui wallets detected. Install Slush from the Chrome store.
                </div>
              )}
              {wallets.map((w) => (
                <button
                  key={w.name}
                  onClick={() => {
                    connect(
                      { wallet: w },
                      { onSuccess: () => setOpen(false) },
                    );
                  }}
                  className="flex w-full items-center gap-2.5 rounded-md bg-white px-2 py-2 text-left hover:bg-neutral-50 transition-colors"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {w.icon && (
                    <img
                      src={w.icon}
                      alt={w.name}
                      className="h-5 w-5 rounded"
                    />
                  )}
                  <span className="text-sm font-medium text-neutral-900">
                    {w.name}
                  </span>
                </button>
              ))}
            </div>
          </Dropdown>
        )}
      </div>
    );
  }

  // ===== Connected: address + disconnect menu =====
  return (
    <div ref={wrapRef} className="relative">
      <SecondaryPill onClick={() => setOpen((v) => !v)}>
        <span className="font-mono text-[13px]">{short(account.address, 4, 4)}</span>
        <CaretDown size={12} weight="regular" className="text-neutral-400" />
      </SecondaryPill>

      {open && (
        <Dropdown>
          <DropdownHeader>
            <div className="flex items-center gap-2">
              {currentWallet?.icon && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentWallet.icon}
                  alt={currentWallet.name}
                  className="h-4 w-4 rounded"
                />
              )}
              <span className="truncate">{currentWallet?.name || "Wallet"}</span>
            </div>
          </DropdownHeader>
          <div className="px-2 pb-2 text-[11px] font-mono text-neutral-500 break-all leading-relaxed">
            {account.address}
          </div>
          <div>
            <button
              onClick={() => {
                disconnect();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-md bg-white px-2 py-2 text-left hover:bg-neutral-50 transition-colors text-sm font-medium text-neutral-700"
            >
              <SignOut size={14} weight="regular" />
              Disconnect
            </button>
          </div>
        </Dropdown>
      )}
    </div>
  );
}

/* ===== Local pill primitives ===== */

const OUTER =
  "inline-flex min-h-[34px] items-stretch rounded-md border border-black/10 bg-white p-[2px]";

function PrimaryPill({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div className={OUTER}>
      <button
        onClick={onClick}
        className="inline-flex min-h-[28px] items-center justify-center gap-1.5 rounded-sm bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white tracking-tight transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-1px_0_rgba(0,0,0,0.1)] hover:bg-neutral-800 [&_svg]:pointer-events-none"
      >
        {children}
      </button>
    </div>
  );
}

function SecondaryPill({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex min-h-[34px] cursor-pointer items-center justify-center gap-1.5 rounded-md border border-black/10 bg-white px-3 py-1.5 text-sm font-medium text-neutral-900 tracking-tight transition-colors hover:bg-neutral-50 [&_svg]:pointer-events-none"
    >
      {children}
    </button>
  );
}

function Dropdown({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute right-0 top-[calc(100%+6px)] z-40 w-[260px] rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.08)] ring-1 ring-black/5 p-1 space-y-1">
      {children}
    </div>
  );
}

function DropdownHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-t-[10px] rounded-b-[5px] bg-neutral-100 px-3 py-2 text-xs font-mono uppercase tracking-tight text-neutral-500">
      {children}
    </div>
  );
}
