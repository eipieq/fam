# fam

a private group photo album on sui. members upload encrypted photos to walrus. a nautilus enclave checks every face in the photo belongs to the group. the photo is sealed on-chain only after every member approves. no strangers, no leaks, no host.

built for the tatum x walrus hackathon.

## live

- **frontend**: https://fam-sqsqsq.vercel.app
- **nautilus worker**: https://fam-nautilus-eegsq.ondigitalocean.app
- **move package** (sui testnet): `0xdfb73a98e531710415e9c7ced67455f1cd5c0242e5e17a0d70f505a1561838ed`
- **repo**: https://github.com/eipieq/fam

## how it works

basically four moving parts.

**1. group + membership** lives on sui. anyone can create a `Group`. they invite members by wallet address. each invited member uploads a selfie which gets stored privately on the nautilus side (not on walrus, more on that below). the selfie is bound to the wallet via a personal-message signature, so you can't register a face for someone else's address.

**2. photo upload** goes to walrus. the photo is encrypted client-side with mysten seal before upload, so walrus never sees raw bytes. the blob id and the seal cap are written to the group's `PendingPhoto` list on-chain.

**3. face verification** runs in nautilus. when a photo is submitted, the worker fetches the encrypted blob from walrus, decrypts it (it has a session key from the submitter), runs face detection, and matches every detected face against the group's reference selfies. if every face belongs to a member, it signs an Ed25519 attestation of `sha256(blob_id:group_id:FACES_OK)` and returns it. the move contract verifies the signature against the worker's pinned pubkey before accepting the photo.

**4. unanimous approval**. every member must vote yes on the pending photo. on the last vote, the photo flips to `Sealed` and joins the group's album. one no-vote rejects it. there's no admin override.

reads are routed through tatum's sui rpc gateway. writes go through tatum too. the frontend caches resolved group object ids in sessionStorage because tatum's load-balanced fullnodes occasionally return stale dynamic-field reads, which made fresh groups flicker in and out of the landing page.

## safety measures

this is the part that actually matters.

**photos are encrypted before they leave your browser.** seal does threshold encryption against the group, so the blob on walrus is useless to anyone who isn't a current group member. walrus is a public store. we treat it like one.

**reference selfies never touch walrus.** they live only on the nautilus worker's disk under a uuid, paired with a sidecar json that records the wallet binding (address, nonce, signature). selfies are operational input to face matching, not memories the group owns. if walrus were ever fully public-readable (it is), member selfies still wouldn't be there to scrape.

**selfie uploads are wallet-gated.** the client signs the personal message `"Fam selfie upload by <address> at nonce <nonce>"` with their sui wallet. the worker verifies the signature against the claimed address before storing anything. nonce must be within 5 minutes of server time, so a stolen signature can't be replayed weeks later.

**face check happens inside a trusted compute boundary.** for the demo we run the worker as a normal node process and pin its public key in the move contract. in production this would run inside a real nautilus enclave so the signing key is attested by hardware and never leaves the enclave. the attestation flow is already there end-to-end. only the trust root changes.

**no centralized admin.** the move contract has no `force_approve` or `delete_photo` function. once a group exists, even the original creator can only vote like everyone else. unanimous means unanimous.

**failure modes are conservative.** if face detection finds an unknown face, the photo is rejected and the attestation is never signed. if a single member votes no, the photo never reaches the album. if the nautilus worker is offline, no new photos can be submitted, but existing sealed photos remain readable.

## what's intentionally not in scope

- **mainnet.** testnet only for the hackathon. all addresses above are testnet.
- **persistent selfie storage.** the worker runs on digitalocean app platform which has an ephemeral filesystem. a restart wipes uploaded selfies. fine for demo, not fine for prod. swapping in a persistent volume or moving selfies into a private encrypted blob on walrus (encrypted with a key only the enclave holds) is the obvious next step.
- **fuel mechanic.** there's a stub on-chain but the cap isn't enforced in the ui. members can upload as much as they want.
- **mobile.** works on mobile browsers but no native app.

## stack

- **chain**: sui testnet, move
- **storage**: walrus testnet
- **encryption**: mysten seal (threshold encryption against the group)
- **rpc**: tatum sui gateway
- **face check + attestation signer**: nautilus worker (express + @noble/ed25519, face-api.js in real mode)
- **frontend**: next.js 16, react 19, tailwind 4, @mysten/dapp-kit
- **hosting**: vercel (frontend), digitalocean app platform (nautilus)

## repo layout

```
contract/   move package, deployed to sui testnet
nautilus/   express worker, verifies faces + signs attestations
frontend/   next.js app
.do/        digitalocean app platform spec template
```

## local dev

```bash
# nautilus
cd nautilus
pnpm install
pnpm dev          # http://localhost:8787

# frontend
cd ../frontend
cp .env.local.example .env.local   # then fill in keys
pnpm install
pnpm dev          # http://localhost:3000
```

the frontend reads its config from `.env.local`. the live deployment uses the same vars as production env on vercel. nautilus signer key is generated at startup if `NAUTILUS_SIGNER_HEX` isn't set, but you'll want to pin it so the pubkey on-chain stays stable across restarts.

## team

built by [@eipieq](https://github.com/eipieq) for the tatum x walrus hackathon.
