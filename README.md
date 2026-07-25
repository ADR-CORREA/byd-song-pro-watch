# Vigia do BYD Song Pro Flex 2027

Caderno de bordo de um agente que verifica, **todo dia às 10h e às 18h (horário de Macapá)**, se saiu alguma novidade sobre o lançamento do BYD Song Pro flex (linha 2027) no Brasil.

Página de leitura: **https://adr-correa.github.io/byd-song-pro-watch/**

## Como funciona

- `novidades.json` — o caderno. Só cresce: cada novidade nova entra no topo e **nada é apagado ou reescrito**. Assim, uma novidade que apareceu num dia continua lá esperando, mesmo que ninguém abra a página por uma semana.
- `index.html` — a página. Marca o que já foi lido no `localStorage` do próprio aparelho, então o "não lido" é individual de quem lê, não do arquivo.

## Contrato do agente (não quebrar)

1. **Ler `novidades.json` antes de pesquisar.** Tudo que já está lá é passado — não vira novidade de novo.
2. **Só acrescentar o que for realmente novo.** Mesma notícia com outro título, ou repetição do que já está no caderno, não entra.
3. **Nunca editar nem remover item existente.** O arquivo é append-only. A única coisa que se atualiza é o campo `atualizado_em`.
4. **Não achou nada?** Atualiza só o `atualizado_em` e commita. Dia sem novidade é resultado legítimo — não é para inventar movimento.

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
