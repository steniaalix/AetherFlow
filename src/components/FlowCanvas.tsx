import React, { useState, useRef, useEffect } from "react";
import { WorkflowNode, WorkflowConnection, NodeType } from "../types";
import { PlusCircle, HelpCircle, AlertCircle, Play, User, Network, FileDown, Activity, Settings, Zap, Trash2 } from "lucide-react";

interface Props {
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onUpdateNodes: (nodes: WorkflowNode[]) => void;
  onUpdateConnections: (connections: WorkflowConnection[]) => void;
  activeExecutingNodeId: string | null;
  onDeleteNode?: (nodeId: string) => void;
  onManualTriggerWorkflow?: (nodeId: string) => void;
}

const AVAILABLE_NODE_PRESETS: Array<{ type: NodeType; label: string; desc: string; category: "trigger" | "ai" | "action" | "logic" }> = [
  { type: "webhook", label: "Inbound Webhook", desc: "Triggers on inbound JSON endpoints", category: "trigger" },
  { type: "schedule", label: "Schedule Interval", desc: "Hourly, daily or weekly schedule trigger", category: "trigger" },
  { type: "prompt", label: "Manual Prompt Trigger", desc: "Injects seed parameters on click", category: "trigger" },
  { type: "click", label: "Manual Click Trigger", desc: "Launches run directly when clicked from the node card", category: "trigger" },
  { type: "gemini", label: "Gemini Generative AI", desc: "Drafts summaries from prompt templates", category: "ai" },
  { type: "summarize", label: "AI Summarizer", desc: "Condenses bulk inputs gracefully", category: "ai" },
  { type: "filter", label: "Logic Filter", desc: "Branching IF/ELSE conditional router", category: "logic" },
  { type: "email", label: "Email SMTP Sender", desc: "Format and deliver alerts to recipients", category: "action" },
  { type: "slack", label: "Slack Poster", desc: "Publishes metrics into custom Slack feeds", category: "action" },
  { type: "github", label: "GitHub Commits Action", desc: "Pushes repository actions on event", category: "action" },
  { type: "discord", label: "Discord Broadcaster", desc: "Pipes markdown into Discord servers", category: "action" },
  { type: "http", label: "HTTP REST API Fetch", desc: "Executes GET/POST payloads", category: "action" },
];

