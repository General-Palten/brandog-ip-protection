import React from 'react';
import { MOCK_DOCS } from '../../constants';
import { FileText, Download, CheckCircle, Clock, Plus, MoreVertical, Shield } from 'lucide-react';
import Button from '../ui/Button';
import BentoCard from '../ui/BentoCard';

const IPDocuments: React.FC = () => {
  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex justify-between items-end">
         <div>
            <h1 className="font-serif text-3xl text-primary font-medium">IP Documents</h1>
            <p className="text-secondary mt-1 text-sm">Store your trademarks and copyright registrations.</p>
         </div>
         <Button icon={Plus}>Upload Document</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {MOCK_DOCS.map((doc) => (
            <BentoCard key={doc.id} className="relative group hover:border-primary/50 transition-all">
               <div className="p-6">
                   <button className="absolute top-4 right-4 text-secondary hover:text-primary transition-colors">
                      <MoreVertical size={16} />
                   </button>
                   
                   <div className="flex items-start gap-4 mb-6">
                      <div className="w-10 h-10 bg-primary/5 text-primary border border-primary/10 rounded-lg flex items-center justify-center shrink-0">
                         <FileText size={20} />
                      </div>
                      <div className="pr-6">
                         <h3 className="font-medium text-primary leading-tight mb-1 line-clamp-2">{doc.name}</h3>
                         <p className="text-xs text-secondary uppercase tracking-wide">{doc.type}</p>
                      </div>
                   </div>
                   
                   <div className="space-y-3 mb-6">
                      <div className="flex justify-between text-sm py-2 border-b border-border/50 border-dashed">
                         <span className="text-secondary">Reg. Number</span>
                         <span className="font-mono text-primary">{doc.regNumber}</span>
                      </div>
                      <div className="flex justify-between text-sm py-2 border-b border-border/50 border-dashed">
                         <span className="text-secondary">Status</span>
                         <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${doc.status === 'Active' ? 'text-green-500' : 'text-yellow-500'}`}>
                            {doc.status === 'Active' ? <CheckCircle size={12} /> : <Clock size={12} />}
                            {doc.status}
                         </span>
                      </div>
                      <div className="flex justify-between text-sm py-2">
                         <span className="text-secondary">Expiry</span>
                         <span className="text-primary font-mono">{doc.expiry}</span>
                      </div>
                   </div>

                   <button className="w-full py-2 bg-background border border-border rounded text-sm font-medium text-secondary hover:text-primary hover:border-primary transition-all flex items-center justify-center gap-2">
                      <Download size={14} />
                      Download PDF
                   </button>
               </div>
            </BentoCard>
         ))}
      </div>
    </div>
  );
};

export default IPDocuments;