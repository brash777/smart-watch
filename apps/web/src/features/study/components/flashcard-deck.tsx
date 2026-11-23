import type { FlashcardDeck } from '@snapia/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/button';

/** One card at a time; tapping it turns it over to show the answer. */
export function FlashcardDeckView({ deck }: { deck: FlashcardDeck }) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = deck.cards[index];
  if (card === undefined) return null;

  function go(next: number) {
    setIndex(next);
    setFlipped(false);
  }

  return (
    <section aria-labelledby="deck-title" className="flex flex-col gap-3">
      <h3 id="deck-title" className="font-display text-xl font-bold">
        {deck.title}
      </h3>
      <p className="text-sm text-muted">
        {t('study.cardPosition', { current: index + 1, total: deck.cards.length })}
      </p>
      <button
        type="button"
        aria-pressed={flipped}
        aria-label={flipped ? t('study.showQuestion') : t('study.showAnswer')}
        onClick={() => {
          setFlipped(!flipped);
        }}
        className="perspective-distant"
      >
        <span
          className={`relative grid min-h-56 transition-transform duration-500 transform-3d ${flipped ? 'rotate-y-180' : ''}`}
        >
          <span className="col-start-1 row-start-1 flex flex-col items-center justify-center gap-2 rounded-card border border-line bg-surface p-6 text-center backface-hidden">
            <span className="text-xs font-semibold text-muted">{t('study.question')}</span>
            <span className="text-lg font-semibold">{card.question}</span>
          </span>
          <span className="col-start-1 row-start-1 flex rotate-y-180 flex-col items-center justify-center gap-2 rounded-card bg-ink p-6 text-center text-on-ink backface-hidden">
            <span className="text-xs font-semibold">{t('study.answer')}</span>
            <span className="text-lg">{card.answer}</span>
          </span>
        </span>
      </button>
      <p className="text-center text-sm text-muted">{t('study.tapToFlip')}</p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          disabled={index === 0}
          onClick={() => {
            go(index - 1);
          }}
        >
          {t('study.previousCard')}
        </Button>
        <Button
          variant="secondary"
          disabled={index === deck.cards.length - 1}
          onClick={() => {
            go(index + 1);
          }}
        >
          {t('study.nextCard')}
        </Button>
      </div>
    </section>
  );
}
