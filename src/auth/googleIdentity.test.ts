import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  GOOGLE_IDENTITY_SRC,
  currentGoogleScriptDocument,
  loadGoogleIdentityScript,
  resetGoogleIdentityScriptForTests,
  type GoogleScriptDocument,
} from '@/src/auth/googleIdentity';
import type { GoogleIdentityClient } from '@/src/auth/googleSignIn';

type Listener = () => void;

function fakeDocument(googleReady = false) {
  const listeners = new Map<string, Listener[]>();
  const script = {
    src: '',
    async: false,
    addEventListener(type: string, listener: Listener) {
      const list = listeners.get(type) ?? [];
      list.push(listener);
      listeners.set(type, list);
    },
    remove: vi.fn(),
  };
  const view: { google?: { accounts: { id: GoogleIdentityClient } } } = {};
  if (googleReady) {
    view.google = { accounts: { id: { initialize: vi.fn(), renderButton: vi.fn() } } };
  }
  const doc: GoogleScriptDocument = {
    head: { appendChild: vi.fn() },
    createElement: vi.fn(() => script),
    querySelector: vi.fn(() => null),
    defaultView: view as unknown as GoogleScriptDocument['defaultView'],
  };
  return {
    doc,
    script,
    view,
    fire(type: 'load' | 'error') {
      for (const listener of listeners.get(type) ?? []) listener();
    },
  };
}

describe('GIS script', () => {
  afterEach(() => {
    resetGoogleIdentityScriptForTests();
  });

  it('stays unloaded until something asks for it', () => {
    expect(currentGoogleScriptDocument()).toBeNull();
  });

  it('inserts the script once and resolves when GIS is ready', async () => {
    const page = fakeDocument();
    const first = loadGoogleIdentityScript(page.doc);
    const second = loadGoogleIdentityScript(page.doc);
    expect(page.doc.createElement).toHaveBeenCalledTimes(1);
    expect(page.doc.head.appendChild).toHaveBeenCalledTimes(1);
    expect(page.script.src).toBe(GOOGLE_IDENTITY_SRC);
    expect(page.script.async).toBe(true);
    page.view.google = { accounts: { id: { initialize: vi.fn(), renderButton: vi.fn() } } };
    page.fire('load');
    await expect(first).resolves.toBeUndefined();
    await second;
    await loadGoogleIdentityScript(page.doc);
    expect(page.doc.createElement).toHaveBeenCalledTimes(1);
  });

  it('skips insertion when GIS is already on the page', async () => {
    const page = fakeDocument(true);
    await loadGoogleIdentityScript(page.doc);
    expect(page.doc.createElement).not.toHaveBeenCalled();
  });

  it('rejects and removes the script when GIS does not appear', async () => {
    const page = fakeDocument();
    const pending = loadGoogleIdentityScript(page.doc);
    page.fire('load');
    await expect(pending).rejects.toThrow(/did not load/);
    expect(page.script.remove).toHaveBeenCalledOnce();
  });

  it('rejects when the script fails to load', async () => {
    const page = fakeDocument();
    const pending = loadGoogleIdentityScript(page.doc);
    page.fire('error');
    await expect(pending).rejects.toThrow(/did not load/);
    expect(page.script.remove).toHaveBeenCalledOnce();
  });
});
