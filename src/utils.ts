import * as path from 'path';
import * as vscode from 'vscode';
import type { Document, StringReplaceParams, StringReplacer } from './model';

/**
 * Perform string replacements on the given text using the provided replacers.
 */
export function doReplacement(
  text: string | null,
  replacers: Array<StringReplaceParams>,
): string | null {
  if (!text) {
    return text;
  }

  for (const [searchValue, replacer] of replacers) {
    text = text.replace(searchValue, replacer as StringReplacer);
  }

  return text;
}

/**
 * Get the list of replacements for a given Uri.
 */
export function getReplacements(uri: vscode.Uri): Array<StringReplaceParams> {
  const extName = path.extname(uri.fsPath);
  const workspaceFolderPath = getWorkspaceFolderPath(uri);
  const relativeFile = path.relative(workspaceFolderPath, uri.fsPath);
  return [
    [/\${file}/g, `${uri.fsPath}`],
    // DEPRECATED: workspaceFolder is more inline with vscode variables,
    // but leaving old version in place for any users already using it.
    [/\${workspaceRoot}/g, workspaceFolderPath],
    [/\${workspaceFolder}/g, workspaceFolderPath],
    [/\${fileBasename}/g, path.basename(uri.fsPath)],
    [/\${fileDirname}/g, path.dirname(uri.fsPath)],
    [/\${fileExtname}/g, extName],
    [/\${fileBasenameNoExt}/g, path.basename(uri.fsPath, extName)],
    [/\${relativeFile}/g, relativeFile],
    [/\${cwd}/g, process.cwd()],
    // replace environment variables ${env.Name}
    [
      /\${env\.([^}]+)}/g,
      (_sub: string, envName: string): string => {
        // TODO: This is likely a bug and should be:
        // process.env[envName] ?? ''. I just want to avoid
        // a runtime change as part of this refactor.
        return process.env[envName]!;
      },
    ],
  ];
}

/**
 * Get the workspace folder path for a given URI.
 * If the URI does not belong to any workspace, return its directory path.
 */
export function getWorkspaceFolderPath(uri: vscode.Uri) {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);

  // If file doesn't belong to a workspace, use the file's directory
  return workspaceFolder
    ? workspaceFolder.uri.fsPath
    : path.dirname(uri.fsPath);
}
