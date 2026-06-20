import express from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT || 3000);

// Initialize GoogleGenAI server-side with metadata header
const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey: apiKey || "",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Health check API
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", mode: process.env.NODE_ENV || "development", hasApiKey: !!apiKey });
});

// Interactive AI Chatbot Endpoint
app.post("/api/chat", async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: "Messages array is required" });
    return;
  }

  if (!apiKey) {
    res.json({
      reply: "Hello! I am Aura, your AuraFlow assistant. It looks like the GEMINI_API_KEY is not configured in your Secrets panel, so I am running in local offline support mode. Here is a quick guide on how to use AuraFlow:\n\n- **Double-click** anywhere on the canvas grid to quickly place custom workflow nodes chosen from the presets.\n- **Drag connections (Flow Wires)** from output (right-side) ports to input (left-side) ports of different nodes to connect them.\n- **Select a node** to open its settings and customize its behavior in the sidebar.\n- **To delete any node**, select it and click the red 'Delete' trash action button in the configuration panel sidebar.\n- **Run the pipeline** with the main 'Execute Workflow Simulation' button in the toolbar! Once done, a detailed output panel appears.\n\nLet me know if you have any questions!",
    });
    return;
  }

  try {
    const formattedContents = messages.map((msg: any) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content || msg.text || "" }]
    }));

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: formattedContents,
      config: {
        systemInstruction: `You are Aura, the helpful, professional, and knowledgeable chatbot guide of AuraFlow.
AuraFlow is an advanced visual workflow automation builder (similar to n8n or Zapier) where users create, connect, and simulate automated pipelines.

Your goal is to answer user queries with pristine formatting and teach them how to get the most out of AuraFlow!
Here is the core product documentation you must use to guide users:
1. Canvas Grid Workspace:
   - Pan around by clicking and dragging on the background grid space.
   - Double-click any empty spot on the canvas to open the "Compile Preset Node" context selector and quickly spawn nodes.
2. Linking Flow Wires:
   - To connect nodes, click any output port circle (on the right border of a node) and then click an input port circle (on the left border of a different node).
   - Filter nodes support beautiful conditional branches! They offer a green 'YES' output port and a red 'NO' output port.
3. Node Parameter Tweaks:
   - Click on any node to select it. The "Configure Node Settings" panel loads in the right-side drawer.
   - You can edit trigger values, select HTTP methods, customize prompts, or draft Slack / Discord embeds.
4. Fusing AI Variables:
   - Any predecessor node's outputs are accessible downstream. Feel free to use '[input]' to automatically map outputs of the previous step in your custom text templates or HTTP payloads.
5. Node Deletion:
   - To delete a node, simply click to select the node to open its config sidebar panel, then click the prominent red 'Delete Node' button at the bottom of the sidebar. This removes the node and its connections instantly!
6. Execution and Outputs:
   - Click the big gradient '▶ Run Pipeline Pass' / 'Execute Workflow Simulation' action button in the top action row.
   - The graph will animate and highlight the active execution state in a gorgeous violet pulse.
   - When finished, a high-fidelity 'Pipeline Execution Succeeded' or failed overlay launches. You'll enjoy beautifully formatted handshakes, run records, execution durations, and full JSON payloads!

Respond using friendly, professional language and structure. Use lists, bold vocabulary, and code markers to keep explanations extremely scannable.`,
      },
    });

    res.json({ reply: response.text });
  } catch (error: any) {
    console.error("Chatbot generation error:", error);
    res.json({ reply: `I ran into a small error processing your chat message: ${error.message}. Please try again!` });
  }
});

