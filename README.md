# Vigia do BYD Song Pro Flex 2027

Caderno de bordo de um agente que verifica, **todo dia às 10h e às 18h (horário de Macapá)**, se saiu alguma novidade sobre o lançamento do BYD Song Pro flex (linha 2027) no Brasil.

Página de leitura: **https://adr-correa.github.io/byd-song-pro-watch/**

## Como funciona

- `.github/workflows/vigia.yml` — dispara às 13h e 21h UTC (10h e 18h em Macapá). Roda dentro do GitHub, com permissão de escrita nativa: não depende de credencial externa nenhuma.
- `scripts/vigia.mjs` — o motor. Lê o caderno, varre feeds de notícia, filtra e acrescenta só o que é novo. Node puro, zero dependências.
- `novidades.json` — o caderno. Só cresce: cada novidade entra no topo e **nada é apagado ou reescrito**. Uma novidade que apareceu num dia continua lá esperando, mesmo que ninguém abra a página por uma semana.
- `index.html` — a página. Marca o que já foi lido no `localStorage` do próprio aparelho, então o "não lido" é de quem lê, não do arquivo.

## Contrato (não quebrar)

1. **Ler `novidades.json` antes de buscar.** Tudo que já está lá é passado — não vira novidade de novo.
2. **Só acrescentar o que for realmente novo.** Dedup por endereço da matéria e por assinatura de título, para a mesma notícia não entrar duas vezes com manchetes diferentes.
3. **Nunca editar nem remover item existente.** O arquivo é append-only. Só o campo `atualizado_em` muda sempre.
4. **Dia sem novidade é resultado legítimo.** Atualiza o `atualizado_em`, commita e pronto — não é para inventar movimento.

## Filtros do motor

- **Fonte:** Bing News RSS (link direto do veículo e resumo real). O Google News só entra se o Bing não responder — os links dele são redirecionadores que atrapalham a deduplicação.
- **Relevância:** o título precisa falar do Song Pro *e* ter "BYD" ou "Song" nas primeiras palavras. Isso descarta manchete de concorrente que cita o carro de passagem ("Tiggo 7 pressiona Song Pro").
- **Ruído:** anúncio de seminovo, leilão, consórcio e locação fica de fora.
- **Janela:** 10 dias. **Teto:** 8 itens por rodada.

## Formato de cada item

```json
{
  "id": "2026-08-03-preco-oficial",
  "data": "2026-08-03",
  "tipo": "oficial | imprensa | promocao | referencia | rumor",
  "peso": "alta | media | baixa",
  "titulo": "Manchete curta e direta",
  "resumo": "2 a 4 frases. Números concretos, sem enrolação.",
  "fonte": "Nome do veículo",
  "link": "https://..."
}
```

`id` = data mais um slug curto, sempre único. `data` = data de publicação da notícia (ISO), não a data em que o agente achou.
