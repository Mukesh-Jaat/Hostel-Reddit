"use client";

/* ============================================================================
   HOSTEL REDDIT — a password-gated Reddit reader
   Everything lives in this one file. Drop it in at: app/page.js
   Requires only two packages: lucide-react and framer-motion
   ========================================================================== */

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flame,
  Search,
  Sun,
  Moon,
  ArrowBigUp,
  MessageSquare,
  X,
  Lock,
  LogOut,
  Loader2,
  ExternalLink,
  RefreshCw,
  Pizza,
} from "lucide-react";

/* ----------------------------------------------------------------------------
   Config
---------------------------------------------------------------------------- */

const PASSWORD = process.env.NEXT_PUBLIC_HOSTEL_PASSWORD || "hostel123";

const KEYS = {
  auth: "hostel.auth",
  theme: "hostel.theme",
  ad: "hostel.ad.dismissed",
};

const SUBS = [
  { id: "all", label: "r/all" },
  { id: "memes", label: "r/memes" },
  { id: "technology", label: "r/technology" },
  { id: "gaming", label: "r/gaming" },
  { id: "AskReddit", label: "r/askreddit" },
  { id: "india", label: "r/india" },
  { id: "science", label: "r/science" },
];

/* ----------------------------------------------------------------------------
   Theme tokens — plain class strings so this works with any Tailwind setup,
   no tailwind.config or globals.css changes needed.
---------------------------------------------------------------------------- */

const THEMES = {
  dark: {
    page: "bg-[#08080c] text-zinc-100",
    shell: "bg-[#08080c]",
    bar: "bg-[#0b0b12]/70 border-white/10",
    card: "bg-white/[0.035] border-white/10 hover:border-indigo-400/40",
    panel: "bg-[#0d0d15]/90 border-white/10",
    inset: "bg-white/[0.04] border-white/10",
    input: "bg-white/[0.05] border-white/10 placeholder:text-zinc-500 text-zinc-100",
    muted: "text-zinc-400",
    faint: "text-zinc-500",
    pill: "bg-white/[0.05] border-white/10 text-zinc-300 hover:bg-white/[0.09]",
    pillOn: "bg-indigo-500 border-indigo-400 text-white",
    ghost: "hover:bg-white/10 text-zinc-300",
    skeleton: "bg-white/[0.06]",
    divider: "border-white/10",
  },
  light: {
    page: "bg-[#f4f4f8] text-zinc-900",
    shell: "bg-[#f4f4f8]",
    bar: "bg-white/70 border-black/[0.07]",
    card: "bg-white/75 border-black/[0.06] hover:border-indigo-400/60",
    panel: "bg-white/90 border-black/[0.07]",
    inset: "bg-black/[0.03] border-black/[0.06]",
    input: "bg-white/80 border-black/[0.08] placeholder:text-zinc-400 text-zinc-900",
    muted: "text-zinc-600",
    faint: "text-zinc-500",
    pill: "bg-white/70 border-black/[0.06] text-zinc-700 hover:bg-white",
    pillOn: "bg-indigo-600 border-indigo-500 text-white",
    ghost: "hover:bg-black/[0.06] text-zinc-600",
    skeleton: "bg-black/[0.06]",
    divider: "border-black/[0.07]",
  },
};

/* ----------------------------------------------------------------------------
   Small helpers
---------------------------------------------------------------------------- */

