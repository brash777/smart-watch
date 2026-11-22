import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import '../i18n';
import { setSession } from '../lib/http';

afterEach(() => {
  cleanup();
  setSession(null);
  vi.unstubAllGlobals();
});
