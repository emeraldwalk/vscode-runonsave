import * as vscode from 'vscode';
import type { Document, UriString } from './model';

/**
 * Tracks pending saves for documents and determines when to execute commands
 * based on the ignoreUnchangedFiles setting.
 */
export class SaveTracker {
  private _pendingSaveMap = new Map<UriString, number>();
  private _getIgnoreUnchangedFiles: () => boolean;
  private _runner: (document: Document) => void;

  constructor(
    runner: (document: Document) => void,
    getIgnoreUnchangedFiles: () => boolean,
  ) {
    this._runner = runner;
    this._getIgnoreUnchangedFiles = getIgnoreUnchangedFiles;
  }

  /**
   * Get the number of pending saves for a given URI.
   */
  public getPendingSaveCount(uri: vscode.Uri): number {
    return this._pendingSaveMap.get(uri.fsPath) ?? 0;
  }

  /**
   * Enqueue a save for the given Document.
   */
  public onWillSave(document: Document): void {
    if (!document.isDirty) {
      return;
    }

    const count = this._pendingSaveMap.get(document.uri.fsPath) || 0;
    this._pendingSaveMap.set(document.uri.fsPath, count + 1);
  }

  /**
   * Handle a save for the given Document.
   */
  public onDidSave(document: Document): void {
    const prevCount = this._pendingSaveMap.get(document.uri.fsPath) ?? 0;

    if (prevCount > 1) {
      this._pendingSaveMap.set(document.uri.fsPath, prevCount - 1);
    } else {
      this._pendingSaveMap.delete(document.uri.fsPath);
    }

    const isUnchanged = prevCount <= 0;
    if (isUnchanged && this._getIgnoreUnchangedFiles()) {
      return;
    }

    this._runner(document);
  }
}
