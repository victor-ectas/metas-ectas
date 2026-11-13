import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import {
  Alert,
  Box,
  Button,
  InputAdornment,
  Skeleton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  CodigoErro,
  type ConflitoLancamento,
  ConflitoLancamentoSchema,
  type LancamentosMes,
  type MesLancamento,
  StatusMes,
  TipoVariavel,
  type VariavelLancamento,
} from '@metas/tipos';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { z } from 'zod';

import { ErroApi, mensagemDeErro } from '../../api/erro-api';
import { useLancamentos, useSalvarLancamentos } from '../../api/lancamentos';
import { plural } from '../../app/plural';
import { ROTULO_OPERADOR } from '../../app/rotulos';
import { CORES } from '../../app/tema';
import { useAvisar } from '../../componentes/avisos';
import { CabecalhoPagina } from '../../componentes/cabecalho-pagina';
import { DialogoConfirmacao } from '../../componentes/dialogo-confirmacao';
import { Pagina } from '../../componentes/pagina';
import { SituacaoMeta } from '../../componentes/situacao-meta';
import {
  formatarData,
  formatarDataHora,
  formatarPercentual,
  formatarValor,
  nomeMes,
} from '../../formatacao';
import {
  agrupar,
  type GrupoMeta,
  type Leitura,
  lerCampo,
  mesmoValor,
  podeEditar,
  previa,
  unidadeDaVariavel,
  valorParaCampo,
} from './lancamento';

const MESES_CURTOS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const;

/**
 * Lançamentos (P19, especificação 9.2 e 10.2): pensada primeiro para o celular. O gestor escolhe o
 * mês, digita as variáveis agrupadas por meta, vê o resultado do mês e o acumulado enquanto
 * digita (motor no navegador) e salva tudo de uma vez. A API decide permissão, trava e versão.
 */
export function PaginaLancamentos() {
  const [parametros, setParametros] = useSearchParams();
  const mesPedido = Number(parametros.get('mes')) || undefined;
  const consulta = useLancamentos(undefined, mesPedido);

  return (
    <Pagina>
      <CabecalhoPagina
        titulo="Lançamentos"
        descricao={
          consulta.data === undefined
            ? undefined
            : `Ciclo ${String(consulta.data.ciclo.ano)}. Digite os valores do mês; o resultado aparece enquanto você digita.`
        }
      />
      {consulta.isError ? (
        <Alert severity={consulta.error.codigo === CodigoErro.NAO_ENCONTRADO ? 'info' : 'error'}>
          {mensagemDeErro(consulta.error)}
        </Alert>
      ) : consulta.data === undefined ? (
        <Stack spacing={2} aria-busy="true" aria-label="Carregando os lançamentos…">
          <Skeleton variant="rounded" height={56} />
          <Skeleton variant="rounded" height={220} />
        </Stack>
      ) : (
        <MesDeLancamento
          key={`${consulta.data.ciclo.id}-${String(consulta.data.mes)}`}
          dados={consulta.data}
          aoTrocarMes={(mes) => {
            setParametros({ mes: String(mes) }, { replace: true });
          }}
        />
      )}
    </Pagina>
  );
}

// -------------------------------------------------------------------------------------------------

