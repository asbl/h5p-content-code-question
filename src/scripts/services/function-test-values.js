import he from 'he';

export const toPythonLiteral = (value) => {
  if (value === null) return 'None';
  if (value === true) return 'True';
  if (value === false) return 'False';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(toPythonLiteral).join(', ')}]`;
  if (typeof value === 'object') {
    return `{${Object.entries(value)
      .map(([key, item]) => `${JSON.stringify(key)}: ${toPythonLiteral(item)}`)
      .join(', ')}}`;
  }
  throw new Error('Unsupported JSON value');
};

export const normalizeFunctionTestValue = (value) => {
  const text = String(value ?? '').trim();
  try {
    JSON.parse(text);
    return text;
  }
  catch {
    return he.decode(text);
  }
};

export const formatFunctionTestValue = (value) => {
  const text = normalizeFunctionTestValue(value);
  try {
    return toPythonLiteral(JSON.parse(text));
  }
  catch {
    return text;
  }
};
