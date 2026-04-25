import { PinataSDK } from "pinata";

const jwt = process.env.PINATA_JWT;

export const pinata = jwt
  ? new PinataSDK({
      pinataJwt: jwt,
      pinataGateway: process.env.NEXT_PUBLIC_IPFS_GATEWAY,
    })
  : null;

export async function pinPdf(file: File | Blob, name: string) {
  if (!pinata) throw new Error("PINATA_JWT not configured");
  const result = await pinata.upload.file(
    new File([file], name, { type: "application/pdf" }),
  );
  return { cid: result.cid };
}

export async function sha256(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return (
    "0x" +
    Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}
