// Vertical "design-system" (ADR 0003).
// --fc-* tokens (light/dark), typography and base components. Shared vertical: depends on no other.
// This file is the vertical's public interface; the rest of the folder is private.
export { FluxoRoot, useFluxoPortal } from './root';
export type { FluxoRootProps, FluxoTheme } from './root';
export { Text, textClasses, textStyles } from './typography';
export type { TextStyle, TextOptions, TextProps, TextTone } from './typography';
export { Button, Checkbox, PasswordField, TextField, FieldMessage, Label, Select } from './form';
export type {
  ButtonProps,
  CheckboxProps,
  PasswordFieldProps,
  TextFieldProps,
  ReasonDisplay,
  FieldMessageProps,
  SelectOption,
  LabelProps,
  SelectProps,
  ButtonSize,
  TextFieldType,
  FieldMessageType,
  ButtonVariant,
} from './form';
export { Notice, Card, Loading, Dialog, Tooltip, Skeleton, EmptyState, DialogClose, Menu, Badge, Status, Table, Tabs } from './display';
export type {
  MenuAction,
  NoticeProps,
  CardProps,
  LoadingProps,
  TableColumn,
  BadgeTone,
  StatusTone,
  DialogProps,
  TooltipProps,
  CardPadding,
  SkeletonProps,
  EmptyStateProps,
  DialogCloseProps,
  MenuItem,
  TooltipSide,
  MenuProps,
  BadgeProps,
  MenuSeparator,
  StatusProps,
  TableProps,
  NoticeType,
  TabItem,
  TabsProps,
  TabsSize,
} from './display';
