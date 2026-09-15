import { extractKeywords } from "./bioAnalysis";

export interface DateAdviceTopic {
  id: string;
  title: string;
  keywords: string[];
  advice: string;
}

export interface ChatbotResponse {
  topic: DateAdviceTopic | null;
  suggestedTopics: DateAdviceTopic[];
}

// A representative set of real, useful first-date guidance, not
// fabricated LLM output — same "honest heuristic, not a fabricated model"
// scoping call as bioOptimizer.ts.
export const FIRST_DATE_ADVICE_TOPICS: DateAdviceTopic[] = [
  {
    id: "where-to-meet",
    title: "Where should we meet?",
    keywords: ["where", "meet", "location", "venue", "place"],
    advice:
      "Pick a public place you both know how to get to — a coffee shop, a casual restaurant, or a walk in a park all work well. Save anywhere too loud to talk, or anywhere very private, for a later date.",
  },
  {
    id: "what-to-wear",
    title: "What should I wear?",
    keywords: ["wear", "outfit", "clothes", "dress", "clothing"],
    advice:
      "Dress for the venue and slightly nicer than you'd normally go — it shows effort without being overdressed. Comfortable is more important than flashy; you'll come across better relaxed than fidgeting in something new.",
  },
  {
    id: "conversation-starters",
    title: "What do I talk about?",
    keywords: ["talk", "conversation", "topics", "say", "awkward", "silence"],
    advice:
      "Ask open-ended questions about things they've mentioned in their profile or your chat so far — people enjoy talking about what they're already excited about. A little silence is normal; it doesn't mean the date is going badly.",
  },
  {
    id: "nervous",
    title: "What if I'm nervous?",
    keywords: ["nervous", "anxious", "anxiety", "scared", "worried"],
    advice:
      "It's completely normal — most people are nervous before a first date, including the person you're meeting. Arriving a few minutes early to settle in, and remembering this is just a conversation, not an interview, both help.",
  },
  {
    id: "how-long",
    title: "How long should the date be?",
    keywords: ["long", "duration", "time", "hours"],
    advice:
      "An hour or two is plenty for a first date — coffee or a drink gives you an easy, low-pressure length. You can always extend it if it's going well, but it's much easier to extend than to cut a long date short.",
  },
  {
    id: "who-pays",
    title: "Who pays?",
    keywords: ["pay", "paying", "bill", "split", "money"],
    advice:
      "There's no universal rule — offering to split is always a safe, considerate default, and whoever suggested the date offering to cover it is a common, low-pressure norm too. Whatever you choose, deciding gracefully matters more than the specific choice.",
  },
  {
    id: "safety",
    title: "How do I stay safe?",
    keywords: ["safe", "safety", "secure", "protect", "danger"],
    advice:
      "Meet in a public place, tell a friend where you're going and when, and arrange your own transportation there and back. This app's Safety Center lets you share your live date status with a trusted contact if you'd like extra peace of mind.",
  },
];

const MIN_MATCH_SCORE = 1;

function isDateAdviceTopicId(value: unknown): value is string {
  return typeof value === "string" && FIRST_DATE_ADVICE_TOPICS.some((topic) => topic.id === value);
}

/**
 * Hinge's real "Guide chatbot for advice before the first date" (#234):
 * a keyword-matching decision-tree guide over a curated, genuinely useful
 * topic catalog, not a fabricated open-ended LLM chatbot this app has no
 * model or inference infrastructure for — same scoping call as #231's
 * bioOptimizer.ts and #233's conversationCompatibility.ts. A free-text
 * question is matched against each topic's keyword set (reusing #120's
 * `extractKeywords`); the honest fallback for an unmatched question is
 * the real topic list, not an invented answer.
 */
export function listTopics(): DateAdviceTopic[] {
  return FIRST_DATE_ADVICE_TOPICS;
}

export function getTopic(id: string): DateAdviceTopic | undefined {
  return isDateAdviceTopicId(id) ? FIRST_DATE_ADVICE_TOPICS.find((topic) => topic.id === id) : undefined;
}

export function ask(question: string): ChatbotResponse {
  const questionKeywords = new Set(extractKeywords(question));

  let bestTopic: DateAdviceTopic | null = null;
  let bestScore = 0;
  for (const topic of FIRST_DATE_ADVICE_TOPICS) {
    const score = topic.keywords.filter((keyword) => questionKeywords.has(keyword)).length;
    if (score > bestScore) {
      bestScore = score;
      bestTopic = topic;
    }
  }

  if (bestScore >= MIN_MATCH_SCORE) {
    return { topic: bestTopic, suggestedTopics: [] };
  }
  return { topic: null, suggestedTopics: FIRST_DATE_ADVICE_TOPICS };
}