export default function FlowCanvas({
  nodes,
  connections,
  selectedNodeId,
  onSelectNode,
  onUpdateNodes,
  onUpdateConnections,
  activeExecutingNodeId,
  onDeleteNode,
  onManualTriggerWorkflow,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  
  // Dragging states
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Creating Connection states
  const [activeConnectionSource, setActiveConnectionSource] = useState<{ nodeId: string; port: string } | null>(null);

  // Quick preset drawer state
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [addMenuPos, setAddMenuPos] = useState({ x: 200, y: 150 });

  // Listen for delete/backspace keypresses to delete selected node
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid triggering delete when typing in inputs/textareas
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          (activeEl instanceof HTMLElement && activeEl.isContentEditable))
      ) {
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selectedNodeId && onDeleteNode) {
        onDeleteNode(selectedNodeId);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedNodeId, onDeleteNode]);

  // 1. Coordinates calculations for drawing wires between Ports
  // Output Port corresponds to Right of Node
  // Input Port corresponds to Left of Node
  const getNodePortCoords = (nodeId: string, portType: "input" | "output" | "true" | "false" | "fail") => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };

    const nodeWidth = 200;
    const nodeHeight = 76;

    if (portType === "input") {
      return { x: node.x, y: node.y + nodeHeight / 2 };
    }

    if (portType === "output" || portType === "true") {
      // If conditional filter node, true branch represents upper right
      const yOffset = node.type === "filter" ? nodeHeight * 0.35 : nodeHeight / 2;
      return { x: node.x + nodeWidth, y: node.y + yOffset };
    }

    if (portType === "false" || portType === "fail") {
      // False/fail branch represents lower right of filter node
      return { x: node.x + nodeWidth, y: node.y + nodeHeight * 0.65 };
    }

    return { x: node.x + nodeWidth / 2, y: node.y + nodeHeight / 2 };
  };

  // Convert node inputs into smooth SVG curve vectors
  const makeBezierPath = (x1: number, y1: number, x2: number, y2: number) => {
    const controlOffset = Math.max(80, Math.abs(x2 - x1) * 0.5);
    return `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`;
  };

  // 2. Drag-and-Drop client hooks
  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if ((e.target as HTMLElement).closest(".port-circle")) return; // skip if clicking connection port
    
    // Select clicked node
    onSelectNode(nodeId);
    
    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      setDraggingNodeId(nodeId);
      // Determine drag initial offset coordinates
      setDragOffset({
        x: e.clientX - node.x,
        y: e.clientY - node.y,
      });
    }
    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingNodeId && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      // Keep boundaries inside positive workspace grid coordinates offsets
      let targetX = e.clientX - dragOffset.x;
      let targetY = e.clientY - dragOffset.y;

      targetX = Math.max(10, Math.min(2000, targetX));
      targetY = Math.max(10, Math.min(1200, targetY));

      const updated = nodes.map((n) => {
        if (n.id === draggingNodeId) {
          return { ...n, x: Math.round(targetX), y: Math.round(targetY) };
        }
        return n;
      });
      onUpdateNodes(updated);
    }
  };

  const handleMouseUp = () => {
    if (draggingNodeId) {
      setDraggingNodeId(null);
    }
  };

  // 3. Port Clicking Connection Handlers
  const handlePortClick = (nodeId: string, portType: "input" | "output" | "true" | "false" | "fail") => {
    if (portType === "input") {
      if (activeConnectionSource) {
        // Create matching target link connection
        const newConnection: WorkflowConnection = {
          fromNodeId: activeConnectionSource.nodeId,
          fromPort: activeConnectionSource.port,
          toNodeId: nodeId,
          toPort: "input",
        };

        // Prevent duplicate connectivity mapping
        const exists = connections.some(
          (c) =>
            c.fromNodeId === newConnection.fromNodeId &&
            c.fromPort === newConnection.fromPort &&
            c.toNodeId === newConnection.toNodeId
        );

        if (!exists && newConnection.fromNodeId !== newConnection.toNodeId) {
          onUpdateConnections([...connections, newConnection]);
        }
        setActiveConnectionSource(null);
      }
    } else {
      // Trigger new output linking anchor
      setActiveConnectionSource({ nodeId, port: portType });
    }
  };

  const cancelActiveConnection = () => {
    setActiveConnectionSource(null);
  };

  const deleteConnection = (fromNodeId: string, fromPort: string, toNodeId: string) => {
    const filtered = connections.filter(
      (c) => !(c.fromNodeId === fromNodeId && c.fromPort === fromPort && c.toNodeId === toNodeId)
    );
    onUpdateConnections(filtered);
  };

  // 4. Quick Contextual Node Drawer Add Menu
  const handleCanvasDoubleClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).closest(".grid-canvas")) {
      const rect = canvasRef.current!.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      
      setAddMenuPos({ x: clickX, y: clickY });
      setShowAddMenu(true);
    }
  };

  const addNewNodePreset = (presetType: NodeType, label: string) => {
    const configSeed: Record<string, any> = {};
    if (presetType === "gemini") configSeed.promptTemplate = "Critique and write details for: [input]";
    if (presetType === "summarize") configSeed.maxLength = 100;
    if (presetType === "filter") {
      configSeed.field = "budget";
      configSeed.operator = "gt";
      configSeed.value = "5000";
    }
    if (presetType === "slack") {
      configSeed.channel = "#alerts";
      configSeed.messageTemplate = "☀️ [input]";
    }
    if (presetType === "discord") configSeed.contentTemplate = "🤖 New notification: [input]";
    if (presetType === "email") {
      configSeed.to = "alerts@company.com";
      configSeed.subject = "Custom Aura Alert";
      configSeed.bodyTemplate = "Matched output: [input]";
    }
    if (presetType === "http") {
      configSeed.url = "api.open-meteo.com/v1/forecast?latitude=37.77&longitude=-122.41&current_weather=true";
      configSeed.method = "GET";
    }

    const newNode: WorkflowNode = {
      id: "node_" + Math.random().toString(36).substring(2, 6),
      type: presetType,
      name: label,
      x: addMenuPos.x,
      y: addMenuPos.y,
      config: configSeed,
      status: "idle",
    };

    onUpdateNodes([...nodes, newNode]);
    setShowAddMenu(false);
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case "trigger":
        return "text-emerald-400 bg-emerald-500/10";
      case "ai":
        return "text-violet-400 bg-violet-500/10";
      case "logic":
        return "text-amber-400 bg-amber-500/10";
      default:
        return "text-sky-400 bg-sky-500/10";
    }
  };

  return (
    <div className="flex flex-col flex-1 h-full select-none overflow-hidden relative">
      {/* Canvas Tool Belt Action Row */}
      <div className="p-3 bg-black/25 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
            <Zap className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            Workspace Node Grid
          </span>
          <div className="h-4 w-[1px] bg-white/10"></div>
          <p className="text-[10px] text-slate-500 hidden md:block">
            💡 **Double Click Canvas** to place quick nodes, or click port ports to link logical outputs.
          </p>
        </div>
        
        <div className="flex gap-2">
          {activeConnectionSource && (
            <button
              onClick={cancelActiveConnection}
              className="px-2.5 py-1 bg-red-950/25 border border-red-500/30 text-[10px] text-red-500 font-bold rounded-md animate-pulse cursor-pointer"
            >
              Cancel Link Wire (Node ID: {activeConnectionSource.nodeId})
            </button>
          )}
          <button
            onClick={() => {
              setAddMenuPos({ x: 120, y: 140 });
              setShowAddMenu(!showAddMenu);
            }}
            className="px-3 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-[10px] font-semibold text-cyan-400 rounded-md cursor-pointer flex items-center gap-1.5"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Insert Node Block
          </button>
        </div>
      </div>

      {/* Main Grid Viewport */}
      <div
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleCanvasDoubleClick}
        className="flex-1 grid-canvas overflow-auto relative p-4"
        style={{ minHeight: "500px" }}
      >
        {/* SVG Drawing Overlay for wires connections */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" style={{ minWidth: "2000px", minHeight: "1200px" }}>
          {connections.map((conn, idx) => {
            const isFilterFalse = conn.fromPort === "fail";
            const fromCoords = getNodePortCoords(conn.fromNodeId, isFilterFalse ? "false" : "true");
            const toCoords = getNodePortCoords(conn.toNodeId, "input");
            const dStr = makeBezierPath(fromCoords.x, fromCoords.y, toCoords.x, toCoords.y);

            return (
              <g key={idx} className="group pointer-events-auto">
                {/* Visual glow backdrop for wires */}
                <path
                  d={dStr}
                  fill="none"
                  stroke="rgba(8, 207, 255, 0.15)"
                  strokeWidth="8"
                  className="transition-colors group-hover:stroke-cyan-400/25 cursor-pointer"
                  onClick={() => deleteConnection(conn.fromNodeId, conn.fromPort, conn.toNodeId)}
                />
                <path
                  d={dStr}
                  fill="none"
                  stroke={isFilterFalse ? "rgba(239, 68, 68, 0.75)" : "rgba(6, 182, 212, 0.75)"}
                  strokeWidth="2.5"
                  className="group-hover:stroke-cyan-400 pointer-events-none"
                />
                {/* Flow particles loop animation */}
                <circle r="4" fill={isFilterFalse ? "#ef4444" : "#22d3ee"} className="animate-pulse">
                  <animateMotion dur="4s" repeatCount="indefinite" path={dStr} />
                </circle>
              </g>
            );
          })}
        </svg>

        {/* Dynamic Nodes Loop */}
        <div style={{ position: "relative", minWidth: "1500px", minHeight: "800px" }}>
          {nodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const isExecuting = activeExecutingNodeId === node.id;
            
            // Get node coloring categories
            const isAI = node.type === "gemini" || node.type === "summarize";
            const isTrigger = node.type === "webhook" || node.type === "schedule" || node.type === "prompt" || node.type === "click";
            const isFilter = node.type === "filter";

            let outlineColor = "border-white/10";
            let backdropGlow = "bg-black/45 backdrop-blur-xl hover:bg-black/55";
            let topBarColor = "bg-sky-500/15 text-sky-400 border-b border-sky-500/10";

            if (isTrigger) {
              outlineColor = "border-emerald-500/20";
              topBarColor = "bg-emerald-500/15 text-emerald-400 border-b border-emerald-500/10";
            } else if (isAI) {
              outlineColor = "border-violet-500/20";
              topBarColor = "bg-violet-500/15 text-violet-400 border-b border-violet-500/10";
            } else if (isFilter) {
              outlineColor = "border-amber-500/20";
              topBarColor = "bg-amber-500/15 text-amber-400 border-b border-amber-500/10";
            }

            if (isSelected) {
              outlineColor = "border-cyan-500 shadow-md shadow-cyan-500/15 scale-[1.02] z-40";
            }

            if (isExecuting) {
              outlineColor = "node-running-glow border-violet-400 animate-pulse scale-[1.03] z-40";
            }

            return (
              <div
                key={node.id}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                className={`absolute w-[200px] border rounded-xl overflow-hidden shadow-xl transition-all select-none duration-150 group cursor-grab ${backdropGlow} ${outlineColor}`}
                style={{ left: `${node.x}px`, top: `${node.y}px` }}
              >
                {/* Node Category Top Strip */}
                <div className={`px-3 py-1.5 flex items-center justify-between text-[10px] font-bold tracking-tight uppercase min-w-0 ${topBarColor}`}>
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="truncate text-slate-100 font-bold">{node.name}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-1.5">
                    {onDeleteNode && (
                      <button
                        title="Delete this Node"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          onDeleteNode(node.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 bg-rose-500/10 hover:bg-rose-500/30 text-rose-400 hover:text-rose-300 p-[3px] rounded transition-all cursor-pointer mr-1"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                    <span className="text-[8px] opacity-75">{node.type}</span>
                  </div>
                </div>

                {/* Node Details body */}
                <div className="p-3 space-y-2">
                  <div className="text-[10px] text-slate-400 font-mono truncate">
                    ID: {node.id}
                  </div>
                  
                  {/* Miniature Config previews */}
                  {node.type === "webhook" && (
                    <div className="text-[9px] text-emerald-400 font-mono bg-emerald-500/5 px-2 py-0.5 border border-emerald-500/10 rounded">
                      Path: {node.config.webhookPath || "/leads-ingress"}
                    </div>
                  )}
                  {node.type === "click" && (
                    <div className="flex flex-col gap-1.5 pt-0.5 pb-1">
                      <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onManualTriggerWorkflow) {
                            onManualTriggerWorkflow(node.id);
                          }
                        }}
                        className="w-full px-2.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 active:scale-95 text-white text-[10px] uppercase tracking-wider font-extrabold rounded-lg shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-emerald-400/20"
                      >
                        <Play className="w-2.5 h-2.5 fill-current animate-pulse text-white" />
                        <span>Trigger Node</span>
                      </button>
                    </div>
                  )}
                  {node.type === "schedule" && (
                    <div className="text-[9px] text-emerald-400 font-mono bg-emerald-500/5 px-2 py-0.5 border border-emerald-500/10 rounded">
                      Time: {node.config.time || "08:00 AM"} ({node.config.interval})
                    </div>
                  )}
                  {node.type === "gemini" && (
                    <div className="text-[9px] text-violet-400 font-sans truncate p-1 bg-violet-500/5 border border-violet-500/10 rounded">
                      {node.config.promptTemplate || "summarize... [input]"}
                    </div>
                  )}
                  {node.type === "filter" && (
                    <div className="text-[9px] text-amber-400 font-mono p-1 bg-amber-500/5 border border-amber-500/10 rounded">
                      Check: {node.config.field || "budget"} {node.config.operator || "gt"} {node.config.value || "5000"}
                    </div>
                  )}
                  {node.type === "slack" && (
                    <div className="text-[9px] text-sky-400 font-sans truncate p-1 bg-sky-500/5 border border-sky-500/10 rounded">
                      Msg: {node.config.messageTemplate || "[input]"}
                    </div>
                  )}
                </div>

                {/* --- CONNECTIVITY PORTS ANCHORS --- */}
                {/* Left side input port (Unless it's a trigger) */}
                {!isTrigger && (
                  <div
                    onClick={() => handlePortClick(node.id, "input")}
                    className={`absolute left-0 top-1/2 -translate-x-1.5 -translate-y-1/2 w-3.5 h-3.5 bg-[#0e0e0e] border-2 rounded-full cursor-pointer z-35 flex items-center justify-center transition-transform hover:scale-125 hover:bg-cyan-400 group-hover:border-cyan-400 ${
                      activeConnectionSource ? "border-cyan-400 animate-pulse bg-cyan-500/30" : "border-white/20"
                    }`}
                    title="Input port channel link"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                  </div>
                )}

                {/* Right side output port (Unless it's a structural logic branching node) */}
                {!isFilter ? (
                  <div
                    onClick={() => handlePortClick(node.id, "output")}
                    className={`absolute right-0 top-1/2 translate-x-1.5 -translate-y-1/2 w-3.5 h-3.5 bg-[#0e0e0e] border-2 rounded-full cursor-pointer z-35 flex items-center justify-center transition-transform hover:scale-125 hover:bg-cyan-450 group-hover:border-cyan-400 ${
                      activeConnectionSource?.nodeId === node.id && activeConnectionSource?.port === "output"
                        ? "border-cyan-400 scale-125 bg-cyan-500"
                        : "border-white/20"
                    }`}
                    title="Main output port link"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                  </div>
                ) : (
                  <>
                    {/* Filter Node SUCCESS Port (YES) */}
                    <div
                      onClick={() => handlePortClick(node.id, "output")}
                      className={`absolute right-0 top-[35%] translate-x-1.5 -translate-y-1/2 w-3.5 h-3.5 bg-[#0e0e0e] border-2 rounded-full cursor-pointer z-35 flex items-center justify-center transition-transform hover:scale-125 hover:bg-emerald-400 group-hover:border-emerald-400 ${
                        activeConnectionSource?.nodeId === node.id && activeConnectionSource?.port === "output"
                          ? "border-emerald-400 scale-125 bg-emerald-500 animate-pulse"
                          : "border-white/20"
                      }`}
                      title="YES filter condition matches"
                    >
                      <span className="absolute -top-3.5 text-[8px] font-bold text-emerald-400">YES</span>
                      <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                    </div>

                    {/* Filter Node FAILED Port (NO) */}
                    <div
                      onClick={() => handlePortClick(node.id, "fail")}
                      className={`absolute right-0 top-[65%] translate-x-1.5 -translate-y-1/2 w-3.5 h-3.5 bg-[#0e0e0e] border-2 rounded-full cursor-pointer z-35 flex items-center justify-center transition-transform hover:scale-125 hover:bg-rose-500 group-hover:border-rose-400 ${
                        activeConnectionSource?.nodeId === node.id && activeConnectionSource?.port === "fail"
                          ? "border-rose-450 scale-125 bg-rose-500 animate-pulse"
                          : "border-white/20"
                      }`}
                      title="NO filter condition fails"
                    >
                      <span className="absolute -bottom-3 text-[8px] font-bold text-rose-405">NO</span>
                      <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* --- FLOATING ADD COMPONENT PRESET CONTEXT LIST DRAWER --- */}
        {showAddMenu && (
          <div
            className="absolute z-50 w-64 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-xl p-3 shadow-2xl space-y-3 animate-fadeIn"
            style={{ left: `${addMenuPos.x}px`, top: `${addMenuPos.y}px` }}
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-[10px] font-bold text-slate-100 uppercase tracking-wider">Compile Preset Node</span>
              <button
                onClick={() => setShowAddMenu(false)}
                className="text-slate-400 hover:text-slate-100 text-xs p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
              {AVAILABLE_NODE_PRESETS.map((item, index) => (
                <button
                  key={index}
                  onClick={() => addNewNodePreset(item.type, item.label)}
                  className="w-full text-left p-2 bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10 rounded-lg text-xs cursor-pointer flex gap-2 items-start transition-all duration-155"
                >
                  <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider mt-0.5 shrink-0 font-bold ${getCategoryColor(item.category)}`}>
                    {item.category}
                  </span>
                  <div>
                    <div className="font-bold text-slate-200">{item.label}</div>
                    <div className="text-[9px] text-slate-500 truncate max-w-[150px]">{item.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
