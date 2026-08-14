import { searchThresholds } from "@/config/search-thresholds";
import { findTopicLanding } from "@/domain/discovery/topic-landings";
import { parseIntentDeterministic } from "@/domain/search/nl-intent";

export type LearningPathStep = {
  title: string;
  topicSlug?: string;
  query: string;
  courseIds: string[];
};

export type LearningPath = {
  goal: string;
  topicSlug: string | null;
  steps: LearningPathStep[];
};

const TOPIC_STEP_LABELS: Record<string, string> = {
  ai: "AI & machine learning",
  python: "Python",
  cybersecurity: "cybersecurity",
  "project-management": "project management",
  "data-science": "data science",
  cloud: "cloud computing",
  programming: "programming",
};

/**
 * Deterministic goal → step scaffold (plan §93.4). Steps carry search
 * queries, not course picks: `courseIds` stays empty until an editor (or a
 * later milestone) fills it — an empty list is honest, a guessed one is not.
 */
export function buildLearningPath(goal: string): LearningPath | null {
  const trimmed = goal.trim();
  if (!trimmed) return null;

  const intent = parseIntentDeterministic(trimmed);
  const topicSlug =
    intent.topics.find((topic) => findTopicLanding(topic)) ?? null;
  const subject = topicSlug
    ? (TOPIC_STEP_LABELS[topicSlug] ?? topicSlug)
    : trimmed;

  const step = (title: string, query: string): LearningPathStep => ({
    title,
    ...(topicSlug ? { topicSlug } : {}),
    query,
    courseIds: [],
  });

  const steps: LearningPathStep[] = [
    step(`Learn ${subject} fundamentals`, `${subject} beginner`),
    step(`Build core ${subject} skills`, subject),
    step(`Practice with a ${subject} project`, `${subject} project`),
  ];

  if (intent.certificateRequired) {
    steps.push(
      step(`Earn a ${subject} certificate`, `${subject} certificate`),
    );
  }

  if (
    steps.length < searchThresholds.learningPathStepsMin ||
    steps.length > searchThresholds.learningPathStepsMax
  ) {
    return null;
  }

  return { goal: trimmed, topicSlug, steps };
}
