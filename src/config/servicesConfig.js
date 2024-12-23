const fs = require('fs');
const path = require('path');

const servicesConfigPath = path.resolve(__dirname, 'services.json');

let services;
try {
  const configFile = fs.readFileSync(servicesConfigPath, 'utf-8');
  services = JSON.parse(configFile);
} catch (error) {
  console.error('Error loading services configuration:', error.message);
  process.exit(1);
}

module.exports = services;