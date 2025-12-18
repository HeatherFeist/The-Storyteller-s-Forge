
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { Book, StoryStage, Chapter, Message, StoryIdea } from "../types";

/**
 * Generates initial story directions based on an image and a brief vision prompt.
 */
export const generateBookIdeas = async (imageBase64: string, userVision: string): Promise<StoryIdea[]> => {
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
          text: `The user has a vision for a book: "${userVision}". 
          Analyze the image and this vision to provide 3 distinct story directions.
          Each direction should specify a protagonist (include age/gender/role like "A teenage girl who can see spirits") and a plot hook.
          Format your response as a JSON array of objects with fields: "protagonist", "plotHook", "tone".`
        }
      ]
    },
    config: { 
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            protagonist: { type: Type.STRING },
            plotHook: { type: Type.STRING },
            tone: { type: Type.STRING }
          },
          required: ["protagonist", "plotHook", "tone"]
        }
      }
    }
  });

  const ideas = JSON.parse(response.text || '[]');
  return ideas.map((idea: any, idx: number) => ({ ...idea, id: `idea-${idx}` }));
};

/**
 * Initiates a new story based on an uploaded image and a chosen story idea.
 */
export const startStory = async (imageBase64: string, chosenIdea: StoryIdea) => {
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
          text: `You are an expert storytelling mentor. Based on the protagonist "${chosenIdea.protagonist}" and plot hook "${chosenIdea.plotHook}", write a captivating "Introduction" (Chapter 1) for a new story. 
          The tone should be ${chosenIdea.tone}. 
          Write approximately 150-200 words. Focus on sensory details and mood.
          Format your response as a JSON object with:
          "title": "A fitting title for this book",
          "storyText": "The actual narrative content",
          "educationalNote": "A brief explanation of why this is a good 'Introduction' and what 'The Hook' means in storytelling."`
        }
      ]
    },
    config: { responseMimeType: 'application/json' }
  });

  return JSON.parse(response.text || '{}');
};

/**
 * Continues the story collaboratively.
 */
export const continueStory = async (book: Book, userInput: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const history = book.chapters.map(c => `[${c.stage}] AI: ${c.aiText}\nUser Contribution: ${c.userContribution}`).join('\n\n');
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Full Story Context So Far:\n${history}\n\nUser's Latest Idea/Action: ${userInput}\n\n
    Current Story Stage: ${book.currentStage}. 
    Instruction: Write the next narrative sequence (150-200 words). 
    If it's time to progress from ${book.currentStage} to the next logical stage, do so.
    
    Format your response as a JSON object:
    "storyText": "The next narrative paragraph",
    "nextStage": "The name of the StoryStage (e.g., 'Climax')",
    "educationalNote": "A short writing tip explaining this specific stage of story structure."`,
    config: { responseMimeType: 'application/json' }
  });

  return JSON.parse(response.text || '{}');
};

/**
 * Generates an illustration for a specific chapter.
 */
export const generateIllustration = async (chapter: Chapter, previousChapters: Chapter[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const context = previousChapters.slice(-3).map(c => c.aiText.substring(0, 100)).join('; ');
  const prompt = `Epic book illustration style. Scene: ${chapter.aiText}. Elements to maintain: ${context}. High quality, atmospheric, no text.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: prompt }] },
    config: {
      imageConfig: { aspectRatio: "16:9" }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return null;
};

/**
 * Narrates text.
 */
export const generateNarration = async (text: string, voiceName: string = 'Zephyr') => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Read this passage with deep emotion and atmosphere: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });

  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
};

export const chatWithStory = async (history: Message[], userInput: string, storyContext: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const contents = history.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));
  contents.push({ role: 'user', parts: [{ text: userInput }] });

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents,
    config: {
      systemInstruction: `You are a writing coach. Help the user improve their story: ${storyContext}. Suggest plot twists, character names, or sensory details.`
    }
  });

  return response.text || "I'm listening...";
};
