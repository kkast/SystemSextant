import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from 'ink-testing-library';
import { Menu } from './menu.js';

describe('Menu', () => {
  it('can display every option description for a review screen', () => {
    const { lastFrame } = render(
      <Menu
        options={[
          { value: 'first', label: 'First answer', description: 'One' },
          { value: 'second', label: 'Second answer', description: 'Two' },
        ]}
        showDescriptions
        onSelect={() => {}}
      />,
    );

    expect(lastFrame()).toContain('One');
    expect(lastFrame()).toContain('Two');
  });

  it('invokes a configured quick action without moving the selection', async () => {
    let selected: string | undefined;
    const { stdin } = render(
      <Menu options={[{ value: 'generate', label: 'Generate', shortcut: 'g' }]} onSelect={(value) => { selected = value; }} />,
    );
    stdin.write('g');
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(selected).toBe('generate');
  });
});