function compact(n) {
  if (n === null || n === undefined) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

function timeAgo(utcSeconds) {
  const diff = Math.floor(Date.now() / 1000) - utcSeconds;
  if (diff < 60) return "just now";
  const mins = Math.floor(diff / 60);
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  const days = Math.floor(hrs / 24);
  if (days < 30) return days + "d ago";
  const months = Math.floor(days / 30);
  if (months < 12) return months + "mo ago";
  return Math.floor(months / 12) + "y ago";
}

function pickImage(post) {
  if (!post) return null;
  if (post.post_hint === "image" && post.url && /\.(jpe?g|png|gif|webp)$/i.test(post.url)) {
    return post.url;
  }
  const preview = post.preview?.images?.[0];
  if (preview) {
    const resolutions = preview.resolutions || [];
    const best = resolutions[resolutions.length - 1];
    return (best || preview.source)?.url || null;
  }
  if (post.thumbnail && post.thumbnail.startsWith("http")) return post.thumbnail;
  return null;
}

/* Reddit's public JSON sometimes refuses browser calls. Try direct first,
   then fall back to a public read-only mirror so the feed never dead-ends. */
async function fetchReddit(path) {
  const direct = "https://www.reddit.com" + path;
  try {
    const res = await fetch(direct, { headers: { Accept: "application/json" } });
    if (res.ok) return await res.json();
    throw new Error("status " + res.status);
  } catch (err) {
    const mirror = "https://api.allorigins.win/raw?url=" + encodeURIComponent(direct);
    const res = await fetch(mirror);
    if (!res.ok) throw new Error("Reddit is not responding right now.");
    return await res.json();
  }
}

/* ----------------------------------------------------------------------------
   Global CSS: fonts + keyframes that Tailwind doesn't ship by default
---------------------------------------------------------------------------- */

function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Inter:wght@400;500;600&display=swap');

      .f-display { font-family: 'Outfit', ui-sans-serif, system-ui, sans-serif; }
      .f-body    { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; }

      html, body { -webkit-font-smoothing: antialiased; }

      @keyframes hostelShake {
        0%, 100% { transform: translateX(0); }
        15% { transform: translateX(-10px); }
        30% { transform: translateX(9px); }
        45% { transform: translateX(-7px); }
        60% { transform: translateX(5px); }
        75% { transform: translateX(-3px); }
      }
      .shake { animation: hostelShake 0.5s cubic-bezier(.36,.07,.19,.97); }

      @keyframes hostelDrift {
        0%   { transform: translate3d(0,0,0) scale(1); }
        50%  { transform: translate3d(3%, -4%, 0) scale(1.08); }
        100% { transform: translate3d(0,0,0) scale(1); }
      }
      .drift  { animation: hostelDrift 16s ease-in-out infinite; }
      .drift2 { animation: hostelDrift 21s ease-in-out infinite reverse; }

      @keyframes hostelShimmer {
        100% { transform: translateX(100%); }
      }
      .shimmer { position: relative; overflow: hidden; }
      .shimmer::after {
        content: ''; position: absolute; inset: 0; transform: translateX(-100%);
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.09), transparent);
        animation: hostelShimmer 1.6s infinite;
      }

      /* Tidy scrollbars inside the comment panel */
      .thin-scroll::-webkit-scrollbar { width: 8px; }
      .thin-scroll::-webkit-scrollbar-thumb {
        background: rgba(129,140,248,0.35); border-radius: 99px;
      }
      .thin-scroll::-webkit-scrollbar-track { background: transparent; }

      @media (prefers-reduced-motion: reduce) {
        .drift, .drift2, .shimmer::after, .shake { animation: none !important; }
      }
    `}</style>
  );
}

/* ----------------------------------------------------------------------------
   Ambient glow background
---------------------------------------------------------------------------- */

function Ambient({ theme }) {
  const strength = theme === "dark" ? "opacity-70" : "opacity-40";
  return (
    <div className={"pointer-events-none fixed inset-0 overflow-hidden " + strength} aria-hidden="true">
      <div className="drift absolute -top-40 -left-32 h-[34rem] w-[34rem] rounded-full bg-indigo-600/30 blur-[120px]" />
      <div className="drift2 absolute -bottom-52 right-[-8rem] h-[38rem] w-[38rem] rounded-full bg-violet-600/25 blur-[130px]" />
      <div className="drift absolute top-1/3 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-fuchsia-500/15 blur-[110px]" />
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Login gate
---------------------------------------------------------------------------- */

function LoginGate({ theme, onUnlock }) {
  const t = THEMES[theme];
  const [value, setValue] = useState("");
  const [wrong, setWrong] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function submit(e) {
    e.preventDefault();
    if (value === PASSWORD) {
      onUnlock();
    } else {
      setWrong(true);
      setValue("");
      setTimeout(() => setWrong(false), 600);
    }
  }

  return (
    <div className={"f-body relative min-h-screen " + t.page}>
      <GlobalStyles />
      <Ambient theme={theme} />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-5">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className={
            "w-full max-w-md rounded-3xl border p-8 shadow-2xl shadow-indigo-950/40 backdrop-blur-xl sm:p-10 " +
            t.panel +
            (wrong ? " shake" : "")
          }
        >
          <div className="mb-7 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
              <Flame size={20} className="text-white" />
            </div>
            <div>
              <p className="f-display text-lg font-semibold leading-tight">Hostel Reddit</p>
              <p className={"text-xs " + t.faint}>Private reader for the block</p>
            </div>
          </div>

          <h1 className="f-display text-3xl font-semibold tracking-tight">Enter your access key</h1>
          <p className={"mt-2 text-sm leading-relaxed " + t.muted}>
            Ask anyone on the floor for the key. It only needs to be entered once on this device.
          </p>

          <form onSubmit={submit} className="mt-7">
            <label htmlFor="key" className="sr-only">
              Access key
            </label>
            <div className="relative">
              <Lock
                size={16}
                className={"pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 " + t.faint}
              />
              <input
                id="key"
                ref={inputRef}
                type="password"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Access key"
                autoComplete="current-password"
                className={
                  "w-full rounded-2xl border py-3.5 pl-11 pr-4 text-[15px] outline-none transition focus:border-indigo-400/70 focus:ring-4 focus:ring-indigo-500/20 " +
                  t.input
                }
              />
            </div>

            <div className="h-6">
              {wrong && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 text-sm text-rose-400"
                >
                  That key doesn&apos;t match. Try again.
                </motion.p>
              )}
            </div>

            <motion.button
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              className="mt-3 w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 py-3.5 text-[15px] font-medium text-white shadow-lg shadow-indigo-600/30 transition hover:shadow-xl hover:shadow-indigo-500/40 focus:outline-none focus:ring-4 focus:ring-indigo-500/30"
            >
              Unlock the feed
            </motion.button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Skeleton card
---------------------------------------------------------------------------- */

function SkeletonCard({ t }) {
  return (
    <div className={"rounded-3xl border p-5 backdrop-blur-md " + t.panel}>
      <div className="flex gap-4">
        <div className={"shimmer h-14 w-12 rounded-xl " + t.skeleton} />
        <div className="flex-1 space-y-3">
          <div className={"shimmer h-3 w-1/3 rounded-full " + t.skeleton} />
          <div className={"shimmer h-4 w-5/6 rounded-full " + t.skeleton} />
          <div className={"shimmer h-4 w-2/3 rounded-full " + t.skeleton} />
        </div>
      </div>
      <div className={"shimmer mt-4 h-40 w-full rounded-2xl " + t.skeleton} />
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Post card
---------------------------------------------------------------------------- */

function PostCard({ post, t, index, onOpen }) {
  const image = pickImage(post);
  const body = (post.selftext || "").trim();

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.04, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      onClick={() => onOpen(post)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(post);
        }
      }}
      className={
        "group cursor-pointer overflow-hidden rounded-3xl border p-5 backdrop-blur-md transition-colors duration-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/40 " +
        t.card
      }
    >
      <div className="flex gap-4">
        <div
          className={
            "flex h-fit shrink-0 flex-col items-center gap-0.5 rounded-xl border px-2.5 py-2 " + t.inset
          }
        >
          <ArrowBigUp size={18} className="text-indigo-400" />
          <span className="f-display text-sm font-semibold">{compact(post.ups)}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-gradient-to-r from-indigo-500/20 to-violet-500/20 px-2.5 py-1 font-medium text-indigo-300 ring-1 ring-inset ring-indigo-400/30">
              r/{post.subreddit}
            </span>
            <span className={t.faint}>u/{post.author}</span>
            <span className={t.faint}>·</span>
            <span className={t.faint}>{timeAgo(post.created_utc)}</span>
          </div>

          <h2 className="f-display mt-2 text-[17px] font-semibold leading-snug tracking-tight transition-colors group-hover:text-indigo-300">
            {post.title}
          </h2>

          {body && (
            <p className={"mt-2 line-clamp-3 text-sm leading-relaxed " + t.muted}>{body}</p>
          )}
        </div>
      </div>

      {image && (
        <div className="mt-4 overflow-hidden rounded-2xl">
          {/* Plain img keeps this file drop-in — no next.config image domains needed */}
          <img
            src={image}
            alt=""
            loading="lazy"
            className="h-52 w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              e.currentTarget.parentElement.style.display = "none";
            }}
          />
        </div>
      )}

      <div className={"mt-4 flex items-center gap-4 border-t pt-3 text-xs " + t.divider + " " + t.muted}>
        <span className="inline-flex items-center gap-1.5">
          <MessageSquare size={14} />
          {compact(post.num_comments)} comments
        </span>
        <span className="ml-auto inline-flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
          Read thread
        </span>
      </div>
    </motion.article>
  );
}

/* ----------------------------------------------------------------------------
   Comment thread (recursive)
---------------------------------------------------------------------------- */

function Comment({ node, t, depth }) {
  const data = node?.data;
  if (!data || node.kind !== "t1" || !data.body) return null;

  const replies =
    data.replies && typeof data.replies === "object" ? data.replies.data?.children || [] : [];

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className={depth > 0 ? "mt-3 border-l pl-4 " + t.divider : "mt-4"}
    >
      <div className={"rounded-2xl border px-4 py-3 " + t.inset}>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium text-indigo-300">u/{data.author}</span>
          <span className={t.faint}>·</span>
          <span className={t.faint}>{compact(data.ups)} points</span>
          <span className={t.faint}>·</span>
          <span className={t.faint}>{timeAgo(data.created_utc)}</span>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{data.body}</p>
      </div>

      {depth < 3 &&
        replies.map((child, i) => (
          <Comment key={child.data?.id || i} node={child} t={t} depth={depth + 1} />
        ))}
    </motion.div>
  );
}

/* ----------------------------------------------------------------------------
   Post modal
---------------------------------------------------------------------------- */

function PostModal({ post, t, onClose }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFailed(false);

    fetchReddit(`/r/${post.subreddit}/comments/${post.id}.json?limit=40&raw_json=1`)
      .then((json) => {
        if (!alive) return;
        setComments(json?.[1]?.data?.children || []);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setFailed(true);
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [post]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const image = pickImage(post);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
    >
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.98 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className={
          "thin-scroll max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border shadow-2xl backdrop-blur-2xl sm:rounded-3xl " +
          t.panel
        }
      >
        <div
          className={
            "sticky top-0 z-10 flex items-start gap-4 border-b px-6 py-5 backdrop-blur-2xl " +
            t.bar
          }
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-indigo-500/15 px-2.5 py-1 font-medium text-indigo-300 ring-1 ring-inset ring-indigo-400/30">
                r/{post.subreddit}
              </span>
              <span className={t.faint}>u/{post.author}</span>
              <span className={t.faint}>·</span>
              <span className={t.faint}>{timeAgo(post.created_utc)}</span>
            </div>
            <h2 className="f-display mt-2 text-xl font-semibold leading-snug tracking-tight">
              {post.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close post"
            className={"rounded-full p-2 transition " + t.ghost}
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pb-8 pt-5">
          {image && (
            <img
              src={image}
              alt=""
              className="mb-5 max-h-[26rem] w-full rounded-2xl object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}

          {post.selftext && (
            <p className={"mb-6 whitespace-pre-wrap text-[15px] leading-relaxed " + t.muted}>
              {post.selftext}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <ArrowBigUp size={16} className="text-indigo-400" />
              {compact(post.ups)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MessageSquare size={15} />
              {compact(post.num_comments)}
            </span>
            <a
              href={"https://reddit.com" + post.permalink}
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300"
            >
              Open on Reddit <ExternalLink size={14} />
            </a>
          </div>

          <h3 className={"f-display mt-7 border-t pt-6 text-sm font-semibold " + t.divider}>
            Top comments
          </h3>

          {loading && (
            <div className={"mt-6 flex items-center gap-2 text-sm " + t.muted}>
              <Loader2 size={16} className="animate-spin" />
              Loading the thread
            </div>
          )}

          {failed && (
            <p className={"mt-6 text-sm " + t.muted}>
              Comments didn&apos;t load. Open the thread on Reddit to read them.
            </p>
          )}

          {!loading && !failed && comments.length === 0 && (
            <p className={"mt-6 text-sm " + t.muted}>No comments on this post yet.</p>
          )}

          {!loading &&
            !failed &&
            comments.map((node, i) => (
              <Comment key={node.data?.id || i} node={node} t={t} depth={0} />
            ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ----------------------------------------------------------------------------
   Sponsored corner card
---------------------------------------------------------------------------- */

function CanteenAd({ t, onDismiss }) {
  return (
    <motion.aside
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 1.2 }}
      className={
        "fixed bottom-5 right-5 z-[70] w-[19rem] max-w-[calc(100vw-2.5rem)] rounded-2xl border p-4 shadow-2xl shadow-indigo-900/40 ring-1 ring-indigo-400/30 backdrop-blur-xl " +
        t.panel
      }
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-md bg-gradient-to-r from-indigo-500 to-violet-600 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white">
          Sponsored
        </span>
        <button
          onClick={onDismiss}
          aria-label="Hide this ad"
          className={"ml-auto rounded-full p-1.5 transition " + t.ghost}
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-orange-500/30">
          <Pizza size={18} className="text-white" />
        </div>
        <div>
          <p className="f-display text-[15px] font-semibold leading-snug">
            Late Night Canteen &amp; Snacks 🍕
          </p>
          <p className={"mt-1 text-xs leading-relaxed " + t.muted}>
            Hot Maggi, Sandwiches &amp; Cold Drinks delivered straight to your room till 3 AM!
          </p>
        </div>
      </div>

      <motion.a
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        href="https://wa.me/91-8905124655"
        target="_blank"
        rel="noreferrer"
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-600/30 transition hover:shadow-xl hover:shadow-emerald-500/50"
      >
        Order on WhatsApp →
      </motion.a>
    </motion.aside>
  );
}

/* ----------------------------------------------------------------------------
   The page
---------------------------------------------------------------------------- */

export default function Page() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [adVisible, setAdVisible] = useState(false);

  const [sub, setSub] = useState("all");
  const [query, setQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);

  const t = THEMES[theme];

  /* Restore saved state once, on the client only */
  useEffect(() => {
    try {
      setAuthed(localStorage.getItem(KEYS.auth) === "true");
      const savedTheme = localStorage.getItem(KEYS.theme);
      if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
      setAdVisible(localStorage.getItem(KEYS.ad) !== "true");
    } catch (e) {
      setAdVisible(true);
    }
    setReady(true);
  }, []);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError("");
    const path = activeSearch
      ? `/search.json?q=${encodeURIComponent(activeSearch)}&limit=30&raw_json=1&sort=relevance`
      : `/r/${sub}/hot.json?limit=30&raw_json=1`;

    try {
      const json = await fetchReddit(path);
      const children = json?.data?.children || [];
      setPosts(children.map((c) => c.data).filter((p) => p && !p.stickied));
    } catch (e) {
      setError("The feed didn't load. Check your connection and try again.");
      setPosts([]);
    }
    setLoading(false);
  }, [sub, activeSearch]);

  useEffect(() => {
    if (authed) loadFeed();
  }, [authed, loadFeed]);

  function unlock() {
    setAuthed(true);
    try {
      localStorage.setItem(KEYS.auth, "true");
    } catch (e) {}
  }

  function lock() {
    setAuthed(false);
    try {
      localStorage.removeItem(KEYS.auth);
    } catch (e) {}
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem(KEYS.theme, next);
    } catch (e) {}
  }

  function dismissAd() {
    setAdVisible(false);
    try {
      localStorage.setItem(KEYS.ad, "true");
    } catch (e) {}
  }

  function submitSearch(e) {
    e.preventDefault();
    setActiveSearch(query.trim());
  }

  function choose(id) {
    setSub(id);
    setQuery("");
    setActiveSearch("");
  }

  /* Avoid a flash of the wrong screen before localStorage is read */
  if (!ready) {
    return <div className="min-h-screen bg-[#08080c]" />;
  }

  if (!authed) {
    return <LoginGate theme={theme} onUnlock={unlock} />;
  }

  return (
    <div className={"f-body relative min-h-screen transition-colors duration-500 " + t.page}>
      <GlobalStyles />
      <Ambient theme={theme} />

      {/* ---------------- Top bar ---------------- */}
      <header className={"sticky top-0 z-50 border-b backdrop-blur-xl transition-colors " + t.bar}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex h-16 items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
                <Flame size={17} className="text-white" />
              </div>
              <span className="f-display hidden text-[17px] font-semibold tracking-tight sm:block">
                Hostel Reddit
              </span>
            </div>

            <form onSubmit={submitSearch} className="ml-auto w-full max-w-xs">
              <div className="relative">
                <Search
                  size={15}
                  className={"pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 " + t.faint}
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search Reddit"
                  aria-label="Search Reddit"
                  className={
                    "w-full rounded-full border py-2 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-400/70 focus:ring-4 focus:ring-indigo-500/20 " +
                    t.input
                  }
                />
              </div>
            </form>

            <button
              onClick={loadFeed}
              aria-label="Refresh feed"
              className={"rounded-full p-2.5 transition " + t.ghost}
            >
              <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
            </button>

            <button
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className={"rounded-full p-2.5 transition " + t.ghost}
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            <button onClick={lock} aria-label="Lock the app" className={"rounded-full p-2.5 transition " + t.ghost}>
              <LogOut size={17} />
            </button>
          </div>

          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
            {SUBS.map((s) => {
              const on = !activeSearch && sub === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => choose(s.id)}
                  className={
                    "shrink-0 rounded-full border px-4 py-1.5 text-sm transition " +
                    (on ? t.pillOn + " shadow-lg shadow-indigo-500/25" : t.pill)
                  }
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ---------------- Feed ---------------- */}
      <main className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {activeSearch && (
          <div className="mb-6 flex items-center gap-3">
            <p className={"text-sm " + t.muted}>
              Results for <span className="font-medium text-indigo-400">{activeSearch}</span>
            </p>
            <button
              onClick={() => choose("all")}
              className={"rounded-full border px-3 py-1 text-xs transition " + t.pill}
            >
              Clear
            </button>
          </div>
        )}

        {error && !loading && (
          <div className={"rounded-3xl border p-8 text-center backdrop-blur-md " + t.panel}>
            <p className="f-display text-lg font-semibold">{error}</p>
            <button
              onClick={loadFeed}
              className="mt-4 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-5 py-2 text-sm font-medium text-white"
>
              Try again
            </button>
          </div>
        )}

        {/* ---------------- Grid Feed ---------------- */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {loading && (
            <>
              <SkeletonCard t={t} />
              <SkeletonCard t={t} />
              <SkeletonCard t={t} />
              <SkeletonCard t={t} />
            </>
          )}

          {!loading &&
            !error &&
            posts.map((post, i) => (
              <PostCard
                key={post.id || i}
                post={post}
                t={t}
                index={i}
                onOpen={(p) => setSelected(p)}
              />
            ))}
        </div>
      </main>

      {/* ---------------- Modal & Ad Overlays ---------------- */}
      <AnimatePresence>
        {selected && (
          <PostModal
            post={selected}
            t={t}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {adVisible && <CanteenAd t={t} onDismiss={dismissAd} />}
      </AnimatePresence>
    </div>
  );
}
