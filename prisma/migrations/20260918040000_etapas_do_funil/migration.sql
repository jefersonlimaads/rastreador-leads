-- Renomear preserva os leads que já estavam nessa etapa; recriar o tipo os perderia.
ALTER TYPE "StatusLead" RENAME VALUE 'ORCAMENTO_ENVIADO' TO 'PROPOSTA_ENVIADA';

-- Etapa nova entre proposta e fechamento, que é onde o lead costuma ficar parado.
ALTER TYPE "StatusLead" ADD VALUE 'NEGOCIANDO' AFTER 'PROPOSTA_ENVIADA';
