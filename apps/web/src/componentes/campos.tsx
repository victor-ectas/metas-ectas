import { FormControlLabel, FormHelperText, MenuItem, Switch, TextField } from '@mui/material';
import type { ComponentProps } from 'react';
import { type Control, Controller, type FieldValues, type Path } from 'react-hook-form';

/**
 * Campos de formulário ligados ao React Hook Form, com o erro do campo logo abaixo dele
 * (Web Interface Guidelines: erros ao lado do campo, foco no primeiro erro).
 */

type PropsTexto = Omit<ComponentProps<typeof TextField>, 'name' | 'value' | 'onChange' | 'error'>;

export function CampoTexto<T extends FieldValues>(
  props: {
    readonly control: Control<T>;
    readonly nome: Path<T>;
    /** Grava número (vazio vira `null`), para campos como o ano. */
    readonly numerico?: boolean;
  } & PropsTexto,
) {
  const { control, nome, helperText, numerico, ...resto } = props;
  return (
    <Controller
      control={control}
      name={nome}
      render={({ field, fieldState }) => (
        <TextField
          {...resto}
          name={field.name}
          value={field.value ?? ''}
          onChange={(evento) => {
            const texto = evento.target.value;
            field.onChange(numerico === true ? (texto === '' ? null : Number(texto)) : texto);
          }}
          onBlur={field.onBlur}
          inputRef={field.ref}
          error={fieldState.error !== undefined}
          helperText={fieldState.error?.message ?? helperText}
          fullWidth
        />
      )}
    />
  );
}

export function CampoSelecao<T extends FieldValues>(
  props: {
    readonly control: Control<T>;
    readonly nome: Path<T>;
    readonly opcoes: readonly { readonly valor: string; readonly rotulo: string }[];
    /** Opção "nenhum" que grava `null`. */
    readonly vazio?: string;
  } & PropsTexto,
) {
  const { control, nome, opcoes, vazio, helperText, ...resto } = props;
  return (
    <Controller
      control={control}
      name={nome}
      render={({ field, fieldState }) => (
        <TextField
          {...resto}
          select
          name={field.name}
          value={field.value ?? ''}
          onChange={(evento) => {
            field.onChange(evento.target.value === '' ? null : evento.target.value);
          }}
          onBlur={field.onBlur}
          inputRef={field.ref}
          error={fieldState.error !== undefined}
          helperText={fieldState.error?.message ?? helperText}
          fullWidth
        >
          {vazio !== undefined && (
            <MenuItem value="">
              <em>{vazio}</em>
            </MenuItem>
          )}
          {opcoes.map((opcao) => (
            <MenuItem key={opcao.valor} value={opcao.valor}>
              {opcao.rotulo}
            </MenuItem>
          ))}
        </TextField>
      )}
    />
  );
}

export function CampoChave<T extends FieldValues>(props: {
  readonly control: Control<T>;
  readonly nome: Path<T>;
  readonly rotulo: string;
  readonly ajuda?: string;
  readonly desabilitado?: boolean;
}) {
  return (
    <Controller
      control={props.control}
      name={props.nome}
      render={({ field, fieldState }) => (
        <div>
          <FormControlLabel
            control={
              <Switch
                name={field.name}
                checked={field.value === true}
                onChange={(evento) => {
                  field.onChange(evento.target.checked);
                }}
                onBlur={field.onBlur}
                slotProps={{ input: { ref: field.ref } }}
                disabled={props.desabilitado}
              />
            }
            label={props.rotulo}
            sx={{ minHeight: 44 }}
          />
          {(fieldState.error !== undefined || props.ajuda !== undefined) && (
            <FormHelperText error={fieldState.error !== undefined} sx={{ mt: -0.5, ml: 6 }}>
              {fieldState.error?.message ?? props.ajuda}
            </FormHelperText>
          )}
        </div>
      )}
    />
  );
}
