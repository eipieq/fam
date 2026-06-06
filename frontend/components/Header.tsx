"use client";

import Link from "next/link";
import { WalletButton } from "./WalletButton";

export function Header() {
  return (
    <header className="border-b border-neutral-100 bg-white px-4 sm:px-8 py-3 flex items-center justify-between gap-3 sticky top-0 z-30">
      <Link
        href="/"
        className="font-pixel-square text-neutral-900 hover:text-neutral-700 transition-colors text-xl sm:text-2xl leading-none"
      >
        Fam
      </Link>

      <WalletButton />
    </header>
  );
}
