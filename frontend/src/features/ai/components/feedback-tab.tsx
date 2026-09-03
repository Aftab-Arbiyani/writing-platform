import { QButton, QSelect } from '@qalam/ui';
import { Gauge } from 'lucide-react';
import { useState, type ReactElement } from 'react';

import { AllowanceHint } from '@/components/allowance-hint';
import { getErrorMessage } from '@/lib/errors';

import { COACH_TOOLS } from '../lib/coach-tools';
import type { CoachReport } from '../lib/coach-report';
import { useCraftCoach } from '../hooks/use-craft-coach';
import { ModelDisclosureNote } from './model-disclosure-note';

function Bullets({ title, items }: { title: string; items: string[] }): ReactElement | null {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-1">
      <h4 className="text-sm font-medium text-ink">{title}</h4>
      <ul className="flex list-disc flex-col gap-1 ps-5 text-sm text-ink-secondary">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

/** The parsed report. Read-only by nature — a coach gives notes, it does not edit the draft. */
function ReportView({ report }: { report: CoachReport }): ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Gauge size={18} strokeWidth={1.75} className="text-ink-muted" aria-hidden />
        <span className="text-sm text-ink-secondary">
          Craft score <span className="font-medium text-ink tabular-nums">{report.score}</span>
          /100
        </span>
      </div>

      {report.summary === '' ? null : <p className="text-sm text-ink">{report.summary}</p>}

      <Bullets title="Strengths" items={report.strengths} />
      <Bullets title="Weaknesses" items={report.weaknesses} />
      <Bullets title="Suggestions" items={report.suggestions} />
      <Bullets title="Next steps" items={report.recommendations} />

      {report.sections.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h4 className="text-sm font-medium text-ink">Detail</h4>
          {report.sections.map((section) => (
            <div key={section.title} className="rounded-md bg-raised p-3">
              <p className="text-sm font-medium text-ink">{section.title}</p>
              <p className="mt-1 text-sm text-ink-secondary">{section.detail}</p>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}

/**
 * The Manuscript feedback tab (D5, was Craft Coach) — pick a lens, get a structured report on the
 * current draft.
 *
 * **It never touches the document**, which is why there is no accept/reject here as there is on
 * Polish: it produces notes, and the writer acts on them or does not. That property is the reason
 * this tool survived D5 unchanged in everything but its name — a reader's report on a manuscript is
 * the least objectionable thing in this category, and the closest to what an editor already does.
 */
export function FeedbackTab({ disabled }: { disabled: boolean }): ReactElement {
  const coach = useCraftCoach();
  const [toolValue, setToolValue] = useState(COACH_TOOLS[0].value);
  const tool = COACH_TOOLS.find((t) => t.value === toolValue) ?? COACH_TOOLS[0];
  const result = coach.data;

  return (
    <div className="flex flex-col gap-4">
      <QSelect
        label="Lens"
        hint={tool.description}
        value={toolValue}
        onChange={(value) => {
          if (typeof value === 'string') setToolValue(value);
        }}
        options={COACH_TOOLS.map((t) => ({ value: t.value, label: t.label }))}
      />

      <QButton
        variant="primary"
        size="sm"
        loading={coach.isPending}
        disabled={disabled || coach.isPending}
        onClick={() => {
          coach.mutate(tool);
        }}
      >
        Review my draft
      </QButton>

      <AllowanceHint featureKey="feedbackReportsPerDay" />

      {coach.isError ? (
        <p className="text-sm text-danger-text">{getErrorMessage(coach.error)}</p>
      ) : null}

      {result ? (
        <div className="flex flex-col gap-3 border-t border-line pt-3">
          <p className="text-sm font-medium text-ink">{result.tool.label}</p>
          {result.report ? (
            <ReportView report={result.report} />
          ) : (
            // The model ignored its JSON contract. Showing what it said beats showing an error:
            // the notes may still be useful, and the writer can judge.
            <p className="whitespace-pre-wrap rounded-md bg-raised p-3 text-sm text-ink">
              {result.raw}
            </p>
          )}
        </div>
      ) : null}
      <ModelDisclosureNote />
    </div>
  );
}
