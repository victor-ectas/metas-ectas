import AddIcon from '@mui/icons-material/Add';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { avaliar, chaveVariavel, parse, validar, variaveisUsadas } from '@metas/motor';
import {
  Acumulacao,
  ModoApuracao,
  Operador,
  RegraPontuacao,
  type ResponsavelSetor,
  type Setor,
  TipoVariavel,
  Unidade,
  type Variavel,
} from '@metas/tipos';
import { type ReactNode, useMemo, useRef, useState } from 'react';
import { useWatch } from 'react-hook-form';

import { plural } from '../../app/plural';
import {
  AJUDA_MODO_APURACAO,
  ROTULO_ACUMULACAO,
  ROTULO_MODO_APURACAO,
  ROTULO_OPERADOR,
  ROTULO_REGRA_PONTUACAO,
  ROTULO_TIPO_VARIAVEL,
  ROTULO_UNIDADE,
} from '../../app/rotulos';
import { CORES } from '../../app/tema';
import { formatarValor, nomeMes } from '../../formatacao';
import { DialogoVariavel } from '../variaveis/dialogo-variavel';
import {
  type Base,
  caminho,
  campoAtribuicao,
  type FormEditor,
  Selecao,
  Texto,
} from './campos-editor';
import { type CamposCalculo, lerNumero } from './formulario';

/** O que as etapas precisam saber além do formulário. */
export interface ContextoEditor {
  readonly cicloId: string;
  readonly setores: readonly Setor[];
  readonly variaveis: readonly Variavel[];
  readonly gestores: readonly { id: string; nome: string }[];
  readonly responsaveis: readonly ResponsavelSetor[];
  readonly somenteLeitura: boolean;
}

export interface PropsEtapa {
  readonly form: FormEditor;
  readonly base: Base;
  readonly contexto: ContextoEditor;
}

const MESES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const OPCOES_MESES = MESES.map((mes) => ({ valor: mes, rotulo: nomeMes(mes) }));
const opcoes = <T extends string>(rotulos: Readonly<Record<T, string>>) =>
  (Object.entries(rotulos) as [T, string][]).map(([valor, rotulo]) => ({ valor, rotulo }));

/** Item editado (mãe ou submeta), observado ao vivo. */
function useItem(form: FormEditor, base: Base): CamposCalculo {
  return useWatch({ control: form.control, name: base });
}

function Secao(props: {
  readonly titulo: string;
  readonly ajuda?: string;
  readonly children: ReactNode;
}) {
  return (
    <Box component="section" sx={{ '& + &': { mt: 3 } }}>
      <Typography variant="h3" sx={{ fontSize: 17, color: CORES.marinho, mb: 0.5 }}>
        {props.titulo}
      </Typography>
      {props.ajuda !== undefined && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, maxWidth: '70ch' }}>
          {props.ajuda}
        </Typography>
      )}
      {props.children}
    </Box>
  );
}

/**
 * Variáveis que a fórmula da meta pode usar, pela chave (RF-20, especificação 6.2): `CODIGO` para
 * as do setor da meta e `SETOR.CODIGO` para as de qualquer setor. Só as ativas.
 */
export function variaveisDisponiveis(variaveis: readonly Variavel[], setorId: string) {
  const porChave = new Map<string, Variavel>();
  for (const v of variaveis) {
    if (!v.ativo) continue;
    porChave.set(`${v.setorCodigo}.${v.codigo}`, v);
    if (v.setorId === setorId) porChave.set(v.codigo, v);
  }
  return porChave;
}

// ---------------------------------------------------------------------------------------------
// 1. O que é
// ---------------------------------------------------------------------------------------------

