const getTimestamp = () => new Date().toISOString();

const logger = {
  info: (message, meta = {}) => {
    console.log(JSON.stringify({ timestamp: getTimestamp(), level: 'INFO', message, ...meta }));
  },
  warn: (message, meta = {}) => {
    console.warn(JSON.stringify({ timestamp: getTimestamp(), level: 'WARN', message, ...meta }));
  },
  error: (message, meta = {}) => {
    console.error(JSON.stringify({ timestamp: getTimestamp(), level: 'ERROR', message, ...meta }));
  },
  debug: (message, meta = {}) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(JSON.stringify({ timestamp: getTimestamp(), level: 'DEBUG', message, ...meta }));
    }
  },
};

module.exports = logger;

