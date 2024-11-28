const { app, BrowserWindow, Tray, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const excelJS = require('exceljs');
const { exec } = require('child_process');

// Variables globales
let mainWindow;
let tray = null;
let screenTimeData = {}; // Pour stocker le temps d'écran par application
let configData = {}; // Pour stocker les paramètres de configuration

// Fonction pour créer la fenêtre principale
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Charger la configuration depuis un fichier JSON
function loadConfig() {
  const configPath = path.join(os.homedir(), 'Desktop', 'TempsEcranData', 'config.json');
  if (fs.existsSync(configPath)) {
    try {
      const rawData = fs.readFileSync(configPath, 'utf-8');
      if (rawData.trim() === '') {
        configData = {
          excelPath: 'F:\\I162\\nomduexcel.xlsx',
          blacklist: ['System', 'svchost.exe', 'explorer.exe', 'Idle']
        };
      } else {
        configData = JSON.parse(rawData);
      }
      console.log('Configuration chargée :', configData);
    } catch (error) {
      console.error('Erreur lors du chargement des données de configuration :', error);
      configData = {
        excelPath: 'F:\\I162\\nomduexcel.xlsx',
        blacklist: ['System', 'svchost.exe', 'explorer.exe', 'Idle']
      };
    }
  } else {
    configData = {
      excelPath: 'F:\\I162\\nomduexcel.xlsx',
      blacklist: ['System', 'svchost.exe', 'explorer.exe', 'Idle']
    };
  }
}

// Sauvegarder la configuration dans un fichier JSON
function saveConfig() {
  const configPath = path.join(os.homedir(), 'Desktop', 'TempsEcranData', 'config.json');
  try {
    fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));
    console.log('Configuration sauvegardée.');
  } catch (err) {
    console.error('Erreur lors de la sauvegarde de la configuration :', err);
  }
}

// Fonction pour charger les données de temps d'écran depuis le fichier JSON
function loadScreenTimeData() {
  const dataPath = getDataFilePath();
  if (fs.existsSync(dataPath)) {
    try {
      const rawData = fs.readFileSync(dataPath, 'utf-8');
      if (rawData.trim() === '') {
        screenTimeData = {};
      } else {
        screenTimeData = JSON.parse(rawData);
      }
      console.log('Données de temps d\'écran chargées :', screenTimeData);
    } catch (error) {
      console.error('Erreur lors du chargement des données de temps d\'écran :', error);
      screenTimeData = {};
    }
  } else {
    screenTimeData = {};
  }
}

// Fonction pour sauvegarder les données de temps d'écran dans un fichier JSON
function saveScreenTimeData() {
  const dataPath = getDataFilePath();
  try {
    fs.writeFileSync(dataPath, JSON.stringify(screenTimeData, null, 2));
    console.log('Données de temps d\'écran sauvegardées.');
  } catch (err) {
    console.error('Erreur lors de la sauvegarde des données de temps d\'écran :', err);
  }
}

// Fonction pour obtenir le chemin du fichier de données de temps d'écran
function getDataFilePath() {
  return path.join(os.homedir(), 'Desktop', 'TempsEcranData', 'screenTimeData.json');
}

// Fonction pour vérifier et créer le dossier pour Excel si nécessaire
function ensureExcelDirectoryExists() {
  const excelDir = path.dirname(configData.excelPath);
  if (!fs.existsSync(excelDir)) {
    fs.mkdirSync(excelDir, { recursive: true });
  }
}

// Fonction pour exporter les données dans un fichier Excel
function exportToExcel() {
  if (!isPathAccessible(configData.excelPath)) {
    console.error('Le chemin spécifié pour l\'exportation Excel n\'est pas accessible:', configData.excelPath);
    return;
  }

  ensureExcelDirectoryExists();

  const workbook = new excelJS.Workbook();
  const sheet = workbook.addWorksheet('Temps Écran');
  const currentDate = new Date().toLocaleDateString();

  sheet.columns = [
    { header: 'Application', key: 'app', width: 30 },
    { header: currentDate, key: 'time', width: 15 }
  ];

  for (const [app, data] of Object.entries(screenTimeData)) {
    const hours = Math.floor(data.time / 3600);
    const minutes = Math.floor((data.time % 3600) / 60);
    const decimalTime = hours + minutes / 60;

    if (!configData.blacklist.includes(app)) {
      sheet.addRow({ app, time: decimalTime.toFixed(2) });
    }
  }

  workbook.xlsx.writeFile(configData.excelPath).then(() => {
    console.log('Données exportées dans le fichier Excel.');
  }).catch(err => {
    console.error('Erreur lors de l\'exportation des données vers Excel :', err);
  });
}

// Fonction pour surveiller les applications en cours
function trackScreenTime() {
  exec('tasklist', (err, stdout, stderr) => {
    if (err) {
      console.error(`Erreur : ${stderr}`);
      return;
    }

    const lines = stdout.split('\n');
    lines.forEach(line => {
      const parts = line.split(/\s+/);
      if (parts.length > 1) {
        const processName = parts[0];
        if (processName !== 'Image' && !configData.blacklist.includes(processName)) {
          const currentTime = Date.now();
          if (!screenTimeData[processName]) {
            screenTimeData[processName] = { time: 0, lastChecked: currentTime };
          } else {
            const deltaTime = (currentTime - screenTimeData[processName].lastChecked) / 1000;
            screenTimeData[processName].time += deltaTime;
          }
          screenTimeData[processName].lastChecked = currentTime;
        }
      }
    });

    saveScreenTimeData();
  });
}

// Fonction pour configurer l'auto-démarrage
function setupAutoLaunch() {
  const AutoLaunch = require('auto-launch');
  let autoLauncher = new AutoLaunch({
    name: 'TempsEcran',
    isHidden: true
  });

  autoLauncher.isEnabled()
    .then((isEnabled) => {
      if (!isEnabled) {
        autoLauncher.enable();
      }
    })
    .catch((err) => {
      console.error('Erreur AutoLaunch:', err);
    });
}

app.on('ready', () => {
  loadConfig(); 
  loadScreenTimeData(); 

  createWindow(); 

  setInterval(trackScreenTime, 10000);

  tray = new Tray(path.join(__dirname, 'tray-icon.png'));
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Quitter', click: () => { app.quit(); } }
  ]);
  tray.setContextMenu(contextMenu);
  tray.setToolTip('Suivi du temps d\'écran');

  setupAutoLaunch();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Gestion des événements IPC
ipcMain.handle('get-config', () => {
  return configData; 
});

ipcMain.handle('save-config', (event, newConfig) => {
  configData = { ...configData, ...newConfig };
  saveConfig();
  return configData;
});
