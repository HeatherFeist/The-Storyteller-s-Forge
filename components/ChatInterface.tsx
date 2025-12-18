
import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Loader2 } from 'lucide-react';
import { Message } from '../types';
import { chatWithStory } from '../services/geminiService';

interface ChatInterfaceProps {
  context: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ context }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isThinking) return;

    const userMsg: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    try {
      const response = await chatWithStory(messages, input, context);
      const assistantMsg: Message = { role: 'assistant', content: response };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'assistant', content: "I'm sorry, I encountered an error connecting to my creative mind. Please try again." }]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg transition-all transform hover:scale-105 z-40"
      >
        <MessageSquare size={24} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 md:inset-auto md:bottom-24 md:right-6 w-full md:w-96 h-[80vh] bg-slate-900 border border-slate-700 shadow-2xl rounded-t-2xl md:rounded-2xl flex flex-col z-50 animate-in slide-in-from-bottom duration-300">
          <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800 rounded-t-2xl">
            <h3 className="font-semibold text-indigo-400">Story Assistant</h3>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">
              <X size={20} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-slate-500 mt-10">
                <p className="text-sm">Ask me about the world, the characters, or what should happen next!</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-200 rounded-bl-none'}`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isThinking && (
              <div className="flex justify-start">
                <div className="bg-slate-800 p-3 rounded-2xl rounded-bl-none">
                  <Loader2 className="animate-spin text-indigo-400" size={16} />
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSend} className="p-4 border-t border-slate-700 bg-slate-800 rounded-b-2xl">
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask something..."
                className="w-full bg-slate-700 text-white rounded-lg py-2 pl-3 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-slate-600"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-400 hover:text-indigo-300"
              >
                <Send size={18} />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

export default ChatInterface;
