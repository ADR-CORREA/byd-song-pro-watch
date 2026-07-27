/**
 * Vigia do BYD Song Pro flex 2027.
 *
 * Roda no GitHub Actions duas vezes por dia. Lê o caderno (novidades.json),
 * varre feeds de notícia e acrescenta APENAS o que ainda não está lá.
 * O caderno é append-only: nada existente é editado ou removido.
 *
 * Duas fontes de propósito: o Bing traz resumo de verdade e o link do site;
 * o Google News amplia a cobertura. Se uma cair, a outra segura o serviço.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const CADERNO = 'novidades.json';
const JANELA_DIAS = 10;     // ignora matéria mais velha que isso
const MAX_POR_RODADA = 8;   // trava contra enxurrada

const BUSCAS = [
  '"Song Pro" BYD flex',
  '"Song Pro" 2027 BYD',
  'BYD "Song Pro" preço lançamento',
  'BYD "Song Pro" pré-venda reserva',
  'BYD Camaçari Song Pro flex',
];

const UA = { 'User-Agent': 'Mozilla/5.0 (vigia-song-pro)' };

// ---------- texto ----------

const semAcento = s =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Desescapa entidades, depois remove tags. Nessa ordem — o inverso deixa HTML passar. */
const limpa = s => {
  const texto = s
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
  return texto.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
};

const tag = (bloco, nome) => {
  const m = bloco.match(new RegExp(`<${nome}[^>]*>([\\s\\S]*?)</${nome}>`, 'i'));
  return m ? limpa(m[1]) : '';
};

/** Assinatura para dedup por título: primeiras palavras significativas. */
const assinatura = titulo => {
  const stop = new Set(['de','da','do','das','dos','e','a','o','as','os','em','no','na','com','para','por','que','um','uma','ao','se','ja','tem','sera','the']);
  return semAcento(titulo)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(p => p.length > 2 && !stop.has(p))
    .slice(0, 6)
    .join('-');
};

/** Chave de dedup por endereço: host + caminho, sem www, sem query. */
const chaveUrl = url => {
  try {
    const u = new URL(url);
    return u.host.replace(/^www\./, '') + u.pathname.replace(/\/+$/, '');
  } catch {
    return url;
  }
};

const slug = titulo =>
  semAcento(titulo).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 45);

// ---------- classificação ----------

/**
 * O assunto tem que ser o carro, não um concorrente que cita o Song Pro de passagem
 * ("CAOA Chery corta R$ 10 mil do Tiggo 7 e pressiona Song Pro"). Exigir "byd" ou
 * "song" logo no começo do título separa manchete SOBRE o carro de menção lateral.
 */
const RUIDO = /seminov|semi-nov|usados?\b|leilao|consorcio|aluguel|locacao|financiamento de usados/;

const ehRelevante = titulo => {
  const t = semAcento(titulo);
  if (RUIDO.test(t)) return false;
  if (!t.includes('song pro') && !(t.includes('byd') && t.includes('camacari'))) return false;
  const inicio = t.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 4);
  return inicio.some(p => p === 'byd' || p === 'song');
};

const classificaTipo = (titulo, resumo, fonte) => {
  const t = semAcento(`${titulo} ${resumo}`);
  if (/(desconto|promoca|oferta|taxa zero|bonus|queima|abatimento)/.test(t)) return 'promocao';
  if (/^byd/.test(semAcento(fonte))) return 'oficial';
  return 'imprensa';
};

const classificaPeso = titulo => {
  const t = semAcento(titulo);
  return /(preco|precos|lancad|lancament|pre-venda|pre venda|reserva|chega|chegou|tabela|r\$|adiad|atras)/.test(t)
    ? 'alta'
    : 'media';
};

// ---------- fontes ----------

/** O Bing embute a URL real no parâmetro `url` do apiclick. */
const urlRealDoBing = link => {
  const m = link.match(/[?&]url=([^&]+)/);
  if (!m) return link;
  try { return decodeURIComponent(m[1]); } catch { return link; }
};

