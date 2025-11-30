import * as vscode from 'vscode';
import { ChildProcess } from 'child_process';
import { type Document } from '../model';

export class MockChildProcess extends ChildProcess {
  constructor(private _promise: Promise<number>) {
    super();
    this._init();
  }

  private _eventHandlers = new Map<string, Function[]>();

  private async _init() {
    try {
      const statusCode = await this._promise;
      this.emit('exit', statusCode);
    } catch (err) {
      this.emit('exit', err);
    }
  }

  emit(event: string, ...args: any[]): boolean {
    const handlers = this._eventHandlers.get(event);
    if (handlers == null || handlers.length === 0) {
      return false;
    }

    for (const handler of handlers) {
      handler(...args);
    }

    return true;
  }

  on(event: string, callback: Function): this {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, []);
    }
    this._eventHandlers.get(event)?.push(callback);

    return this;
  }
}

/** Create a mock Document */
export function createDocument(fsPathOrUri: string | vscode.Uri): Document {
  return {
    uri: ensureUri(fsPathOrUri),
  } as Document;
}

/** Create a mock Uri */
export function createUri(fsPath: string): vscode.Uri {
  return {
    fsPath,
  } as vscode.Uri;
}

/** Create a mock WorkspaceFolder */
export function createWorkspaceFolder(fsPath: string): vscode.WorkspaceFolder {
  return {
    uri: ensureUri(fsPath),
  } as vscode.WorkspaceFolder;
}

/** Normalize a path or Uri to a Uri */
export function ensureUri(fsPathOrUri: vscode.Uri | string): vscode.Uri {
  if (typeof fsPathOrUri === 'string') {
    return createUri(fsPathOrUri);
  }

  return fsPathOrUri;
}
