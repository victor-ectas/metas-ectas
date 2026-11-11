-- CreateEnum
CREATE TYPE "perfil" AS ENUM ('ADMIN', 'DIRETORIA', 'GESTOR', 'LEITOR');

-- CreateEnum
CREATE TYPE "status_ciclo" AS ENUM ('RASCUNHO', 'ATIVO', 'ENCERRADO');

-- CreateEnum
CREATE TYPE "tipo_feriado" AS ENUM ('NACIONAL', 'ESTADUAL', 'MUNICIPAL', 'EMPRESA');

-- CreateEnum
CREATE TYPE "tipo_variavel" AS ENUM ('NUMERO', 'PERCENTUAL', 'MOEDA', 'DIAS', 'HORAS', 'SIM_NAO');

-- CreateEnum
CREATE TYPE "acumulacao" AS ENUM ('SOMA', 'MEDIA', 'ULTIMO', 'MAXIMO');

-- CreateEnum
CREATE TYPE "origem_variavel" AS ENUM ('DIGITADA', 'IMPORTADA');

-- CreateEnum
CREATE TYPE "modo_apuracao" AS ENUM ('FORMULA_SOBRE_ACUMULADOS', 'SOMA_RESULTADOS', 'MEDIA_RESULTADOS', 'MAXIMO_RESULTADOS', 'ULTIMO_RESULTADO');

-- CreateEnum
CREATE TYPE "operador" AS ENUM ('GE', 'LE', 'EQ', 'FAIXA');

-- CreateEnum
CREATE TYPE "regra_pontuacao" AS ENUM ('TUDO_OU_NADA', 'PROPORCIONAL');

-- CreateEnum
CREATE TYPE "unidade" AS ENUM ('PERCENTUAL', 'NUMERO', 'DIAS', 'HORAS', 'MOEDA', 'SIM_NAO');

-- CreateEnum
CREATE TYPE "origem_lancamento" AS ENUM ('DIGITACAO', 'IMPORTACAO', 'CARGA_HISTORICA', 'CORRECAO');

-- CreateEnum
CREATE TYPE "escopo_reabertura" AS ENUM ('TODOS', 'SETOR', 'GESTOR');

-- CreateEnum
CREATE TYPE "situacao" AS ENUM ('BATIDA', 'ABAIXO', 'FORA_DA_FAIXA', 'SEM_DADOS');

-- CreateEnum
CREATE TYPE "bloco" AS ENUM ('CORPORATIVO', 'DEPARTAMENTAL');

-- CreateEnum
CREATE TYPE "modo_importacao" AS ENUM ('GESTOR', 'CARGA_HISTORICA');

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entra_oid" VARCHAR(64),
    "nome" VARCHAR(200) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "perfil" "perfil" NOT NULL DEFAULT 'LEITOR',
    "gerente_geral" BOOLEAN NOT NULL DEFAULT false,
    "superior_id" UUID,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criado_por" UUID,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_por" UUID,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setor" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo" VARCHAR(30) NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "corporativo" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criado_por" UUID,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_por" UUID,

    CONSTRAINT "setor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ciclo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ano" SMALLINT NOT NULL,
    "status" "status_ciclo" NOT NULL DEFAULT 'RASCUNHO',
    "encerrado_em" TIMESTAMPTZ(6),
    "encerrado_por" UUID,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criado_por" UUID,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_por" UUID,

    CONSTRAINT "ciclo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setor_responsavel" (
    "ciclo_id" UUID NOT NULL,
    "setor_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criado_por" UUID,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_por" UUID,

    CONSTRAINT "setor_responsavel_pkey" PRIMARY KEY ("ciclo_id","setor_id")
);

-- CreateTable
CREATE TABLE "leitor_setor" (
    "usuario_id" UUID NOT NULL,
    "setor_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criado_por" UUID,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_por" UUID,

    CONSTRAINT "leitor_setor_pkey" PRIMARY KEY ("usuario_id","setor_id")
);

