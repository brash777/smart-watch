import { zodResolver } from '@hookform/resolvers/zod';
import {
  createSpaceBodySchema,
  spaceModeSchema,
  spaceNameSchema,
  type CreateSpaceBody,
} from '@snapia/shared';
import { Check } from 'lucide-react';
import { useId } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button } from '../../../components/button';
import { FormAlert } from '../../../components/form-alert';
import { ModeTile } from '../../../components/mode-tile';
import { TextField } from '../../../components/text-field';
import { TextareaField } from '../../../components/textarea-field';
import { modeOrder, modes } from '../../../config/modes';
import { errorKey } from '../../../i18n/error-key';

/*
 * The form keeps every metadata field as text. On submit, only the fields of the chosen mode
 * that have a value go to the API, and the result is checked with the API's own schema.
 */
const createSpaceFormSchema = z
  .object({
    mode: spaceModeSchema,
    name: spaceNameSchema,
    description: z.string(),
    color: z.string(),
    metadata: z.record(z.string(), z.string()),
  })
  .transform(({ metadata, ...values }, ctx) => {
    const body = createSpaceBodySchema.safeParse({
      ...values,
      metadata: Object.fromEntries(
        modes[values.mode].metadataFields
          .map((field) => [field, metadata[field]?.trim() ?? ''] as const)
          .filter(([, value]) => value !== ''),
      ),
    });
    if (body.success) return body.data;
    for (const issue of body.error.issues) {
      ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
    }
    return z.NEVER;
  });

interface CreateSpaceFormProps {
  /** The colors the API accepts (space_color_palette). */
  palette: readonly string[];
  pending: boolean;
  error: unknown;
  onSubmit: (body: CreateSpaceBody) => void;
}

export function CreateSpaceForm({ palette, pending, error, onSubmit }: CreateSpaceFormProps) {
  const { t } = useTranslation();
  const modeErrorId = useId();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(createSpaceFormSchema),
    defaultValues: { name: '', description: '', color: palette[0] ?? '', metadata: {} },
  });
  const mode = useWatch({ control, name: 'mode' });
  const submit = handleSubmit(onSubmit);

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-6">
      <fieldset
        aria-describedby={errors.mode === undefined ? undefined : modeErrorId}
        className="flex flex-col gap-3"
      >
        <legend className="mb-3 flex flex-col gap-0.5">
          <span className="font-semibold">{t('spaces.form.modeLegend')}</span>
          <span className="text-sm text-muted">{t('spaces.form.modeHint')}</span>
        </legend>
        {modeOrder.map((option) => (
          <label
            key={option}
            className="flex cursor-pointer items-start gap-3 rounded-card border border-line bg-surface p-3 has-checked:border-ink has-checked:ring-1 has-checked:ring-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus"
          >
            <input type="radio" value={option} className="peer sr-only" {...register('mode')} />
            <ModeTile mode={option} />
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="font-semibold">{t(modes[option].labelKey)}</span>
              <span className="text-sm text-muted">{t(modes[option].descriptionKey)}</span>
            </span>
            <Check aria-hidden className="invisible size-5 shrink-0 peer-checked:visible" />
          </label>
        ))}
        {errors.mode === undefined ? null : (
          <p id={modeErrorId} className="text-sm text-danger">
            {t('spaces.form.modeError')}
          </p>
        )}
      </fieldset>

      <TextField
        label={t('spaces.form.name')}
        autoComplete="off"
        error={errors.name === undefined ? undefined : t('spaces.form.nameError')}
        {...register('name')}
      />
      <TextareaField
        label={t('spaces.form.description')}
        hint={t('common.optional')}
        rows={2}
        {...register('description')}
      />

      {mode === undefined ? null : (
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-4 font-semibold">{t(`modes.${mode}.detailsLegend`)}</legend>
          {modes[mode].metadataFields.map((field) => (
            <TextField
              key={field}
              label={t(`spaces.metadata.${field}`)}
              hint={t('common.optional')}
              autoComplete="off"
              {...register(`metadata.${field}`)}
            />
          ))}
        </fieldset>
      )}

      <fieldset>
        <legend className="mb-3 font-semibold">{t('spaces.form.colorLegend')}</legend>
        <div className="flex flex-wrap gap-3">
          {palette.map((color, index) => (
            <label key={color} className="cursor-pointer">
              <input type="radio" value={color} className="peer sr-only" {...register('color')} />
              <span className="sr-only">
                {t('spaces.form.colorOption', { number: index + 1, total: palette.length })}
              </span>
              <span
                aria-hidden
                style={{ backgroundColor: color }}
                className="block size-11 rounded-full ring-offset-2 ring-offset-canvas peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-focus"
              />
            </label>
          ))}
        </div>
      </fieldset>

      {error === null ? null : <FormAlert>{t(errorKey(error))}</FormAlert>}
      <Button type="submit" disabled={pending}>
        {pending ? t('spaces.form.submitting') : t('spaces.form.submit')}
      </Button>
    </form>
  );
}
