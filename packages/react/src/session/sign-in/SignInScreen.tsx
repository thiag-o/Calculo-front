import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Notice, Button, Card, PasswordField, TextField, Text } from '../../design-system';
import { useSignIn } from '../mutations';
import type { Session } from '../useSession';
import { signInError } from './signInErrorMessage';
import './sign-in.css';

const schema = z.object({
  email: z.string().trim().min(1, 'Informe o e-mail'),
  password: z.string().min(1, 'Informe a senha'),
});

type SignInData = z.infer<typeof schema>;

export interface SignInScreenProps {
  /** Called with the created session, after sign-in. The shell takes the user to the module. */
  onSignIn?: (session: Session) => void;
}

/**
 * Sign-in screen (e-mail and password). Needs `ApiProvider` (cookie mode) and `QueryClientProvider`;
 * the public `<SignIn>` mounts both.
 */
export function SignInScreen({ onSignIn }: SignInScreenProps) {
  const titleId = useId();
  const signIn = useSignIn();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInData>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  const apiError = signIn.error ? signInError(signIn.error) : undefined;

  const submit = handleSubmit((data) => {
    signIn.mutate({ email: data.email, password: data.password }, { onSuccess: (session) => onSignIn?.(session) });
  });

  return (
    <div className="fc-sign-in">
      <Card as="section" className="fc-sign-in-box" aria-labelledby={titleId}>
        <header className="fc-sign-in-header">
          <Text as="h1" variant="heading-24" id={titleId} className="fc-sign-in-title">
            Fluxo de Cálculo
          </Text>
          <Text as="p" variant="copy-14" emphasis="secondary" className="fc-sign-in-subtitle">
            Entre com o seu e-mail e a sua senha.
          </Text>
        </header>
        <form className="fc-sign-in-form" onSubmit={submit} noValidate>
          <TextField
            label="E-mail"
            type="email"
            autoComplete="username"
            autoCapitalize="off"
            spellCheck={false}
            // The screen exists only for this; focus starts on the first field.
            autoFocus
            error={errors.email?.message ?? apiError?.fields.email}
            {...register('email')}
          />
          <PasswordField label="Senha" error={errors.password?.message ?? apiError?.fields.password} {...register('password')} />
          {apiError ? <Notice type="error">{apiError.message}</Notice> : null}
          <Button type="submit" variant="primary" size="large" className="fc-sign-in-submit" loading={signIn.isPending}>
            Entrar
          </Button>
        </form>
        <Text as="p" variant="label-12" emphasis="tertiary" className="fc-sign-in-help">
          Esqueceu a senha? Peça ao administrador um link para criar uma nova.
        </Text>
      </Card>
    </div>
  );
}
