import type {
  AnalysisStatus,
  ContentSnapInsight,
  SnapInsight,
  StudySnapInsight,
  WorkSnapInsight,
} from '@snapia/shared';
import { LoaderCircle } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/button';
import { Markdown } from '../../../components/markdown';
import { Skeleton } from '../../../components/skeleton';
import { copyText } from '../../../lib/clipboard';
import { useSnapInsight } from '../hooks/use-snaps';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-muted">{title}</h3>
      {children}
    </section>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item} className="rounded-full border border-line px-3 py-1 text-sm">
          {item}
        </li>
      ))}
    </ul>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="ml-5 list-disc space-y-1">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/** Copies a text and says so until the text changes. */
function CopyButton({ text, label }: { text: string; label: string }) {
  const { t } = useTranslation();
  const [copiedText, setCopiedText] = useState<string | null>(null);
  return (
    <Button
      variant="secondary"
      fullWidth={false}
      onClick={() => {
        void copyText(text).then((copied) => {
          setCopiedText(copied ? text : null);
        });
      }}
    >
      <span aria-live="polite">{copiedText === text ? t('viewer.copied') : label}</span>
    </Button>
  );
}

function StudyInsight({ data }: { data: StudySnapInsight }) {
  const { t } = useTranslation();
  return (
    <>
      <Section title={t('viewer.study.text')}>
        {data.extractedText === '' ? (
          <p className="text-muted">{t('viewer.study.noText')}</p>
        ) : (
          <>
            <Markdown>{data.extractedText}</Markdown>
            <CopyButton text={data.extractedText} label={t('viewer.copy')} />
          </>
        )}
      </Section>
      {data.topics.length > 0 ? (
        <Section title={t('viewer.study.topics')}>
          <Chips items={data.topics} />
        </Section>
      ) : null}
      {data.keyConcepts.length > 0 ? (
        <Section title={t('viewer.study.concepts')}>
          <dl className="flex flex-col gap-2">
            {data.keyConcepts.map((concept) => (
              <div key={concept.term}>
                <dt className="font-semibold">{concept.term}</dt>
                <dd className="text-muted">{concept.definition}</dd>
              </div>
            ))}
          </dl>
        </Section>
      ) : null}
      {data.warnings.length > 0 ? (
        <Section title={t('viewer.study.warnings')}>
          <Bullets items={data.warnings} />
        </Section>
      ) : null}
    </>
  );
}

function WorkInsight({ data }: { data: WorkSnapInsight }) {
  const { t } = useTranslation();
  return (
    <>
      <Section title={t('viewer.work.activity')}>
        <p>{data.activity}</p>
      </Section>
      <Section title={t('viewer.work.progress')}>
        <p>{data.progressNote}</p>
      </Section>
      <Section title={t('viewer.work.issues')}>
        {data.issues.length === 0 ? (
          <p className="text-muted">{t('viewer.work.noIssues')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.issues.map((issue) => (
              <li key={issue.description} className="flex items-start gap-2">
                <span
                  className={`shrink-0 rounded-full border px-2 text-xs font-semibold ${
                    issue.severity === 'HIGH' ? 'border-danger text-danger' : 'border-line'
                  }`}
                >
                  {t(`viewer.work.severity.${issue.severity}`)}
                </span>
                <span>{issue.description}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      {data.objectsDetected.length > 0 ? (
        <Section title={t('viewer.work.objects')}>
          <Chips items={data.objectsDetected} />
        </Section>
      ) : null}
      {data.safetyObservations.length > 0 ? (
        <Section title={t('viewer.work.safety')}>
          <Bullets items={data.safetyObservations} />
        </Section>
      ) : null}
    </>
  );
}

function ContentInsight({ data }: { data: ContentSnapInsight }) {
  const { t } = useTranslation();
  const hashtags = data.hashtags.map((tag) => `#${tag}`).join(' ');
  const caption =
    hashtags === '' ? data.suggestedCaption : `${data.suggestedCaption}\n\n${hashtags}`;
  return (
    <>
      <Section title={t('viewer.content.score')}>
        <p className="font-display text-4xl font-bold">
          {t('viewer.content.scoreValue', { score: data.qualityScore })}
        </p>
        <div className="h-2 overflow-hidden rounded-full bg-line">
          <div className="h-full bg-ink" style={{ width: `${String(data.qualityScore)}%` }} />
        </div>
      </Section>
      {data.qualityTips.length > 0 ? (
        <Section title={t('viewer.content.tips')}>
          <Bullets items={data.qualityTips} />
        </Section>
      ) : null}
      <Section title={t('viewer.content.caption')}>
        <p className="whitespace-pre-line">{caption}</p>
        <CopyButton text={caption} label={t('viewer.content.copyCaption')} />
      </Section>
      <Section title={t('viewer.content.altText')}>
        <p className="text-muted">{data.altText}</p>
      </Section>
    </>
  );
}

function InsightBody({ insight }: { insight: SnapInsight }) {
  switch (insight.mode) {
    case 'STUDY':
      return <StudyInsight data={insight.data} />;
    case 'WORK':
      return <WorkInsight data={insight.data} />;
    case 'CONTENT':
      return <ContentInsight data={insight.data} />;
  }
}

/** What the AI says about a snap, according to the mode of its Space. */
export function InsightPanel({ snapId, status }: { snapId: string; status: AnalysisStatus }) {
  const { t } = useTranslation();
  const insight = useSnapInsight(snapId);
  const analyzing = status === 'PENDING' || status === 'PROCESSING';

  if (insight.isPending) return <Skeleton className="h-32 rounded-card" />;
  if (insight.isError) return <p className="text-danger">{t('viewer.insightError')}</p>;
  if (insight.data === null) {
    return analyzing ? (
      <p role="status" className="flex items-center gap-2 text-muted">
        <LoaderCircle aria-hidden className="size-5 animate-spin" />
        {t('viewer.analyzing')}
      </p>
    ) : (
      <p className="text-muted">{t('viewer.failed')}</p>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      {analyzing ? (
        <p role="status" className="text-sm text-muted">
          {t('viewer.reanalyzing')}
        </p>
      ) : null}
      <p className="text-lg">{insight.data.data.summary}</p>
      <InsightBody insight={insight.data} />
      {insight.data.data.suggestedTags.length > 0 ? (
        <Section title={t('viewer.tags')}>
          <Chips items={insight.data.data.suggestedTags} />
        </Section>
      ) : null}
      {insight.data.editedByUser ? (
        <p className="text-xs text-muted">{t('viewer.edited')}</p>
      ) : null}
    </div>
  );
}