export function EtapaOQueE({ form, base, contexto }: PropsEtapa) {
  const raiz = base === 'raiz';
  const ro = contexto.somenteLeitura;
  const setorId = useWatch({ control: form.control, name: 'setorId' });
  const responsavelId = useWatch({ control: form.control, name: 'responsavelId' });
  const doSetor = contexto.responsaveis.find((r) => r.setor.id === setorId);
  const setores = contexto.setores.filter((s) => s.ativo || s.id === setorId);

  return (
    <Stack spacing={2}>
      {raiz && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Selecao
            form={form}
            nome="setorId"
            label="Setor"
            required
            somenteLeitura={ro}
            opcoes={setores.map((s) => ({ valor: s.id, rotulo: s.nome }))}
            helperText={
              setores.find((s) => s.id === setorId)?.corporativo === true
                ? 'Meta do bloco Corporativo: pode ser atribuída a vários gestores.'
                : 'Meta do bloco Departamental do gestor responsável.'
            }
          />
          <Selecao
            form={form}
            nome="responsavelId"
            label="Gestor responsável"
            required
            somenteLeitura={ro}
            opcoes={contexto.gestores.map((g) => ({ valor: g.id, rotulo: g.nome }))}
            helperText={
              doSetor?.usuarioNome == null
                ? 'O setor ainda não tem responsável neste ciclo.'
                : doSetor.usuarioId === responsavelId
                  ? `É o responsável pelo setor no ciclo.`
                  : `Responsável pelo setor no ciclo: ${doSetor.usuarioNome}.`
            }
          />
        </Stack>
      )}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <Texto
          form={form}
          nome={caminho(base, 'indicador')}
          label="Indicador"
          placeholder="Ex.: Requisições atendidas no prazo"
          required
          somenteLeitura={ro}
          autoComplete="off"
        />
        <Texto
          form={form}
          nome={caminho(base, 'codigo')}
          label="Código"
          placeholder="Ex.: FISCAL_PRAZO"
          required
          somenteLeitura={ro}
          autoComplete="off"
          spellCheck={false}
          helperText="Único no ciclo. Letras sem acento, números e _."
          slotProps={{ htmlInput: { style: { textTransform: 'uppercase' }, translate: 'no' } }}
          sx={{ maxWidth: { sm: 260 } }}
        />
      </Stack>
      <Texto
        form={form}
        nome={caminho(base, 'metrica')}
        label="Como é medida"
        placeholder="Ex.: requisições atendidas em até 2 dias ÷ total de requisições recebidas"
        required
        somenteLeitura={ro}
        multiline
        minRows={2}
      />
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ alignItems: { sm: 'center' } }}
      >
        <Selecao
          form={form}
          nome={caminho(base, 'unidade')}
          label="Unidade do resultado"
          somenteLeitura={ro}
          opcoes={opcoes(ROTULO_UNIDADE)}
          helperText="Como o resultado, o objetivo e a tolerância são exibidos."
          sx={{ maxWidth: { sm: 300 } }}
        />
        <ChaveAtiva form={form} base={base} somenteLeitura={ro} />
      </Stack>
    </Stack>
  );
}

function ChaveAtiva(props: { form: FormEditor; base: Base; somenteLeitura: boolean }) {
  const ativo = useWatch({ control: props.form.control, name: caminho(props.base, 'ativo') });
  return (
    <FormControlLabel
      control={
        <Switch
          checked={ativo}
          disabled={props.somenteLeitura}
          onChange={(evento) => {
            props.form.setValue(caminho(props.base, 'ativo'), evento.target.checked, {
              shouldDirty: true,
            });
          }}
        />
      }
      label={props.base === 'raiz' ? 'Meta ativa' : 'Submeta ativa'}
      sx={{ minHeight: 44 }}
    />
  );
}

// ---------------------------------------------------------------------------------------------
// 2. Variáveis
// ---------------------------------------------------------------------------------------------

