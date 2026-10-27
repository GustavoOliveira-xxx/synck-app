// Os SVG são os originais. O registro evita ler arquivos ou interpretar XML a cada renderização no celular.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'app-mobile');
const directory = join(root, 'assets', 'icons');
const output = join(root, 'src', 'components', 'icons.generated.json');
const icons = {};
for (const file of readdirSync(directory).filter((f) => f.endsWith('.svg')).sort()) {
  const svg = readFileSync(join(directory, file), 'utf8');
  const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1];
  if (!viewBox || /<(?:image|script|foreignObject|use)\b|https?:\/\/(?!www.w3.org)/.test(svg)) {
    throw new Error('SVG inválido ou dependente de recurso externo: ' + file);
  }
  const paths = [...svg.matchAll(/<path\s+([^>]+)\/>/g)].map(([, attributes]) => {
    const d = attributes.match(/\bd="([^"]+)"/)?.[1];
    if (!d) throw new Error('Traçado vazio: ' + file);
    return {
      d,
      fill: attributes.match(/\bfill="([^"]+)"/)?.[1] ?? 'none',
      stroke: attributes.match(/\bstroke="([^"]+)"/)?.[1] ?? 'currentColor',
    };
  });
  if (!paths.length || svg.replace(/<path\s+[^>]+\/>/g, '').match(/<(?!\/?svg\b)/)) {
    throw new Error('Use somente paths vetoriais: ' + file);
  }
  icons[file.slice(0, -4)] = { viewBox, paths };
}
const json = JSON.stringify(icons, null, 2) + '\n';
if (process.argv.includes('--verificar')) {
  if (readFileSync(output, 'utf8').replaceAll('\r\n', '\n') !== json) {
    throw new Error('SVG e registro nativo divergentes. Rode npm run icons:build em app-mobile.');
  }
} else {
  writeFileSync(output, json);
}
console.log(Object.keys(icons).length + ' SVG conferidos para Android e web.');
