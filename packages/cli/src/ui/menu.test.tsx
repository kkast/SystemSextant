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
});