export function EtapaVariaveis({ form, base, contexto }: PropsEtapa) {
  const item = useItem(form, base);
  const setorId = useWatch({ control: form.control, name: 'setorId' });
  const setor = contexto.setores.find((s) => s.id === setorId);
  const [criando, setCriando] = useState(false);
  const [busca, setBusca] = useState('');
  const disponiveis = useMemo(
    () => variaveisDisponiveis(contexto.variaveis, setorId),
    [contexto.variaveis, setorId],
  );
  const usadas = useMemo(() => chavesUsadas(item.formula), [item.formula]);

  const doSetor = contexto.variaveis.filter((v) => v.setorId === setorId && v.ativo);
  const termo = busca.trim().toUpperCase();
  const deFora =
    termo === ''
      ? []
      : contexto.variaveis
          .filter((v) => v.setorId !== setorId && v.ativo)
          .filter(
            (v) =>
              `${v.setorCodigo}.${v.codigo}`.includes(termo) ||
              v.nome.toUpperCase().includes(termo),
          )
          .slice(0, 20);

  const inserir = (chave: string) => {
    const atual = form.getValues(caminho(base, 'formula'));
    const separador = atual.trim() === '' ? '' : ' ';
    form.setValue(caminho(base, 'formula'), `${atual.trimEnd()}${separador}${chave}`, {
      shouldDirty: true,
    });
  };

  const linha = (v: Variavel, chave: string) => (
    <Box
      component="li"
      key={v.id}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        py: 1,
        px: 1.5,
        borderBottom: `1px solid ${CORES.borda}`,
        '&:last-child': { borderBottom: 0 },
      }}
    >
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Box sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{v.nome}</Box>
        <Typography variant="body2" color="text.secondary">
          <Box component="span" translate="no" sx={{ color: CORES.azulEscuro, fontWeight: 600 }}>
            {chave}
          </Box>{' '}
          — {ROTULO_TIPO_VARIAVEL[v.tipo]}, {ROTULO_ACUMULACAO[v.acumulacao].toLowerCase()}
        </Typography>
      </Box>
      {usadas.has(chave) ? (
        <Chip size="small" color="success" variant="outlined" label="Na fórmula" />
      ) : (
        <Button
          size="small"
          disabled={contexto.somenteLeitura || disponiveis.get(chave) === undefined}
          onClick={() => {
            inserir(chave);
          }}
        >
          Usar
        </Button>
      )}
    </Box>
  );

  const lista = (itens: ReactNode[]) => (
    <Box
      component="ul"
      sx={{
        listStyle: 'none',
        m: 0,
        p: 0,
        border: `1px solid ${CORES.borda}`,
        borderRadius: 2,
        bgcolor: CORES.branco,
      }}
    >
      {itens}
    </Box>
  );

  return (
    <Stack spacing={3}>
      <Secao
        titulo={`Variáveis de ${setor?.nome ?? 'o setor'}`}
        ajuda="O que o responsável pelo setor lança todo mês. Escolha as que a fórmula usa; elas entram na fórmula pelo código."
      >
        {doSetor.length === 0 ? (
          <Alert severity="info">
            Este setor ainda não tem variáveis no ciclo. Crie a primeira.
          </Alert>
        ) : (
          lista(doSetor.map((v) => linha(v, v.codigo)))
        )}
        {!contexto.somenteLeitura && (
          <Button
            startIcon={<AddIcon />}
            sx={{ mt: 1.5 }}
            onClick={() => {
              setCriando(true);
            }}
          >
            Nova variável
          </Button>
        )}
      </Secao>
      <Secao
        titulo="Variáveis de outros setores"
        ajuda="Para usar a variável de outro setor, ela entra com o código do setor na frente (ex.: RH.TOTAL_COLAB)."
      >
        <TextField
          label="Buscar em outros setores"
          type="search"
          value={busca}
          onChange={(evento) => {
            setBusca(evento.target.value);
          }}
          placeholder="Código, setor ou nome…"
          autoComplete="off"
          spellCheck={false}
          fullWidth
          sx={{ mb: 1.5, bgcolor: CORES.branco }}
        />
        {termo !== '' &&
          (deFora.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Nenhuma variável encontrada.
            </Typography>
          ) : (
            lista(deFora.map((v) => linha(v, `${v.setorCodigo}.${v.codigo}`)))
          ))}
      </Secao>
      {criando && (
        <DialogoVariavel
          cicloId={contexto.cicloId}
          variavel={null}
          setores={contexto.setores}
          setorInicial={setorId}
          aoFechar={() => {
            setCriando(false);
          }}
        />
      )}
    </Stack>
  );
}

/** Chaves de variável que a fórmula usa (vazio enquanto ela não é uma fórmula válida). */
function chavesUsadas(formula: string): Set<string> {
  try {
    return new Set(variaveisUsadas(parse(formula)).map(chaveVariavel));
  } catch {
    return new Set();
  }
}

// ---------------------------------------------------------------------------------------------
// 3. Fórmula
// ---------------------------------------------------------------------------------------------

const OPERADORES_FORMULA = ['+', '-', '*', '/', '(', ')', '>=', '<='];
const FUNCOES_FORMULA = ['SE(', 'ARRED(', 'MIN(', 'MAX(', 'ABS(', 'E(', 'OU('];

