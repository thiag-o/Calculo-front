import { useEffect, type ReactNode } from 'react';
import type { FieldErrors, Path, UseFormRegister } from 'react-hook-form';
import { z } from 'zod';
import { Notice, PasswordField, TextField } from '../../design-system';
import type { ConnectionField, FormError } from './messages';
import type { Credential } from './queries';

/** The five credential fields, as typed (strings); `toCredential` converts them into the API body. */
export const credentialSchema = z.object({
  host: z.string().trim().min(1, 'Informe o host do banco'),
  port: z
    .string()
    .trim()
    .min(1, 'Informe a porta')
    .regex(/^\d+$/, 'Informe a porta só com números, como 5432')
    .refine((port) => Number(port) >= 1 && Number(port) <= 65535, 'Informe uma porta de 1 a 65535'),
  database: z.string().trim().min(1, 'Informe o nome do banco'),
  username: z.string().trim().min(1, 'Informe o usuário do banco'),
  // Not trimmed: spaces may be part of the password.
  password: z.string().min(1, 'Informe a senha'),
});

export type CredentialValues = z.infer<typeof credentialSchema>;

/** The credential body, read from the form at call time (it never goes into the cache; see `queries.ts`). */
export function toCredential(values: CredentialValues): Credential {
  return {
    host: values.host.trim(),
    port: Number(values.port.trim()),
    database: values.database.trim(),
    username: values.username.trim(),
    password: values.password,
  };
}

/** The error of a field: the client one first, then the API one. */
export function fieldError(errors: FieldErrors, apiError: FormError | undefined, field: ConnectionField): string | undefined {
  const message = errors[field]?.message;
  return (typeof message === 'string' ? message : undefined) ?? apiError?.fields[field];
}

/**
 * A test result belongs to the values that were tested: any change in the form discards it (and the error of the last
 * attempt), so the screen never shows "ok" for values that were not tested.
 */
export function useResetOnChange(watch: (callback: () => void) => { unsubscribe: () => void }, reset: () => void): void {
  useEffect(() => {
    const subscription = watch(() => reset());
    return () => subscription.unsubscribe();
  }, [watch, reset]);
}

export interface CredentialFieldsProps<T extends CredentialValues> {
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
  apiError?: FormError;
}

/**
 * Host, port, database, user and password of a connection. The password is a `type="password"` field, write-only: it starts
 * empty and never comes back from the API (design.md §4).
 */
export function CredentialFields<T extends CredentialValues>({ register, errors, apiError }: CredentialFieldsProps<T>) {
  const error = (field: keyof CredentialValues) => fieldError(errors, apiError, field);
  // T has the five credential fields (T extends CredentialValues), so each name is a path of the form.
  const field = (name: keyof CredentialValues) => register(name as Path<T>);
  return (
    <>
      <div className="fc-connections-row">
        <TextField
          label="Host"
          className="fc-connections-host"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="db.exemplo.com.br"
          error={error('host')}
          {...field('host')}
        />
        <TextField
          label="Porta"
          className="fc-connections-port"
          inputMode="numeric"
          autoComplete="off"
          error={error('port')}
          {...field('port')}
        />
      </div>
      <TextField label="Banco" autoComplete="off" autoCapitalize="off" spellCheck={false} error={error('database')} {...field('database')} />
      <TextField
        label="Usuário"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        tooltip="Use um usuário do banco só de leitura."
        error={error('username')}
        {...field('username')}
      />
      <PasswordField label="Senha" autoComplete="new-password" error={error('password')} {...field('password')} />
    </>
  );
}

/** The general error of a form, with the privileges found when the user is not read-only. */
export function FormErrorNotice({ error }: { error: FormError | undefined }): ReactNode {
  if (!error?.message) return null;
  return (
    <Notice type="error">
      {error.message}
      {error.privileges && error.privileges.length > 0 ? (
        <ul className="fc-connections-privileges" aria-label="Privilégios encontrados">
          {error.privileges.map((privilege) => (
            <li key={privilege}>{privilege}</li>
          ))}
        </ul>
      ) : null}
    </Notice>
  );
}
