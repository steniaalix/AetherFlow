import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Workflow, ExecutionLog, UserSession, AccountRole, ActivityLog } from "../types";

// Helper keys for LocalStorage override settings
const STORAGE_KEYS = {
  URL: "auraflow_supabase_url",
  KEY: "auraflow_supabase_key",
  LOCAL_WF: "auraflow_workflows",
  LOCAL_LOGS: "auraflow_logs",
  LOCAL_ACTIVITY_LOGS: "auraflow_activity_logs",
  USER: "auraflow_user",
};

function normalizeAccountRole(role: unknown): AccountRole {
  return role === "worker" || role === "team" ? "worker" : "customer";
}

async function persistUserProfile(user: any, accountRole: AccountRole) {
  if (!supabaseClient || !user?.id) return;

  try {
    await supabaseClient.from("profiles").upsert({
      id: user.id,
      email: user.email || null,
      account_role: accountRole,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("Profile role sync skipped. Confirm the Supabase schema has the account_role column and insert/update policies.", err);
  }
}

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

function toUserSession(user: any, accountRole?: AccountRole): UserSession {
  return {
    email: user?.email || null,
    id: user?.id || null,
    isAuthenticated: !!user?.id,
    accountRole: normalizeAccountRole(user?.user_metadata?.accountRole || accountRole),
  };
}

async function requireAuthenticatedUser() {
  if (!supabaseClient) {
    throw new Error("Supabase client is not configured.");
  }

  const { data, error } = await supabaseClient.auth.getUser();
  if (error) {
    throw error;
  }
  if (!data.user?.id) {
    throw new Error("You must sign in before saving to Supabase.");
  }
  return data.user;
}

// SQL Schema code to display in UI for helpful documentation
export const SUPABASE_SQL_SCHEMA = `-- AuraFlow Workflow Automation Database Schema
-- Run this in your Supabase SQL Editor to provision tables!

grant usage on schema public to anon, authenticated;

-- Create profiles table (integrated with Supabase Auth)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  account_role text not null default 'customer' check (account_role in ('worker', 'customer')),
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable row level security (RLS)
alter table public.profiles enable row level security;

grant select, insert, update on public.profiles to authenticated;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Automatically create a profile row whenever Supabase Auth creates a user.
-- Passwords are not stored here. Supabase Auth stores and verifies them securely.
create schema if not exists private;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update
    set email = excluded.email,
        updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure private.handle_new_user();

-- Create workflows table
create table if not exists public.workflows (
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

grant select, insert, update, delete on public.workflows to authenticated;

drop policy if exists "Users can view own workflows" on public.workflows;
create policy "Users can view own workflows" on public.workflows
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own workflows" on public.workflows;
create policy "Users can insert own workflows" on public.workflows
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own workflows" on public.workflows;
create policy "Users can update own workflows" on public.workflows
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own workflows" on public.workflows;
create policy "Users can delete own workflows" on public.workflows
  for delete using (auth.uid() = user_id);

-- Create execution logs table
create table if not exists public.execution_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade,
  workflow_id text not null,
  workflow_name text not null,
  started_at timestamp with time zone default timezone('utc'::text, now()) not null,
  ended_at timestamp with time zone default timezone('utc'::text, now()) not null,
  status text not null, -- 'success', 'failed', 'partial'
  steps jsonb not null default '[]'::jsonb
);

alter table public.execution_logs enable row level security;

grant select, insert on public.execution_logs to authenticated;

drop policy if exists "Users can view own execution logs" on public.execution_logs;
create policy "Users can view own execution logs" on public.execution_logs
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own execution logs" on public.execution_logs;
create policy "Users can insert own execution logs" on public.execution_logs
  for insert with check (auth.uid() = user_id);

-- Create user activity logs table
create table if not exists public.activity_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade,
  action text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.activity_logs enable row level security;

grant select, insert on public.activity_logs to authenticated;

drop policy if exists "Users can view own activity logs" on public.activity_logs;
create policy "Users can view own activity logs" on public.activity_logs
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own activity logs" on public.activity_logs;
create policy "Users can insert own activity logs" on public.activity_logs
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

  async diagnoseCloudWrites(): Promise<{ success: boolean; msg: string }> {
    const config = getSupabaseConfig();
    if (!supabaseClient || !config.isConfigured) {
      return { success: false, msg: "Supabase is not configured in this browser session." };
    }

    try {
      const user = await requireAuthenticatedUser();
      const stamp = new Date().toISOString();

      const activityResult = await supabaseClient
        .from("activity_logs")
        .insert([{
          user_id: user.id,
          action: "diagnostic.write_test",
          message: "Supabase write diagnostic.",
          metadata: { source: "SupabaseConfigModal", stamp },
        }])
        .select("id")
        .single();
      if (activityResult.error) {
        return { success: false, msg: `activity_logs write failed: ${activityResult.error.message}` };
      }

      const workflowResult = await supabaseClient
        .from("workflows")
        .insert([{
          user_id: user.id,
          name: "Diagnostic Write Test",
          description: "Temporary workflow created by the Supabase connection diagnostic.",
          nodes: [],
          connections: [],
          is_active: false,
        }])
        .select("id")
        .single();
      if (workflowResult.error) {
        return { success: false, msg: `workflows write failed: ${workflowResult.error.message}` };
      }

      const executionResult = await supabaseClient
        .from("execution_logs")
        .insert([{
          user_id: user.id,
          workflow_id: workflowResult.data.id,
          workflow_name: "Diagnostic Write Test",
          started_at: stamp,
          ended_at: stamp,
          status: "success",
          steps: [],
        }])
        .select("id")
        .single();
      if (executionResult.error) {
        return { success: false, msg: `execution_logs write failed: ${executionResult.error.message}` };
      }

      const deleteResult = await supabaseClient
        .from("workflows")
        .delete()
        .eq("id", workflowResult.data.id);
      if (deleteResult.error) {
        return { success: false, msg: `writes worked, but workflow cleanup failed: ${deleteResult.error.message}` };
      }

      return { success: true, msg: "Cloud write diagnostic passed for activity_logs, workflows, and execution_logs." };
    } catch (err: any) {
      const message = err?.message || String(err);
      if (message.toLowerCase().includes("auth session missing")) {
        return {
          success: false,
          msg: "Supabase is connected, but you are not signed in inside AetherFlow. Close this modal, sign in with your AetherFlow account, then run Test DB again.",
        };
      }
      return { success: false, msg: message };
    }
  },

  // --- Authentication Handlers ---
  async signUp(email: string, pass: string, accountRole: AccountRole): Promise<{ success: boolean; user?: any; session?: UserSession; error?: string }> {
    const config = getSupabaseConfig();
    if (supabaseClient && config.isConfigured) {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password: pass,
        options: {
          data: { accountRole },
        },
      });
      if (error) return { success: false, error: error.message };
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        return {
          success: false,
          error: "An account with this email already exists. Sign in with the original password, or reset the password from Supabase/Auth.",
        };
      }
      await persistUserProfile(data.user, accountRole);
      if (!data.session) {
        return {
          success: true,
          user: {
            email: data.user?.email || email,
            id: data.user?.id || null,
            isAuthenticated: false,
            accountRole,
            needsEmailConfirmation: true,
          },
        };
      }
      return {
        success: true,
        user: data.user,
        session: toUserSession(data.user, accountRole),
      };
    } else {
      // Local Auth Simulate
      const session: UserSession = { email, id: `local-${accountRole}-id`, isAuthenticated: true, accountRole };
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(session));
      return { success: true, user: session, session };
    }
  },

  async signIn(email: string, pass: string, accountRole: AccountRole): Promise<{ success: boolean; user?: any; session?: UserSession; error?: string }> {
    const config = getSupabaseConfig();
    if (supabaseClient && config.isConfigured) {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });
      if (error) {
        const message = error.message.toLowerCase().includes("invalid login credentials")
          ? "Invalid login credentials. If you just registered, confirm your email first or turn off email confirmations in Supabase Auth settings for local testing."
          : error.message;
        return { success: false, error: message };
      }
      const resolvedRole = normalizeAccountRole(data.user?.user_metadata?.accountRole || accountRole);
      await persistUserProfile(data.user, resolvedRole);
      return {
        success: true,
        user: data.user,
        session: toUserSession(data.user, resolvedRole),
      };
    } else {
      // Local Auth Simulate
      const session: UserSession = { email, id: `local-${accountRole}-id`, isAuthenticated: true, accountRole };
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(session));
      return { success: true, user: session, session };
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
          accountRole: normalizeAccountRole(session.user.user_metadata?.accountRole),
        };
      }
    }
    // Check local fallback
    const local = localStorage.getItem(STORAGE_KEYS.USER);
    if (local) {
      try {
        const parsed = JSON.parse(local);
        return {
          ...parsed,
          accountRole: normalizeAccountRole(parsed.accountRole),
        };
      } catch {
        // Fallback
      }
    }
    return { email: null, id: null, isAuthenticated: false, accountRole: "customer" };
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
        const user = await requireAuthenticatedUser();
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
        console.error("Supabase workflow save failed:", err);
        throw err;
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
        await requireAuthenticatedUser();
        const { error } = await supabaseClient.from("workflows").delete().eq("id", id);
        if (!error) return true;
        throw error;
      } catch (err) {
        console.error("Supabase workflow delete failed:", err);
        throw err;
      }
    }

    const workflows = await this.getWorkflows();
    const filtered = workflows.filter((w) => w.id !== id);
    localStorage.setItem(STORAGE_KEYS.LOCAL_WF, JSON.stringify(filtered));
    return true;
  },

  // --- User Activity Log Handlers ---
  async getActivityLogs(): Promise<ActivityLog[]> {
    const config = getSupabaseConfig();
    if (supabaseClient && config.isConfigured) {
      try {
        const { data, error } = await supabaseClient
          .from("activity_logs")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return data.map((item: any) => ({
          id: item.id,
          action: item.action,
          message: item.message,
          metadata: item.metadata,
          createdAt: item.created_at,
        }));
      } catch (err) {
        console.warn("Falling back to local activity logs because Supabase activity read failed:", err);
      }
    }

    const saved = localStorage.getItem(STORAGE_KEYS.LOCAL_ACTIVITY_LOGS);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  },

  async saveActivityLog(action: string, message: string, metadata: Record<string, any> = {}): Promise<ActivityLog> {
    const createdAt = new Date().toISOString();
    const config = getSupabaseConfig();

    if (supabaseClient && config.isConfigured) {
      try {
        const user = await requireAuthenticatedUser();
        const { data, error } = await supabaseClient
          .from("activity_logs")
          .insert([{
            user_id: user.id,
            action,
            message,
            metadata,
            created_at: createdAt,
          }])
          .select()
          .single();
        if (error) throw error;
        return {
          id: data.id,
          action: data.action,
          message: data.message,
          metadata: data.metadata,
          createdAt: data.created_at,
        };
      } catch (err) {
        console.error("Supabase activity log insert failed:", err);
        throw err;
      }
    }

    const logs = await this.getActivityLogs();
    const localLog: ActivityLog = {
      id: "activity_" + Math.random().toString(36).substring(2, 9),
      action,
      message,
      metadata,
      createdAt,
    };
    logs.unshift(localLog);
    if (logs.length > 50) {
      logs.length = 50;
    }
    localStorage.setItem(STORAGE_KEYS.LOCAL_ACTIVITY_LOGS, JSON.stringify(logs));
    return localLog;
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
        const user = await requireAuthenticatedUser();
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
      } catch (err) {
        console.error("Supabase execution log insert failed:", err);
        throw err;
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