function MesDeLancamento(props: {
  readonly dados: LancamentosMes;
  readonly aoTrocarMes: (mes: number) => void;
}) {
  const { dados } = props;
  const [digitados, setDigitados] = useState<ReadonlyMap<string, string>>(new Map());
  const [conflitos, setConflitos] = useState<ReadonlyMap<string, ConflitoLancamento>>(new Map());
  const [trocarPara, setTrocarPara] = useState<number | null>(null);
  const salvar = useSalvarLancamentos();
  const avisar = useAvisar();
  const grupos = useMemo(() => agrupar(dados), [dados]);
  const doMes = dados.meses[dados.mes - 1];

  const leituras = useMemo(() => {
    const mapa = new Map<string, Leitura>();
    for (const [id, texto] of digitados) {
      const v = dados.variaveis.find((x) => x.id === id);
      if (v !== undefined) mapa.set(id, lerCampo(v, texto));
    }
    return mapa;
  }, [digitados, dados.variaveis]);

  const alteradas = dados.variaveis.filter((v) => {
    const leitura = leituras.get(v.id);
    return leitura !== undefined && (!leitura.ok || !mesmoValor(leitura.valor, v.valor));
  });
  const invalidas = alteradas.filter((v) => leituras.get(v.id)?.ok === false);
  // Valores válidos digitados, para a prévia.
  const valoresDigitados = new Map<string, string | null>();
  for (const [id, leitura] of leituras) if (leitura.ok) valoresDigitados.set(id, leitura.valor);

  function digitar(v: VariavelLancamento, texto: string): void {
    setDigitados((atual) => new Map(atual).set(v.id, texto));
  }

  function descartar(): void {
    setDigitados(new Map());
    setConflitos(new Map());
    salvar.reset();
  }

  function enviar(): void {
    const itens = alteradas.flatMap((v) => {
      const leitura = leituras.get(v.id);
      return leitura?.ok === true
        ? [{ variavelId: v.id, mes: dados.mes, valor: leitura.valor, versao: v.versao }]
        : [];
    });
    salvar.mutate(
      { ciclo: dados.ciclo.id, itens },
      {
        onSuccess: (r) => {
          avisar(
            r.gravados === 0
              ? 'Nada mudou.'
              : `${plural(r.gravados, 'valor salvo', 'valores salvos')}.`,
          );
          setDigitados(new Map());
          setConflitos(new Map());
        },
        onError: (erro) => {
          if (erro instanceof ErroApi && erro.codigo === CodigoErro.CONFLITO_VERSAO) {
            const lidos = z.array(ConflitoLancamentoSchema).safeParse(erro.detalhes.conflitos);
            if (lidos.success) setConflitos(new Map(lidos.data.map((c) => [c.variavelId, c])));
          }
        },
      },
    );
  }

  return (
    <Box sx={{ pb: alteradas.length > 0 ? 12 : 0 }}>
      <SeletorMes
        meses={dados.meses}
        selecionado={dados.mes}
        aoEscolher={(mes) => {
          if (mes === dados.mes) return;
          if (alteradas.length > 0) setTrocarPara(mes);
          else props.aoTrocarMes(mes);
        }}
      />
      {doMes !== undefined && <Prazo mes={doMes} ano={dados.ciclo.ano} />}

      {grupos.length === 0 ? (
        <Alert severity="info" sx={{ mt: 3 }}>
          Você não tem variáveis para lançar neste ciclo. Se isso estiver errado, fale com o
          Administrador.
        </Alert>
      ) : (
        <Stack spacing={2} sx={{ mt: 3 }}>
          {grupos.map((grupo) => (
            <CartaoMeta
              key={grupo.meta?.id ?? 'soltas'}
              grupo={grupo}
              dados={dados}
              digitados={digitados}
              leituras={leituras}
              valoresDigitados={valoresDigitados}
              conflitos={conflitos}
              aoDigitar={digitar}
              aoResolverConflito={(v, usarSalvo) => {
                setConflitos((atual) => {
                  const mapa = new Map(atual);
                  mapa.delete(v.id);
                  return mapa;
                });
                if (usarSalvo) {
                  setDigitados((atual) => {
                    const mapa = new Map(atual);
                    mapa.delete(v.id);
                    return mapa;
                  });
                }
              }}
            />
          ))}
        </Stack>
      )}

      {alteradas.length > 0 && (
        <BarraSalvar
          quantidade={alteradas.length}
          invalidas={invalidas.length}
          conflitos={conflitos.size}
          enviando={salvar.isPending}
          erro={
            salvar.isError &&
            !(salvar.error.codigo === CodigoErro.CONFLITO_VERSAO && conflitos.size > 0)
              ? mensagemDeErro(salvar.error)
              : null
          }
          aoSalvar={enviar}
          aoDescartar={descartar}
        />
      )}

      <DialogoConfirmacao
        aberto={trocarPara !== null}
        titulo="Descartar o que não foi salvo?"
        mensagem={`Você tem ${plural(alteradas.length, 'valor não salvo', 'valores não salvos')} em ${nomeMes(dados.mes, dados.ciclo.ano)}. Se trocar de mês agora, eles se perdem.`}
        rotuloConfirmar="Descartar e trocar de mês"
        aoCancelar={() => {
          setTrocarPara(null);
        }}
        aoConfirmar={() => {
          const destino = trocarPara;
          setTrocarPara(null);
          if (destino !== null) props.aoTrocarMes(destino);
        }}
      />
    </Box>
  );
}

