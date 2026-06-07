import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { hashPassword, verifyPassword } from "./passwords";

const requireUser = async (ctx: QueryCtx | MutationCtx, token: string) => {
  const user = await ctx.db.query("users").withIndex("by_token", q => q.eq("sessionToken", token)).unique();
  if (!user) throw new Error("Not signed in");
  return user;
};

const visibleTo = (idea: Doc<"ideas">, user: Doc<"users">) =>
  idea.personKeys.includes("everyone") || !idea.personKeys.includes(user.personId);

const presentIdea = async (ctx: QueryCtx, idea: Doc<"ideas">, shortlistRank?: number) => {
  const author = await ctx.db.get("users", idea.authorId);
  return {
    id: idea._id,
    text: idea.text,
    people: idea.personKeys,
    author: author?.displayName ?? "Unknown",
    shortlisted: idea.shortlisted,
    shortlistRank,
  };
};

const scheduledPhase = (settings: Doc<"settings"> | null) => {
  if (!settings) return "ideas" as const;
  const now = Date.now();
  if (settings.playingStartsAt && now >= settings.playingStartsAt) return "playing" as const;
  if (settings.shortlistStartsAt && now >= settings.shortlistStartsAt) return "shortlist" as const;
  if (settings.votingStartsAt && now >= settings.votingStartsAt) return "voting" as const;
  return settings.phase;
};

const hasBingo = (ideaIds: Id<"ideas">[], completed: Set<Id<"ideas">>) => {
  const marked = Array.from({ length: 25 }, (_, index) => index === 12 || completed.has(ideaIds[index > 12 ? index - 1 : index]));
  const lines = [
    ...Array.from({ length: 5 }, (_, row) => Array.from({ length: 5 }, (_, col) => row * 5 + col)),
    ...Array.from({ length: 5 }, (_, col) => Array.from({ length: 5 }, (_, row) => row * 5 + col)),
    [0, 6, 12, 18, 24], [4, 8, 12, 16, 20],
  ];
  return lines.some(line => line.every(index => marked[index]));
};

export const login = mutation({
  args: { username: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db.query("users").withIndex("by_username", q => q.eq("username", args.username.toLowerCase())).unique();
    if (!user) throw new Error("Incorrect username or password");
    const verification = await verifyPassword(args.password, user.passwordHash);
    if (!verification.matches) throw new Error("Incorrect username or password");
    const token = crypto.randomUUID();
    await ctx.db.patch(user._id, { sessionToken: token, ...(verification.needsUpgrade ? { passwordHash: await hashPassword(args.password) } : {}) });
    return { token, displayName: user.displayName, personId: user.personId, mustChangePassword: user.mustChangePassword === true };
  },
});

export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await requireUser(ctx, token);
    await ctx.db.patch(user._id, { sessionToken: undefined });
    return null;
  },
});

