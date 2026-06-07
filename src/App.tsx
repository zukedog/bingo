import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { ArrowRight, Bell, CalendarClock, Check, Clock3, Eye, GripVertical, Lightbulb, LockKeyhole, LogOut, MessageSquare, Palette, Plus, RotateCcw, Settings, Sparkles, Trash2, Trophy, UserPlus, Users, Vote, X } from "lucide-react";

type Phase = "ideas" | "voting" | "shortlist" | "playing";
type Person = { id: string; name: string; color: string };
type Idea = { id: Id<"ideas">; text: string; people: string[]; author: string; shortlisted: boolean; shortlistRank?: number };
type LoginResult = { token: string; displayName: string; personId: string; mustChangePassword: boolean };
type SharedCard = { userId: Id<"users">; name: string; color: string; icon: string; completed: boolean[] };
type Overlap = { ideaId: Id<"ideas">; users: { name: string; color: string; icon: string }[] };

const fallbackPeople: Person[] = [
  { id: "everyone", name: "Everyone", color: "#242421" }, { id: "josh", name: "Josh", color: "#8f72c7" }, { id: "alex", name: "Alex", color: "#ff6b4a" },
  { id: "jamie", name: "Jamie", color: "#7d9e54" }, { id: "sam", name: "Sam", color: "#dfa52e" },
  { id: "taylor", name: "Taylor", color: "#7292cf" },
];

const phaseMeta: Record<Phase, { label: string; eyebrow: string; title: string; detail: string }> = {
  ideas: { label: "Ideas", eyebrow: "Phase one", title: "What might happen?", detail: "Add your predictions. Ideas about you stay hidden from you." },
  voting: { label: "Vote", eyebrow: "Phase two", title: "Rank the possibilities", detail: "Put your favourites in order. Your first pick gets the most weight." },
  shortlist: { label: "Pick 24", eyebrow: "Phase three", title: "Build your perfect card", detail: "Choose 24 from the group's top 50. The centre square is free." },
  playing: { label: "Play", eyebrow: "Game on", title: "Your bingo card", detail: "Tap a square when it happens and record the story." },
};

function Tag({ id, people }: { id: string; people: Person[] }) {
  const person = people.find(p => p.id === id) ?? fallbackPeople[0];
  return <span className="tag"><i style={{ background: person.color }} />{person.name}</span>;
}

function Login({ onLogin }: { onLogin: (result: LoginResult) => void }) {
  const login = useMutation(api.game.login);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError("");
    try { onLogin(await login({ username, password })); }
    catch { setError("That username or password doesn't look right."); }
    finally { setBusy(false); }
  };
  return <main className="login-shell">
    <section className="login-art">
      <div className="brand light"><span className="brand-mark"><i /><i /><i /><i /></span> Family Bingo</div>
      <div className="art-copy"><span className="kicker">A game for the optimistically specific</span><h1>Call it now.<br /><em>Celebrate it later.</em></h1><p>Dream up the year ahead with your favourite people, then watch it unfold one square at a time.</p></div>
      <div className="floating-card card-one">A spontaneous road trip happens <Sparkles size={18} /></div>
      <div className="floating-card card-two"><strong>BINGO!</strong><span>5 in a row</span></div>
      <div className="art-grid">{Array.from({ length: 25 }).map((_, i) => <i key={i} className={i === 12 ? "hot" : ""} />)}</div>
    </section>
    <section className="login-panel"><form onSubmit={submit} className="login-form">
      <div className="mobile-brand brand"><span className="brand-mark"><i /><i /><i /><i /></span> Family Bingo</div>
      <span className="kicker dark">Welcome back</span><h2>Let’s see what happens.</h2><p>Sign in to add ideas, cast your vote, and play your card.</p>
      <label>Username<input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" /></label>
      <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" /></label>
      {error && <div className="error">{error}</div>}
      <button className="primary" disabled={busy} type="submit">{busy ? "Signing in…" : <>Enter the game <ArrowRight size={18} /></>}</button>
      <small><LockKeyhole size={13} /> Private game · No sign-ups</small>
    </form></section>
  </main>;
}