// --- Seletor de mês e prazo ----------------------------------------------------------------------

function SeletorMes(props: {
  readonly meses: readonly MesLancamento[];
  readonly selecionado: number;
  readonly aoEscolher: (mes: number) => void;
}) {
  return (
    <Box
      role="group"
      aria-label="Mês"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(6, 1fr)', md: 'repeat(12, 1fr)' },
        gap: 1,
      }}
    >
      {props.meses.map((m) => {
        const selecionado = m.mes === props.selecionado;
        const futuro = m.status === StatusMes.FUTURO;
        const fechado = m.status === StatusMes.FECHADO;
        const aberto = !futuro && !fechado;
        const pendente = aberto && m.pendentes > 0;
        const descricao = [
          nomeMes(m.mes),
          futuro
            ? 'ainda não começou'
            : fechado
              ? 'fechado'
              : m.status === StatusMes.REABERTO
                ? 'reaberto'
                : 'aberto',
          pendente ? plural(m.pendentes, 'pendência', 'pendências') : null,
        ]
          .filter(Boolean)
          .join(', ');
        return (
          <Button
            key={m.mes}
            disabled={futuro}
            aria-pressed={selecionado}
            aria-label={descricao}
            onClick={() => {
              props.aoEscolher(m.mes);
            }}
            sx={{
              minWidth: 0,
              minHeight: 48,
              px: 0.5,
              position: 'relative',
              flexDirection: 'column',
              gap: 0.25,
              fontWeight: 700,
              borderRadius: 2,
              border: `1px solid ${selecionado ? CORES.marinho : CORES.borda}`,
              bgcolor: selecionado ? CORES.marinho : CORES.branco,
              color: selecionado ? CORES.branco : fechado ? CORES.textoSecundario : CORES.marinho,
              '&:hover': { bgcolor: selecionado ? CORES.marinho : CORES.turquesaClaro },
              '&.Mui-disabled': { bgcolor: 'transparent', borderStyle: 'dashed' },
            }}
          >
            <span aria-hidden>{MESES_CURTOS[m.mes - 1]}</span>
            {fechado && <LockOutlinedIcon aria-hidden sx={{ fontSize: 14 }} />}
            {pendente && (
              <Box
                component="span"
                aria-hidden
                sx={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: selecionado ? CORES.turquesa : CORES.azul,
                }}
              />
            )}
          </Button>
        );
      })}
    </Box>
  );
}

function Prazo({ mes, ano }: { readonly mes: MesLancamento; readonly ano: number }) {
  const nome = nomeMes(mes.mes, ano);
  const data = formatarData(mes.fechaEm).slice(0, 5);
  let texto: string;
  switch (mes.status) {
    case StatusMes.ABERTO: {
      const dias = mes.diasUteisRestantes ?? 0;
      texto = `${nome} fecha em ${data}: ${dias === 1 ? 'último dia útil' : `faltam ${plural(dias, 'dia útil', 'dias úteis')}`}.`;
      break;
    }
    case StatusMes.REABERTO:
      texto = `${nome} foi reaberto pelo Administrador: os valores liberados podem ser corrigidos.`;
      break;
    case StatusMes.FECHADO:
      texto = `${nome} fechou em ${formatarData(mes.fechaEm)}. Para corrigir algum valor, peça a reabertura ao Administrador.`;
      break;
    case StatusMes.FUTURO:
      texto = `${nome} ainda não começou.`;
      break;
  }
  const fechado = mes.status === StatusMes.FECHADO;
  return (
    <Typography
      role="status"
      sx={{
        mt: 2,
        display: 'flex',
        gap: 1,
        alignItems: 'flex-start',
        color: fechado ? CORES.textoSecundario : CORES.marinho,
        fontWeight: fechado ? 400 : 600,
      }}
    >
      {fechado && <LockOutlinedIcon aria-hidden fontSize="small" sx={{ mt: 0.25 }} />}
      {texto}
    </Typography>
  );
}

