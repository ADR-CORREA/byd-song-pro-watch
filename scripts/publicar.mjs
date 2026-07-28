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

// ---------- 3. plano B: HTML mínimo, sem JavaScript ----------

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const seguro = u => /^https?:\/\//i.test(String(u)) ? esc(u) : '#';

const simples = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Novidades — Song Pro Flex</title>
<style>
body{background:#0d1117;color:#e6edf3;font-family:system-ui,-apple-system,sans-serif;
font-size:15px;line-height:1.5;margin:0;padding:16px}
h1{font-size:18px;margin:0 0 4px}
.q{color:#8b949e;font-size:13px;margin-bottom:20px}
article{border-top:1px solid #30363d;padding:14px 0}
h2{font-size:16px;margin:0 0 6px;font-weight:600}
.m{color:#8b949e;font-size:12px;margin-bottom:6px}
p{margin:0 0 8px;color:#c9d1d9}
a{color:#58a6ff}
</style></head><body>
<h1>BYD Song Pro Flex 2027</h1>
<div class="q">Última verificação: ${esc(caderno.atualizado_em.replace('T', ' ').replace('Z', ' UTC'))}<br>
Versão leve, sem recursos. <a href="./">Abrir a página completa</a></div>
${caderno.itens.map(i => `<article>
<div class="m">${esc(dataBr(i.data))} · ${esc(i.tipo)} · ${esc(i.fonte)}</div>
<h2>${esc(i.titulo)}</h2>
<p>${esc(i.resumo)}</p>
<a href="${seguro(i.link)}" rel="noopener">Abrir matéria</a>
</article>`).join('\n')}
<article><div class="m">BYD Vega</div>
<p>Macapá <a href="https://wa.me/5591993027475">(91) 99302-7475</a><br>
Belém <a href="https://wa.me/5591991603645">(91) 99160-3645</a></p></article>
</body></html>
`;

writeFileSync('texto.html', simples);

console.log(`publicado: ${caderno.itens.length} itens em index.html, texto.html e NOVIDADES.md`);
