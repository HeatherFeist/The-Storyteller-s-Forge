
import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, Volume2, Sparkles, Loader2, RefreshCw, 
  BookOpen, Feather, PenTool, Image as ImageIcon,
  Save, Download, ChevronRight, Info, Edit3, Check
} from 'lucide-react';
import { Book, StoryStage, STAGE_DESCRIPTIONS, Chapter } from './types';
import { startStory, continueStory, generateIllustration, generateNarration } from './services/geminiService';
import { decode, decodeAudioData } from './utils/audio';

const App: React.FC = () => {
  const [book, setBook] = useState<Book | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isIllustrating, setIsIllustrating] = useState<string | null>(null);
  const [userInput, setUserInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isNarrating, setIsNarrating] = useState<string | null>(null);
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [audioContext] = useState(() => new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 }));
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('current_book');
    if (saved) setBook(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (book) localStorage.setItem('current_book', JSON.stringify(book));
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [book]);

  const handleStart = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setIsGenerating(true);
      setError(null);
      try {
        const result = await startStory(base64);
        const firstChapter: Chapter = {
          id: Math.random().toString(36).substr(2, 9),
          stage: StoryStage.INTRODUCTION,
          aiText: result.storyText,
          userContribution: '',
          illustration: base64,
          timestamp: Date.now()
        };
        setBook({
          title: result.title,
          chapters: [firstChapter],
          currentStage: StoryStage.INTRODUCTION
        });
      } catch (err) {
        setError("The muse is silent. Try again with a different image.");
      } finally {
        setIsGenerating(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleContinue = async () => {
    if (!book || !userInput.trim() || isGenerating) return;
    setIsGenerating(true);
    try {
      const result = await continueStory(book, userInput);
      const newChapter: Chapter = {
        id: Math.random().toString(36).substr(2, 9),
        stage: result.nextStage || book.currentStage,
        aiText: result.storyText,
        userContribution: userInput,
        illustration: null,
        timestamp: Date.now()
      };
      setBook({
        ...book,
        chapters: [...book.chapters, newChapter],
        currentStage: result.nextStage || book.currentStage
      });
      setUserInput('');
    } catch (err) {
      setError("Failed to weave the next thread.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleIllustrate = async (chapterId: string) => {
    if (!book || isIllustrating) return;
    setIsIllustrating(chapterId);
    try {
      const chapter = book.chapters.find(c => c.id === chapterId);
      if (!chapter) return;
      const prevChapters = book.chapters.filter(c => c.timestamp < chapter.timestamp);
      const url = await generateIllustration(chapter, prevChapters);
      if (url) {
        setBook({
          ...book,
          chapters: book.chapters.map(c => c.id === chapterId ? { ...c, illustration: url } : c)
        });
      }
    } catch (err) {
      setError("Illustration failed. The ink ran dry.");
    } finally {
      setIsIllustrating(null);
    }
  };

  const handleNarrate = async (text: string, id: string) => {
    if (isNarrating) return;
    setIsNarrating(id);
    try {
      const base64 = await generateNarration(text);
      if (base64) {
        const buffer = await decodeAudioData(decode(base64), audioContext, 24000, 1);
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.onended = () => setIsNarrating(null);
        source.start();
      } else setIsNarrating(null);
    } catch {
      setIsNarrating(null);
    }
  };

  const handleEditChapter = (id: string, newText: string) => {
    if (!book) return;
    setBook({
      ...book,
      chapters: book.chapters.map(c => c.id === id ? { ...c, aiText: newText } : c)
    });
    setEditingChapterId(null);
  };

  const exportBook = () => {
    if (!book) return;
    const blob = new Blob([JSON.stringify(book, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${book.title.replace(/\s+/g, '_')}.json`;
    a.click();
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0f19] text-slate-200">
      {/* Background Decor */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none opacity-20 overflow-hidden">
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-indigo-500 rounded-full blur-[150px]" />
        <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-purple-500 rounded-full blur-[150px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 p-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600 p-2 rounded-xl"><Feather className="text-white" size={20} /></div>
          <h1 className="text-xl font-bold serif text-slate-100">{book?.title || 'The Storyteller’s Forge'}</h1>
        </div>
        {book && (
          <div className="flex items-center space-x-4">
            <button onClick={exportBook} className="flex items-center space-x-2 text-sm text-slate-400 hover:text-white transition-colors">
              <Download size={16} /> <span className="hidden sm:inline">Export</span>
            </button>
            <button onClick={() => { localStorage.removeItem('current_book'); setBook(null); }} className="p-2 text-slate-400 hover:text-white">
              <RefreshCw size={18} />
            </button>
          </div>
        )}
      </header>

      {!book && !isGenerating ? (
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-8 animate-in fade-in duration-700">
          <div className="max-w-2xl space-y-6">
            <h2 className="text-5xl font-bold serif leading-tight">Every masterpiece begins with a <span className="text-indigo-400">vision</span>.</h2>
            <p className="text-xl text-slate-400">Upload an image to spark your story. Learn the craft of storytelling as you write alongside an AI mentor.</p>
          </div>
          <label className="relative group cursor-pointer">
            <input type="file" className="hidden" accept="image/*" onChange={handleStart} />
            <div className="w-64 h-64 border-2 border-dashed border-slate-700 bg-slate-800/50 rounded-3xl flex flex-col items-center justify-center transition-all group-hover:border-indigo-500 group-hover:scale-105 shadow-2xl">
              <Upload className="text-slate-500 group-hover:text-indigo-400 mb-4" size={48} />
              <span className="font-medium text-slate-400 group-hover:text-slate-200">Begin Your Journey</span>
            </div>
          </label>
        </main>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-73px)]">
          {/* Main Story Area */}
          <main className="flex-1 overflow-y-auto p-6 md:p-12 space-y-12" ref={scrollRef}>
            {book?.chapters.map((chapter, idx) => (
              <section key={chapter.id} className="max-w-3xl mx-auto space-y-8 animate-in slide-in-from-bottom duration-500">
                {/* Stage Indicator */}
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-indigo-400/80">
                  <span className="flex items-center space-x-2">
                    <BookOpen size={14} /> <span>Chapter {idx + 1}: {chapter.stage}</span>
                  </span>
                  <span className="text-slate-500">{new Date(chapter.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>

                {/* User Contribution (if any) */}
                {chapter.userContribution && (
                  <div className="pl-6 border-l-2 border-indigo-900/50 italic text-slate-400 text-lg">
                    "{chapter.userContribution}"
                  </div>
                )}

                {/* AI Text Block */}
                <div className="relative group">
                  {editingChapterId === chapter.id ? (
                    <div className="space-y-4">
                      <textarea
                        defaultValue={chapter.aiText}
                        className="w-full bg-slate-800 border border-indigo-500 rounded-2xl p-6 text-xl serif leading-relaxed min-h-[200px] focus:outline-none"
                        id={`edit-${chapter.id}`}
                      />
                      <div className="flex justify-end space-x-2">
                        <button 
                          onClick={() => setEditingChapterId(null)}
                          className="px-4 py-2 text-sm text-slate-400"
                        >Cancel</button>
                        <button 
                          onClick={() => {
                            const val = (document.getElementById(`edit-${chapter.id}`) as HTMLTextAreaElement).value;
                            handleEditChapter(chapter.id, val);
                          }}
                          className="bg-indigo-600 px-4 py-2 rounded-lg text-sm flex items-center space-x-2"
                        >
                          <Check size={16} /> <span>Save Edit</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-2xl serif leading-relaxed text-slate-100 first-letter:text-5xl first-letter:float-left first-letter:mr-3 first-letter:text-indigo-500">
                        {chapter.aiText}
                      </p>
                      <div className="absolute -right-4 top-0 translate-x-full opacity-0 group-hover:opacity-100 transition-opacity flex flex-col space-y-2">
                        <button onClick={() => setEditingChapterId(chapter.id)} className="p-2 bg-slate-800 rounded-lg hover:text-indigo-400" title="Edit Paragraph"><Edit3 size={16}/></button>
                        <button onClick={() => handleNarrate(chapter.aiText, chapter.id)} className={`p-2 bg-slate-800 rounded-lg ${isNarrating === chapter.id ? 'text-indigo-400 animate-pulse' : 'hover:text-indigo-400'}`} title="Read Aloud"><Volume2 size={16}/></button>
                      </div>
                    </>
                  )}
                </div>

                {/* Illustration Block */}
                <div className="rounded-3xl overflow-hidden shadow-2xl bg-slate-800/50 min-h-[100px] flex items-center justify-center border border-slate-800 relative group">
                  {chapter.illustration ? (
                    <img src={chapter.illustration} alt="Scene illustration" className="w-full h-auto object-cover max-h-[500px]" />
                  ) : (
                    <button 
                      onClick={() => handleIllustrate(chapter.id)}
                      disabled={isIllustrating !== null}
                      className="flex flex-col items-center space-y-2 p-12 text-slate-500 hover:text-indigo-400 transition-colors"
                    >
                      {isIllustrating === chapter.id ? (
                        <Loader2 className="animate-spin" size={32} />
                      ) : (
                        <>
                          <ImageIcon size={32} />
                          <span className="text-sm font-medium">Visualize this scene</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </section>
            ))}

            {isGenerating && (
              <div className="max-w-3xl mx-auto flex items-center space-x-4 text-indigo-400 animate-pulse">
                <PenTool className="animate-bounce" />
                <span className="serif italic text-xl">The mentor is writing...</span>
              </div>
            )}
          </main>

          {/* Sidebar: Mentor & Writing Interface */}
          <aside className="w-full lg:w-[400px] border-l border-slate-800 bg-slate-900/50 flex flex-col">
            {/* Mentor Section */}
            <div className="p-6 border-b border-slate-800 space-y-4">
              <div className="flex items-center space-x-2 text-indigo-400">
                <Info size={18} />
                <h3 className="font-bold uppercase tracking-widest text-xs">Writing Mentor</h3>
              </div>
              <div className="bg-indigo-900/20 rounded-2xl p-4 border border-indigo-500/30">
                <p className="text-sm font-bold text-indigo-300 mb-1">{book?.currentStage}</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {book ? STAGE_DESCRIPTIONS[book.currentStage] : "Upload an image to begin your lesson."}
                </p>
              </div>
            </div>

            {/* Input Section */}
            <div className="p-6 flex-1 flex flex-col justify-end space-y-4 bg-gradient-to-t from-slate-900 to-transparent">
              {book && !isGenerating && (
                <div className="space-y-4 animate-in slide-in-from-right duration-500">
                  <div className="p-4 bg-slate-800 rounded-2xl border border-slate-700">
                    <p className="text-xs text-indigo-400 font-bold mb-2 uppercase tracking-tighter">Your Turn</p>
                    <textarea 
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      placeholder="What happens next? (e.g. 'Suddenly, the sky turned violet...')"
                      className="w-full bg-transparent text-slate-200 focus:outline-none min-h-[120px] resize-none text-lg"
                    />
                  </div>
                  <button 
                    onClick={handleContinue}
                    disabled={!userInput.trim() || isGenerating}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 p-4 rounded-2xl font-bold flex items-center justify-center space-x-2 shadow-xl shadow-indigo-900/20 transition-all hover:scale-[1.02]"
                  >
                    <span>Add to Story</span>
                    <ChevronRight size={20} />
                  </button>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {error && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-900/90 text-red-100 px-6 py-3 rounded-full flex items-center space-x-3 shadow-2xl z-[60]">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-xs font-bold hover:underline">Dismiss</button>
        </div>
      )}
    </div>
  );
};

export default App;
