import crypto from 'crypto';

const base64UrlEncode = (input: Buffer): string =>
  input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const base64UrlDecode = (input: string): Buffer => {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4);
  return Buffer.from(normalized + '='.repeat(pad), 'base64');
};

const getSecret = (): string => {
  const secret =
    process.env.LENS_TOKEN_SECRET ||
    process.env.SERPAPI_TOKEN_SECRET ||
    process.env.PROVIDER_TOKEN_SECRET;
  if (!secret) {
    throw new Error('Provider token secret is not configured');
  }
  return secret;
};

interface ProviderTokenPayload {
  assetId: string;
  brandId: string;
  provider: 'serpapi_lens';
  exp: number; // seconds since epoch
  nonce: string;
}

export const createProviderToken = (payload: Omit<ProviderTokenPayload, 'exp' | 'nonce'>, ttlSeconds: number): string => {
  const now = Math.floor(Date.now() / 1000);
  const body: ProviderTokenPayload = {
    ...payload,
    exp: now + Math.max(30, ttlSeconds),
    nonce: crypto.randomBytes(8).toString('hex'),
  };

  const json = Buffer.from(JSON.stringify(body));
  const secret = getSecret();
  const sig = crypto.createHmac('sha256', secret).update(json).digest();

  return `${base64UrlEncode(json)}.${base64UrlEncode(sig)}`;
};

export const verifyProviderToken = (token: string): ProviderTokenPayload => {
  const [bodyPart, sigPart] = token.split('.');
  if (!bodyPart || !sigPart) {
    throw new Error('Invalid token format');
  }

  const bodyBuf = base64UrlDecode(bodyPart);
  const providedSig = base64UrlDecode(sigPart);
  const secret = getSecret();
  const expectedSig = crypto.createHmac('sha256', secret).update(bodyBuf).digest();

  if (!crypto.timingSafeEqual(providedSig, expectedSig)) {
    throw new Error('Invalid token signature');
  }

  const payload = JSON.parse(bodyBuf.toString('utf-8')) as ProviderTokenPayload;
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    throw new Error('Token expired');
  }

  return payload;
};

export const hashProviderToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};
