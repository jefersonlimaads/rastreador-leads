-- O default existia só para a janela de deploy da camada de agência. Com o
-- código novo no ar, todo registro informa a agência; um padrão aqui jogaria
-- em silêncio o dado de uma agência dentro da jl.ads.
ALTER TABLE "Cliente" ALTER COLUMN "agenciaId" DROP DEFAULT;
ALTER TABLE "Usuario" ALTER COLUMN "agenciaId" DROP DEFAULT;
ALTER TABLE "Tarefa" ALTER COLUMN "agenciaId" DROP DEFAULT;