-- CreateTable
CREATE TABLE "feriado" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "data" DATE NOT NULL,
    "descricao" VARCHAR(120) NOT NULL,
    "tipo" "tipo_feriado" NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criado_por" UUID,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_por" UUID,

    CONSTRAINT "feriado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modelo_meta" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo" VARCHAR(40) NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "metrica" TEXT NOT NULL,
    "unidade" "unidade" NOT NULL,
    "formula" TEXT NOT NULL,
    "modo_apuracao" "modo_apuracao" NOT NULL,
    "operador_sugerido" "operador" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criado_por" UUID,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_por" UUID,

    CONSTRAINT "modelo_meta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modelo_variavel" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "modelo_id" UUID NOT NULL,
    "codigo" VARCHAR(40) NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "tipo" "tipo_variavel" NOT NULL,
    "acumulacao" "acumulacao" NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criado_por" UUID,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_por" UUID,

    CONSTRAINT "modelo_variavel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variavel" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ciclo_id" UUID NOT NULL,
    "setor_id" UUID NOT NULL,
    "codigo" VARCHAR(40) NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "tipo" "tipo_variavel" NOT NULL,
    "acumulacao" "acumulacao" NOT NULL,
    "origem" "origem_variavel" NOT NULL DEFAULT 'DIGITADA',
    "responsavel_id" UUID,
    "casas_decimais" SMALLINT NOT NULL DEFAULT 2,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criado_por" UUID,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_por" UUID,

    CONSTRAINT "variavel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ciclo_id" UUID NOT NULL,
    "setor_id" UUID NOT NULL,
    "meta_pai_id" UUID,
    "modelo_id" UUID,
    "codigo" VARCHAR(40) NOT NULL,
    "indicador" VARCHAR(200) NOT NULL,
    "metrica" TEXT NOT NULL,
    "unidade" "unidade" NOT NULL,
    "formula_texto" TEXT,
    "formula_ast" JSONB,
    "modo_apuracao" "modo_apuracao" NOT NULL,
    "operador" "operador" NOT NULL,
    "tolerancia" DECIMAL(18,6),
    "mes_inicio" SMALLINT NOT NULL,
    "mes_fim" SMALLINT NOT NULL,
    "regra_pontuacao" "regra_pontuacao" NOT NULL,
    "peso_interno" DECIMAL(18,6),
    "responsavel_id" UUID NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criado_por" UUID,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_por" UUID,

    CONSTRAINT "meta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_variavel" (
    "meta_id" UUID NOT NULL,
    "variavel_id" UUID NOT NULL,

    CONSTRAINT "meta_variavel_pkey" PRIMARY KEY ("meta_id","variavel_id")
);

-- CreateTable
CREATE TABLE "meta_objetivo" (
    "meta_id" UUID NOT NULL,
    "mes" SMALLINT NOT NULL,
    "valor" DECIMAL(18,6) NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criado_por" UUID,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_por" UUID,

    CONSTRAINT "meta_objetivo_pkey" PRIMARY KEY ("meta_id","mes")
);

-- CreateTable
CREATE TABLE "meta_atribuicao" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "meta_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "peso" DECIMAL(18,6) NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criado_por" UUID,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_por" UUID,

    CONSTRAINT "meta_atribuicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lancamento" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "variavel_id" UUID NOT NULL,
    "mes" SMALLINT NOT NULL,
    "valor" DECIMAL(18,6),
    "origem" "origem_lancamento" NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criado_por" UUID,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_por" UUID,

    CONSTRAINT "lancamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lancamento_historico" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lancamento_id" UUID NOT NULL,
    "valor_anterior" DECIMAL(18,6),
    "valor_novo" DECIMAL(18,6),
    "origem" "origem_lancamento" NOT NULL,
    "usuario_id" UUID NOT NULL,
    "em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importacao_id" UUID,
    "reabertura_id" UUID,

    CONSTRAINT "lancamento_historico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reabertura" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ciclo_id" UUID NOT NULL,
    "mes" SMALLINT NOT NULL,
    "escopo" "escopo_reabertura" NOT NULL,
    "escopo_id" UUID,
    "valido_ate" TIMESTAMPTZ(6) NOT NULL,
    "motivo" TEXT NOT NULL,
    "autorizado_por" VARCHAR(200) NOT NULL,
    "cancelada_em" TIMESTAMPTZ(6),
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criado_por" UUID,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_por" UUID,

    CONSTRAINT "reabertura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "importacao" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "arquivo_nome" VARCHAR(255) NOT NULL,
    "modo" "modo_importacao" NOT NULL,
    "linhas_total" INTEGER NOT NULL DEFAULT 0,
    "linhas_gravadas" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(30) NOT NULL,
    "erros" JSONB NOT NULL DEFAULT '[]',
    "usuario_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criado_por" UUID,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_por" UUID,

    CONSTRAINT "importacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resultado_meta_mes" (
    "meta_id" UUID NOT NULL,
    "mes" SMALLINT NOT NULL,
    "resultado" DECIMAL(18,6),
    "objetivo" DECIMAL(18,6),
    "atendimento" DECIMAL(18,6),
    "situacao" "situacao",
    "fora_periodo" BOOLEAN NOT NULL,
    "aviso" VARCHAR(100),
    "calculado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resultado_meta_mes_pkey" PRIMARY KEY ("meta_id","mes")
);

