export interface ICommand {
  match?: string;
  notMatch?: string;
  cmd?: string;
  message?: string;
  messageAfter?: string;
  isAsync: boolean;
  showElapsed: boolean;
}

export interface IConfig {
  shell: string;
  autoClearConsole: boolean;
  commands: Array<ICommand>;
}
