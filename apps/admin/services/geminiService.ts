import api, { ApiError } from './api';

type GeminiTextResponse = { text?: string };

async function requestText(endpoint: string, body: unknown, fallback: string) {
  try {
    const response = await api.post<GeminiTextResponse>(endpoint, body);
    const text = response.data?.text;
    return typeof text === 'string' && text.trim() ? text : fallback;
  } catch (err) {
    if (err instanceof ApiError) return err.message || fallback;
    return fallback;
  }
}

export const generateContestDescription = async (title: string, tags: string[]): Promise<string> =>
  requestText(
    '/admin/ai/gemini/contest-description',
    { title, tags },
    'No description generated.'
  );

export const analyzePlatformStats = async (stats: any): Promise<string> =>
  requestText(
    '/admin/ai/gemini/platform-stats',
    { stats },
    'No insights available.'
  );

export const generateCourseSyllabus = async (title: string, level: string): Promise<string> =>
  requestText(
    '/admin/ai/gemini/course-syllabus',
    { title, level },
    'No syllabus generated.'
  );

export const generateSystemAnnouncement = async (topic: string, audience: string): Promise<string> =>
  requestText(
    '/admin/ai/gemini/system-announcement',
    { topic, audience },
    'No announcement generated.'
  );

export const analyzeAuditLogs = async (logs: any[]): Promise<string> =>
  requestText(
    '/admin/ai/gemini/audit-logs',
    { logs },
    'No analysis available.'
  );

