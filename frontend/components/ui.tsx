"use client";

import { ReactNode } from "react";

/** Quiet-utility primitives shared across pages. */

/** Outer card wrapper. Holds a stack of segmented panels. */
export function CardShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] p-1 space-y-1 ${className}`}
    >
      {children}
    </div>
  );
}

type SegPos = "top" | "middle" | "bottom" | "only";

const SEG_RADII: Record<SegPos, string> = {
  top: "rounded-t-[10px] rounded-b-[5px]",
  middle: "rounded-[5px]",
  bottom: "rounded-t-[5px] rounded-b-[10px]",
  only: "rounded-[10px]",
};

/** Inner panel — neutral-100 with the asymmetric segmented radii. */
export function Segment({
  children,
  position = "only",
  tone = "muted",
  className = "",
}: {
  children: ReactNode;
  position?: SegPos;
  tone?: "muted" | "subtle";
  className?: string;
}) {
  const bg = tone === "subtle" ? "bg-neutral-50" : "bg-neutral-100";
  return (
    <div className={`${bg} ${SEG_RADII[position]} p-3.5 ${className}`}>
      {children}
    </div>
  );
}

/** Legacy aliases that still appear in pages. */
export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <CardShell className={className}>{children}</CardShell>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <Segment className={className}>{children}</Segment>;
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-xs uppercase tracking-tight text-neutral-400">
      {children}
    </div>
  );
}

export function PixelHeading({
  children,
  className = "",
  as: Tag = "h1",
}: {
  children: ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <Tag className={`font-pixel-square text-neutral-900 leading-snug ${className}`}>
      {children}
    </Tag>
  );
}

export function Wordmark({ small = false }: { small?: boolean }) {
  return (
    <span
      className="font-instrument text-neutral-900 leading-[1]"
      style={{
        fontWeight: 500,
        letterSpacing: "-0.01em",
        fontSize: small ? "13px" : "15px",
      }}
    >
      Fam
      <br />
      Permanent Archive
    </span>
  );
}

/* ===== Pill Button ===== */

const PRIMARY_OUTER =
  "inline-flex min-h-[34px] items-stretch rounded-md border border-black/10 bg-white p-[2px]";
const PRIMARY_INNER =
  "inline-flex flex-1 min-h-[28px] cursor-pointer items-center justify-center gap-1.5 rounded-sm bg-neutral-900 px-3 py-2 text-sm font-medium text-white tracking-tight transition-all " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-1px_0_rgba(0,0,0,0.1)] " +
  "hover:bg-neutral-800 disabled:pointer-events-none disabled:opacity-40 " +
  "[&_svg]:pointer-events-none [&_svg]:shrink-0";
const SECONDARY_FLAT =
  "inline-flex min-h-[34px] cursor-pointer items-center justify-center gap-1.5 rounded-md border border-black/10 bg-white px-3 py-2 text-sm font-medium text-neutral-900 tracking-tight transition-colors " +
  "hover:bg-neutral-50 disabled:pointer-events-none disabled:opacity-40 " +
  "[&_svg]:pointer-events-none [&_svg]:shrink-0";

type ButtonVariant = "primary" | "secondary" | "ghost";

export function Button({
  children,
  onClick,
  disabled,
  type = "button",
  variant = "primary",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  variant?: ButtonVariant;
  className?: string;
}) {
  if (variant === "secondary") {
    return (
      <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        className={`${SECONDARY_FLAT} ${className}`}
      >
        {children}
      </button>
    );
  }
  if (variant === "ghost") {
    return (
      <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        className={`inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-900 disabled:opacity-40 ${className}`}
      >
        {children}
      </button>
    );
  }
  return (
    <div className={`${PRIMARY_OUTER} ${className}`}>
      <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        className={PRIMARY_INNER}
      >
        {children}
      </button>
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return (
    <input
      {...rest}
      className={`w-full rounded-md bg-white px-3 py-2 text-sm text-neutral-900 ring-1 ring-inset ring-black/10 placeholder:text-neutral-400 focus:outline-none focus:ring-neutral-400 ${className}`}
    />
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-[13px] font-medium text-neutral-600">
      {children}
    </span>
  );
}

type StatusTone = "neutral" | "ok" | "warn" | "bad" | "info";

export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: StatusTone;
}) {
  const tones: Record<StatusTone, string> = {
    neutral: "bg-white text-neutral-500 ring-1 ring-inset ring-black/5",
    ok: "bg-emerald-50 text-emerald-600",
    warn: "bg-orange-50 text-orange-600",
    bad: "bg-red-50 text-red-600",
    info: "bg-blue-50 text-blue-600",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

const AVATAR_PALETTE = [
  { bg: "bg-amber-100", text: "text-amber-600" },
  { bg: "bg-violet-100", text: "text-violet-600" },
  { bg: "bg-emerald-100", text: "text-emerald-600" },
  { bg: "bg-cyan-100", text: "text-cyan-600" },
  { bg: "bg-rose-100", text: "text-rose-600" },
];

export function avatarPalette(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

export function Avatar({
  src,
  name,
  size = 28,
}: {
  src?: string;
  name: string;
  size?: number;
}) {
  const palette = avatarPalette(name);
  const initials = name
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className={`relative inline-flex items-center justify-center overflow-hidden rounded-full ${palette.bg}`}
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span className={`text-[11px] font-medium ${palette.text}`} aria-hidden>
          {initials || "·"}
        </span>
      )}
    </div>
  );
}

export function short(addr?: string | null, head = 4, tail = 4) {
  if (!addr) return "";
  if (addr.length <= head + tail + 2) return addr;
  return `${addr.slice(0, head + 2)}…${addr.slice(-tail)}`;
}
