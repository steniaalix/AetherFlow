import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Workflow, ExecutionLog, UserSession } from "../types";

// Helper keys for LocalStorage override settings
const STORAGE_KEYS = {
  URL: "auraflow_supabase_url",
  KEY: "auraflow_supabase_key",
  LOCAL_WF: "auraflow_workflows",
  LOCAL_LOGS: "auraflow_logs",
  USER: "auraflow_user",
};

// 1. Determine active configurations
export function getSupabaseConfig() {
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || "";
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "";

  const savedUrl = localStorage.getItem(STORAGE_KEYS.URL) || "";
  const savedKey = localStorage.getItem(STORAGE_KEYS.KEY) || "";

  const url = savedUrl || envUrl;
  const anonKey = savedKey || envKey;

  const isConfigured = !!(url && anonKey);

  return {
    supabaseUrl: url,
    supabaseAnonKey: anonKey,
    hasEnv: !!(envUrl && envKey),
    hasSaved: !!(savedUrl && savedKey),
    isConfigured,
  };
}

// 2. Initialize Supabase if credentials exist
let supabaseClient: SupabaseClient | null = null;
const config = getSupabaseConfig();

if (config.isConfigured) {
  try {
    supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  } catch (err) {
    console.error("Failed to initialize real Supabase client:", err);
  }
}

// SQL Schema code to display in UI for helpful documentation
export const SUPABASE_SQL_SCHEMA = `-- AuraFlow Workflow Automation Database Schema
-- Run this in your Supabase SQL Editor to provision tables!

-- Create profiles table (integrated with Supabase Auth)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable row level security (RLS)
alter table public.profiles enable row level security;

create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Create workflows table
create table public.workflows (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade,
  name text not null,
  description text,
  nodes jsonb not null default '[]'::jsonb,
  connections jsonb not null default '[]'::jsonb,
  is_active boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.workflows enable row level security;

create policy "Users can manage own workflows" on public.workflows
  for all using (auth.uid() = user_id);

-- Create execution logs table
create table public.execution_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade,
  workflow_id uuid not null,
  workflow_name text not null,
  started_at timestamp with time zone default timezone('utc'::text, now()) not null,
  ended_at timestamp with time zone default timezone('utc'::text, now()) not null,
  status text not null, -- 'success', 'failed', 'partial'
  steps jsonb not null default '[]'::jsonb
);

alter table public.execution_logs enable row level security;

create policy "Users can view own execution logs" on public.execution_logs
  for select using (auth.uid() = user_id);

create policy "Users can insert own execution logs" on public.execution_logs
  for insert with check (auth.uid() = user_id);
`;

// Default seed workflows for a rich out-of-the-box user experience
const DEFAULT_WORKFLOWS: Workflow[] = [
  {
    id: "wf-default-1",
    name: "Weather Slack Digest",
    description: "Fetches local weather, summarizes with AI and creates a morning alert formatted for Slack.",
    isActive: true,
    createdAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    nodes: [
      {
        id: "node_1",
        type: "schedule",
        name: "Morning Trigger",
        x: 80,
        y: 180,
        config: { interval: "daily", time: "08:00 AM" }
      },
      {
        id: "node_2",
        type: "http",
        name: "Fetch Weather API",
        x: 310,
        y: 180,
        config: { url: "api.open-meteo.com/v1/forecast?latitude=37.77&longitude=-122.41&current_weather=true", method: "GET" }
      },
      {
        id: "node_3",
        type: "gemini",
        name: "AI Summary Helper",
        x: 540,
        y: 180,
        config: { promptTemplate: "Summarize the weather detail in a catchy single phrase. Temperature: [input]" }
      },
      {
        id: "node_4",
        type: "slack",
        name: "Post to Channel",
        x: 770,
        y: 180,
        config: { channel: "#general", messageTemplate: "☀️ Good Morning team! Today's forecast: [input]" }
      }
    ],
    connections: [
      { fromNodeId: "node_1", fromPort: "output", toNodeId: "node_2", toPort: "input" },
      { fromNodeId: "node_2", fromPort: "output", toNodeId: "node_3", toPort: "input" },
      { fromNodeId: "node_3", fromPort: "output", toNodeId: "node_4", toPort: "input" }
    ]
  },
  {
    id: "wf-default-2",
    name: "Lead Qualification & Custom Emailing",
    description: "Evaluates incoming lead criteria. Filters prospective high-value opportunities and emails automated follow-ups.",
    isActive: false,
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    nodes: [
      {
        id: "web-lead",
        type: "webhook",
        name: "Inbound Hook",
        x: 80,
        y: 200,
        config: { webhookPath: "/leads-ingress" }
      },
      {
        id: "lead-filter",
        type: "filter",
        name: "Qualify Lead Budget",
        x: 320,
        y: 200,
        config: { field: "metric", operator: "gt", value: "5000" }
      },
      {
        id: "send-sales-email",
        type: "email",
        name: "Send High-Value Sequence",
        x: 580,
        y: 120,
        config: { to: "sales@firm.com", subject: "🚀 Urgently Contact Lead!", bodyTemplate: "Incoming hot opportunity found. Contact: [input]" }
      },
      {
        id: "slack-alert-low",
        type: "slack",
        name: "Log to Low Budget",
        x: 580,
        y: 300,
        config: { channel: "#passive-tracker", messageTemplate: "Ingested lead: [input] checked." }
      }
    ],
    connections: [
      { fromNodeId: "web-lead", fromPort: "output", toNodeId: "lead-filter", toPort: "input" },
      { fromNodeId: "lead-filter", fromPort: "output", toNodeId: "send-sales-email", toPort: "input" },
      { fromNodeId: "lead-filter", fromPort: "fail", toNodeId: "slack-alert-low", toPort: "input" }
    ]
  }
];

