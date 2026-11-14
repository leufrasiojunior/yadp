import { isIP } from "node:net";

/** Require a network address, rather than silently widening a host address. */
export function normalizeSubnet(value: string): string {
  const parts = value.trim().split("/");
  const address = parts[0] ?? "";
  const prefixText = parts[1] ?? "";
  const family = isIP(address);
  if (parts.length !== 2 || !family || address.includes("%") || !/^(0|[1-9]\d{0,2})$/.test(prefixText)) {
    throw new Error("Use an IPv4 or IPv6 network in CIDR notation.");
  }
  const width = family === 4 ? 32 : 128;
  const prefix = Number(prefixText);
  if (prefix > width) throw new Error("Invalid subnet prefix length.");
  const canonical = family === 4 ? address : new URL(`http://[${address}]/`).hostname.slice(1, -1);
  let number: bigint;
  if (family === 4) {
    number = address.split(".").reduce((result, octet) => (result << 8n) | BigInt(octet), 0n);
  } else {
    const [left = "", right] = canonical.split("::");
    const start = left ? left.split(":") : [];
    const end = right ? right.split(":") : [];
    const words = right === undefined ? start : [...start, ...Array(8 - start.length - end.length).fill("0"), ...end];
    number = words.reduce((result, word) => (result << 16n) | BigInt(`0x${word}`), 0n);
  }
  const hostMask = (1n << BigInt(width - prefix)) - 1n;
  if ((number & hostMask) !== 0n) throw new Error("Use the subnet's network address (host bits must be zero).");
  return `${canonical}/${prefix}`;
}
