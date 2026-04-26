import { NextResponse } from "next/server";
import { isAddress } from "viem";
import {
  forwardResolve,
  looksLikeEnsName,
  resolveEnsProfile,
  reverseResolve,
} from "@/lib/ens";

/// Thin proxy in front of sepolia ENS resolution. The frontend never talks to
/// sepolia directly - it goes through this route so we get one shared cache,
/// one place to swap the RPC, and so the explorer can ask for a full profile
/// (avatar + text records) without each component re-implementing it.
///
/// Modes:
///   ?address=0x…           → reverse-resolve, optionally with profile=1
///   ?name=foo.eth          → forward-resolve to address
///   ?name=foo.eth&profile=1 → full ENS profile (avatar, bio, links)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");
  const name = searchParams.get("name");
  const wantProfile = searchParams.get("profile") === "1";

  if (address) {
    if (!isAddress(address)) {
      return NextResponse.json({ error: "bad address" }, { status: 400 });
    }
    const ensName = await reverseResolve(address);
    if (wantProfile && ensName) {
      const profile = await resolveEnsProfile(ensName);
      return NextResponse.json({
        address: address.toLowerCase(),
        ensName,
        profile,
      });
    }
    return NextResponse.json({ address: address.toLowerCase(), ensName });
  }

  if (name) {
    if (!looksLikeEnsName(name)) {
      return NextResponse.json({ error: "bad name" }, { status: 400 });
    }
    if (wantProfile) {
      const profile = await resolveEnsProfile(name);
      if (!profile) {
        return NextResponse.json({ name, address: null, profile: null });
      }
      return NextResponse.json({
        name: profile.name,
        address: profile.address,
        profile,
      });
    }
    const resolved = await forwardResolve(name);
    return NextResponse.json({ name, address: resolved });
  }

  return NextResponse.json(
    { error: "pass ?address=0x… or ?name=foo.eth" },
    { status: 400 },
  );
}
