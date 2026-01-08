import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import BentoCard from '../ui/BentoCard';
import { MoreHorizontal, ChevronDown, ShieldCheck, AlertTriangle, TrendingUp, TrendingDown, Calendar, Sparkles, CornerDownLeft, ChevronLeft, ChevronRight, Globe } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { PLATFORM_CONFIG } from '../../constants';
import { InfringementItem } from '../../types';

interface DateRange {
    key: string;
    label: string;
    start: Date;
    end: Date;
}

// --- Markdown Formatter Component ---
const FormattedText = ({ text }: { text: string }) => {
  const parseBold = (str: string) => {
    const parts = str.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <span key={i} className="font-medium text-primary">{part.slice(2, -2)}</span>;
      }
      return part;
    });
  };

  const lines = text.split('\n');
  return (
    <div className="space-y-2 text-xs leading-relaxed text-zinc-400 font-mono">
       {lines.map((line, i) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={i} className="h-1" />;
          
          // Bullet points
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
             return (
                <div key={i} className="flex gap-2 pl-1">
                   <span className="text-zinc-600 shrink-0">•</span>
                   <span>{parseBold(trimmed.substring(2))}</span>
                </div>
             );
          }
          // Numbered lists
          if (/^\d+\.\s/.test(trimmed)) {
             const [num, ...rest] = trimmed.split('.');
             return (
                <div key={i} className="flex gap-2 pl-1">
                   <span className="text-zinc-600 font-mono text-[10px] pt-0.5 shrink-0">{num}.</span>
                   <span>{parseBold(rest.join('.').trim())}</span>
                </div>
             );
          }
          return <div key={i}>{parseBold(line)}</div>
       })}
    </div>
  )
}

const PRESETS = [
    { label: 'Last 7 Days', key: '7d', days: 7 },
    { label: 'Last 30 Days', key: '30d', days: 30 },
    { label: 'Last 90 Days', key: '90d', days: 90 },
    { label: 'Year to Date', key: 'ytd', days: 0 },
    { label: 'Last Year', key: '1y', days: 365 },
];

const SUGGESTIONS = [
    "Identify highest risk platform",
    "Calculate potential revenue loss",
    "Show recent infringements",
    "Draft a takedown notice",
    "Compare infringement trends",
    "Analyze copycat regions"
];