export const state = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await ctx.db.query("users").withIndex("by_token", q => q.eq("sessionToken", token)).unique();
    if (!user) return null;
    const settings = await ctx.db.query("settings").withIndex("by_key", q => q.eq("key", "main")).unique();
    const people = await ctx.db.query("people").take(100);
    const allIdeas = await ctx.db.query("ideas").order("desc").take(250);
    const ballots = await ctx.db.query("ballots").take(250);
    const scores = new Map<string, number>();
    ballots.forEach(candidate => candidate.rankedIdeaIds.forEach((id, rank) => scores.set(id, (scores.get(id) ?? 0) + Math.max(1, 250 - rank))));
    const shortlistRanks = new Map(allIdeas
      .filter(idea => idea.shortlisted)
      .sort((a, b) => (scores.get(b._id) ?? 0) - (scores.get(a._id) ?? 0) || a.createdAt - b.createdAt)
      .map((idea, rank) => [idea._id, rank + 1]));
    const ideas = await Promise.all(allIdeas.filter(idea => visibleTo(idea, user)).map(idea => presentIdea(ctx, idea, shortlistRanks.get(idea._id))));
    const ballot = await ctx.db.query("ballots").withIndex("by_user", q => q.eq("userId", user._id)).unique();
    const card = await ctx.db.query("cards").withIndex("by_user", q => q.eq("userId", user._id)).unique();
    const allChecks = await ctx.db.query("checks").withIndex("by_user", q => q.eq("userId", user._id)).take(100);
    const checks = allChecks.map(check => ({ ideaId: check.ideaId, comment: check.comment }));
    const users = await ctx.db.query("users").take(100);
    const cards = await ctx.db.query("cards").take(100);
    const sharedChecks = await ctx.db.query("checks").take(500);
    const otherCards = users.flatMap(owner => {
      if (owner._id === user._id) return [];
      const otherCard = cards.find(candidate => candidate.userId === owner._id);
      const person = people.find(candidate => candidate.key === owner?.personId);
      const completed = new Set(sharedChecks.filter(check => check.userId === owner._id).map(check => check.ideaId));
      return [{
        userId: owner._id,
        name: owner.displayName,
        color: person?.color ?? "#777777",
        icon: owner.icon ?? owner.displayName.slice(0, 1),
        completed: otherCard?.ideaIds.map(ideaId => completed.has(ideaId)) ?? Array.from({ length: 24 }, () => false),
      }];
    });
    const overlaps = card ? card.ideaIds.map(ideaId => ({
      ideaId,
      users: cards.flatMap(otherCard => {
        if (otherCard.userId === user._id || !otherCard.ideaIds.includes(ideaId)) return [];
        if (!sharedChecks.some(check => check.userId === otherCard.userId && check.ideaId === ideaId)) return [];
        const owner = users.find(candidate => candidate._id === otherCard.userId);
        const person = people.find(candidate => candidate.key === owner?.personId);
        return owner ? [{ name: owner.displayName, color: person?.color ?? "#777777", icon: owner.icon ?? owner.displayName.slice(0, 1) }] : [];
      }),
    })) : [];
    const wins = await ctx.db.query("wins").withIndex("by_wonAt").take(100);
    const leaderboard = wins.flatMap((win, index) => {
      const winner = users.find(candidate => candidate._id === win.userId);
      const person = people.find(candidate => candidate.key === winner?.personId);
      return winner ? [{ place: index + 1, userId: winner._id, name: winner.displayName, color: person?.color ?? "#777777", icon: winner.icon ?? winner.displayName.slice(0, 1), wonAt: win.wonAt }] : [];
    });
    return {
      user: { displayName: user.displayName, personId: user.personId, isAdmin: user.isAdmin === true, color: people.find(person => person.key === user.personId)?.color ?? "#777777", icon: user.icon ?? user.displayName.slice(0, 1), mustChangePassword: user.mustChangePassword === true },
      settings: settings ? { ...settings, gameName: "Family Bingo", phase: scheduledPhase(settings) } : settings,
      people: people.map(person => ({ id: person.key, name: person.name, color: person.color })),
      playerCount: users.length,
      users: user.isAdmin ? users.map(account => ({ id: account._id, username: account.username, name: account.displayName, personId: account.personId, isAdmin: account.isAdmin === true })) : [],
      ideas,
      ballot: ballot?.rankedIdeaIds ?? [],
      card: card?.ideaIds ?? [],
      checks,
      otherCards,
      overlaps,
      leaderboard,
      hasWon: leaderboard.some(entry => entry.userId === user._id),
    };
  },
});

export const updateProfile = mutation({
  args: { token: v.string(), color: v.string(), icon: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    const person = await ctx.db.query("people").withIndex("by_key", q => q.eq("key", user.personId)).unique();
    if (person) await ctx.db.patch(person._id, { color: args.color });
    await ctx.db.patch(user._id, { icon: args.icon.trim().slice(0, 2) || user.displayName.slice(0, 1) });
    return null;
  },
});

export const changePassword = mutation({
  args: { token: v.string(), currentPassword: v.string(), newPassword: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    if (!(await verifyPassword(args.currentPassword, user.passwordHash)).matches) throw new Error("Current password is incorrect");
    if (args.newPassword.length < 8) throw new Error("New password must be at least 8 characters");
    if (args.newPassword === args.currentPassword) throw new Error("Choose a different password");
    await ctx.db.patch(user._id, { passwordHash: await hashPassword(args.newPassword), mustChangePassword: false });
    return null;
  },
});

