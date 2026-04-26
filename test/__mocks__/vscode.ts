// Mock VS Code API for unit tests

const vscode = {
  window: {
    createOutputChannel: (_name: string) => ({
      appendLine: (_msg: string) => {},
      append: (_msg: string) => {},
      show: () => {},
      dispose: () => {},
    }),
    showInformationMessage: (_msg: string, ..._rest: string[]) => Promise.resolve(undefined),
    showWarningMessage: (_msg: string, ..._rest: string[]) => Promise.resolve(undefined),
    showErrorMessage: (_msg: string, ..._rest: string[]) => Promise.resolve(undefined),
    setStatusBarMessage: (_msg: string, _duration?: number) => ({ dispose: () => {} }),
    createStatusBarItem: () => ({
      text: '',
      tooltip: '',
      command: '',
      color: undefined,
      backgroundColor: undefined,
      show: () => {},
      hide: () => {},
      dispose: () => {},
    }),
    activeTextEditor: undefined,
    showInputBox: (_options: unknown) => Promise.resolve(undefined),
    showQuickPick: (_items: unknown, _options?: unknown) => Promise.resolve(undefined),
  },
  workspace: {
    getConfiguration: (_section?: string) => ({
      get: <T>(_key: string, defaultValue?: T): T | undefined => defaultValue,
      update: (_key: string, _value: unknown) => Promise.resolve(),
    }),
    onDidSaveTextDocument: (_handler: unknown) => ({ dispose: () => {} }),
  },
  languages: {
    registerHoverProvider: (_lang: unknown, _provider: unknown) => ({ dispose: () => {} }),
    registerCodeLensProvider: (_lang: unknown, _provider: unknown) => ({ dispose: () => {} }),
    createDiagnosticCollection: (_name: string) => ({
      set: (_uri: unknown, _diagnostics: unknown[]) => {},
      delete: (_uri: unknown) => {},
      clear: () => {},
      get: (_uri: unknown) => [],
      dispose: () => {},
    }),
  },
  commands: {
    registerCommand: (_id: string, _handler: unknown) => ({ dispose: () => {} }),
    executeCommand: (_id: string, ..._args: unknown[]) => Promise.resolve(),
  },
  env: {
    openExternal: (_uri: unknown) => Promise.resolve(true),
  },
  Uri: {
    parse: (str: string) => ({ toString: () => str }),
    joinPath: (...parts: unknown[]) => ({ toString: () => parts.join('/') }),
    file: (path: string) => ({ toString: () => path, fsPath: path }),
  },
  Range: class {
    constructor(
      public start: { line: number; character: number },
      public end: { line: number; character: number }
    ) {}
  },
  Position: class {
    constructor(public line: number, public character: number) {}
  },
  Diagnostic: class {
    public code: unknown;
    public source: unknown;
    constructor(
      public range: unknown,
      public message: string,
      public severity: number
    ) {}
  },
  DiagnosticSeverity: {
    Error: 0,
    Warning: 1,
    Information: 2,
    Hint: 3,
  },
  MarkdownString: class {
    public isTrusted = false;
    public supportHtml = false;
    private content = '';
    constructor(_value?: string) {}
    appendMarkdown(value: string) { this.content += value; return this; }
    appendText(value: string) { this.content += value; return this; }
    toString() { return this.content; }
  },
  ThemeColor: class {
    constructor(public id: string) {}
  },
  StatusBarAlignment: { Left: 1, Right: 2 },
  ViewColumn: { Beside: 2, One: 1, Two: 2, Three: 3 },
  EventEmitter: class {
    event = (_listener: unknown) => ({ dispose: () => {} });
    fire(_event?: unknown) {}
    dispose() {}
  },
  Hover: class {
    constructor(public contents: unknown, public range?: unknown) {}
  },
  CodeLens: class {
    constructor(public range: unknown, public command?: unknown) {}
  },
};

export default vscode;
module.exports = vscode;
