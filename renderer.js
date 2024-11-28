const fs = require('fs');
const path = require('path');

// Charger les données de suivi
const usageFilePath = path.join(__dirname, 'app-usage.json');

// Met à jour l'interface utilisateur avec les données actuelles
function updateAppList() {
  const appListElement = document.getElementById('app-list');
  appListElement.innerHTML = '';

  if (fs.existsSync(usageFilePath)) {
    const appUsage = JSON.parse(fs.readFileSync(usageFilePath, 'utf8'));

    for (const [appName, seconds] of Object.entries(appUsage)) {
      const listItem = document.createElement('li');
      listItem.textContent = `${appName}: ${seconds} secondes`;
      appListElement.appendChild(listItem);
    }
  }
}

// Rafraîchir la liste toutes les secondes
setInterval(updateAppList, 1000);
updateAppList();
