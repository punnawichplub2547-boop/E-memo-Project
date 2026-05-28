export function coerceNonNegativeNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : 0;
}

export function coercePositiveInteger(value: unknown) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 1) return 1;
  return Math.floor(numberValue);
}

export function clampNonNegativeInputElement(input: HTMLInputElement) {
  if (Number(input.value) < 0) input.value = "0";
}

export function clampPositiveIntegerInputElement(input: HTMLInputElement) {
  if (Number(input.value) < 1) input.value = "1";
}

export function shouldBlockNonNegativeNumberKey(key: string) {
  return key === "-" || key === "+" || key === "e" || key === "E";
}

export function shouldBlockPositiveIntegerKey(key: string) {
  return shouldBlockNonNegativeNumberKey(key) || key === ".";
}
