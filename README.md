# Run On Save for Visual Studio Code
This extension allows configuring commands that get run whenever a file is saved in vscode.

NOTE: Commands only get run when saving an existing file. Creating new files, and Save as... don't trigger the commands.

## Features
* Configure multiple commands that run when a file is saved
* Regex pattern matching for files that trigger commands running
* Sync and async support

## Configuration
Add "emeraldwalk.runonsave" configuration to user or workspace settings.
* "commands" - array of commands that will be run whenever a file is saved.
  * "match" - a regex for matching which files to run commands on
  * "cmd" - command to run. Can include parameters that will be replaced at runtime (see Placeholder Tokens section below).
  * "isAsync" (optional) - defaults to false. If true, next command will be run before this one finishes.

### Sample Config
This sample configuration will run echo statements including the saved file path.
In this sample, the first command is async, so the second command will get executed immediately even if first hasn't completed.
Since the second isn't async, the third command won't execute until the second is complete.

    "emeraldwalk.runonsave": {
		"commands": [
			{
				"match": ".*",
				"isAsync": true,
				"cmd": "echo 'I run for all files.'"
			},
			{
				"match": "\\.txt$",
				"cmd": "echo 'I am a .txt file ${file}.'"
			},
			{
				"match": "\\.js$",
				"cmd": "echo 'I am a .js file ${file}.'"
			}
		]
	}

## Commands
The following commands are exposed in the command palette:
* On Save: Enable
* On Save: Disable

## Placeholder Tokens
Commands support placeholders similar to tasks.json.

* ${workspaceRoot}: workspace root folder
* ${file}: path of saved file
* ${fileBasename}: saved file's basename
* ${fileDirname}: directory name of saved file
* ${fileExtname}: extension (including .) of saved file
* ${cwd}: current working directory

## Links
* [Marketplace](https://marketplace.visualstudio.com/items/emeraldwalk.RunOnSave)
* [Source Code](https://github.com/emeraldwalk/vscode-runonsave)

## License
[Apache](https://github.com/emeraldwalk/vscode-runonsave/blob/master/LICENSE)