
import { GoogleGenAI, Modality } from "@google/genai";
import { Book, StoryStage, Chapter, Message } from "../types";

/**
 * Initiates a new story based on an uploaded image.
 * Uses gemini-3-pro-preview for advanced reasoning and creative writing.
 */
export const startStory = async (imageBase64: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: imageBase64.split(',')[1],
          },
        },
        {
          text: `You are an expert storytelling mentor. Analyze this image and write a captivating "Hook" (Introduction) for a new story. 
          Write approximately 150 words. Focus on sensory details and mood.
          End the paragraph with a prompt for the user to decide what happens next.
          Format your response as a JSON object with:
          "title": "A fitting title for this book",
          "storyText": "The actual narrative content",
          "userPrompt": "The specific question for the user"`
        }
      ]
    },
    config: { responseMimeType: 'application/json' }
  });

  return JSON.parse(response.text || '{}');
};

/**
 * Continues the story based on user input and current plot progression.
 */
export const continueStory = async (book: Book, userInput: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const history = book.chapters.map(c => `[${c.stage}] AI: ${c.aiText}\nUser: ${c.userContribution}`).join('\n\n');
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Historical Context:\n${history}\n\nUser Input for the next scene: ${userInput}\n\n
    Current Story Stage: ${book.currentStage}. 
    Instruction: Write the next section of the story (150-200 words). 
    If the current stage feels complete, move to the next stage in the sequence: Introduction -> Inciting Incident -> Rising Action -> Climax -> Falling Action -> Resolution.
    
    Format your response as a JSON object:
    "storyText": "The next narrative paragraph",
    "nextStage": "One of the valid StoryStage names if changing, otherwise the current one",
    "userPrompt": "A prompt asking the user for their next contribution"`,
    config: { responseMimeType: 'application/json' }
  });

  return JSON.parse(response.text || '{}');
};

/**
 * Generates an illustration for a specific chapter.
 * Uses gemini-2.5-flash-image as the default image generation model.
 */
export const generateIllustration = async (chapter: Chapter, previousChapters: Chapter[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const context = previousChapters.slice(-2).map(c => c.aiText).join(' ');
  const prompt = `Digital art style, cinematic lighting. Based on this scene: ${chapter.aiText}. Maintain visual consistency with these previous elements: ${context}. Do not include text in the image.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: prompt }] },
    config: {
      imageConfig: { aspectRatio: "16:9" }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    // Find the inline data part which contains the generated image base64
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return null;
};

/**
 * Generates speech narration for the story text.
 */
export const generateNarration = async (text: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
};

/**
 * Provides helpful advice and ideas to the user via the Story Assistant chat.
 * Uses gemini-3-flash-preview for fast, conversational responses.
 */
export const chatWithStory = async (history: Message[], userInput: string, storyContext: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Convert application Message format to Gemini API contents format
  const contents = history.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));
  
  // Add the current user query
  contents.push({
    role: 'user',
    parts: [{ text: userInput }]
  });

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents,
    config: {
      systemInstruction: `You are a creative writing assistant. 
      The current story context is: ${storyContext}. 
      Help the user with ideas, world-building, or character development based on this story context.`
    }
  });

  return response.text || "I apologize, but I couldn't form a thought right now.";
};
