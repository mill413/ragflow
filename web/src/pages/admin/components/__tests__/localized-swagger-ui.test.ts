import { localizeSwaggerUi } from '../../utils/swagger-ui-localization';

describe('localizeSwaggerUi', () => {
  it('translates Swagger controls without changing request examples', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <button>Try it out</button>
      <h4>Responses</h4>
      <input placeholder="Filter by tag" />
      <pre><code>{"Description":"Try it out"}</code></pre>
    `;

    localizeSwaggerUi(root);

    expect(root.querySelector('button')?.textContent).toBe('调试接口');
    expect(root.querySelector('h4')?.textContent).toBe('响应');
    expect(root.querySelector('input')?.placeholder).toBe('按分组筛选');
    expect(root.querySelector('code')?.textContent).toBe(
      '{"Description":"Try it out"}',
    );
  });
});
