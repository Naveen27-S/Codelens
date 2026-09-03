/**
 * executionService.ts
 *
 * Frontend service layer for CodeLens AI Code Execution and History Management.
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export interface ExecutionRecord {
  execution_id: string;
  user_id: number;
  program_id?: string | null;
  program_name: string;
  language: string;
  code: string;
  input?: string;
  status: 'success' | 'compilation_error' | 'runtime_error' | 'timeout' | 'memory_limit' | 'execution_error' | string;
  stdout: string;
  stderr: string;
  execution_time: number;
  memory_used?: number | null;
  created_at: string;
}

export interface ExecutionStats {
  total: number;
  successful: number;
  failed: number;
}

export interface ExecutionListResponse {
  items: ExecutionRecord[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  stats: ExecutionStats;
}

/**
 * Fetch paginated execution history for the currently logged in user.
 */
export async function fetchExecutions(
  page: number = 1,
  limit: number = 10,
  status?: string,
  language?: string
): Promise<ExecutionListResponse> {
  const params: Record<string, any> = { page, limit };
  if (status && status !== 'all') params.status = status;
  if (language && language !== 'all') params.language = language;

  const response = await axios.get<ExecutionListResponse>(`${API_BASE_URL}/executions`, {
    params,
    withCredentials: true,
  });
  return response.data;
}

/**
 * Retrieve full execution details for a specific execution ID.
 */
export async function fetchExecutionById(executionId: string): Promise<ExecutionRecord> {
  const response = await axios.get<ExecutionRecord>(`${API_BASE_URL}/executions/${executionId}`, {
    withCredentials: true,
  });
  return response.data;
}

/**
 * Delete a user's execution record from history.
 */
export async function deleteExecutionRecord(executionId: string): Promise<void> {
  await axios.delete(`${API_BASE_URL}/executions/${executionId}`, {
    withCredentials: true,
  });
}
