const ALGORITHM = "PBKDF2";
const DIGEST = "SHA-256";
const ITERATIONS = 210_000;
const KEY_BYTES = 32;

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");

const hexToBytes = (hex: string) => {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) throw new Error("Invalid password hash");
  return Uint8Array.from(hex.match(/.{2}/g) ?? [], byte => Number.parseInt(byte, 16));
};

const derive = async (password: string, salt: Uint8Array, iterations: number) => {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    ALGORITHM,
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: ALGORITHM, hash: DIGEST, salt, iterations },
    material,
    KEY_BYTES * 8,
  );
  return new Uint8Array(bits);
};

const equal = (left: Uint8Array, right: Uint8Array) => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left[index] ^ right[index];
  return difference === 0;
};

export const hashPassword = async (password: string) => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2-sha256$${ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(hash)}`;
};

export const verifyPassword = async (password: string, stored: string) => {
  if (!stored.startsWith("pbkdf2-sha256$")) return { matches: password === stored, needsUpgrade: password === stored };
  const [, iterationText, saltHex, hashHex] = stored.split("$");
  const expected = hexToBytes(hashHex);
  const actual = await derive(password, hexToBytes(saltHex), Number.parseInt(iterationText, 10));
  return { matches: equal(actual, expected), needsUpgrade: false };
};
