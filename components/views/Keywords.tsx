import React, { useState } from 'react';
import { MOCK_KEYWORDS } from '../../constants';
import { KeywordItem } from '../../types';
import { Plus, X, Tag, Search, Sparkles, TrendingUp, TrendingDown, Check } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import Button from '../ui/Button';
import BentoCard from '../ui/BentoCard';

const Keywords: React.FC = () => {
  const [keywords, setKeywords] = useState<KeywordItem[]>(MOCK_KEYWORDS);
  const [newKeyword, setNewKeyword] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'negative' | 'suggested'>('active');

  const handleAdd = () => {
    if (!newKeyword.trim()) return;
    const newEntry: KeywordItem = {
      id: Date.now().toString(),
      text: newKeyword,
      tags: ['Manual'],
      matches: 0,
      type: activeTab === 'suggested' ? 'active' : activeTab,
      trend: 'stable'
    };
    setKeywords([...keywords, newEntry]);
    setNewKeyword('');
  };

  const handleDelete = (id: string) => {
    setKeywords(keywords.filter(k => k.id !== id));
  };

  const handleApproveSuggestion = (id: string) => {
      setKeywords(keywords.map(k => k.id === id ? { ...k, type: 'active' } : k));
  }

  const filteredKeywords = keywords.filter(k => k.type === activeTab);

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex justify-between items-end">
          <div>
            <h1 className="font-serif text-3xl text-primary font-medium">Keywords</h1>
            <p className="text-secondary mt-1 text-sm">Manage the terms used to scan for potential infringements.</p>
          </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
          <div className="flex gap-8 overflow-x-auto">
              <button 
                onClick={() => setActiveTab('active')}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'active' ? 'border-primary text-primary' : 'border-transparent text-secondary hover:text-primary'}`}
              >
                  Active <span className="ml-2 bg-surface border border-border px-2 py-0.5 rounded-full text-xs font-mono">{keywords.filter(k=>k.type==='active').length}</span>
              </button>
              <button 
                onClick={() => setActiveTab('negative')}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'negative' ? 'border-primary text-primary' : 'border-transparent text-secondary hover:text-primary'}`}
              >
                  Negative <span className="ml-2 bg-surface border border-border px-2 py-0.5 rounded-full text-xs font-mono">{keywords.filter(k=>k.type==='negative').length}</span>
              </button>
              <button 
                onClick={() => setActiveTab('suggested')}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'suggested' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-secondary hover:text-indigo-400'}`}
              >
                  <Sparkles size={14} />
                  Suggestions <span className="ml-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full text-xs font-mono">{keywords.filter(k=>k.type==='suggested').length}</span>
              </button>
          </div>
      </div>

      {activeTab !== 'suggested' && (
        <BentoCard>
            <div className="p-4 flex items-center gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={16} />
                    <input 
                        type="text" 
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                        className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm text-primary placeholder-secondary focus:outline-none focus:border-primary transition-colors font-mono"
                        placeholder={activeTab === 'active' ? "e.g. Brand Name, Product Line..." : "e.g. Review, Used, Forum..."}
                    />
                </div>
                <Button onClick={handleAdd} icon={Plus}>Add Keyword</Button>
            </div>
        </BentoCard>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredKeywords.map((item) => (
          <BentoCard key={item.id} className="group hover:border-primary/50 transition-colors">
            <div className="p-5 flex justify-between items-start h-full relative overflow-hidden">
                {item.type === 'suggested' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>}
                
                <div className="flex flex-col justify-between h-full w-full">
                    <div>
                        <h3 className="font-semibold text-lg text-primary flex items-center gap-2">
                            {item.text}
                            {item.trend === 'up' && <TrendingUp size={14} className="text-red-500" />}
                            {item.trend === 'down' && <TrendingDown size={14} className="text-green-500" />}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                            {item.tags.map((tag, idx) => (
                                <span key={idx} className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-medium text-secondary bg-background border border-border px-2 py-1 rounded">
                                <Tag size={10} />
                                {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                        {item.type === 'active' && <span className="text-xs text-secondary">Matches: <span className="text-primary font-mono">{item.matches}</span></span>}
                        {item.type === 'suggested' && <span className="text-xs text-indigo-400">Found in <span className="font-mono">{item.matches}</span> listings</span>}
                        
                        <div className="flex items-center gap-1">
                             {item.type === 'suggested' && (
                                <button 
                                    onClick={() => handleApproveSuggestion(item.id)}
                                    className="p-1.5 text-green-500 hover:bg-green-500/10 rounded transition-colors"
                                >
                                    <Check size={16} />
                                </button>
                            )}
                            <button 
                                onClick={() => handleDelete(item.id)}
                                className="p-1.5 text-secondary hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
          </BentoCard>
        ))}
        
        {filteredKeywords.length === 0 && (
           <div className="col-span-full py-16 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-surface border border-border mb-4 text-secondary">
                  <Search size={20} />
              </div>
              <p className="text-secondary">No keywords found in this category.</p>
           </div>
        )}
      </div>
    </div>
  );
};

export default Keywords;