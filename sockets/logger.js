// sockets/logger.js

const winston = require('winston');
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE_MAX_SIZE = 100 * 1024 * 1024; // 100MB

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function checkAndRotateLog(filename) {
  const filepath = path.join(LOG_DIR, filename);
  try {
    const stats = fs.statSync(filepath);
    if (stats.size > LOG_FILE_MAX_SIZE) {
      fs.unlinkSync(filepath);
      console.error(`Rotated log file: ${filename}`);
    }
  } catch {
    // File doesn't exist yet — ignore
  }
}

checkAndRotateLog('error.log');
checkAndRotateLog('combined.log');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
    new winston.transports.File({ filename: path.join(LOG_DIR, 'error.log'), level: 'error', maxsize: LOG_FILE_MAX_SIZE, maxFiles: 1 }),
    new winston.transports.File({ filename: path.join(LOG_DIR, 'combined.log'), maxsize: LOG_FILE_MAX_SIZE, maxFiles: 1 }),
  ],
});

module.exports = logger;