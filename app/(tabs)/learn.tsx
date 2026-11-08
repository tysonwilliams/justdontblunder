import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';

import { LessonList } from '@/src/components/LessonList';
import { LessonPlayer } from '@/src/components/LessonPlayer';
import { PlaySkeleton } from '@/src/components/ui/Skeleton';
import { legacyLearnRedirect } from '@/src/logic/drillLink';
import { parseLessonId, type LessonId } from '@/src/logic/lessons';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function LearnScreen() {
  const params = useLocalSearchParams<{
    pick?: string | string[];
    review?: string | string[];
    lesson?: string | string[];
  }>();
  const router = useRouter();
  const redirect = legacyLearnRedirect({
    pick: firstParam(params.pick),
    review: firstParam(params.review),
  });
  const lessonId = parseLessonId(firstParam(params.lesson));

  useEffect(() => {
    if (redirect) router.replace(redirect as Href);
  }, [redirect, router]);

  if (redirect) return <PlaySkeleton />;

  const openLesson = (id: LessonId) => {
    router.setParams({ lesson: id });
  };

  if (!lessonId) return <LessonList onOpen={openLesson} />;

  return (
    <LessonPlayer
      key={lessonId}
      lessonId={lessonId}
      onBack={() => router.setParams({ lesson: '' })}
      onPractice={(href) => router.push(href as Href)}
    />
  );
}
