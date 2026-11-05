import { SelectField } from './SelectField';
import { ROUTINE_KINDS } from '@/utils/routine';
export type PersonalContext = keyof typeof ROUTINE_KINDS;
export function ContextField({
  value,
  onChange,
}: {
  value: PersonalContext | null;
  onChange: (value: PersonalContext | null) => void;
}) {
  return (
    <SelectField<PersonalContext | null>
      label="Meu contexto"
      hint="Visível só para você"
      value={value}
      onChange={onChange}
      options={[
        { value: null, label: 'Sem contexto' },
        ...Object.entries(ROUTINE_KINDS).map(([key, label]) => ({ value: key as PersonalContext, label })),
      ]}
    />
  );
}
