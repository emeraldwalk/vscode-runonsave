import * as vscode from 'vscode';
import { ExtensionController } from './ExtensionController';

export function activate(context: vscode.ExtensionContext): void {
  const extension = new ExtensionController(context);
  extension.showOutputMessage();

  vscode.workspace.onDidChangeConfiguration(() => {
    const disposeStatus = extension.showStatusMessage(
      'Run On Save: Reloading config.',
    );
    extension.loadConfig();
    disposeStatus.dispose();
  });

  vscode.commands.registerCommand(
    'extension.emeraldwalk.enableRunOnSave',
    () => {
      extension.isEnabled = true;
    },
  );

  vscode.commands.registerCommand(
    'extension.emeraldwalk.disableRunOnSave',
    () => {
      extension.isEnabled = false;
    },
  );

  vscode.commands.registerCommand(
    'extension.emeraldwalk.toggleRunOnSave',
    () => {
      extension.isEnabled = !extension.isEnabled;
    },
  );

  vscode.workspace.onWillSaveTextDocument(
    (event: vscode.TextDocumentWillSaveEvent) => {
      extension.onWillSave(event.document);
    },
  );

  vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
    extension.onDidSave(document);
  });

  vscode.workspace.onWillSaveNotebookDocument(
    (event: vscode.NotebookDocumentWillSaveEvent) => {
      extension.onWillSave(event.notebook);
    },
  );

  vscode.workspace.onDidSaveNotebookDocument(
    (notebookDocument: vscode.NotebookDocument) => {
      extension.onDidSave(notebookDocument);
    },
  );
}
