import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Workflow, WorkflowNode, WorkflowConnection, ExecutionLog, UserSession, AccountRole } from "./types";
import { AuraDatabase } from "./lib/supabase";
import FlowCanvas from "./components/FlowCanvas";
import NodeConfigPanel from "./components/NodeConfigPanel";
import AIPromptBuilder from "./components/AIPromptBuilder";
import ExecutionLogViewer from "./components/ExecutionLogViewer";
import ConsoleOutputPanel from "./components/ConsoleOutputPanel";

import {
  Workflow as WorkflowIcon,
  Play,
  Save,
  Plus,
  Trash2,
  Terminal,
  Activity,
  User,
  LogOut,
  HelpCircle,
  Clock,
  LayoutGrid,
  Sparkles,
  Zap,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  X,
  Send,
  Loader2,
  Menu,
  ShieldCheck,
  Users
} from "lucide-react";

const DEFAULT_SESSION: UserSession = { email: null, id: null, isAuthenticated: false, accountRole: "customer" };

export default function App() {
  // Session & Authentication states
  const [session, setSession] = useState<UserSession>(DEFAULT_SESSION);
  const [authEmail, setAuthEmail] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [showAuthTab, setShowAuthTab] = useState<"signin" | "signup">("signin");
  const [authRole, setAuthRole] = useState<AccountRole>("worker");

  // Workflows states
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);

  // Execution logs state
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [activeLog, setActiveLog] = useState<ExecutionLog | null>(null);
  const [completedLogModal, setCompletedLogModal] = useState<ExecutionLog | null>(null);
  const [isRunningSim, setIsRunningSim] = useState(false);
  const [activeExecutingNodeId, setActiveExecutingNodeId] = useState<string | null>(null);

  // Chatbot State for aura guide
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([
    {
      role: "assistant",
      content: "Hello! I am Aura, your visual workflow guide. I can answer all your questions and teach you on how to use this website! \n\nFeel free to ask me about:\n- **How to double-click the canvas** to place custom preset nodes.\n- **How to link flow wires** (connections) between node borders.\n- **How to delete a node** instantly with the trash button or key triggers.\n- **How to use '[input]'** to map preceding results into AI prompt parameters."
    }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatBottomRef = React.useRef<HTMLDivElement>(null);

  // Auto scroll chat list to bottom
  useEffect(() => {
    if (showChat) {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, showChat]);

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage = { role: "user" as const, content: chatInput };
    const updatedMessages = [...chatMessages, userMessage];
    setChatMessages(updatedMessages);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages }),
      });
      const data = await resp.json();
      if (data.reply) {
        setChatMessages([...updatedMessages, { role: "assistant" as const, content: data.reply }]);
      } else {
        setChatMessages([...updatedMessages, { role: "assistant" as const, content: "I'm sorry, I couldn't generate a guide. Let's try again!" }]);
      }
    } catch (err: any) {
      setChatMessages([...updatedMessages, { role: "assistant" as const, content: `Error matching reply: ${err.message}` }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Dynamic notification/banners
  const [statusBanner, setStatusBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 1. Ingest initial database configurations and collections
  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    fetchWorkflowsAndLogs();
  }, [session.isAuthenticated]);

  const checkSession = async () => {
    const active = await AuraDatabase.getCurrentSession();
    setSession(active);
  };

  const fetchWorkflowsAndLogs = async () => {
    try {
      const wfList = await AuraDatabase.getWorkflows();
      setWorkflows(wfList);
      if (wfList.length > 0 && !activeWorkflow) {
        setActiveWorkflow(wfList[0]);
      }

      const logList = await AuraDatabase.getExecutionLogs();
      setLogs(logList);
    } catch (err) {
      console.error("Failed to query collections:", err);
    }
  };

  const showBanner = (type: "success" | "error", text: string) => {
    setStatusBanner({ type, text });
    setTimeout(() => setStatusBanner(null), 4000);
  };

  const recordActivity = (action: string, message: string, metadata: Record<string, any> = {}) => {
    void AuraDatabase.saveActivityLog(action, message, metadata).catch((err: any) => {
      console.warn("Activity log was not saved:", err);
    });
  };

  // 2. Authentication handlers
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPass) {
      setAuthError("Email and Password are required fields.");
      return;
    }
    setLoadingAuth(true);
    setAuthError(null);

    try {
      let res;
      if (showAuthTab === "signup") {
        res = await AuraDatabase.signUp(authEmail, authPass, authRole);
      } else {
        res = await AuraDatabase.signIn(authEmail, authPass, authRole);
      }

      if (res.success) {
        const nextSession = res.session || res.user || { email: authEmail, id: null, isAuthenticated: true, accountRole: authRole };
        if (nextSession.isAuthenticated) {
          const resolvedSession = { ...nextSession, accountRole: nextSession.accountRole || authRole };
          showBanner("success", `Signed in to ${resolvedSession.accountRole === "worker" ? "worker" : "customer"} workspace as ${resolvedSession.email || authEmail}`);
          setSession(resolvedSession);
          recordActivity(
            showAuthTab === "signup" ? "auth.signup" : "auth.signin",
            showAuthTab === "signup" ? "User created an account." : "User signed in.",
            { email: resolvedSession.email, accountRole: resolvedSession.accountRole }
          );
        } else if (nextSession.needsEmailConfirmation) {
          showBanner("success", "Account created. Confirm your email before signing in.");
          setShowAuthTab("signin");
        } else {
          setAuthError("Account created, but no active session was returned. Try signing in again.");
        }
        // Clear params
        setAuthEmail("");
        setAuthPass("");
      } else {
        setAuthError(res.error || "Authentication check failed.");
      }
    } catch (err: any) {
      setAuthError(err?.message || "An exception occurred during authentication.");
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleSignOut = async () => {
    recordActivity("auth.signout", "User signed out.", { email: session.email });
    await AuraDatabase.signOut();
    setSession(DEFAULT_SESSION);
    setActiveWorkflow(null);
    showBanner("success", "Logged out. Switched back to public guest profile.");
  };

  // 3. Workflow Management
  const handleSelectWorkflow = (wfId: string) => {
    const found = workflows.find((w) => w.id === wfId);
    if (found) {
      setActiveWorkflow(found);
      setSelectedNodeId(null);
    }
  };

  const handleRenameActiveWorkflow = (name: string) => {
    if (!activeWorkflow) return;

    const nextWorkflow = {
      ...activeWorkflow,
      name,
      updatedAt: new Date().toISOString(),
    };

    setActiveWorkflow(nextWorkflow);
    setWorkflows((current) =>
      current.map((workflow) => (workflow.id === nextWorkflow.id ? nextWorkflow : workflow))
    );
  };

  const handleCreateNewWorkflow = () => {
    const newWf: Workflow = {
      id: "wf_temp_" + Math.random().toString(36).substring(2, 6),
      name: "New Custom Pipeline",
      description: "Customize this visual pipeline using double clicks to introduce AI, HTTP and Webhook tools.",
      nodes: [
        {
          id: "node_start",
          type: "prompt",
          name: "Start Trigger",
          x: 100,
          y: 200,
          config: { defaultInput: "Workflow triggered manually." }
        }
      ],
      connections: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setWorkflows((prev) => [newWf, ...prev]);
    setActiveWorkflow(newWf);
    setSelectedNodeId(null);
    recordActivity("workflow.create", `Created workflow "${newWf.name}".`, {
      workflowId: newWf.id,
      workflowName: newWf.name,
    });
    showBanner("success", "Spawned an empty design automation canvas.");
  };

  const handleSaveActiveWorkflow = async () => {
    if (!activeWorkflow) return;
    try {
      const saved = await AuraDatabase.saveWorkflow(activeWorkflow);
      // Update cached lists
      setWorkflows((prev) => [saved, ...prev.filter((w) => w.id !== activeWorkflow.id)]);
      setActiveWorkflow(saved);
      recordActivity("workflow.save", `Saved workflow "${saved.name}".`, {
        workflowId: saved.id,
        workflowName: saved.name,
      });
      showBanner("success", `Pipeline "${saved.name}" stored to database.`);
    } catch (err: any) {
      showBanner("error", `Failed to save workflow state: ${err.message || err}`);
    }
  };

  const handleDeleteWorkflow = async () => {
    if (!activeWorkflow) return;
    if (confirm(`Are you sure you want to delete "${activeWorkflow.name}"?`)) {
      const deletedWorkflow = activeWorkflow;
      await AuraDatabase.deleteWorkflow(activeWorkflow.id);
      const filtered = workflows.filter((w) => w.id !== activeWorkflow.id);
      setWorkflows(filtered);
      if (filtered.length > 0) {
        setActiveWorkflow(filtered[0]);
      } else {
        setActiveWorkflow(null);
      }
      setSelectedNodeId(null);
      recordActivity("workflow.delete", `Deleted workflow "${deletedWorkflow.name}".`, {
        workflowId: deletedWorkflow.id,
        workflowName: deletedWorkflow.name,
      });
      showBanner("success", "Removed workflow file from database registry.");
    }
  };

  const handleUpdateActiveNodes = useCallback((newNodes: WorkflowNode[]) => {
    setActiveWorkflow((current) => current ? { ...current, nodes: newNodes } : current);
  }, []);

  const handleUpdateActiveConnections = useCallback((newConns: WorkflowConnection[]) => {
    setActiveWorkflow((current) => current ? { ...current, connections: newConns } : current);
  }, []);

  const handleSelectNode = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
  }, []);

  // Handle single Node updates from side settings panel
  const handleUpdateNodeConfig = (nodeId: string, updatedConfig: Record<string, any>, updatedName: string) => {
    if (!activeWorkflow) return;
    setActiveWorkflow((current) => {
      if (!current) return current;
      return {
        ...current,
        nodes: current.nodes.map((n) =>
          n.id === nodeId ? { ...n, config: updatedConfig, name: updatedName } : n
        ),
      };
    });
  };

  // Node deletion from settings panel
  const handleDeleteNode = (nodeId: string) => {
    if (!activeWorkflow) return;
    setActiveWorkflow((current) => {
      if (!current) return current;
      return {
        ...current,
        nodes: current.nodes.filter((n) => n.id !== nodeId),
        connections: current.connections.filter((c) => c.fromNodeId !== nodeId && c.toNodeId !== nodeId),
      };
    });
    setSelectedNodeId(null);
    showBanner("success", "Deleted node block and related wires.");
  };

  // 4. Copilot Generation Integration Hook
  const handleAIGeneratedWorkflow = (wf: Workflow) => {
    setWorkflows((prev) => [wf, ...prev]);
    setActiveWorkflow(wf);
    setSelectedNodeId(null);
    showBanner("success", `AI successfully drafted pipeline: "${wf.name}"`);
  };

  // 5. GRAPH PIPELINE SIMULATION EXECUTION ENGINE
  const runWorkflowSimulation = async (specificNodeId?: string) => {
    if (!activeWorkflow) return;
    if (isRunningSim) return;

    setIsRunningSim(true);
    showBanner("success", "Initializing pipeline variables...");

    const startedTime = new Date().toISOString();
    const tempLogId = "log_" + Math.random().toString(36).substring(2, 6);

    const simulationLog: ExecutionLog = {
      id: tempLogId,
      workflowId: activeWorkflow.id,
      workflowName: activeWorkflow.name,
      startedAt: startedTime,
      endedAt: "",
      status: "success", // assumed success unless nodes fail
      steps: [],
    };

    setActiveLog(simulationLog);

    try {
      // Find Trigger nodes to kick off graph traversal (usually those without incoming connections)
      let triggerNodes: typeof activeWorkflow.nodes = [];
      if (typeof specificNodeId === "string") {
        const found = activeWorkflow.nodes.find((n) => n.id === specificNodeId);
        if (found) {
          triggerNodes = [found];
        }
      }

      if (triggerNodes.length === 0) {
        const nonTriggerNodeIds = new Set(activeWorkflow.connections.map((c) => c.toNodeId));
        triggerNodes = activeWorkflow.nodes.filter((n) => !nonTriggerNodeIds.has(n.id));
      }

      if (triggerNodes.length === 0 && activeWorkflow.nodes.length > 0) {
        // Fallback to first node on canvas if all are connected
        triggerNodes = [activeWorkflow.nodes[0]];
      }

      // Track global evaluation variables across pipes (to forward output data as parameters to downstream inputs)
      // Stores node inputs indexed by nodeId => payloadData
      const runContext: Record<string, any> = {};
      const nodeById = new Map<string, WorkflowNode>(activeWorkflow.nodes.map((node) => [node.id, node]));
      const outgoingByNode = activeWorkflow.connections.reduce((map, conn) => {
        const outgoing = map.get(conn.fromNodeId);
        if (outgoing) {
          outgoing.push(conn);
        } else {
          map.set(conn.fromNodeId, [conn]);
        }
        return map;
      }, new Map<string, WorkflowConnection[]>());

      // Seed trigger configurations
      for (const tn of triggerNodes) {
        if (tn.type === "click" && tn.config.payloadJson) {
          try {
            runContext[tn.id] = JSON.parse(tn.config.payloadJson);
          } catch (e) {
            runContext[tn.id] = { triggerTime: new Date().toISOString(), status: "active", triggerType: "manual_click" };
          }
        } else if (tn.type === "telegram") {
          runContext[tn.id] = {
            triggerTime: new Date().toISOString(),
            status: "active",
            platform: "telegram",
            botUsername: tn.config.botUsername || "@aetherflow_bot",
            chatId: tn.config.chatId || "demo-telegram-chat",
            from: tn.config.sampleFrom || "telegram-user",
            message: tn.config.sampleMessage || "Start the workflow",
          };
        } else if (tn.type === "whatsapp") {
          runContext[tn.id] = {
            triggerTime: new Date().toISOString(),
            status: "active",
            platform: "whatsapp",
            phoneNumberId: tn.config.phoneNumberId || "demo-phone-number-id",
            from: tn.config.sampleFrom || "+15551234567",
            message: tn.config.sampleMessage || "Start the workflow",
          };
        } else {
          runContext[tn.id] = tn.config.defaultInput || { triggerTime: new Date().toISOString(), status: "active" };
        }
      }

      // Basic linear traversal queue (handles branching or linear pathways)
      const queue: Array<{ nodeId: string; incomingData: any }> = triggerNodes.map((n) => ({
        nodeId: n.id,
        incomingData: runContext[n.id],
      }));
      let queueIndex = 0;

      // Prevent infinite cycles on grid loops
      const processedSet = new Set<string>();

      while (queueIndex < queue.length) {
        const { nodeId, incomingData } = queue[queueIndex++];
        if (processedSet.has(nodeId)) continue;
        processedSet.add(nodeId);

        const currentNode = nodeById.get(nodeId);
        if (!currentNode) continue;

        // Highlight active executing block physically on the grid canvas
        setActiveExecutingNodeId(nodeId);
        
        // Stagger visual loop to make wires animations spectacular
        await new Promise((resolve) => setTimeout(resolve, 1400));

        const stageStart = Date.now();

        // Query server to evaluate real API handshakes
        let serverResponse;
        let blockSuccess = true;
        let stepLogs = "";
        let stepOutput: any = {};

        try {
          const fetchRes = await fetch("/api/node/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nodeType: currentNode.type,
              config: currentNode.config,
              inputPayload: incomingData,
            }),
          });

          if (!fetchRes.ok) {
            throw new Error(`Execution error: ${fetchRes.statusText}`);
          }

          serverResponse = await fetchRes.json();
          blockSuccess = serverResponse.status === "success" || serverResponse.status === "success_mocked";
          stepLogs = serverResponse.logs || "Step completed successfully.";
          stepOutput = serverResponse.data || {};

        } catch (xhrError: any) {
          blockSuccess = false;
          stepLogs = `Exception thrown executing block: ${xhrError.message || xhrError}`;
          stepOutput = { failed: true, error: xhrError.message };
        }

        const duration = Date.now() - stageStart;

        // Record execution block step details
        simulationLog.steps.push({
          nodeId: currentNode.id,
          nodeName: currentNode.name,
          nodeType: currentNode.type,
          status: blockSuccess ? "success" : "failed",
          duration,
          output: stepOutput,
          logs: stepLogs,
        });

        // Update active render trace
        setActiveLog({ ...simulationLog });

        if (!blockSuccess) {
          simulationLog.status = "failed";
        }

        // Evaluate next routing targets based on connection wires
        const outgoingConnections = outgoingByNode.get(nodeId) || [];

        for (const conn of outgoingConnections) {
          // Rule: If filter conditional node, YES follows 'output' wires, NO follows 'fail' wires
          if (currentNode.type === "filter") {
            const meetsCriteria = stepOutput.meetsCondition === true;
            if (meetsCriteria && conn.fromPort === "output") {
              queue.push({ nodeId: conn.toNodeId, incomingData: stepOutput });
            } else if (!meetsCriteria && conn.fromPort === "fail") {
              queue.push({ nodeId: conn.toNodeId, incomingData: stepOutput });
            }
          } else {
            // Standard action step, forward resulting output variables directly
            queue.push({ nodeId: conn.toNodeId, incomingData: stepOutput });
          }
        }
      }

      // Finish simulation log compiling
      simulationLog.endedAt = new Date().toISOString();
      const finalizedLog = await AuraDatabase.saveExecutionLog(simulationLog);

      // Save to logs list
      setLogs((prev) => [finalizedLog, ...prev]);
      setActiveLog(null);
      setCompletedLogModal(finalizedLog); // Auto trigger completed execution modal popup!
      recordActivity(
        "workflow.execute",
        `Executed workflow "${finalizedLog.workflowName}" with status ${simulationLog.status}.`,
        {
          executionLogId: finalizedLog.id,
          workflowId: finalizedLog.workflowId,
          workflowName: finalizedLog.workflowName,
          status: finalizedLog.status,
          stepCount: finalizedLog.steps.length,
        }
      );
      showBanner(
        simulationLog.status === "success" ? "success" : "error",
        `Execution simulation complete. Status: ${simulationLog.status.toUpperCase()}`
      );

    } catch (simErr: any) {
      console.error("Simulation run error:", simErr);
      showBanner("error", `Engine failed to solve graph: ${simErr.message || simErr}`);
    } finally {
      setIsRunningSim(false);
      setActiveExecutingNodeId(null);
    }
  };

  const handleClearHistory = () => {
    localStorage.removeItem("auraflow_logs");
    setLogs([]);
    showBanner("success", "Cleared execution statistics history.");
  };

  const activeNode = useMemo(
    () => activeWorkflow?.nodes.find((n) => n.id === selectedNodeId) || null,
    [activeWorkflow?.nodes, selectedNodeId]
  );
  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 flex flex-col font-sans select-none antialiased">
      {/* 1. PROFESSIONAL HEADER HERO HUD NAVBAR */}
      <header className="px-6 py-4 bg-black/20 backdrop-blur-md border-b border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-cyan-400 to-fuchsia-600 hover:scale-105 transition-transform rounded-xl shadow-lg shadow-cyan-500/10">
            <WorkflowIcon className="w-5 h-5 text-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-white">AetherFlow Studio</h1>
            </div>
            <p className="text-[10px] text-slate-400">Low-code workflow automation orchestrator & API router</p>
          </div>
        </div>

        {/* Sync, Auth controls and active notifications */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status banner */}
          {statusBanner && (
            <div
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 animate-fadeIn ${
                statusBanner.type === "success"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/10"
                  : "bg-red-500/20 text-red-400 border border-red-500/10"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping"></span>
              {statusBanner.text}
            </div>
          )}

          {/* User profiles Auth Controller */}
          {session.isAuthenticated ? (
            <div className="flex items-center bg-white/5 border border-white/10 rounded-lg px-2 py-1 gap-2 backdrop-blur-md">
              <div className="w-5 h-5 bg-gradient-to-r from-cyan-400 to-fuchsia-600 text-white font-bold text-[9px] flex items-center justify-center rounded-full uppercase">
                {session.email?.substring(0, 2) || "U"}
              </div>
              <span className="text-[10px] text-slate-300 max-w-[90px] truncate">{session.email}</span>
              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border ${
                session.accountRole === "worker"
                  ? "bg-violet-500/10 text-violet-300 border-violet-500/20"
                  : "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
              }`}>
                {session.accountRole === "worker" ? "Worker" : "Customer"}
              </span>
              <button
                onClick={handleSignOut}
                title="Sign Out"
                className="text-slate-500 hover:text-red-400 cursor-pointer p-0.5 hover:bg-white/10 rounded"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {/* Simple login triggers */}
              <button
                onClick={() => {
                  setShowAuthTab("signin");
                  const element = document.getElementById("auth-panel");
                  element?.scrollIntoView({ behavior: "smooth" });
                }}
                className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] font-semibold text-slate-400 hover:text-white cursor-pointer transition-colors backdrop-blur-md"
              >
                Sign In
              </button>
            </div>
          )}
        </div>
      </header>

      {/* --- LIVE RGB GLOWING STRIP BARS INDICATING SIMULATING STATE --- */}
      {isRunningSim && (
        <div className="h-[2px] w-full bg-gradient-to-r from-cyan-400 via-violet-500 to-emerald-400 background-size-400 pulse-rgb-flow shrink-0"></div>
      )}

      {/* 2. MAIN WORKSPACE GRID DIVISION */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left Side: Pipeline List, Copilot, & Log View panel */}
        <div
          className={`w-full lg:w-96 border-r border-white/10 p-5 gap-5 flex-col h-full overflow-y-auto shrink-0 bg-black/40 backdrop-blur-xl ${
            showSidebar ? "flex" : "hidden"
          }`}
        >
          {/* Active Workflows collection selections */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-4 rounded-xl space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                <WorkflowIcon className="w-4 h-4 text-cyan-400" />
                <span>My Automation Pipelines</span>
              </div>
              <button
                onClick={handleCreateNewWorkflow}
                title="Create New Workflow"
                className="p-1 px-2 bg-white text-black hover:bg-white/90 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-transform duration-100"
              >
                <Plus className="w-3.5 h-3.5" />
                New
              </button>
              <button
                type="button"
                onClick={() => setShowSidebar(false)}
                title="Hide sidebar"
                aria-label="Hide sidebar"
                className="h-7 w-7 bg-black/45 hover:bg-black border border-white/15 hover:border-cyan-400/50 text-slate-300 hover:text-cyan-300 rounded-md flex items-center justify-center transition-all cursor-pointer"
              >
                <Menu className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Select workflow dropdown */}
            {workflows.length > 0 ? (
              <div className="space-y-1">
                <select
                  value={activeWorkflow?.id || ""}
                  onChange={(e) => handleSelectWorkflow(e.target.value)}
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-slate-200 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500/20 cursor-pointer backdrop-blur-md"
                >
                  {workflows.map((w) => (
                    <option key={w.id} value={w.id} className="bg-[#0c0c0c]">
                      {w.name} {w.id.startsWith("wf-default-") ? "(Seed)" : ""}
                    </option>
                  ))}
                </select>
                {activeWorkflow && (
                  <div className="space-y-1.5 pt-2">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Pipeline name
                    </label>
                    <input
                      type="text"
                      value={activeWorkflow.name}
                      onChange={(e) => handleRenameActiveWorkflow(e.target.value)}
                      placeholder="Name this pipeline"
                      className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs font-semibold text-slate-100 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500/20 backdrop-blur-md"
                    />
                  </div>
                )}
                {activeWorkflow && (
                  <p className="text-[10px] text-slate-400 pt-1.5 leading-normal">
                    {activeWorkflow.description || "No description configured."}
                  </p>
                )}
              </div>
            ) : (
              <div className="py-2 text-center text-xs text-slate-500">
                Spawn or type a prompt to compile a workflow.
              </div>
            )}
          </div>

          {/* AI prompted workflow generator */}
          <AIPromptBuilder onGenerate={handleAIGeneratedWorkflow} />

          {/* Execution logs histories */}
          <ExecutionLogViewer
            logs={logs}
            onClearLogs={handleClearHistory}
            activeLog={activeLog}
            isRunning={isRunningSim}
          />

          {/* PUBLIC ACCESS / SIMULATION STATE AUTHENTICATION TRIGGER BOX */}
          {!session.isAuthenticated && (
            <div id="auth-panel" className="order-first bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-xl p-4.5 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">🔐 Setup Sync Account</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAuthTab("signin")}
                    className={`text-[10px] border-b-2 px-1 transition-colors leading-relaxed ${
                      showAuthTab === "signin" ? "border-cyan-400 text-cyan-400 font-bold" : "border-transparent text-slate-500"
                    }`}
                  >
                    Login
                  </button>
                  <button
                    onClick={() => setShowAuthTab("signup")}
                    className={`text-[10px] border-b-2 px-1 transition-colors leading-relaxed ${
                      showAuthTab === "signup" ? "border-cyan-400 text-cyan-400 font-bold" : "border-transparent text-slate-500"
                    }`}
                  >
                    Register
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAuthRole("worker")}
                  className={`p-2 rounded-lg border text-left transition-colors ${
                    authRole === "worker"
                      ? "bg-violet-500/15 border-violet-400/40 text-violet-200"
                      : "bg-black/30 border-white/10 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Worker Login
                  </div>
                  <p className="mt-1 text-[9px] leading-normal opacity-75">Owner and developer access.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setAuthRole("customer")}
                  className={`p-2 rounded-lg border text-left transition-colors ${
                    authRole === "customer"
                      ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-200"
                      : "bg-black/30 border-white/10 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
                    <Users className="w-3.5 h-3.5" />
                    Customer Login
                  </div>
                  <p className="mt-1 text-[9px] leading-normal opacity-75">Create and use workflows.</p>
                </button>
              </div>

              <form onSubmit={handleAuthSubmit} className="space-y-3.5">
                <div className="space-y-1">
                  <input
                    type="email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="name@email.com"
                    className="w-full px-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-slate-200 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500/10 font-sans backdrop-blur-md"
                  />
                </div>
                <div className="space-y-1">
                  <input
                    type="password"
                    value={authPass}
                    onChange={(e) => setAuthPass(e.target.value)}
                    placeholder="Password"
                    className="w-full px-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-slate-200 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500/10 font-sans backdrop-blur-md"
                  />
                </div>

                {authError && (
                  <div className="text-[10px] text-red-400 p-2 bg-red-500/10 rounded border border-red-500/20">
                    {authError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loadingAuth}
                  className="w-full py-2 bg-gradient-to-r from-cyan-400 to-fuchsia-600 hover:opacity-90 text-white text-xs font-bold rounded-lg shadow-md cursor-pointer transition-all disabled:opacity-50"
                >
                  {loadingAuth
                    ? "Authorizing..."
                    : showAuthTab === "signup"
                    ? `Create ${authRole === "worker" ? "Worker" : "Customer"} Account`
                    : `Access ${authRole === "worker" ? "Worker" : "Customer"} Workspace`}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Center Canvas Workspace and controls */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#050505] border-r border-white/10">
          {activeWorkflow ? (
            <div className={`flex-1 flex flex-col overflow-hidden h-full relative ${isRunningSim ? "pulse-rgb-flow" : ""}`}>
              {/* Controls bar over canvas wrapper */}
              <div className="px-6 py-4 bg-black/20 backdrop-blur-md border-b border-white/10 grid grid-cols-1 xl:grid-cols-[minmax(2.25rem,1fr)_minmax(10rem,26rem)_minmax(24rem,1fr)] items-center gap-4 shrink-0">
                <div className="flex items-center justify-start min-w-0">
                  {!showSidebar && (
                    <button
                      type="button"
                      onClick={() => setShowSidebar(true)}
                      title="Show sidebar"
                      aria-label="Show sidebar"
                      className="h-9 w-9 bg-black/55 hover:bg-black border border-white/15 hover:border-cyan-400/50 text-slate-300 hover:text-cyan-300 rounded-lg shadow-lg backdrop-blur-xl flex items-center justify-center transition-all cursor-pointer shrink-0"
                    >
                      <Menu className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="text-center min-w-0">
                  <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">Currently Designing</div>
                  <h2 className="text-sm font-bold text-slate-200 truncate">{activeWorkflow.name}</h2>
                </div>

                <div className="flex items-center justify-center xl:justify-end gap-3 min-w-0 flex-wrap">
                  <button
                    onClick={handleDeleteWorkflow}
                    className="px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 hover:text-rose-300 rounded-lg text-[10px] font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Graph
                  </button>
                  <button
                    onClick={handleSaveActiveWorkflow}
                    className="px-3.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] font-semibold text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5 text-cyan-400" />
                    Save Changes
                  </button>

                  <button
                    onClick={runWorkflowSimulation}
                    disabled={isRunningSim || activeWorkflow.nodes.length === 0}
                    className={`px-5 py-2.5 bg-gradient-to-r from-cyan-400 to-fuchsia-600 hover:from-cyan-300 hover:to-fuchsia-500 text-white text-xs font-bold rounded-lg shadow-lg flex items-center gap-2 cursor-pointer transition-all duration-300 disabled:opacity-50 select-none ${
                      isRunningSim ? "animate-pulse" : ""
                    }`}
                  >
                    <Play className="w-4 h-4 fill-white text-white" />
                    Execute Pipeline
                  </button>
                </div>
              </div>

              {/* Grid Canvas Builder */}
              <div className="flex-1 overflow-hidden relative flex flex-col">
                <div className="flex-1 min-h-0 relative flex">
                  <FlowCanvas
                    nodes={activeWorkflow.nodes}
                    connections={activeWorkflow.connections}
                    selectedNodeId={selectedNodeId}
                    onSelectNode={handleSelectNode}
                    onUpdateNodes={handleUpdateActiveNodes}
                    onUpdateConnections={handleUpdateActiveConnections}
                    activeExecutingNodeId={activeExecutingNodeId}
                    onDeleteNode={handleDeleteNode}
                    onManualTriggerWorkflow={runWorkflowSimulation}
                  />

                  {/* Selective settings panel drawer on right */}
                  <NodeConfigPanel
                    node={activeNode}
                    onUpdate={handleUpdateNodeConfig}
                    onDelete={handleDeleteNode}
                    onClose={() => setSelectedNodeId(null)}
                    lastExecutionLog={logs[0] || activeLog}
                  />
                </div>

                {/* Real-time bottom console output message window */}
                <ConsoleOutputPanel
                  logs={logs}
                  activeLog={activeLog}
                  isRunning={isRunningSim}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#070709]">
              <LayoutGrid className="w-12 h-12 text-slate-700 opacity-60 mb-4 animate-bounce" />
              <h3 className="text-sm font-semibold text-slate-300">No automation graph loaded</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-[340px]">
                Type an automation idea on the left, load are template, or click below to spawn an empty workflow grid.
              </p>
              <button
                onClick={handleCreateNewWorkflow}
                className="mt-5 px-4 py-2.5 bg-gradient-to-r from-cyan-400 to-fuchsia-600 hover:opacity-90 text-white text-xs font-bold rounded-lg cursor-pointer shadow-lg shadow-cyan-500/10 transition-colors"
              >
                Create First Pipeline
              </button>
            </div>
          )}
        </div>
      </main>

      {/* 4. HIGH FIDELITY PIPELINE SIMULATION COMPLETION INSPECTOR OVERLAY */}
      {completedLogModal && (
        <div id="completed-run-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fadeIn">
          <div className="w-full max-w-3xl bg-black/55 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className={`p-6 border-b border-white/10 flex items-center justify-between ${completedLogModal.status === "success" ? "bg-emerald-950/20" : "bg-rose-950/20"}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl border ${
                  completedLogModal.status === "success"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                }`}>
                  {completedLogModal.status === "success" ? (
                    <CheckCircle className="w-6 h-6 animate-pulse" />
                  ) : (
                    <AlertCircle className="w-6 h-6 animate-pulse" />
                  )}
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-100">
                    {completedLogModal.status === "success" ? "Pipeline Execution Succeeded!" : "Pipeline Execution Encountered Issues"}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Inspecting evaluation logs for "{completedLogModal.workflowName}"
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCompletedLogModal(null)}
                className="text-slate-400 hover:text-slate-100 transition-colors p-1.5 hover:bg-white/10 rounded-md text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Run Parameters Metadata Strip */}
            <div className="px-6 py-3 bg-black/35 border-b border-white/5 flex flex-wrap items-center justify-between gap-4 text-[11px] text-slate-400 font-mono">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>Trigger Time: {new Date(completedLogModal.startedAt).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-4">
                <span>Total Steps: <strong className="text-white">{completedLogModal.steps.length}</strong></span>
                <span>Runtime: <strong className="text-cyan-400">{Math.max(1, Math.round((new Date(completedLogModal.endedAt).getTime() - new Date(completedLogModal.startedAt).getTime())))}ms</strong></span>
              </div>
            </div>

            {/* Main scrollable block-by-block outcomes inspector list */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Executed Steps, Outputs, and Local Variables:
              </div>

              <div className="space-y-3.5">
                {completedLogModal.steps.map((st, idx) => {
                  const nodeColor = st.nodeType === "gemini" || st.nodeType === "summarize"
                    ? "border-violet-500/20 bg-violet-500/5 text-violet-400"
                    : st.nodeType === "filter"
                    ? "border-amber-500/20 bg-amber-500/5 text-amber-400"
                    : "border-sky-500/20 bg-sky-500/5 text-sky-400";

                  return (
                    <div key={idx} className="border border-white/15 bg-black/45 rounded-xl overflow-hidden shadow-lg transition-transform hover:scale-[1.01]">
                      {/* Step Summary Header */}
                      <div className="px-4 py-3 bg-white/[0.02] border-b border-white/10 flex items-center justify-between text-xs font-medium">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 font-bold font-mono">#{idx + 1}</span>
                          <span className={`px-2 py-0.5 text-[8px] uppercase tracking-wider font-bold rounded ${nodeColor}`}>
                            {st.nodeType}
                          </span>
                          <span className="text-slate-200 font-bold">{st.nodeName}</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[10px]">
                          <span className={st.status === "success" ? "text-emerald-400 font-bold" : "text-rose-455 font-bold"}>
                            {st.status === "success" ? "● PASS" : "● FAIL"}
                          </span>
                          <span className="text-slate-500">({st.duration}ms)</span>
                        </div>
                      </div>

                      {/* Step Outputs & Logs */}
                      <div className="p-4 space-y-3 font-mono text-[11px] bg-black/20">
                        {/* Logs */}
                        {st.logs && (
                          <div className="space-y-1">
                            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500 block">Integration Output Logs:</span>
                            <div className="p-2.5 bg-[#08080c] border border-white/5 rounded-lg text-slate-300 leading-relaxed whitespace-pre-wrap max-h-24 overflow-y-auto">
                              {st.logs}
                            </div>
                          </div>
                        )}

                        {/* Variables Output Channels */}
                        {st.output && (
                          <div className="space-y-1">
                            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500 block">Generated Variables Payload (DATA CHANNELS):</span>
                            <pre className="p-3 bg-[#08080c] border border-white/5 rounded-lg text-emerald-400 overflow-x-auto max-h-48 scrollbar-thin">
                              {JSON.stringify(st.output, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-4 bg-cyan-500/5 border border-cyan-500/10 rounded-xl flex items-start gap-2.5 mt-2">
                <HelpCircle className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1 text-slate-405">
                  <span className="font-bold text-slate-200">How to map these variables downstream:</span>
                  <p className="leading-relaxed">
                    Every downstream node receiving inputs can query these returned keys (like <code className="text-cyan-400 bg-black/45 px-1 py-0.2 rounded font-mono">meetsCondition</code> or text content) inside prompt template settings seamlessly by utilizing parameters links.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-white/10 bg-black/25 flex items-center justify-between">
              <span className="text-[10px] text-slate-500 font-mono">
                AURAFLOW RUN ENGINE v1.2.5
              </span>
              <button
                onClick={() => setCompletedLogModal(null)}
                className="px-5 py-2.5 bg-gradient-to-r from-cyan-400 to-fuchsia-600 hover:opacity-95 text-white rounded-xl text-xs font-bold transition-all shadow-lg hover:shadow-cyan-500/20 cursor-pointer"
              >
                Return to Canvas Workspace
              </button>
            </div>

          </div>
        </div>
      )}
      {/* 5. GORGEOUS CHATBOT ASSISTANT DRAWER OR WINDOW (BOTTOM RIGHT) */}
      <div id="aura-chatbot-container" className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
        {showChat ? (
          <div className="w-80 md:w-96 h-[480px] bg-[#0c0c14]/90 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col animate-slideUp mb-4">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-cyan-950/20 via-slate-900/40 to-fuchsia-950/20 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-gradient-to-r from-cyan-500 to-fuchsia-600 p-1.5 rounded-lg">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                    Aura Chatbot Tutors
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  </h3>
                  <p className="text-[10px] text-slate-400">Ask how to connect, create, or simulate flows!</p>
                </div>
              </div>
              <button
                onClick={() => setShowChat(false)}
                className="text-slate-400 hover:text-slate-100 transition-colors p-1.5 hover:bg-white/10 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick documentation guidance queries */}
            <div className="p-2 bg-white/[0.02] border-b border-white/5 flex gap-1.5 flex-wrap overflow-x-auto text-[9px] scrollbar-none font-mono">
              <button
                type="button"
                onClick={() => setChatInput("How can I connect two nodes?")}
                className="px-2 py-0.5 bg-black/40 border border-white/15 text-slate-300 hover:text-cyan-400 rounded-md transition-colors whitespace-nowrap cursor-pointer"
              >
                Connecting Nodes
              </button>
              <button
                type="button"
                onClick={() => setChatInput("How do I delete a node?")}
                className="px-2 py-0.5 bg-black/40 border border-white/15 text-slate-300 hover:text-cyan-400 rounded-md transition-colors whitespace-nowrap cursor-pointer"
              >
                Deleting Nodes
              </button>
              <button
                type="button"
                onClick={() => setChatInput("How do I trigger the automation?")}
                className="px-2 py-0.5 bg-black/40 border border-white/15 text-slate-300 hover:text-cyan-400 rounded-md transition-colors whitespace-nowrap cursor-pointer"
              >
                Running Flows
              </button>
            </div>

            {/* Message Bubble Feed */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3.5 scrollbar-thin bg-black/15">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-tr-none shadow-md font-medium"
                        : "bg-white/5 border border-white/5 text-slate-300 rounded-tl-none leading-relaxed"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white/5 border border-white/5 rounded-2xl rounded-tl-none p-3 text-xs text-slate-400 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-fuchsia-400" />
                    <span>Aura is drafting explanation...</span>
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Input Form Fields */}
            <form onSubmit={handleSendChatMessage} className="p-3 bg-black/40 border-t border-white/10 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask Aura or teach me on how to use..."
                className="flex-1 px-3 py-2 bg-black/50 border border-white/10 outline-none rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500/15 backdrop-blur-md"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || isChatLoading}
                className="p-2 bg-gradient-to-r from-cyan-400 to-fuchsia-600 hover:opacity-90 disabled:opacity-50 text-white rounded-xl transition-all shadow-md flex items-center justify-center cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : null}

        {/* Floating Bubble Pin Button */}
        <button
          onClick={() => setShowChat(!showChat)}
          className={`h-12 w-12 bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-fuchsia-600 rounded-full flex items-center justify-center text-white shadow-2xl shrink-0 cursor-pointer overflow-hidden transition-all duration-300 border border-white/20 select-none hover:scale-105 ${
            showChat ? "scale-90" : "animate-bounce"
          }`}
          title="Need help? Ask Aura!"
        >
          {showChat ? <X className="w-5 h-5" /> : <MessageSquare className="w-5 h-5 fill-white" />}
        </button>
      </div>
    </div>
  );
}
