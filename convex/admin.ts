import { internalMutation, mutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { hashPassword } from "./passwords";
import { ensureCard, hasBingo } from "./cards";

const requireAdmin = async (ctx: MutationCtx, token: string) => {
  const user = await ctx.db.query("users").withIndex("by_token", q => q.eq("sessionToken", token)).unique();
  if (!user) throw new Error("Not signed in");
  if (user.isAdmin !== true) throw new Error("Only the game admin can do that");
  return user;
};

const recalculateShortlist = async (ctx: MutationCtx) => {
  const ballots = await ctx.db.query("ballots").take(250);
  const scores = new Map<string, number>();
  ballots.forEach(ballot => ballot.rankedIdeaIds.forEach((id, rank) => scores.set(id, (scores.get(id) ?? 0) + Math.max(1, 250 - rank))));
  const ideas = await ctx.db.query("ideas").take(250);
  const topIds = new Set(ideas
    .sort((a, b) => (scores.get(b._id) ?? 0) - (scores.get(a._id) ?? 0) || a.createdAt - b.createdAt)
    .slice(0, 50)
    .map(idea => idea._id));
  await Promise.all(ideas.map(idea => ctx.db.patch(idea._id, { shortlisted: topIds.has(idea._id) })));
};

const applyPhase = async (ctx: MutationCtx, phase: "ideas" | "voting" | "shortlist" | "playing") => {
  const settings = await ctx.db.query("settings").withIndex("by_key", q => q.eq("key", "main")).unique();
  if (!settings) throw new Error("Game settings are missing");
  await ctx.db.patch(settings._id, { phase });
  if (phase === "shortlist") {
    await recalculateShortlist(ctx);
  }
  if (phase === "playing") {
    const users = await ctx.db.query("users").take(100);
    for (const user of users) {
      await ensureCard(ctx, user);
    }
  }
};

export const refreshShortlist = internalMutation({
  args: {},
  handler: recalculateShortlist,
});

export const repairProductionCardsAndWins = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").take(100);
    let cardsCreatedOrFilled = 0;
    let winsAdded = 0;
    for (const user of users) {
      const before = await ctx.db.query("cards").withIndex("by_user", q => q.eq("userId", user._id)).unique();
      const checks = await ctx.db.query("checks").withIndex("by_user", q => q.eq("userId", user._id)).take(100);
      const card = await ensureCard(ctx, user, checks.map(check => check.ideaId));
      if (card?.ideaIds.length && (!before || before.ideaIds.length < card.ideaIds.length)) cardsCreatedOrFilled += 1;
      const win = await ctx.db.query("wins").withIndex("by_user", q => q.eq("userId", user._id)).unique();
      if (!win && card?.ideaIds.length) {
        const completed = new Set(checks.map(check => check.ideaId));
        if (hasBingo(card.ideaIds, completed)) {
          await ctx.db.insert("wins", { userId: user._id, wonAt: Date.now() });
          winsAdded += 1;
        }
      }
    }
    return { cardsCreatedOrFilled, winsAdded };
  },
});

export const setPhase = mutation({
  args: {
    token: v.string(),
    phase: v.union(v.literal("ideas"), v.literal("voting"), v.literal("shortlist"), v.literal("playing")),
  },
  handler: async (ctx, { token, phase }) => {
    await requireAdmin(ctx, token);
    await applyPhase(ctx, phase);
    return null;
  },
});

export const applyScheduledPhase = internalMutation({
  args: {
    phase: v.union(v.literal("voting"), v.literal("shortlist"), v.literal("playing")),
    scheduledAt: v.number(),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db.query("settings").withIndex("by_key", q => q.eq("key", "main")).unique();
    const matchingTime = args.phase === "voting" ? settings?.votingStartsAt : args.phase === "shortlist" ? settings?.shortlistStartsAt : settings?.playingStartsAt;
    if (matchingTime !== args.scheduledAt) return null;
    await applyPhase(ctx, args.phase);
    return null;
  },
});

