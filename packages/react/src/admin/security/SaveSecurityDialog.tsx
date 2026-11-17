import { Notice, Button, Dialog, DialogClose, textClasses } from '../../design-system';
import type { SecuritySettings } from './queries';
import { PARAMETERS, quantity, type SecurityField } from './parameters';

export interface SaveSecurityDialogProps {
  /** The values in force, to show "de … para …". */
  settings: SecuritySettings;
  /** The new values (only the changed ones matter), already validated. */
  newOnes: Readonly<Record<SecurityField, number>>;
  /** The changed fields, in screen order. */
  changed: readonly SecurityField[];
  /** The PUT is in progress. */
  saving: boolean;
  /** PUT error that is not a field error (permission, CSRF, network…), shown here to try again. */
  error?: string;
  onConfirm: () => void;
  /** Called on close (Cancelar, Esc or "Fechar"). */
  onClose: () => void;
}

/** Confirmation before saving: lists each changed parameter, with the value in force and the new one. */
export function SaveSecurityDialog({ settings, newOnes, changed, saving, error, onConfirm, onClose }: SaveSecurityDialogProps) {
  const parameters = PARAMETERS.filter((parameter) => changed.includes(parameter.field));
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Salvar parâmetros de segurança"
      description="Os novos valores valem para todo o tenant. A alteração fica registrada na auditoria."
      actions={
        <>
          <DialogClose>
            <Button>Cancelar</Button>
          </DialogClose>
          <Button variant="primary" loading={saving} onClick={onConfirm}>
            Salvar
          </Button>
        </>
      }
    >
      <ul className="fc-security-changes" aria-label="Parâmetros alterados">
        {parameters.map((parameter) => (
          <li key={parameter.field} className="fc-security-change">
            <span className={textClasses({ variant: 'label-14', medium: true })}>{parameter.label}</span>
            <span className={`fc-security-number ${textClasses({ variant: 'label-13', emphasis: 'secondary' })}`}>
              de {quantity(settings[parameter.field].valor, parameter)} para {quantity(newOnes[parameter.field], parameter)}
            </span>
          </li>
        ))}
      </ul>
      {error ? <Notice type="error">{error}</Notice> : null}
    </Dialog>
  );
}
