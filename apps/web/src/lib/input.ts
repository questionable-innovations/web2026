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

export function compareDecimalInputs(left: string, right: string): number {
  const [leftWhole = "", leftFraction = ""] = left.split(".");
  const [rightWhole = "", rightFraction = ""] = right.split(".");
  const scale = Math.max(leftFraction.length, rightFraction.length);
  const leftComparable = BigInt(
    `${leftWhole || "0"}${leftFraction.padEnd(scale, "0")}`,
  );
  const rightComparable = BigInt(
    `${rightWhole || "0"}${rightFraction.padEnd(scale, "0")}`,
  );

  if (leftComparable === rightComparable) return 0;
  return leftComparable > rightComparable ? 1 : -1;
}

export function percentOfDecimalInput(
  value: string,
  percent: number,
  maxDecimals?: number,
): string {
  if (!isPositiveDecimalInput(value)) return "";

  const clampedPercent = Math.min(100, Math.max(0, Math.round(percent)));
  const [whole = "0", fraction = ""] = value.split(".");
  const inputScale = fraction.length;
  const outputScale = Math.min(
    maxDecimals ?? inputScale + 2,
    inputScale + 2,
  );
  const raw = BigInt(`${whole}${fraction}`);
  const numerator = raw * BigInt(clampedPercent);
  const denominator = 100n;

  let scaled: bigint;
  if (outputScale >= inputScale) {
    const multiplier = 10n ** BigInt(outputScale - inputScale);
    scaled = (numerator * multiplier + denominator / 2n) / denominator;
  } else {
    const divisor = 10n ** BigInt(inputScale - outputScale);
    scaled = (numerator + (denominator * divisor) / 2n) / denominator / divisor;
  }

  return formatScaledDecimal(scaled, outputScale);
}

export function percentFromDecimalInputs(amount: string, total: string): number {
  if (!isPositiveDecimalInput(amount) || !isPositiveDecimalInput(total)) {
    return 0;
  }

  const percent = (Number(amount) / Number(total)) * 100;
  if (!Number.isFinite(percent)) return 0;
  return Math.min(100, Math.max(0, Math.round(percent)));
}

function formatScaledDecimal(value: bigint, scale: number): string {
  if (scale === 0) return value.toString();

  const negative = value < 0n;
  const raw = (negative ? -value : value).toString().padStart(scale + 1, "0");
  const whole = raw.slice(0, -scale);
  const fraction = raw.slice(-scale).replace(/0+$/, "");
  const formatted = fraction ? `${whole}.${fraction}` : whole;
  return negative ? `-${formatted}` : formatted;
}

export function decimalInputError(label: string): string {
  return `${label} must be a number greater than 0.`;
}
