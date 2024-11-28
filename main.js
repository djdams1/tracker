const { app, BrowserWindow, Tray, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const excelJS = require('exceljs');
const { exec } = require('child_process');

// Variables globales
let mainWindow;
let tray = null;
let screenTimeData = [];  // Contient les données des processus, avec le temps
let lastReportDate = '';  // Pour stocker la date du dernier fichier Excel généré

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

// Fonction pour récupérer les données des processus en cours
async function getScreenTimeData() {
  try {
    const psList = await import('ps-list'); // Cette ligne remplace require()
    const processes = await psList.default();  // Utilisez .default() pour accéder à la fonction ps-list()

    if (processes.length === 0) {
      console.log('Aucun processus trouvé.');
    }

    processes.forEach(process => {
      const { name, pid, started } = process;

      console.log(`Nom: ${name}, PID: ${pid}, Date de démarrage: ${started}`);

      if (started === undefined) {
        console.warn(`Le processus ${name} (${pid}) n'a pas de date de démarrage définie.`);
      }

      const startTime = started !== undefined ? new Date(started).getTime() : Date.now();  
      const currentTime = Date.now();
      const elapsedTimeInSeconds = Math.floor((currentTime - startTime) / 1000);  

      const existingProcess = screenTimeData.find(app => app.pid === pid);

      if (existingProcess) {
        existingProcess.elapsedTime += 1;  
      } else {
        screenTimeData.push({
          name,
          pid,
          elapsedTime: elapsedTimeInSeconds
        });
      }
    });

    console.log('Données des processus mises à jour :', screenTimeData);

    return screenTimeData;
  } catch (error) {
    console.error('Erreur lors de la récupération des données des processus:', error);
    return [];
  }
}

// Fonction pour créer un fichier Excel avec les données récupérées
async function createExcelReport(data) {
  try {
    const workbook = new excelJS.Workbook();
    const worksheet = workbook.addWorksheet('ScreenTimeData');

    worksheet.columns = [
      { header: 'Application', key: 'name', width: 30 },
      { header: 'Elapsed Time (seconds)', key: 'elapsedTime', width: 25 },
    ];

    data.forEach((app) => {
      worksheet.addRow(app);
    });

    // Chemin vers le dossier sur le bureau
    const desktopPath = path.join(os.homedir(), 'Desktop');
    const reportFolderPath = path.join(desktopPath, 'ScreenTimeReports');

    // Vérifier si le dossier existe, sinon le créer
    if (!fs.existsSync(reportFolderPath)) {
      fs.mkdirSync(reportFolderPath);
      console.log('Dossier "ScreenTimeReports" créé sur le bureau.');
    }

    // Créer un nom de fichier unique basé sur la date actuelle
    const today = new Date();
    const dateString = today.toISOString().split('T')[0];  // Format YYYY-MM-DD
    const filePath = path.join(reportFolderPath, `ScreenTimeData_${dateString}.xlsx`);

    await workbook.xlsx.writeFile(filePath);
    console.log(`Données sauvegardées dans le fichier Excel à l'emplacement: ${filePath}`);
  } catch (error) {
    console.error('Erreur lors de la création du fichier Excel:', error);
  }
}

// Fonction principale
async function main() {
  const today = new Date().toISOString().split('T')[0];  

  if (today !== lastReportDate) {
    console.log('Changement de date, création d\'un nouveau fichier Excel.');
    lastReportDate = today;
    screenTimeData = [];  

    await createExcelReport(screenTimeData);
  }

  setInterval(async () => {
    await getScreenTimeData();
    await createExcelReport(screenTimeData);
  }, 1000); 
}

// Appel de la fonction principale après le démarrage de l'application Electron
app.on('ready', () => {
  createWindow();
  main();

  tray = new Tray(path.join(__dirname, 'tray-icon.png'));
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Quitter', click: () => { app.quit(); } }
  ]);
  tray.setContextMenu(contextMenu);
  tray.setToolTip('Suivi du temps d\'écran');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('get-config', () => {
  return {};  
});

ipcMain.handle('save-config', (event, newConfig) => {
  return newConfig;  
});
