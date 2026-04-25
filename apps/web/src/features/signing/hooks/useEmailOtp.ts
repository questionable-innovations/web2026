"use client";

import { useState } from "react";

type Stage = "idle" | "sending" | "sent" | "verifying" | "verified" | "error";

export function useEmailOtp() {
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  async function request(value: string): Promise<boolean> {
    setError(null);
    setStage("sending");
    setEmail(value);
    const res = await fetch("/api/otp/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: value }),
    });
    if (!res.ok) {
      setError("Couldn't send code. Check the address.");
      setStage("error");
      return false;
    }
    setStage("sent");
    return true;
  }

  async function verify(code: string): Promise<boolean> {
    setError(null);
    setStage("verifying");
    const res = await fetch("/api/otp/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    if (!res.ok) {
      setError("Wrong or expired code.");
      setStage("sent");
      return false;
    }
    setStage("verified");
    return true;
  }

  function reset() {
    setStage("idle");
    setError(null);
  }

  return { stage, error, email, request, verify, reset };
}
