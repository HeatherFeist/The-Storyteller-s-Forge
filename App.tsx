
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Upload, Volume2, Sparkles, Loader2, RefreshCw, 
  BookOpen, Feather, PenTool, Image as ImageIcon,
  Save, Download, ChevronRight, Info, Edit3, Check, Play, Settings, User as UserIcon,
  Search, X as CloseIcon
} from 'lucide-react';
import { Book, StoryStage, STAGE_DESCRIPTIONS, Chapter, StoryIdea } from './types';
import { startStory, continueStory, generateIllustration, generateNarration, generateBookIdeas } from './services/geminiService';
import { decode, decodeAudioData } from './utils/audio';
import ChatInterface from './components/ChatInterface';

const VOICES = ['Zephyr', 'Kore', 'Puck', 'Fenrir', 'Charon'];

/**
 * A helper component to render text with highlighted search terms.
 */
const HighlightedText: React.FC<{ text: string; term: string; className?: string }> = ({ text, term, className }) => {
  if (!term.trim()) return <span className={className}>{text}</span>;

  const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  return (
    <span className={className}>
      {parts.map((part, i) => 
        regex.test(part) ? (
          <mark key={i} className="bg-indigo-500/40 text-white rounded-sm px-0.5">{part}</mark>
        ) : (
          part
        )
      )}
    </span>
  );
};

