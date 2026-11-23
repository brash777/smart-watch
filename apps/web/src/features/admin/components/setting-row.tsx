import type { AdminSetting, SettingValue } from '@snapia/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/button';
import { errorKey } from '../../../i18n/error-key';
import { adminKeys, updateSetting } from '../api';

/** The text an admin edits for a value; lists are one item per line. */
function toText(value: SettingValue): string {
  return Array.isArray(value) ? value.join('\n') : String(value);
}

function fromText(setting: AdminSetting, text: string): SettingValue {
  switch (setting.valueType) {
    case 'NUMBER':
      return Number(text);
    case 'BOOLEAN':
      return text === 'true';
    case 'STRING_LIST':
      return text
        .split('\n')
        .map((item) => item.trim())
        .filter((item) => item !== '');
    case 'STRING':
      return text;
  }
}

/** One AppSetting with its own save button; the API validates the value. */
export function SettingRow({ setting }: { setting: AdminSetting }) {
  const { t } = useTranslation();
  const id = useId();
  const queryClient = useQueryClient();
  const [text, setText] = useState(toText(setting.value));
  const save = useMutation({
    mutationFn: () => updateSetting(setting.key, fromText(setting, text)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.settings });
    },
  });
  const changed = text !== toText(setting.value);
  const field = 'w-full rounded-control border border-field-border bg-surface px-3 py-2 text-base';

  return (
    <li className="flex flex-col gap-2 py-4">
      <label htmlFor={id} className="text-sm font-semibold break-all">
        {setting.key}
      </label>
      <p className="text-sm text-muted">{setting.description}</p>
      {setting.valueType === 'BOOLEAN' ? (
        <select
          id={id}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
          }}
          className={`${field} min-h-11`}
        >
          <option value="true">{t('admin.settings.true')}</option>
          <option value="false">{t('admin.settings.false')}</option>
        </select>
      ) : setting.valueType === 'NUMBER' ? (
        <input
          id={id}
          type="number"
          step="any"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
          }}
          className={`${field} min-h-11`}
        />
      ) : (
        <textarea
          id={id}
          rows={setting.valueType === 'STRING_LIST' ? 4 : 2}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
          }}
          className={field}
        />
      )}
      {setting.valueType === 'STRING_LIST' ? (
        <p className="text-xs text-muted">{t('admin.settings.listHint')}</p>
      ) : null}
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          fullWidth={false}
          disabled={!changed || save.isPending}
          onClick={() => {
            save.mutate();
          }}
        >
          {save.isPending ? t('admin.settings.saving') : t('admin.settings.save')}
        </Button>
        <p role="status" className="text-sm">
          {save.isError ? <span className="text-danger">{t(errorKey(save.error))}</span> : null}
          {save.isSuccess && !changed ? t('admin.settings.saved') : null}
        </p>
      </div>
    </li>
  );
}
