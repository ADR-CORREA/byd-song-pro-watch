/**
 * Publica o caderno em dois formatos, para nunca depender de um só caminho:
 *   1. index.html — com os dados EMBUTIDOS no bloco #dados (a página não busca nada
 *      pela rede depois de carregar).
 *   2. NOVIDADES.md — texto puro, abre em qualquer navegador, celular fraco ou
 *      conexão ruim. É o plano B.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const caderno = JSON.parse(readFileSync('novidades.json', 'utf8'));

// ---------- 1. injetar na página ----------

// "<" vira escape para que nenhum título possa fechar a tag <script> antes da hora.
const embutido = JSON.stringify(caderno).replace(/</g, '\\u003c');

const html = readFileSync('index.html', 'utf8');
const marca = /(<script id="dados" type="application\/json">)[\s\S]*?(<\/script>)/;

if (!marca.test(html)) {
  console.error('bloco #dados não encontrado no index.html');
  process.exit(1);
}

writeFileSync('index.html', html.replace(marca, `$1${embutido}$2`));

// ---------- 2. versão em texto ----------

const dataBr = iso => iso.split('-').reverse().join('/');

const linhas = [
  '# Novidades — BYD Song Pro flex 2027',
  '',
  `Última verificação: ${caderno.atualizado_em.replace('T', ' ').replace('Z', ' UTC')}`,
  '',
  'Página completa (com marcação de lido): https://adr-correa.github.io/byd-song-pro-watch/',
  '',
  'BYD Vega Macapá: (91) 99302-7475 — Belém: (91) 99160-3645',
  '',
  '---',
  '',
];

for (const i of caderno.itens) {
  linhas.push(`## ${dataBr(i.data)} — ${i.titulo}`, '');
  linhas.push(`*${i.tipo} · ${i.fonte}*`, '');
  linhas.push(i.resumo, '');
  linhas.push(`[Abrir matéria](${i.link})`, '', '---', '');
}

writeFileSync('NOVIDADES.md', linhas.join('\n'));

console.log(`publicado: ${caderno.itens.length} itens no index.html e no NOVIDADES.md`);
