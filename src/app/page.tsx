"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTheme } from "next-themes";

type Msg = {
  role: "user" | "assistant";
  content: string;
};

const SWIFTY_SPRING = {
  type: "spring" as const,
  stiffness: 520,
  damping: 38,
  mass: 0.9,
};

const SWIFTY_SPRING_SOFT = {
  type: "spring" as const,
  stiffness: 380,
  damping: 34,
  mass: 1,
};

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
          animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            delay: i * 0.12,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

const STORAGE_KEY = "openrouter_key";
const STORAGE_MODEL_KEY = "openrouter_model";

type ModelOption = {
  id: string;
  name: string;
  blurb: string;
  free?: boolean;
};

// Curated, sane defaults for a business-assistant MVP.
// Note: OpenRouter supports ":free" suffix on some models, and also provides the openrouter/free router.
const MODEL_OPTIONS: ModelOption[] = [
  // --- OpenAI ---
  {
    id: "openai/gpt-5.2",
    name: "GPT-5.2",
    blurb: "Frontier-grade. Strong long-context + agentic reasoning; best when you want high quality over cost/speed.",
  },
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    blurb: "High quality and versatile. Great for manager-style drafting, planning, and analysis.",
  },
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o mini",
    blurb: "Fast + cheap. Great general-purpose assistant for planning, drafts, and quick analysis.",
  },

  // --- Anthropic ---
  {
    id: "anthropic/claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
    blurb: "Excellent writing quality and reasoning. Great for memos, strategy, and nuanced business comms.",
  },

  // --- Google Gemini ---
  {
    id: "google/gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    blurb: "Google’s flagship reasoning model. Strong for deep analysis, coding, and long-context tasks.",
  },
  {
    id: "google/gemini-2.0-flash-001",
    name: "Gemini 2.0 Flash",
    blurb: "Very fast with strong quality. Good default Gemini for quick iterations and summaries.",
  },
  {
    id: "google/gemini-1.5-flash",
    name: "Gemini 1.5 Flash",
    blurb: "Fast and reliable. Good for rapid iterations and long-context tasks.",
  },

  // --- DeepSeek ---
  {
    id: "deepseek/deepseek-r1",
    name: "DeepSeek R1",
    blurb: "Strong reasoning/value. Great for problem decomposition and structured thinking.",
  },

  // --- Open models ---
  {
    id: "meta-llama/llama-3.1-70b-instruct",
    name: "Llama 3.1 70B Instruct",
    blurb: "High-quality open model. Solid for general business help when you want a non-proprietary option.",
  },

  // --- Free router ---
  {
    id: "openrouter/free",
    name: "OpenRouter Free Router",
    blurb: "Routes to currently-available free models. Useful for experimenting at $0 cost.",
    free: true,
  },
];

const chipPrompts: { label: string; prompt: string }[] = [
  {
    label: "Draft strategy memo",
    prompt:
      "Draft a concise strategy memo for a manager. Ask 3 clarifying questions first.",
  },
  { label: "Create OKRs", prompt: "Help me create OKRs for this quarter." },
  {
    label: "Prep for board meeting",
    prompt:
      "Help me prepare for a board meeting: agenda, narrative, and risks. Ask what context you need.",
  },
  {
    label: "Solve churn problem",
    prompt:
      "Help me diagnose churn and propose a 2-week action plan. Ask for missing data.",
  },
  {
    label: "Pricing review",
    prompt:
      "Help me do a pricing review and propose experiments. Ask about segments and current pricing.",
  },
  {
    label: "Write customer email",
    prompt:
      "Write a customer email. Ask about audience, tone, and goal first.",
  },
];

function useStoredKey() {
  const [key, setKey] = React.useState<string>("");
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) ?? "";
      setKey(stored);
    } finally {
      setLoaded(true);
    }
  }, []);

  const save = (next: string) => {
    const trimmed = next.trim();
    localStorage.setItem(STORAGE_KEY, trimmed);
    setKey(trimmed);
  };

  const clear = () => {
    localStorage.removeItem(STORAGE_KEY);
    setKey("");
  };

  return { key, loaded, save, clear };
}

