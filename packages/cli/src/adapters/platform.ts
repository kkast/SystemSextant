import { randomUUID } from 'node:crypto';
import type { Clock, IdGenerator } from '@systemsextant/core';

export const systemClock: Clock = {
  now: () => new Date(),
};

export const uuidGenerator: IdGenerator = {
  createSessionId: () => randomUUID(),
};
