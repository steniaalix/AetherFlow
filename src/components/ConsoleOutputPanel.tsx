import { useState, useEffect } from "react";
import { ExecutionLog } from "../types";
import { Terminal, ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock, Copy, Sparkles, Server, HelpCircle, ArrowRight } from "lucide-react";

interface Props {
  logs: ExecutionLog[];
  activeLog: ExecutionLog | null;
  isRunning: boolean;
}

export default function ConsoleOutputPanel({ logs, activeLog, isRunning }: Props) {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"outputs" | "logs" | "payload">("outputs");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const latestLog = activeLog || logs[0];

  // Auto-expand when a run triggers or completes
  useEffect(() => {
    if (isRunning || latestLog) {
      setIsOpen(true);
    }
  }, [isRunning, latestLog?.id]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const getStatusTextColor = (status: string) => {
    if (status === "success") return "text-emerald-400";
    if (status === "failed") return "text-rose-400";
    return "text-cyan-400";
  };

  // Extract the critical "output message" or "answers" from nodes (e.g. Gemini response, summarizing text, slack posts)
  const extractKeyOutputs = (log: ExecutionLog) => {
    const results: Array<{ name: string; type: string; message: string; output?: any }> = [];
    
    log.steps.forEach((step) => {
      let msg = "";
      let hasData = false;

      // Extract context-specific useful response text Based on Node Types
      if (step.nodeType === "gemini" || step.nodeType === "summarize" || step.nodeType === "prompt") {
        if (typeof step.output === "string") {
          msg = step.output;
        } else if (step.output && typeof step.output.response === "string") {
          msg = step.output.response;
        } else if (step.output && typeof step.output.text === "string") {
          msg = step.output.text;
        } else if (step.output && step.output.summary) {
          msg = typeof step.output.summary === "string" ? step.output.summary : JSON.stringify(step.output.summary);
        } else if (step.output && step.output.prompt) {
          msg = `Prompt seeded: "${step.output.prompt}"`;
        }
      } else if (step.nodeType === "email") {
        msg = `Sent email to: ${step.output?.sentTo || "recipient"}. Preview subject: "${step.output?.subject || "No Subject"}"`;
      } else if (step.nodeType === "slack" || step.nodeType === "discord") {
        msg = `Pushed active JSON channel broadcast embed. Result content: "${step.output?.sentMessage || "Success payload"}"`;
      } else if (step.nodeType === "webhook") {
        msg = `Payload received through hook channel path "${step.output?.path || "/leads-ingress"}"`;
      } else if (step.nodeType === "telegram") {
        msg = `Telegram message received from ${step.output?.from || step.output?.chatId || "demo chat"}: "${step.output?.message || "Start workflow"}"`;
      } else if (step.nodeType === "whatsapp") {
        msg = `WhatsApp message received from ${step.output?.from || "demo contact"}: "${step.output?.message || "Start workflow"}"`;
      } else if (step.nodeType === "filter") {
        const cond = step.output?.meetsCondition;
        msg = `Conditional comparison criteria. Routed pathway: ${cond ? "🟢 YES branch" : "🔴 NO branch"} (Result key was: ${JSON.stringify(cond)})`;
      } else {
        // Generic HTTP or actions
        if (step.output && step.output.message) {
          msg = step.output.message;
        } else if (step.output && step.output.status) {
          msg = `API Response status code: ${step.output.status}. Payload: ${JSON.stringify(step.output.data || step.output)}`;
        }
      }

      if (msg || step.output) {
        results.push({
          name: step.nodeName,
          type: step.nodeType,
          message: msg || "",
          output: step.output
        });
      }
    });

    return results;
  };

  const keyOutputs = latestLog ? extractKeyOutputs(latestLog) : [];

  return (
    <div 
      id="live-console-output-window"
      className={`border-t border-white/10 bg-[#07070a]/95 backdrop-blur-2xl transition-all duration-300 flex flex-col z-20 shrink-0 ${
        isOpen ? "h-64 md:h-80" : "h-10"
      }`}
    >
      {/* Console Header Bar */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="px-6 py-2.5 bg-black/40 border-b border-white/5 flex items-center justify-between cursor-pointer select-none font-sans"
      >
        <div className="flex items-center gap-3">
          <Terminal className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span className="text-[11px] font-bold tracking-wider text-slate-300 uppercase flex items-center gap-1.5">
            Console Simulation Output
            <span className="text-[9px] px-1.5 py-0.5 bg-white/5 text-slate-400 rounded border border-white/10 font-normal normal-case">
              realtime
            </span>
          </span>

          {/* Running light or status strip */}
          <div className="hidden md:flex items-center gap-2 text-[10px] pl-4 border-l border-white/10">
            {isRunning ? (
              <span className="flex items-center gap-1 text-violet-400 animate-pulse font-mono">
                <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-ping" />
                Pipeline simulation executing live...
              </span>
            ) : latestLog ? (
              <span className={`flex items-center gap-1.5 font-mono ${latestLog.status === "success" ? "text-emerald-400" : "text-rose-400"}`}>
                {latestLog.status === "success" ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <XCircle className="w-3.5 h-3.5" />
                )}
                Last Run: {latestLog.status.toUpperCase()} ({Math.max(1, Math.round((new Date(latestLog.endedAt).getTime() - new Date(latestLog.startedAt).getTime())))}ms)
              </span>
            ) : (
              <span className="text-slate-500 font-mono">Console Idle. Click 'Execute Pipeline' in the top right to analyze outputs.</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-slate-400 hover:text-slate-200 transition-colors" />
          ) : (
            <div className="flex items-center gap-2">
              {latestLog && (
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${latestLog.status === "success" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                  {latestLog.status}
                </span>
              )}
              <ChevronUp className="w-4 h-4 text-slate-400 hover:text-slate-200 transition-colors" />
            </div>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-white/10 overflow-hidden font-mono text-xs">
          {/* Main Console Work Area */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Tabs */}
            <div className="px-5 py-1.5 bg-black/25 border-b border-white/5 flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-widest shrink-0 select-none">
              <div className="flex gap-4">
                <button
                  onClick={() => setActiveTab("outputs")}
                  className={`py-1 cursor-pointer transition-colors border-b-2 font-bold ${
                    activeTab === "outputs" ? "border-cyan-400 text-cyan-400 font-extrabold" : "border-transparent text-slate-450 hover:text-slate-200"
                  }`}
                >
                  ✨ Output Messages
                </button>
                <button
                  onClick={() => setActiveTab("payload")}
                  className={`py-1 cursor-pointer transition-colors border-b-2 font-bold ${
                    activeTab === "payload" ? "border-cyan-400 text-cyan-400 font-extrabold" : "border-transparent text-slate-450 hover:text-slate-200"
                  }`}
                >
                  📡 Returned Payloads (JSON)
                </button>
                <button
                  onClick={() => setActiveTab("logs")}
                  className={`py-1 cursor-pointer transition-colors border-b-2 font-bold ${
                    activeTab === "logs" ? "border-cyan-400 text-cyan-400 font-extrabold" : "border-transparent text-slate-450 hover:text-slate-200"
                  }`}
                >
                  📜 Integration Raw Logs
                </button>
              </div>

              {latestLog && (
                <span className="text-slate-500 text-[9px]">
                  Pipeline: {latestLog.workflowName}
                </span>
              )}
            </div>

            {/* Tab Feed Content */}
            <div className="flex-1 p-5 overflow-y-auto bg-black/20 leading-relaxed font-mono text-[11px] text-slate-300">
              {isRunning && !activeLog ? (
                <div className="flex flex-col items-center justify-center h-full gap-2.5 text-slate-500 py-6">
                  <div className="flex items-center gap-2 text-violet-400 animate-pulse font-bold text-xs uppercase tracking-wider">
                    <span className="w-2 h-2 bg-violet-400 rounded-full animate-ping" />
                    Simulating system operations
                  </div>
                  <p className="text-[10px] text-slate-500 max-w-sm text-center">Spawning server virtualizations, validating sandbox authorization keys, and evaluating prompt integrations...</p>
                </div>
              ) : !latestLog ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 py-12">
                  <Terminal className="w-8 h-8 text-slate-700 mb-2 opacity-50" />
                  <p className="font-bold text-xs uppercase tracking-wider text-slate-400">No output messages gathered yet</p>
                  <p className="text-[10px] text-slate-600 mt-1">Double click canvas to add nodes, link flow wires, and click "Execute Pipeline" to view real outputs!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Tab 1: Output Messages */}
                  {activeTab === "outputs" && (
                    <div className="space-y-3">
                      {keyOutputs.length === 0 ? (
                        <div className="text-slate-500 italic p-2 text-center">No step outputs captured. Ensure nodes are active and reachable.</div>
                      ) : (
                        keyOutputs.map((item, idx) => (
                          <div 
                            key={idx} 
                            className="bg-black/30 border border-white/5 rounded-xl p-3.5 space-y-2 relative group hover:border-white/10 transition-all font-mono"
                          >
                            <div className="flex items-center justify-between border-b border-white/5 pb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-500 font-bold">#{idx + 1}</span>
                                <span className="font-extrabold text-slate-200">{item.name}</span>
                                <span className="px-1.5 py-0.2 bg-white/5 text-[9px] uppercase text-slate-400 font-semibold rounded border border-white/10 font-sans">
                                  {item.type}
                                </span>
                              </div>
                              {item.message && (
                                <button
                                  onClick={() => handleCopy(item.message, `key-${idx}`)}
                                  className="opacity-0 group-hover:opacity-100 p-1 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 rounded transition-all cursor-pointer"
                                  title="Copy Output Message"
                                >
                                  {copiedId === `key-${idx}` ? "Copied!" : <Copy className="w-3 h-3" />}
                                </button>
                              )}
                            </div>

                            {item.message ? (
                              <div className="text-slate-300 font-mono whitespace-pre-wrap leading-relaxed select-text bg-[#030306] p-3 rounded-lg border border-white/5 text-[11px] max-h-48 overflow-y-auto">
                                {item.message}
                              </div>
                            ) : (
                              <div className="text-slate-500 italic text-[10px]">Step completed with data, but no explicit text message returned. Check Returned Payloads.</div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Tab 2: Returned Payloads */}
                  {activeTab === "payload" && (
                    <div className="space-y-3.5">
                      {latestLog.steps.map((st, idx) => (
                        <div key={idx} className="bg-[#030306] border border-white/5 rounded-xl p-3.5 space-y-2 font-mono">
                          <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                            <span className="font-extrabold text-slate-200">{st.nodeName} <span className="text-slate-500 text-[10px] font-normal font-sans">({st.nodeType})</span></span>
                            <span className="text-[10px] text-emerald-400 font-bold">RAW PAYLOAD</span>
                          </div>
                          {st.output ? (
                            <pre className="text-emerald-400 leading-relaxed text-[11px] overflow-x-auto max-h-48 scrollbar-thin scrollbar-thumb-white/10">
                              {JSON.stringify(st.output, null, 2)}
                            </pre>
                          ) : (
                            <div className="text-slate-500 italic text-[10px]">No payload data returned.</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tab 3: Integration Raw Logs */}
                  {activeTab === "logs" && (
                    <div className="space-y-2 p-1 font-mono text-slate-400 text-[11px] leading-relaxed select-text">
                      {latestLog.steps.map((st, idx) => (
                        <div key={idx} className="border-l-2 border-emerald-500/30 pl-3 py-1 space-y-1 bg-white/[0.01] p-2 rounded">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-200">
                              [SYS-{st.nodeType.toUpperCase()}] {st.nodeName}
                            </span>
                            <span className={st.status === "success" ? "text-emerald-400 font-bold" : "text-rose-450 font-bold"}>
                              {st.status.toUpperCase()} ({st.duration}ms)
                            </span>
                          </div>
                          <div className="text-slate-350 bg-[#030306] p-2.5 rounded border border-white/5 mt-1 leading-normal text-[10px]">
                            {st.logs || "Step validated. Execution handshake finished without specific console markers."}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats sidebar (Right side inside the console) */}
          <div className="hidden md:block w-52 p-4 bg-black/40 text-slate-400 font-mono text-[10px] space-y-4.5 shrink-0">
            <div className="space-y-1">
              <span className="uppercase tracking-wider font-extrabold text-slate-500 block">SYSTEM STATUS</span>
              <div className="flex items-center gap-1.5 font-bold text-slate-200">
                <Server className="w-3.5 h-3.5 text-cyan-400" />
                <span>Sandbox Active</span>
              </div>
            </div>

            {latestLog && (
              <div className="space-y-3">
                <div className="space-y-1 border-t border-white/5 pt-3">
                  <span className="uppercase tracking-wider font-extrabold text-slate-500 block">EVAL STATISTICS</span>
                  <div className="space-y-1 text-slate-300 font-mono">
                    <div>Steps count: <strong className="text-slate-100">{latestLog.steps.length}</strong></div>
                    <div>Overall time: <strong className="text-cyan-400">{Math.max(1, Math.round((new Date(latestLog.endedAt).getTime() - new Date(latestLog.startedAt).getTime())))}ms</strong></div>
                    <div>Outcome: <strong className={getStatusTextColor(latestLog.status)}>{latestLog.status.toUpperCase()}</strong></div>
                  </div>
                </div>

                <div className="space-y-1.5 border-t border-white/5 pt-3">
                  <span className="uppercase tracking-wider font-extrabold text-slate-500 block">INTEGRATION TRACE</span>
                  <div className="flex flex-col gap-1 max-h-24 overflow-y-auto scrollbar-none">
                    {latestLog.steps.map((st, i) => (
                      <div key={i} className="flex items-center gap-1 text-[9px] text-slate-405 truncate">
                        <ArrowRight className="w-2.5 h-2.5 text-cyan-500 shrink-0" />
                        <span className="truncate">{st.nodeName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="p-2 bg-white/[0.02] border border-white/5 rounded-lg space-y-1">
              <div className="flex items-center gap-1 text-cyan-400 font-bold">
                <HelpCircle className="w-3 h-3" />
                <span>Mapping tip</span>
              </div>
              <p className="text-[9px] leading-tight text-slate-500">
                Use <code className="text-cyan-400 font-bold font-mono">[input]</code> keyword downstream to feed results forward.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
