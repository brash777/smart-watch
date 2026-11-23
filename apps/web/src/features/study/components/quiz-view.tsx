import type { Quiz } from '@snapia/shared';
import { useMutation } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/button';
import { FormAlert } from '../../../components/form-alert';
import { errorKey } from '../../../i18n/error-key';
import { submitQuizAttempt } from '../api';

/** Multiple-choice questions; the API scores the answers and explains each one. */
export function QuizView({ quiz }: { quiz: Quiz }) {
  const { t } = useTranslation();
  const [answers, setAnswers] = useState<(number | null)[]>(() => quiz.questions.map(() => null));
  const attempt = useMutation({
    mutationFn: (chosen: number[]) => submitQuizAttempt(quiz.id, chosen),
  });
  const result = attempt.data;
  const complete = answers.every((answer) => answer !== null);

  return (
    <section aria-labelledby="quiz-title" className="flex flex-col gap-5">
      <h3 id="quiz-title" className="font-display text-xl font-bold">
        {quiz.title}
      </h3>
      {result === undefined ? null : (
        <p role="status" className="rounded-card bg-ink p-4 text-center text-on-ink">
          <span className="block font-display text-4xl font-bold">
            {t('study.score', { score: result.score, total: result.total })}
          </span>
          {t('study.scoreText')}
        </p>
      )}
      <ol className="flex flex-col gap-5">
        {quiz.questions.map((question, questionIndex) => {
          const outcome = result?.results[questionIndex];
          return (
            <li key={question.id}>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 font-semibold">
                  {questionIndex + 1}. {question.prompt}
                </legend>
                {question.options.map((option, optionIndex) => {
                  const correct = outcome?.correctIndex === optionIndex;
                  const wrongChoice =
                    outcome !== undefined &&
                    !outcome.isCorrect &&
                    outcome.chosenIndex === optionIndex;
                  return (
                    <label
                      key={option}
                      className={`flex cursor-pointer items-center gap-3 rounded-control border p-3 has-checked:border-ink ${
                        correct ? 'border-ink' : wrongChoice ? 'border-danger' : 'border-line'
                      }`}
                    >
                      <input
                        type="radio"
                        name={question.id}
                        checked={answers[questionIndex] === optionIndex}
                        disabled={result !== undefined}
                        onChange={() => {
                          setAnswers(
                            answers.map((answer, position) =>
                              position === questionIndex ? optionIndex : answer,
                            ),
                          );
                        }}
                        className="size-4 accent-ink"
                      />
                      <span className="flex-1">{option}</span>
                      {correct ? (
                        <Check aria-label={t('study.correct')} className="size-5" />
                      ) : null}
                      {wrongChoice ? (
                        <X aria-label={t('study.wrong')} className="size-5 text-danger" />
                      ) : null}
                    </label>
                  );
                })}
                {outcome?.explanation ? (
                  <p className="text-sm text-muted">{outcome.explanation}</p>
                ) : null}
              </fieldset>
            </li>
          );
        })}
      </ol>
      {attempt.isError ? <FormAlert>{t(errorKey(attempt.error))}</FormAlert> : null}
      {result === undefined ? (
        <Button
          disabled={!complete || attempt.isPending}
          onClick={() => {
            attempt.mutate(answers.map((answer) => answer ?? 0));
          }}
        >
          {attempt.isPending ? t('study.grading') : t('study.grade')}
        </Button>
      ) : (
        <Button
          variant="secondary"
          onClick={() => {
            setAnswers(quiz.questions.map(() => null));
            attempt.reset();
          }}
        >
          {t('study.retry')}
        </Button>
      )}
    </section>
  );
}
