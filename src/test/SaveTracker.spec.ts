import { describe, expect, it, vi } from 'vitest';
import { SaveTracker } from '../SaveTracker';
import { createDocument } from './testUtils';

describe('SaveTracker', () => {
  it.each([
    {
      isDirty: true,
      ignoreUnchanged: false,
      shouldEnqueue: true,
      shouldRun: true,
      filename: 'file1.txt',
    },
    {
      isDirty: true,
      ignoreUnchanged: true,
      shouldEnqueue: true,
      shouldRun: true,
      filename: 'file1.txt',
    },
    {
      isDirty: false,
      ignoreUnchanged: false,
      shouldEnqueue: false,
      shouldRun: true,
      filename: 'file1.txt',
    },
    {
      isDirty: false,
      ignoreUnchanged: true,
      shouldEnqueue: false,
      shouldRun: false,
      filename: 'file1.txt',
    },
  ])(
    'isDirty=$isDirty ignore=$ignoreUnchanged -> enqueue=$shouldEnqueue run=$shouldRun',
    ({ isDirty, ignoreUnchanged, shouldEnqueue, shouldRun, filename }) => {
      const runner = vi.fn();
      const getIgnoreUnchangedFiles = vi.fn().mockReturnValue(ignoreUnchanged);

      const tracker = new SaveTracker(runner, getIgnoreUnchangedFiles);

      const doc = createDocument(`/${filename}`, isDirty);

      tracker.onWillSave(doc);

      expect(tracker.getPendingSaveCount(doc.uri)).toBe(shouldEnqueue ? 1 : 0);

      tracker.onDidSave(doc);

      expect(tracker.getPendingSaveCount(doc.uri)).toBe(0);

      if (shouldRun) {
        expect(runner).toHaveBeenCalledWith(doc);
      } else {
        expect(runner).not.toHaveBeenCalled();
      }
    },
  );
});
