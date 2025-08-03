// Jest type definitions for TypeScript
/// <reference types="jest" />

declare global {
  const jest: typeof import('jest');
  const expect: typeof import('expect');
  const describe: typeof import('jest').describe;
  const it: typeof import('jest').it;
  const test: typeof import('jest').test;
  const beforeEach: typeof import('jest').beforeEach;
  const afterEach: typeof import('jest').afterEach;
  const beforeAll: typeof import('jest').beforeAll;
  const afterAll: typeof import('jest').afterAll;
}

export {};
