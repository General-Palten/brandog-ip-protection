import React from 'react';
import { FileBarChart, Download, Calendar, FileText, Check, ChevronDown } from 'lucide-react';
import BentoCard from '../ui/BentoCard';
import Button from '../ui/Button';

const ReportGenerator: React.FC = () => {
  return (
    <div className="space-y-8 animate-in fade-in">
      <div>
         <h1 className="font-serif text-3xl text-primary font-medium">Report Generator</h1>
         <p className="text-secondary mt-1 text-sm">Export detailed data for internal stakeholders or legal proceedings.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         {/* Generator Form */}
         <BentoCard className="h-fit">
            <div className="p-6">
                <h3 className="font-medium text-primary mb-6 flex items-center gap-2">
                    <FileBarChart size={18} />
                    Create New Report
                </h3>
                <div className="space-y-6">
                   <div>
                      <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">Report Type</label>
                      <div className="grid grid-cols-2 gap-3">
                         <button className="border border-primary bg-primary text-inverse py-3 rounded-lg font-medium text-sm flex items-center justify-center gap-2 relative shadow-sm">
                            Executive Summary
                         </button>
                         <button className="border border-border text-secondary py-3 rounded-lg font-medium text-sm hover:text-primary hover:border-primary transition-colors">
                            Full Data Export
                         </button>
                      </div>
                   </div>

                   <div>
                      <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">Date Range</label>
                      <div className="relative">
                         <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={16} />
                         <select className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-lg text-sm text-primary focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer">
                            <option>Last 30 Days</option>
                            <option>Last Quarter</option>
                            <option>Year to Date</option>
                            <option>Custom Range</option>
                         </select>
                         <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary pointer-events-none" size={14} />
                      </div>
                   </div>

                   <div>
                      <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">Format</label>
                      <div className="flex items-center gap-6 p-4 bg-background border border-border rounded-lg">
                         <label className="flex items-center gap-2 cursor-pointer group">
                            <input type="radio" name="format" defaultChecked className="accent-primary w-4 h-4" />
                            <span className="text-sm font-medium text-secondary group-hover:text-primary transition-colors">PDF Document</span>
                         </label>
                         <label className="flex items-center gap-2 cursor-pointer group">
                            <input type="radio" name="format" className="accent-primary w-4 h-4" />
                            <span className="text-sm font-medium text-secondary group-hover:text-primary transition-colors">CSV / Excel</span>
                         </label>
                      </div>
                   </div>

                   <Button className="w-full mt-2" icon={Download}>
                      Generate Report
                   </Button>
                </div>
            </div>
         </BentoCard>

         {/* History */}
         <div className="space-y-4">
            <h3 className="font-medium text-primary flex items-center gap-2 px-1">
                Recent Reports
            </h3>
            {[
               { name: 'Monthly_Takedown_Report_Oct23.pdf', date: 'Oct 31, 2023', size: '2.4 MB' },
               { name: 'Q3_Brand_Protection_Summary.pdf', date: 'Oct 01, 2023', size: '5.1 MB' },
               { name: 'Infringement_Raw_Data_Sep.csv', date: 'Sep 30, 2023', size: '850 KB' },
            ].map((file, i) => (
               <div key={i} className="group bg-surface border border-border rounded-xl p-4 flex items-center justify-between hover:border-primary/50 transition-all cursor-pointer">
                  <div className="flex items-center gap-4">
                     <div className="w-10 h-10 bg-background border border-border rounded-lg flex items-center justify-center text-secondary group-hover:text-primary transition-colors">
                        <FileText size={20} />
                     </div>
                     <div>
                        <h4 className="font-medium text-sm text-primary">{file.name}</h4>
                        <p className="text-xs text-secondary font-mono mt-0.5">{file.date} • {file.size}</p>
                     </div>
                  </div>
                  <button className="text-secondary hover:text-primary p-2">
                     <Download size={18} />
                  </button>
               </div>
            ))}
         </div>
      </div>
    </div>
  );
};

export default ReportGenerator;