export const addIdea = mutation({
  args: { token: v.string(), text: v.string(), personKeys: v.array(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    if (!args.text.trim()) throw new Error("Idea cannot be empty");
    if (args.text.trim().length > 180) throw new Error("Idea is too long");
    return ctx.db.insert("ideas", { text: args.text.trim(), personKeys: args.personKeys, authorId: user._id, createdAt: Date.now(), shortlisted: false });
  },
});

export const removeIdea = mutation({
  args: { token: v.string(), ideaId: v.id("ideas") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    if (user.isAdmin !== true) throw new Error("Only the admin can remove ideas");
    const settings = await ctx.db.query("settings").withIndex("by_key", q => q.eq("key", "main")).unique();
    if (scheduledPhase(settings) !== "ideas") throw new Error("Ideas can only be removed in the first stage");
    await ctx.db.delete(args.ideaId);
    return null;
  },
});

export const submitBallot = mutation({
  args: { token: v.string(), rankedIdeaIds: v.array(v.id("ideas")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    const existing = await ctx.db.query("ballots").withIndex("by_user", q => q.eq("userId", user._id)).unique();
    if (existing) await ctx.db.patch(existing._id, { rankedIdeaIds: args.rankedIdeaIds, submittedAt: Date.now() });
    else await ctx.db.insert("ballots", { userId: user._id, rankedIdeaIds: args.rankedIdeaIds, submittedAt: Date.now() });
    return null;
  },
});

export const saveCard = mutation({
  args: { token: v.string(), ideaIds: v.array(v.id("ideas")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    if (args.ideaIds.length > 24) throw new Error("Choose no more than 24 items");
    const shortlist = await ctx.db.query("ideas").take(250);
    const available = shortlist.filter(idea => idea.shortlisted && visibleTo(idea, user) && !args.ideaIds.includes(idea._id));
    const fill = available
      .map(idea => ({ ideaId: idea._id, order: crypto.randomUUID() }))
      .sort((a, b) => a.order.localeCompare(b.order))
      .slice(0, 24 - args.ideaIds.length)
      .map(item => item.ideaId);
    const completed = [...new Set([...args.ideaIds, ...fill])];
    if (completed.length < 24) throw new Error("There are not enough visible shortlisted ideas to build a card");
    const shuffled = completed
      .map(ideaId => ({ ideaId, order: crypto.randomUUID() }))
      .sort((a, b) => a.order.localeCompare(b.order))
      .map(item => item.ideaId);
    const existing = await ctx.db.query("cards").withIndex("by_user", q => q.eq("userId", user._id)).unique();
    if (existing) await ctx.db.patch(existing._id, { ideaIds: shuffled });
    else await ctx.db.insert("cards", { userId: user._id, ideaIds: shuffled, createdAt: Date.now() });
    return null;
  },
});

export const toggleCheck = mutation({
  args: { token: v.string(), ideaId: v.id("ideas"), checked: v.boolean(), comment: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    const existing = await ctx.db.query("checks").withIndex("by_user_idea", q => q.eq("userId", user._id).eq("ideaId", args.ideaId)).unique();
    if (!args.checked && existing) await ctx.db.delete(existing._id);
    else if (existing) await ctx.db.patch(existing._id, { comment: args.comment, checkedAt: Date.now() });
    else if (args.checked) await ctx.db.insert("checks", { userId: user._id, ideaId: args.ideaId, comment: args.comment, checkedAt: Date.now() });
    if (args.checked) {
      const card = await ctx.db.query("cards").withIndex("by_user", q => q.eq("userId", user._id)).unique();
      const win = await ctx.db.query("wins").withIndex("by_user", q => q.eq("userId", user._id)).unique();
      if (card && !win) {
        const checks = await ctx.db.query("checks").withIndex("by_user", q => q.eq("userId", user._id)).take(100);
        const completed = new Set(checks.map(check => check.ideaId));
        completed.add(args.ideaId);
        if (hasBingo(card.ideaIds, completed)) await ctx.db.insert("wins", { userId: user._id, wonAt: Date.now() });
      }
    }
    return null;
  },
});