export const saveSchedule = mutation({
  args: { token: v.string(), timezone: v.string(), eventStartsAt: v.number(), votingStartsAt: v.number(), shortlistStartsAt: v.number(), playingStartsAt: v.number(), endsAt: v.number() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    if (!(args.eventStartsAt <= args.votingStartsAt && args.votingStartsAt < args.shortlistStartsAt && args.shortlistStartsAt < args.playingStartsAt && args.playingStartsAt < args.endsAt)) throw new Error("Stage dates must be in chronological order");
    const settings = await ctx.db.query("settings").withIndex("by_key", q => q.eq("key", "main")).unique();
    if (!settings) throw new Error("Game settings are missing");
    await ctx.db.patch(settings._id, { timezone: args.timezone, eventStartsAt: args.eventStartsAt, votingStartsAt: args.votingStartsAt, shortlistStartsAt: args.shortlistStartsAt, playingStartsAt: args.playingStartsAt, endsAt: args.endsAt });
    await ctx.scheduler.runAt(args.votingStartsAt, internal.admin.applyScheduledPhase, { phase: "voting", scheduledAt: args.votingStartsAt });
    await ctx.scheduler.runAt(args.shortlistStartsAt, internal.admin.applyScheduledPhase, { phase: "shortlist", scheduledAt: args.shortlistStartsAt });
    await ctx.scheduler.runAt(args.playingStartsAt, internal.admin.applyScheduledPhase, { phase: "playing", scheduledAt: args.playingStartsAt });
    return null;
  },
});

export const resetGame = mutation({
  args: {
    token: v.string(),
    resetIdeas: v.boolean(),
    resetVotes: v.boolean(),
    resetCards: v.boolean(),
    resetProgress: v.boolean(),
    resetSchedule: v.boolean(),
    removeUsers: v.boolean(),
    removeNonUserPeople: v.boolean(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, args.token);
    const tables: Array<"ideas" | "ballots" | "cards" | "checks" | "wins"> = [];
    if (args.resetIdeas) tables.push("ideas");
    if (args.resetVotes) tables.push("ballots");
    if (args.resetCards) tables.push("cards");
    if (args.resetProgress) tables.push("checks", "wins");
    for (const table of tables) {
      const rows = await ctx.db.query(table).take(500);
      await Promise.all(rows.map(row => ctx.db.delete(row._id)));
    }
    if (args.removeUsers) {
      const users = await ctx.db.query("users").take(100);
      await Promise.all(users.filter(user => user._id !== admin._id).map(user => ctx.db.delete(user._id)));
    }
    if (args.removeNonUserPeople || args.removeUsers) {
      const remainingUsers = await ctx.db.query("users").take(100);
      const userPersonIds = new Set(remainingUsers.map(user => user.personId));
      const people = await ctx.db.query("people").take(100);
      await Promise.all(people.filter(person => person.key !== "everyone" && !userPersonIds.has(person.key)).map(person => ctx.db.delete(person._id)));
    }
    const settings = await ctx.db.query("settings").withIndex("by_key", q => q.eq("key", "main")).unique();
    if (settings) await ctx.db.patch(settings._id, { phase: "ideas", ...(args.resetSchedule ? { votingStartsAt: undefined, shortlistStartsAt: undefined, playingStartsAt: undefined, eventStartsAt: undefined } : {}) });
    return null;
  },
});

export const addPerson = mutation({
  args: { token: v.string(), name: v.string(), color: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const key = args.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!key || !args.name.trim()) throw new Error("Enter a name");
    if (await ctx.db.query("people").withIndex("by_key", q => q.eq("key", key)).unique()) throw new Error("That person already exists");
    await ctx.db.insert("people", { key, name: args.name.trim(), color: args.color });
    return null;
  },
});

export const addUser = mutation({
  args: { token: v.string(), username: v.string(), password: v.string(), displayName: v.string(), color: v.string(), isAdmin: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    const username = args.username.trim().toLowerCase();
    const personId = username.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!username || !args.password || !args.displayName.trim()) throw new Error("Complete every user field");
    if (await ctx.db.query("users").withIndex("by_username", q => q.eq("username", username)).unique()) throw new Error("That username already exists");
    if (!(await ctx.db.query("people").withIndex("by_key", q => q.eq("key", personId)).unique())) {
      await ctx.db.insert("people", { key: personId, name: args.displayName.trim(), color: args.color });
    }
    await ctx.db.insert("users", { username, passwordHash: await hashPassword(args.password), displayName: args.displayName.trim(), personId, isAdmin: args.isAdmin, mustChangePassword: true });
    return null;
  },
});
