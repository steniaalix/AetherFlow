import { useState, useEffect } from "react";
import { WorkflowNode, NodeType, ExecutionLog } from "../types";
import { Trash2, Shield, Settings, Wrench, HelpCircle, Variable, CheckCircle2, XCircle } from "lucide-react";

interface Props {
  node: WorkflowNode | null;
  onUpdate: (nodeId: string, updatedConfig: Record<string, any>, updatedName: string) => void;
  onDelete: (nodeId: string) => void;
  onClose: () => void;
  lastExecutionLog: ExecutionLog | null;
}

export default function NodeConfigPanel({ node, onUpdate, onDelete, onClose, lastExecutionLog }: Props) {
  const [name, setName] = useState("");
  const [config, setConfig] = useState<Record<string, any>>({});

  useEffect(() => {
    if (node) {
      setName(node.name);
      setConfig(node.config || {});
    }
  }, [node]);

  if (!node) return null;

  const lastStep = lastExecutionLog?.steps.find((st) => st.nodeId === node.id);

  const handleFieldChange = (key: string, val: any) => {
    const updatedConfig = { ...config, [key]: val };
    setConfig(updatedConfig);
    onUpdate(node.id, updatedConfig, name);
  };

  const handleNameChange = (newName: string) => {
    setName(newName);
    onUpdate(node.id, config, newName);
  };

  const renderConfigFields = () => {
    switch (node.type) {
      case "webhook":
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Simulation Hook Path</label>
              <div className="flex gap-2 items-center bg-black/40 px-3 py-2 rounded-lg border border-white/10 backdrop-blur-md">
                <span className="text-slate-500 text-xs">/webhook</span>
                <input
                  type="text"
                  value={config.webhookPath || ""}
                  onChange={(e) => handleFieldChange("webhookPath", e.target.value)}
                  placeholder="/leads-ingress"
                  className="w-full bg-transparent text-xs text-slate-100 outline-none"
                />
              </div>
              <p className="text-[10px] text-slate-500">Trigger this automation in sandbox mode using our virtual Webhook REST client.</p>
            </div>
          </div>
        );

      case "schedule":
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Interval Rate</label>
              <select
                value={config.interval || "daily"}
                onChange={(e) => handleFieldChange("interval", e.target.value)}
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-slate-200 outline-none focus:border-cyan-400 backdrop-blur-md"
              >
                <option value="hourly" className="bg-[#0c0c0c]">Hourly (Once every 60m)</option>
                <option value="daily" className="bg-[#0c0c0c]">Daily Cron Cycle</option>
                <option value="weekly" className="bg-[#0c0c0c]">Weekly Checklist Cycle</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Trigger Run Time</label>
              <input
                type="text"
                value={config.time || "08:00 AM"}
                onChange={(e) => handleFieldChange("time", e.target.value)}
                placeholder="e.g. 08:00 AM"
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-slate-200 outline-none focus:border-cyan-400 backdrop-blur-md"
              />
            </div>
          </div>
        );

      case "prompt":
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Mock Data Inputs</label>
              <textarea
                value={config.defaultInput || ""}
                onChange={(e) => handleFieldChange("defaultInput", e.target.value)}
                placeholder="Paste mock CSV, JSON, or parameters..."
                className="w-full h-24 px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-slate-200 outline-none focus:border-cyan-400 font-mono resize-none leading-relaxed backdrop-blur-md"
              />
              <p className="text-[10px] text-slate-500">Allows pipeline triggers to start simulation passes using seed parameters instantly.</p>
            </div>
          </div>
        );

      case "click":
        return (
          <div className="space-y-4">
            <div className="p-3 bg-emerald-950/20 border border-emerald-500/15 rounded-lg text-[10px] text-emerald-300 leading-normal space-y-1">
              <span className="font-bold">⚡ Manual Click Trigger</span>
              <p>This node acts as a manual entry point. You can trigger the simulator instantly using the custom trigger button on the node card, or by clicking "Run Pipeline" above.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Custom Trigger Payload Variables (JSON)</label>
              <textarea
                value={config.payloadJson || ""}
                onChange={(e) => handleFieldChange("payloadJson", e.target.value)}
                placeholder='e.g. { "userId": 42, "status": "active" }'
                className="w-full h-24 px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-slate-200 outline-none focus:border-cyan-400 font-mono resize-none leading-relaxed backdrop-blur-md"
              />
              <p className="text-[10px] text-slate-500">Inject custom JSON fields that downstream connected actions will receive when clicked.</p>
            </div>
          </div>
        );

      case "telegram":
        return (
          <div className="space-y-4">
            <div className="p-3 bg-emerald-950/20 border border-emerald-500/15 rounded-lg text-[10px] text-emerald-300 leading-normal space-y-1">
              <span className="font-bold">Telegram Bot Trigger</span>
              <p>Use this as a Telegram webhook entry point. Bot tokens stay on the server or platform settings, not inside customer workflow cards.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Bot Username</label>
              <input
                type="text"
                value={config.botUsername || ""}
                onChange={(e) => handleFieldChange("botUsername", e.target.value)}
                placeholder="@aetherflow_bot"
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-slate-200 outline-none focus:border-cyan-400 backdrop-blur-md"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Webhook Path</label>
              <input
                type="text"
                value={config.webhookPath || "/api/telegram/webhook"}
                onChange={(e) => handleFieldChange("webhookPath", e.target.value)}
                placeholder="/api/telegram/webhook"
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-slate-200 outline-none focus:border-cyan-400 font-mono backdrop-blur-md"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Sample Incoming Message</label>
              <textarea
                value={config.sampleMessage || ""}
                onChange={(e) => handleFieldChange("sampleMessage", e.target.value)}
                placeholder="Start the workflow"
                className="w-full h-20 px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-slate-200 outline-none focus:border-cyan-400 resize-none leading-relaxed backdrop-blur-md"
              />
            </div>
          </div>
        );

      case "whatsapp":
        return (
          <div className="space-y-4">
            <div className="p-3 bg-emerald-950/20 border border-emerald-500/15 rounded-lg text-[10px] text-emerald-300 leading-normal space-y-1">
              <span className="font-bold">WhatsApp Cloud Trigger</span>
              <p>Use this as a WhatsApp Cloud API webhook entry point. Access tokens and verify tokens belong in server environment settings.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Phone Number ID</label>
              <input
                type="text"
                value={config.phoneNumberId || ""}
                onChange={(e) => handleFieldChange("phoneNumberId", e.target.value)}
                placeholder="demo-phone-number-id"
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-slate-200 outline-none focus:border-cyan-400 backdrop-blur-md"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Webhook Path</label>
              <input
                type="text"
                value={config.webhookPath || "/api/whatsapp/webhook"}
                onChange={(e) => handleFieldChange("webhookPath", e.target.value)}
                placeholder="/api/whatsapp/webhook"
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-slate-200 outline-none focus:border-cyan-400 font-mono backdrop-blur-md"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Sample Sender</label>
              <input
                type="text"
                value={config.sampleFrom || ""}
                onChange={(e) => handleFieldChange("sampleFrom", e.target.value)}
                placeholder="+15551234567"
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-slate-200 outline-none focus:border-cyan-400 backdrop-blur-md"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Sample Incoming Message</label>
              <textarea
                value={config.sampleMessage || ""}
                onChange={(e) => handleFieldChange("sampleMessage", e.target.value)}
                placeholder="Start the workflow"
                className="w-full h-20 px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-slate-200 outline-none focus:border-cyan-400 resize-none leading-relaxed backdrop-blur-md"
              />
            </div>
          </div>
        );

      case "gemini":
        return (
          <div className="space-y-4">
            <div className="p-3 bg-violet-950/20 border border-violet-500/15 rounded-lg text-[10px] text-violet-300 leading-normal">
              🔮 **AI Integration Node** uses server-side **Gemini 3.5 Flash** to translate templates into summaries. Use **[input]** to inject data from predecessor nodes.
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Content Prompt Template</label>
              <textarea
                value={config.promptTemplate || ""}
                onChange={(e) => handleFieldChange("promptTemplate", e.target.value)}
                placeholder="e.g. Critique and write a catchy caption about: [input]"
                className="w-full h-28 px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-slate-200 outline-none focus:border-violet-400 font-sans resize-none leading-relaxed backdrop-blur-md"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Temperature (Creativity)</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.1"
                  value={config.temperature || 0.7}
                  onChange={(e) => handleFieldChange("temperature", parseFloat(e.target.value))}
                  className="flex-1 accent-violet-500"
                />
                <span className="text-xs font-mono text-violet-400">{config.temperature || 0.7}</span>
              </div>
            </div>
          </div>
        );

      case "summarize":
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Max Characters Length Limit</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="50"
                  max="1000"
                  step="50"
                  value={config.maxLength || 150}
                  onChange={(e) => handleFieldChange("maxLength", parseInt(e.target.value))}
                  className="flex-1 accent-violet-500"
                />
                <span className="text-xs font-mono text-violet-400">{config.maxLength || 150}</span>
              </div>
              <p className="text-[10px] text-slate-500">Prompting AI model to condense strings into readable short form checklists.</p>
            </div>
          </div>
        );

      case "filter":
        return (
          <div className="space-y-4">
            <div className="p-3 bg-amber-950/20 border border-amber-500/15 rounded-lg text-[10px] text-amber-300 leading-normal">
              ⚖️ **Condition Logic Router** routes flow to **YES** (Success connection) or **NO** (Fail connection) branches.
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Variable Key Field</label>
              <input
                type="text"
                value={config.field || ""}
                onChange={(e) => handleFieldChange("field", e.target.value)}
                placeholder="e.g. budget, or email"
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-slate-200 outline-none focus:border-amber-400 backdrop-blur-md"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Comparison Comparator</label>
              <select
                value={config.operator || "equals"}
                onChange={(e) => handleFieldChange("operator", e.target.value)}
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-slate-200 outline-none focus:border-amber-400 backdrop-blur-md"
              >
                <option value="equals" className="bg-[#0c0c0c]">Equals (Exact comparison)</option>
                <option value="contains" className="bg-[#0c0c0c]">Contains substring match</option>
                <option value="gt" className="bg-[#0c0c0c]">Greater Than (&gt; value)</option>
                <option value="lt" className="bg-[#0c0c0c]">Less Than (&lt; value)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Match Value Criteria</label>
              <input
                type="text"
                value={config.value || ""}
                onChange={(e) => handleFieldChange("value", e.target.value)}
                placeholder="Compare target..."
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-slate-200 outline-none focus:border-amber-400 backdrop-blur-md"
              />
            </div>
          </div>
        );

      case "email":
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">To Recipient</label>
              <input
                type="email"
                value={config.to || ""}
                onChange={(e) => handleFieldChange("to", e.target.value)}
                placeholder="sales@company.com"
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-slate-200 outline-none focus:border-cyan-400 backdrop-blur-md"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Subject Title</label>
              <input
                type="text"
                value={config.subject || ""}
                onChange={(e) => handleFieldChange("subject", e.target.value)}
                placeholder="🚀 New qualified lead matched!"
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-slate-200 outline-none focus:border-cyan-400 backdrop-blur-md"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Body HTML Template</label>
              <textarea
                value={config.bodyTemplate || ""}
                onChange={(e) => handleFieldChange("bodyTemplate", e.target.value)}
                placeholder="Write message... Use [input] to inject pipeline output."
                className="w-full h-20 px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-slate-200 outline-none focus:border-cyan-400 resize-none leading-relaxed backdrop-blur-md"
              />
            </div>
          </div>
        );

      case "slack":
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Target Channel Name</label>
              <input
                type="text"
                value={config.channel || ""}
                onChange={(e) => handleFieldChange("channel", e.target.value)}
                placeholder="e.g. #ops-dashboard"
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-slate-200 outline-none focus:border-cyan-400 backdrop-blur-md"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Message Text Template</label>
              <textarea
                value={config.messageTemplate || ""}
                onChange={(e) => handleFieldChange("messageTemplate", e.target.value)}
                placeholder="Ayer Alert: [input]"
                className="w-full h-24 px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-slate-200 outline-none focus:border-cyan-400 resize-none leading-relaxed backdrop-blur-md"
              />
            </div>
          </div>
        );

      case "github":
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Repository (org/name)</label>
              <input
                type="text"
                value={config.repo || ""}
                onChange={(e) => handleFieldChange("repo", e.target.value)}
                placeholder="github-username/my-app"
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-slate-200 outline-none focus:border-cyan-400 backdrop-blur-md"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Trigger Action Type</label>
              <select
                value={config.actionType || "create_issue"}
                onChange={(e) => handleFieldChange("actionType", e.target.value)}
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-slate-200 outline-none focus:border-cyan-400 backdrop-blur-md"
              >
                <option value="create_issue" className="bg-[#0c0c0c]">Create New Issue Report</option>
                <option value="trigger_workflow" className="bg-[#0c0c0c]">Trigger GitHub Action Workflow</option>
              </select>
            </div>
          </div>
        );

      case "discord":
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Discord API Webhook URL (Optional)</label>
              <input
                type="text"
                value={config.discordUrl || ""}
                onChange={(e) => handleFieldChange("discordUrl", e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-slate-200 outline-none focus:border-cyan-400 font-mono backdrop-blur-md"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Discord Embed Template</label>
              <textarea
                value={config.contentTemplate || ""}
                onChange={(e) => handleFieldChange("contentTemplate", e.target.value)}
                placeholder="🤖 AuraFlow Logger Broadcasts: [input]"
                className="w-full h-24 px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-slate-200 outline-none focus:border-cyan-400 resize-none leading-relaxed backdrop-blur-md"
              />
            </div>
          </div>
        );

      case "http":
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">HTTP Target URL</label>
              <input
                type="text"
                value={config.url || ""}
                onChange={(e) => handleFieldChange("url", e.target.value)}
                placeholder="api.open-meteo.com/forecast"
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-slate-200 outline-none focus:border-cyan-400 font-mono backdrop-blur-md"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Request Method</label>
              <select
                value={config.method || "GET"}
                onChange={(e) => handleFieldChange("method", e.target.value)}
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-slate-200 outline-none focus:border-cyan-400 backdrop-blur-md"
              >
                <option value="GET" className="bg-[#0c0c0c]">GET Fetch JSON</option>
                <option value="POST" className="bg-[#0c0c0c]">POST Submit Body</option>
              </select>
            </div>
            {config.method === "POST" && (
              <div className="space-y-1.5 animate-fadeIn">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">POST Body Template (JSON)</label>
                <textarea
                  value={config.body || ""}
                  onChange={(e) => handleFieldChange("body", e.target.value)}
                  placeholder='{"summary": "[input]"}'
                  className="w-full h-20 px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-slate-200 outline-none focus:border-cyan-400 font-mono resize-none leading-relaxed backdrop-blur-md"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Request Headers (JSON stringified)</label>
              <input
                type="text"
                value={config.headers || ""}
                onChange={(e) => handleFieldChange("headers", e.target.value)}
                placeholder='{"Authorization": "Bearer key..."}'
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-slate-200 outline-none focus:border-cyan-400 font-mono backdrop-blur-md"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="w-80 bg-black/40 backdrop-blur-xl border-l border-white/10 flex flex-col h-full shadow-2xl relative select-none">
      {/* Header */}
      <div className="p-4 bg-black/20 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-cyan-400 animate-spin" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">Configure Node Settings</h3>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-100 transition-colors text-sm font-medium hover:bg-white/10 p-1 rounded cursor-pointer"
        >
          ✕
        </button>
      </div>

      {/* Inputs Details Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Node custom label */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Custom Node Label</label>
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="w-full px-3 py-2 bg-black/40 border border-white/10 hover:border-white/20 rounded-lg text-xs font-semibold text-slate-100 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500/10 transition-colors backdrop-blur-md"
          />
        </div>

        {/* Dynamic configurations */}
        <div className="border-t border-white/10 pt-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-4 font-semibold">
            <Wrench className="w-3.5 h-3.5" />
            <span>Parameters Mapping</span>
          </div>
          {renderConfigFields()}
        </div>

        {/* Real-time Last execution state outputs inspector */}
        {lastStep && (
          <div className="border-t border-white/10 pt-4 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-300 font-bold">
              <span className="flex h-2 w-2 relative">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${lastStep.status === "success" ? "bg-emerald-400" : "bg-rose-400"}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${lastStep.status === "success" ? "bg-emerald-500" : "bg-rose-500"}`}></span>
              </span>
              <span>Last Step Output Metrics</span>
            </div>

            <div className="bg-black/50 border border-white/10 rounded-xl p-3 space-y-3 font-mono text-[11px] backdrop-blur-md">
              <div className="flex justify-between items-center text-[10px] text-slate-400">
                <span>Status: <span className={lastStep.status === "success" ? "text-emerald-400 font-bold" : "text-rose-450 font-bold"}>{lastStep.status.toUpperCase()}</span></span>
                <span className="text-slate-500">{lastStep.duration}ms</span>
              </div>

              {lastStep.logs && (
                <div className="space-y-1">
                  <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Handshake Logs:</div>
                  <div className="text-[10px] text-slate-400 bg-black/45 p-2 rounded-lg leading-relaxed border border-white/5 max-h-24 overflow-y-auto whitespace-pre-wrap">
                    {lastStep.logs}
                  </div>
                </div>
              )}

              {lastStep.output && (
                <div className="space-y-1">
                  <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Returned Variables:</div>
                  <pre className="text-[10px] text-emerald-400 bg-black/45 p-2.5 rounded-lg overflow-x-auto max-h-48 border border-white/5 scrollbar-thin">
                    {JSON.stringify(lastStep.output, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Panel Actions */}
      <div className="p-4 bg-black/20 border-t border-white/10 flex justify-between gap-3">
        <button
          onClick={() => onDelete(node.id)}
          className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/20 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-lg text-xs font-semibold cursor-pointer transition-colors backdrop-blur-md"
        >
          Finished
        </button>
      </div>
    </div>
  );
}
