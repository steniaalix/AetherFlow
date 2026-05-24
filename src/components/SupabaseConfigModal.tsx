import { useState, useEffect } from "react";
import { AuraDatabase, SUPABASE_SQL_SCHEMA } from "../lib/supabase";
import { Copy, Check, Server, Eye, EyeOff, ShieldCheck, Database, HelpCircle } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function SupabaseConfigModal({ isOpen, onClose }: Props) {
  const [url, setUrl] = useState("");
  const [anonKey, setAnonKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"credentials" | "instructions">("credentials");

  const config = AuraDatabase.getConfig();

  useEffect(() => {
    if (isOpen) {
      setUrl(config.supabaseUrl);
      setAnonKey(config.supabaseAnonKey);
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    AuraDatabase.saveCredentials(url, anonKey);
    onClose();
  };

  const handleClear = () => {
    setUrl("");
    setAnonKey("");
    AuraDatabase.saveCredentials("", "");
    setTestResult({ success: true, msg: "Credentials cleared. Switched back to LocalState database mode." });
  };

  const handleTest = async () => {
    if (!url || !anonKey) {
      setTestResult({ success: false, msg: "Both URL and Anon Key are required to run verification checks." });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const isOk = await AuraDatabase.testConnection(url, anonKey);
      if (isOk) {
        setTestResult({
          success: true,
          msg: "Ping successful! Connected state confirmed. Ensure you have run the schema script in your Supabase SQL editor.",
        });
      } else {
        setTestResult({
          success: false,
          msg: "Connection could not be verified. Confirm your Supabase credentials, OR make sure network access is allowed.",
        });
      }
    } catch (err: any) {
      setTestResult({ success: false, msg: `Verification caught exception: ${err?.message || err}` });
    } finally {
      setTesting(false);
    }
  };

  const handleCopySchema = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="supabase-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-md p-4 animate-fadeIn">
      <div className="w-full max-w-2xl bg-black/45 backdrop-blur-2xl border border-white/10 rounded-xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-black/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Supabase Backend Engine</h2>
              <p className="text-xs text-slate-400">Sync with your cloud database and enable auth states</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 transition-colors cursor-pointer text-sm p-1.5 hover:bg-white/10 rounded-md"
          >
            ✕
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-white/10 bg-black/15 font-medium">
          <button
            onClick={() => setActiveTab("credentials")}
            className={`flex-1 py-3 text-center text-sm border-b-2 transition-colors ${
              activeTab === "credentials"
                ? "border-emerald-400 text-emerald-405 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            🔑 Credentials Config
          </button>
          <button
            onClick={() => setActiveTab("instructions")}
            className={`flex-1 py-3 text-center text-sm border-b-2 transition-colors ${
              activeTab === "instructions"
                ? "border-emerald-400 text-emerald-405 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            📋 Provision SQL Schema
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto max-h-[60vh] text-slate-300 space-y-4">
          {activeTab === "credentials" ? (
            <div className="space-y-4">
              <div className="p-3.5 bg-black/40 border border-white/5 rounded-lg flex items-start gap-3 backdrop-blur-md">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <span className="font-semibold text-slate-200">How AuraFlow connects:</span>
                  <p className="text-slate-400/90">
                    Entering details connects this sandbox straight to your personal Supabase instance.
                    Leave blank to seamlessly run in **Local Persistence Mode** (using client-side localStorage tables).
                  </p>
                </div>
              </div>

              {/* URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Supabase Project URL</label>
                <div className="relative">
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://your-project.supabase.co"
                    className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-lg outline-none text-slate-200 text-sm focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/10 transition-colors backdrop-blur-md"
                  />
                </div>
              </div>

              {/* Key */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Supabase Anon Key</label>
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    value={anonKey}
                    onChange={(e) => setAnonKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsIn..."
                    className="w-full pl-4 pr-10 py-2.5 bg-black/40 border border-white/10 rounded-lg outline-none text-slate-200 text-sm focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/10 transition-colors font-mono backdrop-blur-md"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-3.5 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Check results */}
              {testResult && (
                <div
                  className={`p-3 border rounded-lg text-xs flex gap-2.5 ${
                    testResult.success
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                      : "bg-red-500/10 border-red-500/20 text-red-400"
                  }`}
                >
                  <span className="font-semibold">{testResult.success ? "✓" : "⚠"}</span>
                  <p>{testResult.msg}</p>
                </div>
              )}

              {/* Actions Grid */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleTest}
                  disabled={testing}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-slate-200 text-center font-semibold transition-all disabled:opacity-50 cursor-pointer backdrop-blur-md"
                >
                  {testing ? "Testing Connection..." : "⚡ Test Connection"}
                </button>
                <button
                  onClick={handleClear}
                  className="px-4 py-2.5 bg-rose-500/5 hover:bg-rose-500/15 border border-rose-500/15 text-rose-400 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Clear Config
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3.5 bg-black/40 border border-white/5 rounded-lg flex items-start gap-3 backdrop-blur-md">
                <HelpCircle className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <span className="font-semibold text-slate-200">Database Schema Setup:</span>
                  <p className="text-slate-400">
                    To make workflows store and load correctly in your cloud Supabase database, copy this code and execute it inside your Project's **SQL Editor** portal in Supabase.
                  </p>
                </div>
              </div>

              <div className="relative">
                <pre className="p-4 bg-black/40 border border-white/10 rounded-lg font-mono text-[10px] text-emerald-400/90 leading-relaxed overflow-x-auto max-h-[300px] backdrop-blur-md">
                  {SUPABASE_SQL_SCHEMA}
                </pre>
                <button
                  onClick={handleCopySchema}
                  className="absolute right-3 top-3 px-3 py-1.5 bg-black/50 border border-white/10 hover:border-white/25 rounded-md text-[10px] font-medium text-slate-300 flex items-center gap-1.5 hover:bg-white/10 hover:text-white cursor-pointer transition-colors backdrop-blur-md"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied!" : "Copy SQL Script"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-black/20 border-t border-white/10 flex justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[11px] text-slate-400 font-mono">
              ACTIVE NODE: {config.isConfigured ? "🛰️ cloud:supabase" : "💻 local:localStorage"}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 bg-gradient-to-r from-cyan-400 to-fuchsia-600 hover:opacity-95 text-white rounded-lg text-xs font-bold cursor-pointer shadow-lg shadow-cyan-500/10 transition-all duration-300"
            >
              Save Credentials & Connect
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