export function EtapaFormula({ form, base, contexto }: PropsEtapa) {
  const item = useItem(form, base);
  const setorId = useWatch({ control: form.control, name: 'setorId' });
  const soAgrega = useWatch({ control: form.control, name: 'soAgrega' });
  const submetas = useWatch({ control: form.control, name: 'submetas' });
  const campoRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const disponiveis = useMemo(
    () => variaveisDisponiveis(contexto.variaveis, setorId),
    [contexto.variaveis, setorId],
  );
  const semFormula = base === 'raiz' && submetas.length > 0 && soAgrega;

  const inserir = (texto: string) => {
    const atual = form.getValues(caminho(base, 'formula'));
    const elemento = campoRef.current;
    const inicio = elemento?.selectionStart ?? atual.length;
    const fim = elemento?.selectionEnd ?? atual.length;
    const antes = atual.slice(0, inicio);
    const espaco = antes === '' || antes.endsWith(' ') || antes.endsWith('(') ? '' : ' ';
    const novo = `${antes}${espaco}${texto}${atual.slice(fim)}`;
    form.setValue(caminho(base, 'formula'), novo, { shouldDirty: true });
    const cursor = (antes + espaco + texto).length;
    requestAnimationFrame(() => {
      elemento?.focus();
      elemento?.setSelectionRange(cursor, cursor);
    });
  };

  return (
    <Stack spacing={2}>
      {base === 'raiz' && submetas.length > 0 && (
        <FormControlLabel
          control={
            <Switch
              checked={soAgrega}
              disabled={contexto.somenteLeitura}
              onChange={(evento) => {
                form.setValue('soAgrega', evento.target.checked, { shouldDirty: true });
              }}
            />
          }
          label="Esta meta só agrega as submetas (sem fórmula própria)"
          sx={{ minHeight: 44 }}
        />
      )}
      {semFormula ? (
        <Alert severity="info">
          O atendimento desta meta é a soma do atendimento de cada submeta pelo seu peso interno
          (RN-27). A fórmula fica nas submetas.
        </Alert>
      ) : (
        <>
          <Texto
            form={form}
            nome={caminho(base, 'formula')}
            label="Fórmula"
            placeholder="Ex.: REQ_ATENDIDOS / TOTAL_REQ"
            somenteLeitura={contexto.somenteLeitura}
            multiline
            minRows={2}
            autoComplete="off"
            spellCheck={false}
            campoRef={campoRef}
            slotProps={{
              htmlInput: {
                translate: 'no',
                style: { fontFamily: 'ui-monospace, "Cascadia Mono", Consolas, monospace' },
              },
            }}
          />
          {!contexto.somenteLeitura && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                Toque para inserir na posição do cursor:
              </Typography>
              <Stack direction="row" useFlexGap spacing={0.75} sx={{ flexWrap: 'wrap' }}>
                {[...disponiveis.keys()]
                  .filter((chave) => !chave.includes('.'))
                  .map((chave) => (
                    <Chip
                      key={chave}
                      label={chave}
                      translate="no"
                      onClick={() => {
                        inserir(chave);
                      }}
                      sx={{ fontWeight: 600, bgcolor: CORES.turquesaClaro, color: CORES.marinho }}
                    />
                  ))}
                {OPERADORES_FORMULA.map((op) => (
                  <Chip
                    key={op}
                    label={op}
                    variant="outlined"
                    aria-label={`Inserir ${op}`}
                    onClick={() => {
                      inserir(op);
                    }}
                    sx={{ minWidth: 44, fontWeight: 700 }}
                  />
                ))}
                {FUNCOES_FORMULA.map((fn) => (
                  <Chip
                    key={fn}
                    label={`${fn})`}
                    variant="outlined"
                    translate="no"
                    onClick={() => {
                      inserir(fn);
                    }}
                  />
                ))}
              </Stack>
            </Box>
          )}
          <ResultadoValidacao
            formula={item.formula}
            disponiveis={disponiveis}
            unidade={item.unidade}
          />
        </>
      )}
    </Stack>
  );
}