// Unified DB & Authentication Manager Wrapper
export const AuraDatabase = {
  // Check config details
  getConfig: getSupabaseConfig,

  // Change developer credentials locally in browser
  saveCredentials(url: string, key: string) {
    if (!url || !key) {
      localStorage.removeItem(STORAGE_KEYS.URL);
      localStorage.removeItem(STORAGE_KEYS.KEY);
    } else {
      localStorage.setItem(STORAGE_KEYS.URL, url);
      localStorage.setItem(STORAGE_KEYS.KEY, key);
    }
    // Re-initialize client next time
    window.location.reload();
  },

  async testConnection(url: string, key: string): Promise<boolean> {
    try {
      const client = createClient(url, key);
      const { data, error } = await client.from("workflows").select("id").limit(1);
      if (error && error.message.includes("does not exist")) {
        // Connected but schema is not installed yet (this is actually a good indicator that credentials work, they just need SQL schema!)
        return true;
      }
      return !error;
    } catch {
      return false;
    }
  },

  // --- Authentication Handlers ---
  async signUp(email: string, pass: string): Promise<{ success: boolean; user?: any; error?: string }> {
    const config = getSupabaseConfig();
    if (supabaseClient && config.isConfigured) {
      const { data, error } = await supabaseClient.auth.signUp({ email, password: pass });
      if (error) return { success: false, error: error.message };
      return { success: true, user: data.user };
    } else {
      // Local Auth Simulate
      const session: UserSession = { email, id: "local-user-id", isAuthenticated: true };
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(session));
      return { success: true, user: session };
    }
  },

  async signIn(email: string, pass: string): Promise<{ success: boolean; user?: any; error?: string }> {
    const config = getSupabaseConfig();
    if (supabaseClient && config.isConfigured) {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });
      if (error) return { success: false, error: error.message };
      return { success: true, user: data.user };
    } else {
      // Local Auth Simulate
      const session: UserSession = { email, id: "local-user-id", isAuthenticated: true };
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(session));
      return { success: true, user: session };
    }
  },

  async signOut() {
    const config = getSupabaseConfig();
    if (supabaseClient && config.isConfigured) {
      await supabaseClient.auth.signOut();
    }
    localStorage.removeItem(STORAGE_KEYS.USER);
  },

  async getCurrentSession(): Promise<UserSession> {
    const config = getSupabaseConfig();
    if (supabaseClient && config.isConfigured) {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session?.user) {
        return {
          email: session.user.email || null,
          id: session.user.id,
          isAuthenticated: true,
        };
      }
    }
    // Check local fallback
    const local = localStorage.getItem(STORAGE_KEYS.USER);
    if (local) {
      try {
        return JSON.parse(local);
      } catch {
        // Fallback
      }
    }
    return { email: null, id: null, isAuthenticated: false };
  },

  // --- Workflow Handlers ---
  async getWorkflows(): Promise<Workflow[]> {
    const config = getSupabaseConfig();
    if (supabaseClient && config.isConfigured) {
      try {
        const { data, error } = await supabaseClient
          .from("workflows")
          .select("*")
          .order("updated_at", { ascending: false });
        if (error) throw error;
        return data.map((item: any) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          nodes: item.nodes,
          connections: item.connections,
          isActive: item.is_active,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        }));
      } catch (err) {
        console.warn("Falling back to local database query since Supabase workflows read hit errors / missing schema table:", err);
      }
    }

    // LocalStorage Operations
    const saved = localStorage.getItem(STORAGE_KEYS.LOCAL_WF);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_WORKFLOWS;
      }
    } else {
      // Seed initially
      localStorage.setItem(STORAGE_KEYS.LOCAL_WF, JSON.stringify(DEFAULT_WORKFLOWS));
      return DEFAULT_WORKFLOWS;
    }
  },

  async saveWorkflow(wf: Workflow): Promise<Workflow> {
    const config = getSupabaseConfig();
    wf.updatedAt = new Date().toISOString();

    if (supabaseClient && config.isConfigured) {
      try {
        const user = (await supabaseClient.auth.getUser()).data.user;
        const payload = {
          name: wf.name,
          description: wf.description,
          nodes: wf.nodes,
          connections: wf.connections,
          is_active: wf.isActive || false,
          updated_at: wf.updatedAt,
          user_id: user?.id,
        };

        // Determine if insert or update based on uuid style length
        const isNew = wf.id.startsWith("wf-default-") || wf.id.length < 15;
        
        let resultData;
        if (isNew) {
          const { data, error } = await supabaseClient
            .from("workflows")
            .insert([payload])
            .select()
            .single();
          if (error) throw error;
          resultData = data;
        } else {
          const { data, error } = await supabaseClient
            .from("workflows")
            .update(payload)
            .eq("id", wf.id)
            .select()
            .single();
          if (error) throw error;
          resultData = data;
        }

        return {
          id: resultData.id,
          name: resultData.name,
          description: resultData.description,
          nodes: resultData.nodes,
          connections: resultData.connections,
          isActive: resultData.is_active,
          createdAt: resultData.created_at,
          updatedAt: resultData.updated_at,
        };
      } catch (err) {
        console.warn("Retrying workflow save locally because cloud DB schema is pending or write failed:", err);
      }
    }

    // Local Fallback Write
    const workflows = await this.getWorkflows();
    const cleanWf = { ...wf };
    if (cleanWf.id.startsWith("wf-default-") || cleanWf.id.length < 15) {
      // Generate unique numerical id matching database rows
      cleanWf.id = "wf_local_" + Math.random().toString(36).substring(2, 9);
      cleanWf.createdAt = new Date().toISOString();
      workflows.unshift(cleanWf);
    } else {
      const idx = workflows.findIndex((w) => w.id === wf.id);
      if (idx !== -1) {
        workflows[idx] = cleanWf;
      } else {
        workflows.unshift(cleanWf);
      }
    }

    localStorage.setItem(STORAGE_KEYS.LOCAL_WF, JSON.stringify(workflows));
    return cleanWf;
  },

  async deleteWorkflow(id: string): Promise<boolean> {
    const config = getSupabaseConfig();
    if (supabaseClient && config.isConfigured) {
      try {
        const { error } = await supabaseClient.from("workflows").delete().eq("id", id);
        if (!error) return true;
      } catch (err) {
        console.warn("Proceeding to delete local clone since remote db threw:", err);
      }
    }

    const workflows = await this.getWorkflows();
    const filtered = workflows.filter((w) => w.id !== id);
    localStorage.setItem(STORAGE_KEYS.LOCAL_WF, JSON.stringify(filtered));
    return true;
  },

  // --- Execution Logs Handlers ---
  async getExecutionLogs(): Promise<ExecutionLog[]> {
    const config = getSupabaseConfig();
    if (supabaseClient && config.isConfigured) {
      try {
        const { data, error } = await supabaseClient
          .from("execution_logs")
          .select("*")
          .order("started_at", { ascending: false });
        if (error) throw error;
        return data.map((item: any) => ({
          id: item.id,
          workflowId: item.workflow_id,
          workflowName: item.workflow_name,
          startedAt: item.started_at,
          endedAt: item.ended_at,
          status: item.status,
          steps: item.steps,
        }));
      } catch {
        // Fallback
      }
    }

    const saved = localStorage.getItem(STORAGE_KEYS.LOCAL_LOGS);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  },

  async saveExecutionLog(log: ExecutionLog): Promise<ExecutionLog> {
    const config = getSupabaseConfig();
    if (supabaseClient && config.isConfigured) {
      try {
        const user = (await supabaseClient.auth.getUser()).data.user;
        const payload = {
          workflow_id: log.workflowId,
          workflow_name: log.workflowName,
          started_at: log.startedAt,
          ended_at: log.endedAt,
          status: log.status,
          steps: log.steps,
          user_id: user?.id,
        };

        const { data, error } = await supabaseClient
          .from("execution_logs")
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        return {
          id: data.id,
          workflowId: data.workflow_id,
          workflowName: data.workflow_name,
          startedAt: data.started_at,
          endedAt: data.ended_at,
          status: data.status,
          steps: data.steps,
        };
      } catch {
        // Fallback
      }
    }

    // LocalStorage Operations
    const logs = await this.getExecutionLogs();
    const cleanLog = { ...log };
    if (cleanLog.id.length < 10) {
      cleanLog.id = "log_" + Math.random().toString(36).substring(2, 9);
    }
    logs.unshift(cleanLog);
    // Keep last 15 execution runs to avoid crowding local memory
    if (logs.length > 15) {
      logs.length = 15;
    }
    localStorage.setItem(STORAGE_KEYS.LOCAL_LOGS, JSON.stringify(logs));
    return cleanLog;
  },
};
