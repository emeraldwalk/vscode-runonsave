import { vi } from 'vitest';

export class ChildProcess {
  on() {}
  stdout = {
    on() {},
  };
  stderr = {
    on() {},
  };
}

export const exec = vi.fn();
