import { vi } from 'vitest';

export const window = {
  createOutputChannel: vi.fn(() => ({
    appendLine: vi.fn(),
  })),
};

export const workspace = {
  getConfiguration: vi.fn(),
  getWorkspaceFolder: vi.fn(),
};
