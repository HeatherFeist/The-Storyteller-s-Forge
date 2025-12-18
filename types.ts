
export enum StoryStage {
  INTRODUCTION = 'Introduction & Hook',
  INCITING_INCIDENT = 'Inciting Incident',
  RISING_ACTION = 'Rising Action',
  CLIMAX = 'Climax',
  FALLING_ACTION = 'Falling Action',
  RESOLUTION = 'Resolution'
}

export const STAGE_DESCRIPTIONS: Record<StoryStage, string> = {
  [StoryStage.INTRODUCTION]: "The Hook. Grab the reader's attention and establish the world and tone.",
  [StoryStage.INCITING_INCIDENT]: "The Spark. An event that upsets the status quo and starts the protagonist's journey.",
  [StoryStage.RISING_ACTION]: "The Journey. A series of events that build tension and develop the characters.",
  [StoryStage.CLIMAX]: "The Peak. The most intense point of the story where the main conflict reaches its head.",
  [StoryStage.FALLING_ACTION]: "The Aftermath. The fallout from the climax where loose ends start to tie up.",
  [StoryStage.RESOLUTION]: "The New Normal. The final conclusion where the world find its new equilibrium."
};

export interface StoryIdea {
  id: string;
  protagonist: string;
  plotHook: string;
  tone: string;
}

export interface Chapter {
  id: string;
  stage: StoryStage;
  aiText: string;
  userContribution: string;
  illustration: string | null;
  timestamp: number;
}

export interface Book {
  title: string;
  chapters: Chapter[];
  currentStage: StoryStage;
}

export interface StoryState {
  book: Book | null;
  isGenerating: boolean;
  isIllustrating: boolean;
  error: string | null;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}
