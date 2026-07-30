import { config as loadDotenv } from 'dotenv';
import { app, BrowserWindow, shell } from 'electron';
import express from 'express';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join, resolve } from 'node:path';
import { createApp, loadEnvironment } from '@security-log-analyzer/api';

let mainWindow: BrowserWindow | undefined;
let localServer: Server | undefined;

app.setName('Security Log Analyzer');
app.setPath('userData', join(app.getPath('appData'), 'Security Log Analyzer'));

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow === undefined) {
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.focus();
  });

  void startDesktopApplication();
}

async function startDesktopApplication(): Promise<void> {
  await app.whenReady();
  await loadUserConfiguration();

  localServer = await startLocalServer();
  const address = localServer.address();

  if (address === null || typeof address === 'string') {
    throw new Error('The local application server did not receive a TCP address.');
  }

  mainWindow = createMainWindow(`http://127.0.0.1:${address.port}`);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && localServer !== undefined) {
      const activeAddress = localServer.address() as AddressInfo;
      mainWindow = createMainWindow(`http://127.0.0.1:${activeAddress.port}`);
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    localServer?.close();
  });
}

async function loadUserConfiguration(): Promise<void> {
  const configurationDirectory = join(app.getPath('userData'), 'config');
  const configurationFile = join(configurationDirectory, '.env');

  await mkdir(configurationDirectory, { recursive: true });
  await writeFile(
    configurationFile,
    '# Optional AI analysis configuration. Keep this file private.\nOPENAI_API_KEY=\nOPENAI_MODEL=gpt-4.1-mini\n',
    { encoding: 'utf8', flag: 'wx' },
  ).catch((error: unknown) => {
    if (isAlreadyExistsError(error)) {
      return;
    }

    throw error;
  });

  loadDotenv({ path: configurationFile, quiet: true });
}

async function startLocalServer(): Promise<Server> {
  const webDirectory = await getWebDirectory();
  const environment = loadEnvironment({
    ...process.env,
    CORS_ALLOWED_ORIGINS: '',
    HOST: '127.0.0.1',
    REQUEST_LOGGING_ENABLED: 'false',
    UPLOAD_STORAGE_DIR: join(app.getPath('userData'), 'uploads'),
  });
  const httpApp = createApp(environment);

  httpApp.use(express.static(webDirectory, { index: false }));
  httpApp.get('/{*path}', (request, response, next) => {
    if (request.path.startsWith('/api/')) {
      response
        .status(404)
        .json({ error: { code: 'NOT_FOUND', message: 'The route was not found.' } });
      return;
    }

    response.sendFile('index.html', { root: webDirectory }, (error) => {
      if (error !== undefined) {
        next(error);
      }
    });
  });

  const server = createServer(httpApp);

  await new Promise<void>((resolveServer, rejectServer) => {
    server.once('error', rejectServer);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', rejectServer);
      resolveServer();
    });
  });

  return server;
}

async function getWebDirectory(): Promise<string> {
  const webDirectory = app.isPackaged
    ? join(process.resourcesPath, 'web')
    : resolve(__dirname, '../../web/dist');

  await stat(join(webDirectory, 'index.html'));
  return webDirectory;
}

function createMainWindow(applicationUrl: string): BrowserWindow {
  const window = new BrowserWindow({
    backgroundColor: '#0a0f16',
    height: 900,
    minHeight: 640,
    minWidth: 980,
    title: 'Security Log Analyzer',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    width: 1440,
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalHttpUrl(url)) {
      void shell.openExternal(url);
    }

    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (url !== applicationUrl && isExternalHttpUrl(url)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  void window.loadURL(applicationUrl);
  return window;
}

function isAlreadyExistsError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST';
}

function isExternalHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
