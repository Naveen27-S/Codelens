/**
 * src/services/dashboardHistoryService.ts
 *
 * Frontend service for the /api/dashboard/history/* endpoints.
 * Automatically records dashboard events (page open, program open,
 * visualization open, etc.) into MongoDB via the backend.
 */

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// ── Types ──────────────────────────────────────────────────────────────────────

export type DashboardEventType =
  | 'dashboard_open'
  | 'program_open'
  | 'visualization_open'
  | 'activity_filter'
  | 'stat_view'
  | 'history_search';

export interface DashboardHistoryEvent {
  id: string;
  user_id: number;
  event_type: DashboardEventType | string;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  created_at?: string;
}

export interface DashboardHistoryListResult {
  items: DashboardHistoryEvent[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface DashboardHistoryStats {
  total: number;
  today: number;
  this_week: number;
  this_month: number;
  by_event_type: Record<string, number>;
}

export interface RecordEventPayload {
  event_type: DashboardEventType | string;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
}

// ── helpers ────────────────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('codelens_jwt');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── API functions ──────────────────────────────────────────────────────────────

/**
 * Record a dashboard history event in MongoDB.
 * Silently fails if the user is not logged in or the backend is unreachable.
 */
export async function recordDashboardEvent(
  payload: RecordEventPayload
): Promise<DashboardHistoryEvent | null> {
  try {
    const res = await axios.post<DashboardHistoryEvent>(
      `${API_URL}/dashboard/history`,
      payload,
      { headers: authHeaders() }
    );
    return res.data;
  } catch {
    return null; // non-blocking — never crash the UI
  }
}

/**
 * Fetch paginated & filtered dashboard history events.
 */
export async function fetchDashboardHistory(options: {
  event_type?: string;
  date_range?: string;
  search?: string;
  page?: number;
  limit?: number;
} = {}): Promise<DashboardHistoryListResult> {
  const { event_type, date_range, search, page = 1, limit = 20 } = options;
  const params = new URLSearchParams();
  if (event_type && event_type !== 'all') params.append('event_type', event_type);
  if (date_range && date_range !== 'all') params.append('date_range', date_range);
  if (search) params.append('search', search);
  params.append('page', String(page));
  params.append('limit', String(limit));

  try {
    const res = await axios.get<DashboardHistoryListResult>(
      `${API_URL}/dashboard/history?${params.toString()}`,
      { headers: authHeaders() }
    );
    return res.data;
  } catch {
    return { items: [], total: 0, page, limit, pages: 1 };
  }
}

/**
 * Fetch the most recent N dashboard history events (for timeline cards).
 */
export async function fetchRecentDashboardHistory(
  limit = 10
): Promise<DashboardHistoryEvent[]> {
  try {
    const res = await axios.get<DashboardHistoryEvent[]>(
      `${API_URL}/dashboard/history/recent?limit=${limit}`,
      { headers: authHeaders() }
    );
    return res.data;
  } catch {
    return [];
  }
}

/**
 * Fetch aggregate stats for the user's dashboard history.
 */
export async function fetchDashboardHistoryStats(): Promise<DashboardHistoryStats> {
  try {
    const res = await axios.get<DashboardHistoryStats>(
      `${API_URL}/dashboard/history/stats`,
      { headers: authHeaders() }
    );
    return res.data;
  } catch {
    return { total: 0, today: 0, this_week: 0, this_month: 0, by_event_type: {} };
  }
}

/**
 * Delete a single dashboard history record by id.
 */
export async function deleteDashboardHistoryItem(id: string): Promise<boolean> {
  try {
    await axios.delete(`${API_URL}/dashboard/history/${id}`, {
      headers: authHeaders(),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete ALL dashboard history events for the current user.
 */
export async function clearAllDashboardHistory(): Promise<number> {
  try {
    const res = await axios.delete<{ deleted_count: number }>(
      `${API_URL}/dashboard/history`,
      { headers: authHeaders() }
    );
    return res.data.deleted_count ?? 0;
  } catch {
    return 0;
  }
}
