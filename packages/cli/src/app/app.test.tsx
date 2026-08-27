import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from 'ink-testing-library';
import type { SessionRepository } from '@systemsextant/core';
import { App } from './app.js';

const repository: SessionRepository = {
  async create() {},
  async list() {
    return [];
  },
  async get() {
    return undefined;
  },
  async delete() {},
};

function renderApp() {
  return render(
    <App
      repository={repository}
      clipboard={{ write: async () => {} }}
      clock={{ now: () => new Date('2026-08-27T12:00:00.000Z') }}
      ids={{ createSessionId: () => 'session-1' }}
      generatorVersion="0.1.0"
      dataDirectory="/tmp/systemsextant-test"
    />,
  );
}

describe('App', () => {
  it('opens on the session home screen', () => {
    const { lastFrame } = renderApp();
    expect(lastFrame()).toContain('SystemSextant');
    expect(lastFrame()).toContain('New session');
    expect(lastFrame()).toContain('Past sessions');
  });

  it('starts the questionnaire from the bare home screen', async () => {
    const { stdin, lastFrame } = renderApp();
    stdin.write('\r');
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(lastFrame()).toContain('Project name');
  });
});