/** Validação ao vivo com o motor (o mesmo da API) e o teste com valores (RF-17). */
function ResultadoValidacao(props: {
  formula: string;
  disponiveis: Map<string, Variavel>;
  unidade: Unidade;
}) {
  const [valores, setValores] = useState<Record<string, string>>({});
  const resultado = useMemo(
    () => (props.formula.trim() === '' ? null : validar(props.formula, props.disponiveis.keys())),
    [props.formula, props.disponiveis],
  );
  if (resultado === null) {
    return (
      <Typography variant="body2" color="text.secondary">
        Escreva a fórmula com os códigos das variáveis. Separe os argumentos das funções com ";"
        (ex.: ARRED(X; 2)).
      </Typography>
    );
  }
  if (!resultado.valida) {
    return (
      <Alert severity="error" icon={<ErrorOutlinedIcon />} role="status">
        {resultado.erros.map((e) => (
          <div key={`${String(e.posicao)}-${e.mensagem}`}>{e.mensagem}</div>
        ))}
      </Alert>
    );
  }

  const usadas = resultado.variaveis.map((ref) =>
    ref.setor === null ? ref.codigo : `${ref.setor}.${ref.codigo}`,
  );
  // Valores digitados → escopo do motor (percentual de 0 a 100 vira fração, RN-11).
  const escopo: Record<string, string | null> = {};
  let invalido = false;
  for (const chave of usadas) {
    const numero = lerNumero(valores[chave] ?? '');
    if (numero === undefined) invalido = true;
    const tipo = props.disponiveis.get(chave)?.tipo;
    escopo[chave] =
      numero == null
        ? null
        : (tipo === TipoVariavel.PERCENTUAL ? numero.dividedBy(100) : numero).toFixed();
  }
  const teste = invalido ? null : avaliar(resultado.ast, escopo);
  const completo = usadas.every((chave) => escopo[chave] != null);

  return (
    <Stack spacing={2}>
      <Alert severity="success" icon={<CheckCircleOutlinedIcon />} role="status">
        Fórmula válida
        {usadas.length > 0 && <>: usa {usadas.join(', ')}</>}.
      </Alert>
      {usadas.length > 0 && (
        <Box
          sx={{ p: 2, border: `1px solid ${CORES.borda}`, borderRadius: 2, bgcolor: CORES.espuma }}
        >
          <Typography variant="h3" sx={{ fontSize: 16, color: CORES.marinho, mb: 1.5 }}>
            Testar com valores
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gap: 1.5,
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fill, minmax(200px, 1fr))' },
            }}
          >
            {usadas.map((chave) => {
              const tipo = props.disponiveis.get(chave)?.tipo;
              return (
                <TextField
                  key={chave}
                  label={chave}
                  value={valores[chave] ?? ''}
                  onChange={(evento) => {
                    setValores((atual) => ({ ...atual, [chave]: evento.target.value }));
                  }}
                  error={lerNumero(valores[chave] ?? '') === undefined}
                  helperText={
                    tipo === TipoVariavel.PERCENTUAL
                      ? 'De 0 a 100'
                      : tipo === TipoVariavel.SIM_NAO
                        ? '1 = Sim, 0 = Não'
                        : undefined
                  }
                  autoComplete="off"
                  slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                  sx={{ '& .MuiInputBase-root': { bgcolor: CORES.branco } }}
                />
              );
            })}
          </Box>
          <Typography sx={{ mt: 1.5, fontWeight: 600 }} aria-live="polite">
            {invalido
              ? 'Confira os valores: use números como 16 ou 0,5.'
              : !completo
                ? 'Preencha os valores para ver o resultado. Vazio deixa o resultado vazio (RN-16).'
                : teste?.valor == null
                  ? teste !== null && teste.avisos.length > 0
                    ? 'Resultado vazio: divisão por zero.'
                    : 'Resultado vazio.'
                  : `Resultado: ${formatarValor(teste.valor.toFixed(), props.unidade)}`}
          </Typography>
        </Box>
      )}
    </Stack>
  );
}

// ---------------------------------------------------------------------------------------------
// 4. Acumulação e período
// ---------------------------------------------------------------------------------------------

