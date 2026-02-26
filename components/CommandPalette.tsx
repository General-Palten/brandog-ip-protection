import React, { useEffect, useState, useRef } from 'react';
import {
  Search, LayoutDashboard, Settings, ShieldOff, FolderOpen, BarChart3,
  ArrowRight, RefreshCcw, Command
} from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';

interface CommandPaletteProps {
  navigate: (viewId: string) => void;
}

interface CommandItem {
  id: string;
  label: string;
  icon: React.ElementType;
  section: 'Navigation' | 'Actions' | 'System';
  action: () => void;
  shortcut?: string[];
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ navigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  
  const { resetData, addNotification, populateDummyData } = useDashboard();

  // Toggle Logic
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Define Commands
  const commands: CommandItem[] = [
    // Navigation
    { id: 'nav-dash', label: 'Go to Dashboard', icon: LayoutDashboard, section: 'Navigation', action: () => navigate('dashboard') },
    { id: 'nav-search', label: 'Infringements', icon: Search, section: 'Navigation', action: () => navigate('search') },
    { id: 'nav-takedowns', label: 'Takedowns', icon: ShieldOff, section: 'Navigation', action: () => navigate('takedowns') },
    { id: 'nav-assets', label: 'Go to Assets', icon: FolderOpen, section: 'Navigation', action: () => navigate('assets') },
    { id: 'nav-analytics', label: 'Go to Analytics', icon: BarChart3, section: 'Navigation', action: () => navigate('analytics') },
    { id: 'nav-set', label: 'Settings', icon: Settings, section: 'Navigation', action: () => navigate('settings') },
    
    // Actions
    {
        id: 'act-sim',
        label: 'Run Quick Scan (Simulation)',
        icon: RefreshCcw,
        section: 'Actions',
        action: () => {
            addNotification('info', 'Initiating quick scan on all active keywords...');
            setTimeout(() => addNotification('success', 'Scan complete. 3 new potential threats found.'), 2000);
        }
    },
    {
        id: 'act-seed',
        label: 'Populate Dummy Data',
        icon: RefreshCcw,
        section: 'Actions',
        action: () => {
            void populateDummyData();
        }
    },
    
    // System
    { 
        id: 'sys-reset', 
        label: 'Reset Demo Data', 
        icon: RefreshCcw, 
        section: 'System', 
        action: () => {
             if(confirm('This will clear all local storage and reset to default mock data. Continue?')) {
                 resetData();
             }
        } 
    },
  ];

  const filteredCommands = commands.filter(cmd => 
    cmd.label.toLowerCase().includes(query.toLowerCase()) || 
    cmd.section.toLowerCase().includes(query.toLowerCase())
  );

  // Selection Logic
  useEffect(() => {
      setSelectedIndex(0);
  }, [query, isOpen]);

  useEffect(() => {
    if(!isOpen) {
        setQuery('');
    } else {
        setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleListKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
              filteredCommands[selectedIndex].action();
              setIsOpen(false);
          }
      }
  };

  const handleSelect = (index: number) => {
      if (filteredCommands[index]) {
          filteredCommands[index].action();
          setIsOpen(false);
      }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] px-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in"
        onClick={() => setIsOpen(false)}
      />
      
      {/* Palette */}
      <div 
        className="relative w-full max-w-lg bg-background border border-border shadow-2xl rounded-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[60vh]"
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="text-secondary" size={20} />
          <input 
            ref={inputRef}
            type="text" 
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent border-none outline-none text-base text-primary placeholder-secondary/50 font-medium"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleListKeyDown}
          />
          <div className="flex items-center gap-1">
             <span className="text-[10px] bg-surface border border-border px-1.5 py-0.5 rounded-lg text-secondary font-mono">ESC</span>
          </div>
        </div>

        {/* List */}
        <div 
            ref={listRef}
            className="overflow-y-auto py-2 flex-1 scrollbar-thin scrollbar-thumb-border"
        >
            {filteredCommands.length === 0 ? (
                <div className="px-4 py-8 text-center text-secondary text-sm">
                    No commands found matching "{query}"
                </div>
            ) : (
                <>
                    {['Navigation', 'Actions', 'System'].map((section) => {
                        const sectionItems = filteredCommands.filter(c => c.section === section);
                        if (sectionItems.length === 0) return null;

                        return (
                            <div key={section} className="mb-2">
                                <div className="px-4 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-secondary">
                                    {section}
                                </div>
                                {sectionItems.map((cmd) => {
                                    // Calculate global index for selection highlighting
                                    const globalIndex = filteredCommands.findIndex(c => c.id === cmd.id);
                                    const isSelected = globalIndex === selectedIndex;
                                    
                                    return (
                                        <button
                                            key={cmd.id}
                                            onClick={() => handleSelect(globalIndex)}
                                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                                            className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors cursor-pointer
                                                ${isSelected 
                                                    ? 'bg-primary text-inverse' 
                                                    : 'text-primary hover:bg-surface'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <cmd.icon size={16} className={isSelected ? 'text-inverse' : 'text-secondary'} />
                                                <span>{cmd.label}</span>
                                            </div>
                                            {isSelected && <ArrowRight size={14} className="opacity-50" />}
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })}
                </>
            )}
        </div>
        
        {/* Footer */}
        <div className="bg-surface border-t border-border px-4 py-2 flex justify-between items-center text-[10px] text-secondary">
             <div className="flex gap-3">
                 <span><strong className="font-medium">↑↓</strong> to navigate</span>
                 <span><strong className="font-medium">↵</strong> to select</span>
             </div>
             <div className="flex items-center gap-1 opacity-70">
                 <Command size={10} /> + K
             </div>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
