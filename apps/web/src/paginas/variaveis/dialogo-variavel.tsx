import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
} from '@mui/material';
import {
  Acumulacao,
  OrigemVariavel,
  Perfil,
  type Setor,
  TipoVariavel,
  type Variavel,
  type VariavelEntrada,
  VariavelEntradaSchema,
} from '@metas/tipos';
import { useId, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

import { useUsuarios } from '../../api/cadastros';
import { useSalvarVariavel } from '../../api/variaveis';
import { plural } from '../../app/plural';
import {
  AJUDA_ACUMULACAO,
  ROTULO_ACUMULACAO,
  ROTULO_ORIGEM_VARIAVEL,
  ROTULO_TIPO_VARIAVEL,
} from '../../app/rotulos';
import { useAvisar } from '../../componentes/avisos';
import { CampoChave, CampoSelecao, CampoTexto } from '../../componentes/campos';
import { aplicarErrosDaApi } from '../../componentes/formulario';

type Formulario = z.input<typeof VariavelEntradaSchema>;

/** Com lançamentos ou usada em meta: setor, tipo e acumulação fixos, e não pode excluir. */
export const emUso = (v: Variavel) => v.temLancamentos || v.usadaPor.length > 0;

const CAMPOS = [
  'setorId',
  'codigo',
  'nome',
  'tipo',
  'acumulacao',
  'origem',
  'responsavelId',
  'casasDecimais',
  'ativo',
] as const;

const opcoes = <T extends string>(rotulos: Readonly<Record<T, string>>) =>
  (Object.keys(rotulos) as T[]).map((valor) => ({ valor, rotulo: rotulos[valor] }));

const AJUDA_TIPO: Partial<Record<TipoVariavel, string>> = {
  PERCENTUAL: 'O gestor digita de 0 a 100 (25 = 25%).',
  SIM_NAO: 'O gestor escolhe Sim ou Não; nas fórmulas vale 1 ou 0.',
};

/**
 * Cadastro e edição de variável (RF-19). Com lançamentos ou usada em meta, setor, tipo e
 * acumulação ficam fixos (decisão do desenvolvedor, 12/11/2026); a API confere de novo.
 */
export function DialogoVariavel(props: {
  readonly cicloId: string;
  readonly variavel: Variavel | null;
  readonly setores: readonly Setor[];
  /** Setor do filtro da tela, para já vir escolhido numa variável nova. */
  readonly setorInicial: string;
  readonly aoFechar: () => void;
}) {
  const { variavel } = props;
  const idTitulo = useId();
  const salvar = useSalvarVariavel(props.cicloId);
  const avisar = useAvisar();
  const gestores = useUsuarios({ perfil: Perfil.GESTOR, ativo: true, tamanho: 200 });
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const travada = variavel !== null && emUso(variavel);

  const { control, handleSubmit, setError } = useForm<Formulario, unknown, VariavelEntrada>({
    resolver: zodResolver(VariavelEntradaSchema),
    defaultValues: {
      setorId: variavel?.setorId ?? props.setorInicial,
      codigo: variavel?.codigo ?? '',
      nome: variavel?.nome ?? '',
      tipo: variavel?.tipo ?? TipoVariavel.NUMERO,
      acumulacao: variavel?.acumulacao ?? Acumulacao.SOMA,
      origem: variavel?.origem ?? OrigemVariavel.DIGITADA,
      responsavelId: variavel?.responsavelId ?? null,
      casasDecimais: variavel?.casasDecimais ?? 2,
      ativo: variavel?.ativo ?? true,
    },
  });
  const [setorId, tipo, acumulacao, codigo] = useWatch({
    control,
    name: ['setorId', 'tipo', 'acumulacao', 'codigo'],
  });
  const setor = props.setores.find((s) => s.id === setorId);
  const corporativo = setor?.corporativo === true;
  const codigoNovo = codigo.trim().toUpperCase();
  const renomeia =
    variavel !== null && variavel.usadaPor.length > 0 && codigoNovo !== variavel.codigo;

  // Setores para escolher: os ativos e, na edição, o atual (mesmo que inativo).
  const setores = props.setores.filter((s) => s.ativo || s.id === variavel?.setorId);
  const motivoTrava =
    variavel?.temLancamentos === true ? 'já tem lançamentos' : 'já é usada por metas';
  const ajudaTrava = travada ? `Fixo: a variável ${motivoTrava}.` : undefined;

  const enviar = handleSubmit((dados) => {
    setErroGeral(null);
    // Responsável próprio só no Corporativo (RN-07): ao trocar de setor, some.
    const corpo = corporativo ? dados : { ...dados, responsavelId: null };
    salvar.mutate(
      { id: variavel?.id ?? null, dados: corpo },
      {
        onSuccess: () => {
          avisar(variavel === null ? 'Variável cadastrada.' : 'Variável salva.');
          props.aoFechar();
        },
        onError: (erro) => {
          setErroGeral(aplicarErrosDaApi(erro, CAMPOS, setError));
        },
      },
    );
  });

  return (
    <Dialog open onClose={props.aoFechar} aria-labelledby={idTitulo} fullWidth maxWidth="sm">
      <form onSubmit={(evento) => void enviar(evento)} noValidate>
        <DialogTitle id={idTitulo}>
          {variavel === null ? 'Nova variável' : `Editar ${variavel.codigo}`}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <CampoTexto
              control={control}
              nome="nome"
              label="Nome"
              placeholder="Ex.: Requisições atendidas no prazo"
              autoComplete="off"
              required
            />
            <CampoTexto
              control={control}
              nome="codigo"
              label="Código (usado nas fórmulas)"
              placeholder="Ex.: REQ_ATENDIDOS"
              autoComplete="off"
              spellCheck={false}
              helperText="Letras sem acento, números e _, começando por letra."
              slotProps={{ htmlInput: { style: { textTransform: 'uppercase' }, translate: 'no' } }}
              required
            />
            {renomeia && (
              <Alert severity="warning">
                Ao salvar, o código muda também nas fórmulas de{' '}
                {plural(variavel.usadaPor.length, 'meta', 'metas')}:{' '}
                <span translate="no">{variavel.usadaPor.map((m) => m.codigo).join(', ')}</span>.
              </Alert>
            )}
            <CampoSelecao
              control={control}
              nome="setorId"
              label="Setor que lança"
              opcoes={setores.map((s) => ({ valor: s.id, rotulo: s.nome }))}
              disabled={travada}
              helperText={ajudaTrava}
              required
            />
            {corporativo && (
              <CampoSelecao
                control={control}
                nome="responsavelId"
                label="Responsável pelo lançamento"
                vazio="Ainda não definido"
                opcoes={(gestores.data?.itens ?? []).map((u) => ({ valor: u.id, rotulo: u.nome }))}
                helperText="Variáveis do Corporativo têm responsável próprio (um Gestor ativo). Sem ele, o ciclo não pode ser ativado."
              />
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <CampoSelecao
                control={control}
                nome="tipo"
                label="Tipo"
                opcoes={opcoes(ROTULO_TIPO_VARIAVEL)}
                disabled={travada}
                helperText={ajudaTrava ?? AJUDA_TIPO[tipo]}
                required
              />
              <CampoSelecao
                control={control}
                nome="acumulacao"
                label="Acumulação no período"
                opcoes={opcoes(ROTULO_ACUMULACAO)}
                disabled={travada}
                helperText={ajudaTrava ?? AJUDA_ACUMULACAO[acumulacao]}
                required
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <CampoSelecao
                control={control}
                nome="origem"
                label="Origem"
                opcoes={opcoes(ROTULO_ORIGEM_VARIAVEL)}
              />
              {tipo !== TipoVariavel.SIM_NAO && (
                <CampoTexto
                  control={control}
                  nome="casasDecimais"
                  label="Casas decimais"
                  type="number"
                  numerico
                  slotProps={{ htmlInput: { min: 0, max: 6, inputMode: 'numeric' } }}
                  helperText="Na digitação, de 0 a 6."
                />
              )}
            </Stack>
            <CampoChave
              control={control}
              nome="ativo"
              rotulo="Ativa"
              ajuda="Inativa, some da tela de lançamento. Não dá para inativar enquanto uma meta ativa a usa."
            />
            {erroGeral !== null && <Alert severity="error">{erroGeral}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={props.aoFechar}>Cancelar</Button>
          <Button type="submit" variant="contained" loading={salvar.isPending}>
            {variavel === null ? 'Cadastrar variável' : 'Salvar variável'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
