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
    expect(lastFrame()).toContain('Supported stacks and tools');
  });

  it('opens the supported stack catalog from the home screen', async () => {
    const { stdin, lastFrame } = renderApp();
    stdin.write('\u001b[B');
    await new Promise((resolve) => setTimeout(resolve, 10));
    stdin.write('\u001b[B');
    await new Promise((resolve) => setTimeout(resolve, 10));
    stdin.write('\r');
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(lastFrame()).toContain('Supported stacks and tools');
    expect(lastFrame()).toContain('Cloudflare Workers');
  });

  it('starts the multi-component architecture builder from the bare home screen', async () => {
    const { stdin, lastFrame } = renderApp();
    stdin.write('\r');
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(lastFrame()).toContain('New session');
    expect(lastFrame()).toContain('Question 1');
    expect(lastFrame()).toContain('Project name');
  });

  it('uses a role-based UI name and allows an empty description', async () => {
    const { stdin, lastFrame } = renderApp();
    const wait = () => new Promise((resolve) => setTimeout(resolve, 10));
    stdin.write('\r'); await wait();
    stdin.write('Example'); await wait(); stdin.write('\r'); await wait();
    stdin.write('\r'); await wait();
    stdin.write('\u001b[B'); await wait(); stdin.write('\r'); await wait();
    expect(lastFrame()).toContain('UI 1: purpose');
    expect(lastFrame()).toContain('› Admin portal');
    stdin.write('\r'); await wait();
    expect(lastFrame()).toContain('UI 1: name');
    expect(lastFrame()).toContain('Admin portal');
    stdin.write('\r'); await wait();
    expect(lastFrame()).toContain('description (optional)');
    stdin.write('\r'); await wait();
    expect(lastFrame()).toContain('UI 1: technology');
  });
});