// AI Workflow Generation API endpoint
app.post("/api/workflow/generate", async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    res.status(400).json({ error: "Prompt is required" });
    return;
  }

  if (!apiKey) {
    res.status(500).json({
      error: "Gemini API key is not configured. Please add GEMINI_API_KEY in the Secrets panel."
    });
    return;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Generate a workflow automation pipeline based on this user prompt: "${prompt}".
Identify the required steps (triggers, AI processing, API integrators/actions), map them into a logical linear or branching graph of nodes, and establish connections between inputs and outputs.
Ensure the layout coordinates (x, y) space nodes out nicely from left to right. Trigger nodes start at around x=100, y=200; subsequent action nodes move to x=350, x=600, etc.

Available Node Types:
- webhook (Trigger: Receives data, config: { webhookPath: string })
- schedule (Trigger: Periodical execution, config: { interval: "hourly" | "daily" | "weekly", time: string })
- prompt (Trigger: Custom manual input, config: { defaultInput: string })
- gemini (AI Step: Large content generation, config: { promptTemplate: string, temperature: number })
- summarize (AI Step: Compresses content, config: { maxLength: number })
- filter (Logic Step: If/Else conditional checking, config: { field: string, operator: "equals" | "contains" | "gt" | "lt", value: string })
- email (Action Step: Sending an email notification, config: { to: string, subject: string, bodyTemplate: string })
- slack (Action Step: Post a message, config: { channel: string, messageTemplate: string })
- github (Action Step: Create/check commits or issues, config: { repo: string, actionType: "create_issue" | "trigger_workflow" })
- discord (Action Step: Webhook post to Discord, config: { discordUrl?: string, contentTemplate: string })
- http (Action Step: Execute HTTP request, config: { url: string, method: "GET" | "POST", headers?: string, body?: string })`,
      config: {
        systemInstruction: "You are an n8n-style workflow builder assistant. You design professional workflows consisting of connected visual nodes. Always output valid JSON strictly matching the provided schema.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["name", "description", "nodes", "connections"],
          properties: {
            name: {
              type: Type.STRING,
              description: "A short, professional, catchy name for the workflow (e.g. 'Daily Weather Slack Digester')."
            },
            description: {
              type: Type.STRING,
              description: "A brief description explaining what this automated process achieves."
            },
            nodes: {
              type: Type.ARRAY,
              description: "List of analytical and functional nodes in the workflow builder graph.",
              items: {
                type: Type.OBJECT,
                required: ["id", "type", "name", "x", "y", "config"],
                properties: {
                  id: {
                    type: Type.STRING,
                    description: "An isolated identifier (e.g. 'node_1', 'node_2')."
                  },
                  type: {
                    type: Type.STRING,
                    description: "One of the available node types: webhook, schedule, prompt, gemini, summarize, filter, email, slack, github, discord, http"
                  },
                  name: {
                    type: Type.STRING,
                    description: "Friendly readable label describing this node's action (e.g. 'Read API Trigger', 'Slack Broadcaster')."
                  },
                  x: {
                    type: Type.INTEGER,
                    description: "A calculated horizontal pixel position on the canvas for clear spacing. E.g. x=100 for step 1, 350 for step 2, 600 for step 3."
                  },
                  y: {
                    type: Type.INTEGER,
                    description: "Vertical position coordinate (e.g. around y=200, if routing branched split or stacked: y=120 and y=280)."
                  },
                  config: {
                    type: Type.OBJECT,
                    description: "Key-value specific parameters matching the selected node's type. Fill with simulated/sensible values based on user prompt."
                  }
                }
              }
            },
            connections: {
              type: Type.ARRAY,
              description: "The wires linking output channels to next-stage inputs.",
              items: {
                type: Type.OBJECT,
                required: ["fromNodeId", "fromPort", "toNodeId", "toPort"],
                properties: {
                  fromNodeId: { type: Type.STRING, description: "ID of the source node" },
                  fromPort: { type: Type.STRING, description: "Output port name, defaults to 'output'" },
                  toNodeId: { type: Type.STRING, description: "ID of the target node" },
                  toPort: { type: Type.STRING, description: "Input port name, defaults to 'input'" }
                }
              }
            }
          }
        }
      }
    });

    const text = response.text;
    if (text) {
      res.setHeader("Content-Type", "application/json");
      res.send(text);
    } else {
      res.status(500).json({ error: "Empty response from Gemini AI model." });
    }
  } catch (error: any) {
    console.error("Workflow Generation Error:", error);
    res.status(500).json({ error: error.message || "An error occurred during generation." });
  }
});

// AI Node Execution API endpoint (runs real AI operations inside simulation)
app.post("/api/node/execute", async (req, res) => {
  const { nodeType, config, triggerData, inputPayload } = req.body;

  try {
    const combinedInput = typeof inputPayload === "object" ? JSON.stringify(inputPayload) : inputPayload || "";

    // 1. AI Actions (Actually utilize Gemini!)
    if (nodeType === "gemini") {
      if (!apiKey) {
        res.json({
          status: "success_mocked",
          message: "[Mock Mode: GEMINI_API_KEY is not defined] Fused inputs into content summary.",
          data: { generatedText: `Successfully generated summary with prompt template: "${config.promptTemplate || 'Write about product update'}" for inputs: "${combinedInput || 'no input data'}"` }
        });
        return;
      }

      const promptText = `Template: ${config.promptTemplate || 'Summarize and analyze details: [input]'}\n\nIncoming node input data:\n${combinedInput}`;

      const aiResponse = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: promptText,
        config: {
          systemInstruction: "You are a professional workflow node executor. Analyze the incoming workflow node configuration and produce a high-quality automated completion.",
        }
      });

      res.json({
        status: "success",
        data: { generatedText: aiResponse.text }
      });
      return;
    }

    if (nodeType === "summarize") {
      if (!apiKey) {
        res.json({
          status: "success_mocked",
          message: "[Mock Mode] Truncated output to fit length specifications.",
          data: { summarizedText: `Combined input text was condensed. Limit: ${config.maxLength || 100} chars.` }
        });
        return;
      }

      const aiResponse = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Compress the following input to a concise summary of maximum ${config.maxLength || 100} characters:\n\n${combinedInput}`,
      });

      res.json({
        status: "success",
        data: { summarizedText: aiResponse.text }
      });
      return;
    }

    // 2. HTTP Real Fetch Logic
    if (nodeType === "http") {
      const { url, method, body, headers } = config;
      if (!url) {
        res.status(400).json({ status: "failed", error: "HTTP url parameter is missing." });
        return;
      }

      try {
        const parsedHeaders = headers ? JSON.parse(headers) : {};
        const fetchOptions: RequestInit = {
          method: method || "GET",
          headers: {
            "Content-Type": "application/json",
            ...parsedHeaders
          }
        };

        if ((method === "POST" || method === "PUT") && body) {
          fetchOptions.body = body.includes("[input]") ? body.replace("[input]", combinedInput) : body;
        }

        // To prevent crashes/timeouts during execution, let's limit runtime fetching to safe endpoints or wrap gracefully
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        fetchOptions.signal = controller.signal;

        const urlWithProto = url.startsWith("http") ? url : `https://${url}`;
        const fetchResponse = await fetch(urlWithProto, fetchOptions);
        clearTimeout(timeoutId);

        const isJson = fetchResponse.headers.get("content-type")?.includes("application/json");
        const responseData = isJson ? await fetchResponse.json() : await fetchResponse.text();

        res.json({
          status: "success",
          statusCode: fetchResponse.status,
          data: responseData
        });
      } catch (err: any) {
        res.json({
          status: "failed",
          error: `HTTP Fetch request failed: ${err.message || err}`
        });
      }
      return;
    }

    // 3. Simulated steps for other integration nodes (Slack, Gmail, GitHub, Discord)
    // If Webhook contains a payload, we format beautiful logs
    let sampleLogs = "";
    let mockResultData: any = {};

    switch (nodeType) {
      case "webhook":
        mockResultData = {
          receivedAt: new Date().toISOString(),
          headers: { "x-triggered-by": "auraflow-webhook" },
          payload: inputPayload || { event: "manual_trigger", source: "AuraFlow Workspace", metric: 85 }
        };
        sampleLogs = "Webhook received ping successfully.";
        break;
      case "schedule":
        mockResultData = {
          fireTime: new Date().toISOString(),
          nextTrigger: "Generated next relative cycle instance."
        };
        sampleLogs = `Schedule cron fired on time interval ${config.interval || "daily"} at ${config.time || "09:00"}.`;
        break;
      case "prompt":
        mockResultData = {
          userInput: config.defaultInput || "Workflow start parameters validated."
        };
        sampleLogs = "Manual trigger input payload captured.";
        break;
      case "click":
        let parsedPayload: any = { triggerTime: new Date().toISOString(), triggerType: "manual_click" };
        if (config.payloadJson) {
          try {
            parsedPayload = { ...parsedPayload, ...JSON.parse(config.payloadJson) };
          } catch (e) {
            // fallback
          }
        }
        mockResultData = parsedPayload;
        sampleLogs = "Manual click event triggered on node canvas card.";
        break;
      case "email":
        mockResultData = {
          sentTo: config.to || "recipient@example.com",
          subject: config.subject || "AuraFlow Automated Alert",
          sentAt: new Date().toISOString()
        };
        sampleLogs = `Simulated automated SMTP handshake. Formatted and delivered HTML email successfully to ${config.to || "recipient@example.com"}.`;
        break;
      case "slack":
        mockResultData = {
          postedChannel: config.channel || "#alerts",
          status: "message_delivered"
        };
        sampleLogs = `Sent Slack API payload to channel ${config.channel || "#alerts"} successfully!`;
        break;
      case "github":
        mockResultData = {
          repository: config.repo || "organization/repo",
          action: config.actionType || "create_issue",
          issueId: Math.floor(Math.random() * 9500) + 100
        };
        sampleLogs = `GitHub Octokit initialized. Triggered repository action: ${config.actionType || "create_issue"} for repository: ${config.repo || "aura-automations"}.`;
        break;
      case "discord":
        mockResultData = {
          endpoint: config.discordUrl ? "Custom Webhook ID" : "Default AuraFlow Logger",
          success: true
        };
        sampleLogs = `Webhook payload formatted as Discord embed block and transmitted. Payload contains: "${config.contentTemplate || 'No content template'}"`;
        break;
      case "filter":
        const { field, operator, value } = config;
        let meetsCondition = true;
        
        let targetVal = inputPayload;
        if (inputPayload && typeof inputPayload === "object") {
          targetVal = inputPayload[field] !== undefined ? inputPayload[field] : JSON.stringify(inputPayload);
        }

        if (field && operator && value) {
          const checkVal = String(targetVal).toLowerCase();
          const checkAgainst = String(value).toLowerCase();
          
          if (operator === "equals") meetsCondition = checkVal === checkAgainst;
          else if (operator === "contains") meetsCondition = checkVal.includes(checkAgainst);
          else if (operator === "gt") meetsCondition = parseFloat(checkVal) > parseFloat(checkAgainst);
          else if (operator === "lt") meetsCondition = parseFloat(checkVal) < parseFloat(checkAgainst);
        }

        mockResultData = {
          meetsCondition,
          fieldChecked: field || "(all)",
          operatorApplied: operator || "equals",
          valueCompared: value || "(none)",
          inputVal: targetVal
        };
        sampleLogs = meetsCondition
          ? `Filter checks passed: "${targetVal}" ${operator} "${value}". Routing to 'YES' branch.`
          : `Filter checks failed: "${targetVal}" does NOT match "${value}". Routing stopped or diverted to 'NO' branch.`;
        break;
      default:
        mockResultData = { status: "processed" };
        sampleLogs = "Node processing finished successfully.";
    }

    res.json({
      status: "success",
      logs: sampleLogs,
      data: mockResultData
    });

  } catch (error: any) {
    console.error("Node Execution Error:", error);
    res.status(500).json({ error: error.message || "An error occurred during execution." });
  }
});

// Setup Vite Dev Server / Static Asset Router Middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development middleware connected.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving statically compiled files from dist/.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AuraFlow Server starting cleanly on http://0.0.0.0:${PORT}`);
  });
}

startServer();
