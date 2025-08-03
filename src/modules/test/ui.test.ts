import { bindButton, showMessage, showLoadingIndicator, showProcessingSpinner } from '@modules/ui';

describe('ui module', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('bindButton attaches click handler', () => {
    const btn = document.createElement('button');
    const handler = jest.fn();
    bindButton(btn as HTMLButtonElement, handler);
    btn.click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('showMessage sets text content of #result', () => {
    const div = document.createElement('div');
    div.id = 'result';
    document.body.appendChild(div);
    showMessage('Hello');
    expect(div.textContent).toBe('Hello');
  });

  test('showLoadingIndicator toggles indicator text', () => {
    showLoadingIndicator(true);
    const indicator = document.getElementById('loading-indicator') as HTMLDivElement;
    expect(indicator).not.toBeNull();
    expect(indicator.textContent).toBe('Loading WASM...');
    showLoadingIndicator(false);
    expect(indicator.textContent).toBe('');
  });

  test('showProcessingSpinner creates and toggles overlay', () => {
    showProcessingSpinner(true);
    const overlay = document.getElementById('processing-spinner') as HTMLDivElement;
    expect(overlay).not.toBeNull();
    expect(overlay.style.display).toBe('flex');
    showProcessingSpinner(false);
    expect(overlay.style.display).toBe('none');
  });
});