export function EtapaPeriodo({ form, base, contexto }: PropsEtapa) {
  const item = useItem(form, base);
  const setorId = useWatch({ control: form.control, name: 'setorId' });
  const soAgrega = useWatch({ control: form.control, name: 'soAgrega' });
  const submetas = useWatch({ control: form.control, name: 'submetas' });
  const ro = contexto.somenteLeitura;
  const disponiveis = useMemo(
    () => variaveisDisponiveis(contexto.variaveis, setorId),
    [contexto.variaveis, setorId],
  );
  const validacao = useMemo(
    () => (item.formula.trim() === '' ? null : validar(item.formula, disponiveis.keys())),
    [item.formula, disponiveis],
  );
  const usadas =
    validacao?.valida === true
      ? validacao.variaveis.map((ref) =>
          ref.setor === null ? ref.codigo : `${ref.setor}.${ref.codigo}`,
        )
      : [];
  const semFormula = base === 'raiz' && submetas.length > 0 && soAgrega;

  return (
    <Stack spacing={3}>
      <Secao
        titulo="Período"
        ajuda="Só os meses do período contam para o acumulado e a nota. Lançamentos fora dele ficam como histórico (RN-13, RN-14)."
      >
        <Stack direction="row" spacing={2} sx={{ maxWidth: 480 }}>
          <Selecao
            form={form}
            nome={caminho(base, 'mesInicio')}
            label="De"
            numerico
            opcoes={OPCOES_MESES}
            somenteLeitura={ro}
          />
          <Selecao
            form={form}
            nome={caminho(base, 'mesFim')}
            label="Até"
            numerico
            opcoes={OPCOES_MESES.filter((o) => o.valor >= item.mesInicio)}
            somenteLeitura={ro}
            error={item.mesFim < item.mesInicio}
            helperText={
              item.mesFim < item.mesInicio ? 'O mês final vem depois do inicial.' : undefined
            }
          />
        </Stack>
      </Secao>
      {!semFormula && (
        <Secao
          titulo="Como acumular o resultado"
          ajuda="Como os meses do período viram um resultado só (RN-17)."
        >
          <RadioGroup
            value={item.modoApuracao}
            onChange={(evento) => {
              form.setValue(caminho(base, 'modoApuracao'), evento.target.value as ModoApuracao, {
                shouldDirty: true,
              });
            }}
          >
            {Object.values(ModoApuracao).map((modo) => (
              <FormControlLabel
                key={modo}
                value={modo}
                disabled={ro}
                control={<Radio />}
                sx={{ alignItems: 'flex-start', mb: 1, '& .MuiRadio-root': { mt: -0.5 } }}
                label={
                  <Box>
                    <Box sx={{ fontWeight: 600 }}>{ROTULO_MODO_APURACAO[modo]}</Box>
                    <Typography variant="body2" color="text.secondary">
                      {AJUDA_MODO_APURACAO[modo]}
                    </Typography>
                  </Box>
                }
              />
            ))}
          </RadioGroup>
          {item.modoApuracao === ModoApuracao.FORMULA_SOBRE_ACUMULADOS && usadas.length > 0 && (
            <Alert severity="info" sx={{ mt: 1 }}>
              Cada variável acumula pela sua regra:{' '}
              {usadas
                .map((chave) => {
                  const v = disponiveis.get(chave);
                  return `${chave} (${v === undefined ? '?' : ROTULO_ACUMULACAO[v.acumulacao].toLowerCase()})`;
                })
                .join(', ')}
              . A regra é da variável e muda na tela Variáveis.
            </Alert>
          )}
          {item.modoApuracao !== ModoApuracao.FORMULA_SOBRE_ACUMULADOS &&
            usadas.length > 1 &&
            usadas.every((c) => disponiveis.get(c)?.acumulacao === Acumulacao.SOMA) && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                Para razões (A / B), o recomendado é "Fórmula sobre os acumulados": a média das
                razões mensais é diferente da razão dos totais.
              </Alert>
            )}
        </Secao>
      )}
    </Stack>
  );
}

// ---------------------------------------------------------------------------------------------
// 5. Objetivo, operador, peso e pontuação
// ---------------------------------------------------------------------------------------------

