const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    title: "OmniTrace ERP",
    // Ruta corregida para el icono de la ventana
    icon: path.join(__dirname, '../public/inicio.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false, // Permite cargar las imágenes locales
      devTools: true
    }
  });

  // Si estamos en desarrollo
  if (process.env.npm_lifecycle_event === 'electron:dev') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    // En producción (instalado)
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    mainWindow.setMenuBarVisibility(false);
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});