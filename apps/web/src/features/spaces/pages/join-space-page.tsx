import { zodResolver } from '@hookform/resolvers/zod';
import { joinSpaceBodySchema } from '@snapia/shared';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { paths } from '../../../app/paths';
import { Button } from '../../../components/button';
import { FormAlert } from '../../../components/form-alert';
import { PageHeader } from '../../../components/page-header';
import { TextField } from '../../../components/text-field';
import { errorKey } from '../../../i18n/error-key';
import { useJoinSpace } from '../hooks/use-spaces';

/** /join and /join/:code: joining a Space always takes an explicit tap. */
export function JoinSpacePage() {
  const { t } = useTranslation();
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const join = useJoinSpace();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(joinSpaceBodySchema), defaultValues: { code } });

  const submit = handleSubmit((body) => {
    join.mutate(body, {
      onSuccess: ({ space, role, alreadyMember }) => {
        void navigate(paths.space(space.id), {
          replace: true,
          state: { joined: { role, alreadyMember } },
        });
      },
    });
  });

  return (
    <>
      <PageHeader title={t('join.title')}>{t('join.text')}</PageHeader>
      <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
        <TextField
          label={t('join.code')}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          error={errors.code === undefined ? undefined : t('join.codeError')}
          {...register('code')}
        />
        {join.isError ? <FormAlert>{t(errorKey(join.error))}</FormAlert> : null}
        <Button type="submit" disabled={join.isPending}>
          {join.isPending ? t('join.submitting') : t('join.submit')}
        </Button>
      </form>
    </>
  );
}
