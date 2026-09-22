/** Publr portable scalar contract. Wire values use tagged, lossless envelopes. */
export const PORTABLE_SEMANTICS_VERSION = 1;

export type PortableScalar = undefined | null | boolean | number | string;
export type EncodedScalar =
  | ["undefined"]
  | ["null"]
  | ["boolean", boolean]
  | ["number", string]
  | ["string", string];

export function numberToBits(value: number): string {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value, false);
  return view.getBigUint64(0, false).toString(16).padStart(16, "0");
}

export function numberFromBits(value: string): number {
  if (!/^[0-9a-fA-F]{16}$/.test(value)) throw new TypeError("Invalid portable scalar");
  const view = new DataView(new ArrayBuffer(8));
  view.setBigUint64(0, BigInt(`0x${value}`), false);
  return view.getFloat64(0, false);
}

function validString(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (code >= 0xdc00 && code <= 0xdfff) return false;
  }
  return true;
}

export function encodeScalar(value: PortableScalar): EncodedScalar {
  if (value === undefined) return ["undefined"];
  if (value === null) return ["null"];
  if (typeof value === "boolean") return ["boolean", value];
  if (typeof value === "number") return ["number", numberToBits(value)];
  if (typeof value === "string" && validString(value)) return ["string", value];
  throw new TypeError("Invalid portable scalar");
}

export function decodeScalar(value: unknown): PortableScalar {
  if (!Array.isArray(value)) throw new TypeError("Invalid portable scalar");
  const [tag, payload] = value as unknown[];
  if (value.length === 1 && tag === "undefined") return undefined;
  if (value.length === 1 && tag === "null") return null;
  if (value.length === 2) {
    if (tag === "boolean" && typeof payload === "boolean") return payload;
    if (tag === "number" && typeof payload === "string") return numberFromBits(payload);
    if (tag === "string" && typeof payload === "string" && validString(payload)) return payload;
  }
  throw new TypeError("Invalid portable scalar");
}