// --- Cartão de cada meta ------------------------------------------------------------------------

function CartaoMeta(props: {
  readonly grupo: GrupoMeta;
  readonly dados: LancamentosMes;
  readonly digitados: ReadonlyMap<string, string>;
  readonly leituras: ReadonlyMap<string, Leitura>;
  readonly valoresDigitados: ReadonlyMap<string, string | null>;
  readonly conflitos: ReadonlyMap<string, ConflitoLancamento>;
  readonly aoDigitar: (v: VariavelLancamento, texto: string) => void;
  readonly aoResolverConflito: (v: VariavelLancamento, usarSalvo: boolean) => void;
}) {
  const { grupo, dados } = props;
  const titulo = grupo.meta?.indicador ?? 'Outras variáveis';
  return (
    <Box
      component="section"
      aria-label={titulo}
      sx={{
        bgcolor: CORES.branco,
        border: `1px solid ${CORES.borda}`,
        borderRadius: 3,
        overflow: 'hidden',
      }}
    >
      <Box sx={{ px: 2, pt: 2, pb: 1.5 }}>
        <Typography variant="h3" sx={{ color: CORES.marinho }}>
          {titulo}
        </Typography>
        {grupo.meta !== null && (
          <Typography variant="body2" color="text.secondary" translate="no">
            {grupo.meta.codigo} · {grupo.meta.setorNome}
          </Typography>
        )}
      </Box>

      <Stack spacing={2} sx={{ px: 2, pb: 2 }}>
        {grupo.variaveis.map((v) => (
          <CampoVariavel
            key={v.id}
            variavel={v}
            texto={props.digitados.get(v.id)}
            leitura={props.leituras.get(v.id)}
            conflito={props.conflitos.get(v.id)}
            aoDigitar={props.aoDigitar}
            aoResolverConflito={props.aoResolverConflito}
          />
        ))}
        {(grupo.jaMostradas.length > 0 || grupo.deOutros.length > 0) && (
          <Typography variant="body2" color="text.secondary">
            {[
              grupo.jaMostradas.length > 0 &&
                `Também usa ${grupo.jaMostradas.map((v) => v.nome).join(', ')}, lançada${grupo.jaMostradas.length > 1 ? 's' : ''} acima.`,
              grupo.deOutros.length > 0 &&
                `Usa ${grupo.deOutros
                  .map(
                    (v) =>
                      `${v.nome} (${v.setorNome}): ${formatarValor(v.valor, unidadeDaVariavel(v))}`,
                  )
                  .join('; ')}, lançado pelo outro setor.`,
            ]
              .filter(Boolean)
              .join(' ')}
          </Typography>
        )}
      </Stack>

      {grupo.meta !== null && (
        <Previa grupo={grupo} dados={dados} valoresDigitados={props.valoresDigitados} />
      )}
    </Box>
  );
}

