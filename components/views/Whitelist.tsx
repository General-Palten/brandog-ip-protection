import React, { useState } from 'react';
import { MOCK_WHITELIST } from '../../constants';
import { Plus, Search, Globe, Trash2, Shield } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import PageHeader from '../ui/PageHeader';
import BentoCard from '../ui/BentoCard';

const Whitelist: React.FC = () => {
  const [whitelist, setWhitelist] = useState(MOCK_WHITELIST);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [newName, setNewName] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [newPlatform, setNewPlatform] = useState('');

  const removeEntry = (id: string) => {
     setWhitelist(whitelist.filter(w => w.id !== id));
  }

  const handleAdd = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newName || !newDomain) return;

      const newItem = {
          id: Date.now().toString(),
          name: newName,
          domain: newDomain,
          platform: newPlatform || 'General Web',
          dateAdded: new Date().toISOString().split('T')[0]
      };

      setWhitelist([newItem, ...whitelist]);
      setIsModalOpen(false);
      setNewName('');
      setNewDomain('');
      setNewPlatform('');
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex justify-between items-end">
          <div>
            <h1 className="font-serif text-3xl text-primary font-medium">Whitelist</h1>
            <p className="text-secondary mt-1 text-sm">Authorized sellers and partners to ignore during scans.</p>
          </div>
          <Button icon={Plus} onClick={() => setIsModalOpen(true)}>
             Add Entity
          </Button>
      </div>

      <BentoCard className="overflow-hidden">
         <div className="p-4 border-b border-border flex items-center gap-3 bg-surface/50">
            <Search size={16} className="text-secondary" />
            <input 
               type="text" 
               placeholder="Search whitelist..." 
               className="bg-transparent border-none focus:ring-0 text-sm w-full outline-none text-primary placeholder-secondary/50 font-mono"
            />
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
               <thead className="bg-surface text-secondary text-xs uppercase tracking-wider font-medium">
                  <tr>
                     <th className="px-6 py-4">Entity Name</th>
                     <th className="px-6 py-4">Domain / ID</th>
                     <th className="px-6 py-4">Platform</th>
                     <th className="px-6 py-4">Date Added</th>
                     <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-border">
                  {whitelist.map((item) => (
                     <tr key={item.id} className="hover:bg-surface/50 transition-colors group">
                        <td className="px-6 py-4">
                           <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold font-serif">
                                 {item.name.charAt(0)}
                              </div>
                              <span className="font-medium text-primary">{item.name}</span>
                           </div>
                        </td>
                        <td className="px-6 py-4 text-secondary font-mono text-xs">
                           {item.domain}
                        </td>
                        <td className="px-6 py-4">
                           <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-surface border border-border text-secondary">
                              <Globe size={10} />
                              {item.platform}
                           </span>
                        </td>
                        <td className="px-6 py-4 text-secondary text-xs font-mono">{item.dateAdded}</td>
                        <td className="px-6 py-4 text-right">
                           <button 
                              onClick={() => removeEntry(item.id)}
                              className="text-secondary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2 hover:bg-red-500/10 rounded"
                           >
                              <Trash2 size={16} />
                           </button>
                        </td>
                     </tr>
                  ))}
                  {whitelist.length === 0 && (
                     <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-secondary">
                           No whitelisted entities found.
                        </td>
                     </tr>
                  )}
               </tbody>
            </table>
         </div>
      </BentoCard>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Whitelist Entity"
      >
          <div className="p-6">
            <form onSubmit={handleAdd} className="space-y-4">
                <div>
                    <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">Name</label>
                    <input 
                      autoFocus
                      type="text" 
                      required
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-primary focus:border-primary outline-none transition-colors"
                      placeholder="e.g. Official Reseller LLC"
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">Domain / ID</label>
                    <input 
                      type="text" 
                      required
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-primary focus:border-primary outline-none transition-colors"
                      placeholder="e.g. reseller.com or @handle"
                      value={newDomain}
                      onChange={e => setNewDomain(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">Platform</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-primary focus:border-primary outline-none transition-colors"
                      placeholder="e.g. Amazon, Instagram"
                      value={newPlatform}
                      onChange={e => setNewPlatform(e.target.value)}
                    />
                </div>
                <div className="pt-6 flex gap-3">
                    <Button type="button" variant="ghost" className="flex-1" onClick={() => setIsModalOpen(false)}>
                        Cancel
                    </Button>
                    <Button type="submit" className="flex-1">
                        Add Entity
                    </Button>
                </div>
            </form>
          </div>
      </Modal>
    </div>
  );
};

export default Whitelist;