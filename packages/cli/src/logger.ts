import winston from 'winston';

const level = process.env.LOG_LEVEL || 'info';

export const logger = winston.createLogger({
  level: level,
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console({
      silent: true // By default silent until configured
    })
  ]
});

export function configureLogger(options: { verbose?: boolean; silent?: boolean }) {
  // If verbose is requested, use debug level. Otherwise use env LOG_LEVEL or info.
  const logLevel = options.verbose ? 'debug' : (process.env.LOG_LEVEL || 'info');
  logger.level = logLevel;
  
  // Update transport
  const consoleTransport = logger.transports.find(t => t instanceof winston.transports.Console);
  if (consoleTransport) {
      if (options.verbose) {
          // Always show if verbose
          consoleTransport.silent = false; 
      } else {
        // If not verbose, behavior depends on interpretation.
        // Interpretation: 'activate console output only if --verbose' logic 
        // implies we might want silence by default?
        // But user wants "pertinent information". 
        // I will assume pertinent info is INFO level, and we want to see it by default.
        // IF the instruction strictly means "logger off unless verbose":
        //   consoleTransport.silent = true;
        // BUT that would hide pertinent info.
        // Let's implement: "Verbose activates DEBUG/VERBOSE traces. INFO is always pertinent."
        // I'll leave silent=false by default in configure unless explicitly silenced.
        consoleTransport.silent = false;
      }
  }
}
