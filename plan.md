# 📝 Extension Blueprint (vscode-runonsave)

## 🚀 Objective

- 🔥 Fork `vscode-runonsave` (https://github.com/emeraldwalk/vscode-runonsave) to create a custom extension with minimal modifications.
- 🔍 Replace the `onSave` trigger with `onDidOpenTextDocument` and `onDidChangeTextDocument` events.
- 🔊 Implement throttling to prevent excessive task execution.
- 🚀 Ensure the extension operates locally without publishing.

## 📊 Functional Requirements

- 📜 Listen to `onDidOpenTextDocument` and `onDidChangeTextDocument` events.
- 🔊 Implement a throttling mechanism to limit task execution frequency.
- 🔍 Execute a Git pull task when the events are triggered.
- 🔊 Maintain the original extension's structure and naming conventions as much as possible.

## 📋 Technical Plan

- 📜 Fork the original repository and clone it locally.
- 🔊 Modify the event listeners in the main extension file to use `onDidOpenTextDocument` and `onDidChangeTextDocument` instead of `onSave`.
- 🔊 Implement a throttling function to prevent tasks from running too frequently.
- 🔊 Ensure the Git pull task is executed correctly when the events are triggered.
- 🔊 Test the extension locally to verify functionality.

## 📜 Installation Instructions

1. 📜 Clone the forked repository to your local machine.
2. 🔊 Open the repository in VS Code.
3. 🔊 Run the extension in development mode by pressing F5.
4. 🔊 Test the extension to ensure it functions as expected.
5. 🔊 Package the extension using `vsce` and install it locally if desired.

## 📜 Additional Considerations

- 🔊 Maintain the original extension's structure to simplify future updates from the upstream repository.
- 🔊 Document any changes made to the original code for clarity.
- 🔊 Consider contributing back to the original repository if the changes are beneficial to others.
