"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bot,
  Check,
  CircleAlert,
  Copy,
  Info,
  RotateCcw,
  SendHorizontal,
  Sparkles,
  X,
} from "lucide-react";

type Role = "user" | "agent";

interface ChatMessage {
  id: string;
  role: Role;
  content: string;
}

interface ChatApiResponse {
  reply?: string;
  interaction_id?: string | null;
  conversation_id?: string | null;
  references?: unknown[];
  error?: string;
}

const STARTER_PROMPTS: { emoji: string; text: string }[] = [
  { emoji: "📌", text: "Jadwal mentoring saya kapan?" },
  { emoji: "💡", text: "Apa materi di Week 7 Vibecoding?" },
  { emoji: "🛡️", text: "Syarat klaim garansi 100% agent berjalan apa saja?" },
  { emoji: "👥", text: "Siapa saja mentor di kelas Beginner dan Intermediate?" },
];

const MAX_TEXTAREA_ROWS = 5;

const markdownComponents: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="table-wrap">
      <table>{children}</table>
    </div>
  ),
};

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentInteractionId, setCurrentInteractionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll ke pesan terbawah
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

  // Auto-grow textarea (maks 5 baris)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 24;
    const maxHeight = lineHeight * MAX_TEXTAREA_ROWS;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [input]);

  // Tutup modal dengan Escape
  useEffect(() => {
    if (!isInfoOpen) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setIsInfoOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isInfoOpen]);

  const handleSendMessage = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || isLoading) return;

      setError(null);
      setInput("");
      setMessages((prev) => [...prev, { id: createId(), role: "user", content: text }]);
      setIsLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, lastInteractionId: currentInteractionId }),
        });

        const data = (await res.json().catch(() => ({}))) as ChatApiResponse;

        if (!res.ok) {
          throw new Error(data.error ?? `Permintaan gagal (${res.status}).`);
        }

        if (data.interaction_id) {
          setCurrentInteractionId(data.interaction_id);
        }

        setMessages((prev) => [
          ...prev,
          {
            id: createId(),
            role: "agent",
            content: data.reply?.trim() || "_(ACL Agent tidak mengirim jawaban.)_",
          },
        ]);
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : "Koneksi ke ACL Agent terputus. Coba lagi sebentar lagi.";
        setError(msg);
      } finally {
        setIsLoading(false);
        textareaRef.current?.focus();
      }
    },
    [currentInteractionId, isLoading]
  );

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void handleSendMessage(input);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void handleSendMessage(input);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setInput("");
    setError(null);
    setCurrentInteractionId(null);
    textareaRef.current?.focus();
  };

  const handleCopy = async (msg: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopiedId(msg.id);
      window.setTimeout(() => setCopiedId((id) => (id === msg.id ? null : id)), 1800);
    } catch (err: unknown) {
      console.error("Gagal menyalin:", err);
    }
  };

  const isEmpty = messages.length === 0;
  const canSend = input.trim().length > 0 && !isLoading;

  return (
    <div className="flex h-dvh flex-col bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-900/40">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold tracking-tight text-zinc-50">
                  ACL Agent
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </span>
                  Online
                </span>
              </div>
              <p className="truncate text-xs text-zinc-400">
                AI Creator Labs • Learning Companion &amp; Bootcamp Assistant
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={handleNewChat}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New Chat</span>
            </button>
            <button
              type="button"
              onClick={() => setIsInfoOpen(true)}
              aria-label="Info ACL Agent"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800"
            >
              <Info className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Thread */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6">
          {isEmpty ? (
            <section className="flex min-h-[55vh] flex-col items-center justify-center text-center">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-xl shadow-indigo-900/40">
                <Sparkles className="h-7 w-7 text-white" />
              </div>
              <h2 className="max-w-lg text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
                Halo Builder! 👋
              </h2>
              <p className="mt-2 max-w-md text-sm text-zinc-400 sm:text-base">
                Ada yang bisa dibantu seputar AI Builder Bootcamp?
              </p>
              <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
                {STARTER_PROMPTS.map((p) => (
                  <button
                    key={p.text}
                    type="button"
                    onClick={() => void handleSendMessage(p.text)}
                    disabled={isLoading}
                    className="group flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-left text-sm text-zinc-300 transition hover:border-indigo-500/50 hover:bg-zinc-900 hover:text-zinc-100 disabled:opacity-50"
                  >
                    <span className="text-lg leading-none">{p.emoji}</span>
                    <span className="leading-snug">{p.text}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <ul className="space-y-6">
              {messages.map((msg) =>
                msg.role === "user" ? (
                  <li key={msg.id} className="flex justify-end">
                    <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm bg-indigo-600 px-4 py-2.5 text-[15px] leading-relaxed text-white shadow-md shadow-indigo-950/40">
                      {msg.content}
                    </div>
                  </li>
                ) : (
                  <li key={msg.id} className="flex gap-3">
                    <AgentAvatar />
                    <div className="min-w-0 max-w-[85%] flex-1">
                      <div className="rounded-2xl rounded-tl-sm border border-zinc-800 bg-zinc-900 px-4 py-3 text-zinc-100">
                        <div className="md">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={markdownComponents}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleCopy(msg)}
                        className="mt-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-zinc-500 transition hover:bg-zinc-900 hover:text-zinc-300"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                            Tersalin
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            Copy response
                          </>
                        )}
                      </button>
                    </div>
                  </li>
                )
              )}

              {isLoading && (
                <li className="flex gap-3" aria-live="polite">
                  <AgentAvatar />
                  <div className="flex items-center gap-3 rounded-2xl rounded-tl-sm border border-zinc-800 bg-zinc-900 px-4 py-3">
                    <span className="flex gap-1">
                      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-indigo-400" />
                      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-indigo-400" />
                      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-indigo-400" />
                    </span>
                    <span className="text-xs text-zinc-400">
                      ACL Agent sedang mencari materi &amp; berpikir...
                    </span>
                  </div>
                </li>
              )}
            </ul>
          )}

          {error && (
            <div
              role="alert"
              className="mt-6 flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
            >
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
              <div className="flex-1">
                <p className="font-medium">Ups, ada kendala koneksi.</p>
                <p className="mt-0.5 text-rose-300/80">{error}</p>
              </div>
              <button
                type="button"
                onClick={() => setError(null)}
                aria-label="Tutup pesan error"
                className="text-rose-300/70 transition hover:text-rose-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      {/* Sticky input bar */}
      <footer className="sticky bottom-0 border-t border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
        <form onSubmit={handleSubmit} className="mx-auto max-w-3xl px-4 pb-3 pt-3">
          <div className="flex items-end gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 p-2 transition focus-within:border-indigo-500/60 focus-within:ring-2 focus-within:ring-indigo-500/20">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Tanya apa saja seputar bootcamp…"
              aria-label="Ketik pesan"
              className="max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] leading-6 text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Kirim pesan"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              <SendHorizontal className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] leading-snug text-zinc-500">
            ACL Agent dapat membuat kesalahan. Selalu verifikasi jadwal resmi dan materi
            unduhan di LMS:{" "}
            <a
              href="https://learn.aicreatorlabs.id"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 underline underline-offset-2 hover:text-indigo-300"
            >
              learn.aicreatorlabs.id
            </a>
          </p>
        </form>
      </footer>

      {isInfoOpen && <InfoModal onClose={() => setIsInfoOpen(false)} />}
    </div>
  );
}