export function EtapaObjetivo({ form, base, contexto }: PropsEtapa) {
  const item = useItem(form, base);
  const soAgrega = useWatch({ control: form.control, name: 'soAgrega' });
  const submetas = useWatch({ control: form.control, name: 'submetas' });
  const ro = contexto.somenteLeitura;
  const raiz = base === 'raiz';
  const semFormula = raiz && submetas.length > 0 && soAgrega;
  const sufixo = item.unidade === Unidade.PERCENTUAL ? '%' : undefined;
  const adorno =
    sufixo === undefined
      ? undefined
      : { input: { endAdornment: <InputAdornment position="end">{sufixo}</InputAdornment> } };

  return (
    <Stack spacing={3}>
      {!semFormula && (
        <Secao
          titulo="Quando bate"
          ajuda={
            item.unidade === Unidade.PERCENTUAL
              ? 'Percentual digitado de 0 a 100 (80 = 80%).'
              : 'O acumulado é comparado com o objetivo do último mês do período (RN-15).'
          }
        >
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Selecao
                form={form}
                nome={caminho(base, 'operador')}
                label="O resultado precisa ser"
                opcoes={opcoes(ROTULO_OPERADOR)}
                somenteLeitura={ro}
              />
              {item.operador === Operador.FAIXA && (
                <Texto
                  form={form}
                  nome={caminho(base, 'tolerancia')}
                  label="Tolerância (±)"
                  somenteLeitura={ro}
                  slotProps={{ ...adorno, htmlInput: { inputMode: 'decimal' } }}
                />
              )}
            </Stack>
            <ToggleButtonGroup
              exclusive
              value={item.tipoObjetivo}
              disabled={ro}
              onChange={(_evento, valor: 'UNICO' | 'MENSAL' | null) => {
                if (valor !== null) {
                  form.setValue(caminho(base, 'tipoObjetivo'), valor, { shouldDirty: true });
                }
              }}
              aria-label="Tipo de objetivo"
              size="small"
            >
              <ToggleButton value="UNICO" sx={{ px: 2, minHeight: 44 }}>
                Objetivo único
              </ToggleButton>
              <ToggleButton value="MENSAL" sx={{ px: 2, minHeight: 44 }}>
                Objetivo por mês
              </ToggleButton>
            </ToggleButtonGroup>
            {item.tipoObjetivo === 'UNICO' ? (
              <Texto
                form={form}
                nome={caminho(base, 'objetivoUnico')}
                label="Objetivo"
                required
                somenteLeitura={ro}
                autoComplete="off"
                slotProps={{ ...adorno, htmlInput: { inputMode: 'decimal' } }}
                sx={{ maxWidth: 260 }}
              />
            ) : (
              <Box
                sx={{
                  display: 'grid',
                  gap: 1.5,
                  gridTemplateColumns: {
                    xs: 'repeat(2, 1fr)',
                    sm: 'repeat(auto-fill, minmax(150px, 1fr))',
                  },
                }}
              >
                {MESES.filter((mes) => mes >= item.mesInicio && mes <= item.mesFim).map((mes) => (
                  <Texto
                    key={mes}
                    form={form}
                    nome={
                      `${base}.objetivosMensais.${String(mes)}` as `raiz.objetivosMensais.${number}`
                    }
                    label={nomeMes(mes)}
                    required={mes === item.mesFim}
                    somenteLeitura={ro}
                    autoComplete="off"
                    slotProps={{ ...adorno, htmlInput: { inputMode: 'decimal' } }}
                  />
                ))}
              </Box>
            )}
          </Stack>
        </Secao>
      )}
      {raiz ? (
        <Pontuacao form={form} contexto={contexto} item={item} />
      ) : (
        <PesoInterno form={form} base={base} ro={ro} />
      )}
    </Stack>
  );
}

function PesoInterno(props: {
  form: FormEditor;
  base: Base;
  ro: boolean;
  titulo?: string;
  ajuda?: string;
}) {
  return (
    <Secao
      titulo={props.titulo ?? 'Peso dentro da meta-mãe'}
      ajuda={
        props.ajuda ??
        'Quanto esta submeta pesa no atendimento da mãe. Os pesos internos somam 100% (RN-04).'
      }
    >
      <Texto
        form={props.form}
        nome={caminho(props.base, 'pesoInterno')}
        label="Peso interno"
        required
        somenteLeitura={props.ro}
        autoComplete="off"
        slotProps={{
          input: { endAdornment: <InputAdornment position="end">%</InputAdornment> },
          htmlInput: { inputMode: 'decimal' },
        }}
        sx={{ maxWidth: 220 }}
      />
    </Secao>
  );
}

