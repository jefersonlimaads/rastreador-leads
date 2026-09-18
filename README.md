# Rastreador de leads — JL Ads

Liga cada mensagem recebida no WhatsApp ao anúncio que a gerou, e devolve ao Meta o
lead e a venda. Lead, aqui, é mensagem recebida: clique no botão da landing page é
clique, não lead.

Funil coberto: anúncio → landing page → WhatsApp, sem CRM do lado do cliente.

## Como o rastreamento funciona

1. O script `jl.js` na landing page gera um código curto (ex. `NF4T9`) e grava o
   clique com UTMs, `ad_id`, `fbclid`, `_fbp` e `_fbc`.
2. O mesmo código entra na mensagem pré-preenchida do `wa.me`.
3. Quem atende cola a mensagem no painel; o sistema lê o código e casa o lead com
   o clique (atribuição **exata**).
4. Sem código, o sistema sugere o clique mais recente dentro de 30 minutos do
   horário da mensagem (atribuição **provável**). Sem isso, **desconhecida**.
5. Ao cadastrar, sai o evento `Lead` pela API de Conversões. Ao fechar com valor,
   sai o `Purchase`.

O MVP é manual: o sistema não lê o WhatsApp. O banco já tem `origem = WEBHOOK`
para receber a Cloud API depois sem refazer estrutura.

## Rodar localmente

Precisa de Node 22 ou mais novo. Neste Mac ele está em `~/.local/node`, já no PATH
do terminal.

```bash
npm install
npm run db:start   # Postgres local em localhost:5433, sem Docker, dados em .db-local/
npm run db:migrate # cria as tabelas
npm run db:seed    # cliente e usuários de teste
npm run dev        # http://localhost:3000
```

Logins criados pelo seed:

| E-mail | Senha | Papel |
| --- | --- | --- |
| admin@jl.ads | jlads2026 | Administrador (vê todos os clientes) |
| atendente@clientedemo.com | jlads2026 | Atendente do Cliente Demo |

Para parar o banco: `npm run db:stop`. Para abrir o banco numa interface:
`npm run db:studio`.

O administrador vê um seletor de cliente no topo do painel. A escolha fica num
cookie e vale em todas as telas. Gestor e atendente ficam presos ao próprio
cliente, e isso é conferido no servidor a cada consulta.

Depois de aplicar migration, reinicie o `npm run dev`: o servidor mantém em
memória o cliente do Prisma anterior e passa a acusar campo inexistente.

## Testes

```bash
npm test
```

São 19 testes. Os de código e telefone rodam sozinhos; os de atribuição precisam
do banco local no ar (`npm run db:start`) e cobrem os critérios de aceite do
escopo: código na mensagem gerando atribuição exata, dois anúncios no mesmo dia,
janela de 30 minutos contada pelo horário da mensagem, retorno de telefone,
reabertura depois de 60 dias e clique sem contato em 24 horas. Eles usam um
cliente próprio no banco e limpam tudo no fim.

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

| Variável | Para que serve |
| --- | --- |
| `DATABASE_URL` | Postgres. Local no desenvolvimento, Supabase em produção |
| `AUTH_SECRET` | Assina o cookie de sessão. Gere com `openssl rand -base64 32` |
| `APP_URL` | Domínio público do painel, usado no snippet do script |
| `CRON_SECRET` | Protege a rotina diária em `/api/cron/sincronizar` |

As credenciais do Meta (pixel, token da API de Conversões, token da API de
Marketing e conta de anúncios) ficam **por cliente**, no banco, cadastradas em
Ajustes. Use token de usuário do sistema da Business Manager da JL Ads, nunca
token pessoal.

## Instalar na landing page do cliente

Em Ajustes, cada cliente mostra o snippet pronto. Ele fica antes de `</body>`:

```html
<script async src="https://SEU-DOMINIO/jl.js"
        data-cliente="ID_DO_CLIENTE"
        data-numero="5511999999999"
        data-servico="orçamento"></script>
```

O script acha sozinho os links de `wa.me` da página. Para um botão que não é link,
marque com `data-jl-whatsapp`. Nas UTMs da campanha, use as macros do Meta para não
depender de nomenclatura manual:

```
?utm_source=facebook&utm_medium=cpc&utm_campaign={{campaign.name}}
&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}
```

## Estrutura

| Caminho | O que é |
| --- | --- |
| `public/jl.js` | Script da landing page |
| `src/app/api/clique` | Recebe o clique (CORS liberado, sem preflight) |
| `src/app/api/cron/sincronizar` | Rotina diária: gasto, reenvio de eventos, cliques sem contato |
| `src/app/(painel)` | Telas Carteira, Negócio, Hoje, Pipeline, Leads, Anúncios e Ajustes |
| `src/lib/atribuicao.ts` | Regras 1 a 5 e 12: casar lead com clique, retorno, reabertura |
| `src/lib/metricas.ts` | CPL, CAC e ROAS |
| `src/lib/meta/capi.ts` | API de Conversões, com auditoria em `envios_capi` |
| `src/lib/meta/marketing.ts` | Gasto por anúncio e por dia |
| `src/lib/regras.ts` | Os números das regras (janelas, prazos) e os rótulos |
| `src/lib/financeiro.ts` | Fee, faturas e receita recorrente da jl.ads |
| `src/lib/confirmacao.ts` | Confirmação em lote pelo cliente, via link sem senha |
| `src/app/confirmar/[token]` | Página que o cliente abre para responder |
| `src/lib/retencao.ts` | Descarte por retenção: lead sem interação há 24 meses, clique sem contato há 12 |
| `prisma/schema.prisma` | Modelo de dados, com `clienteId` em todas as tabelas |

## Deploy na Vercel com Supabase

1. Crie o projeto no Supabase (região São Paulo). As strings de conexão ficam no
   botão **Connect**, no topo da página do projeto: use a aba **Transaction
   pooler** (6543) para a aplicação e a **Session pooler** (5432) para as
   migrations. No plano free, a Direct connection é só IPv6 e costuma falhar em
   rede doméstica.
2. Suba o repositório e importe na Vercel, com a raiz apontando para `rastreador/`.
3. Defina `DATABASE_URL`, `AUTH_SECRET`, `APP_URL` e `CRON_SECRET` nas variáveis da
   Vercel.
4. Rode as migrations contra o Supabase: `npx prisma migrate deploy`.
5. Crie o administrador rodando o seed uma vez e troque a senha depois.
6. O `vercel.json` já agenda a rotina diária às 9h.

Backup: no Supabase, backup diário automático. Teste a restauração uma vez antes de
colocar cliente de verdade.

## Métricas

- CPL = gasto do período ÷ leads do período
- CAC = gasto do período ÷ leads fechados do período
- ROAS = soma das vendas ÷ gasto do período

O lead entra no período em que foi criado, e a venda entra no período do lead, não
no do fechamento. Leads com atribuição exata ou provável contam no anúncio;
desconhecida conta só no total do cliente. A sincronização rebusca os últimos 7
dias, porque o Meta revisa o gasto depois do fechamento do dia.
