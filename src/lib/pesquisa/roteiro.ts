/**
 * Roteiro da tarefa do Cowork: o texto que você cola no Cowork para ele
 * pesquisar no Google Maps, analisar e mandar os prospects para cá.
 */
export function roteiroCowork(p: { url: string; chave: string; agencia: string; assinatura: string }) {
  const exemplo = JSON.stringify(
    {
      nicho: "clínica de estética",
      cidade: "Campinas, SP",
      notaMinima: 50,
      empresas: [
        {
          nome: "Nome da empresa",
          categoria: "Clínica de estética",
          telefone: "(19) 99999-9999",
          site: "https://site.com.br",
          instagram: "perfil",
          endereco: "Rua, número - Bairro, Cidade - UF",
          mapsUrl: "https://maps.google.com/...",
          notaGoogle: 4.8,
          avaliacoes: 120,
          pontuacao: 72,
          resumo: "Uma frase: quem é e a principal oportunidade.",
          gaps: ["Gap concreto 1", "Gap concreto 2"],
          briefing: "Tópicos curtos para quem vai abordar.",
          mensagem: "Primeira mensagem de WhatsApp, pronta para enviar.",
        },
      ],
    },
    null,
    2,
  );

  return `Você vai prospectar clientes para a ${p.agencia}, agência de tráfego pago (Meta Ads e Google Ads) e marketing criativo.

PARÂMETROS DESTA RODADA (troque a cada vez):
- Nicho: [ex.: clínica de estética]
- Cidade: [ex.: Campinas, SP]
- Quantidade: [até 20]

PASSO 1 — Buscar no Google Maps
Abra no Chrome: https://www.google.com/maps/search/[nicho]+em+[cidade]
Para cada resultado, até a quantidade, abra a ficha e anote: nome, categoria, telefone, site, endereço, nota (estrelas), número de avaliações e o link da ficha.
Pule: redes e franquias grandes, serviços públicos (UBS, posto de saúde, hospital público) e quem estiver "fechado permanentemente".

PASSO 2 — Olhar o site (quando houver)
Abra o site e veja: tem botão de WhatsApp? Tem formulário? Qual o @ do Instagram (link no rodapé)? É uma página de links (Linktree) em vez de site?
NÃO abra perfis do Instagram um atrás do outro: isso pode bloquear a conta. Use só o @ que aparece no site ou no Google.

PASSO 3 — Analisar e escrever
Para cada empresa:
- pontuacao (0 a 100): chance de contratar gestão de tráfego agora. Negócio que já vende (bem avaliado, muitas avaliações) e tem presença digital fraca vale mais. Quem já parece anunciar com estrutura completa vale menos. Sem telefone, vale menos.
- resumo: uma frase.
- gaps: até 4, concretos, só do que você viu de verdade.
- briefing: tópicos curtos — contexto, gaps, gancho da primeira mensagem, objeções prováveis, próximo passo.
- mensagem de WhatsApp: até 450 caracteres, tom de conversa entre profissionais, cite UM gap de forma gentil, ofereça uma conversa de 10 minutos e termine com uma pergunta simples. Assine como "${p.assinatura}". Sem "Prezado", sem prometer resultado, no máximo um emoji.
NUNCA invente dados: o que não encontrar, deixe vazio. A plataforma confere o site de novo.

PASSO 4 — Enviar para a plataforma
Monte um JSON neste formato (até 50 empresas por envio):
${exemplo}

Salve como prospects.json e envie com:
curl -X POST ${p.url}/api/prospects/importar -H "Authorization: Bearer ${p.chave}" -H "Content-Type: application/json" --data @prospects.json

Se não conseguir rodar comandos: abra ${p.url}/prospeccao no Chrome → "Buscar prospects automaticamente" → aba "Colar lista", preencha nicho e cidade e cole o JSON inteiro no campo da lista → "Analisar lista".

No fim, me diga quantas empresas foram enviadas e o link "acompanhar" da resposta.`;
}
