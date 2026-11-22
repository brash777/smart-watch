import { zodResolver } from '@hookform/resolvers/zod';
import { loginBodySchema } from '@snapia/shared';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import { paths } from '../../../app/paths';
import { Button } from '../../../components/button';
import { FormAlert } from '../../../components/form-alert';
import { TextField } from '../../../components/text-field';
import { errorKey } from '../../../i18n/error-key';
import { AuthShell } from '../components/auth-shell';
import { useLogin } from '../hooks/use-session-mutations';

export function LoginPage() {
  const { t } = useTranslation();
  // Where the user was going before the login (react-router types it as any).
  const returnState: unknown = useLocation().state;
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginBodySchema),
    defaultValues: { identifier: '', password: '' },
  });

  const submit = handleSubmit((values) => {
    login.mutate(values);
  });

  return (
    <AuthShell
      title={t('auth.login.title')}
      footer={
        <p>
          {t('auth.login.noAccount')}{' '}
          <Link to={paths.register} state={returnState} className="font-semibold underline">
            {t('auth.login.toRegister')}
          </Link>
        </p>
      }
    >
      <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
        <TextField
          label={t('auth.fields.identifier.label')}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          error={errors.identifier === undefined ? undefined : t('auth.fields.identifier.error')}
          {...register('identifier')}
        />
        <TextField
          type="password"
          label={t('auth.fields.password.label')}
          autoComplete="current-password"
          error={errors.password === undefined ? undefined : t('auth.fields.password.error')}
          {...register('password')}
        />
        {login.isError ? <FormAlert>{t(errorKey(login.error))}</FormAlert> : null}
        <Button type="submit" disabled={login.isPending}>
          {login.isPending ? t('auth.login.submitting') : t('auth.login.submit')}
        </Button>
      </form>
    </AuthShell>
  );
}