const App: React.FC = () => {
  const [book, setBook] = useState<Book | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [userVision, setUserVision] = useState('');
  const [storyIdeas, setStoryIdeas] = useState<StoryIdea[] | null>(null);
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isIllustrating, setIsIllustrating] = useState<string | null>(null);
  const [userInput, setUserInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isNarrating, setIsNarrating] = useState<string | null>(null);
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [educationalNote, setEducationalNote] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState('Zephyr');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [audioContext] = useState(() => new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 }));
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('forge_book_v2');
    if (saved) setBook(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (book) localStorage.setItem('forge_book_v2', JSON.stringify(book));
    if (scrollRef.current && !searchTerm) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [book, searchTerm]);

  // Compute matching chapters for search
  const searchResults = useMemo(() => {
    if (!book || !searchTerm.trim()) return book?.chapters || [];
    const term = searchTerm.toLowerCase();
    return book.chapters.filter(c => 
      c.aiText.toLowerCase().includes(term) || 
      c.userContribution.toLowerCase().includes(term) ||
      c.stage.toLowerCase().includes(term)
    );
  }, [book, searchTerm]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setPendingImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateIdeas = async () => {
    if (!pendingImage) return;
    setIsGeneratingIdeas(true);
    setError(null);
    try {
      const ideas = await generateBookIdeas(pendingImage, userVision);
      setStoryIdeas(ideas);
    } catch (err) {
      setError("Failed to dream up ideas. Try again.");
    } finally {
      setIsGeneratingIdeas(false);
    }
  };

  const handleSelectIdea = async (idea: StoryIdea) => {
    if (!pendingImage) return;
    setIsGenerating(true);
    setError(null);
    try {
      const result = await startStory(pendingImage, idea);
      const firstChapter: Chapter = {
        id: Math.random().toString(36).substr(2, 9),
        stage: StoryStage.INTRODUCTION,
        aiText: result.storyText,
        userContribution: '',
        illustration: pendingImage,
        timestamp: Date.now()
      };
      setBook({
        title: result.title,
        chapters: [firstChapter],
        currentStage: StoryStage.INTRODUCTION
      });
      setEducationalNote(result.educationalNote);
      setStoryIdeas(null);
      setPendingImage(null);
      setUserVision('');
    } catch (err) {
      setError("Failed to begin the manuscript.");
    } finally {
      setIsGenerating(false);
    }
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
      setEducationalNote(result.educationalNote);
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
      setError("Illustration failed.");
    } finally {
      setIsIllustrating(null);
    }
  };

  const handleNarrate = async (text: string, id: string) => {
    if (isNarrating) return;
    setIsNarrating(id);
    try {
      const base64 = await generateNarration(text, selectedVoice);
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

  const stagesOrder = [
    StoryStage.INTRODUCTION, 
    StoryStage.INCITING_INCIDENT, 
    StoryStage.RISING_ACTION, 
    StoryStage.CLIMAX, 
    StoryStage.FALLING_ACTION, 
    StoryStage.RESOLUTION
  ];

  const currentStageIndex = book ? stagesOrder.indexOf(book.currentStage) : -1;

  const resetForge = () => {
    if (confirm("Are you sure you want to abandon this manuscript? All progress will be lost.")) {
      localStorage.removeItem('forge_book_v2');
      setBook(null);
      setPendingImage(null);
      setStoryIdeas(null);
      setUserVision('');
      setSearchTerm('');
      setIsSearchVisible(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0f19] text-slate-200 selection:bg-indigo-500/30">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none opacity-20 overflow-hidden">
        <div className="absolute top-1/4 -left-20 w-[500px] h-[500px] bg-indigo-500 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 -right-20 w-[500px] h-[500px] bg-purple-500 rounded-full blur-[150px]" />
      </div>

      <header className="sticky top-0 z-50 p-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-xl flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-900/20">
            <Feather className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold serif text-slate-100 leading-none">{book?.title || 'The Storyteller’s Forge'}</h1>
            {book && <span className="text-[10px] uppercase tracking-widest text-indigo-400 font-bold">Collaborative Writing Suite</span>}
          </div>
        </div>
        {book && (
          <div className="flex items-center space-x-2 md:space-x-4">
            {/* Search Bar Integration */}
            <div className={`flex items-center transition-all duration-300 ${isSearchVisible ? 'w-40 md:w-64' : 'w-10'}`}>
              {!isSearchVisible ? (
                <button 
                  onClick={() => setIsSearchVisible(true)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                >
                  <Search size={20} />
                </button>
              ) : (
                <div className="relative w-full">
                  <input 
                    autoFocus
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search manuscript..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl py-1.5 pl-9 pr-8 text-xs focus:outline-none focus:border-indigo-500 transition-all"
                  />
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <button 
                    onClick={() => { setSearchTerm(''); setIsSearchVisible(false); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >
                    <CloseIcon size={14} />
                  </button>
                </div>
              )}
            </div>

            <div className="hidden lg:flex items-center space-x-2 bg-slate-800/50 p-1.5 rounded-xl border border-slate-700">
              <Settings size={14} className="text-slate-400 ml-2" />
              <select 
                value={selectedVoice} 
                onChange={(e) => setSelectedVoice(e.target.value)}
                className="bg-transparent text-xs text-slate-300 focus:outline-none cursor-pointer pr-2"
              >
                {VOICES.map(v => <option key={v} value={v}>{v} Voice</option>)}
              </select>
            </div>
            <button onClick={exportBook} className="flex items-center space-x-2 text-sm text-slate-400 hover:text-white transition-colors">
              <Download size={16} /> <span className="hidden md:inline">Export</span>
            </button>
            <button onClick={resetForge} className="p-2 text-slate-400 hover:text-white transition-colors">
              <RefreshCw size={18} />
            </button>
          </div>
        )}
      </header>

      {!book ? (
        <main className="flex-1 flex flex-col items-center justify-center p-6 space-y-8 animate-in fade-in duration-700">
          {!storyIdeas && !isGeneratingIdeas ? (
            <div className="max-w-3xl w-full space-y-12">
              <div className="text-center space-y-6">
                <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-widest">
                  <Sparkles size={14} /> <span>Educational Writing Mentor</span>
                </div>
                <h2 className="text-5xl md:text-6xl font-bold serif text-white leading-tight">
                  Ignite Your <span className="text-indigo-400">Imagination</span>.
                </h2>
                <p className="text-xl text-slate-400 leading-relaxed max-w-xl mx-auto">
                  Provide an image and a spark of an idea. We'll help you forge a professional narrative.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-8 items-start">
                <label className="relative group cursor-pointer aspect-square">
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageSelect} />
                  <div className={`w-full h-full border-2 border-dashed rounded-[40px] flex flex-col items-center justify-center transition-all bg-slate-800/40 backdrop-blur-md ${pendingImage ? 'border-indigo-500 shadow-indigo-500/10' : 'border-slate-700 group-hover:border-indigo-500'}`}>
                    {pendingImage ? (
                      <img src={pendingImage} className="w-full h-full object-cover rounded-[38px]" alt="Selected" />
                    ) : (
                      <>
                        <Upload className="text-slate-500 group-hover:text-indigo-400 mb-6 transition-transform group-hover:-translate-y-2" size={48} />
                        <span className="font-bold text-slate-300">Choose a Cover</span>
                      </>
                    )}
                  </div>
                </label>

                <div className="space-y-6">
                  <div className="p-6 bg-slate-800/40 border border-slate-700 rounded-[32px] backdrop-blur-md">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-400 mb-4">Initial Vision</h3>
                    <textarea 
                      value={userVision}
                      onChange={(e) => setUserVision(e.target.value)}
                      placeholder="Describe the story in your mind... (e.g., 'A fantasy epic about a lost kingdom')"
                      className="w-full bg-transparent text-slate-100 text-lg serif placeholder:text-slate-600 focus:outline-none min-h-[150px] resize-none"
                    />
                  </div>
                  <button 
                    disabled={!pendingImage || isGeneratingIdeas}
                    onClick={handleGenerateIdeas}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 p-6 rounded-full font-bold text-lg flex items-center justify-center space-x-3 shadow-2xl transition-all hover:scale-[1.02] active:scale-95"
                  >
                    <span>Manifest Ideas</span>
                    <ChevronRight size={24} />
                  </button>
                </div>
              </div>
            </div>
          ) : isGeneratingIdeas ? (
            <div className="flex flex-col items-center space-y-6">
              <div className="relative">
                <Loader2 className="animate-spin text-indigo-500" size={64} />
                <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20" />
              </div>
              <p className="serif italic text-3xl text-slate-400 animate-pulse">Consulting the Story Oracles...</p>
            </div>
          ) : storyIdeas ? (
            <div className="max-w-4xl w-full space-y-12 animate-in slide-in-from-bottom duration-500">
              <div className="text-center space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-400">Path Selection</h3>
                <h2 className="text-4xl font-bold serif text-white">Choose Your Protagonist & Quest</h2>
              </div>
              
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {storyIdeas.map((idea) => (
                  <button 
                    key={idea.id}
                    onClick={() => handleSelectIdea(idea)}
                    className="p-8 bg-slate-800/40 border border-slate-700 hover:border-indigo-500 rounded-[40px] text-left transition-all hover:scale-105 hover:bg-slate-800/60 group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                      <UserIcon size={120} />
                    </div>
                    <div className="flex flex-col h-full space-y-6">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-400 mb-2 block">Hero</span>
                        <h4 className="text-xl font-bold text-white serif">{idea.protagonist}</h4>
                      </div>
                      <div className="flex-1">
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-400 mb-2 block">The Spark</span>
                        <p className="text-slate-400 text-sm leading-relaxed italic">"{idea.plotHook}"</p>
                      </div>
                      <div className="pt-4 border-t border-slate-700/50">
                        <span className="text-[10px] font-bold text-slate-500">Tone: {idea.tone}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="text-center">
                <button onClick={() => setStoryIdeas(null)} className="text-slate-500 hover:text-white transition-colors text-sm">Return to forge new visions</button>
              </div>
            </div>
          ) : null}
        </main>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-73px)] relative">
          <main className="flex-1 overflow-y-auto p-6 md:p-16 space-y-24 scroll-smooth" ref={scrollRef}>
            {searchTerm && searchResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4">
                <Search size={48} className="opacity-10" />
                <p className="serif italic text-xl">No traces of "{searchTerm}" found in the manuscript.</p>
              </div>
            ) : (
              searchResults.map((chapter, idx) => {
                // Find actual global index for the chapter since we might be filtering
                const originalIdx = book.chapters.findIndex(c => c.id === chapter.id);
                
                return (
                  <section key={chapter.id} className="max-w-3xl mx-auto space-y-12 animate-in slide-in-from-bottom duration-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-900/50 flex items-center justify-center text-indigo-400 font-bold border border-indigo-500/20">
                          {originalIdx + 1}
                        </div>
                        <div>
                          <h4 className="text-[10px] uppercase tracking-[0.2em] text-indigo-400 font-bold leading-none mb-1">Chapter Stage</h4>
                          <HighlightedText text={chapter.stage} term={searchTerm} className="font-bold text-slate-300" />
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={() => setEditingChapterId(chapter.id)} 
                          className="p-2 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-all"
                        >
                          <Edit3 size={18}/>
                        </button>
                        <button 
                          onClick={() => handleNarrate(chapter.aiText, chapter.id)} 
                          className={`p-2 rounded-xl transition-all ${isNarrating === chapter.id ? 'bg-indigo-600 text-white animate-pulse' : 'text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10'}`}
                        >
                          {isNarrating === chapter.id ? <Volume2 size={18}/> : <Play size={18}/>}
                        </button>
                      </div>
                    </div>

                    {chapter.userContribution && (
                      <div className="relative pl-8">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500/20 rounded-full" />
                        <HighlightedText 
                          text={`"...${chapter.userContribution}"`} 
                          term={searchTerm} 
                          className="italic text-slate-400 text-xl leading-relaxed serif block" 
                        />
                      </div>
                    )}

                    <div className="relative group">
                      {editingChapterId === chapter.id ? (
                        <div className="space-y-4">
                          <textarea
                            defaultValue={chapter.aiText}
                            className="w-full bg-slate-800/80 backdrop-blur-md border border-indigo-500 rounded-[32px] p-8 text-2xl serif leading-relaxed min-h-[300px] focus:outline-none shadow-2xl"
                            id={`edit-${chapter.id}`}
                          />
                          <div className="flex justify-end space-x-3">
                            <button onClick={() => setEditingChapterId(null)} className="px-6 py-2 text-sm text-slate-400">Cancel</button>
                            <button 
                              onClick={() => {
                                const val = (document.getElementById(`edit-${chapter.id}`) as HTMLTextAreaElement).value;
                                handleEditChapter(chapter.id, val);
                              }}
                              className="bg-indigo-600 px-6 py-2 rounded-full text-sm font-bold"
                            >Update Manuscript</button>
                          </div>
                        </div>
                      ) : (
                        <HighlightedText 
                          text={chapter.aiText} 
                          term={searchTerm} 
                          className="text-3xl md:text-4xl serif leading-[1.4] text-slate-100 first-letter:text-7xl first-letter:float-left first-letter:mr-4 first-letter:font-black first-letter:text-indigo-500 block"
                        />
                      )}
                    </div>

                    <div className="relative rounded-[40px] overflow-hidden shadow-2xl bg-slate-800/30 border border-slate-800/50 aspect-video group">
                      {chapter.illustration ? (
                        <img src={chapter.illustration} alt="Scene" className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" />
                      ) : (
                        <button 
                          onClick={() => handleIllustrate(chapter.id)}
                          disabled={isIllustrating !== null}
                          className="w-full h-full flex flex-col items-center justify-center space-y-4 text-slate-600 hover:text-indigo-400 hover:bg-indigo-500/5 transition-all"
                        >
                          {isIllustrating === chapter.id ? (
                            <div className="flex flex-col items-center space-y-4">
                              <Loader2 className="animate-spin text-indigo-500" size={48} />
                              <span className="text-sm font-bold animate-pulse">Rendering imagination...</span>
                            </div>
                          ) : (
                            <>
                              <div className="p-6 bg-slate-800 rounded-3xl group-hover:scale-110 transition-transform">
                                <ImageIcon size={48} />
                              </div>
                              <span className="text-sm font-bold tracking-widest uppercase">Visualize this moment</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </section>
                );
              })
            )}

            {isGenerating && (
              <div className="max-w-3xl mx-auto flex items-center space-x-6 py-12">
                <PenTool className="text-indigo-500 animate-bounce" size={32} />
                <span className="serif italic text-3xl text-slate-500">The mentor is writing...</span>
              </div>
            )}
          </main>

          <aside className="w-full lg:w-[450px] border-l border-slate-800 bg-[#0d121f] flex flex-col shadow-[-20px_0_50px_rgba(0,0,0,0.5)] z-40">
            <div className="p-8 border-b border-slate-800 bg-slate-900/30">
               <div className="flex items-center justify-between mb-6">
                 <h3 className="font-bold uppercase tracking-widest text-[10px] text-slate-500">Story Architecture</h3>
                 <span className="text-[10px] font-bold text-indigo-400">{Math.round(((currentStageIndex + 1) / stagesOrder.length) * 100)}% Complete</span>
               </div>
               <div className="flex space-x-1.5 h-1.5 w-full mb-8">
                  {stagesOrder.map((stage, i) => (
                    <div 
                      key={stage} 
                      className={`flex-1 rounded-full transition-all duration-500 ${i <= currentStageIndex ? 'bg-indigo-500' : 'bg-slate-800'}`}
                    />
                  ))}
               </div>
               
               <div className="space-y-4">
                  <div className="flex items-start space-x-4">
                    <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-400">
                      <Info size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-200">{book.currentStage}</h4>
                      <p className="text-sm text-slate-500 leading-relaxed mt-1">
                        {STAGE_DESCRIPTIONS[book.currentStage]}
                      </p>
                    </div>
                  </div>
                  
                  {educationalNote && (
                    <div className="mt-6 p-5 bg-indigo-900/10 border border-indigo-500/20 rounded-[24px]">
                      <h5 className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-2">Mentor's Note</h5>
                      <p className="text-sm text-indigo-100/80 leading-relaxed italic">
                        "{educationalNote}"
                      </p>
                    </div>
                  )}
               </div>
            </div>

            <div className="p-8 flex-1 flex flex-col justify-end bg-gradient-to-t from-slate-900 to-transparent">
              {!isGenerating && (
                <div className="space-y-6 animate-in slide-in-from-right duration-500">
                  <div className="relative">
                    <div className="p-6 bg-slate-800/40 rounded-[32px] border border-slate-700/50 focus-within:border-indigo-500/50 transition-colors backdrop-blur-md">
                      <textarea 
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        placeholder="Push the narrative forward..."
                        className="w-full bg-transparent text-slate-200 focus:outline-none min-h-[160px] resize-none text-lg serif leading-relaxed placeholder:text-slate-600"
                      />
                    </div>
                  </div>
                  <button 
                    onClick={handleContinue}
                    disabled={!userInput.trim() || isGenerating}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 p-6 rounded-[32px] font-bold text-lg flex items-center justify-center space-x-3 transition-all active:scale-95"
                  >
                    <span>Commit to Paper</span>
                    <ChevronRight size={24} />
                  </button>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {book && (
        <ChatInterface context={`Title: ${book.title}. Current Story: ${book.chapters.map(c => c.aiText).join(' ')}`} />
      )}

      {error && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-red-900/90 backdrop-blur-xl text-red-100 px-8 py-4 rounded-3xl flex items-center space-x-4 shadow-2xl z-[100] border border-red-500/30">
          <Info className="text-red-400" />
          <span className="font-medium">{error}</span>
          <button onClick={() => setError(null)} className="text-xs font-bold uppercase tracking-widest bg-white/10 px-3 py-1 rounded-full">Dismiss</button>
        </div>
      )}
    </div>
  );
};

export default App;
