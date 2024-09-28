export interface IMessageConfig {
  message?: string;
  messageAfter?: string;
  showElapsed: boolean;
}

export interface ICommand extends IMessageConfig {
  match?: string;
  notMatch?: string;
  cmd?: string;
  isAsync: boolean;
}

export interface IConfig extends IMessageConfig {
  shell: string;
  autoClearConsole: boolean;
  commands: Array<ICommand>;
}
