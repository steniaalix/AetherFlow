import React, { useState } from "react";
import { Sparkles, Terminal, ArrowRight, Lightbulb, RefreshCw } from "lucide-react";
import { Workflow } from "../types";

interface Props {
  onGenerate: (wf: Workflow) => void;
}

const PRESET_IDEAS = [
  {
    title: "Slack Weather Bot",
    desc: "Fetch temperature details, summarize with AI, and alert Slack.",
    prompt: "A daily morning trigger that fetches weather data from open-meteo, uses Gemini to summarize it concisely, and posts a lovely morning forecast to my #general Slack channel.",
  },
  {
    title: "Lead Qualifying Funnel",
    desc: "Test webhook budget inputs and email matching hot leads.",
    prompt: "An inbound webhook receiver that processes hot leads. Use a filter rule to test if the lead budget is greater than 5000. If yes, send an email to high-value-sales@corp.com telling them to immediately close. If no, log it to Discord.",
  },
  {
    title: "GitHub Commit Transceiver",
    desc: "Check github commits and log to Discord.",
    prompt: "A schedule trigger that polls my newest GitHub edits hourly, does Gemini sentiment review on changes, and posts formatted release logs into a Discord webhook channel.",
  },
];

export default function AIPromptBuilder({ onGenerate }: Props) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/workflow/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to compile prompt with design engine.");
      }

      // Append temporary workflow ID
      const generatedWorkflow: Workflow = {
        ...data,
        id: "wf_gen_" + Math.random().toString(36).substring(2, 9),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
      };

      onGenerate(generatedWorkflow);
      setPrompt("");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during generative building.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-xl ${loading ? "pulse-rgb-glow" : ""}`}>
      {/* Container header */}
      <div className="p-4 bg-black/20 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">Generate Pipeline with IA Copilot</h3>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping"></span>
          <span className="text-[10px] text-slate-400">Gemini 3.5 Core Engine Ready</span>
        </div>
      </div>

      <div className="p-5 space-y-5">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={loading}
              placeholder="Describe your automation in plain English (e.g., 'Receive lead details on a webhook, use AI to filter out budgets under $10,000, and alert Discord...')"
              className="w-full h-24 p-3 bg-black/40 hover:bg-black/60 border border-white/10 rounded-lg text-xs leading-relaxed outline-none text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20 disabled:opacity-60 resize-none transition-all duration-200 backdrop-blur-md"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 flex items-start gap-2">
              <span className="font-semibold block shrink-0 mt-0.5">⚠ Error:</span>
              <p className="leading-normal">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <div className="text-[10px] text-slate-500 flex items-center gap-1">
              <Terminal className="w-3.5 h-3.5" />
              <span>Prompt prompts the AI to map layout, configure nodes, and link outputs automatically.</span>
            </div>
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="px-4 py-2 bg-gradient-to-r from-cyan-400 to-fuchsia-600 hover:opacity-90 text-white text-xs font-semibold rounded-lg shadow-lg shadow-cyan-500/5 hover:shadow-cyan-400/10 cursor-pointer flex items-center gap-1.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed select-none"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Generating Nodes...
                </>
              ) : (
                <>
                  Build Workflow
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Suggestion presets */}
        <div className="space-y-2">
          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
            <span>Select a Preset Automation Concept</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {PRESET_IDEAS.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setPrompt(item.prompt)}
                disabled={loading}
                className="p-3 text-left bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-lg transition-all duration-200 cursor-pointer text-xs group backdrop-blur-sm"
              >
                <div className="font-semibold text-slate-200 group-hover:text-cyan-400 transition-colors">
                  {item.title}
                </div>
                <div className="text-[10px] text-slate-500 leading-relaxed mt-1">
                  {item.desc}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
