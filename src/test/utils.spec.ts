import * as vscode from 'vscode';
import { describe, expect, it, vi } from 'vitest';
import { getReplacements, doReplacement } from '../utils';
import { createUri, createWorkspaceFolder } from './testUtils';

vi.mock('vscode');

describe('getReplacements', () => {
  it('should return all token replacements', () => {
    // Mock vscode.workspace.getWorkspaceFolder
    const mockGetWorkspaceFolder = vi.mocked(
      vscode.workspace.getWorkspaceFolder,
    );
    const workspaceFolder = createWorkspaceFolder('/workspace');
    mockGetWorkspaceFolder.mockReturnValue(workspaceFolder);

    // Mock process.cwd
    const mockCwd = vi.spyOn(process, 'cwd');
    mockCwd.mockReturnValue('/cwd');

    // Set up environment variable
    process.env.TEST_VAR = 'test_value';

    // Create a URI for a file
    const uri = createUri('/workspace/src/file.ts');

    // Get replacements
    const replacements = getReplacements(uri);

    // Create a test string with all tokens
    const testString =
      '${file} ${workspaceRoot} ${workspaceFolder} ${fileBasename} ${fileDirname} ${fileExtname} ${fileBasenameNoExt} ${relativeFile} ${cwd} ${env.TEST_VAR}';

    // Apply replacements
    const result = doReplacement(testString, replacements);

    // Expected result
    const expected =
      '/workspace/src/file.ts /workspace /workspace file.ts /workspace/src .ts file src/file.ts /cwd test_value';

    expect(result).toBe(expected);

    // Clean up
    mockCwd.mockRestore();
    delete process.env.TEST_VAR;
  });
});
