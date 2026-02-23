import React, { useState, useEffect } from 'react';
import BentoCard from '../ui/BentoCard';
import Button from '../ui/Button';
import { useDashboard } from '../../context/DashboardContext';
import { useAuth } from '../../context/AuthContext';
import {
  User, Bell, Shield, Key, CreditCard, Mail, Globe, Moon,
  Smartphone, LogOut, Camera, Check, Plug, Eye, EyeOff, Loader2, CheckCircle, XCircle, Database, Trash2
} from 'lucide-react';
import {
  getVisionConfig,
  saveVisionConfig,
  saveVisionProvider,
  isServerManagedSerpApiEnabled,
  type ImageSearchProvider
} from '../../lib/api-config';
import { testVisionApiConnection } from '../../lib/vision-api';
import { seedDatabase, clearBrandData } from '../../lib/seed-data';

interface SettingsProps {
  initialSection?: string;
}

const Settings: React.FC<SettingsProps> = ({ initialSection = 'profile' }) => {
  const { theme, toggleTheme, addNotification } = useDashboard();
  const { user, profile, updateProfile, currentBrand } = useAuth();
  const [activeSection, setActiveSection] = useState(initialSection);

  // Profile form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bio, setBio] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // API Configuration state
  const [searchProvider, setSearchProvider] = useState<ImageSearchProvider>('google_vision');
  const [visionApiKey, setVisionApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const hasServerManagedSerpApi = isServerManagedSerpApiEnabled();

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  // Initialize profile form with user data
  useEffect(() => {
    const fullName = profile?.fullName || user?.user_metadata?.full_name || '';
    const nameParts = fullName.split(' ');
    setFirstName(nameParts[0] || '');
    setLastName(nameParts.slice(1).join(' ') || '');
  }, [profile, user]);

  const handleSaveProfile = async () => {
    const fullName = `${firstName} ${lastName}`.trim();
    if (!fullName) {
      addNotification('error', 'Please enter your name');
      return;
    }

    setIsSavingProfile(true);
    try {
      const { error } = await updateProfile({ fullName });
      if (error) {
        addNotification('error', error.message || 'Failed to update profile');
      } else {
        addNotification('success', 'Profile updated successfully');
      }
    } catch (err) {
      addNotification('error', 'Failed to update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Load saved API key on mount
  useEffect(() => {
    const config = getVisionConfig();
    setSearchProvider(config.provider);
    const activeKey = config.provider === 'serpapi_lens'
      ? (hasServerManagedSerpApi ? '' : config.serpApiKey)
      : config.googleVisionApiKey || config.apiKey;
    setVisionApiKey(activeKey || '');
    setConnectionStatus('idle');
  }, [hasServerManagedSerpApi]);

  const handleSaveApiKey = () => {
    if (searchProvider === 'serpapi_lens' && hasServerManagedSerpApi && !visionApiKey.trim()) {
      saveVisionConfig('', 'serpapi_lens');
      addNotification('success', 'SerpApi key is managed server-side and stored outside the browser.');
      setConnectionStatus('idle');
      return;
    }

    saveVisionConfig(visionApiKey, searchProvider);
    addNotification(
      'success',
      searchProvider === 'serpapi_lens'
        ? 'SerpApi key saved successfully'
        : 'Google Vision key saved successfully'
    );
    setConnectionStatus('idle');
  };

  const handleProviderChange = (provider: ImageSearchProvider) => {
    setSearchProvider(provider);
    saveVisionProvider(provider);
    const config = getVisionConfig();
    setVisionApiKey(
      provider === 'serpapi_lens'
        ? (hasServerManagedSerpApi ? '' : config.serpApiKey)
        : config.googleVisionApiKey
    );
    setConnectionStatus('idle');
  };

  const isSerpApiProvider = searchProvider === 'serpapi_lens';
  const isServerManagedSerpApi = isSerpApiProvider && hasServerManagedSerpApi;

  const handleTestConnection = async () => {
    if (!visionApiKey && !isServerManagedSerpApi) {
      addNotification('error', 'Please enter an API key first');
      return;
    }

    setIsTestingConnection(true);
    setConnectionStatus('idle');

    // Save temporarily for testing if the key is client-managed.
    if (!isServerManagedSerpApi || visionApiKey.trim()) {
      saveVisionConfig(visionApiKey, searchProvider);
    } else {
      saveVisionConfig('', 'serpapi_lens');
    }

    try {
      const success = await testVisionApiConnection();
      if (success) {
        setConnectionStatus('success');
        addNotification('success', 'Connection successful! API key is valid.');
      } else {
        setConnectionStatus('error');
        addNotification('error', 'Connection failed. Please check your API key.');
      }
    } catch (error) {
      setConnectionStatus('error');
      addNotification('error', 'Connection failed. Please check your API key.');
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Developer tools state
  const [isSeeding, setIsSeeding] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const handleSeedData = async () => {
    if (!user || !currentBrand) {
      addNotification('error', 'No user or brand found. Please sign in first.');
      return;
    }

    setIsSeeding(true);
    try {
      const result = await seedDatabase(user.id, currentBrand.id);
      if (result.success) {
        addNotification('success', 'Demo data seeded successfully! Refresh the page to see changes.');
      } else {
        addNotification('error', `Failed to seed data: ${result.error}`);
      }
    } catch (error) {
      addNotification('error', 'Failed to seed data');
    } finally {
      setIsSeeding(false);
    }
  };

  const handleClearData = async () => {
    if (!currentBrand) {
      addNotification('error', 'No brand found.');
      return;
    }

    setIsClearing(true);
    try {
      const result = await clearBrandData(currentBrand.id);
      if (result.success) {
        addNotification('success', 'Brand data cleared. Refresh to see changes.');
      } else {
        addNotification('error', 'Failed to clear data');
      }
    } catch (error) {
      addNotification('error', 'Failed to clear data');
    } finally {
      setIsClearing(false);
    }
  };

  const sections = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'integrations', label: 'Integrations', icon: Plug },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'developer', label: 'Developer', icon: Database },
  ];

  return (
    <div className="space-y-8 animate-in fade-in h-full">
      <div className="flex justify-between items-end">
         <div>
            <h1 className="font-serif text-3xl text-primary font-medium">Settings</h1>
            <p className="text-secondary mt-1 text-sm">Manage your account preferences and workspace configuration.</p>
         </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-stretch min-h-[500px]">
        {/* Settings Navigation */}
        <div className="w-full lg:w-64 shrink-0 flex flex-col">
            <div className="space-y-2">
                {sections.map(section => (
                    <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors border border-transparent
                        ${activeSection === section.id 
                            ? 'bg-surface text-primary border-border' 
                            : 'text-secondary hover:text-primary hover:bg-surface/50'}`}
                    >
                        <section.icon size={18} />
                        {section.label}
                    </button>
                ))}
            </div>
            
            <div className="mt-auto pt-4">
                <div className="pt-4 border-t border-border">
                    <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors">
                        <LogOut size={18} />
                        Sign Out
                    </button>
                </div>
            </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 space-y-6">
            
            {/* PROFILE SECTION */}
            {activeSection === 'profile' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                    <BentoCard title="Public Profile">
                        <div className="flex flex-col md:flex-row gap-8 items-start mt-4">
                            <div className="relative group cursor-pointer">
                                <div className="w-24 h-24 bg-surface border border-border rounded-full overflow-hidden">
                                    <img src="https://i.pravatar.cc/150?u=a042581f4e29026704d" alt="Profile" className="w-full h-full object-cover" />
                                </div>
                                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Camera className="text-white" size={24} />
                                </div>
                            </div>
                            <div className="flex-1 space-y-4 w-full">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">First Name</label>
                                        <input
                                          type="text"
                                          value={firstName}
                                          onChange={(e) => setFirstName(e.target.value)}
                                          placeholder="Enter your first name"
                                          className="w-full px-3 py-2 bg-background border border-border rounded-none text-sm text-primary focus:border-primary outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">Last Name</label>
                                        <input
                                          type="text"
                                          value={lastName}
                                          onChange={(e) => setLastName(e.target.value)}
                                          placeholder="Enter your last name"
                                          className="w-full px-3 py-2 bg-background border border-border rounded-none text-sm text-primary focus:border-primary outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">Email</label>
                                    <input
                                      type="email"
                                      value={user?.email || ''}
                                      disabled
                                      className="w-full px-3 py-2 bg-surface border border-border rounded-none text-sm text-secondary cursor-not-allowed"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">Bio</label>
                                    <textarea
                                      rows={3}
                                      value={bio}
                                      onChange={(e) => setBio(e.target.value)}
                                      placeholder="Tell us about yourself..."
                                      className="w-full px-3 py-2 bg-background border border-border rounded-none text-sm text-primary focus:border-primary outline-none resize-none"
                                    />
                                </div>
                                <div className="flex justify-end">
                                    <Button
                                      size="sm"
                                      onClick={handleSaveProfile}
                                      disabled={isSavingProfile}
                                    >
                                      {isSavingProfile ? (
                                        <>
                                          <Loader2 size={14} className="animate-spin mr-1" />
                                          Saving...
                                        </>
                                      ) : (
                                        'Save Changes'
                                      )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </BentoCard>

                    <BentoCard title="Preferences">
                        <div className="mt-4 space-y-4">
                            <div className="flex items-center justify-between py-3 border-b border-border border-dashed">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-surface border border-border text-primary">
                                        <Globe size={18} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-primary">Language</p>
                                        <p className="text-xs text-secondary">Select your interface language</p>
                                    </div>
                                </div>
                                <select className="bg-background border border-border text-sm px-3 py-1.5 outline-none">
                                    <option>English (US)</option>
                                    <option>French</option>
                                    <option>German</option>
                                </select>
                            </div>
                            <div className="flex items-center justify-between py-3">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-surface border border-border text-primary">
                                        <Moon size={18} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-primary">Theme</p>
                                        <p className="text-xs text-secondary">Toggle dark mode</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={toggleTheme}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${theme === 'dark' ? 'bg-primary' : 'bg-border'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-inverse transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                        </div>
                    </BentoCard>
                </div>
            )}

            {/* NOTIFICATIONS SECTION */}
            {activeSection === 'notifications' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                    <BentoCard title="Email Alerts">
                        <div className="mt-4 space-y-2">
                             {[
                                 { label: 'Weekly Summary Report', desc: 'Get a digest of all infringements every Monday', checked: true },
                                 { label: 'High Risk Alerts', desc: 'Immediate notification for high-value copycats', checked: true },
                                 { label: 'Takedown Updates', desc: 'Status changes on your submitted reports', checked: false },
                                 { label: 'Marketing', desc: 'News about product features and updates', checked: false }
                             ].map((item, i) => (
                                 <div key={i} className="flex items-start gap-3 py-3 border-b border-border last:border-0 border-dashed">
                                     <div className="pt-0.5">
                                         <input type="checkbox" defaultChecked={item.checked} className="w-4 h-4 accent-primary bg-background border-border rounded-none cursor-pointer" />
                                     </div>
                                     <div>
                                         <p className="text-sm font-medium text-primary">{item.label}</p>
                                         <p className="text-xs text-secondary">{item.desc}</p>
                                     </div>
                                 </div>
                             ))}
                        </div>
                        <div className="mt-4 flex justify-end">
                            <Button size="sm" variant="secondary">Update Preferences</Button>
                        </div>
                    </BentoCard>
                </div>
            )}

            {/* SECURITY SECTION */}
            {activeSection === 'security' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                    <BentoCard title="API Access">
                        <div className="mt-4">
                            <p className="text-sm text-secondary mb-4">Use this key to authenticate requests to the Brandog Platform API.</p>
                            <div className="flex gap-2">
                                <div className="flex-1 bg-surface border border-border px-4 py-2.5 font-mono text-sm text-primary flex items-center justify-between">
                                    <span>pk_live_51Msz...x82z9</span>
                                    <button className="text-xs text-secondary hover:text-primary">Copy</button>
                                </div>
                                <Button variant="secondary" icon={Key}>Roll Key</Button>
                            </div>
                        </div>
                    </BentoCard>
                    
                    <BentoCard title="Two-Factor Authentication">
                        <div className="mt-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-green-500/10 text-green-500 flex items-center justify-center rounded-none border border-green-500/20">
                                    <Smartphone size={20} />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-primary">2FA is Enabled</p>
                                    <p className="text-xs text-secondary">Your account is secured with an authenticator app.</p>
                                </div>
                            </div>
                            <Button variant="outline" size="sm">Configure</Button>
                        </div>
                    </BentoCard>
                </div>
            )}

             {/* INTEGRATIONS SECTION */}
            {activeSection === 'integrations' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                                        <BentoCard title="Reverse Image Search API">
                        <div className="mt-4 space-y-4">
                            <p className="text-sm text-secondary">
                                Select the provider used for reverse image matching against online duplicates and lookalikes.
                            </p>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleProviderChange('google_vision')}
                                    className={`px-3 py-1.5 text-xs border rounded-lg transition-colors ${
                                        !isSerpApiProvider
                                            ? 'bg-primary text-inverse border-primary'
                                            : 'bg-background text-secondary border-border hover:text-primary'
                                    }`}
                                >
                                    Google Vision
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleProviderChange('serpapi_lens')}
                                    className={`px-3 py-1.5 text-xs border rounded-lg transition-colors ${
                                        isSerpApiProvider
                                            ? 'bg-primary text-inverse border-primary'
                                            : 'bg-background text-secondary border-border hover:text-primary'
                                    }`}
                                >
                                    SerpApi Google Lens
                                </button>
                            </div>

                            <div className="bg-surface/50 border border-border p-4 rounded-lg space-y-3">
                                <h4 className="text-xs font-medium text-secondary uppercase tracking-wider">Setup Instructions</h4>
                                {isSerpApiProvider ? (
                                    <ol className="text-xs text-secondary space-y-1.5 list-decimal list-inside">
                                        <li>Open <a href="https://serpapi.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">SerpApi Dashboard</a></li>
                                        <li>{isServerManagedSerpApi ? 'Server-managed key is enabled in your environment' : 'Copy your SerpApi API key'}</li>
                                        <li>Select <strong>SerpApi Google Lens</strong> as provider</li>
                                        <li>{isServerManagedSerpApi ? 'Use Test Connection to validate proxy access' : 'Paste the key below and test connection'}</li>
                                        <li>Keep uploaded assets in Supabase storage so signed URLs can be scanned</li>
                                    </ol>
                                ) : (
                                    <ol className="text-xs text-secondary space-y-1.5 list-decimal list-inside">
                                        <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google Cloud Console</a></li>
                                        <li>Create a new project (or select existing)</li>
                                        <li>Enable the <strong>Cloud Vision API</strong></li>
                                        <li>Go to Credentials -&gt; Create API Key</li>
                                        <li>Restrict the key to Cloud Vision API (recommended)</li>
                                        <li>Paste the key below</li>
                                    </ol>
                                )}
                                <p className="text-[10px] text-secondary/70 mt-2">
                                    {isSerpApiProvider
                                        ? 'SerpApi pricing depends on your SerpApi plan and search volume.'
                                        : 'Google Vision free tier includes 1,000 Web Detection searches/month.'}
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">
                                    {isServerManagedSerpApi
                                      ? 'SerpApi API Key (Server Managed)'
                                      : isSerpApiProvider
                                        ? 'SerpApi API Key'
                                        : 'Google Vision API Key'}
                                </label>
                                {isServerManagedSerpApi && (
                                    <p className="text-xs text-secondary mb-2">
                                        Requests use the server proxy key from environment variables; no key is stored in browser localStorage.
                                    </p>
                                )}
                                <div className="relative">
                                    <input
                                        type={showApiKey ? 'text' : 'password'}
                                        value={visionApiKey}
                                        onChange={(e) => {
                                            setVisionApiKey(e.target.value);
                                            setConnectionStatus('idle');
                                        }}
                                        placeholder={isServerManagedSerpApi
                                          ? 'Server-managed key is active'
                                          : isSerpApiProvider
                                            ? 'Enter your SerpApi key'
                                            : 'Enter your Google Cloud Vision API key'}
                                        className="w-full px-3 py-2 pr-10 bg-background border border-border rounded-none text-sm text-primary focus:border-primary outline-none font-mono"
                                        disabled={isServerManagedSerpApi}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowApiKey(!showApiKey)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-secondary hover:text-primary p-1"
                                        disabled={isServerManagedSerpApi}
                                    >
                                        {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <Button
                                    onClick={handleSaveApiKey}
                                    size="sm"
                                    disabled={!visionApiKey && !isServerManagedSerpApi}
                                >
                                    {isServerManagedSerpApi
                                      ? 'Use Server Key'
                                      : isSerpApiProvider
                                        ? 'Save SerpApi Key'
                                        : 'Save Google Key'}
                                </Button>
                                <Button
                                    onClick={handleTestConnection}
                                    variant="secondary"
                                    size="sm"
                                    disabled={(!visionApiKey && !isServerManagedSerpApi) || isTestingConnection}
                                >
                                    {isTestingConnection ? (
                                        <>
                                            <Loader2 size={14} className="animate-spin mr-1" />
                                            Testing...
                                        </>
                                    ) : (
                                        'Test Connection'
                                    )}
                                </Button>

                                {connectionStatus === 'success' && (
                                    <span className="flex items-center gap-1 text-green-500 text-xs">
                                        <CheckCircle size={14} />
                                        Connected
                                    </span>
                                )}
                                {connectionStatus === 'error' && (
                                    <span className="flex items-center gap-1 text-red-500 text-xs">
                                        <XCircle size={14} />
                                        Failed
                                    </span>
                                )}
                            </div>
                        </div>
                    </BentoCard>

                    <BentoCard title="Assistant Backend">
                        <div className="mt-4">
                            <p className="text-sm text-secondary mb-4">
                                The dashboard assistant now runs in local analytics mode by default.
                                For production AI responses, connect a server endpoint and keep model API keys server-side only.
                            </p>
                            <div className="flex items-center gap-2 text-xs text-secondary/70">
                                <code className="bg-surface px-2 py-1 rounded">POST /api/assistant</code>
                            </div>
                        </div>
                    </BentoCard>
                </div>
            )}

             {/* BILLING SECTION */}
             {activeSection === 'billing' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                    <BentoCard title="Current Plan">
                         <div className="mt-4 flex justify-between items-start">
                             <div>
                                 <h3 className="text-xl font-medium text-primary">Enterprise</h3>
                                 <p className="text-secondary text-sm mt-1">$499 / month • Billed annually</p>
                             </div>
                             <span className="bg-primary text-inverse px-3 py-1 text-xs font-medium uppercase tracking-wider">Active</span>
                         </div>
                         <div className="mt-6 pt-6 border-t border-border grid grid-cols-3 gap-4">
                             <div>
                                 <p className="text-[10px] text-secondary uppercase tracking-wider">Next Invoice</p>
                                 <p className="font-mono text-sm text-primary mt-1">Oct 24, 2024</p>
                             </div>
                             <div>
                                 <p className="text-[10px] text-secondary uppercase tracking-wider">Keywords</p>
                                 <p className="font-mono text-sm text-primary mt-1">12 / 50 Used</p>
                             </div>
                             <div>
                                 <p className="text-[10px] text-secondary uppercase tracking-wider">Seats</p>
                                 <p className="font-mono text-sm text-primary mt-1">4 / 10 Used</p>
                             </div>
                         </div>
                    </BentoCard>
                    <BentoCard title="Payment Method">
                        <div className="mt-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-8 bg-surface border border-border flex items-center justify-center rounded-sm">
                                    <div className="flex gap-0.5">
                                        <div className="w-3 h-3 rounded-full bg-red-500 opacity-80"></div>
                                        <div className="w-3 h-3 rounded-full bg-yellow-500 opacity-80 -ml-1.5"></div>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-primary">Mastercard ending in 8822</p>
                                    <p className="text-xs text-secondary">Expires 12/25</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm">Edit</Button>
                        </div>
                    </BentoCard>
                </div>
             )}

             {/* DEVELOPER SECTION */}
             {activeSection === 'developer' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                    <BentoCard title="Seed Demo Data">
                        <div className="mt-4 space-y-4">
                            <p className="text-sm text-secondary">
                                Populate your database with sample data to test the application. This will create sample keywords, whitelist entries, IP documents, infringements, and activity logs.
                            </p>
                            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                                <p className="text-xs text-yellow-500">
                                    <strong>Note:</strong> This will add data to your current brand. Make sure you have a brand selected.
                                </p>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-secondary">
                                <span>Current Brand:</span>
                                <code className="bg-surface px-2 py-1 rounded">{currentBrand?.name || 'None'}</code>
                            </div>
                            <div className="flex gap-3">
                                <Button
                                    onClick={handleSeedData}
                                    disabled={isSeeding || !currentBrand}
                                    size="sm"
                                >
                                    {isSeeding ? (
                                        <>
                                            <Loader2 size={14} className="animate-spin mr-1" />
                                            Seeding...
                                        </>
                                    ) : (
                                        <>
                                            <Database size={14} className="mr-1" />
                                            Seed Demo Data
                                        </>
                                    )}
                                </Button>
                                <Button
                                    onClick={handleClearData}
                                    variant="outline"
                                    disabled={isClearing || !currentBrand}
                                    size="sm"
                                >
                                    {isClearing ? (
                                        <>
                                            <Loader2 size={14} className="animate-spin mr-1" />
                                            Clearing...
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 size={14} className="mr-1" />
                                            Clear Data
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </BentoCard>

                    <BentoCard title="Debug Info">
                        <div className="mt-4 space-y-2 font-mono text-xs">
                            <div className="flex justify-between py-2 border-b border-border/50">
                                <span className="text-secondary">User ID</span>
                                <span className="text-primary">{user?.id || 'Not logged in'}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-border/50">
                                <span className="text-secondary">Brand ID</span>
                                <span className="text-primary">{currentBrand?.id || 'No brand'}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-border/50">
                                <span className="text-secondary">Brand Name</span>
                                <span className="text-primary">{currentBrand?.name || '-'}</span>
                            </div>
                            <div className="flex justify-between py-2">
                                <span className="text-secondary">Email</span>
                                <span className="text-primary">{user?.email || '-'}</span>
                            </div>
                        </div>
                    </BentoCard>
                </div>
             )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
