import { zodResolver } from '@hookform/resolvers/zod';
import { registerBodySchema } from '@snapia/shared';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import { paths } from '../../../app/paths';
import { Button } from '../../../components/button';
import { FormAlert } from '../../../components/form-alert';
import { TextField } from '../../../components/text-field';
import { errorKey } from '../../../i18n/error-key';
import { AuthShell } from '../components/auth-shell';
import { useRegister } from '../hooks/use-session-mutations';

export function RegisterPage() {
  const { t } = useTranslation();
  // Where the user was going before the login (react-router types it as any).
  const returnState: unknown = useLocation().state;
  const signUp = useRegister();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registerBodySchema),
    defaultValues: { name: '', username: '', email: '', password: '' },
  });

  const submit = handleSubmit((values) => {
    signUp.mutate(values);
  });

  return (
    <AuthShell
      title={t('auth.register.title')}
      footer={
        <p>
          {t('auth.register.hasAccount')}{' '}
          <Link
            to={paths.login}
            state={returnState}
            className="font-semibold text-ink underline underline-offset-4"
          >
            {t('auth.register.toLogin')}
          </Link>
        </p>
      }
    >
      <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
        <TextField
          label={t('auth.fields.name.label')}
          autoComplete="name"
          error={errors.name === undefined ? undefined : t('auth.fields.name.error')}
          {...register('name')}
        />
        <TextField
          label={t('auth.fields.username.label')}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          error={errors.username === undefined ? undefined : t('auth.fields.username.error')}
          {...register('username')}
        />
        <TextField
          type="email"
          label={t('auth.fields.email.label')}
          autoComplete="email"
          error={errors.email === undefined ? undefined : t('auth.fields.email.error')}
          {...register('email')}
        />
        <TextField
          type="password"
          label={t('auth.fields.newPassword.label')}
          autoComplete="new-password"
          error={errors.password === undefined ? undefined : t('auth.fields.newPassword.error')}
          {...register('password')}
        />
        {signUp.isError ? <FormAlert>{t(errorKey(signUp.error))}</FormAlert> : null}
        <Button type="submit" disabled={signUp.isPending}>
          {signUp.isPending ? t('auth.register.submitting') : t('auth.register.submit')}
        </Button>
      </form>
    </AuthShell>
  );
}
