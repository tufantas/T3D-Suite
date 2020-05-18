import 'core-js/stable';
import 'regenerator-runtime/runtime';
import { app, Menu, BrowserWindow } from 'electron';
import Store from 'electron-store';
import { configureWindow } from './electron-app/window';
import getMenuTemplate from './electron-app/Menu';
import launchServer from './server-cli';
import DataStorage from './DataStorage';
import pkg from './package.json';


const config = new Store();

let windowInstance = null;
let lastURL = null;

function getBrowserWindowOptions() {
    const defaultOptions = {
        width: 1280,
        height: 768,
        show: false,
        // set the title bar style
        titleBarStyle: 'hiddenInset',
        // set the background color to black
        backgroundColor: "#111",
        title: `${pkg.name} ${pkg.version}`
    };

    // { x, y, width, height }
    const windowBounds = config.get('winBounds');

    return Object.assign({}, defaultOptions, windowBounds);
}


function openBrowserWindow(url) {
    const options = getBrowserWindowOptions();
    const window = new BrowserWindow(options);

    configureWindow(window);

    // Ignore proxy settings
    // https://electronjs.org/docs/api/session#sessetproxyconfig-callback
    const session = window.webContents.session;
    session.setProxy({ proxyRules: 'direct://' }, () => {
        window.loadURL(url);
        window.show();
    });

    return window;
}

const onReady = async () => {
    try {
        // TODO: parse command arguments
        // TODO: create server
        // TODO: start services
        DataStorage.init();

        const data = await launchServer();

        const { address, port, routes } = { ...data };

        // Menu
        const template = getMenuTemplate({ address, port, routes });
        const menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(menu);

        const url = `http://${address}:${port}`;
        windowInstance = openBrowserWindow(url);

        lastURL = url;
        windowInstance.maximize();
    } catch (err) {
        console.error('Error: ', err);
    }
};

const main = () => {
    // https://github.com/electron/electron/blob/master/docs/api/app.md#apprequestsingleinstancelock
    /*
    // Electron 4
    const gotTheLock = app.requestSingleInstanceLock();

    if (!gotTheLock) {
        app.quit();
        return;
    }

    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        if (!windowManager) {
            return;
        }

        const myWindow = windowManager.getWindow();
        if (myWindow) {
            if (myWindow.isMinimized()) {
                myWindow.restore();
            }
            myWindow.focus();
        }
    });
    */

    // Electron 2
    // Allow multiple instances for controlling more machines
    /*
    const shouldQuit = app.makeSingleInstance(() => {
        if (window) {
            if (window.isMinimized()) {
                window.restore();
            }
            window.focus();
        }
    });

    if (shouldQuit) {
        app.quit();
        return;
    }
    */
    // Allow max 4G memory usage
    if (process.arch === 'x64') {
        app.commandLine.appendSwitch('--js-flags', '--max-old-space-size=4096');
    }

    app.commandLine.appendSwitch('ignore-gpu-blacklist');

    // https://github.com/electron/electron/blob/master/docs/api/app.md#event-ready
    // Emitted once, when Electron has finished initializing.
    app.on('ready', onReady);

    // https://github.com/electron/electron/blob/master/docs/api/app.md#event-activate-os-x
    // Emitted when the application is activated, which usually happens
    // when the user clicks on the application's dock icon.
    app.on('activate', () => {
        if (!windowInstance) {
            windowInstance = openBrowserWindow(lastURL);
        }
    });

    // https://github.com/electron/electron/blob/master/docs/api/app.md#event-window-all-closed
    // Emitted when all windows have been closed.
    // This event is only emitted when the application is not going to quit.
    // If the user pressed Cmd + Q, or the developer called app.quit(), Electron
    // will first try to close all the windows and then emit the will-quit event,
    // and in this case the window-all-closed event would not be emitted.
    app.on('window-all-closed', () => {
        app.quit();
    });

    app.on('will-quit', () => {
        DataStorage.clear();
        config.set('winBounds', windowInstance.getBounds());
        windowInstance = null;
    });
};

main();