// --- Dotted World Map Component ---
const DottedMap = ({ data }: { data: { country: string, value: number }[] }) => {
    // Standard Mercator projection path for major landmasses
    const worldPath = "M84.0,248.8 C87.3,248.1 90.6,247.4 93.9,246.7 C94.5,246.6 95.1,246.4 95.7,246.3 C96.3,246.2 96.9,246.0 97.5,245.9 C100.2,245.3 103.0,244.8 105.7,244.2 C106.1,244.1 106.4,244.1 106.8,244.0 C108.9,243.6 111.0,243.2 113.1,242.7 C113.8,242.6 114.5,242.5 115.2,242.3 C116.7,242.0 118.1,241.7 119.6,241.4 C122.3,240.8 125.0,240.3 127.7,239.7 C128.4,239.5 129.2,239.4 129.9,239.2 C131.6,238.9 133.3,238.5 135.0,238.1 C135.9,237.9 136.9,237.7 137.8,237.5 C141.0,236.8 144.2,236.2 147.4,235.5 C147.9,235.4 148.4,235.3 148.9,235.2 C150.3,234.9 151.8,234.6 153.2,234.3 C155.1,233.9 157.1,233.5 159.0,233.1 C159.7,233.0 160.3,232.8 161.0,232.7 C164.8,231.9 168.6,231.1 172.4,230.3 C173.6,230.1 174.9,229.8 176.1,229.6 C178.5,229.1 180.8,228.6 183.2,228.1 C183.9,227.9 184.6,227.8 185.3,227.6 C189.4,226.8 193.5,226.0 197.6,225.1 C198.5,224.9 199.3,224.8 200.2,224.6 L200.2,224.6 L200.7,219.0 L203.2,217.5 L208.5,214.5 L211.5,210.2 L216.5,208.2 L218.0,205.2 L223.5,205.2 L225.5,201.2 L230.5,199.2 L233.5,195.2 L237.5,195.2 L240.0,192.2 L242.0,188.2 L245.5,188.2 L247.5,185.2 L250.0,182.2 L252.0,178.2 L255.5,178.2 L258.0,175.2 L260.0,172.2 L263.5,172.2 L265.5,168.2 L268.0,165.2 L271.0,165.2 L273.5,162.2 L275.5,158.2 L278.5,158.2 L281.0,155.2 L283.0,152.2 L286.0,152.2 L288.5,148.2 L290.5,145.2 L293.5,145.2 L296.0,142.2 L298.0,138.2 L301.0,138.2 L303.5,135.2 L305.5,132.2 L308.5,132.2 L311.0,128.2 L313.0,125.2 L316.0,125.2 L318.5,122.2 L320.5,118.2 L323.5,118.2 L326.0,115.2 L328.0,112.2 L331.0,112.2 L333.5,108.2 L335.5,105.2 L338.5,105.2 L341.0,102.2 L343.0,98.2 L346.0,98.2 L348.5,95.2 L350.5,92.2 L353.5,92.2 L356.0,88.2 L358.0,85.2 L361.0,85.2 L363.5,82.2 L365.5,78.2 L368.5,78.2 L371.0,75.2 L373.0,72.2 L376.0,72.2 L378.5,68.2 L380.5,65.2 L383.5,65.2 L386.0,62.2 L388.0,58.2 L391.0,58.2 L393.5,55.2 L395.5,52.2 L398.5,52.2 L401.0,48.2 L403.0,45.2 L406.0,45.2 L408.5,42.2 L410.5,38.2 L413.5,38.2 L416.0,35.2 L418.0,32.2 L421.0,32.2 L423.5,28.2 L425.5,25.2 L428.5,25.2 L431.0,22.2 L433.0,18.2 L436.0,18.2 L438.5,15.2 L440.5,12.2 L443.5,12.2 L446.0,8.2 L448.0,5.2 L451.0,5.2 L453.5,2.2 L800,2.2 L800,400 L0,400 L0,250.2 L2.2,250.2 L5.2,249.2 L10.2,247.2 L15.2,246.2 L20.2,245.2 L25.2,244.2 L30.2,243.2 L35.2,242.2 L40.2,241.2 L45.2,240.2 L50.2,239.2 L55.2,238.2 L60.2,237.2 L65.2,236.2 L70.2,235.2 L75.2,234.2 L80.2,233.2 L85.2,232.2 L90.2,231.2 L95.2,230.2 L100.2,229.2 L105.2,228.2 L110.2,227.2 L115.2,226.2 L120.2,225.2 L125.2,224.2 L130.2,223.2 L135.2,222.2 L140.2,221.2 L145.2,220.2 L150.2,219.2 L155.2,218.2 L160.2,217.2 L165.2,216.2 L170.2,215.2 L175.2,214.2 L180.2,213.2 L185.2,212.2 L190.2,211.2 L195.2,210.2 L200.2,209.2 Z M715,310 L750,300 L760,330 L730,340 Z M600,100 L700,100 L700,200 L600,200 Z M380,80 L420,80 L420,120 L380,110 Z M150,80 L300,80 L280,250 L180,280 Z";

    // Approximate Mercator coordinates for 800x400 map
    const countryCoordinates: Record<string, {x: number, y: number, name: string}> = {
        'US': { x: 190, y: 140, name: 'United States' },
        'CN': { x: 610, y: 150, name: 'China' },
        'UK': { x: 395, y: 105, name: 'United Kingdom' },
        'RU': { x: 600, y: 90, name: 'Russia' },
        'BR': { x: 280, y: 260, name: 'Brazil' },
        'AU': { x: 680, y: 310, name: 'Australia' },
        'IN': { x: 570, y: 175, name: 'India' },
        'DE': { x: 410, y: 110, name: 'Germany' },
        'FR': { x: 400, y: 120, name: 'France' },
        'CA': { x: 190, y: 80, name: 'Canada' },
    };

    return (
        <div className="relative w-full h-full flex items-center justify-center bg-[#0C0C0C] rounded-lg overflow-hidden select-none">
             
             {/* Map Container */}
             <div className="relative w-full h-full">
                 <svg 
                    viewBox="0 0 800 400" 
                    className="w-full h-full" 
                    preserveAspectRatio="xMidYMid meet"
                 >
                     <defs>
                         {/* Dot Pattern - Creates the "Dotted" look */}
                         <pattern id="dots" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
                             <circle cx="2" cy="2" r="1.5" className="fill-zinc-800" />
                         </pattern>
                         
                         {/* Mask - Uses the world path to cut out the dots */}
                         <mask id="world-mask">
                             <rect width="100%" height="100%" fill="black" />
                             {/* Use the high-res path variable here */}
                             <path 
                                d={worldPath}
                                fill="white" 
                             />
                         </mask>
                     </defs>
                     
                     {/* Background Grid (Optional, makes it look more 'cyber') */}
                     <rect width="100%" height="100%" fill="#0C0C0C" />
                     
                     {/* The Dotted Map Layer */}
                     {/* We fill the entire rect with dots, but mask it to only show landmasses */}
                     <rect width="100%" height="100%" fill="url(#dots)" mask="url(#world-mask)" opacity="0.8" />
                     
                     {/* Connecting Lines (Optional aesthetic) */}
                     <path 
                        d="M190,140 Q400,-20 610,150" 
                        fill="none" 
                        stroke="url(#gradient-line)" 
                        strokeWidth="1" 
                        opacity="0.2"
                        strokeDasharray="4 4"
                     />
                     <defs>
                        <linearGradient id="gradient-line" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#ef4444" stopOpacity="0" />
                            <stop offset="50%" stopColor="#ef4444" stopOpacity="0.5" />
                            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                        </linearGradient>
                     </defs>

                     {/* Hotspots */}
                     {data.map((item, i) => {
                         const coords = countryCoordinates[item.country] || { x: 400, y: 200, name: item.country };
                         // Radius based on value relative to max, clamp between 4 and 25
                         const pulseRadius = Math.min(25, Math.max(10, Math.sqrt(item.value) * 3));
                         
                         return (
                            <g key={item.country} className="group cursor-pointer">
                                {/* Pulsing Outer Circle */}
                                <circle 
                                    cx={coords.x} 
                                    cy={coords.y} 
                                    r={pulseRadius} 
                                    className="fill-red-500/10 animate-[pulse_3s_ease-in-out_infinite]"
                                    style={{ animationDelay: `${i * 0.5}s` }}
                                />
                                {/* Inner Glow */}
                                <circle 
                                    cx={coords.x} 
                                    cy={coords.y} 
                                    r={6} 
                                    className="fill-red-500/30" 
                                />
                                {/* Solid Core */}
                                <circle 
                                    cx={coords.x} 
                                    cy={coords.y} 
                                    r={2} 
                                    className="fill-red-500" 
                                />
                                
                                {/* Tooltip Group */}
                                <foreignObject x={coords.x + 10} y={coords.y - 40} width="120" height="50" className="overflow-visible pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50">
                                    <div className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 shadow-xl flex flex-col items-start whitespace-nowrap">
                                        <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider leading-none mb-1">{coords.name}</span>
                                        <span className="text-[10px] text-red-400 font-mono leading-none">{item.value} Violations</span>
                                    </div>
                                </foreignObject>
                            </g>
                         );
                     })}
                 </svg>
             </div>
             
             {/* Legend / Overlay Info */}
             <div className="absolute bottom-4 left-4 flex gap-4 text-[10px] text-zinc-500 font-mono">
                 <div className="flex items-center gap-2">
                     <span className="w-2 h-2 rounded-full bg-zinc-800"></span> Active Region
                 </div>
                 <div className="flex items-center gap-2">
                     <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> Violation Hotspot
                 </div>
             </div>
        </div>
    );
};

