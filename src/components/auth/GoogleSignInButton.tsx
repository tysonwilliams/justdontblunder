import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type HostInstance } from 'react-native';

import {
  GOOGLE_BUTTON_HOST_ID,
  currentGoogleScriptDocument,
  googleIdentityFrom,
  loadGoogleIdentityScript,
} from '@/src/auth/googleIdentity';
import { createGoogleNonce, type GoogleNonce } from '@/src/auth/googleNonce';
import {
  googleButtonConfig,
  googleIdentityConfig,
  paintGoogleButton,
  type GoogleIdentityClient,
} from '@/src/auth/googleSignIn';
import { useLayout } from '@/src/components/ui/useLayout';

type Props = {
  clientId: string;
  scheme: 'dark' | 'light';
  onCredential: (credential: string, rawNonce: string) => void;
  onScriptError: () => void;
};

/**
 * Google's official button. The script loads on mount, on web only.
 * A missing script tells the account screen to use the redirect button.
 */
export function GoogleSignInButton({ clientId, scheme, onCredential, onScriptError }: Props) {
  const { phone } = useLayout();
  const hostRef = useRef<HTMLElement | null>(null);
  const nonceRef = useRef<GoogleNonce | null>(null);
  const googleRef = useRef<GoogleIdentityClient | null>(null);
  const generationRef = useRef<object | null>(null);
  const onCredentialRef = useRef(onCredential);
  const onScriptErrorRef = useRef(onScriptError);
  const [width, setWidth] = useState(0);
  const [ready, setReady] = useState(false);
  onCredentialRef.current = onCredential;
  onScriptErrorRef.current = onScriptError;

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const doc = currentGoogleScriptDocument();
    const view = doc?.defaultView;
    if (!doc || !view) {
      onScriptErrorRef.current();
      return;
    }
    let live = true;
    const generation = {};
    generationRef.current = generation;
    const pendingScript = loadGoogleIdentityScript(doc);
    void (async () => {
      try {
        const [nonce] = await Promise.all([createGoogleNonce(), pendingScript]);
        if (!live || generationRef.current !== generation) return;
        nonceRef.current = nonce;
        const gis = googleIdentityFrom(view);
        if (!gis) throw new Error('Google sign-in did not load');
        googleRef.current = gis;
        gis.initialize(
          googleIdentityConfig({
            clientId,
            hashedNonce: nonce.hashed,
            onCredential: (credential) => {
              const raw = nonceRef.current?.raw;
              if (!raw) return;
              onCredentialRef.current(credential, raw);
            },
          }),
        );
        if (live) setReady(true);
      } catch {
        if (live && generationRef.current === generation) onScriptErrorRef.current();
      }
    })();
    return () => {
      live = false;
    };
  }, [clientId]);

  useEffect(() => {
    drawGoogleButton(ready, scheme, width, googleRef.current, hostElement(hostRef.current));
  }, [ready, scheme, width]);

  // React does not own the nodes Google inserts. If a later render clears them, draw again.
  useEffect(() => {
    const parent = hostElement(hostRef.current);
    if (!parent || parent.childElementCount > 0) return;
    drawGoogleButton(ready, scheme, width, googleRef.current, parent);
  });

  if (Platform.OS !== 'web') return null;

  return (
    <View
      nativeID={GOOGLE_BUTTON_HOST_ID}
      testID="account-google"
      collapsable={false}
      ref={(node: HostInstance | null) => {
        hostRef.current = node instanceof HTMLElement ? node : null;
      }}
      onLayout={(event) => {
        const next = Math.floor(event.nativeEvent.layout.width);
        setWidth((current) => (current === next ? current : next));
      }}
      style={[styles.host, phone ? styles.hostPhone : null]}
    />
  );
}

function drawGoogleButton(
  ready: boolean,
  scheme: 'dark' | 'light',
  width: number,
  gis: GoogleIdentityClient | null,
  parent: HTMLElement | null,
) {
  if (!ready || Platform.OS !== 'web') return;
  const options = googleButtonConfig(scheme, width);
  if (!gis || !parent || !options) return;
  paintGoogleButton(gis, parent, options);
}

function hostElement(node: HTMLElement | null): HTMLElement | null {
  if (node) return node;
  if (typeof document === 'undefined') return null;
  return document.getElementById(GOOGLE_BUTTON_HOST_ID);
}

const styles = StyleSheet.create({
  host: {
    alignSelf: 'stretch',
    minHeight: 48,
    justifyContent: 'center',
  },
  hostPhone: {
    minHeight: 44,
  },
});
