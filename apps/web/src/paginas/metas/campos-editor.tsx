import { MenuItem, TextField, type TextFieldProps } from '@mui/material';
import type { MutableRefObject } from 'react';
import { type Path, useController, type UseFormReturn } from 'react-hook-form';

import type { CamposCalculo, FormularioMeta } from './formulario';

/** Campos do editor de metas ligados ao formulário (um só `useForm` para a mãe e as submetas). */

export type FormEditor = UseFormReturn<FormularioMeta>;

/** Onde está o item editado: a meta-mãe ou uma submeta. */
export type Base = 'raiz' | `submetas.${number}`;

/** Base da submeta de índice `i`. */
export const baseSubmeta = (i: number) => `submetas.${String(i)}` as `submetas.${number}`;

/** Caminho de um campo da atribuição de índice `i`. */
export const campoAtribuicao = (i: number, campo: 'usuarioId' | 'peso') =>
  `atribuicoes.${String(i)}.${campo}` as `atribuicoes.${number}.${typeof campo}`;

/** Caminho de um campo de cálculo da mãe ou de uma submeta. */
export const caminho = <K extends Extract<keyof CamposCalculo, string>>(base: Base, campo: K) =>
  `${base}.${campo}` as const;

type PropsTexto = Omit<TextFieldProps, 'name' | 'value' | 'onChange' | 'select'>;

/** Texto ligado ao formulário. Números também são texto: são digitados em pt-BR. */
export function Texto(
  props: {
    readonly form: FormEditor;
    readonly nome: Path<FormularioMeta>;
    readonly somenteLeitura?: boolean;
    /** Referência ao campo, além da do formulário (ex.: inserir texto na posição do cursor). */
    readonly campoRef?: MutableRefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  } & PropsTexto,
) {
  const { form, nome, somenteLeitura, campoRef, ...resto } = props;
  const { field, fieldState } = useController({ control: form.control, name: nome });
  return (
    <TextField
      {...resto}
      name={field.name}
      value={typeof field.value === 'string' ? field.value : ''}
      onChange={(evento) => {
        field.onChange(evento.target.value);
      }}
      onBlur={field.onBlur}
      inputRef={(elemento: HTMLInputElement | HTMLTextAreaElement | null) => {
        field.ref(elemento);
        if (campoRef !== undefined) campoRef.current = elemento;
      }}
      disabled={somenteLeitura === true || resto.disabled === true}
      error={fieldState.error !== undefined || resto.error === true}
      helperText={fieldState.error?.message ?? resto.helperText}
      fullWidth
    />
  );
}

/** Seleção ligada ao formulário; `numerico` grava número (meses). */
export function Selecao(
  props: {
    readonly form: FormEditor;
    readonly nome: Path<FormularioMeta>;
    readonly opcoes: readonly { readonly valor: string | number; readonly rotulo: string }[];
    readonly numerico?: boolean;
    readonly somenteLeitura?: boolean;
  } & PropsTexto,
) {
  const { form, nome, opcoes, numerico, somenteLeitura, ...resto } = props;
  const { field } = useController({ control: form.control, name: nome });
  const valor =
    typeof field.value === 'string' || typeof field.value === 'number' ? field.value : '';
  return (
    <TextField
      {...resto}
      select
      name={field.name}
      value={valor}
      onChange={(evento) => {
        field.onChange(numerico === true ? Number(evento.target.value) : evento.target.value);
      }}
      onBlur={field.onBlur}
      inputRef={field.ref}
      disabled={somenteLeitura === true || resto.disabled === true}
      fullWidth
    >
      {opcoes.map((opcao) => (
        <MenuItem key={opcao.valor} value={opcao.valor}>
          {opcao.rotulo}
        </MenuItem>
      ))}
    </TextField>
  );
}