const DateRangeSelector = ({ 
    selected, 
    onSelect 
}: { 
    selected: DateRange, 
    onSelect: (r: DateRange) => void 
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    // Sync custom inputs when opening if custom key is active
    useEffect(() => {
        if (isOpen && selected.key === 'custom') {
            setCustomStart(selected.start.toISOString().split('T')[0]);
            setCustomEnd(selected.end.toISOString().split('T')[0]);
        }
    }, [isOpen, selected]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handlePreset = (preset: typeof PRESETS[0]) => {
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        
        if (preset.key === 'ytd') {
            start.setMonth(0, 1);
        } else {
            // Adjust start date based on preset
            start.setDate(end.getDate() - preset.days);
        }

        onSelect({
            key: preset.key,
            label: preset.label,
            start,
            end
        });
        setIsOpen(false);
    };

    const handleCustomApply = () => {
        if (!customStart || !customEnd) return;
        
        const start = new Date(customStart);
        start.setHours(0, 0, 0, 0);
        const end = new Date(customEnd);
        end.setHours(23, 59, 59, 999);
        
        // Basic validation
        if (start > end) return;

        onSelect({
            key: 'custom',
            label: `${start.toLocaleDateString(undefined, {month:'short', day:'numeric'})} - ${end.toLocaleDateString(undefined, {month:'short', day:'numeric'})}`,
            start,
            end
        });
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={containerRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 bg-background border border-border px-3 py-1.5 text-xs uppercase tracking-wide text-secondary hover:text-primary hover:border-secondary transition-colors font-mono rounded-none group"
            >
                <Calendar size={14} className="text-secondary group-hover:text-primary transition-colors" />
                <span className="truncate max-w-[120px] text-left">{selected.label}</span>
                <ChevronDown size={12} />
            </button>
            
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-background border border-border shadow-xl z-50 animate-in fade-in zoom-in-95 duration-200 flex flex-col">
                    <div className="p-2 grid grid-cols-2 gap-1">
                        {PRESETS.map(preset => (
                            <button
                                key={preset.key}
                                onClick={() => handlePreset(preset)}
                                className={`px-3 py-2 text-xs text-left hover:bg-surface transition-colors rounded-sm ${selected.key === preset.key ? 'text-primary font-medium bg-surface' : 'text-secondary'}`}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>
                    
                    <div className="border-t border-border p-3 space-y-3 bg-surface/30">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-secondary">Custom Range</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <input 
                                type="date" 
                                value={customStart}
                                onChange={(e) => setCustomStart(e.target.value)}
                                className="w-full bg-background border border-border rounded-none px-2 py-1.5 text-xs text-primary focus:border-primary outline-none"
                            />
                            <span className="text-secondary">-</span>
                            <input 
                                type="date" 
                                value={customEnd}
                                onChange={(e) => setCustomEnd(e.target.value)}
                                className="w-full bg-background border border-border rounded-none px-2 py-1.5 text-xs text-primary focus:border-primary outline-none"
                            />
                        </div>
                        <button 
                            onClick={handleCustomApply}
                            className="w-full bg-primary text-inverse py-1.5 text-xs font-medium hover:opacity-90 transition-opacity rounded-sm"
                        >
                            Apply Custom Range
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-surface border border-border p-2 shadow-xl z-50 min-w-[100px]">
        <p className="text-[10px] text-secondary uppercase tracking-wider mb-1">{data.date}</p>
        <div className="flex items-center gap-1">
           <span className="text-xs font-medium text-primary font-mono">
              ${data.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
           </span>
        </div>
      </div>
    );
  }
  return null;
};

const DashboardAnalytics: React.FC = () => {
  const { infringements } = useDashboard();
  
  // Global Date Range - Default to Last 30 Days (Normalized)
  const [globalDateRange, setGlobalDateRange] = useState<DateRange>(() => {
     const end = new Date();
     end.setHours(23, 59, 59, 999);
     const start = new Date();
     start.setDate(end.getDate() - 30);
     start.setHours(0, 0, 0, 0);
     return { key: '30d', label: 'Last 30 Days', start, end };
  });

  const [revenueData, setRevenueData] = useState<{i: number, value: number, date: string}[]>([]);
  const [lossData, setLossData] = useState<{i: number, value: number, date: string}[]>([]);
  
  // Chat State
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'model', text: string}[]>([
      { role: 'model', text: "Hello! I'm Brandog AI. Ask me about your active threats, revenue loss, or recent detections." }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // --- Aggregate Data Based on Range ---

  // Filters from actual data
  const protectedItems = useMemo(() => 
    infringements.filter(i => ['reported', 'takedown_in_progress', 'takedown_confirmed'].includes(i.status)),
  [infringements]);

  const pendingItems = useMemo(() => 
    infringements.filter(i => i.status === 'pending'),
  [infringements]);

  // Aggregate Big Numbers based on ALL available data relevant to the metric, filtered by range if needed
  // Use String Comparison for dates to avoid timezone mismatches with generated data
  const filteredProtected = useMemo(() => {
      const startStr = globalDateRange.start.toISOString().split('T')[0];
      const endStr = globalDateRange.end.toISOString().split('T')[0];
      return protectedItems.filter(i => {
          return i.detectedAt >= startStr && i.detectedAt <= endStr;
      });
  }, [protectedItems, globalDateRange]);

  const filteredPending = useMemo(() => {
      const startStr = globalDateRange.start.toISOString().split('T')[0];
      const endStr = globalDateRange.end.toISOString().split('T')[0];
      return pendingItems.filter(i => {
          return i.detectedAt >= startStr && i.detectedAt <= endStr;
      });
  }, [pendingItems, globalDateRange]);

  const revenueProtected = useMemo(() => filteredProtected.reduce((acc, curr) => acc + curr.revenueLost, 0), [filteredProtected]);
  const potentialLoss = useMemo(() => filteredPending.reduce((acc, curr) => acc + curr.revenueLost, 0), [filteredPending]);
  const activeInfringements = filteredPending.length;

  // Calculate Similarity Score Distribution for Pending items (Histogram)
  const similarityData = useMemo(() => {
     // Buckets for similarity score distribution
     const buckets = [
         { label: '90+', min: 90, count: 0, color: 'bg-[#ef4444]' }, // Solid Red
         { label: '80+', min: 80, count: 0, color: 'bg-[#f97316]' }, // Solid Orange
         { label: '70+', min: 70, count: 0, color: 'bg-[#f59e0b]' }, // Solid Amber
         { label: '60+', min: 60, count: 0, color: 'bg-[#eab308]' }, // Solid Yellow
         { label: '<60', min: 0, count: 0, color: 'bg-[#52525b]' },  // Solid Zinc
     ];

     filteredPending.forEach(item => {
         const bucket = buckets.find(b => item.similarityScore >= b.min);
         if (bucket) bucket.count++;
     });

     const max = Math.max(...buckets.map(b => b.count), 1);
     
     return buckets.map(b => ({
         ...b,
         heightPercent: (b.count / max) * 100
     }));
  }, [filteredPending]);

  // Aggregate Platform Risk from Actual Data (Detected in range)
  const platformRiskData = useMemo(() => {
    // We analyze ALL infringements in the period for risk assessment, not just pending
    const itemsInRange = infringements.filter(i => {
        const startStr = globalDateRange.start.toISOString().split('T')[0];
        const endStr = globalDateRange.end.toISOString().split('T')[0];
        return i.detectedAt >= startStr && i.detectedAt <= endStr;
    });

    const totalLost = itemsInRange.reduce((acc, curr) => acc + curr.revenueLost, 0);
    const byPlatform: Record<string, number> = {};
    
    itemsInRange.forEach(item => {
        byPlatform[item.platform] = (byPlatform[item.platform] || 0) + item.revenueLost;
    });

    return Object.entries(byPlatform)
        .map(([platform, value]) => ({
            category: platform,
            value,
            percentage: totalLost > 0 ? Math.round((value / totalLost) * 100) : 0,
            color: PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.color === 'blue' ? '#ffffff' : 
                   PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.color === 'pink' ? '#E1306C' :
                   PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.color === 'green' ? '#96bf48' :
                   PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.color === 'black' ? '#ffffff' :
                   PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.color === 'orange' ? '#FF9900' :
                   PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.color === 'red' ? '#FF4747' : '#71717a'
        }))
        .sort((a, b) => b.value - a.value);

  }, [infringements, globalDateRange]);

  // Aggregate Map Data (Detected in range)
  const violationMapData = useMemo(() => {
      const itemsInRange = infringements.filter(i => {
          const startStr = globalDateRange.start.toISOString().split('T')[0];
          const endStr = globalDateRange.end.toISOString().split('T')[0];
          return i.detectedAt >= startStr && i.detectedAt <= endStr;
      });
      
      const byCountry: Record<string, number> = {};
      itemsInRange.forEach(item => {
          byCountry[item.country] = (byCountry[item.country] || 0) + 1;
      });

      return Object.entries(byCountry).map(([country, value]) => ({ country, value }));
  }, [infringements, globalDateRange]);


  // Helper to generate chart data
  useEffect(() => {
    const aggregateForChart = (items: InfringementItem[]) => {
        const dataMap = new Map<string, number>();
        const days = Math.ceil((globalDateRange.end.getTime() - globalDateRange.start.getTime()) / (1000 * 60 * 60 * 24));
        
        // Initialize timeline with ALL days in range
        for(let i = 0; i <= days; i++) {
            const d = new Date(globalDateRange.start);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            dataMap.set(dateStr, 0);
        }

        // Fill data from items
        items.forEach(item => {
            // Only add if it falls within the initialized keys (should be guaranteed by filtering)
            if (dataMap.has(item.detectedAt)) {
                dataMap.set(item.detectedAt, (dataMap.get(item.detectedAt) || 0) + item.revenueLost);
            }
        });

        return Array.from(dataMap.entries()).map(([date, value], i) => ({
            i,
            date: new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            value
        }));
    };

    setRevenueData(aggregateForChart(filteredProtected));
    setLossData(aggregateForChart(filteredPending));

  }, [filteredProtected, filteredPending, globalDateRange]);


  // --- Calendar Logic ---
  const currentMonthCalendar = useMemo(() => {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      const startDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun, 1 = Mon
      
      const calendarDays = [];
      
      // Previous month filler
      const prevMonthDays = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
      const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
      for(let i = prevMonthDays - 1; i >= 0; i--) {
          calendarDays.push({ day: prevMonthLastDay - i, month: 'prev', activity: 0 });
      }
      
      // Current month
      for(let i = 1; i <= daysInMonth; i++) {
          const dateStr = new Date(currentYear, currentMonth, i).toISOString().split('T')[0];
          const count = infringements.filter(item => item.detectedAt === dateStr).length;
          
          let activity = 0;
          if (count > 0) activity = 1;
          if (count > 2) activity = 2;
          if (count > 5) activity = 3;

          calendarDays.push({ 
              day: i, 
              month: 'curr', 
              activity, 
              selected: i === now.getDate() 
          });
      }
      
      // Next month filler
      const remainingSlots = 42 - calendarDays.length; // 6 rows
      for(let i = 1; i <= remainingSlots; i++) {
          calendarDays.push({ day: i, month: 'next', activity: 0 });
      }
      
      return calendarDays;
  }, [infringements]);


  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendMessage = async (e?: React.FormEvent, overrideText?: string) => {
    e?.preventDefault();
    const textToSend = overrideText || chatInput;
    if (!textToSend.trim() || isChatLoading) return;

    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: textToSend }]);
    setIsChatLoading(true);

    try {
        const contextData = {
          summary: {
              totalPotentialLoss: potentialLoss,
              totalRevenueProtected: revenueProtected,
              activeThreatsCount: activeInfringements,
              totalInfringementsTracked: infringements.length,
              dateRange: globalDateRange.label
          },
          platformRisks: platformRiskData,
          topCountries: violationMapData.sort((a,b) => b.value - a.value).slice(0, 5),
          recentInfringements: filteredPending.slice(0, 5).map(i => ({
              brand: i.brandName,
              platform: i.platform,
              revenueLost: i.revenueLost,
              status: i.status,
              detected: i.detectedAt,
              country: i.country
          }))
        };

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: textToSend,
            config: {
                systemInstruction: `You are an AI Analyst for Brandog, a brand protection platform. 
                You have access to the dashboard data below. Answer the user's questions based on this data.
                
                Data Context:
                ${JSON.stringify(contextData, null, 2)}
                
                Guidelines:
                1. Be concise and professional.
                2. Use bullet points for lists.
                3. Bold key numbers and names using **bold**.
                4. Do NOT use markdown tables or headers (like # or ##).
                `,
            }
        });

        const text = response.text || "I couldn't generate a response at this time.";
        setChatMessages(prev => [...prev, { role: 'model', text }]);

    } catch (error) {
        console.error("Gemini API Error:", error);
        setChatMessages(prev => [...prev, { role: 'model', text: "I'm having trouble connecting to the network right now." }]);
    } finally {
        setIsChatLoading(false);
    }
  };

  const checkScroll = () => {
    if (suggestionsRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = suggestionsRef.current;
        setCanScrollLeft(scrollLeft > 0);
        setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
    }
  };

  useEffect(() => {
      checkScroll();
      window.addEventListener('resize', checkScroll);
      return () => window.removeEventListener('resize', checkScroll);
  }, [chatInput]);

  const scrollSuggestions = (direction: 'left' | 'right') => {
    if (suggestionsRef.current) {
        const scrollAmount = 200;
        suggestionsRef.current.scrollBy({
            left: direction === 'left' ? -scrollAmount : scrollAmount,
            behavior: 'smooth'
        });
        setTimeout(checkScroll, 300);
    }
  };

  const getComparisonText = (rangeKey: string) => {
      switch(rangeKey) {
          case '24h': return 'vs yesterday';
          case '7d': return 'vs last week';
          case '30d': return 'vs last month';
          case '90d': return 'vs last quarter';
          case 'ytd': return 'vs prev year';
          case '1y': return 'vs last year';
          default: return 'vs prev period';
      }
  };

  const showSuggestions = !chatInput.trim();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-end justify-between">
         <div>
            <h1 className="font-serif text-3xl md:text-4xl text-white font-medium tracking-tight">Morning Viktor</h1>
            <p className="text-zinc-400 mt-2 text-sm">Here's a quick look at how things are going.</p>
         </div>
         <div className="flex items-center gap-2">
            <DateRangeSelector selected={globalDateRange} onSelect={setGlobalDateRange} />
            <button className="p-2 border border-border rounded-none text-secondary hover:text-primary hover:bg-surface transition-colors bg-background">
                <MoreHorizontal size={16} />
            </button>
         </div>
      </div>

      {/* Bento Grid - 3 Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
         
         {/* Card 1: Revenue Protected (1/3) */}
         <BentoCard 
            title={
                <div className="flex items-center gap-2 text-secondary">
                    <ShieldCheck size={16} className="text-emerald-500" />
                    <span>Revenue Protected</span>
                </div>
            }
            className="md:col-span-1"
         >
            <div className="flex flex-col h-full justify-between">
               <div className="mt-0">
                  <div className="flex justify-between items-end">
                     <span className="text-2xl text-primary font-normal tracking-tight">${revenueProtected.toLocaleString()}</span>
                     <div className="flex flex-col items-end mb-1">
                          <span className="text-[10px] text-emerald-500 flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                             <TrendingUp size={10} /> +12%
                          </span>
                          <span className="text-[10px] text-secondary mt-1 lowercase">{getComparisonText(globalDateRange.key)}</span>
                      </div>
                  </div>
                  
                  <div className="h-[35px] w-full mt-1 -ml-1">
                     <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={revenueData} onMouseMove={() => {}}>
                           <defs>
                              <linearGradient id="gradProtected" x1="0" y1="0" x2="0" y2="1">
                                 <stop offset="0%" stopColor="#10b981" stopOpacity={0.2}/>
                                 <stop offset="100%" stopColor="#10b981" stopOpacity={0}/>
                              </linearGradient>
                           </defs>
                           <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--secondary)', strokeDasharray: '3 3', strokeWidth: 1 }} />
                           <Area 
                              type="monotone" 
                              dataKey="value" 
                              stroke="#10b981" 
                              strokeWidth={2} 
                              fill="url(#gradProtected)" 
                              isAnimationActive={true}
                              animationDuration={800}
                           />
                        </AreaChart>
                     </ResponsiveContainer>
                  </div>
               </div>
               <div className="mt-auto text-[10px] font-medium text-secondary hover:text-primary cursor-pointer transition-colors flex items-center gap-1 pt-2">
                   See Revenue Protected <ChevronRight size={10} />
               </div>
            </div>
         </BentoCard>

         {/* Card 2: Potential Loss (1/3) */}
         <BentoCard 
            title={
                <div className="flex items-center gap-2 text-secondary">
                    <AlertTriangle size={16} className="text-amber-500" />
                    <span>Potential Loss</span>
                </div>
            }
            className="md:col-span-1"
         >
             <div className="flex flex-col h-full justify-between">
               <div className="mt-0">
                   <div className="flex justify-between items-end">
                       <span className="text-2xl text-primary font-normal tracking-tight">${potentialLoss.toLocaleString()}</span>
                       <div className="flex flex-col items-end mb-1">
                           <span className="text-[10px] text-amber-500 flex items-center gap-1 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                               <TrendingDown size={10} /> +5%
                           </span>
                           <span className="text-[10px] text-secondary mt-1 lowercase">{getComparisonText(globalDateRange.key)}</span>
                       </div>
                   </div>

                   <div className="h-[35px] w-full mt-1 -ml-1">
                      <ResponsiveContainer width="100%" height="100%">
                         <AreaChart data={lossData} onMouseMove={() => {}}>
                            <defs>
                               <linearGradient id="gradLoss" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.2}/>
                                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0}/>
                               </linearGradient>
                            </defs>
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--secondary)', strokeDasharray: '3 3', strokeWidth: 1 }} />
                            <Area 
                                type="monotone" 
                                dataKey="value" 
                                stroke="#f59e0b" 
                                strokeWidth={2} 
                                fill="url(#gradLoss)" 
                                isAnimationActive={true}
                                animationDuration={800}
                            />
                         </AreaChart>
                      </ResponsiveContainer>
                   </div>
               </div>
               <div className="mt-auto text-[10px] font-medium text-secondary hover:text-primary cursor-pointer transition-colors flex items-center gap-1 pt-2">
                   See Potential Loss <ChevronRight size={10} />
               </div>
            </div>
         </BentoCard>

         {/* Card 3: Potential Infringements (1/3) */}
         <BentoCard title="Potential Infringements" className="md:col-span-1">
             <div className="flex flex-col h-full justify-between">
                 <div className="mt-0">
                    <div className="flex justify-between items-start">
                        <div>
                           <p className="text-xs text-secondary">Avg detection <span className="text-primary font-medium">4h</span>.</p>
                           <h2 className="text-2xl font-mono mt-1 text-primary">{activeInfringements}</h2>
                        </div>
                    </div>
                    
                    {/* Distribution Histogram */}
                    <div className="h-8 flex items-end gap-1 mt-2 pt-2 border-t border-border/50">
                       {similarityData.map((bin, i) => (
                          <div key={i} className="flex-1 h-full flex flex-col justify-end group relative">
                              {/* Tooltip */}
                              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-primary text-inverse text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none shadow-lg">
                                  {bin.count}
                              </div>
                              
                              {/* Bar */}
                              <div 
                                className={`w-full ${bin.color} rounded-sm relative min-h-[4px] transition-all duration-300 hover:brightness-110 hover:shadow-lg`} 
                                style={{ height: `${Math.max(bin.heightPercent, 4)}%` }}
                              >
                              </div>
                          </div>
                       ))}
                    </div>
                     <div className="flex justify-between mt-1 px-1">
                        {similarityData.map((bin, i) => (
                             <div key={i} className="text-[8px] text-secondary text-center font-mono w-full truncate">
                                  {bin.label}
                              </div>
                        ))}
                     </div>
                 </div>
                 <div className="mt-auto text-[10px] font-medium text-secondary hover:text-primary cursor-pointer transition-colors flex items-center gap-1 pt-2">
                     See All Infringements <ChevronRight size={10} />
                 </div>
             </div>
         </BentoCard>

         {/* Card 5: Global Violations Map (Left Column, 2-Row Span) */}
         <BentoCard 
            title="Global Violations" 
            className="md:col-span-2 row-span-2"
            action={
               <div className="flex items-center gap-2 text-xs text-secondary">
                  <Globe size={12} />
                  <span>Real-time Activity</span>
               </div>
            }
         >
            <div className="w-full h-full min-h-[250px] mt-2">
                <DottedMap data={violationMapData} />
            </div>
         </BentoCard>

         {/* Card 6: Tracker (Right Column, Stacked) */}
         <BentoCard title="Tracker" className="md:col-span-1 p-0 overflow-hidden" action={
            <div className="flex items-center gap-1 text-xs text-secondary cursor-pointer hover:text-primary transition-colors border border-border px-2 py-1">
                <span>{new Date().toLocaleDateString(undefined, {month:'long'})}</span>
                <ChevronDown size={12} />
            </div>
         }>
            <div className="mt-2 border-t border-border">
                {/* Header */}
                <div className="grid grid-cols-7">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => (
                        <div key={d} className="py-2 text-[10px] text-secondary font-mono text-center border-r border-b border-border last:border-r-0">
                            {d}
                        </div>
                    ))}
                </div>
                
                {/* Calendar Grid */}
                <div className="grid grid-cols-7 bg-border gap-px border-b border-border">
                    {currentMonthCalendar.map((item, i) => {
                        const isWeekend = i % 7 === 5 || i % 7 === 6;
                        return (
                            <div 
                                key={i} 
                                className={`
                                    relative h-8 w-full flex flex-col justify-between p-1 transition-colors
                                    ${item.selected 
                                        ? 'bg-surface' 
                                        : isWeekend 
                                            ? 'bg-striped' 
                                            : item.month === 'curr' ? 'bg-background hover:bg-surface' : 'bg-background'
                                    }
                                `}
                            >
                                <span className={`font-mono text-[9px] ${item.selected ? 'text-primary font-bold' : 'text-secondary'} ${item.month !== 'curr' ? 'opacity-30' : ''}`}>
                                    {item.day}
                                </span>
                                
                                {item.activity > 0 && item.month === 'curr' && (
                                    <div className="flex gap-0.5 justify-center mt-1">
                                        <div className={`h-1 w-1 rounded-full ${item.selected ? 'bg-primary' : 'bg-secondary/50'}`}></div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
         </BentoCard>

         {/* Card 4: Platform Risk (Right Column, Stacked) */}
         <BentoCard title="Platform Risk" className="md:col-span-1">
            <div className="mt-2 flex flex-col gap-2 min-h-0 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-border max-h-[140px]">
               {platformRiskData.map((item) => (
                  <div key={item.category} className="flex items-center justify-between text-xs group">
                     <div className="flex items-center gap-3 w-28 shrink-0">
                        <div className="w-2 h-2 rounded-none" style={{ backgroundColor: item.color }}></div>
                        <span className="text-secondary group-hover:text-primary transition-colors truncate">{item.category}</span>
                     </div>
                     <div className="flex-1 h-1 bg-surface rounded-none mx-2 overflow-hidden">
                         <div className="h-full rounded-none" style={{ width: `${item.percentage}%`, backgroundColor: '#fafafa' }}></div>
                     </div>
                     <span className="text-secondary font-mono w-6 text-right">{item.percentage}%</span>
                  </div>
               ))}
            </div>
         </BentoCard>

         {/* Card 7: Assistant (Full Width Bottom) */}
         <BentoCard title="Assistant" className="md:col-span-full h-[350px] flex flex-col border border-border shadow-lg" noPadding={true}>
            <div className="flex-1 flex flex-col min-h-0 bg-[#0C0C0C]">
                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto space-y-4 p-4 scrollbar-thin scrollbar-thumb-zinc-800">
                    {chatMessages.map((msg, idx) => (
                        <div key={idx} className="flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="shrink-0 mt-0.5">
                                {msg.role === 'user' ? (
                                    <div className="w-6 h-6 rounded-full overflow-hidden border border-zinc-700">
                                         <img src="https://i.pravatar.cc/150?u=a042581f4e29026704d" alt="User" className="w-full h-full object-cover grayscale" />
                                    </div>
                                ) : (
                                    <Sparkles size={18} className="text-white fill-white" />
                                )}
                            </div>
                            <div className="flex-1">
                                <div className={`text-sm ${msg.role === 'user' ? 'text-zinc-200 font-mono' : 'text-zinc-300'}`}>
                                    {msg.role === 'user' ? (
                                        msg.text
                                    ) : (
                                        <FormattedText text={msg.text} />
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    {isChatLoading && (
                        <div className="flex gap-4 px-1">
                             <Sparkles size={18} className="text-white/50 animate-pulse" />
                             <div className="flex gap-1 mt-2">
                                <span className="w-1 h-1 bg-zinc-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                <span className="w-1 h-1 bg-zinc-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                <span className="w-1 h-1 bg-zinc-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                             </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* Suggestions Area */}
                {showSuggestions && (
                    <div className="px-0 pb-2 bg-[#0C0C0C] relative group/suggestions">
                        {/* Left Arrow with Fade */}
                        {canScrollLeft && (
                            <div className="absolute left-0 top-0 bottom-2 w-12 bg-gradient-to-r from-[#0C0C0C] via-[#0C0C0C] to-transparent z-10 flex items-center justify-start pl-2">
                                <button 
                                    onClick={() => scrollSuggestions('left')}
                                    className="p-1 text-zinc-400 hover:text-white transition-all"
                                >
                                    <ChevronLeft size={14} />
                                </button>
                            </div>
                        )}

                        <div 
                            ref={suggestionsRef}
                            onScroll={checkScroll}
                            className="flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden py-1 px-4 scroll-smooth relative"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                        >
                            {SUGGESTIONS.map((suggestion) => (
                                <button
                                    key={suggestion}
                                    onClick={() => handleSendMessage(undefined, suggestion)}
                                    disabled={isChatLoading}
                                    className="shrink-0 text-[10px] text-zinc-400 border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 rounded-none hover:bg-zinc-800 hover:text-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                >
                                    {suggestion}
                                </button>
                            ))}
                            {/* Spacer for right fade */}
                            <div className="w-4 shrink-0"></div>
                        </div>

                        {/* Right Arrow with Fade */}
                        {canScrollRight && (
                            <div className="absolute right-0 top-0 bottom-2 w-12 bg-gradient-to-l from-[#0C0C0C] via-[#0C0C0C] to-transparent z-10 flex items-center justify-end pr-2">
                                <button 
                                    onClick={() => scrollSuggestions('right')}
                                    className="p-1 text-zinc-400 hover:text-white transition-all"
                                >
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Input Area */}
                <form onSubmit={handleSendMessage} className="relative border-t border-zinc-800 p-4 bg-[#0C0C0C]">
                    <div className="relative flex items-center">
                        <input 
                            type="text" 
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Ask Brandog a question..."
                            className="w-full bg-transparent text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none py-2 pr-12 font-sans"
                        />
                        <button 
                            type="submit"
                            disabled={!chatInput.trim() || isChatLoading}
                            className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-400 hover:text-white transition-colors disabled:opacity-30"
                        >
                            <span>Submit</span>
                            <CornerDownLeft size={10} strokeWidth={3} />
                        </button>
                    </div>
                </form>
            </div>
         </BentoCard>

      </div>
    </div>
  );
};

export default DashboardAnalytics;