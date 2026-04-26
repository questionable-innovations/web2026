"use client";

import { useState } from "react";
import { toastError } from "@/lib/error-toast";

type Stage = "idle" | "sending" | "sent" | "verifying" | "verified" | "error";

async function readErrorBody(res: Response): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return `HTTP ${res.status}`;
    try {
      const parsed = JSON.parse(text) as { error?: unknown };
      if (typeof parsed.error === "string" && parsed.error.length > 0) {
        return parsed.error;
      }
    } catch {
      // Body wasn't JSON - fall through to raw text.
    }
    return text;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export function useEmailOtp() {
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  async function request(value: string): Promise<boolean> {
    setError(null);
    setStage("sending");
    setEmail(value);
    let res: Response;
    try {
      res = await fetch("/api/otp/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
    } catch (err) {
      toastError("Couldn't send code", err);
      setError("Couldn't send code. Check your connection.");
      setStage("error");
      return false;
    }
    if (!res.ok) {
      const detail = await readErrorBody(res);
      toastError("Couldn't send code", detail);
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
    let res: Response;
    try {
      res = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
    } catch (err) {
      toastError("Couldn't verify code", err);
      setError("Couldn't verify code. Check your connection.");
      setStage("sent");
      return false;
    }
    if (!res.ok) {
      const detail = await readErrorBody(res);
      toastError("Code rejected", detail);
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
