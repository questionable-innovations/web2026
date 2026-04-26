import { toast } from "sonner";

// Viem throws BaseError subclasses with a friendlier `shortMessage` than
// `message` (which includes a stack-trace-like dump). Pull the cleanest
// available text without forcing every caller to know about viem's shape.
function extractMessage(err: unknown): string {
  if (err == null) return "Unknown error";
  if (typeof err === "string") return err;
  if (typeof err === "object") {
    const e = err as {
      shortMessage?: unknown;
      details?: unknown;
      message?: unknown;
    };
    if (typeof e.shortMessage === "string" && e.shortMessage.length > 0) {
      return e.shortMessage;
    }
    if (typeof e.details === "string" && e.details.length > 0) {
      return e.details;
    }
    if (typeof e.message === "string" && e.message.length > 0) {
      return e.message;
    }
  }
  return String(err);
}

export function errorMessage(err: unknown): string {
  return extractMessage(err);
}

export function toastError(title: string, err: unknown): void {
  const description = extractMessage(err);
  // eslint-disable-next-line no-console
  console.error(title, err);
  toast.error(title, { description });
}
