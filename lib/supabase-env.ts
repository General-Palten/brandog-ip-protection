const stripWrappingQuotes = (value: string): string => {
  if (value.length < 2) return value;
  const first = value[0];
  const last = value[value.length - 1];
  const wrappedInDoubleQuotes = first === '"' && last === '"';
  const wrappedInSingleQuotes = first === "'" && last === "'";
  if (wrappedInDoubleQuotes || wrappedInSingleQuotes) {
    return value.slice(1, -1);
  }
  return value;
};

export const sanitizeEnvValue = (value: string | undefined): string => {
  if (!value) return '';
  return stripWrappingQuotes(value.trim()).replace(/[\r\n]/g, '').trim();
};

export const isLikelyHttpUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
};
