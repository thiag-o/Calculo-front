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
  Badge,
  textClasses,
} from '../../design-system';
import {
  groupPermissions,
  useUpdateRole,
  usePermissionCatalog,
  useCreateRole,
  type PermissionCode,
  type Role,
  type Permission,
} from './queries';
import { formError, queryErrorMessage } from './messages';

export const PERMISSION_CATALOG_LOADING_REASON = 'Aguarde o catálogo de permissões';
export const PERMISSION_CATALOG_ERROR_REASON = 'Carregue o catálogo de permissões para salvar';

const schema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do papel'),
  permissions: z.array(z.string()),
});

type FormFields = z.infer<typeof schema>;

export interface RoleDialogProps {
  /** The role to edit. Without it, the dialog creates a new role. Never the Admin (`fixo`), which is not editable. */
  role?: Role;
  /** Called on close (Cancelar, Esc, "Fechar" or after saving). */
  onClose: () => void;
}

/**
 * Dialog to create or edit a role: name and permissions, picked from the grouped catalog, with the sensitive ones
 * highlighted. Mount it only while open: each opening starts from scratch.
 */
export function RoleDialog({ role, onClose }: RoleDialogProps) {
  const editing = role !== undefined;
  const formId = useId();
  const permissionsId = useId();
  const helpId = useId();
  const permissionsErrorId = useId();
  const permissionCatalog = usePermissionCatalog(true);
  const create = useCreateRole();
  const update = useUpdateRole();
  const mutation = editing ? update : create;

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormFields>({
    resolver: zodResolver(schema),
    defaultValues: { name: role?.nome ?? '', permissions: role?.permissoes ?? [] },
  });

  const apiError = mutation.error ? formError(mutation.error) : undefined;
  const permissionsError = errors.permissions?.message ?? apiError?.fields.permissions;
  const disabledReason = permissionCatalog.isPending ? PERMISSION_CATALOG_LOADING_REASON : permissionCatalog.isError ? PERMISSION_CATALOG_ERROR_REASON : undefined;
  const hasSensitive = permissionCatalog.data?.some((permission) => permission.sensivel) ?? false;

  const submit = handleSubmit((data) => {
    if (disabledReason) return;
    const body = { nome: data.name, permissoes: data.permissions as PermissionCode[] };
    if (role) update.mutate({ id: role.id, body }, { onSuccess: onClose });
    else create.mutate(body, { onSuccess: onClose });
  });

  const describedBy = [hasSensitive ? helpId : undefined, permissionsError ? permissionsErrorId : undefined].filter(Boolean).join(' ');

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      className="fc-roles-dialog"
      title={editing ? 'Editar papel' : 'Novo papel'}
      description={
        editing
          ? 'As permissões valem para todos os usuários com este papel.'
          : 'Um papel é um conjunto de permissões. Depois, dê o papel aos usuários em Usuários.'
      }
      actions={
        <>
          <DialogClose>
            <Button>Cancelar</Button>
          </DialogClose>
          <Button type="submit" form={formId} variant="primary" loading={mutation.isPending} disabledReason={disabledReason}>
            Salvar
          </Button>
        </>
      }
    >
      <form id={formId} className="fc-roles-form" onSubmit={submit} noValidate>
        <TextField label="Nome" autoComplete="off" error={errors.name?.message ?? apiError?.fields.name} {...register('name')} />

        <div
          role="group"
          className="fc-roles-catalog"
          aria-labelledby={permissionsId}
          aria-describedby={describedBy || undefined}
        >
          <Controller
            control={control}
            name="permissions"
            render={({ field }) => (
              <>
                <div className="fc-roles-catalog-top">
                  <span id={permissionsId} className={textClasses({ variant: 'label-13', emphasis: 'secondary' })}>
                    Permissões
                  </span>
                  {permissionCatalog.data ? (
                    <span className={`fc-roles-number ${textClasses({ variant: 'label-12', emphasis: 'secondary' })}`}>
                      {field.value.length} de {permissionCatalog.data.length} marcadas
                    </span>
                  ) : null}
                </div>
                {hasSensitive ? (
                  <p id={helpId} className={`fc-roles-help ${textClasses({ variant: 'label-12', emphasis: 'secondary' })}`}>
                    As permissões marcadas como <Badge tone="amber">Sensível</Badge> dão acesso a credenciais, aprovações e
                    ajustes. Dê uma a uma, só a quem precisa.
                  </p>
                ) : null}
                {permissionCatalog.isPending ? (
                  <Loading label="Carregando o catálogo de permissões" rows={4} />
                ) : permissionCatalog.isError ? (
                  <Notice
                    type="error"
                    title="Não foi possível carregar o catálogo de permissões"
                    actions={
                      <Button size="small" onClick={() => void permissionCatalog.refetch()} loading={permissionCatalog.isFetching}>
                        Tentar de novo
                      </Button>
                    }
                  >
                    {queryErrorMessage(permissionCatalog.error)}
                  </Notice>
                ) : permissionCatalog.data.length === 0 ? (
                  <p className={`fc-roles-no-permissions ${textClasses({ variant: 'label-13', emphasis: 'secondary' })}`}>
                    O catálogo de permissões está vazio. Fale com quem opera o sistema.
                  </p>
                ) : (
                  groupPermissions(permissionCatalog.data).map(({ group, permissions }) => (
                    <fieldset key={group} className="fc-roles-group">
                      <legend className={`fc-roles-group-caption ${textClasses({ variant: 'label-14', medium: true })}`}>{group}</legend>
                      {permissions.map((permission) => (
                        <PermissionCheckbox
                          key={permission.codigo}
                          permission={permission}
                          checked={field.value.includes(permission.codigo)}
                          onChange={(checked) =>
                            field.onChange(
                              checked ? [...field.value, permission.codigo] : field.value.filter((code) => code !== permission.codigo),
                            )
                          }
                        />
                      ))}
                    </fieldset>
                  ))
                )}
              </>
            )}
          />
          {permissionsError ? (
            <FieldMessage id={permissionsErrorId} type="error">
              {permissionsError}
            </FieldMessage>
          ) : null}
        </div>

        {apiError?.message ? <Notice type="error">{apiError.message}</Notice> : null}
      </form>
    </Dialog>
  );
}

function PermissionCheckbox({ permission, checked, onChange }: { permission: Permission; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <Checkbox
      label={
        <span className="fc-roles-permission">
          {permission.nome}
          {/* The space separates the words in the accessible name ("Aprovar versões Sensível"); flex drops it on screen. */}
          {permission.sensivel ? <> <Badge tone="amber">Sensível</Badge></> : null}
        </span>
      }
      checked={checked}
      onCheckedChange={(value) => onChange(value === true)}
    />
  );
}
