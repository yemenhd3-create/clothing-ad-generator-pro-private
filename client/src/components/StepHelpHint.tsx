import { Lightbulb } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { STEP_HELP, type WorkflowHelpStep } from '@/lib/stepHelp';

/**
 * دليل مصغّر داخل المرحلة: سطر شرح واحد دائم، وزر «كيف؟» يفتح نقاطاً قصيرة.
 */
export default function StepHelpHint({ step }: { step: WorkflowHelpStep }) {
  const [expanded, setExpanded] = useState(false);
  const help = STEP_HELP[step];

  useEffect(() => {
    setExpanded(false);
  }, [step]);

  return (
    <div className="mb-4 rounded-2xl bg-secondary/60 px-3 py-2" data-testid={`step-help-${step}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-start gap-1.5 text-xs font-bold leading-5 text-primary/90">
          <Lightbulb size={14} className="mt-0.5 shrink-0 text-accent" />
          <span>{help.line}</span>
        </p>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(current => !current)}
          className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-primary shadow-sm transition active:scale-95"
        >
          كيف؟
        </button>
      </div>
      {expanded && (
        <ul className="mt-2 space-y-1 border-t border-primary/10 pt-2 text-[11px] leading-5 text-muted-foreground">
          {help.tips.map(tip => (
            <li key={tip} className="flex items-start gap-1.5">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/50" />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
