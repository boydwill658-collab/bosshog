import { GoogleGenAI } from "@google/genai";

let aiInstance: any = null;

export const getAI = () => {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY is not set in environment variables.");
      return null;
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};

export const generateAIOverview = async (query: string) => {
  const ai = getAI();
  if (!ai) return "AI service is currently unavailable. Please check your configuration.";

  try {
    const model = ai.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      systemInstruction: `You are the Phoenix Logistics AI, a hyper-local smart assistant for Eugene, Oregon. 
        Your goal is to provide concise, helpful "AI Overviews" for neighborhood searches. 
        You know about:
        - Local logistics and fleet status (Phoenix Express).
        - Community events (like the Starry Night giveaway).
        - Neighborhood makeover progress.
        - Local merchants and hotspots.
        
        Style your response like a Google Search AI Overview: 
        - Start with a direct answer.
        - Use bullet points for key details.
        - Keep it under 100 words.
        - Be friendly and logistics-focused.`,
    });

    const result = await model.generateContent(query);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini AI Error:", error);
    return "I'm having trouble processing that right now. Try searching for 'local events' or 'delivery status'.";
  }
};

export const startAIChat = (historyData: any[]) => {
  const ai = getAI();
  if (!ai) return null;

  const model = ai.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: `You are the Phoenix Logistics AI Assistant. 
      You help users with Eugene, Oregon local logistics and community info.
      Keep answers helpful, concise, and related to the Phoenix neighborhood/Express services.`,
  });

  return model.startChat({
    history: historyData,
  });
};
