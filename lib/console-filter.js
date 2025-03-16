// Save original console methods
const originalConsoleLog = console.log;
const originalConsoleInfo = console.info;

// Check if the message contains Fast Refresh text
const isFastRefreshMessage = (args) => {
  if (!args || args.length === 0) return false;
  
  const firstArg = String(args[0]);
  return firstArg.includes('[Fast Refresh]');
};

// Override console.log to filter unwanted messages
console.log = function(...args) {
  if (!isFastRefreshMessage(args)) {
    originalConsoleLog.apply(console, args);
  }
};

// Override console.info to filter unwanted messages 
console.info = function(...args) {
  if (!isFastRefreshMessage(args)) {
    originalConsoleInfo.apply(console, args);
  }
}; 