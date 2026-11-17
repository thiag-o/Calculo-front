import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId, useMemo, useRef, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Notice, Button, Card, PasswordField, Loading, Skeleton, Text } from '../../design-system';
import {
  isInvalidLink,
  submitError,
  INVALID_LINK_MESSAGE,
  PASSWORD_SAVED_MESSAGE,
  verificationErrorMessage,
  expiryMessage,
  passwordRules,
  passwordLength,
} from './resetPasswordMessages';
import { useResetPassword, useVerifyLink, type VerifiedLink } from './passwordReset';
import './reset-password.css';

export interface ResetPasswordScreenProps {
  /** The link token (`/reset-password?token=...`). Without a token, or empty, the screen says the link is not valid. */
  token?: string | null;
  /** Called after the password was saved. The shell decides whether to take the person to sign-in. */
  onSave?: () => void;
}

/**
 * Public new-password screen from the reset link (the same link creates the Admin's first password). On open,
 * verifies the link to show the minimum password and the deadline; an invalid link does not show the form. Needs
 * `ApiProvider` and `QueryClientProvider`; the public `<ResetPassword>` mounts both.
 */
export function ResetPasswordScreen({ token, onSave }: ResetPasswordScreenProps) {
  const titleId = useId();
  const trimmedToken = token ?? '';
  const verification = useVerifyLink(trimmedToken);

  let content: ReactNode;
  if (trimmedToken === '' || isInvalidLink(verification.error)) {
    content = <Notice type="error">{INVALID_LINK_MESSAGE}</Notice>;
  } else if (verification.data) {
    // Another token, another form: nothing from the previous link stays in the fields.
    content = <PasswordForm key={trimmedToken} token={trimmedToken} link={verification.data} onSave={onSave} />;
  } else if (verification.isError) {
    content = (
      <Notice
        type="error"
        title="Não foi possível verificar o link"
        actions={
          <Button size="small" loading={verification.isFetching} onClick={() => void verification.refetch()}>
            Tentar de novo
          </Button>
        }
      >
        {verificationErrorMessage(verification.error)}
      </Notice>
    );
  } else {
    content = <FormLoading />;
  }

  return (
    <div className="fc-reset-password">
      <Card as="section" className="fc-reset-password-box" aria-labelledby={titleId}>
        <Text as="h1" variant="heading-24" id={titleId} className="fc-reset-password-title">
          Nova senha
        </Text>
        {content}
      </Card>
    </div>
  );
}

/** Skeleton with the shape of the form: the deadline sentence, the two fields and the button. */
function FormLoading() {
  return (
    <Loading label="Verificando o link">
      <Skeleton width="80%" />
      {[0, 1].map((field) => (
        <div key={field} className="fc-reset-password-skeleton-field">
          <Skeleton width={96} />
          <Skeleton width="100%" className="fc-reset-password-skeleton-input" />
        </div>
      ))}
      <Skeleton width="100%" className="fc-reset-password-skeleton-button" />
    </Loading>
  );
}

interface PasswordData {
  newPassword: string;
  confirmation: string;
}

/** Client rules: the same server rules the screen knows (the e-mail, only the server checks). */
function passwordSchema(minPasswordLength: number) {
  return z.object({ newPassword: z.string(), confirmation: z.string() }).superRefine((data, context) => {
    if (data.newPassword === '') {
      context.addIssue({ code: 'custom', path: ['newPassword'], message: 'Informe a nova senha' });
    } else if (passwordLength(data.newPassword) < minPasswordLength) {
      context.addIssue({ code: 'custom', path: ['newPassword'], message: `Use pelo menos ${minPasswordLength} caracteres` });
    }
    if (data.confirmation === '') {
      context.addIssue({ code: 'custom', path: ['confirmation'], message: 'Repita a nova senha' });
    } else if (data.confirmation !== data.newPassword) {
      context.addIssue({
        code: 'custom',
        path: ['confirmation'],
        message: 'As senhas estão diferentes. Digite a mesma senha nos dois campos',
      });
    }
  });
}

interface PasswordFormProps {
  token: string;
  link: VerifiedLink;
  onSave?: () => void;
}

function PasswordForm({ token, link, onSave }: PasswordFormProps) {
  const save = useResetPassword();
  const schema = useMemo(() => passwordSchema(link.min_password_length), [link.min_password_length]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PasswordData>({ resolver: zodResolver(schema), defaultValues: { newPassword: '', confirmation: '' } });

  if (save.isSuccess) {
    return (
      <Result>
        <Notice type="success">{PASSWORD_SAVED_MESSAGE}</Notice>
      </Result>
    );
  }
  if (isInvalidLink(save.error)) {
    // O link venceu ou foi usado enquanto a pessoa digitava.
    return (
      <Result>
        <Notice type="error">{INVALID_LINK_MESSAGE}</Notice>
      </Result>
    );
  }

  const apiError = save.error ? submitError(save.error) : undefined;
  const expiry = expiryMessage(link.expires_at);

  const submit = handleSubmit((data) => {
    save.mutate({ token, new_password: data.newPassword }, { onSuccess: () => onSave?.() });
  });

  return (
    <>
      <Text as="p" variant="copy-14" emphasis="secondary" className="fc-reset-password-subtitle">
        Crie a senha que você vai usar para entrar.{expiry ? ` ${expiry}` : null}
      </Text>
      <form className="fc-reset-password-form" onSubmit={submit} noValidate>
        <PasswordField
          label="Nova senha"
          autoComplete="new-password"
          // The screen exists only for this; focus starts on the first field.
          autoFocus
          tooltip={passwordRules(link.min_password_length)}
          error={errors.newPassword?.message ?? apiError?.newPassword}
          {...register('newPassword')}
        />
        <PasswordField
          label="Repita a nova senha"
          autoComplete="new-password"
          error={errors.confirmation?.message}
          {...register('confirmation')}
        />
        {apiError?.message ? <Notice type="error">{apiError.message}</Notice> : null}
        <Button type="submit" variant="primary" size="large" className="fc-reset-password-submit" loading={save.isPending}>
          Salvar
        </Button>
      </form>
    </>
  );
}

/**
 * The end of the form (password saved or link expired on submit). The button that had focus is gone: focus goes to the
 * message, which the screen reader reads.
 */
function Result({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div ref={ref} tabIndex={-1} className="fc-reset-password-result">
      {children}
    </div>
  );
}
