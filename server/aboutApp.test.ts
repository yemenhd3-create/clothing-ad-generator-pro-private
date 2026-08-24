import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import AboutApp from '../client/src/components/AboutApp';

describe('about application screen', () => {
  it('shows the developer identity and contact details inside the application', () => {
    const html = renderToStaticMarkup(createElement(AboutApp, { onBack: () => undefined }));

    expect(html).toContain('المهندس مروان داغس');
    expect(html).toContain('770976559');
    expect(html).toContain('https://wa.me/967770976559');
    expect(html).toContain('واتساب للتواصل');
    expect(html).not.toContain('GitHub والبريد');
    expect(html).toContain('yemenhd3-create');
  });
});
