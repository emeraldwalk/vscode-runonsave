# Run On Save for Visual Studio Code

This extension allows configuring commands that get run whenever a file is saved in vscode.

NOTE: Commands only get run when saving an existing file. Creating new files, and Save as... don't trigger the commands.

## Features

- Configure multiple commands that run when a file is saved
- Regex pattern matching for files that trigger commands running
- Sync and async support

## Configuration

Add "emeraldwalk.runonsave" configuration to user or workspace settings.

- `shell` - (optional) shell path to be used with child_process.exec options that runs commands.
- `autoClearConsole` - (optional) clear VSCode output console every time commands run. Defaults to false.
- `message` - Message to output before all commands.
- `messageAfter` - Message to output after all commands have finished.
- `showElapsed` - Show total elapsed time after all commands have finished.
- `commands` - array of commands that will be run whenever a file is saved.
  - `match` - a regex for matching which files to run commands on (see [Notes on RegEx Options](#notes-on-regex-options)).
  - `notMatch` - a regex for matching which files **NOT** to run. Files that match this pattern take precedence over ones that match the `match` option (see [Notes on RegEx Options](#notes-on-regex-options)).
  - `cmd` - command to run. Can include parameters that will be replaced at runtime (see Placeholder Tokens section below).
  - `isAsync` (optional) - defaults to false. If true, next command will be run before this one finishes.
  - `message` - Message to output before this commands.
  - `messageAfter` - Message to output after this command has finished.
  - `showElapsed` - Show total elapsed time after this command.

### Notes on RegEx Options

The `match` and `notMatch` options expect RegEx patterns.

- The pattern will be run against the abolute file path. This means you usually don't want to start the pattern with `^` unless you are putting a full pattern to match the abolute path.

  e.g. Use `"match": "somefile\\.txt$"` instead of `"match": "^somefile\\.txt$"` if you are targetting `somefile.txt` in your workspace.

- Since settings are defined in `json`, backslashes have to be double escaped.

  e.g. If you were targetting a file path on a Windows system, you'd have to escape `\` once because it's a RegEx and a 2nd time since you are in a `json` string:
  `"match": "some\\\\folder\\\\.*"`

### Sample Configurations

#### All Files

```jsonc
{
  "emeraldwalk.runonsave": {
    "commands": [
      {
        // Run whenever any file is saved
        "match": ".*",
        "cmd": "echo '${fileBasename}' saved."
      }
    ]
  }
}
```

#### Specific File Extensions

```jsonc
{
  "emeraldwalk.runonsave": {
    "commands": [
      {
        // Run whenever html, css, or js files are saved
        "match": "\\.(html|css|js)$",
        "cmd": "echo '${fileBasename}' saved."
      }
    ]
  }
}
```

#### Exclude a File

```jsonc
{
  "emeraldwalk.runonsave": {
    "commands": [
      {
        // Match all html, css, and js files
        // except for `exclude-me.js`
        "match": "\\.(html|css|js)$",
        "notMatch": "exclude-me\\.js$",
        "cmd": "echo '${fileBasename}' saved."
      }
    ]
  }
}
```

#### Exclude .vscode Folder

```jsonc
{
  "emeraldwalk.runonsave": {
    "commands": [
      {
        // Match all .json files except for ones in
        // .vscode directory
        "match": "\\.json$",
        "notMatch": "\\.vscode/.*$",
        "cmd": "echo '${fileBasename}' saved."
      }
    ]
  }
}
```

#### Mix of Parallel + Sequential Commands

```jsonc
{
  "emeraldwalk.runonsave": {
    "commands": [
      {
        "match": ".*",
        // This tells next command to run immediately after
        // this one starts instead of waiting for it to complete
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
      },
      {
        "match": ".*",
        "cmd": "echo 'I am ${env.USERNAME}.'"
      }
    ]
  }
}
```

#### Messages

```jsonc
{
  "emeraldwalk.runonsave": {
    // Messages to show before & after all commands
    "message": "*** All Start ***",
    "messageAfter": "*** All Complete ***",
    // Show elappsed time for all commands
    "showElapsed": true,
    "commands": [
      {
        "match": ".*",
        "cmd": "echo 1st Command",
        // Messages to run before / after this cmd
        "message": "- 1. Start",
        "messageAfter": "- 1. Complete",
        // Show elapsed time for this cmd
        "showElapsed": true
      },
      {
        "message": "Message only"
      },
      {
        "match": ".*",
        "cmd": "echo 2nd Command",
        // Messages to run before / after this cmd
        "message": "- 2. Start",
        "messageAfter": "- 2. Complete",
        // Show elapsed time for this cmd
        "showElapsed": true
      }
    ]
  }
}
```

## Output of the commands

Please see the output in Output window and then switch the right side drop down to "Run On Save" to see the ouput of the commands stdout

## Commands

The following commands are exposed in the command palette:

- On Save: Enable
- On Save: Disable

## Placeholder Tokens

Commands support placeholders similar to tasks.json.

- ~~`${workspaceRoot}`~~: DEPRECATED use `${workspaceFolder}` instead
- `${workspaceFolder}`: the path of the workspace folder of the saved file
- `${file}`: path of saved file
- `${fileBasename}`: saved file's basename
- `${fileDirname}`: directory name of saved file
- `${fileExtname}`: extension (including .) of saved file
- `${fileBasenameNoExt}`: saved file's basename without extension
- `${relativeFile}` - the current opened file relative to `${workspaceFolder}`
- `${cwd}`: current working directory (this is the working directory that vscode is running in not the project directory)

### Environment Variable Tokens

- `${env.Name}`

## Links

- [Marketplace](https://marketplace.visualstudio.com/items/emeraldwalk.RunOnSave)
- [Source Code](https://github.com/emeraldwalk/vscode-runonsave)

## License

[Apache](https://github.com/emeraldwalk/vscode-runonsave/blob/master/LICENSE)
