import { randomBytes } from "crypto";

export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: QuizOption[];
}

/**
 * Hinge's real "Two-person quiz to compare views before chatting"
 * (#215) — distinct from #214's DailyPollStore (a public, everyone-vs-
 * everyone poll with an aggregate breakdown): this is a private session
 * between exactly two named authors, each answering the same fixed set
 * of relationship-views questions independently, with both sides' actual
 * answers and a real per-pair agreement percentage revealed only once
 * *both* have submitted — so neither side can anchor their answers on
 * the other's.
 */
export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "kids",
    question: "Do you want kids?",
    options: [
      { id: "yes", text: "Yes" },
      { id: "no", text: "No" },
      { id: "unsure", text: "Not sure yet" },
    ],
  },
  {
    id: "living-together",
    question: "How soon would you want to move in together?",
    options: [
      { id: "asap", text: "As soon as it feels right" },
      { id: "year-plus", text: "After a year or more" },
      { id: "married-first", text: "Only after marriage" },
    ],
  },
  {
    id: "money",
    question: "How do you feel about splitting finances?",
    options: [
      { id: "combine", text: "Fully combine everything" },
      { id: "split-shared", text: "Split shared costs, keep the rest separate" },
      { id: "keep-separate", text: "Keep finances entirely separate" },
    ],
  },
  {
    id: "conflict",
    question: "When we disagree, I'd want to:",
    options: [
      { id: "talk-now", text: "Talk it through right away" },
      { id: "cool-off", text: "Take space, then talk" },
    ],
  },
  {
    id: "priority",
    question: "What matters most in a partner?",
    options: [
      { id: "ambition", text: "Ambition and drive" },
      { id: "kindness", text: "Kindness and empathy" },
      { id: "humor", text: "Humor and playfulness" },
      { id: "stability", text: "Stability and reliability" },
    ],
  },
];

const QUESTION_IDS = new Set(QUIZ_QUESTIONS.map((q) => q.id));

function generateQuizId(): string {
  return randomBytes(8).toString("hex");
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

export type AnswerMap = Record<string, string>;

interface QuizSession {
  id: string;
  participants: [string, string];
  answersByAuthor: Map<string, AnswerMap>;
}

export type StartQuizResult = { success: true; quizId: string } | { success: false; error: string };
export type SubmitAnswersResult = { success: true } | { success: false; error: string };

export interface QuizResultView {
  questions: QuizQuestion[];
  participants: [string, string];
  myAnswers: AnswerMap | null;
  bothSubmitted: boolean;
  theirAnswers: AnswerMap | null;
  matchPercentage: number | null;
}

export type GetResultResult = { success: true; result: QuizResultView } | { success: false; error: string };

/**
 * One quiz session per unordered pair — starting again with the same two
 * authors returns the existing session rather than resetting answers, so
 * a page refresh or a second invite never wipes progress already made.
 */
export class CoupleQuizStore {
  private sessions = new Map<string, QuizSession>();
  private sessionIdByPair = new Map<string, string>();

  start(initiator: unknown, invitee: unknown): StartQuizResult {
    const initiatorText = typeof initiator === "string" ? initiator.trim() : "";
    const inviteeText = typeof invitee === "string" ? invitee.trim() : "";
    if (!initiatorText || !inviteeText) return { success: false, error: "initiator and invitee are required" };
    if (initiatorText === inviteeText) return { success: false, error: "You can't quiz yourself" };

    const key = pairKey(initiatorText, inviteeText);
    const existingId = this.sessionIdByPair.get(key);
    if (existingId) return { success: true, quizId: existingId };

    const quizId = generateQuizId();
    this.sessions.set(quizId, { id: quizId, participants: [initiatorText, inviteeText], answersByAuthor: new Map() });
    this.sessionIdByPair.set(key, quizId);
    return { success: true, quizId };
  }

  submitAnswers(quizId: unknown, author: unknown, answers: unknown): SubmitAnswersResult {
    const quizIdText = typeof quizId === "string" ? quizId : "";
    const session = this.sessions.get(quizIdText);
    if (!session) return { success: false, error: "Quiz not found" };

    const authorText = typeof author === "string" ? author.trim() : "";
    if (!session.participants.includes(authorText)) return { success: false, error: "You're not a participant in this quiz" };
    if (session.answersByAuthor.has(authorText)) return { success: false, error: "You've already submitted your answers" };

    if (typeof answers !== "object" || answers === null || Array.isArray(answers)) {
      return { success: false, error: "answers must be an object mapping question id to option id" };
    }
    const validated: AnswerMap = {};
    for (const question of QUIZ_QUESTIONS) {
      const optionId = (answers as Record<string, unknown>)[question.id];
      const option = question.options.find((o) => o.id === optionId);
      if (!option) return { success: false, error: `Missing or invalid answer for question "${question.id}"` };
      validated[question.id] = option.id;
    }
    for (const key of Object.keys(answers as Record<string, unknown>)) {
      if (!QUESTION_IDS.has(key)) return { success: false, error: `Unknown question id "${key}"` };
    }

    session.answersByAuthor.set(authorText, validated);
    return { success: true };
  }

  getResult(quizId: unknown, author: unknown): GetResultResult {
    const quizIdText = typeof quizId === "string" ? quizId : "";
    const session = this.sessions.get(quizIdText);
    if (!session) return { success: false, error: "Quiz not found" };

    const authorText = typeof author === "string" ? author.trim() : "";
    if (!session.participants.includes(authorText)) return { success: false, error: "You're not a participant in this quiz" };

    const other = session.participants.find((p) => p !== authorText)!;
    const myAnswers = session.answersByAuthor.get(authorText) ?? null;
    const otherAnswers = session.answersByAuthor.get(other) ?? null;
    const bothSubmitted = myAnswers !== null && otherAnswers !== null;

    let matchPercentage: number | null = null;
    if (bothSubmitted) {
      const agreeing = QUIZ_QUESTIONS.filter((q) => myAnswers![q.id] === otherAnswers![q.id]).length;
      matchPercentage = Math.round((agreeing / QUIZ_QUESTIONS.length) * 100);
    }

    return {
      success: true,
      result: {
        questions: QUIZ_QUESTIONS,
        participants: session.participants,
        myAnswers,
        bothSubmitted,
        theirAnswers: bothSubmitted ? otherAnswers : null,
        matchPercentage,
      },
    };
  }
}
