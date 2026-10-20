// The recipe travels as the payload of a JWT in the URL. Signatures are not
// checked (or produced): the JWT is just a URL-safe envelope, so a token from
// any issuer opens as long as its payload holds a valid recipe.

const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64urlToBytes(s) {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error("token is not base64url");
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Returns the token's payload. The signature part may be anything, including
 * empty, or missing altogether: an unsigned token ends in ".", and chat apps
 * and link detectors routinely drop that dot as sentence punctuation.
 */
export function decode(token) {
  const parts = String(token).trim().split(".");
  if (parts.length !== 2 && parts.length !== 3) throw new Error("token must look like header.payload.signature");
  const bytes = b64urlToBytes(parts[1]);
  try {
    return JSON.parse(dec.decode(bytes));
  } catch (e) {
    throw new Error("token payload is not valid JSON");
  }
}

/** Builds an unsigned (alg "none") JWT carrying `payload`. */
export function encode(payload) {
  const part = (obj) => bytesToB64url(enc.encode(JSON.stringify(obj)));
  return `${part({ alg: "none", typ: "JWT" })}.${part(payload)}.`;
}
