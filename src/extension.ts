import * as vscode from 'vscode';
import * as path from 'path';
import {exec} from 'child_process';

export function activate(context: vscode.ExtensionContext): void {

	var extension = new RunOnSaveExtension(context);
	extension.showStatusMessage();

	vscode.commands.registerCommand('extension.emeraldwalk.enableRunOnSave', () => {
		extension.isEnabled = true;
	});

	vscode.commands.registerCommand('extension.emeraldwalk.disableRunOnSave', () => {
		extension.isEnabled = false;
	});

	vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
		extension.runCommands(document);
	});
}

interface ICommand {
	match?: string;
	cmd: string;
	isAsync: boolean;
}

interface IConfig {
	commands: Array<ICommand>;
}

class RunOnSaveExtension {
	private _outputChannel: vscode.OutputChannel;
	private _context: vscode.ExtensionContext;
	private _config: IConfig;

	constructor(context: vscode.ExtensionContext) {
		this._context = context;
		this._config = <IConfig><any>vscode.workspace.getConfiguration('emeraldwalk.runonsave');
		this._outputChannel = vscode.window.createOutputChannel('Run On Save');
	}

	/** Recursive call to run commands. */
	private _runCommands(commands: Array<ICommand>): void {
		if (commands.length) {
			var cfg = commands.shift();

			this.showStatusMessage(`*** cmd start: ${cfg.cmd}`);

			var child = exec(cfg.cmd);
			child.stdout.on('data', data => this._outputChannel.append(data));
			child.stderr.on('data', data => this._outputChannel.append(data));
			child.on('exit', (e) => {
				// if sync
				if (!cfg.isAsync) {
					this._runCommands(commands);
				}
			});

			// if async, go ahead and run next command
			if (cfg.isAsync) {
				this._runCommands(commands);
			}
		}
	}

	public get isEnabled(): boolean {
		return !!this._context.globalState.get('isEnabled', true);
	}
	public set isEnabled(value: boolean) {
		this._context.globalState.update('isEnabled', value);
		this.showStatusMessage();
	}

	public showStatusMessage(message?: string): void {
		message = message || `Run On Save ${this.isEnabled ? 'enabled': 'disabled'}.`;
		this._outputChannel.appendLine(message);
		vscode.window.setStatusBarMessage(message);
	}

	public runCommands(document: vscode.TextDocument): void {
		if(!this.isEnabled) {
			this.showStatusMessage();
			return;
		}

		var commandConfigs = (this._config.commands || [])
			.filter(cfg => new RegExp(cfg.match).test(document.fileName));

		if (commandConfigs.length === 0) {
			this._outputChannel.show();
			this.showStatusMessage('No run on save commands configured.');
			return;
		}

		this.showStatusMessage('Running on save commands...');

		// build our commands by replacing parameters with values
		var commands: Array<ICommand> = [];
		for (let cfg of commandConfigs) {
			var cmdStr = cfg.cmd;

			cmdStr = cmdStr.replace(/\${file}/g, `${document.fileName}`);
			cmdStr = cmdStr.replace(/\${workspaceRoot}/g, `${vscode.workspace.rootPath}`);
			cmdStr = cmdStr.replace(/\${fileBasename}/g, `${path.basename(document.fileName) }`);
			cmdStr = cmdStr.replace(/\${fileDirname}/g, `${path.dirname(document.fileName) }`);
			cmdStr = cmdStr.replace(/\${fileExtname}/g, `${path.extname(document.fileName) }`);
			cmdStr = cmdStr.replace(/\${cwd}/g, `${process.cwd() }`);

			commands.push({
				cmd: cmdStr,
				isAsync: !!cfg.isAsync
			});
		}

		this._runCommands(commands);
	}
}