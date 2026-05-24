/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type NodeType =
  | 'webhook'
  | 'schedule'
  | 'prompt'
  | 'click'
  | 'gemini'
  | 'summarize'
  | 'filter'
  | 'email'
  | 'slack'
  | 'github'
  | 'discord'
  | 'http';

export interface WorkflowNode {
  id: string;
  type: NodeType;
  name: string;
  x: number;
  y: number;
  config: Record<string, any>;
  status?: 'idle' | 'running' | 'success' | 'failed';
  result?: any;
  logs?: string;
}

export interface WorkflowConnection {
  fromNodeId: string;
  fromPort: string; // usually 'output' (or 'true' / 'false' branches for conditions)
  toNodeId: string;
  toPort: string; // usually 'input'
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  createdAt: string;
  updatedAt: string;
  isActive?: boolean;
}

export interface ExecutionLog {
  id: string;
  workflowId: string;
  workflowName: string;
  startedAt: string;
  endedAt: string;
  status: 'success' | 'failed' | 'partial';
  steps: Array<{
    nodeId: string;
    nodeName: string;
    nodeType: NodeType;
    status: 'success' | 'failed';
    duration: number;
    output?: any;
    logs?: string;
  }>;
}

export interface SupabaseConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  isConnected: boolean;
  useLocalFallback: boolean;
}

export interface UserSession {
  email: string | null;
  id: string | null;
  isAuthenticated: boolean;
}
