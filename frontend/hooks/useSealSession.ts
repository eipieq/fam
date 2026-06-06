"use client";

import { useCallback, useEffect, useState } from "react";
import {
  useCurrentAccount,
  useSignPersonalMessage,
} from "@mysten/dapp-kit";
import { SessionKey } from "@mysten/seal";
import { PACKAGE_ID } from "@/lib/contract";
import { makeSuiClient } from "@/lib/sui";

// One in-memory SessionKey per address, lasts for the page lifetime.
// Seal SessionKey itself has a TTL (we use 10 min) — after that, decrypt() throws
// and we'd ask the user to sign again.
let _sessionKey: SessionKey | null = null;
let _sessionAddr: string | null = null;

export function useSealSession() {
  const account = useCurrentAccount();
  const { mutateAsync: signPersonal } = useSignPersonalMessage();
  const [session, setSession] = useState<SessionKey | null>(_sessionKey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (_sessionAddr && account && _sessionAddr !== account.address) {
      _sessionKey = null;
      _sessionAddr = null;
      setSession(null);
    }
  }, [account]);

  const ensureSession = useCallback(async (): Promise<SessionKey | null> => {
    if (_sessionKey) return _sessionKey;
    if (!account) return null;
    setBusy(true);
    setError(null);
    try {
      const sk = await SessionKey.create({
        address: account.address,
        packageId: PACKAGE_ID,
        ttlMin: 10,
        suiClient: makeSuiClient() as any,
      });
      const personalMessage = sk.getPersonalMessage();
      const { signature } = await signPersonal({ message: personalMessage });
      await sk.setPersonalMessageSignature(signature);
      _sessionKey = sk;
      _sessionAddr = account.address;
      setSession(sk);
      return sk;
    } catch (e: any) {
      setError(e?.message || String(e));
      return null;
    } finally {
      setBusy(false);
    }
  }, [account, signPersonal]);

  return { session, ensureSession, busy, error };
}
