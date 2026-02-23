import React, { useState, useEffect } from 'react';
import { Plus, Search, Globe, Trash2, Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import BentoCard from '../ui/BentoCard';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { isSupabaseConfigured } from '../../lib/supabase';
import {
  fetchWhitelist,
  createWhitelistEntry,
  deleteWhitelistEntry,
  type WhitelistItem
} from '../../lib/data-service';

const Whitelist: React.FC = () => {
  const { currentBrand } = useAuth();
  const { addNotification } = useDashboard();

  const [whitelist, setWhitelist] = useState<WhitelistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [newPlatform, setNewPlatform] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Load whitelist from Supabase
  useEffect(() => {
    const loadWhitelist = async () => {
      setIsLoading(true);

      if (!isSupabaseConfigured() || !currentBrand) {
        setWhitelist([]);
        setIsLoading(false);
        return;
      }

      try {
        const data = await fetchWhitelist(currentBrand.id);
        setWhitelist(data);
      } catch (error) {
        console.error('Error loading whitelist:', error);
        setWhitelist([]);
        addNotification('error', 'Failed to load whitelist');
      } finally {
        setIsLoading(false);
      }
    };

    loadWhitelist();
  }, [currentBrand?.id]);

  const removeEntry = async (id: string) => {
    if (!isSupabaseConfigured()) {
      addNotification('error', 'Supabase not configured');
      return;
    }

    if (!currentBrand) {
      addNotification('error', 'No brand selected');
      return;
    }

    setDeletingId(id);
    try {
      const success = await deleteWhitelistEntry(id);
      if (success) {
        setWhitelist(whitelist.filter(w => w.id !== id));
        addNotification('success', 'Entry removed from whitelist');
      } else {
        addNotification('error', 'Failed to remove entry');
      }
    } catch (error) {
      console.error('Error deleting whitelist entry:', error);
      addNotification('error', 'Failed to remove entry');
    } finally {
      setDeletingId(null);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newDomain) return;

    if (!isSupabaseConfigured()) {
      addNotification('error', 'Supabase not configured');
      return;
    }

    if (!currentBrand) {
      addNotification('error', 'No brand selected');
      return;
    }

    setIsSaving(true);
    try {
      const result = await createWhitelistEntry(
        currentBrand.id,
        newName,
        newDomain,
        newPlatform || undefined
      );

      if (result.data) {
        const newItem: WhitelistItem = {
          id: result.data.id,
          name: result.data.name,
          domain: result.data.domain,
          platform: result.data.platform || 'General Web',
          dateAdded: result.data.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
        };
        setWhitelist([newItem, ...whitelist]);
        addNotification('success', 'Entity added to whitelist');
        resetForm();
      } else if (result.error === 'duplicate') {
        addNotification('error', 'This domain is already in your whitelist');
      } else {
        addNotification('error', 'Failed to add entity');
      }
    } catch (error) {
      console.error('Error adding whitelist entry:', error);
      addNotification('error', 'Failed to add entity');
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setIsModalOpen(false);
    setNewName('');
    setNewDomain('');
    setNewPlatform('');
  };

  // Filter whitelist by search query
  const filteredWhitelist = whitelist.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.platform.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
        <span className="ml-3 text-secondary">Loading whitelist...</span>
      </div>
    );
  }

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
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
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
                  {filteredWhitelist.map((item) => (
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
                              disabled={deletingId === item.id}
                              className="text-secondary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2 hover:bg-red-500/10 rounded disabled:opacity-50"
                           >
                              {deletingId === item.id ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <Trash2 size={16} />
                              )}
                           </button>
                        </td>
                     </tr>
                  ))}
                  {filteredWhitelist.length === 0 && (
                     <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-secondary">
                           {searchQuery ? 'No matching entries found.' : 'No whitelisted entities found.'}
                        </td>
                     </tr>
                  )}
               </tbody>
            </table>
         </div>
      </BentoCard>

      <Modal
        isOpen={isModalOpen}
        onClose={resetForm}
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
                    <Button type="button" variant="ghost" className="flex-1" onClick={resetForm}>
                        Cancel
                    </Button>
                    <Button type="submit" className="flex-1" disabled={isSaving}>
                        {isSaving ? (
                          <>
                            <Loader2 size={14} className="animate-spin mr-1" />
                            Adding...
                          </>
                        ) : (
                          'Add Entity'
                        )}
                    </Button>
                </div>
            </form>
          </div>
      </Modal>
    </div>
  );
};

export default Whitelist;
