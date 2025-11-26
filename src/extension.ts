import * as vscode from 'vscode';
import * as path from 'path';
import { exec } from 'child_process';
import type { ICommand, IConfig, IExecResult, Document, RunCommandConfig } from './model';

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

class RunOnSaveExtension implements vscode.Disposable {
  private _outputChannel: vscode.OutputChannel;
  private _context: vscode.ExtensionContext;
  private _config: IConfig;
  private _sbStatus?: vscode.StatusBarItem;
  private _commandQueue: Array<RunCommandConfig> = [];
  private _notifyWaitingCommandRunner?: () => void;
  private _activeSyncCommands: number = 0;
  private _activeAsyncCommands: number = 0;
  private _commandAbortController = new AbortController();
  private _disposed: boolean = false;

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
    this._outputChannel = vscode.window.createOutputChannel('Run On Save');
    this._context.subscriptions.push(this._outputChannel);
    this.loadConfig();
    this._commandRunnerLoop(); // starts the synchronous command runner loop.
    this.refreshStatus();
  }

  public dispose(): void {
    this.showOutputMessage('Disposing of Run On Save extension. Aborting all running commands and purging queue.');
    this._disposed = true; // Indicates that the runner loop should stop.
    this._abortAllRunningCommands();
    // In case the runner loop is waiting for a command, wake it so that it can stop.
    this._wakeCommandRunner();
  }

  public showOutputChannel(): void {
    this._outputChannel.show();
  }

  private _enqueueCommand(rc: RunCommandConfig): void {
    this._commandQueue.push(rc);
    this.refreshStatus();
    this._wakeCommandRunner();
  }

  /**
   * Loop that processes commands in FIFO order.
   */
  private async _commandRunnerLoop(): Promise<void> {
    while (!this._disposed) {
      const cmd = this._commandQueue.shift();
      if (!cmd) {
        const waitForNextCommandPromise = new Promise<void>((resolve) => {
          this._notifyWaitingCommandRunner = resolve;
        });
        this.refreshStatus();
        // Block loop until a command is added to the queue.
        await waitForNextCommandPromise;
        this.refreshStatus();
        continue;
      }

      this.refreshStatus();
      if (cmd.cfg.isAsync) {
        this._activeAsyncCommands++;
        this.refreshStatus();
        this._runCommand(cmd).then(() => {
          this._activeAsyncCommands--;
          this.refreshStatus();
        });
      } else {
        this._activeSyncCommands++;
        this.refreshStatus();
        await this._runCommand(cmd);
        this._activeSyncCommands--;
        this.refreshStatus();
      }
    }
  }

  private _onCmdComplete(rc: RunCommandConfig, res: IExecResult): void {
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
    rc: RunCommandConfig,
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
    rc: RunCommandConfig,
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

  private _wakeCommandRunner(): void {
    this._notifyWaitingCommandRunner?.()
    this._notifyWaitingCommandRunner = undefined;
  }

  private _abortAllRunningCommands(): void {
    // Clear pending commands.
    this._commandQueue = [];

    // Abort any existing commands.
    this._commandAbortController.abort();
    this._commandAbortController = new AbortController();
  }

  public async enable(): Promise<void> {
    if (this.isEnabled()) {
      // Already enabled.
      return;
    }

    await this._context.globalState.update('isEnabled', true);

    // Start the synchronous command runner loop.
    this.showOutputMessage();
    this.refreshStatus();
  }

  public async disable(): Promise<void> {
    await this._context.globalState.update('isEnabled', false);

    this.showOutputMessage("Disabling Run On Save. Aborting all running commands and purging queue.");
    this._abortAllRunningCommands();

    // Refresh the status bar.
    this.refreshStatus();
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

    let queuedCount = this._commandQueue.length;
    const asyncCount = this._activeAsyncCommands;
    const syncCount = this._activeSyncCommands;

    let state: 'Draining' | 'Disabled' | 'Idle' | 'Running';

    const atLeastOneCommandIsRunning =
      queuedCount !== 0 || syncCount !== 0 || asyncCount !== 0;

    if (!this.isEnabled()) {
      // If we are disabled but have unfinished commands, then we are "draining".
      state = atLeastOneCommandIsRunning ? 'Draining' : 'Disabled';
    } else {
      // If we are enabled but have no unfinished commands, then we are "idle".
      state = atLeastOneCommandIsRunning ? 'Running' : 'Idle';
    }

    const statsShort = `Q:${queuedCount},S:${syncCount},P:${asyncCount}`;
    const statsLong = `Queued: ${queuedCount}, Sequential: ${queuedCount} Parallel: ${asyncCount}`;

    const text = {
      Draining: `$(clock) ${statsShort}`,
      Disabled: '$(save) $(circle-slash)',
      Idle: `$(save) ${statsShort}`,
      Running: `$(loading~spin) ${statsShort}`,
    } as const;

    this._sbStatus.text = text[state];
    this._sbStatus.tooltip = `Run On Save: ${state}${
      state === 'Disabled' ? '' : `, Remaining commands: ${statsLong}`
    }`;
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

      const rc: RunCommandConfig = {
        cfg: {
          ...cfg,
          // Override with the command string that was processed with placeholders.
          cmd: cmdStr,
        },
        document,
        finishCallback,
      };

      this._enqueueCommand(rc);
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