-- CreateTable
CREATE TABLE "resultado_meta" (
    "meta_id" UUID NOT NULL,
    "resultado_acumulado" DECIMAL(18,6),
    "objetivo_usado" DECIMAL(18,6),
    "atendimento" DECIMAL(18,6) NOT NULL,
    "situacao" "situacao" NOT NULL,
    "memoria" JSONB NOT NULL,
    "calculado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resultado_meta_pkey" PRIMARY KEY ("meta_id")
);

-- CreateTable
CREATE TABLE "resultado_atribuicao" (
    "atribuicao_id" UUID NOT NULL,
    "pontos" DECIMAL(18,6) NOT NULL,
    "calculado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resultado_atribuicao_pkey" PRIMARY KEY ("atribuicao_id")
);

-- CreateTable
CREATE TABLE "nota_gestor" (
    "ciclo_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "bloco" "bloco" NOT NULL,
    "peso_total" DECIMAL(18,6) NOT NULL,
    "pontos" DECIMAL(18,6) NOT NULL,
    "calculado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nota_gestor_pkey" PRIMARY KEY ("ciclo_id","usuario_id","bloco")
);

-- CreateTable
CREATE TABLE "nota_fechamento" (
    "ciclo_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "bloco" "bloco" NOT NULL,
    "pontos" DECIMAL(18,6) NOT NULL,
    "dados" JSONB NOT NULL,
    "congelado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nota_fechamento_pkey" PRIMARY KEY ("ciclo_id","usuario_id","bloco")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entidade" VARCHAR(60) NOT NULL,
    "entidade_id" VARCHAR(200) NOT NULL,
    "acao" VARCHAR(30) NOT NULL,
    "antes" JSONB,
    "depois" JSONB,
    "usuario_id" UUID,
    "em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" VARCHAR(45),

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_entra_oid_key" ON "usuario"("entra_oid");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE INDEX "usuario_superior_id_idx" ON "usuario"("superior_id");

-- CreateIndex
CREATE UNIQUE INDEX "setor_codigo_key" ON "setor"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "ciclo_ano_key" ON "ciclo"("ano");

-- CreateIndex
CREATE INDEX "setor_responsavel_setor_id_idx" ON "setor_responsavel"("setor_id");

-- CreateIndex
CREATE INDEX "setor_responsavel_usuario_id_idx" ON "setor_responsavel"("usuario_id");

-- CreateIndex
CREATE INDEX "leitor_setor_setor_id_idx" ON "leitor_setor"("setor_id");

-- CreateIndex
CREATE UNIQUE INDEX "feriado_data_key" ON "feriado"("data");

-- CreateIndex
CREATE UNIQUE INDEX "modelo_meta_codigo_key" ON "modelo_meta"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "modelo_variavel_modelo_id_codigo_key" ON "modelo_variavel"("modelo_id", "codigo");

-- CreateIndex
CREATE INDEX "variavel_setor_id_idx" ON "variavel"("setor_id");

-- CreateIndex
CREATE INDEX "variavel_responsavel_id_idx" ON "variavel"("responsavel_id");

-- CreateIndex
CREATE UNIQUE INDEX "variavel_ciclo_id_setor_id_codigo_key" ON "variavel"("ciclo_id", "setor_id", "codigo");

-- CreateIndex
CREATE INDEX "meta_setor_id_idx" ON "meta"("setor_id");

-- CreateIndex
CREATE INDEX "meta_meta_pai_id_idx" ON "meta"("meta_pai_id");

-- CreateIndex
CREATE INDEX "meta_modelo_id_idx" ON "meta"("modelo_id");

-- CreateIndex
CREATE INDEX "meta_responsavel_id_idx" ON "meta"("responsavel_id");

-- CreateIndex
CREATE UNIQUE INDEX "meta_ciclo_id_codigo_key" ON "meta"("ciclo_id", "codigo");

-- CreateIndex
CREATE INDEX "meta_variavel_variavel_id_idx" ON "meta_variavel"("variavel_id");

-- CreateIndex
CREATE INDEX "meta_atribuicao_usuario_id_idx" ON "meta_atribuicao"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "meta_atribuicao_meta_id_usuario_id_key" ON "meta_atribuicao"("meta_id", "usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "lancamento_variavel_id_mes_key" ON "lancamento"("variavel_id", "mes");

-- CreateIndex
CREATE INDEX "lancamento_historico_lancamento_id_em_idx" ON "lancamento_historico"("lancamento_id", "em");

-- CreateIndex
CREATE INDEX "lancamento_historico_usuario_id_idx" ON "lancamento_historico"("usuario_id");

-- CreateIndex
CREATE INDEX "lancamento_historico_importacao_id_idx" ON "lancamento_historico"("importacao_id");

-- CreateIndex
CREATE INDEX "lancamento_historico_reabertura_id_idx" ON "lancamento_historico"("reabertura_id");

-- CreateIndex
CREATE INDEX "reabertura_ciclo_id_mes_idx" ON "reabertura"("ciclo_id", "mes");

-- CreateIndex
CREATE INDEX "importacao_usuario_id_idx" ON "importacao"("usuario_id");

-- CreateIndex
CREATE INDEX "nota_gestor_usuario_id_idx" ON "nota_gestor"("usuario_id");

-- CreateIndex
CREATE INDEX "nota_fechamento_usuario_id_idx" ON "nota_fechamento"("usuario_id");

-- CreateIndex
CREATE INDEX "auditoria_entidade_entidade_id_em_idx" ON "auditoria"("entidade", "entidade_id", "em");

-- CreateIndex
CREATE INDEX "auditoria_usuario_id_idx" ON "auditoria"("usuario_id");

-- CreateIndex
CREATE INDEX "auditoria_em_idx" ON "auditoria"("em");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_superior_id_fkey" FOREIGN KEY ("superior_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setor_responsavel" ADD CONSTRAINT "setor_responsavel_ciclo_id_fkey" FOREIGN KEY ("ciclo_id") REFERENCES "ciclo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setor_responsavel" ADD CONSTRAINT "setor_responsavel_setor_id_fkey" FOREIGN KEY ("setor_id") REFERENCES "setor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setor_responsavel" ADD CONSTRAINT "setor_responsavel_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leitor_setor" ADD CONSTRAINT "leitor_setor_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leitor_setor" ADD CONSTRAINT "leitor_setor_setor_id_fkey" FOREIGN KEY ("setor_id") REFERENCES "setor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modelo_variavel" ADD CONSTRAINT "modelo_variavel_modelo_id_fkey" FOREIGN KEY ("modelo_id") REFERENCES "modelo_meta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variavel" ADD CONSTRAINT "variavel_ciclo_id_fkey" FOREIGN KEY ("ciclo_id") REFERENCES "ciclo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variavel" ADD CONSTRAINT "variavel_setor_id_fkey" FOREIGN KEY ("setor_id") REFERENCES "setor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variavel" ADD CONSTRAINT "variavel_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta" ADD CONSTRAINT "meta_ciclo_id_fkey" FOREIGN KEY ("ciclo_id") REFERENCES "ciclo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta" ADD CONSTRAINT "meta_setor_id_fkey" FOREIGN KEY ("setor_id") REFERENCES "setor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta" ADD CONSTRAINT "meta_meta_pai_id_fkey" FOREIGN KEY ("meta_pai_id") REFERENCES "meta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta" ADD CONSTRAINT "meta_modelo_id_fkey" FOREIGN KEY ("modelo_id") REFERENCES "modelo_meta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta" ADD CONSTRAINT "meta_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_variavel" ADD CONSTRAINT "meta_variavel_meta_id_fkey" FOREIGN KEY ("meta_id") REFERENCES "meta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_variavel" ADD CONSTRAINT "meta_variavel_variavel_id_fkey" FOREIGN KEY ("variavel_id") REFERENCES "variavel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_objetivo" ADD CONSTRAINT "meta_objetivo_meta_id_fkey" FOREIGN KEY ("meta_id") REFERENCES "meta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_atribuicao" ADD CONSTRAINT "meta_atribuicao_meta_id_fkey" FOREIGN KEY ("meta_id") REFERENCES "meta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_atribuicao" ADD CONSTRAINT "meta_atribuicao_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento" ADD CONSTRAINT "lancamento_variavel_id_fkey" FOREIGN KEY ("variavel_id") REFERENCES "variavel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento_historico" ADD CONSTRAINT "lancamento_historico_lancamento_id_fkey" FOREIGN KEY ("lancamento_id") REFERENCES "lancamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento_historico" ADD CONSTRAINT "lancamento_historico_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento_historico" ADD CONSTRAINT "lancamento_historico_importacao_id_fkey" FOREIGN KEY ("importacao_id") REFERENCES "importacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento_historico" ADD CONSTRAINT "lancamento_historico_reabertura_id_fkey" FOREIGN KEY ("reabertura_id") REFERENCES "reabertura"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reabertura" ADD CONSTRAINT "reabertura_ciclo_id_fkey" FOREIGN KEY ("ciclo_id") REFERENCES "ciclo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importacao" ADD CONSTRAINT "importacao_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultado_meta_mes" ADD CONSTRAINT "resultado_meta_mes_meta_id_fkey" FOREIGN KEY ("meta_id") REFERENCES "meta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultado_meta" ADD CONSTRAINT "resultado_meta_meta_id_fkey" FOREIGN KEY ("meta_id") REFERENCES "meta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultado_atribuicao" ADD CONSTRAINT "resultado_atribuicao_atribuicao_id_fkey" FOREIGN KEY ("atribuicao_id") REFERENCES "meta_atribuicao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nota_gestor" ADD CONSTRAINT "nota_gestor_ciclo_id_fkey" FOREIGN KEY ("ciclo_id") REFERENCES "ciclo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nota_gestor" ADD CONSTRAINT "nota_gestor_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nota_fechamento" ADD CONSTRAINT "nota_fechamento_ciclo_id_fkey" FOREIGN KEY ("ciclo_id") REFERENCES "ciclo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nota_fechamento" ADD CONSTRAINT "nota_fechamento_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================================================================
-- Regras que o Prisma não expressa (CLAUDE.md 9.2). Escritas à mão; não editar depois de aplicada.
-- =============================================================================================

-- Códigos usados nas fórmulas (SETOR.VAR): maiúsculas, números e _, começando por letra ou _.
ALTER TABLE "setor" ADD CONSTRAINT "setor_codigo_formato" CHECK ("codigo" ~ '^[A-Z_][A-Z0-9_]*$');
ALTER TABLE "variavel" ADD CONSTRAINT "variavel_codigo_formato" CHECK ("codigo" ~ '^[A-Z_][A-Z0-9_]*$');
ALTER TABLE "modelo_variavel" ADD CONSTRAINT "modelo_variavel_codigo_formato" CHECK ("codigo" ~ '^[A-Z_][A-Z0-9_]*$');

-- Usuário: e-mail em minúsculas, para a unicidade não depender de maiúsculas.
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_email_minusculo" CHECK ("email" = lower("email") AND position('@' IN "email") > 1);

-- Setor: no máximo um Corporativo.
CREATE UNIQUE INDEX "setor_unico_corporativo" ON "setor" ("corporativo") WHERE "corporativo";

-- Ciclo: ano plausível; encerrado tem data; no máximo um ciclo ATIVO (RF-07).
ALTER TABLE "ciclo" ADD CONSTRAINT "ciclo_ano" CHECK ("ano" BETWEEN 2000 AND 2100);
ALTER TABLE "ciclo" ADD CONSTRAINT "ciclo_encerrado_tem_data" CHECK ("status" <> 'ENCERRADO' OR "encerrado_em" IS NOT NULL);
CREATE UNIQUE INDEX "ciclo_unico_ativo" ON "ciclo" ("status") WHERE "status" = 'ATIVO';

-- Variável: casas decimais de entrada.
ALTER TABLE "variavel" ADD CONSTRAINT "variavel_casas_decimais" CHECK ("casas_decimais" BETWEEN 0 AND 6);

-- Meta: período, fórmula (texto e AST juntos), tolerância, peso interno, versão.
ALTER TABLE "meta" ADD CONSTRAINT "meta_periodo" CHECK ("mes_inicio" BETWEEN 1 AND 12 AND "mes_fim" BETWEEN "mes_inicio" AND 12);
ALTER TABLE "meta" ADD CONSTRAINT "meta_formula_completa" CHECK (("formula_texto" IS NULL) = ("formula_ast" IS NULL));
ALTER TABLE "meta" ADD CONSTRAINT "meta_tolerancia" CHECK ("tolerancia" IS NULL OR "tolerancia" >= 0);
ALTER TABLE "meta" ADD CONSTRAINT "meta_peso_interno" CHECK ("peso_interno" IS NULL OR ("peso_interno" > 0 AND "peso_interno" <= 1));
ALTER TABLE "meta" ADD CONSTRAINT "meta_pai_diferente" CHECK ("meta_pai_id" IS NULL OR "meta_pai_id" <> "id");
ALTER TABLE "meta" ADD CONSTRAINT "meta_versao" CHECK ("versao" >= 1);

-- Objetivo: 0 = único, 1 a 12 = mensal.
ALTER TABLE "meta_objetivo" ADD CONSTRAINT "meta_objetivo_mes" CHECK ("mes" BETWEEN 0 AND 12);

-- Atribuição: peso no bloco entre 0 (exclusive) e 100.
ALTER TABLE "meta_atribuicao" ADD CONSTRAINT "meta_atribuicao_peso" CHECK ("peso" > 0 AND "peso" <= 100);

-- Lançamento.
ALTER TABLE "lancamento" ADD CONSTRAINT "lancamento_mes" CHECK ("mes" BETWEEN 1 AND 12);
ALTER TABLE "lancamento" ADD CONSTRAINT "lancamento_versao" CHECK ("versao" >= 1);

-- Reabertura: mês; escopo TODOS sem id, SETOR/GESTOR com id; motivo e autorizador preenchidos.
ALTER TABLE "reabertura" ADD CONSTRAINT "reabertura_mes" CHECK ("mes" BETWEEN 1 AND 12);
ALTER TABLE "reabertura" ADD CONSTRAINT "reabertura_escopo_id" CHECK (("escopo" = 'TODOS') = ("escopo_id" IS NULL));
ALTER TABLE "reabertura" ADD CONSTRAINT "reabertura_motivo" CHECK (length(btrim("motivo")) > 0);
ALTER TABLE "reabertura" ADD CONSTRAINT "reabertura_autorizado_por" CHECK (length(btrim("autorizado_por")) > 0);

-- Importação.
ALTER TABLE "importacao" ADD CONSTRAINT "importacao_linhas" CHECK ("linhas_total" >= 0 AND "linhas_gravadas" BETWEEN 0 AND "linhas_total");

-- Resultados: mês e atendimento entre 0 e 1.
ALTER TABLE "resultado_meta_mes" ADD CONSTRAINT "resultado_meta_mes_mes" CHECK ("mes" BETWEEN 1 AND 12);
ALTER TABLE "resultado_meta_mes" ADD CONSTRAINT "resultado_meta_mes_atendimento" CHECK ("atendimento" IS NULL OR "atendimento" BETWEEN 0 AND 1);
ALTER TABLE "resultado_meta" ADD CONSTRAINT "resultado_meta_atendimento" CHECK ("atendimento" BETWEEN 0 AND 1);

-- ---------------------------------------------------------------------------------------------
-- Metas: no máximo 2 níveis (RN-26), submeta no mesmo ciclo da mãe e sem atribuição (RN-04).
-- ---------------------------------------------------------------------------------------------
CREATE FUNCTION "meta_verificar_niveis"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  pai RECORD;
BEGIN
  IF NEW."meta_pai_id" IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT "meta_pai_id", "ciclo_id" INTO pai FROM "meta" WHERE "id" = NEW."meta_pai_id";
  IF pai."meta_pai_id" IS NOT NULL THEN
    RAISE EXCEPTION 'Uma submeta não pode ter submetas (máximo de 2 níveis)'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'meta_dois_niveis';
  END IF;
  IF pai."ciclo_id" <> NEW."ciclo_id" THEN
    RAISE EXCEPTION 'A submeta precisa ser do mesmo ciclo da meta-mãe'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'meta_mesmo_ciclo';
  END IF;
  IF EXISTS (SELECT 1 FROM "meta" WHERE "meta_pai_id" = NEW."id") THEN
    RAISE EXCEPTION 'Uma meta com submetas não pode virar submeta (máximo de 2 níveis)'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'meta_dois_niveis';
  END IF;
  IF EXISTS (SELECT 1 FROM "meta_atribuicao" WHERE "meta_id" = NEW."id") THEN
    RAISE EXCEPTION 'Uma meta com atribuições não pode virar submeta'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'meta_atribuicao_sem_pai';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "meta_verificar_niveis"
  BEFORE INSERT OR UPDATE OF "meta_pai_id", "ciclo_id" ON "meta"
  FOR EACH ROW EXECUTE FUNCTION "meta_verificar_niveis"();

CREATE FUNCTION "meta_atribuicao_verificar_meta"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "meta" WHERE "id" = NEW."meta_id" AND "meta_pai_id" IS NOT NULL) THEN
    RAISE EXCEPTION 'Submeta não tem atribuição: o peso no bloco fica na meta-mãe'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'meta_atribuicao_sem_pai';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "meta_atribuicao_verificar_meta"
  BEFORE INSERT OR UPDATE OF "meta_id" ON "meta_atribuicao"
  FOR EACH ROW EXECUTE FUNCTION "meta_atribuicao_verificar_meta"();

-- ---------------------------------------------------------------------------------------------
-- Histórico e auditoria: somente inclusão (RN-40). Vale para qualquer usuário do banco.
-- ---------------------------------------------------------------------------------------------
CREATE FUNCTION "bloquear_alteracao"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'A tabela % é somente inclusão: % não é permitido', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER "lancamento_historico_somente_inclusao"
  BEFORE UPDATE OR DELETE ON "lancamento_historico"
  FOR EACH ROW EXECUTE FUNCTION "bloquear_alteracao"();
CREATE TRIGGER "lancamento_historico_sem_truncate"
  BEFORE TRUNCATE ON "lancamento_historico"
  FOR EACH STATEMENT EXECUTE FUNCTION "bloquear_alteracao"();

CREATE TRIGGER "auditoria_somente_inclusao"
  BEFORE UPDATE OR DELETE ON "auditoria"
  FOR EACH ROW EXECUTE FUNCTION "bloquear_alteracao"();
CREATE TRIGGER "auditoria_sem_truncate"
  BEFORE TRUNCATE ON "auditoria"
  FOR EACH STATEMENT EXECUTE FUNCTION "bloquear_alteracao"();

-- ---------------------------------------------------------------------------------------------
-- atualizado_em mantido pelo banco também em UPDATE feito fora do Prisma.
-- Tabela nova com atualizado_em precisa ganhar este trigger na sua migração.
-- ---------------------------------------------------------------------------------------------
CREATE FUNCTION "definir_atualizado_em"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."atualizado_em" := now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tabela TEXT;
BEGIN
  FOREACH tabela IN ARRAY ARRAY[
    'usuario', 'setor', 'ciclo', 'setor_responsavel', 'leitor_setor', 'feriado',
    'modelo_meta', 'modelo_variavel', 'variavel', 'meta', 'meta_objetivo',
    'meta_atribuicao', 'lancamento', 'reabertura', 'importacao'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION "definir_atualizado_em"()',
      tabela || '_atualizado_em', tabela
    );
  END LOOP;
END;
$$;
