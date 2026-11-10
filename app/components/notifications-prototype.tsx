// PROTOTYPE: throwaway. Answers "How do people see and dismiss notifications in the app?"
// (wayfinder ticket #7). Three variants of the in-app inbox, switchable via ?variant=A|B|C
// on any page inside the app layout. Notifications are STUBS built from real course and
// Student names; read/archive state lives in memory and resets on reload. No Knock calls.
import { useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import {
  Archive,
  Bell,
  Check,
  CheckCheck,
  GraduationCap,
  Inbox,
  Mail,
  Megaphone,
  Receipt,
  X,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { PrototypeSwitcher } from "~/components/prototype-switcher";

// ─── Stub data ───

export type NotificationType =
  | "enrollment_gained"
  | "refund_request_raised"
  | "refund_request_decided"
  | "course_published";

export type StubNotification = {
  id: string;
  type: NotificationType;
  text: string;
  link: string;
  minutesAgo: number;
  alsoEmailed: boolean;
};

type StubCourse = { id: number; title: string; slug: string };

export function buildStubNotifications(input: {
  role: string;
  courses: StubCourse[];
  studentNames: string[];
}): StubNotification[] {
  const c = (i: number) => input.courses[i % Math.max(1, input.courses.length)] ?? {
    id: 0,
    title: "Intro to SQL",
    slug: "intro-to-sql",
  };
  const s = (i: number) => input.studentNames[i % Math.max(1, input.studentNames.length)] ?? "A Student";

  if (input.role === "instructor") {
    return [
      { id: "i1", type: "enrollment_gained", text: `${s(0)} enrolled on ${c(0).title}`, link: `/instructor/${c(0).id}/students`, minutesAgo: 12, alsoEmailed: false },
      { id: "i2", type: "refund_request_raised", text: `${s(1)} asked for a refund on ${c(0).title}`, link: `/instructor/${c(0).id}/students`, minutesAgo: 95, alsoEmailed: false },
      { id: "i3", type: "enrollment_gained", text: `${s(2)} enrolled on ${c(1).title}`, link: `/instructor/${c(1).id}/students`, minutesAgo: 240, alsoEmailed: false },
      { id: "i4", type: "refund_request_decided", text: `A refund was approved for ${s(3)} on ${c(1).title}. They are no longer enrolled.`, link: `/instructor/${c(1).id}/students`, minutesAgo: 1500, alsoEmailed: false },
      { id: "i5", type: "enrollment_gained", text: `${s(1)} enrolled on ${c(0).title}`, link: `/instructor/${c(0).id}/students`, minutesAgo: 3000, alsoEmailed: false },
    ];
  }
  if (input.role === "admin") {
    return [
      { id: "a1", type: "refund_request_raised", text: `${s(0)} raised a Refund Request for ${c(0).title}`, link: "/admin/refunds", minutesAgo: 8, alsoEmailed: true },
      { id: "a2", type: "refund_request_raised", text: `${s(1)} raised a Refund Request for ${c(1).title} (Team Licence)`, link: "/admin/refunds", minutesAgo: 180, alsoEmailed: true },
      { id: "a3", type: "refund_request_raised", text: `${s(2)} raised a Refund Request for ${c(2).title}`, link: "/admin/refunds", minutesAgo: 2000, alsoEmailed: true },
    ];
  }
  return [
    { id: "s1", type: "course_published", text: `New course: ${c(2).title} is now available`, link: `/courses/${c(2).slug}`, minutesAgo: 30, alsoEmailed: true },
    { id: "s2", type: "refund_request_decided", text: `Your refund for ${c(1).title} was approved`, link: `/courses/${c(1).slug}`, minutesAgo: 300, alsoEmailed: true },
    { id: "s3", type: "refund_request_raised", text: `We have your Refund Request for ${c(1).title}`, link: "/settings", minutesAgo: 2900, alsoEmailed: true },
    { id: "s4", type: "enrollment_gained", text: `You're enrolled on ${c(0).title}`, link: `/courses/${c(0).slug}`, minutesAgo: 6000, alsoEmailed: true },
  ];
}

// ─── Shared helpers ───

const TYPE_META: Record<NotificationType, { label: string; icon: ReactNode }> = {
  enrollment_gained: { label: "Enrollments", icon: <GraduationCap className="size-4" /> },
  refund_request_raised: { label: "Refund Requests", icon: <Receipt className="size-4" /> },
  refund_request_decided: { label: "Refund decisions", icon: <Receipt className="size-4" /> },
  course_published: { label: "New courses", icon: <Megaphone className="size-4" /> },
};

function ago(m: number) {
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
}

function withVariant(link: string, variant: string) {
  return `${link}${link.includes("?") ? "&" : "?"}variant=${variant}`;
}

type InboxState = {
  items: StubNotification[];
  isRead: (id: string) => boolean;
  markRead: (id: string) => void;
  toggleRead: (id: string) => void;
  markAllRead: () => void;
  archive: (id: string) => void;
  unread: number;
  variant: string;
};

function useInboxState(all: StubNotification[], variant: string): InboxState {
  const [read, setRead] = useState<Set<string>>(new Set());
  const [archived, setArchived] = useState<Set<string>>(new Set());
  const items = all.filter((n) => !archived.has(n.id));
  const update = (fn: (s: Set<string>) => void) =>
    setRead((prev) => {
      const next = new Set(prev);
      fn(next);
      return next;
    });
  return {
    items,
    isRead: (id) => read.has(id),
    markRead: (id) => update((s) => s.add(id)),
    toggleRead: (id) => update((s) => (s.has(id) ? s.delete(id) : s.add(id))),
    markAllRead: () => update((s) => items.forEach((n) => s.add(n.id))),
    archive: (id) =>
      setArchived((prev) => new Set(prev).add(id)),
    unread: items.filter((n) => !read.has(n.id)).length,
    variant,
  };
}

function UnreadBadge({ count, className }: { count: number; className?: string }) {
  if (count === 0) return null;
  return (
    <span className={cn("min-w-5 rounded-full bg-red-600 px-1.5 text-center text-[11px] font-semibold leading-5 text-white", className)}>
      {count}
    </span>
  );
}

// ─── Variant A: bell beside the logo, compact popover ───

function VariantABell({ s }: { s: InboxState }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent"
        aria-label="Notifications"
      >
        <Bell className="size-5" />
        <UnreadBadge count={s.unread} className="absolute -right-1.5 -top-1" />
      </button>
      {open && (
        <div className="absolute left-0 top-10 z-50 w-96 rounded-lg border bg-popover text-popover-foreground shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <span className="font-semibold">Notifications</span>
            <button onClick={s.markAllRead} className="text-xs text-primary hover:underline">
              Mark all as read
            </button>
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {s.items.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">You're all caught up</li>}
            {s.items.map((n) => (
              <li key={n.id}>
                <Link
                  to={withVariant(n.link, s.variant)}
                  onClick={() => {
                    s.markRead(n.id);
                    setOpen(false);
                  }}
                  className={cn("flex gap-3 px-4 py-3 text-sm hover:bg-accent", !s.isRead(n.id) && "bg-primary/5")}
                >
                  <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: s.isRead(n.id) ? "transparent" : "var(--color-primary)" }} />
                  <span className="flex-1">
                    <span className={cn(!s.isRead(n.id) && "font-medium")}>{n.text}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{ago(n.minutesAgo)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Variant B: floating bell top-right, full-height drawer with tabs and row actions ───

function VariantBDrawer({ s }: { s: InboxState }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const shown = s.items.filter((n) => tab === "all" || !s.isRead(n.id));
  const today = shown.filter((n) => n.minutesAgo < 1440);
  const earlier = shown.filter((n) => n.minutesAgo >= 1440);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed right-6 top-4 z-40 flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-sm shadow-md hover:bg-accent"
      >
        <Bell className="size-4" />
        Notifications
        <UnreadBadge count={s.unread} />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setOpen(false)}>
          <aside className="flex h-full w-[28rem] flex-col bg-background shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-lg font-semibold">Notifications</h2>
              <button onClick={() => setOpen(false)} className="rounded p-1 hover:bg-accent" aria-label="Close">
                <X className="size-5" />
              </button>
            </div>
            <div className="flex items-center gap-1 border-b px-5 py-2 text-sm">
              {(["all", "unread"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={cn("rounded-md px-3 py-1 capitalize", tab === t ? "bg-accent font-medium" : "text-muted-foreground")}>
                  {t}
                  {t === "unread" && ` (${s.unread})`}
                </button>
              ))}
              <button onClick={s.markAllRead} className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline">
                <CheckCheck className="size-3.5" /> Mark all as read
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {shown.length === 0 && <p className="p-10 text-center text-sm text-muted-foreground">Nothing here</p>}
              {[["Today", today], ["Earlier", earlier]].map(([label, group]) =>
                (group as StubNotification[]).length ? (
                  <section key={label as string}>
                    <h3 className="px-5 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label as string}</h3>
                    {(group as StubNotification[]).map((n) => (
                      <div key={n.id} className={cn("group flex items-start gap-3 border-b px-5 py-3", !s.isRead(n.id) && "bg-primary/5")}>
                        <span className="mt-0.5 rounded-full bg-muted p-2 text-muted-foreground">{TYPE_META[n.type].icon}</span>
                        <Link to={withVariant(n.link, s.variant)} onClick={() => { s.markRead(n.id); setOpen(false); }} className="flex-1 text-sm">
                          <span className={cn(!s.isRead(n.id) && "font-medium")}>{n.text}</span>
                          <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                            {ago(n.minutesAgo)}
                            {n.alsoEmailed && <span className="flex items-center gap-1"><Mail className="size-3" /> also emailed</span>}
                          </span>
                        </Link>
                        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button title={s.isRead(n.id) ? "Mark as unread" : "Mark as read"} onClick={() => s.toggleRead(n.id)} className="rounded p-1 hover:bg-accent">
                            <Check className="size-4" />
                          </button>
                          <button title="Archive" onClick={() => s.archive(n.id)} className="rounded p-1 hover:bg-accent">
                            <Archive className="size-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </section>
                ) : null
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

// ─── Variant C: "Inbox" in the sidebar nav, a full inbox page grouped by Notification Type ───

function VariantCNavItem({ s, open, onOpen }: { s: InboxState; open: boolean; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        open ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent"
      )}
    >
      <Inbox className="size-4" />
      Inbox
      <UnreadBadge count={s.unread} className="ml-auto" />
    </button>
  );
}

function VariantCPage({ s, onClose }: { s: InboxState; onClose: () => void }) {
  const types = Array.from(new Set(s.items.map((n) => n.type)));
  const [filter, setFilter] = useState<NotificationType | "all">("all");
  const shown = s.items.filter((n) => filter === "all" || n.type === filter);
  return (
    <div className="mx-auto flex max-w-5xl gap-8 p-8">
      <div className="w-52 shrink-0 space-y-1">
        <h1 className="mb-4 text-2xl font-bold">Inbox</h1>
        {(["all", ...types] as const).map((t) => {
          const count = s.items.filter((n) => (t === "all" || n.type === t) && !s.isRead(n.id)).length;
          return (
            <button key={t} onClick={() => setFilter(t)} className={cn("flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm", filter === t ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent")}>
              {t === "all" ? <Inbox className="size-4" /> : TYPE_META[t].icon}
              {t === "all" ? "Everything" : TYPE_META[t].label}
              <UnreadBadge count={count} className="ml-auto" />
            </button>
          );
        })}
      </div>
      <div className="flex-1">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{shown.length} notifications</span>
          <div className="flex gap-3 text-sm">
            <button onClick={s.markAllRead} className="text-primary hover:underline">Mark all as read</button>
            <button onClick={onClose} className="text-muted-foreground hover:underline">Back to page</button>
          </div>
        </div>
        <table className="w-full overflow-hidden rounded-lg border text-sm">
          <tbody>
            {shown.map((n) => (
              <tr key={n.id} className={cn("border-b last:border-0", !s.isRead(n.id) && "bg-primary/5")}>
                <td className="w-8 py-3 pl-4">
                  <input type="checkbox" checked={s.isRead(n.id)} onChange={() => s.toggleRead(n.id)} title="Read" />
                </td>
                <td className="py-3 pr-2 text-muted-foreground">{TYPE_META[n.type].label}</td>
                <td className="py-3">
                  <Link to={withVariant(n.link, s.variant)} onClick={() => { s.markRead(n.id); onClose(); }} className={cn("hover:underline", !s.isRead(n.id) && "font-medium")}>
                    {n.text}
                  </Link>
                </td>
                <td className="whitespace-nowrap py-3 pr-4 text-right text-muted-foreground">{ago(n.minutesAgo)}</td>
                <td className="py-3 pr-4">
                  <button title="Archive" onClick={() => s.archive(n.id)} className="rounded p-1 hover:bg-accent"><Archive className="size-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Wiring: the layout asks for each slot ───

const VARIANTS = [
  { key: "A", name: "Bell + popover" },
  { key: "B", name: "Drawer with tabs" },
  { key: "C", name: "Inbox page" },
];

export function useNotificationsPrototype(all: StubNotification[], role: string | null) {
  const [searchParams] = useSearchParams();
  const raw = searchParams.get("variant") ?? "A";
  const variant = VARIANTS.some((v) => v.key === raw) ? raw : "A";
  const s = useInboxState(all, variant);
  const [inboxOpen, setInboxOpen] = useState(false);

  return {
    headerSlot: variant === "A" ? <VariantABell s={s} /> : null,
    navSlot: variant === "C" ? <VariantCNavItem s={s} open={inboxOpen} onOpen={() => setInboxOpen(true)} /> : null,
    mainOverride: variant === "C" && inboxOpen ? <VariantCPage s={s} onClose={() => setInboxOpen(false)} /> : null,
    floating: (
      <>
        {variant === "B" && <VariantBDrawer s={s} />}
        <PrototypeSwitcher variants={VARIANTS} current={variant} status={`${role ?? "no user"} · ${s.unread} unread / ${s.items.length}`} />
      </>
    ),
  };
}
