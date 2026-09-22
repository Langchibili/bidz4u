const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const CURRENT_LOG_LEVEL = __DEV__ ? LOG_LEVELS.debug : LOG_LEVELS.info;

class Logger {
  private prefix: string = '[OkraRides]';

  debug(message: string, ...args: any[]) {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.debug) {
      console.log(`${this.prefix} 🐛 [DEBUG]`, message, ...args);
    }
  }

  info(message: string, ...args: any[]) {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.info) {
      console.log(`${this.prefix} ℹ️ [INFO]`, message, ...args);
    }
  }

  warn(message: string, ...args: any[]) {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.warn) {
      console.warn(`${this.prefix} ⚠️ [WARN]`, message, ...args);
    }
  }

  error(message: string, ...args: any[]) {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.error) {
      console.error(`${this.prefix} ❌ [ERROR]`, message, ...args);
    }
  }
}

export const logger = new Logger();