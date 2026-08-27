import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { MultiSelect } from './multi-select.js';

describe('MultiSelect', () => {
  it('requires a selection when configured before submitting', async () => {
    const onSubmit = vi.fn();
    const { stdin, lastFrame } = render(
      <MultiSelect
        options={[{ value: 'github', label: 'GitHub' }]}
        initialValues={[]}
        minimumSelections={1}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />,
    );

    stdin.write('\r');
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(lastFrame()).toContain('Choose at least one option.');

    stdin.write(' ');
    await new Promise((resolve) => setTimeout(resolve, 10));
    stdin.write('\r');
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(onSubmit).toHaveBeenCalledWith(['github']);
  });
});
