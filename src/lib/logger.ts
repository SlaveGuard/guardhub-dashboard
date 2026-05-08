type Level = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';

const ORDER: Level[] = ['DEBUG', 'INFO', 'WARNING', 'ERROR'];

const raw = (import.meta.env.VITE_LOG_LEVEL ?? 'ERROR').toUpperCase() as Level;
const minIndex = ORDER.includes(raw) ? ORDER.indexOf(raw) : ORDER.indexOf('ERROR');

function shouldLog(level: Level): boolean {
  return ORDER.indexOf(level) >= minIndex;
}

function format(level: Level, tag: string, msg: string, meta?: unknown): string {
  const ts = new Date().toISOString();
  return `[${ts}] [${level}] [${tag}] ${msg}${meta !== undefined ? ` ${JSON.stringify(meta)}` : ''}`;
}

export const logger = {
  debug: (tag: string, msg: string, meta?: unknown) => {
    if (shouldLog('DEBUG')) console.debug(format('DEBUG', tag, msg, meta));
  },
  info: (tag: string, msg: string, meta?: unknown) => {
    if (shouldLog('INFO')) console.info(format('INFO', tag, msg, meta));
  },
  warning: (tag: string, msg: string, meta?: unknown) => {
    if (shouldLog('WARNING')) console.warn(format('WARNING', tag, msg, meta));
  },
  error: (tag: string, msg: string, meta?: unknown) => {
    if (shouldLog('ERROR')) console.error(format('ERROR', tag, msg, meta));
  },
};
