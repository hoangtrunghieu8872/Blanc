import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const generateContestDescription = async (title: string, tags: string[]): Promise<string> => {
  if (!apiKey) {
    console.warn("API Key is missing. Returning mock data.");
    return "This is a mock description because the API key is missing. Please add an API key to use AI features.";
  }

  try {
    const prompt = `Write a short, exciting description (max 100 words) for a student coding contest titled "${title}". 
    The contest focuses on these topics: ${tags.join(', ')}. 
    Tone: Professional yet encouraging for university students.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "No description generated.";
  } catch (error) {
    console.error("Error generating content:", error);
    return "Failed to generate description due to an API error.";
  }
};

export const analyzePlatformStats = async (stats: any): Promise<string> => {
  if (!apiKey) return "AI insights require an API Key.";

  try {
    const prompt = `Analyze these platform stats briefly and give 2 key insights for an admin: ${JSON.stringify(stats)}`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "No insights available.";
  } catch (e) {
    return "Could not analyze stats.";
  }
};

export const generateCourseSyllabus = async (title: string, level: string): Promise<string> => {
  if (!apiKey) return "AI Syllabus generation requires an API Key.";

  try {
    const prompt = `Create a concise course description and a 4-week syllabus outline for a "${level}" level course titled "${title}". Format it clearly with "Description:" followed by "Syllabus:".`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "No content generated.";
  } catch (error) {
    console.error("Error generating content:", error);
    return "Failed to generate syllabus.";
  }
};

export const generateSystemAnnouncement = async (topic: string, audience: string): Promise<string> => {
  if (!apiKey) return "AI features require an API Key.";

  try {
    const prompt = `Write a professional system announcement for a university platform named "Blanc". 
    Topic: "${topic}". 
    Target Audience: "${audience}". 
    Tone: Clear, polite, and informative.
    Format: Subject line followed by the body text.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "No announcement generated.";
  } catch (error) {
    console.error("Error generating announcement:", error);
    return "Failed to generate announcement.";
  }
};

export const analyzeAuditLogs = async (logs: any[]): Promise<string> => {
  if (!apiKey) return "AI Analysis requires an API Key.";

  try {
    const prompt = `Analyze the following system audit logs for security risks or anomalies. 
        Logs: ${JSON.stringify(logs)}.
        Provide a concise summary (3-4 bullet points) of potential threats or important actions the admin should notice.
        Focus on failed logins, bans, and critical setting changes.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "No analysis available.";
  } catch (error) {
    console.error("Error analyzing logs:", error);
    return "Failed to analyze logs.";
  }
};