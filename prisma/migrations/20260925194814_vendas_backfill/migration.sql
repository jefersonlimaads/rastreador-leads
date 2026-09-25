-- O valor único que já estava no lead vira a primeira venda dele.
-- Sem isso, lead fechado antes de hoje teria total sem histórico, e a tela de
-- vendas apareceria vazia para quem já vendeu.
--
-- Condicional ao lead ainda não ter venda: assim a migração pode rodar de novo
-- sem duplicar faturamento, que é o erro caro aqui.
INSERT INTO "Venda" ("id", "clienteId", "leadId", "valor", "fechadoEm")
SELECT gen_random_uuid()::text, l."clienteId", l."id", l."valorVenda", COALESCE(l."fechadoEm", l."criadoEm")
FROM "Lead" l
WHERE l."valorVenda" IS NOT NULL
  AND l."valorVenda" > 0
  AND NOT EXISTS (SELECT 1 FROM "Venda" v WHERE v."leadId" = l."id");