function AgentAvatar() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600">
      <Bot className="h-4 w-4 text-white" />
    </div>
  );
}

function InfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="info-title"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 id="info-title" className="font-semibold text-zinc-50">
                ACL Agent
              </h3>
              <p className="text-xs text-zinc-400">AI Learning Companion &amp; CS Resmi</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-md p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-zinc-300">
          ACL Agent adalah asisten AI resmi <strong className="text-zinc-100">AI Creator Labs</strong>{" "}
          untuk peserta <strong className="text-zinc-100">AI Builder Bootcamp</strong>. Agent ini
          membantu kamu belajar dan menjawab pertanyaan seputar program.
        </p>

        <ul className="mt-4 space-y-2 text-sm text-zinc-300">
          <li className="flex gap-2">
            <span>📅</span> Jadwal kelas &amp; sesi mentoring
          </li>
          <li className="flex gap-2">
            <span>📚</span> Ringkasan materi per minggu
          </li>
          <li className="flex gap-2">
            <span>🛡️</span> Info kebijakan &amp; garansi program
          </li>
          <li className="flex gap-2">
            <span>👥</span> Mentor &amp; struktur kelas
          </li>
        </ul>

        <div className="mt-5 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3 text-xs leading-relaxed text-zinc-400">
          Percakapan bersambung otomatis (multi-turn). Klik <strong className="text-zinc-200">New Chat</strong>{" "}
          untuk memulai topik baru. Untuk jadwal resmi dan materi unduhan, cek LMS di{" "}
          <a
            href="https://learn.aicreatorlabs.id"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-300 underline underline-offset-2"
          >
            learn.aicreatorlabs.id
          </a>
          .
        </div>
      </div>
    </div>
  );
}
