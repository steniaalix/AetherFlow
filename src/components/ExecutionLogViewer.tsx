import { useState, useEffect } from "react";
import { ExecutionLog } from "../types";
import { Terminal, ShieldAlert, CheckCircle, Clock, PlayCircle, Loader2, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { AuraDatabase } from "../lib/supabase";

interface Props {
  logs: ExecutionLog[];
  onClearLogs: () => void;
  activeLog: ExecutionLog | null;
  isRunning: boolean;
}

export default function ExecutionLogViewer({ logs, onClearLogs, activeLog, isRunning }: Props) {
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  // Auto expand newly matched active logs
  useEffect(() => {
    if (activeLog) {
      setSelectedLogId(activeLog.id);
    }
  }, [activeLog?.id]);

  // Auto expand the newly completed log when the active simulation run ends
  useEffect(() => {
    if (!activeLog && logs.length > 0) {
      setSelectedLogId(logs[0].id);
    }
  }, [activeLog, logs.length]);

  const toggleExpandLog = (id: string) => {
    setSelectedLogId(selectedLogId === id ? null : id);
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      case "failed":
        return "bg-red-500/10 text-red-500 border border-red-500/20";
      default:
        return "bg-amber-500/10 text-amber-500 border border-amber-500/20";
    }
  };

  const getNodeBadgeColor = (type: string) => {
    switch (type) {
      case "webhook":
      case "schedule":
      case "prompt":
      case "click":
      case "telegram":
      case "whatsapp":
        return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      case "gemini":
      case "summarize":
        return "bg-violet-500/10 text-violet-400 border border-violet-500/20";
      case "filter":
        return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      default:
        return "bg-sky-500/10 text-sky-400 border border-sky-500/20";
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-xl flex flex-col h-[500px]">
      {/* Header */}
      <div className="p-4 bg-black/20 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">Live Execution Logs</h3>
        </div>
        <div className="flex items-center gap-3">
          {isRunning && (
            <div className="flex items-center gap-1.5 text-[10px] text-violet-400 animate-pulse bg-violet-500/10 px-2 py-0.5 border border-violet-500/20 rounded-md">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Simulating Pipeline...</span>
            </div>
          )}
          <button
            onClick={onClearLogs}
            className="text-[10px] text-slate-400 hover:text-slate-200 hover:underline cursor-pointer"
          >
            Clear History
          </button>
        </div>
      </div>

      {/* Main Execution Log View area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-[11px] leading-relaxed">
        {/* Active execution simulation readout */}
        {isRunning && activeLog && (
          <div className="p-3.5 bg-black/40 border border-violet-500/30 rounded-lg space-y-2 pulse-rgb-glow">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                <span className="font-semibold text-slate-200">ACTIVE: {activeLog.workflowName}</span>
              </div>
              <span className="text-[9px] text-slate-500">Steps processing...</span>
            </div>

            <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
              {activeLog.steps.map((st, i) => (
                <div key={i} className="flex flex-col gap-0.5 border-l-2 border-white/10 pl-2 ml-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-400">⚡ {st.nodeName}</span>
                    <span className="text-violet-400 animate-pulse font-semibold">Running</span>
                  </div>
                  {st.logs && <div className="text-[10px] text-slate-500">{st.logs}</div>}
                </div>
              ))}
              {activeLog.steps.length === 0 && (
                <div className="text-slate-500 text-[10px] italic">Spinning up trigger node coordinates...</div>
              )}
            </div>
          </div>
        )}

        {/* Historic logs list */}
        <div className="space-y-2">
          {logs.map((log) => {
            const isExpanded = selectedLogId === log.id;
            return (
              <div
                key={log.id}
                className={`bg-black/30 border border-white/5 rounded-lg overflow-hidden transition-colors ${
                  isExpanded ? "border-white/15 bg-black/60 shadow-lg" : "hover:border-white/10"
                }`}
              >
                {/* Log Header Row */}
                <div
                  onClick={() => toggleExpandLog(log.id)}
                  className="p-3 flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2.5">
                    {log.status === "success" ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    ) : log.status === "failed" ? (
                      <XCircle className="w-3.5 h-3.5 text-red-400" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <div className="text-left font-medium text-slate-200">
                      {log.workflowName}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 text-[9px] uppercase font-semibold rounded-md ${getStatusBadgeColor(log.status)}`}>
                      {log.status}
                    </span>
                    <span className="text-[9px] text-slate-500 hidden sm:inline-block">
                      {new Date(log.startedAt).toLocaleTimeString()}
                    </span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                  </div>
                </div>

                {/* Log Details Breakdown */}
                {isExpanded && (
                  <div className="border-t border-white/5 p-3 bg-black/40 space-y-3 font-mono">
                    <div className="text-[10px] text-slate-500 flex justify-between">
                      <span>Started: {new Date(log.startedAt).toLocaleString()}</span>
                      <span>Run Time: {Math.max(1, Math.round((new Date(log.endedAt).getTime() - new Date(log.startedAt).getTime())))}ms</span>
                    </div>

                    <div className="space-y-2 border-l border-white/5 pl-3 ml-1.5 font-mono">
                      {log.steps.map((st, i) => (
                        <div key={i} className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <span className={`px-1.5 py-0.2 text-[8px] uppercase tracking-wider font-semibold rounded-md ${getNodeBadgeColor(st.nodeType)}`}>
                                {st.nodeType}
                              </span>
                              <span className="text-slate-300 font-semibold">{st.nodeName}</span>
                            </div>
                            <span className={st.status === "success" ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
                              {st.status === "success" ? "PASS" : "FAIL"} ({st.duration}ms)
                            </span>
                          </div>

                          {st.logs && (
                            <div className="p-2 bg-black/50 border border-white/5 rounded text-[10px] text-slate-400 whitespace-pre-wrap leading-relaxed max-h-[140px] overflow-y-auto font-mono">
                              {st.logs}
                            </div>
                          )}

                          {st.output && (
                            <div className="p-2 bg-black/50 border border-white/5 rounded text-[10px] text-emerald-400/95 overflow-x-auto max-h-[140px] font-mono">
                              <span className="text-[8px] uppercase tracking-wider font-semibold text-slate-500 block mb-1">DATA CHANNELS RETURNED:</span>
                              <pre className="font-mono text-[9px]">{JSON.stringify(st.output, null, 2)}</pre>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {logs.length === 0 && !isRunning && (
            <div className="py-24 text-center border-2 border-dashed border-white/5 rounded-xl">
              <Terminal className="w-8 h-8 text-slate-600 mx-auto opacity-40 mb-3" />
              <p className="text-slate-400 font-semibold">No simulation metrics logged yet</p>
              <p className="text-[10px] text-slate-600 mt-1 max-w-[280px] mx-auto">Click 'Execute Pipeline' in the top-right of your builder canvas to capture logs.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
