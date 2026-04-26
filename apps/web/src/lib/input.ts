export const POSITIVE_DECIMAL_PATTERN = /^(?=.*[1-9])\d+(?:\.\d+)?$/;

export function sanitizeDecimalInput(value: string, maxDecimals?: number): string {
  const cleaned = value.replace(/,/g, "").replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  const hasDot = dot !== -1;
  const wholeRaw = hasDot ? cleaned.slice(0, dot) : cleaned;
  const fractionRaw = hasDot
    ? cleaned.slice(dot + 1).replace(/\./g, "")
    : "";
  const whole = (wholeRaw || (hasDot ? "0" : "")).replace(/^0+(?=\d)/, "");
  const fraction =
    maxDecimals === undefined ? fractionRaw : fractionRaw.slice(0, maxDecimals);

  return hasDot ? `${whole}.${fraction}` : whole;
}

export function isPositiveDecimalInput(value: string): boolean {
  return POSITIVE_DECIMAL_PATTERN.test(value);
}

export function decimalInputError(label: string): string {
  return `${label} must be a number greater than 0.`;
}