function IdeaPhase({ ideas, people, onAdd, onRemove, me, isAdmin }: { ideas: Idea[]; people: Person[]; onAdd: (text: string, people: string[]) => Promise<void>; onRemove: (id: Id<"ideas">) => Promise<void>; me: string; isAdmin: boolean }) {
  const [text, setText] = useState(""); const [tags, setTags] = useState<string[]>(["everyone"]); const [busy, setBusy] = useState(false);
  const toggle = (id: string) => setTags(current => id === "everyone" ? ["everyone"] : [...current.filter(x => x !== "everyone" && x !== id), ...(current.includes(id) ? [] : [id])]);
  const submit = async (e: React.FormEvent) => { e.preventDefault(); if (!text.trim()) return; setBusy(true); await onAdd(text.trim(), tags.length ? tags : ["everyone"]); setText(""); setBusy(false); };
  return <div className="two-col"><form className="composer" onSubmit={submit}>
    <div className="icon-orb"><Lightbulb size={22} /></div><h3>Add a prediction</h3><p>Specific, surprising, and possible is the sweet spot.</p>
    <textarea placeholder="By the end of the year, someone will…" value={text} onChange={e => setText(e.target.value)} maxLength={180} />
    <div className="composer-foot"><span>{text.length}/180</span><button disabled={busy} className="primary small" type="submit"><Plus size={16} /> Add idea</button></div>
    <div className="tag-pick"><strong>Who is this about?</strong><small>They won't see ideas tagged specifically about them.</small><div>{people.map(person => <button type="button" onClick={() => toggle(person.id)} className={tags.includes(person.id) ? "selected" : ""} key={person.id}><i style={{ background: person.color }} />{person.name}<Check size={13} /></button>)}</div></div>
  </form><section className="idea-list"><div className="section-head"><div><span className="kicker dark">The idea pool</span><h3>{ideas.length} visible ideas</h3></div><span className="privacy-pill"><LockKeyhole size={13} /> Ideas about {me} are hidden</span></div>
    <div className="ideas">{ideas.map((idea, i) => <article className="idea" key={idea.id}><span className="idea-num">{String(i + 1).padStart(2, "0")}</span><div><h4>{idea.text}</h4><footer>{idea.people.map(id => <Tag id={id} people={people} key={id} />)}<span>by {idea.author}</span></footer></div>{isAdmin && <button className="idea-delete" title="Remove idea" onClick={() => onRemove(idea.id)}><Trash2 size={14} /></button>}</article>)}</div>
  </section></div>;
}

function VotingPhase({ ideas, people, initial, onSave }: { ideas: Idea[]; people: Person[]; initial: Id<"ideas">[]; onSave: (ids: Id<"ideas">[]) => Promise<void> }) {
  const [ranked, setRanked] = useState<Id<"ideas">[]>(initial); const [saved, setSaved] = useState(false);
  useEffect(() => setRanked(initial), [initial]);
  const move = (id: Id<"ideas">, dir: number) => setRanked(r => { const x = [...r], at = x.indexOf(id), to = Math.max(0, Math.min(x.length - 1, at + dir)); x.splice(at, 1); x.splice(to, 0, id); return x; });
  const save = async () => { await onSave(ranked); setSaved(true); setTimeout(() => setSaved(false), 1600); };
  return <div className="vote-layout"><section className="ballot panel"><div className="section-head"><div><span className="kicker dark">Your ballot</span><h3>Ranked choices</h3></div><strong>{ranked.length} picked</strong></div>
    <p className="hint"><GripVertical size={15} /> Use the arrows to arrange your strongest predictions first.</p>
    <div className="rank-list">{ranked.map((id, index) => { const idea = ideas.find(x => x.id === id); return idea && <article key={id}><b>{index + 1}</b><div><h4>{idea.text}</h4><Tag id={idea.people[0]} people={people} /></div><span><button onClick={() => move(id, -1)}>↑</button><button onClick={() => move(id, 1)}>↓</button><button onClick={() => setRanked(r => r.filter(x => x !== id))}><X size={14} /></button></span></article> })}</div>
    <button onClick={save} className="primary full">{saved ? <><Check size={17} /> Ballot saved</> : <>Save my ballot <Vote size={17} /></>}</button>
  </section><section className="available panel"><div className="section-head"><div><span className="kicker dark">Still in the running</span><h3>Available ideas</h3></div></div>
    <div className="available-list">{ideas.filter(x => !ranked.includes(x.id)).map(idea => <button key={idea.id} onClick={() => setRanked(r => [...r, idea.id])}><Plus size={16} /><span>{idea.text}<small>{idea.people.map(p => <Tag id={p} people={people} key={p} />)}</small></span></button>)}</div>
  </section></div>;
}

