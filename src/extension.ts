import * as vscode from 'vscode';
import * as path from 'path';
import { exec } from 'child_process';
import type { ICommand, IConfig, IExecResult, Document } from './model';

const STATUS_BAR_ACTIVITY_ID = 'status.activity';
const COMMAND_SHOW_OUTPUT_CHANNEL = 'extension.emeraldwalk.showOutputChannel';

export function activate(context: vscode.ExtensionContext): void {
  const extension = new RunOnSaveExtension(context);
  context.subscriptions.push(extension);

  vscode.workspace.onDidChangeConfiguration(() => {
    extension.loadConfig();
  });

  vscode.commands.registerCommand(
    'extension.emeraldwalk.enableRunOnSave',
    () => {
      extension.enable();
    },
  );

  vscode.commands.registerCommand(
    'extension.emeraldwalk.disableRunOnSave',
    () => {
      extension.disable();
    },
  );

  vscode.commands.registerCommand(COMMAND_SHOW_OUTPUT_CHANNEL, () => {
    extension.showOutputChannel();
  });

  vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
    extension.runCommands(document);
  });

  vscode.workspace.onDidSaveNotebookDocument((document: vscode.NotebookDocument) => {
    extension.runCommands(document);
  });
}

interface runCommandConfig {
  cfg: ICommand;
  // The modified saved document or notebook that triggered command execution.
  document: Document;
  // Callback to invoke when the command finishes execution (successfully or not).
  finishCallback: () => void;
}

