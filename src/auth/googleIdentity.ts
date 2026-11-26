import type { GoogleIdentityClient } from '@/src/auth/googleSignIn';

export const GOOGLE_IDENTITY_SRC = 'https://accounts.google.com/gsi/client';

export const GOOGLE_BUTTON_HOST_ID = 'jdb-google-signin';

type GoogleScriptNode = {
  src: string;
  async: boolean;
  addEventListener: (type: 'load' | 'error', listener: () => void, options?: { once?: boolean }) => void;
  remove: () => void;
};

type GoogleHostWindow = Window & {
  google?: { accounts?: { id?: GoogleIdentityClient } };
};

export type GoogleScriptDocument = {
  head: { appendChild: (node: GoogleScriptNode) => void };
  createElement: (tag: string) => GoogleScriptNode;
  querySelector: (selector: string) => GoogleScriptNode | null;
  defaultView: GoogleHostWindow | null;
};

let inflight: Promise<void> | null = null;

export function resetGoogleIdentityScriptForTests(): void {
  inflight = null;
}

export function googleIdentityFrom(view: Window): GoogleIdentityClient | null {
  return (view as GoogleHostWindow).google?.accounts?.id ?? null;
}

/**
 * Insert the GIS script on first use. A second call shares the same load.
 * Call this from web only; native sign-in never reaches it.
 */
export function loadGoogleIdentityScript(doc: GoogleScriptDocument): Promise<void> {
  if (googleIdentityFromView(doc.defaultView)) return Promise.resolve();
  if (inflight) return inflight;
  inflight = new Promise((resolve, reject) => {
    const found = doc.querySelector(`script[src="${GOOGLE_IDENTITY_SRC}"]`);
    const script = found ?? doc.createElement('script');
    const fail = (error: Error) => {
      inflight = null;
      script.remove();
      reject(error);
    };
    const finish = () => {
      if (googleIdentityFromView(doc.defaultView)) {
        resolve();
        return;
      }
      queueMicrotask(() => {
        if (googleIdentityFromView(doc.defaultView)) {
          resolve();
          return;
        }
        fail(new Error('Google sign-in did not load'));
      });
    };
    script.addEventListener('load', finish, { once: true });
    script.addEventListener('error', () => fail(new Error('Google sign-in did not load')), { once: true });
    if (!found) {
      script.src = GOOGLE_IDENTITY_SRC;
      script.async = true;
      doc.head.appendChild(script);
    }
  });
  return inflight;
}

export function currentGoogleScriptDocument(): GoogleScriptDocument | null {
  if (typeof document === 'undefined' || !document.defaultView) return null;
  const view = document.defaultView;
  return {
    head: {
      appendChild: (node) => {
        document.head.appendChild(node as unknown as Node);
      },
    },
    createElement: (tag) => document.createElement(tag) as unknown as GoogleScriptNode,
    querySelector: (selector) => document.querySelector(selector) as GoogleScriptNode | null,
    defaultView: view as GoogleHostWindow,
  };
}

function googleIdentityFromView(view: GoogleHostWindow | null): GoogleIdentityClient | null {
  return view?.google?.accounts?.id ?? null;
}
