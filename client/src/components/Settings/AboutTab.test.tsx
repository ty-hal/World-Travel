import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../../../tests/helpers/render';
import { resetAllStores } from '../../../tests/helpers/store';
import AboutTab from './AboutTab';

beforeEach(() => {
  resetAllStores();
  vi.clearAllMocks();
});

describe('AboutTab', () => {
  it('renders the local help link and version badge', () => {
    render(<AboutTab appVersion="2.9.10" />);
    expect(screen.getByText('v2.9.10')).toBeInTheDocument();
    expect(screen.getByText('Wiki').closest('a')).toHaveAttribute('href', '/help');
  });

  it('does not expose upstream community or contribution links', () => {
    render(<AboutTab appVersion="2.9.10" />);
    expect(screen.queryByText('Ko-fi')).not.toBeInTheDocument();
    expect(screen.queryByText('Buy Me a Coffee')).not.toBeInTheDocument();
    expect(screen.queryByText('Discord')).not.toBeInTheDocument();
    expect(document.querySelector('a[href*="github.com"]')).not.toBeInTheDocument();
  });

  it('keeps the wiki hover treatment', () => {
    render(<AboutTab appVersion="1.0.0" />);
    const link = screen.getByText('Wiki').closest('a') as HTMLAnchorElement;
    fireEvent.mouseEnter(link);
    expect(link.style.borderColor).toBe('rgb(99, 102, 241)');
    expect(link.style.boxShadow).not.toBe('');
    fireEvent.mouseLeave(link);
    expect(link.style.borderColor).toBe('var(--border-primary)');
    expect(link.style.boxShadow).toBe('none');
  });
});
