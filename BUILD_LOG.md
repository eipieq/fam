# Fam — Build Log

**Hackathon:** Tatum x Walrus | **Due:** 2026-06-06 17:00 UTC
**Stack:** Sui Move + Walrus + Nautilus + Tatum RPC + Next.js 14

---

## Phase Plan

### Phase 1 — Scaffolding ⏳
- [ ] 1.1 Create directory structure (contract/, nautilus/, frontend/)
- [ ] 1.2 Bootstrap Next.js 14 app with Tailwind + TypeScript
- [ ] 1.3 Install deps (@mysten/dapp-kit, @mysten/sui, sharp)
- [ ] 1.4 .env.local with all required keys (placeholders)
- [ ] 1.5 README.md skeleton

### Phase 2 — Move Contract
- [ ] 2.1 contract/Move.toml
- [ ] 2.2 contract/sources/fam.move — structs (Member, Photo, Group, FamState)
- [ ] 2.3 init + create_group + invite_member + register_selfie
- [ ] 2.4 buy_fuel + submit_photo + vote_photo (unanimous → seal)
- [ ] 2.5 Read functions (get_group, get_photo, get_sealed_photos)
- [ ] 2.6 Events (GroupCreated, PhotoSubmitted, PhotoSealed, etc.)
- [ ] 2.7 Build & deploy to Sui testnet — capture package ID

### Phase 3 — Frontend libs
- [ ] 3.1 lib/walrus.ts — uploadBlob, fetchBlob, getBlobUrl
- [ ] 3.2 lib/tatum.ts — suiRpc, getEvents
- [ ] 3.3 lib/contract.ts — typed call helpers for each Move entry fn
- [ ] 3.4 hooks/useGroup.ts, hooks/usePhoto.ts

### Phase 4 — Nautilus Worker
- [ ] 4.1 nautilus/package.json + tsconfig
- [ ] 4.2 nautilus/src/index.ts — Express server + /verify-faces
- [ ] 4.3 face-api.js setup (model load, detection)
- [ ] 4.4 Walrus fetch + multi-face match logic
- [ ] 4.5 Attestation signer (FALLBACK_MODE for hackathon)
- [ ] 4.6 README + Docker/run instructions

### Phase 5 — Frontend Pages
- [ ] 5.1 app/layout.tsx + global providers (WalletProvider, SuiClientProvider)
- [ ] 5.2 app/page.tsx — landing + connect wallet + create/join group
- [ ] 5.3 app/invite/[groupId]/page.tsx — selfie upload + register_selfie
- [ ] 5.4 app/group/[id]/page.tsx — album grid + pending list + fuel + members
- [ ] 5.5 app/group/[id]/submit/page.tsx — full submit flow
- [ ] 5.6 app/group/[id]/photo/[photoId]/page.tsx — single photo + vote
- [ ] 5.7 app/group/[id]/settings/page.tsx — invite + buy fuel
- [ ] 5.8 components/ — PhotoCard, MemberBadge, FuelMeter, WalletButton

### Phase 6 — Demo Polish
- [ ] 6.1 Local end-to-end smoke test
- [ ] 6.2 Vercel deploy (frontend)
- [ ] 6.3 Nautilus deploy (Fly.io or Vercel function)
- [ ] 6.4 README with all integration details + demo + video links

### Cut-list (if time short)
- Fuel mechanic (hardcode unlimited)
- Settings page polish
- Sealed JSON blob on Walrus (just store photo blob ID)
- Mainnet (testnet is fine — mainnet is bonus)

### Do NOT cut
- Nautilus face check
- Unanimous approval
- Walrus photo storage
- Tatum RPC for ALL transactions

---

## Build Log

| Time | Phase | Note |
|------|-------|------|
| Start | — | Greenfield scaffold beginning |