class RunOnSaveExtension implements vscode.Disposable {
  private _outputChannel: vscode.OutputChannel;
  private _context: vscode.ExtensionContext;
  private _config: IConfig;
  private _sbStatus?: vscode.StatusBarItem;
  private _syncCommandQueue: Array<runCommandConfig> = [];
  private _notifyWaitingSyncCommandRunner?: () => void;
  private _activeAsyncCommands: number = 0;
  private _commandAbortController = new AbortController();
  private _disposed: boolean = false;

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
    this._outputChannel = vscode.window.createOutputChannel('Run On Save');
    this._context.subscriptions.push(this._outputChannel);
    this.loadConfig();
    this._syncRunnerLoop(); // starts the synchronous command runner loop.
    this.refreshStatus();
  }

  public dispose(): void {
    this.showOutputMessage('Disposing of Run On Save extension. Aborting all running commands and purging queue.');
    this._disposed = true; // Indicates that the runner loop should stop.
    this._abortAllRunningCommands();
    // In case the runner loop is waiting for a command, wake it so that it can stop.
    this._wakeSyncCommandRunner();
  }

  public showOutputChannel(): void {
    this._outputChannel.show();
  }

  private _enqueueSyncCommand(rc: runCommandConfig): void {
    this._syncCommandQueue.push(rc);
    this.refreshStatus();
    this._wakeSyncCommandRunner();
  }

  /**
   * Loop that processes synchronous commands one at a time in FIFO order.
   */
  private async _syncRunnerLoop(): Promise<void> {
    while (!this._disposed) {
      const cmd = this._syncCommandQueue.shift();
      if (!cmd) {
        const waitForNextSyncCommandPromise = new Promise<void>((resolve) => {
          this._notifyWaitingSyncCommandRunner = resolve;
        });
        this.refreshStatus();
        // Block loop until a command is added to the queue.
        await waitForNextSyncCommandPromise;
        this.refreshStatus();
        continue;
      }

      this.refreshStatus();
      await this._runCommand(cmd);
      this.refreshStatus();
    }
  }

  private _onCmdComplete(rc: runCommandConfig, res: IExecResult): void {
    this.showOutputMessageIfDefined(rc.cfg.messageAfter);
    this.showOutputMessageIfDefined(
      rc.cfg.showElapsed && `Elapsed ms: ${res.elapsedMs}`,
    );

    if (rc.cfg.autoShowOutputPanel === 'error' && res.statusCode !== 0) {
      this._outputChannel.show(true);
    }

    rc.finishCallback();
  }

  /** Invoke a command. */
  private async _runCommand(
    rc: runCommandConfig,
  ): Promise<void> {
    this.showOutputMessageIfDefined(rc.cfg.message);

    if (rc.cfg.autoShowOutputPanel === 'always') {
      this._outputChannel.show(true);
    }

    if (rc.cfg.cmd == null) {
      this._onCmdComplete(rc, { elapsedMs: 0, statusCode: 0 });
      return;
    }

    const res = await this._getExecPromise(rc);
    this._onCmdComplete(rc, res);
  }

  private _getExecPromise(
    rc: runCommandConfig,
  ): Promise<IExecResult> {
    return new Promise((resolve) => {
      const startMs = performance.now();

      const child = exec(rc.cfg.cmd, {
        shell: this.shell,
        cwd: this._getWorkspaceFolderPath(rc.document.uri),
        signal: this._commandAbortController.signal,
        killSignal: rc.cfg.killSignal,
      });
      child.stdout.on('data', (data) => this._outputChannel.append(data));
      child.stderr.on('data', (data) => this._outputChannel.append(data));
      child.on('error', (e) => {
        this.showOutputMessage(e.message);
        // Don't reject since we want to be able to chain and handle
        // message properties even if this errors
        // Returns a status code different than zero to optionally show output
        // panel with error
        resolve({ elapsedMs: performance.now() - startMs, statusCode: 1 });
      });
      child.on('exit', (statusCode) => {
        resolve({ elapsedMs: performance.now() - startMs, statusCode });
      });
    });
  }

  private _getWorkspaceFolderPath(uri: vscode.Uri) {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);

    // NOTE: rootPath seems to be deprecated but seems like the best fallback so that
    // single project workspaces still work. If I come up with a better option, I'll change it.
    return workspaceFolder
      ? workspaceFolder.uri.fsPath
      : vscode.workspace.rootPath;
  }

  private _wakeSyncCommandRunner(): void {
    const notifyWaitingRunner = this._notifyWaitingSyncCommandRunner;
    if (notifyWaitingRunner) {
      this._notifyWaitingSyncCommandRunner = undefined;
      notifyWaitingRunner();
    }
  }

  private _abortAllRunningCommands(): void {
    // Clear pending commands.
    this._syncCommandQueue = [];

    // Abort any existing commands.
    this._commandAbortController.abort();
    this._commandAbortController = new AbortController();
  }

  public enable(): void {
    if (this.isEnabled()) {
      // Already enabled.
      return;
    }

    this._context.globalState.update('isEnabled', true).then(() => {
      // Start the synchronous command runner loop.
      this.showOutputMessage();
      this.refreshStatus();
    });
  }

  public disable(): void {
    this._context.globalState.update('isEnabled', false).then(() => {
      this.showOutputMessage("Disabling Run On Save. Aborting all running commands and purging queue.");
      this._abortAllRunningCommands();

      // Refresh the status bar.
      this.refreshStatus();
    });
  }

  public isEnabled(): boolean {
    return !!this._context.globalState.get('isEnabled', true);
  }

  public get shell(): string {
    return this._config.shell;
  }

  public get autoClearConsole(): boolean {
    return !!this._config.autoClearConsole;
  }

  public get commands(): Array<ICommand> {
    return this._config.commands || [];
  }

  public loadConfig(): void {
    this.showOutputMessage('Reloading config.');
    this._config = <IConfig>(
      (<any>vscode.workspace.getConfiguration('emeraldwalk.runonsave'))
    );
  }

  /**
   * Show message in output channel
   */
  public showOutputMessage(message?: string): void {
    message =
      message || `Run On Save ${this.isEnabled() ? 'enabled' : 'disabled'}.`;
    this._outputChannel.appendLine(message);
  }

  /**
   * Show message in output channel if it is defined and not `false`.
   */
  public showOutputMessageIfDefined(message?: string | null | false): void {
    if (!message) {
      return;
    }

    this.showOutputMessage(message);
  }

  public refreshStatus(): void {
    if (!this._sbStatus) {
      this._sbStatus = vscode.window.createStatusBarItem(STATUS_BAR_ACTIVITY_ID, vscode.StatusBarAlignment.Left, 100);
      this._sbStatus.name = 'Run On Save Status';
      this._sbStatus.command = COMMAND_SHOW_OUTPUT_CHANNEL;
      this._context.subscriptions.push(this._sbStatus);
    }

    let unfinishedSyncCount = this._syncCommandQueue.length;
    if (this._notifyWaitingSyncCommandRunner === undefined && !this._disposed) {
      // We are not disposed and the runner is not waiting for a command, so it must be running a command.
      unfinishedSyncCount++;
    }
    const asyncCount = this._activeAsyncCommands;

    let state: string;

    const atLeastOneCommandIsRunning = unfinishedSyncCount !== 0 || asyncCount !== 0;

    if (!this.isEnabled()) {
      // If we are disabled but have unfinished commands, then we are "draining".
      state = atLeastOneCommandIsRunning ? "draining" : "disabled";
    } else {
      // If we are enabled but have no unfinished commands, then we are "idle".
      state = atLeastOneCommandIsRunning ? "running" : "idle";
    }

    this._sbStatus.text = `${state} Sync: ${unfinishedSyncCount} Async: ${asyncCount}`;
    this._sbStatus.tooltip = `Run On Save: State: ${state}, Unfinished synchronous command count: ${unfinishedSyncCount}, Active asynchronous command count: ${asyncCount}`;
    this._sbStatus.show();
  }

  public runCommands(document: Document): void {
    if (this.autoClearConsole) {
      this._outputChannel.clear();
    }

    if (!this.isEnabled() || this.commands.length === 0) {
      this.showOutputMessage();
      return;
    }

    const match = (pattern: string) =>
      pattern &&
      pattern.length > 0 &&
      new RegExp(pattern).test(document.uri.fsPath);

    const commandConfigs = this.commands.filter((cfg) => {
      const matchPattern = cfg.match || '';
      const negatePattern = cfg.notMatch || '';

      // if no match pattern was provided, or if match pattern succeeds
      const isMatch = matchPattern.length === 0 || match(matchPattern);

      // negation has to be explicitly provided
      const isNegate = negatePattern.length > 0 && match(negatePattern);

      // negation wins over match
      return !isNegate && isMatch;
    });

    if (commandConfigs.length === 0) {
      return;
    }

    const startMs = performance.now();
    this.showOutputMessageIfDefined(this._config.message);

    // A collection of promises that will be resolved when all commands for this document save have finished executing.
    const finishPromises: Array<Promise<void>> = [];

    for (const cfg of commandConfigs) {
      let cmdStr = cfg.cmd;

      const extName = path.extname(document.uri.fsPath);
      const workspaceFolderPath = this._getWorkspaceFolderPath(document.uri);
      const relativeFile = path.relative(
        workspaceFolderPath,
        document.uri.fsPath,
      );

      if (cmdStr) {
        cmdStr = cmdStr.replace(/\${file}/g, `${document.uri.fsPath}`);

        // DEPRECATED: workspaceFolder is more inline with vscode variables,
        // but leaving old version in place for any users already using it.
        cmdStr = cmdStr.replace(/\${workspaceRoot}/g, workspaceFolderPath);

        cmdStr = cmdStr.replace(/\${workspaceFolder}/g, workspaceFolderPath);
        cmdStr = cmdStr.replace(
          /\${fileBasename}/g,
          path.basename(document.uri.fsPath),
        );
        cmdStr = cmdStr.replace(
          /\${fileDirname}/g,
          path.dirname(document.uri.fsPath),
        );
        cmdStr = cmdStr.replace(/\${fileExtname}/g, extName);
        cmdStr = cmdStr.replace(
          /\${fileBasenameNoExt}/g,
          path.basename(document.uri.fsPath, extName),
        );
        cmdStr = cmdStr.replace(/\${relativeFile}/g, relativeFile);
        cmdStr = cmdStr.replace(/\${cwd}/g, process.cwd());

        // replace environment variables ${env.Name}
        cmdStr = cmdStr.replace(
          /\${env\.([^}]+)}/g,
          (sub: string, envName: string) => {
            return process.env[envName];
          },
        );
      }

      let finishCallback: () => void;
      const finishPromise = new Promise<void>((resolve) => {
        finishCallback = resolve;
      });
      finishPromises.push(finishPromise);

      const rc: runCommandConfig = {
        cfg: {
          ...cfg,
          // Override with the command string that was processed with placeholders.
          cmd: cmdStr,
        },
        document: document,
        finishCallback: finishCallback,
      };

      if (rc.cfg.isAsync) {
        // Immediately kick off the async command.
        this._activeAsyncCommands++;
        this._runCommand(rc).then(() => {
          this._activeAsyncCommands--;
          this.refreshStatus();
        });
        continue;
      }

      this._enqueueSyncCommand(rc);
    }

    // Show message and elapsed time after all commands have finished for the saved document or notebook.
    // Note: this is fire-and-forget, allowing us to continue to process additional document saves.
    Promise.allSettled(finishPromises).then(() => {
      this.showOutputMessageIfDefined(this._config.messageAfter);

      const totalElapsedMs = performance.now() - startMs;
      this.showOutputMessageIfDefined(
        this._config.showElapsed && `Total elapsed ms: ${totalElapsedMs}`,
      );
    });
  }

}

