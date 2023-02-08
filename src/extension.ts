import * as vscode from 'vscode';
import * as path from 'path';
import {exec} from 'child_process';

export function activate(context: vscode.ExtensionContext): void {

	var extension = new RunOnSaveExtension(context);
	extension.showOutputMessage();

	vscode.workspace.onDidChangeConfiguration(() => {
		let disposeStatus = vscode.window.setStatusBarMessage('Run On Save: Reloading config.', 1000);
		extension.loadConfig();
		disposeStatus.dispose();
	});

	vscode.commands.registerCommand('extension.the-codesmith.enableRunOnSave', () => {
		extension.isEnabled = true;
	});

	vscode.commands.registerCommand('extension.the-codesmith.disableRunOnSave', () => {
		extension.isEnabled = false;
	});

	vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
		extension.runCommands(document);
	});
}

interface ICommand {
	match?: string;
	notMatch?: string;
	cmd: string;
	isAsync: boolean;
}

interface IConfig {
	shell: string;
	autoClearConsole: boolean;
	commands: Array<ICommand>;
	statusBarMessage: string;
}

class RunOnSaveExtension {
	private _outputChannel: vscode.OutputChannel;
	private _context: vscode.ExtensionContext;
	private _config: IConfig | undefined;
	private _statusBarItem: vscode.StatusBarItem;
	private _statusBarItemTimer: NodeJS.Timeout | undefined;

	constructor(context: vscode.ExtensionContext) {
		this._context = context;
		this._outputChannel = vscode.window.createOutputChannel('Run On Save');
		this._statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 999)
		this.loadConfig();
	}

	/** Recursive call to run commands. */
	private _runCommands(
		commands: Array<ICommand>,
		document: vscode.TextDocument
	): void {
		if (commands.length) {
			var cfg = commands.shift()!;

			this.showOutputMessage(`*** cmd start: ${cfg.cmd}`);

			var child = exec(cfg.cmd, this._getExecOption(document));
			child.stdout.on('data', data => this._outputChannel.append(data));
			child.stderr.on('data', data => this._outputChannel.append(data));
			child.on('error', (e) => {
				this.showOutputMessage(e.message);
			});
			child.on('exit', (e) => {
				// if sync
				if (!cfg.isAsync) {
					this._runCommands(commands, document);
				}
			});

			// if async, go ahead and run next command
			if (cfg.isAsync) {
				this._runCommands(commands, document);
			}
		}
		else {
			// NOTE: This technically just marks the end of commands starting.
			// There could still be asyc commands running.
			vscode.window.setStatusBarMessage('Run on Save done.', 1000);
		}
	}

	private _getExecOption(
		document: vscode.TextDocument
	): {shell: string, cwd: string} {
		return {
			shell: this.shell,
			cwd: this._getWorkspaceFolderPath(document.uri) ?? '',
		};
	}

	private _getWorkspaceFolderPath(
		uri: vscode.Uri
	) {
		const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);

		// NOTE: rootPath seems to be deprecated but seems like the best fallback so that
		// single project workspaces still work. If I come up with a better option, I'll change it.
		return workspaceFolder
			? workspaceFolder.uri.fsPath
			: vscode.workspace.rootPath;
	}

	private hideStatusMessage() {
		this._statusBarItemTimer = setTimeout(() => {
				this._statusBarItem.hide()
			}, 2000);
	}

	public get isEnabled(): boolean {
		return !!this._context.globalState.get('isEnabled', true);
	}
	public set isEnabled(value: boolean) {
		this._context.globalState.update('isEnabled', value);
		this.showOutputMessage();
	}

	public get shell(): string {
		return this._config?.shell ?? '';
	}

	public get autoClearConsole(): boolean {
		return !!this._config?.autoClearConsole ?? false;
	}

	public get commands(): Array<ICommand> {
		return this._config?.commands || [];
	}

	public loadConfig(): void {
		this._config = <IConfig><any>vscode.workspace.getConfiguration('the-codesmith.runonsave');
	}

	/**
	 * Show message in output channel
	 */
	public showOutputMessage(message?: string): void {
		message = message || `Run On Save ${this.isEnabled ? 'enabled': 'disabled'}.`;
		this._outputChannel.appendLine(message);
	}

	/**
	 * Show message in status bar and output channel.
	 * Return a disposable to remove status bar message.
	 */
	public async showStatusMessage(message: string) {
		this._statusBarItem.text = message;
		this._statusBarItem.color = new vscode.ThemeColor('statusBarItem.prominentForeground');
		this._statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
		this._statusBarItem.show();

		if (this._statusBarItemTimer) {
			clearTimeout(this._statusBarItemTimer);
		}

		await this.hideStatusMessage();
	}

	public runCommands(document: vscode.TextDocument): void {
		if(this.autoClearConsole) {
			this._outputChannel.clear();
		}

		if (this._config?.statusBarMessage) {
			this.showStatusMessage(this._config.statusBarMessage);
		}

		if(!this.isEnabled || this.commands.length === 0) {
			this.showOutputMessage();
			return;
		}

		var match = (pattern: string) => pattern && pattern.length > 0 && new RegExp(pattern).test(document.fileName);

		var commandConfigs = this.commands
			.filter(cfg => {
				var matchPattern = cfg.match || '';
				var negatePattern = cfg.notMatch || '';

				// if no match pattern was provided, or if match pattern succeeds
				var isMatch = matchPattern.length === 0 || match(matchPattern);

				// negation has to be explicitly provided
				var isNegate = negatePattern.length > 0 && match(negatePattern);

				// negation wins over match
				return !isNegate && isMatch;
			});

		if (commandConfigs.length === 0) {
			return;
		}

		vscode.window.setStatusBarMessage('Running on save commands...', 1000)

		// build our commands by replacing parameters with values
		const commands: Array<ICommand> = [];
		for (const cfg of commandConfigs) {
			let cmdStr = cfg.cmd;

			const extName = path.extname(document.fileName);
			const workspaceFolderPath = this._getWorkspaceFolderPath(document.uri) ?? '.';
			const relativeFile = path.relative(
				workspaceFolderPath,
				document.uri.fsPath
			);

			cmdStr = cmdStr.replace(/\${file}/g, `${document.fileName}`);

			// DEPRECATED: workspaceFolder is more inline with vscode variables,
			// but leaving old version in place for any users already using it.
			cmdStr = cmdStr.replace(/\${workspaceRoot}/g, workspaceFolderPath);

			cmdStr = cmdStr.replace(/\${workspaceFolder}/g, workspaceFolderPath);
			cmdStr = cmdStr.replace(/\${fileBasename}/g, path.basename(document.fileName));
			cmdStr = cmdStr.replace(/\${fileDirname}/g, path.dirname(document.fileName));
			cmdStr = cmdStr.replace(/\${fileExtname}/g, extName);
			cmdStr = cmdStr.replace(/\${fileBasenameNoExt}/g, path.basename(document.fileName, extName));
			cmdStr = cmdStr.replace(/\${relativeFile}/g, relativeFile);
			cmdStr = cmdStr.replace(/\${cwd}/g, process.cwd());

			// replace environment variables ${env.Name}
			cmdStr = cmdStr.replace(/\${env\.([^}]+)}/g, (sub: string, envName: string) => process.env[envName] ?? '');

			commands.push({
				cmd: cmdStr,
				isAsync: !!cfg.isAsync
			});
		}

		this._runCommands(commands, document);
	}
}
