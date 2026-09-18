-- Etapa manual entre o envio e a resposta: o lead leu e vocês estão conversando.
ALTER TYPE "StatusProposta" ADD VALUE 'NEGOCIANDO' AFTER 'ENVIADA';

-- Acompanhamento: quando retomar o contato e o que já foi dito.
ALTER TABLE "Proposta" ADD COLUMN "proximoContato" DATE;
ALTER TABLE "Proposta" ADD COLUMN "notas" TEXT;