async function lerFeed(url, transforma) {
  try {
    const r = await fetch(url, { headers: UA });
    if (!r.ok) { console.error(`feed HTTP ${r.status}: ${url.slice(0, 60)}`); return []; }
    const xml = await r.text();
    return xml.split('<item>').slice(1).map(transforma).filter(i => i && i.titulo && i.link);
  } catch (e) {
    console.error(`feed falhou (${e.message}): ${url.slice(0, 60)}`);
    return [];
  }
}

const bing = q => lerFeed(
  `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=RSS&setmkt=pt-BR`,
  b => ({
    titulo: tag(b, 'title'),
    link: urlRealDoBing(tag(b, 'link')),
    pub: tag(b, 'pubDate'),
    resumo: tag(b, 'description'),
    fonte: '',
  }),
);

const googleNews = q => lerFeed(
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`,
  b => {
    const fonte = tag(b, 'source') || '';
    const bruto = tag(b, 'title');
    return {
      titulo: fonte ? bruto.replace(new RegExp(`\\s*-\\s*${fonte}\\s*$`, 'i'), '').trim() : bruto,
      link: tag(b, 'link'),
      pub: tag(b, 'pubDate'),
      resumo: '',   // o description do Google News é só o título repetido
      fonte,
    };
  },
);

/** Nome do veículo a partir do domínio, quando o feed não informa. */
const fonteDoLink = link => {
  try {
    const host = new URL(link).host.replace(/^www\./, '').replace(/\.(com|net|org)\.br$|\.(com|net|org)$|\.br$/, '');
    return host.split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  } catch {
    return 'Imprensa';
  }
};

// ---------- principal ----------

const caderno = JSON.parse(readFileSync(CADERNO, 'utf8'));

const urlsConhecidas = new Set(caderno.itens.map(i => chaveUrl(i.link)));
const assinaturasConhecidas = new Set(caderno.itens.map(i => assinatura(i.titulo)));
const idsUsados = new Set(caderno.itens.map(i => i.id));

const corte = Date.now() - JANELA_DIAS * 864e5;

// O Bing é a fonte titular: traz link direto do veículo e resumo de verdade.
// O Google News só entra se o Bing não responder — os links dele são redirecionadores
// do próprio Google, que atrapalham a deduplicação por endereço.
let brutos = (await Promise.all(BUSCAS.map(bing))).flat();
if (brutos.length === 0) {
  console.error('Bing não devolveu nada — caindo para o Google News');
  brutos = (await Promise.all(BUSCAS.map(googleNews))).flat();
}
console.log(`${brutos.length} resultados brutos`);

const novos = [];

for (const r of brutos) {
  if (!ehRelevante(r.titulo)) continue;

  const quando = new Date(r.pub);
  if (isNaN(quando) || quando.getTime() < corte) continue;

  const assin = assinatura(r.titulo);
  const chave = chaveUrl(r.link);
  if (urlsConhecidas.has(chave) || assinaturasConhecidas.has(assin)) continue;

  urlsConhecidas.add(chave);
  assinaturasConhecidas.add(assin);

  const data = quando.toISOString().slice(0, 10);
  let id = `${data}-${slug(r.titulo)}`;
  for (let n = 2; idsUsados.has(id); n++) id = `${data}-${slug(r.titulo)}-${n}`;
  idsUsados.add(id);

  const fonte = r.fonte || fonteDoLink(r.link);

  novos.push({
    id,
    data,
    tipo: classificaTipo(r.titulo, r.resumo, fonte),
    peso: classificaPeso(r.titulo),
    titulo: r.titulo,
    resumo: r.resumo.length > 60 ? r.resumo.slice(0, 500) : 'Sem resumo no feed — abra a matéria para ler.',
    fonte,
    link: r.link,
  });
}

novos.sort((a, b) => b.data.localeCompare(a.data));
const entram = novos.slice(0, MAX_POR_RODADA);
if (novos.length > entram.length) {
  console.log(`achei ${novos.length}, entrando as ${entram.length} mais recentes`);
}

caderno.itens = [...entram, ...caderno.itens];
caderno.atualizado_em = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

writeFileSync(CADERNO, JSON.stringify(caderno, null, 2) + '\n');

console.log(`NOVIDADES=${entram.length}`);
for (const i of entram) console.log(`  + [${i.data}] ${i.titulo} (${i.fonte})`);
