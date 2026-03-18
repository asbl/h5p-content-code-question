import { afterEach, vi } from 'vitest';

const missingTranslation = (key, library = '') => `[Missing translation ${library}:${key}]`;

globalThis.H5P = {
  t: vi.fn((key, _params, library) => missingTranslation(key, library)),
  createUUID: vi.fn(() => 'uuid'),
  Question: class {},
};

afterEach(() => {
  vi.useRealTimers();
  globalThis.H5P.t.mockReset();
  globalThis.H5P.t.mockImplementation((key, _params, library) => missingTranslation(key, library));
  globalThis.H5P.createUUID.mockClear();
});