function ShortlistPhase({ ideas, people, initial, onDone }: { ideas: Idea[]; people: Person[]; initial: Id<"ideas">[]; onDone: (ids: Id<"ideas">[]) => Promise<void> }) {
  const [chosen, setChosen] = useState<Id<"ideas">[]>(initial); useEffect(() => setChosen(initial), [initial]);
  const toggle = (id: Id<"ideas">) => setChosen(c => c.includes(id) ? c.filter(x => x !== id) : c.length < 24 ? [...c, id] : c);
  return <section className="shortlist"><div className="selection-bar"><div><strong>{chosen.length}<span>/24</span></strong><p>{chosen.length === 24 ? "Your card is ready to go." : `${24 - chosen.length} spaces will be filled randomly.`}</p></div><div className="progress"><i style={{ width: `${chosen.length / 24 * 100}%` }} /></div><button className="primary small" onClick={() => onDone(chosen)}>Make my card <ArrowRight size={16} /></button></div>
    <div className="short-grid">{ideas.map((idea, i) => <button onClick={() => toggle(idea.id)} className={chosen.includes(idea.id) ? "chosen" : ""} key={idea.id}><span className="pick-check"><Check size={14} /></span><em>#{idea.shortlistRank ?? i + 1} pick</em><h4>{idea.text}</h4><Tag id={idea.people[0]} people={people} /></button>)}</div>
  </section>;
}

function SharedCards({ cards }: { cards: SharedCard[] }) {
  if (!cards.length) return null;
  return <section className="shared-section"><div className="section-head"><div><span className="kicker dark">The group</span><h3>Other players' progress</h3></div><span className="privacy-pill"><Eye size={13} /> Tile contents stay private</span></div>
    <div className="shared-cards">{cards.map(card => <article key={card.userId}><header><span style={{ background: card.color }}>{card.icon}</span><div><strong>{card.name}</strong><small>{card.completed.filter(Boolean).length} of 24 complete</small></div></header><div>{Array.from({ length: 25 }).map((_, index) => index === 12 ? <i className="shared-free" key={index} /> : <i className={card.completed[index > 12 ? index - 1 : index] ? "complete" : ""} key={index} />)}</div></article>)}</div>
  </section>;
}

function Leaderboard({ entries }: { entries: { place: number; userId: Id<"users">; name: string; color: string; icon: string; wonAt: number }[] }) {
  return <section className="leaderboard"><div className="section-head"><div><span className="kicker dark">Hall of fame</span><h3>Leaderboard</h3></div><Trophy size={20} /></div>{entries.length ? <div>{entries.map(entry => <article key={entry.userId}><b>{entry.place}</b><span style={{ background: entry.color }}>{entry.icon}</span><div><strong>{entry.name}</strong><small>Won {new Date(entry.wonAt).toLocaleString()}</small></div></article>)}</div> : <p>No winners yet. The field is wide open.</p>}</section>;
}

function PlayPhase({ ideas, cardIds, checks, overlaps, otherCards, leaderboard, hasWon, onToggle }: { ideas: Idea[]; cardIds: Id<"ideas">[]; checks: { ideaId: Id<"ideas">; comment: string }[]; overlaps: Overlap[]; otherCards: SharedCard[]; leaderboard: { place: number; userId: Id<"users">; name: string; color: string; icon: string; wonAt: number }[]; hasWon: boolean; onToggle: (id: Id<"ideas">, checked: boolean, comment: string) => Promise<void> }) {
  const card = cardIds.map(id => ideas.find(x => x.id === id)).filter((idea): idea is Idea => Boolean(idea));
  const checkMap = Object.fromEntries(checks.map(check => [check.ideaId, check.comment]));
  const [open, setOpen] = useState<Idea | null>(null); const [comment, setComment] = useState("");
  const done = (id: Id<"ideas">) => Object.prototype.hasOwnProperty.call(checkMap, id);
  const save = async () => { if (open) { await onToggle(open.id, true, comment); setOpen(null); } };
  const uncheck = async () => { if (open) { await onToggle(open.id, false, ""); setOpen(null); } };
  return <>{hasWon && <div className="win-banner"><Trophy size={25} /><div><strong>You have won!</strong><span>Your bingo is on the leaderboard.</span></div></div>}<div className="play-stats"><div><Trophy size={20} /><span><strong>{checks.length}</strong> squares complete</span></div><p>Keep your eyes open. The year is full of possibilities.</p></div>
    <section className="bingo-card"><header>{["B", "I", "N", "G", "O"].map(x => <b key={x}>{x}</b>)}</header><div className="card-grid">{Array.from({ length: 25 }).map((_, i) => {
      if (i === 12) return <div className="free" key="free"><Sparkles size={22} /><strong>FREE</strong><span>good vibes</span></div>;
      const idea = card[i > 12 ? i - 1 : i]; if (!idea) return <div key={i} />;
      const shared = overlaps.find(overlap => overlap.ideaId === idea.id)?.users ?? [];
      return <button key={idea.id} className={done(idea.id) ? "done" : ""} onClick={() => { setOpen(idea); setComment(checkMap[idea.id] ?? ""); }}><span className="overlap-icons">{shared.slice(0, 3).map(player => <i title={`${player.name} also completed this tile`} style={{ background: player.color }} key={player.name}>{player.icon}</i>)}</span><span className="done-check"><Check size={17} /></span><p>{idea.text}</p>{done(idea.id) && checkMap[idea.id] && <MessageSquare size={13} />}</button>;
    })}</div></section><div className="after-play"><SharedCards cards={otherCards} /><Leaderboard entries={leaderboard} /></div>
    {open && <div className="modal-backdrop" onClick={() => setOpen(null)}><div className="modal" onClick={e => e.stopPropagation()}><button className="modal-x" onClick={() => setOpen(null)}><X size={18} /></button><span className="kicker dark">{done(open.id) ? "It happened!" : "Did it happen?"}</span><h3>{open.text}</h3><label>Tell the story <span>optional</span><textarea placeholder="What happened? Who was there?" value={comment} onChange={e => setComment(e.target.value)} /></label><div className="modal-actions">{done(open.id) && <button className="ghost danger" onClick={uncheck}>Mark incomplete</button>}<button className="primary" onClick={save}><Check size={17} /> Mark it complete</button></div></div></div>}
  </>;
}

const toZoneInput = (value: number | undefined, timezone: string) => {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(value);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
};

const fromZoneInput = (value: string, timezone: string) => {
  const target = Date.parse(`${value}:00Z`);
  let guess = target;
  for (let i = 0; i < 2; i++) {
    const rendered = toZoneInput(guess, timezone);
    const renderedAsUtc = Date.parse(`${rendered}:00Z`);
    guess += target - renderedAsUtc;
  }
  return guess;
};

function ProfilePanel({ token, user, onClose }: { token: string; user: { displayName: string; color: string; icon: string }; onClose: () => void }) {
  const updateProfile = useMutation(api.game.updateProfile); const changePassword = useMutation(api.game.changePassword); const [color, setColor] = useState(user.color); const [icon, setIcon] = useState(user.icon); const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "" }); const [saved, setSaved] = useState(false); const [message, setMessage] = useState("");
  const submit = async (e: React.FormEvent) => { e.preventDefault(); await updateProfile({ token, color, icon }); setSaved(true); setTimeout(() => setSaved(false), 1400); };
  const submitPassword = async () => { try { await changePassword({ token, ...passwords }); setPasswords({ currentPassword: "", newPassword: "" }); setMessage("Password changed."); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not change password."); } };
  return <div className="modal-backdrop" onClick={onClose}><form className="modal profile-modal" onClick={e => e.stopPropagation()} onSubmit={submit}><button type="button" className="modal-x" onClick={onClose}><X size={18} /></button><span className="kicker dark">Your profile</span><h3>Make it yours</h3><div className="profile-preview" style={{ background: color }}>{icon || user.displayName.slice(0, 1)}</div><label>Profile icon<input maxLength={2} value={icon} onChange={e => setIcon(e.target.value)} placeholder="Initials or emoji" /></label><label>Profile colour<input type="color" value={color} onChange={e => setColor(e.target.value)} /></label><button className="primary" type="submit">{saved ? <><Check size={16} /> Saved</> : <><Palette size={16} /> Save profile</>}</button><div className="password-section"><strong>Change password</strong>{message && <small>{message}</small>}<label>Current password<input type="password" value={passwords.currentPassword} onChange={e => setPasswords({ ...passwords, currentPassword: e.target.value })} /></label><label>New password<input type="password" value={passwords.newPassword} onChange={e => setPasswords({ ...passwords, newPassword: e.target.value })} /></label><button type="button" className="ghost" onClick={submitPassword}>Change password</button></div></form></div>;
}

function PasswordGate({ token }: { token: string }) {
  const changePassword = useMutation(api.game.changePassword); const [currentPassword, setCurrent] = useState(""); const [newPassword, setNext] = useState(""); const [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => { e.preventDefault(); try { await changePassword({ token, currentPassword, newPassword }); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not change password."); } };
  return <div className="modal-backdrop forced"><form className="modal password-gate" onSubmit={submit}><span className="kicker dark">First login</span><h3>Choose your password</h3><p>Your temporary password must be replaced before continuing.</p><label>Temporary password<input autoFocus type="password" value={currentPassword} onChange={e => setCurrent(e.target.value)} /></label><label>New password<input type="password" minLength={8} value={newPassword} onChange={e => setNext(e.target.value)} /></label>{error && <div className="error">{error}</div>}<button className="primary" type="submit">Set new password <ArrowRight size={16} /></button></form></div>;
}

function ScheduleCard({ phase, settings, playerCount }: { phase: Phase; settings: { timezone?: string; eventStartsAt?: number; votingStartsAt?: number; shortlistStartsAt?: number; playingStartsAt?: number; endsAt: number }; playerCount: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const deadline = phase === "ideas" ? settings.votingStartsAt : phase === "voting" ? settings.shortlistStartsAt : phase === "shortlist" ? settings.playingStartsAt : settings.endsAt;
  const format = (value?: number) => value ? new Intl.DateTimeFormat(undefined, { timeZone: settings.timezone, dateStyle: "medium", timeStyle: "short" }).format(value) : "Not scheduled";
  const remaining = deadline ? Math.max(0, deadline - now) : 0;
  const countdown = deadline ? `${Math.floor(remaining / 86400000)}d ${Math.floor(remaining / 3600000) % 24}h ${Math.floor(remaining / 60000) % 60}m ${Math.floor(remaining / 1000) % 60}s` : "No deadline";
  const stageLabel = phase === "ideas" ? "Ideas close" : phase === "voting" ? "Voting closes" : phase === "shortlist" ? "Cards due" : "Event ends";
  return <aside className="schedule-card"><div className="schedule-main"><Clock3 size={18} /><span><strong>{stageLabel}</strong><small>{format(deadline)}</small></span><b>{countdown}</b></div><div className="event-range"><Users size={13} /><span>{playerCount} players</span><i>{format(settings.playingStartsAt)} → {format(settings.endsAt)}</i></div></aside>;
}

function stageTime(phase: Phase, settings: { timezone?: string; votingStartsAt?: number; shortlistStartsAt?: number; playingStartsAt?: number; endsAt: number } | null) {
  if (phase === "ideas") return null;
  if (!settings) return "Not scheduled";
  const value = phase === "voting" ? settings.votingStartsAt : phase === "shortlist" ? settings.shortlistStartsAt : settings.playingStartsAt;
  return value ? new Intl.DateTimeFormat(undefined, { timeZone: settings.timezone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(value) : "Not scheduled";
}

function phaseAt(settings: { phase: Phase; votingStartsAt?: number; shortlistStartsAt?: number; playingStartsAt?: number }, now: number): Phase {
  if (settings.playingStartsAt && now >= settings.playingStartsAt) return "playing";
  if (settings.shortlistStartsAt && now >= settings.shortlistStartsAt) return "shortlist";
  if (settings.votingStartsAt && now >= settings.votingStartsAt) return "voting";
  return settings.phase;
}

function AdminPanel({ token, people, users, settings, onClose }: { token: string; people: Person[]; users: { id: Id<"users">; username: string; name: string; personId: string; isAdmin: boolean }[]; settings: { timezone?: string; eventStartsAt?: number; votingStartsAt?: number; shortlistStartsAt?: number; playingStartsAt?: number; endsAt: number }; onClose: () => void }) {
  const addUser = useMutation(api.admin.addUser); const addPerson = useMutation(api.admin.addPerson);
  const saveSchedule = useMutation(api.admin.saveSchedule); const resetGame = useMutation(api.admin.resetGame);
  const [user, setUser] = useState({ username: "", password: "", displayName: "", color: "#7292cf" });
  const [person, setPerson] = useState({ name: "", color: "#e0a634" }); const [message, setMessage] = useState("");
  const [confirmReset, setConfirmReset] = useState(false); const [resetOptions, setResetOptions] = useState({ resetIdeas: true, resetVotes: true, resetCards: true, resetProgress: true, resetSchedule: false, removeUsers: false, removeNonUserPeople: false });
  const timezone = settings.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [schedule, setSchedule] = useState({ timezone, eventStart: toZoneInput(settings.eventStartsAt, timezone), voting: toZoneInput(settings.votingStartsAt, timezone), shortlist: toZoneInput(settings.shortlistStartsAt, timezone), playing: toZoneInput(settings.playingStartsAt, timezone), ends: toZoneInput(settings.endsAt, timezone) });
  const submitUser = async (e: React.FormEvent) => { e.preventDefault(); try { await addUser({ token, ...user, isAdmin: false }); setUser({ username: "", password: "", displayName: "", color: "#7292cf" }); setMessage("User added."); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not add user."); } };
  const submitPerson = async (e: React.FormEvent) => { e.preventDefault(); try { await addPerson({ token, ...person }); setPerson({ name: "", color: "#e0a634" }); setMessage("Person added."); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not add person."); } };
  const submitSchedule = async (e: React.FormEvent) => { e.preventDefault(); try { await saveSchedule({ token, timezone: schedule.timezone, eventStartsAt: fromZoneInput(schedule.eventStart, schedule.timezone), votingStartsAt: fromZoneInput(schedule.voting, schedule.timezone), shortlistStartsAt: fromZoneInput(schedule.shortlist, schedule.timezone), playingStartsAt: fromZoneInput(schedule.playing, schedule.timezone), endsAt: fromZoneInput(schedule.ends, schedule.timezone) }); setMessage("Stage schedule saved."); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save schedule."); } };
  const reset = async () => { if (!confirmReset) return setConfirmReset(true); await resetGame({ token, ...resetOptions }); setMessage("Selected game data reset."); setConfirmReset(false); };
  const toggleReset = (key: keyof typeof resetOptions) => setResetOptions(options => ({ ...options, [key]: !options[key] }));
  return <div className="modal-backdrop" onClick={onClose}><div className="modal admin-modal" onClick={e => e.stopPropagation()}><button className="modal-x" onClick={onClose}><X size={18} /></button><span className="kicker dark">Game admin</span><h3>Manage people</h3>{message && <div className="admin-message">{message}</div>}<div className="admin-columns">
    <form onSubmit={submitUser}><h4><UserPlus size={16} /> Add a user</h4><p>Creates a login and a person for idea tagging.</p><label>Display name<input value={user.displayName} onChange={e => setUser({ ...user, displayName: e.target.value })} /></label><label>Username<input value={user.username} onChange={e => setUser({ ...user, username: e.target.value })} /></label><label>Temporary password<input type="password" value={user.password} onChange={e => setUser({ ...user, password: e.target.value })} /></label><label>Profile colour<input type="color" value={user.color} onChange={e => setUser({ ...user, color: e.target.value })} /></label><button className="primary small" type="submit">Add user</button></form>
    <form onSubmit={submitPerson}><h4><Users size={16} /> Add a non-user person</h4><p>Can be tagged in ideas, but cannot sign in.</p><label>Name<input value={person.name} onChange={e => setPerson({ ...person, name: e.target.value })} /></label><label>Profile colour<input type="color" value={person.color} onChange={e => setPerson({ ...person, color: e.target.value })} /></label><button className="primary small" type="submit">Add person</button></form>
  </div><form className="schedule-form" onSubmit={submitSchedule}><h4><CalendarClock size={16} /> Stage schedule</h4><p>Each stage advances automatically at the wall-clock time in the selected timezone.</p><label>Timezone<input value={schedule.timezone} onChange={e => setSchedule({ ...schedule, timezone: e.target.value })} placeholder="Australia/Adelaide" /></label><div><label>Event starts<input required type="datetime-local" value={schedule.eventStart} onChange={e => setSchedule({ ...schedule, eventStart: e.target.value })} /></label><label>Voting starts<input required type="datetime-local" value={schedule.voting} onChange={e => setSchedule({ ...schedule, voting: e.target.value })} /></label><label>Card selection starts<input required type="datetime-local" value={schedule.shortlist} onChange={e => setSchedule({ ...schedule, shortlist: e.target.value })} /></label><label>Playing starts<input required type="datetime-local" value={schedule.playing} onChange={e => setSchedule({ ...schedule, playing: e.target.value })} /></label><label>Game ends<input required type="datetime-local" value={schedule.ends} onChange={e => setSchedule({ ...schedule, ends: e.target.value })} /></label></div><button className="primary small" type="submit">Save schedule</button></form>
  <div className="directory"><strong>{users.length} users</strong>{users.map(account => <span key={account.id}>{account.name} <small>@{account.username}{account.isAdmin ? " · admin" : ""}</small></span>)}<strong>{people.length - users.length - 1} non-user people</strong></div><div className="reset-zone"><div><strong>Reset options</strong><span>Choose exactly what should be cleared. Users are kept by default.</span><section>{Object.entries({ resetIdeas: "Questions", resetVotes: "Votes", resetCards: "Cards", resetProgress: "Progress and winners", resetSchedule: "Schedule", removeUsers: "Users", removeNonUserPeople: "Non-user people" }).map(([key, label]) => <label key={key}><input type="checkbox" checked={resetOptions[key as keyof typeof resetOptions]} onChange={() => toggleReset(key as keyof typeof resetOptions)} />{label}</label>)}</section></div><button className="ghost danger" onClick={reset}><RotateCcw size={14} /> {confirmReset ? "Click again to confirm" : "Reset selected"}</button></div></div></div>;
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("bingo-token") ?? "");
  const state = useQuery(api.game.state, token ? { token } : "skip");
  const addIdea = useMutation(api.game.addIdea); const submitBallot = useMutation(api.game.submitBallot);
  const removeIdea = useMutation(api.game.removeIdea);
  const saveCard = useMutation(api.game.saveCard); const toggleCheck = useMutation(api.game.toggleCheck);
  const setPhase = useMutation(api.admin.setPhase); const logout = useMutation(api.game.logout);
  const [adminOpen, setAdminOpen] = useState(false); const [profileOpen, setProfileOpen] = useState(false);
  const [dismissedWin, setDismissedWin] = useState<number | null>(null);
  const [clock, setClock] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setClock(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (state === null) { localStorage.removeItem("bingo-token"); setToken(""); } }, [state]);
  if (!token) return <Login onLogin={result => { localStorage.setItem("bingo-token", result.token); setToken(result.token); }} />;
  if (state === undefined || state === null) return <main className="login-shell"><section className="login-panel"><div className="login-form"><span className="kicker dark">Connecting</span><h2>Loading your game…</h2></div></section></main>;
  const phase = state.settings ? phaseAt(state.settings, clock) : "ideas"; const people = state.people.length ? state.people : fallbackPeople;
  const ideas = state.ideas as Idea[]; const shortlist = ideas.filter(idea => idea.shortlisted).sort((a, b) => (a.shortlistRank ?? 51) - (b.shortlistRank ?? 51)).slice(0, 50);
  const changePhase = async (next: Phase) => setPhase({ token, phase: next });
  const signOut = async () => { await logout({ token }); localStorage.removeItem("bingo-token"); setToken(""); };
  const latestWin = state.leaderboard[state.leaderboard.length - 1];
  const seenWin = latestWin ? dismissedWin === latestWin.wonAt || localStorage.getItem("bingo-seen-win") === String(latestWin.wonAt) : true;
  const dismissWin = () => { if (latestWin) { localStorage.setItem("bingo-seen-win", String(latestWin.wonAt)); setDismissedWin(latestWin.wonAt); } };
  return <div className="app-shell">{state.user.mustChangePassword && <PasswordGate token={token} />}<header className="topbar"><div className="brand"><span className="brand-mark"><i /><i /><i /><i /></span> Family Bingo</div><nav>{(Object.keys(phaseMeta) as Phase[]).map((p, i) => { const time = stageTime(p, state.settings); return <button key={p} disabled={!state.user.isAdmin && phase !== p} onClick={() => changePhase(p)} className={phase === p ? "active" : ""}><span>{i + 1}</span><strong>{phaseMeta[p].label}{time && <small>{time}</small>}</strong></button>; })}</nav><div className="user"><button className="profile-button" title="Edit profile" style={{ background: state.user.color }} onClick={() => setProfileOpen(true)}>{state.user.icon}</button><div><strong>{state.user.displayName}</strong><small>{state.user.isAdmin ? "Game admin" : "Player"}</small></div>{state.user.isAdmin && <button title="Manage people" onClick={() => setAdminOpen(true)}><Settings size={16} /></button>}<button title="Sign out" onClick={signOut}><LogOut size={16} /></button></div></header>
    {!seenWin && latestWin && <button className="win-toast" onClick={dismissWin}><Bell size={18} /><span><strong>{latestWin.name} has won!</strong><small>They are #{latestWin.place} on the leaderboard.</small></span><X size={14} /></button>}
    <main><section className="hero"><div><span className="kicker dark">{phaseMeta[phase].eyebrow}</span><h1>{phaseMeta[phase].title}</h1><p>{phaseMeta[phase].detail}</p></div>{state.settings && <ScheduleCard phase={phase} settings={state.settings} playerCount={state.playerCount} />}</section>
      {phase === "ideas" && <IdeaPhase ideas={ideas} people={people} me={state.user.displayName} isAdmin={state.user.isAdmin} onRemove={ideaId => removeIdea({ token, ideaId }).then(() => undefined)} onAdd={(text, personKeys) => addIdea({ token, text, personKeys }).then(() => undefined)} />}
      {phase === "voting" && <VotingPhase ideas={ideas} people={people} initial={state.ballot} onSave={rankedIdeaIds => submitBallot({ token, rankedIdeaIds }).then(() => undefined)} />}
      {phase === "shortlist" && <ShortlistPhase ideas={shortlist} people={people} initial={state.card} onDone={ideaIds => saveCard({ token, ideaIds }).then(() => undefined)} />}
      {phase === "playing" && <PlayPhase ideas={ideas} cardIds={state.card.length ? state.card : shortlist.slice(0, 24).map(x => x.id)} checks={state.checks} overlaps={state.overlaps} otherCards={state.otherCards} leaderboard={state.leaderboard} hasWon={state.hasWon} onToggle={(ideaId, checked, comment) => toggleCheck({ token, ideaId, checked, comment }).then(() => undefined)} />}
    </main><footer className="site-foot"><span>Family Bingo · live on Convex</span>{state.user.isAdmin && <span className="demo-switch">Game phase: {(Object.keys(phaseMeta) as Phase[]).map(p => <button className={phase === p ? "active" : ""} onClick={() => changePhase(p)} key={p}>{phaseMeta[p].label}</button>)}</span>}</footer>{adminOpen && state.settings && <AdminPanel token={token} people={people} users={state.users} settings={state.settings} onClose={() => setAdminOpen(false)} />}{profileOpen && <ProfilePanel token={token} user={state.user} onClose={() => setProfileOpen(false)} />}
  </div>;
}