function CampoVariavel(props: {
  readonly variavel: VariavelLancamento;
  readonly texto: string | undefined;
  readonly leitura: Leitura | undefined;
  readonly conflito: ConflitoLancamento | undefined;
  readonly aoDigitar: (v: VariavelLancamento, texto: string) => void;
  readonly aoResolverConflito: (v: VariavelLancamento, usarSalvo: boolean) => void;
}) {
  const { variavel: v, conflito } = props;
  const editavel = podeEditar(v);
  const texto = props.texto ?? valorParaCampo(v, v.valor);
  const erro = props.leitura?.ok === false ? props.leitura.mensagem : undefined;
  const alterado = props.leitura?.ok === true && !mesmoValor(props.leitura.valor, v.valor);
  const unidade = unidadeDaVariavel(v);

  const aviso = conflito !== undefined && (
    <Alert
      severity="warning"
      sx={{ mt: 1 }}
      action={
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.5}>
          <Button
            color="inherit"
            size="small"
            onClick={() => {
              props.aoResolverConflito(v, true);
            }}
          >
            Usar o salvo
          </Button>
          <Button
            color="inherit"
            size="small"
            onClick={() => {
              props.aoResolverConflito(v, false);
            }}
          >
            Manter o meu
          </Button>
        </Stack>
      }
    >
      Outra pessoa salvou {formatarValor(conflito.valorAtual, unidade)}
      {conflito.atualizadoEm === null ? '' : ` em ${formatarDataHora(conflito.atualizadoEm)}`}.
    </Alert>
  );

  if (v.tipo === TipoVariavel.SIM_NAO) {
    const idRotulo = `rotulo-${v.id}`;
    return (
      <Box>
        <Typography id={idRotulo} sx={{ fontWeight: 600, mb: 0.75 }}>
          {v.nome}
          {alterado && <Alterado />}
        </Typography>
        <ToggleButtonGroup
          exclusive
          value={texto}
          disabled={!editavel}
          aria-labelledby={idRotulo}
          onChange={(_, valor: string | null) => {
            // Clicar de novo na opção marcada deixa vazio (vazio não é "Não", RN-08).
            props.aoDigitar(v, valor ?? '');
          }}
          sx={{ width: { xs: 1, sm: 'auto' } }}
        >
          <ToggleButton value="1" sx={{ flex: 1, minWidth: 96, minHeight: 48, fontWeight: 600 }}>
            Sim
          </ToggleButton>
          <ToggleButton value="0" sx={{ flex: 1, minWidth: 96, minHeight: 48, fontWeight: 600 }}>
            Não
          </ToggleButton>
        </ToggleButtonGroup>
        {texto === '' && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Vazio
          </Typography>
        )}
        {aviso}
      </Box>
    );
  }

  return (
    <Box>
      <TextField
        label={v.nome}
        value={texto}
        disabled={!editavel}
        onChange={(evento) => {
          props.aoDigitar(v, evento.target.value);
        }}
        error={erro !== undefined}
        helperText={
          erro ??
          (texto === ''
            ? 'Vazio. Zero só se o valor for zero mesmo.'
            : alterado
              ? 'Alterado, ainda não salvo.'
              : undefined)
        }
        autoComplete="off"
        fullWidth
        sx={{ bgcolor: CORES.branco }}
        slotProps={{
          htmlInput: { inputMode: 'decimal', spellCheck: false },
          input: {
            startAdornment:
              unidade === 'MOEDA' ? (
                <InputAdornment position="start">R$</InputAdornment>
              ) : undefined,
            endAdornment:
              unidade === 'PERCENTUAL' ? (
                <InputAdornment position="end">%</InputAdornment>
              ) : unidade === 'DIAS' ? (
                <InputAdornment position="end">dias</InputAdornment>
              ) : unidade === 'HORAS' ? (
                <InputAdornment position="end">h</InputAdornment>
              ) : undefined,
          },
        }}
      />
      {aviso}
    </Box>
  );
}

function Alterado() {
  return (
    <Box component="span" sx={{ ml: 1, fontSize: 13, fontWeight: 600, color: CORES.azulEscuro }}>
      alterado
    </Box>
  );
}

// --- Prévia ---------------------------------------------------------------------------------------

