import React, { useState } from "react";
import { Sparkles, ArrowRight, RefreshCw } from "lucide-react";
import { Workflow } from "../types";

interface Props {
  onGenerate: (wf: Workflow) => void;
}

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
              placeholder="Describe your automation in plain English (e.g., 'When a Telegram or WhatsApp message arrives, use AI to summarize it and alert Discord...')"
              className="w-full h-24 p-3 bg-black/40 hover:bg-black/60 border border-white/10 rounded-lg text-xs leading-relaxed outline-none text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20 disabled:opacity-60 resize-none transition-all duration-200 backdrop-blur-md"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 flex items-start gap-2">
              <span className="font-semibold block shrink-0 mt-0.5">⚠ Error:</span>
              <p className="leading-normal">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-4">
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
      </div>
    </div>
  );
}
