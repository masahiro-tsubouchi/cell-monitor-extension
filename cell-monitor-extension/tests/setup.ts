// Jest setup file for JupyterLab extension testing

// Mock JupyterLab modules for testing
jest.mock('@jupyterlab/application', () => ({
  JupyterFrontEnd: jest.fn(),
  JupyterFrontEndPlugin: jest.fn(),
}));

jest.mock('@jupyterlab/settingregistry', () => ({
  ISettingRegistry: jest.fn(),
}));

jest.mock('@jupyterlab/notebook', () => ({
  INotebookTracker: jest.fn(),
  NotebookPanel: jest.fn(),
}));

jest.mock('@jupyterlab/cells', () => ({
  CodeCell: jest.fn(),
  Cell: jest.fn(),
}));

jest.mock('@jupyterlab/apputils', () => ({
  showErrorMessage: jest.fn(),
  Notification: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  },
}));
