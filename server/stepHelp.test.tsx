// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { STEP_HELP } from '../client/src/lib/stepHelp';
import StepHelpHint from '../client/src/components/StepHelpHint';

describe('محتوى الدليل المصغر', () => {
  it('لكل مرحلة سطر شرح ونقطتا مساعدة على الأقل', () => {
    for (const step of ['upload', 'details', 'final'] as const) {
      expect(STEP_HELP[step].line.trim().length).toBeGreaterThan(10);
      expect(STEP_HELP[step].tips.length).toBeGreaterThanOrEqual(2);
      for (const tip of STEP_HELP[step].tips) expect(tip.trim().length).toBeGreaterThan(5);
    }
  });
});

describe('مكون التلميح السياقي', () => {
  afterEach(cleanup);

  it('يعرض سطر الشرح وتبقى النقاط مخفية حتى الضغط على كيف؟', () => {
    render(<StepHelpHint step="details" />);
    expect(screen.getByText(STEP_HELP.details.line)).toBeTruthy();
    expect(screen.queryByText(STEP_HELP.details.tips[0])).toBeNull();
    const toggle = screen.getByText('كيف؟');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(STEP_HELP.details.tips[0])).toBeTruthy();
    fireEvent.click(toggle);
    expect(screen.queryByText(STEP_HELP.details.tips[0])).toBeNull();
  });

  it('يعيد طي النقاط عند تغيير المرحلة', () => {
    const { rerender } = render(<StepHelpHint step="details" />);
    fireEvent.click(screen.getByText('كيف؟'));
    expect(screen.getByText(STEP_HELP.details.tips[0])).toBeTruthy();
    rerender(<StepHelpHint step="final" />);
    expect(screen.getByText(STEP_HELP.final.line)).toBeTruthy();
    expect(screen.queryByText(STEP_HELP.final.tips[0])).toBeNull();
  });
});