function useStoredModel() {
  const [model, setModel] = React.useState<string>(MODEL_OPTIONS[0]?.id ?? "");

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_MODEL_KEY);
      if (stored) setModel(stored);
    } catch {
      // ignore
    }
  }, []);

  const save = (next: string) => {
    localStorage.setItem(STORAGE_MODEL_KEY, next);
    setModel(next);
  };

  return { model, save };
}

export default function Home() {
  const { key: apiKey, loaded, save, clear } = useStoredKey();
  const { model, save: saveModel } = useStoredModel();
  const [input, setInput] = React.useState("");
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [sending, setSending] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [scrollToModelOnOpen, setScrollToModelOnOpen] = React.useState(false);
  const settingsModelRef = React.useRef<HTMLDivElement | null>(null);
  const endRef = React.useRef<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();
  const { theme, setTheme } = useTheme();

  const spring = reduceMotion ? { duration: 0.01 } : SWIFTY_SPRING;
  const springSoft = reduceMotion ? { duration: 0.01 } : SWIFTY_SPRING_SOFT;

  const needsKey = loaded && !apiKey;

  React.useEffect(() => {
    if (!settingsOpen || !scrollToModelOnOpen) return;
    // Let the Sheet finish its opening animation/layout.
    const t = window.setTimeout(() => {
      settingsModelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setScrollToModelOnOpen(false);
    }, 50);
    return () => window.clearTimeout(t);
  }, [settingsOpen, scrollToModelOnOpen]);

  React.useEffect(() => {
    // Keep latest messages visible (esp. on mobile where the keyboard + sticky composer can obscure content).
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, sending]);

  async function send(userText: string) {
    const text = userText.trim();
    if (!text) return;
    if (!apiKey) {
      toast.error("Add your OpenRouter key first.");
      return;
    }

    const nextMessages: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          model,
          messages: [
            {
              role: "system",
              content:
                "You are a calm, pragmatic assistant for business managers. Ask clarifying questions when needed. Prefer actionable structure.",
            },
            ...nextMessages.map((m) => ({ role: m.role, content: m.content })),
          ],
        }),
      });

      const data = await res.json();
      const content =
        data?.choices?.[0]?.message?.content ??
        data?.choices?.[0]?.delta?.content ??
        "(No response)";

      setMessages((prev) => [...prev, { role: "assistant", content }]);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Request failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 py-6">
        {/* Top bar */}
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm font-medium tracking-tight text-foreground/90">
            Manager Assistant
          </div>

          <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm">
                ⋯
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl">
              <SheetHeader>
                <SheetTitle>Settings</SheetTitle>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">
                    Appearance
                  </div>
                  <Tabs
                    value={theme ?? "dark"}
                    onValueChange={(v) => setTheme(v)}
                  >
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="system">System</TabsTrigger>
                      <TabsTrigger value="dark">Dark</TabsTrigger>
                      <TabsTrigger value="light">Light</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                <Separator />

                <div className="space-y-3" ref={settingsModelRef}>
                  <div className="text-xs font-medium text-muted-foreground">
                    OpenRouter
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      {apiKey
                        ? `Connected (…${apiKey.slice(-4)})`
                        : "Not connected"}
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        clear();
                        toast.message("Key cleared");
                      }}
                      disabled={!apiKey}
                    >
                      Clear
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">
                      Model
                    </div>
                    <Select
                      value={model}
                      onValueChange={(v) => {
                        saveModel(v);
                        const picked = MODEL_OPTIONS.find((m) => m.id === v);
                        toast.message(
                          picked ? `Model: ${picked.name}` : "Model updated",
                        );
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a model" />
                      </SelectTrigger>
                      <SelectContent>
                        {MODEL_OPTIONS.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                            {m.free ? " (free)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="text-xs text-muted-foreground">
                      {MODEL_OPTIONS.find((m) => m.id === model)?.blurb ??
                        "Choose a model to use for replies."}
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Your key is stored only on this device.
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">Voice dictation</div>
                    <div className="text-xs text-muted-foreground">
                      MVP: UI only (wiring next).
                    </div>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Key gate */}
        <AnimatePresence>
          {needsKey ? (
            <motion.div
              key="keygate"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={springSoft}
              className="mt-8"
            >
              <Card className="p-4">
                <div className="space-y-3">
                  <div>
                    <div className="text-base font-semibold">Connect OpenRouter</div>
                    <div className="text-sm text-muted-foreground">
                      Paste your OpenRouter API key. We store it only on this device.
                    </div>
                  </div>

                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="OpenRouter API key"
                    className="min-h-[80px]"
                  />

                  <div className="flex items-center justify-between">
                    <Button
                      onClick={() => {
                        const v = input.trim();
                        if (!v) return;
                        save(v);
                        setInput("");
                        toast.success("Key saved");
                      }}
                    >
                      Continue
                    </Button>
                    <a
                      className="text-xs text-muted-foreground underline underline-offset-4"
                      href="https://openrouter.ai/keys"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Where do I get a key?
                    </a>
                  </div>
                </div>
              </Card>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Chat */}
        {!needsKey && (
          <div className="flex flex-1 min-h-0 flex-col">
            <div className="flex-1 space-y-3 overflow-y-auto py-4 pb-24">
              {messages.length === 0 ? (
                <div className="mt-10 space-y-3">
                  <div className="text-lg font-semibold tracking-tight">
                    What are you trying to accomplish?
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Pick a shortcut or ask in your own words.
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {chipPrompts.map((c) => (
                      <Button
                        key={c.label}
                        variant="secondary"
                        size="sm"
                        asChild
                      >
                        <motion.button
                          type="button"
                          onClick={() => send(c.prompt)}
                          disabled={sending}
                          whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                          whileHover={reduceMotion ? undefined : { scale: 1.01 }}
                          transition={springSoft}
                        >
                          {c.label}
                        </motion.button>
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((m, idx) => (
                    <motion.div
                      key={idx}
                      layout
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={spring}
                      className={
                        m.role === "user"
                          ? "flex justify-end"
                          : "flex justify-start"
                      }
                    >
                      <Card
                        className={
                          m.role === "user"
                            ? "max-w-[90%] bg-primary text-primary-foreground"
                            : "max-w-[90%]"
                        }
                      >
                        <div className="whitespace-pre-wrap px-4 py-3 text-sm leading-relaxed">
                          {m.content}
                        </div>
                      </Card>
                    </motion.div>
                  ))}

                  {sending ? (
                    <motion.div
                      key="typing"
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={spring}
                      className="flex justify-start"
                    >
                      <Card className="max-w-[90%]">
                        <TypingDots />
                      </Card>
                    </motion.div>
                  ) : null}

                  <div ref={endRef} />
                </>
              )}
            </div>

            <div className="sticky bottom-0 bg-background/80 pt-2 backdrop-blur pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
              <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <button
                  type="button"
                  className="underline-offset-4 hover:underline"
                  onClick={() => {
                    setScrollToModelOnOpen(true);
                    setSettingsOpen(true);
                  }}
                >
                  Model: {MODEL_OPTIONS.find((m) => m.id === model)?.name ?? model}
                </button>
                <div className="hidden sm:block">Ctrl/⌘ + Enter to send</div>
              </div>

              <div className="flex gap-1.5">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask for a plan…"
                  className="h-12 min-h-12 resize-none placeholder:whitespace-nowrap"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                />
                <Button disabled={sending} className="h-12" asChild>
                  <motion.button
                    type="button"
                    onClick={() => send(input)}
                    disabled={sending}
                    whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                    transition={springSoft}
                  >
                    {sending ? "Sending…" : "Send"}
                  </motion.button>
                </Button>
              </div>

              <div className="mt-2 hidden text-[11px] text-muted-foreground sm:block">
                Tip: Ctrl/⌘ + Enter to send.
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
