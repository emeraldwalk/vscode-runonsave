import * as vscode from 'vscode';
import { expect, it, vi } from 'vitest';
import { exec } from 'child_process';
import { ExtensionController } from '../ExtensionController';
import {
  MockChildProcess,
  createUri,
  createDocument,
  createWorkspaceFolder,
} from './testUtils';

vi.mock('child_process');
vi.mock('vscode');

const cmd = {
  sequentialMatchAll: (status: number | string) => ({
    match: '.*',
    isAsync: false,
    cmd: 'sequentialMatchAll:${file}',
    status,
  }),
  sequentialMatchTxt: (status: number | string) => ({
    match: '.*\\.txt',
    isAsync: false,
    cmd: 'sequentialMatchTxt:${file}',
    status,
  }),
  parallelMatchAll: (status: number | string) => ({
    match: '.*',
    isAsync: true,
    cmd: 'parallelMatchAll:${file}',
    status,
  }),
  parallelMatchTxt: (status: number | string) => ({
    match: '.*\\.txt',
    isAsync: true,
    cmd: 'parallelMatchTxt:${file}',
    status,
  }),
};

const file = {
  txt1: createUri('file1.txt'),
  txt2: createUri('file2.txt'),
};

const doc = {
  txt1: createDocument(file.txt1),
  txt2: createDocument(file.txt2),
};

const wksp = {
  a: createWorkspaceFolder('/workspace/a'),
};

const globalState = {
  get: vi.fn(),
  update: vi.fn(),
} as unknown as vscode.Memento;

const context = { globalState } as vscode.ExtensionContext;

it.each([
  {
    label: 'Sequential commands with single document',
    commands: [cmd.sequentialMatchAll(0), cmd.sequentialMatchTxt(0)],
    docs: [doc.txt1],
    wksp: wksp.a,
    expected: [
      'sequentialMatchAll:file1.txt:start',
      'sequentialMatchAll:file1.txt:end',
      'sequentialMatchTxt:file1.txt:start',
      'sequentialMatchTxt:file1.txt:end',
    ],
  },
  {
    label: 'Sequential commands with multiple documents',
    commands: [cmd.sequentialMatchAll(0), cmd.sequentialMatchTxt(0)],
    docs: [doc.txt1, doc.txt2],
    wksp: wksp.a,
    expected: [
      'sequentialMatchAll:file1.txt:start',
      'sequentialMatchAll:file2.txt:start',
      'sequentialMatchAll:file1.txt:end',
      'sequentialMatchAll:file2.txt:end',
      'sequentialMatchTxt:file1.txt:start',
      'sequentialMatchTxt:file2.txt:start',
      'sequentialMatchTxt:file1.txt:end',
      'sequentialMatchTxt:file2.txt:end',
    ],
  },
  {
    label: 'Parallel commands with single document',
    commands: [cmd.parallelMatchAll(0), cmd.parallelMatchTxt(0)],
    docs: [doc.txt1],
    wksp: wksp.a,
    expected: [
      'parallelMatchAll:file1.txt:start',
      'parallelMatchTxt:file1.txt:start',
      'parallelMatchAll:file1.txt:end',
      'parallelMatchTxt:file1.txt:end',
    ],
  },
  {
    label: 'Parallel commands with multiple documents',
    commands: [cmd.parallelMatchAll(0), cmd.parallelMatchTxt(0)],
    docs: [doc.txt1, doc.txt2],
    wksp: wksp.a,
    expected: [
      'parallelMatchAll:file1.txt:start',
      'parallelMatchTxt:file1.txt:start',
      'parallelMatchAll:file2.txt:start',
      'parallelMatchTxt:file2.txt:start',
      'parallelMatchAll:file1.txt:end',
      'parallelMatchTxt:file1.txt:end',
      'parallelMatchAll:file2.txt:end',
      'parallelMatchTxt:file2.txt:end',
    ],
  },
  {
    label: 'Mixed sequential and parallel commands with single document',
    commands: [
      cmd.sequentialMatchAll(0),
      cmd.parallelMatchAll(0),
      cmd.sequentialMatchTxt(0),
    ],
    docs: [doc.txt1],
    wksp: wksp.a,
    expected: [
      'sequentialMatchAll:file1.txt:start',
      'sequentialMatchAll:file1.txt:end',
      'parallelMatchAll:file1.txt:start',
      'sequentialMatchTxt:file1.txt:start',
      'parallelMatchAll:file1.txt:end',
      'sequentialMatchTxt:file1.txt:end',
    ],
  },
  {
    label: 'Mixed sequential and parallel commands with multiple documents',
    commands: [
      cmd.sequentialMatchAll(0),
      cmd.parallelMatchAll(0),
      cmd.sequentialMatchTxt(0),
    ],
    docs: [doc.txt1, doc.txt2],
    wksp: wksp.a,
    expected: [
      'sequentialMatchAll:file1.txt:start',
      'sequentialMatchAll:file2.txt:start',
      'sequentialMatchAll:file1.txt:end',
      'sequentialMatchAll:file2.txt:end',

      'parallelMatchAll:file1.txt:start',
      'sequentialMatchTxt:file1.txt:start',
      'parallelMatchAll:file2.txt:start',
      'sequentialMatchTxt:file2.txt:start',

      'parallelMatchAll:file1.txt:end',
      'sequentialMatchTxt:file1.txt:end',
      'parallelMatchAll:file2.txt:end',
      'sequentialMatchTxt:file2.txt:end',
    ],
  },
])(
  'should run commands: $label',
  async ({ commands, docs, wksp, expected }) => {
    const config = {
      commands,
    } as unknown as vscode.WorkspaceConfiguration;

    vi.mocked(globalState.get).mockReturnValue(true);
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(config);
    vi.mocked(vscode.workspace.getWorkspaceFolder).mockReturnValue(wksp);

    // Note: this works as long as each cmd is unique
    const statusMap = new Map(
      commands.map(({ cmd, status }) => [cmd.split(':')[0], status]),
    );

    const logs: string[] = [];

    vi.mocked(exec).mockImplementation((command: string, options) => {
      logs.push(`${command}:start:${JSON.stringify(options)}`);

      const status = statusMap.get(command.split(':')[0]);

      const promise =
        typeof status === 'number'
          ? Promise.resolve(status)
          : Promise.reject(status);

      promise.finally(() => {
        logs.push(`${command}:end:${JSON.stringify(options)}`);
      });

      return new MockChildProcess(promise);
    });

    const instance = new ExtensionController(context);

    await Promise.all(docs.map((doc) => instance.runCommands(doc)));

    expect(logs).toEqual(
      expected.map((ex) => `${ex}:${JSON.stringify({ cwd: wksp.uri.fsPath })}`),
    );
  },
);
