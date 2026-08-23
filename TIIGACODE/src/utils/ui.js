const wrap = (code) => (s) => `[${code}m${s}[0m`;

export const colors = {
  bold: wrap('1'),
  dim: wrap('2'),
  red: wrap('31'),
  green: wrap('32'),
  yellow: wrap('33'),
  blue: wrap('34'),
  magenta: wrap('35'),
  cyan: wrap('36'),
};

export function banner() {
  return [
    `${colors.cyan(colors.bold('TIIGACODE'))}${colors.dim('  — multi-model coding agent')}`,
    colors.dim('พิมพ์ /help เพื่อดูคำสั่ง, /exit เพื่อออก'),
  ].join('\n');
}