function Pontuacao(props: { form: FormEditor; contexto: ContextoEditor; item: CamposCalculo }) {
  const { form, contexto, item } = props;
  const ro = contexto.somenteLeitura;
  const setorId = useWatch({ control: form.control, name: 'setorId' });
  const responsavelId = useWatch({ control: form.control, name: 'responsavelId' });
  const regra = useWatch({ control: form.control, name: 'regraPontuacao' });
  const atribuicoes = useWatch({ control: form.control, name: 'atribuicoes' });
  const soAgrega = useWatch({ control: form.control, name: 'soAgrega' });
  const submetas = useWatch({ control: form.control, name: 'submetas' });
  const corporativo = contexto.setores.find((s) => s.id === setorId)?.corporativo === true;
  const faixa = item.operador === Operador.FAIXA;
  const objetivoTexto =
    item.tipoObjetivo === 'UNICO'
      ? item.objetivoUnico
      : (item.objetivosMensais[item.mesFim - 1] ?? '');
  const objetivo = lerNumero(objetivoTexto);
  const objetivoNaoPositivo = objetivo != null && objetivo.lte(0);
  const nomeDe = (id: string) => contexto.gestores.find((g) => g.id === id)?.nome ?? 'Gestor';

  return (
    <>
      <Secao
        titulo="Pontuação"
        ajuda="Atendimento nunca passa de 100%, e os pontos nunca passam do peso (RN-24)."
      >
        <RadioGroup
          value={faixa ? RegraPontuacao.TUDO_OU_NADA : regra}
          onChange={(evento) => {
            form.setValue('regraPontuacao', evento.target.value as RegraPontuacao, {
              shouldDirty: true,
            });
          }}
        >
          <FormControlLabel
            value={RegraPontuacao.TUDO_OU_NADA}
            control={<Radio />}
            disabled={ro}
            label={`${ROTULO_REGRA_PONTUACAO.TUDO_OU_NADA}: ganha o peso inteiro só se bater`}
          />
          <FormControlLabel
            value={RegraPontuacao.PROPORCIONAL}
            control={<Radio />}
            disabled={ro || faixa}
            label={`${ROTULO_REGRA_PONTUACAO.PROPORCIONAL}: peso × atendimento`}
          />
        </RadioGroup>
        {faixa && (
          <Typography variant="body2" color="text.secondary">
            Meta de faixa é sempre tudo ou nada (RN-22).
          </Typography>
        )}
        {!faixa && regra === RegraPontuacao.PROPORCIONAL && objetivoNaoPositivo && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            Com objetivo menor ou igual a zero, a pontuação proporcional não é permitida (RN-23).
            Use tudo ou nada.
          </Alert>
        )}
      </Secao>

      <Secao
        titulo={corporativo ? 'Gestores e pesos' : 'Peso no bloco do gestor'}
        ajuda={
          corporativo
            ? 'Meta corporativa: um resultado, atribuído a vários gestores, cada um com seu peso no bloco Corporativo (RN-05).'
            : 'Quantos pontos esta meta vale no bloco Departamental do responsável (os pesos do gestor somam 50 ou 100, RN-03).'
        }
      >
        {corporativo ? (
          <Stack spacing={1.5}>
            {atribuicoes.map((a, indice) => (
              <Stack
                key={`${a.usuarioId}-${String(indice)}`}
                direction="row"
                spacing={1}
                sx={{ alignItems: 'flex-start' }}
              >
                <TextField
                  select
                  label="Gestor"
                  value={a.usuarioId}
                  disabled={ro}
                  onChange={(evento) => {
                    form.setValue(campoAtribuicao(indice, 'usuarioId'), evento.target.value, {
                      shouldDirty: true,
                    });
                  }}
                  sx={{ flexGrow: 1, bgcolor: CORES.branco }}
                >
                  {contexto.gestores.map((g) => (
                    <MenuItem
                      key={g.id}
                      value={g.id}
                      disabled={
                        g.id !== a.usuarioId && atribuicoes.some((x) => x.usuarioId === g.id)
                      }
                    >
                      {g.nome}
                    </MenuItem>
                  ))}
                </TextField>
                <Texto
                  form={form}
                  nome={campoAtribuicao(indice, 'peso')}
                  label="Peso"
                  somenteLeitura={ro}
                  autoComplete="off"
                  slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                  sx={{ width: 120, flexShrink: 0 }}
                />
                {!ro && (
                  <Tooltip title="Tirar este gestor">
                    <IconButton
                      aria-label={`Tirar ${nomeDe(a.usuarioId)}`}
                      onClick={() => {
                        form.setValue(
                          'atribuicoes',
                          atribuicoes.filter((_x, i) => i !== indice),
                          { shouldDirty: true },
                        );
                      }}
                      sx={{ mt: 0.5 }}
                    >
                      <DeleteOutlinedIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            ))}
            {!ro && (
              <Button
                startIcon={<AddIcon />}
                sx={{ alignSelf: 'flex-start' }}
                onClick={() => {
                  const livre = contexto.gestores.find(
                    (g) => !atribuicoes.some((a) => a.usuarioId === g.id),
                  );
                  form.setValue(
                    'atribuicoes',
                    [...atribuicoes, { usuarioId: livre?.id ?? '', peso: '' }],
                    { shouldDirty: true },
                  );
                }}
              >
                Atribuir a outro gestor
              </Button>
            )}
          </Stack>
        ) : (
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Texto
              form={form}
              nome="atribuicoes.0.peso"
              label="Peso (pontos)"
              required
              somenteLeitura={ro}
              autoComplete="off"
              slotProps={{ htmlInput: { inputMode: 'decimal' } }}
              sx={{ maxWidth: 200 }}
            />
            <Typography variant="body2" color="text.secondary">
              para {nomeDe(responsavelId)}
            </Typography>
          </Stack>
        )}
      </Secao>

      {submetas.length > 0 && !soAgrega && (
        <PesoInterno
          form={form}
          base="raiz"
          ro={ro}
          titulo="Peso do resultado próprio"
          ajuda={`A fórmula desta meta entra como mais um componente, somando 100% com as ${plural(submetas.length, 'submeta', 'submetas')} (RN-30).`}
        />
      )}
    </>
  );
}
