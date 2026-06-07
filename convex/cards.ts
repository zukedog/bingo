import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

const canSeeIdea = (idea: Doc<"ideas">, user: Doc<"users">) =>
  idea.personKeys.includes("everyone") || !idea.personKeys.includes(user.personId);

export const shuffled = <T>(items: T[]) =>
  items
    .map(item => ({ item, order: crypto.randomUUID() }))
    .sort((a, b) => a.order.localeCompare(b.order))
    .map(({ item }) => item);

export const buildCardIdeaIds = async (ctx: MutationCtx, user: Doc<"users">, preferredIds: Id<"ideas">[] = []) => {
  const ideas = await ctx.db.query("ideas").take(250);
  const available = ideas.filter(idea => idea.shortlisted && canSeeIdea(idea, user));
  const preferred = [...new Set(preferredIds)].filter(id => available.some(idea => idea._id === id)).slice(0, 24);
  const fill = shuffled(available.filter(idea => !preferred.includes(idea._id)).map(idea => idea._id)).slice(0, 24 - preferred.length);
  const completed = [...preferred, ...fill];
  return completed.length ? shuffled(completed) : null;
};

export const ensureCard = async (ctx: MutationCtx, user: Doc<"users">, preferredIds: Id<"ideas">[] = []) => {
  const existing = await ctx.db.query("cards").withIndex("by_user", q => q.eq("userId", user._id)).unique();
  if (existing?.ideaIds.length === 24) return existing;
  const ideaIds = await buildCardIdeaIds(ctx, user, [...(existing?.ideaIds ?? []), ...preferredIds]);
  if (!ideaIds) return existing ?? null;
  if (existing && ideaIds.length <= existing.ideaIds.length) return existing;
  if (existing) {
    await ctx.db.patch(existing._id, { ideaIds });
    return { ...existing, ideaIds };
  }
  const cardId = await ctx.db.insert("cards", { userId: user._id, ideaIds, createdAt: Date.now() });
  return { _id: cardId, _creationTime: Date.now(), userId: user._id, ideaIds, createdAt: Date.now() };
};

export const hasBingo = (ideaIds: Id<"ideas">[], completed: Set<Id<"ideas">>) => {
  const marked = Array.from({ length: 25 }, (_, index) => index === 12 || completed.has(ideaIds[index > 12 ? index - 1 : index]));
  const lines = [
    ...Array.from({ length: 5 }, (_, row) => Array.from({ length: 5 }, (_, col) => row * 5 + col)),
    ...Array.from({ length: 5 }, (_, col) => Array.from({ length: 5 }, (_, row) => row * 5 + col)),
    [0, 6, 12, 18, 24], [4, 8, 12, 16, 20],
  ];
  return lines.some(line => line.every(index => marked[index]));
};
