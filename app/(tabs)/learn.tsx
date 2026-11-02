import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { DrillSession } from '@/src/components/DrillSession';
import { type LearnStep } from '@/src/components/LearnStepBar';
import { SafeChoiceSession } from '@/src/components/SafeChoiceSession';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function LearnScreen() {
  const params = useLocalSearchParams<{ review?: string | string[]; pick?: string | string[] }>();
  const router = useRouter();
  const reviewing = firstParam(params.review) === '1';
  const pick = firstParam(params.pick) === '1';
  const [step, setStep] = useState<LearnStep>(!reviewing && pick ? 'pick' : 'play');

  useEffect(() => {
    setStep(reviewing || !pick ? 'play' : 'pick');
  }, [pick, reviewing]);

  const onStep = (next: LearnStep) => {
    setStep(next);
    router.setParams({ pick: next === 'pick' ? '1' : '' });
  };

  if (reviewing) {
    return <DrillSession mode="learn" reviewing />;
  }

  switch (step) {
    case 'pick':
      return <SafeChoiceSession onStep={onStep} />;
    case 'play':
      return <DrillSession mode="learn" onStep={onStep} />;
    default: {
      const _exhaustive: never = step;
      return _exhaustive;
    }
  }
}
