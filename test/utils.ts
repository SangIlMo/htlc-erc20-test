import crypto from "crypto";

export const sha256 = (x: any) =>
  crypto.createHash("sha256").update(x).digest();
export const bufToStr = (b: Buffer) => "0x" + b.toString("hex");

export const newSecretHashPair = () => {
  const secret = crypto.randomBytes(32);
  const hash = sha256(secret);
  return {
    secret: bufToStr(secret),
    hash: bufToStr(hash),
  };
};

export const nowSeconds = () => Math.floor(Date.now() / 1000);
export const hourSeconds = 3600;

export const isSha256Hash = (hashStr: string) =>
  /^0x[0-9a-f]{64}$/i.test(hashStr);

export const htlcArrayToObj = (c: any) => {
  return {
    sender: c[0],
    receiver: c[1],
    amount: c[2],
    hashlock: c[3],
    timelock: c[4],
    withdrawn: c[5],
    refunded: c[6],
    preimage: c[7],
  };
};

export const htlcERC20ArrayToObj = (c: any) => {
  return {
    sender: c[0],
    receiver: c[1],
    token: c[2],
    amount: c[3],
    hashlock: c[4],
    timelock: c[5],
    withdrawn: c[6],
    refunded: c[7],
    preimage: c[8],
  };
};

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
