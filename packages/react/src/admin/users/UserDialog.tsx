import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Notice,
  Button,
  Checkbox,
  TextField,
  Loading,
  Dialog,
  DialogClose,
  FieldMessage,
  textClasses,
  type DialogProps,
} from '../../design-system';
import { useUpdateUser, useCreateUser, useAvailableRoles, type Role, type User } from './queries';
import { formError, rolesErrorMessage } from './messages';

const ROLES_LOADING_REASON = 'Aguarde a lista de papéis';
const ROLES_ERROR_REASON = 'Carregue a lista de papéis para salvar';

function createSchema(editing: boolean) {
  const email = editing
    ? z.string()
    : z
        .string()
        .trim()
        .min(1, 'Informe o e-mail')
        .pipe(z.email('Informe um e-mail válido, como ana@empresa.com.br'));
  return z.object({
    email,
    name: z.string().trim().min(1, 'Informe o nome'),
    roles: z.array(z.string()),
    active: z.boolean(),
  });
}

type UserData = z.infer<ReturnType<typeof createSchema>>;

export interface UserDialogProps {
  /** The user to edit. Without it, the dialog creates a new user. */
  user?: User;
  /** Called on close (Cancelar, Esc, "Fechar" or after saving). */
  onClose: () => void;
  /** Element that gets focus on close (see `Dialog`). */
  focusOnClose?: DialogProps['focusOnClose'];
}

/**
 * Dialog to create or edit a user: e-mail (only on creation), name, roles and, when editing, whether it is active.
 * Mount it only while open: each opening starts from scratch.
 */
export function UserDialog({ user, onClose, focusOnClose }: UserDialogProps) {
  const editing = user !== undefined;
  const formId = useId();
  const rolesErrorId = useId();
  const roles = useAvailableRoles(true);
  const create = useCreateUser();
  const update = useUpdateUser();
  const mutation = editing ? update : create;

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<UserData>({
    resolver: zodResolver(createSchema(editing)),
    defaultValues: {
      email: user?.email ?? '',
      name: user?.name ?? '',
      roles: user?.roles.map((role) => role.id) ?? [],
      active: user?.active ?? true,
    },
  });

  const apiError = mutation.error ? formError(mutation.error) : undefined;
  const rolesError = errors.roles?.message ?? apiError?.fields.roles;

  const disabledReason = roles.isPending ? ROLES_LOADING_REASON : roles.isError ? ROLES_ERROR_REASON : undefined;

  const submit = handleSubmit((data) => {
    if (disabledReason) return;
    if (user) {
      update.mutate(
        { id: user.id, body: { name: data.name, roles: data.roles, active: data.active } },
        { onSuccess: onClose },
      );
    } else {
      create.mutate({ email: data.email, name: data.name, roles: data.roles }, { onSuccess: onClose });
    }
  });

  return (
    <Dialog
      open
      focusOnClose={focusOnClose}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={editing ? 'Editar usuário' : 'Novo usuário'}
      description={editing ? user.email : 'A pessoa recebe acesso a este tenant com os papéis escolhidos.'}
      actions={
        <>
          <DialogClose>
            <Button>Cancelar</Button>
          </DialogClose>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            loading={mutation.isPending}
            disabledReason={disabledReason}
          >
            Salvar
          </Button>
        </>
      }
    >
      <form id={formId} className="fc-users-form" onSubmit={submit} noValidate>
        {editing ? null : (
          <TextField
            label="E-mail"
            type="email"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            error={errors.email?.message ?? apiError?.fields.email}
            {...register('email')}
          />
        )}
        <TextField
          label="Nome"
          autoComplete="off"
          tooltip={
            editing ? 'O nome vale em todos os tenants do usuário.' : 'Se o e-mail já tem acesso a outro tenant, o nome dele não muda.'
          }
          error={errors.name?.message ?? apiError?.fields.name}
          {...register('name')}
        />
        <fieldset className="fc-users-roles" aria-describedby={rolesError ? rolesErrorId : undefined}>
          <legend className={`fc-users-roles-caption ${textClasses({ variant: 'label-13', emphasis: 'secondary' })}`}>Papéis</legend>
          {roles.isPending ? (
            <Loading label="Carregando papéis" rows={3} />
          ) : roles.isError ? (
            <Notice
              type="error"
              actions={
                <Button size="small" onClick={() => void roles.refetch()} loading={roles.isFetching}>
                  Tentar de novo
                </Button>
              }
            >
              {rolesErrorMessage(roles.error)}
            </Notice>
          ) : roles.data.length === 0 ? (
            <p className={`fc-users-no-roles ${textClasses({ variant: 'label-13', emphasis: 'secondary' })}`}>
              Nenhum papel no tenant. Crie um papel para dar acesso.
            </p>
          ) : (
            <Controller
              control={control}
              name="roles"
              render={({ field }) => (
                <div className="fc-users-roles-list">
                  {roles.data.map((role) => (
                    <RoleCheckbox
                      key={role.id}
                      role={role}
                      checked={field.value.includes(role.id)}
                      onChange={(checked) =>
                        field.onChange(checked ? [...field.value, role.id] : field.value.filter((id) => id !== role.id))
                      }
                    />
                  ))}
                </div>
              )}
            />
          )}
          {rolesError ? (
            <FieldMessage id={rolesErrorId} type="error">
              {rolesError}
            </FieldMessage>
          ) : null}
        </fieldset>
        {editing ? (
          <Controller
            control={control}
            name="active"
            render={({ field }) => (
              <Checkbox
                label="Ativo neste tenant"
                tooltip="Desativar encerra as sessões do usuário neste tenant."
                checked={field.value}
                onCheckedChange={(value) => field.onChange(value === true)}
                error={apiError?.fields.active}
              />
            )}
          />
        ) : null}
        {apiError?.message ? <Notice type="error">{apiError.message}</Notice> : null}
      </form>
    </Dialog>
  );
}

function RoleCheckbox({ role, checked, onChange }: { role: Role; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <Checkbox
      label={role.name}
      tooltip={role.fixed ? 'Todas as permissões. O tenant precisa de pelo menos um Admin ativo.' : undefined}
      checked={checked}
      onCheckedChange={(value) => onChange(value === true)}
    />
  );
}
