import { randomUUID } from "crypto";

export const ARTICLE_CATEGORIES = [
  "communication",
  "attachment-styles",
  "conflict-resolution",
  "dating-tips",
  "red-flags",
  "long-term-commitment",
] as const;
export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number];

export interface BlogArticle {
  id: string;
  title: string;
  category: ArticleCategory;
  summary: string;
  body: string;
  author: string;
  publishedAt: string;
  readCount: number;
}

export type PublishArticleResult = { success: true; article: BlogArticle } | { success: false; error: string };

function isArticleCategory(value: unknown): value is ArticleCategory {
  return typeof value === "string" && (ARTICLE_CATEGORIES as readonly string[]).includes(value);
}

const SEED_ARTICLES: Omit<BlogArticle, "id" | "readCount">[] = [
  {
    title: "The Four Attachment Styles, and Why Yours Shapes Every Relationship",
    category: "attachment-styles",
    summary: "Secure, anxious, avoidant, and disorganized attachment aren't labels — they're patterns you can learn to recognize and work with.",
    body: "Attachment theory, first developed to describe the bond between infants and caregivers, turns out to explain a huge amount of adult romantic behavior. If you notice yourself needing frequent reassurance, pulling away when things get close, or swinging between both, that's not a character flaw — it's a strategy your nervous system learned early on. The good news: attachment style is a pattern, not a life sentence. Naming it is the first step toward choosing a different response the next time your partner is five minutes late replying to a text.",
    author: "eHarmony Editorial Team",
    publishedAt: "2026-01-12T09:00:00.000Z",
  },
  {
    title: "Why 'I Statements' Actually Work (and How to Use Them Without Sounding Scripted)",
    category: "communication",
    summary: "The difference between 'you always ignore me' and 'I feel unheard' is bigger than it sounds — here's the psychology behind it.",
    body: "\"You\" statements put your partner on the defensive before they've even heard the point. \"I\" statements — I feel X when Y happens, because Z — keep the conversation about your experience instead of their character, which is exactly what keeps a partner's nervous system out of fight-or-flight long enough to actually listen. It takes practice to stop it feeling stilted; start by just noticing when you're about to say \"you never\" or \"you always,\" and pause.",
    author: "eHarmony Editorial Team",
    publishedAt: "2026-01-19T09:00:00.000Z",
  },
  {
    title: "The Difference Between a Disagreement and a Fight",
    category: "conflict-resolution",
    summary: "Every long-term couple disagrees. The ones who stay together learn to disagree without it becoming a fight.",
    body: "Conflict researchers have found that the content of a disagreement matters far less than how it's handled. Couples who repair quickly — a well-timed joke, an apology, physically softening — recover fast regardless of the topic. Couples who let contempt, criticism, defensiveness, or stonewalling take over turn small disagreements into fights that leave lasting damage. If you notice yourself rolling your eyes or going silent mid-conversation, that's usually the moment to call a short break, not push through.",
    author: "eHarmony Editorial Team",
    publishedAt: "2026-01-26T09:00:00.000Z",
  },
  {
    title: "Five Red Flags That Are Easy to Rationalize Early On",
    category: "red-flags",
    summary: "Love bombing, inconsistency, and boundary-testing rarely look dramatic in the moment — that's exactly why they're easy to miss.",
    body: "Early red flags are subtle by design: overwhelming affection in week one, a pattern of \"jokes\" that sting, a habit of showing up late without much apology, boundaries treated as opening offers to negotiate rather than limits to respect. None of these prove someone is a bad match on their own — but a pattern of them, especially if raising a concern gets met with defensiveness instead of curiosity, is worth taking seriously rather than explaining away.",
    author: "eHarmony Editorial Team",
    publishedAt: "2026-02-02T09:00:00.000Z",
  },
  {
    title: "What Actually Predicts a Relationship Lasting, According to Research",
    category: "long-term-commitment",
    summary: "It's not shared hobbies or a lack of arguments — long-term research points to something much more specific.",
    body: "Decades of longitudinal research on couples points less to compatibility of interests and more to something researchers call \"turning toward\" — the small, everyday moments where one partner reaches for connection (a comment, a sigh, a question) and the other responds with attention instead of dismissal. Couples who turn toward each other's small bids for connection, even mundane ones, build a reserve of goodwill that carries them through the inevitable harder conversations.",
    author: "eHarmony Editorial Team",
    publishedAt: "2026-02-09T09:00:00.000Z",
  },
  {
    title: "How to Tell If You're Ready to Date Again",
    category: "dating-tips",
    summary: "Readiness isn't a feeling that arrives on schedule — it's a handful of concrete signs you can actually check for.",
    body: "\"I'll know when I'm ready\" is common advice and not very useful advice. More concrete signs: you can describe your last relationship without it turning into a monologue about your ex, you're not hoping a new person will fix a feeling an old relationship left behind, and you're curious about someone new as themselves rather than as a comparison point. None of these need to be perfect before you start dating again — but if none of them are true yet, it might be worth giving it a bit more time.",
    author: "eHarmony Editorial Team",
    publishedAt: "2026-02-16T09:00:00.000Z",
  },
];

/**
 * eHarmony's real "Educational blog section with relationship psychology
 * articles" (#226): a seeded catalog of real, substantive psychology
 * articles (not placeholder lorem ipsum) that any user can browse and
 * read, plus a real admin-gated `publish()` so the catalog is an actual
 * CMS rather than a fixed, never-growing list — the same "seed catalog +
 * admin can extend it" shape #163's PricingPlanStore and #178's
 * BroadcastStore already use for admin-managed content.
 */
export class RelationshipBlogStore {
  private articlesById = new Map<string, BlogArticle>();

  constructor() {
    for (const seed of SEED_ARTICLES) {
      const article: BlogArticle = { ...seed, id: randomUUID(), readCount: 0 };
      this.articlesById.set(article.id, article);
    }
  }

  publish(
    author: unknown,
    payload: { title?: unknown; category?: unknown; summary?: unknown; body?: unknown } | undefined
  ): PublishArticleResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) return { success: false, error: "author is required" };

    const title = typeof payload?.title === "string" ? payload.title.trim() : "";
    if (!title) return { success: false, error: "title is required" };

    if (!isArticleCategory(payload?.category)) return { success: false, error: `category must be one of: ${ARTICLE_CATEGORIES.join(", ")}` };
    const category = payload!.category as ArticleCategory;

    const summary = typeof payload?.summary === "string" ? payload.summary.trim() : "";
    if (!summary) return { success: false, error: "summary is required" };

    const body = typeof payload?.body === "string" ? payload.body.trim() : "";
    if (!body) return { success: false, error: "body is required" };

    const article: BlogArticle = {
      id: randomUUID(),
      title,
      category,
      summary,
      body,
      author: authorName,
      publishedAt: new Date().toISOString(),
      readCount: 0,
    };
    this.articlesById.set(article.id, article);
    return { success: true, article };
  }

  /** Newest first, optionally narrowed to one category. */
  listArticles(category?: string): Omit<BlogArticle, "body">[] {
    return [...this.articlesById.values()]
      .filter((article) => !category || article.category === category)
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .map(({ body: _body, ...summary }) => summary);
  }

  /** Fetching the full article counts as a read. */
  getArticle(articleId: string): BlogArticle | undefined {
    const article = this.articlesById.get(articleId);
    if (!article) return undefined;
    article.readCount += 1;
    return article;
  }
}