function Previa(props: {
  readonly grupo: GrupoMeta;
  readonly dados: LancamentosMes;
  readonly valoresDigitados: ReadonlyMap<string, string | null>;
}) {
  const meta = props.grupo.meta;
  const r = useMemo(
    () =>
      meta === null
        ? null
        : previa(meta, props.dados.variaveis, props.dados.mes, props.valoresDigitados),
    [meta, props.dados, props.valoresDigitados],
  );
  if (meta === null || r === null) return null;
  const doMes = r.mensal[props.dados.mes - 1];
  const foraPeriodo = doMes?.foraPeriodo === true;
  const objetivo = r.objetivo === null ? null : formatarValor(r.objetivo.toString(), meta.unidade);

  return (
    <Box
      aria-label={`Prévia de ${meta.indicador}`}
      role="group"
      sx={{
        px: 2,
        py: 1.5,
        bgcolor: CORES.espuma,
        borderTop: `1px solid ${CORES.borda}`,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, auto) 1fr' },
        gap: { xs: 1.5, sm: 3 },
        alignItems: 'end',
      }}
    >
      {meta.formula !== null && (
        <Indicador
          rotulo={foraPeriodo ? 'Mês (fora do período)' : 'Resultado do mês'}
          valor={formatarValor(doMes?.resultado?.toString(), meta.unidade)}
        />
      )}
      <Indicador
        rotulo={meta.formula === null ? 'Atendimento das submetas' : 'Acumulado'}
        valor={
          meta.formula === null
            ? formatarPercentual(r.atendimento.toString())
            : formatarValor(r.acumulado?.toString(), meta.unidade)
        }
      />
      {objetivo !== null && meta.formula !== null && (
        <Indicador rotulo="Objetivo" valor={`${ROTULO_OPERADOR[meta.operador]} ${objetivo}`} />
      )}
      <Box sx={{ justifySelf: { sm: 'end' } }}>
        <SituacaoMeta situacao={r.situacao} />
      </Box>
    </Box>
  );
}

function Indicador(props: { readonly rotulo: string; readonly valor: string }) {
  return (
    <Box>
      <Typography variant="body2" color="text.secondary">
        {props.rotulo}
      </Typography>
      <Typography
        sx={{ fontWeight: 700, color: CORES.marinho, fontVariantNumeric: 'tabular-nums' }}
      >
        {props.valor}
      </Typography>
    </Box>
  );
}

// --- Barra de salvar -----------------------------------------------------------------------------

function BarraSalvar(props: {
  readonly quantidade: number;
  readonly invalidas: number;
  readonly conflitos: number;
  readonly enviando: boolean;
  readonly erro: string | null;
  readonly aoSalvar: () => void;
  readonly aoDescartar: () => void;
}) {
  const bloqueio =
    props.invalidas > 0
      ? `Corrija ${plural(props.invalidas, 'valor inválido', 'valores inválidos')} para salvar.`
      : props.conflitos > 0
        ? 'Escolha o que fazer com os valores que outra pessoa salvou.'
        : null;
  return (
    <Box
      role="region"
      aria-label="Salvar lançamentos"
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10,
        bgcolor: CORES.branco,
        borderTop: `1px solid ${CORES.borda}`,
        boxShadow: '0 -4px 16px rgba(19, 49, 77, 0.08)',
        px: 2,
        pt: 1.5,
        pb: 'calc(12px + env(safe-area-inset-bottom))',
        ml: { md: '272px' },
      }}
    >
      {(props.erro ?? bloqueio) !== null && (
        <Typography
          role="alert"
          variant="body2"
          sx={{ mb: 1, color: props.erro === null ? CORES.textoSecundario : 'error.main' }}
        >
          {props.erro ?? bloqueio}
        </Typography>
      )}
      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
        <Button onClick={props.aoDescartar} sx={{ minHeight: 48 }}>
          Descartar
        </Button>
        <Button
          variant="contained"
          onClick={props.aoSalvar}
          loading={props.enviando}
          disabled={bloqueio !== null}
          sx={{ minHeight: 48, flex: { xs: 1, sm: 'none' } }}
        >
          Salvar{' '}
          {plural(props.quantidade - props.invalidas || props.quantidade, 'valor', 'valores')}
        </Button>
      </Stack>
    </Box>
  );
}
