import { describe, expect, it, vi } from 'vitest';
import { SaveTracker } from '../SaveTracker';
import { createUri } from './testUtils';

describe('SaveTracker', () => {
  const createMockDocument = (fsPath: string, isDirty: boolean = true) =>
    ({
      uri: createUri(fsPath),
      isDirty,
    }) as any;

  it('should not enqueue save if document is not dirty', () => {
    const runner = vi.fn();
    const ignoreUnchangedFiles = vi.fn().mockReturnValue(false);
    const tracker = new SaveTracker(runner, ignoreUnchangedFiles);

    const doc = createMockDocument('/file.txt', false);
    tracker.onWillSave(doc);

    tracker.onDidSave(doc);

    expect(runner).toHaveBeenCalledWith(doc);
  });

  it('should run commands for dirty document when ignoreUnchangedFiles is false', () => {
    const runner = vi.fn();
    const ignoreUnchangedFiles = vi.fn().mockReturnValue(false);
    const tracker = new SaveTracker(runner, ignoreUnchangedFiles);

    const doc = createMockDocument('/file.txt', true);
    tracker.onWillSave(doc);
    tracker.onDidSave(doc);

    expect(runner).toHaveBeenCalledWith(doc);
  });

  it('should not run commands for unchanged file when ignoreUnchangedFiles is true', () => {
    const runner = vi.fn();
    const ignoreUnchangedFiles = vi.fn().mockReturnValue(true);
    const tracker = new SaveTracker(runner, ignoreUnchangedFiles);

    const doc = createMockDocument('/file.txt', true);
    // First save: dirty
    tracker.onWillSave(doc);
    tracker.onDidSave(doc);

    // Second save: not dirty (unchanged)
    tracker.onDidSave(doc);

    expect(runner).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple pending saves correctly', () => {
    const runner = vi.fn();
    const ignoreUnchangedFiles = vi.fn().mockReturnValue(false);
    const tracker = new SaveTracker(runner, ignoreUnchangedFiles);

    const doc = createMockDocument('/file.txt', true);

    // Multiple willSave before didSave
    tracker.onWillSave(doc);
    tracker.onWillSave(doc);
    tracker.onDidSave(doc); // count = 1, run
    expect(runner).toHaveBeenCalledTimes(1);

    tracker.onDidSave(doc); // count = 0, run
    expect(runner).toHaveBeenCalledTimes(2);
  });

  it('should track different files separately', () => {
    const runner = vi.fn();
    const ignoreUnchangedFiles = vi.fn().mockReturnValue(false);
    const tracker = new SaveTracker(runner, ignoreUnchangedFiles);

    const doc1 = createMockDocument('/file1.txt', true);
    const doc2 = createMockDocument('/file2.txt', true);

    tracker.onWillSave(doc1);
    tracker.onWillSave(doc2);
    tracker.onDidSave(doc1);
    tracker.onDidSave(doc2);

    expect(runner).toHaveBeenCalledTimes(2);
  });
});
