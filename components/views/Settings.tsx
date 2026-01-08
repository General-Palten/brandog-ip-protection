import React, { useState, useEffect } from 'react';
import BentoCard from '../ui/BentoCard';
import Button from '../ui/Button';
import { useDashboard } from '../../context/DashboardContext';
import {
  User, Bell, Shield, Key, CreditCard, Mail, Globe, Moon,
  Smartphone, LogOut, Camera, Check, Plug, Eye, EyeOff, Loader2, CheckCircle, XCircle
} from 'lucide-react';
import { getVisionConfig, saveVisionConfig } from '../../lib/api-config';
import { testVisionApiConnection } from '../../lib/vision-api';

interface SettingsProps {
  initialSection?: string;
}

const Settings: React.FC<SettingsProps> = ({ initialSection = 'profile' }) => {
  const { theme, toggleTheme, addNotification } = useDashboard();
  const [activeSection, setActiveSection] = useState(initialSection);

  // API Configuration state
  const [visionApiKey, setVisionApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  // Load saved API key on mount
  useEffect(() => {
    const config = getVisionConfig();
    if (config.apiKey) {
      setVisionApiKey(config.apiKey);
      setConnectionStatus('idle');
    }
  }, []);

  const handleSaveApiKey = () => {
    saveVisionConfig(visionApiKey);
    addNotification('success', 'API key saved successfully');
    setConnectionStatus('idle');
  };

  const handleTestConnection = async () => {
    if (!visionApiKey) {
      addNotification('error', 'Please enter an API key first');
      return;
    }

    setIsTestingConnection(true);
    setConnectionStatus('idle');

    // Save temporarily for testing
    saveVisionConfig(visionApiKey);

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

  const sections = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'integrations', label: 'Integrations', icon: Plug },
    { id: 'billing', label: 'Billing', icon: CreditCard },
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
                                        <input type="text" defaultValue="Viktor" className="w-full px-3 py-2 bg-background border border-border rounded-none text-sm text-primary focus:border-primary outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">Last Name</label>
                                        <input type="text" defaultValue="Vaughn" className="w-full px-3 py-2 bg-background border border-border rounded-none text-sm text-primary focus:border-primary outline-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">Bio</label>
                                    <textarea rows={3} defaultValue="Brand protection specialist." className="w-full px-3 py-2 bg-background border border-border rounded-none text-sm text-primary focus:border-primary outline-none resize-none" />
                                </div>
                                <div className="flex justify-end">
                                    <Button size="sm">Save Changes</Button>
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
                    <BentoCard title="Google Cloud Vision API">
                        <div className="mt-4 space-y-4">
                            <p className="text-sm text-secondary">
                                Enable reverse image search to find where your images appear online.
                                This uses Google Cloud Vision API's Web Detection feature.
                            </p>

                            <div className="bg-surface/50 border border-border p-4 rounded-lg space-y-3">
                                <h4 className="text-xs font-medium text-secondary uppercase tracking-wider">Setup Instructions</h4>
                                <ol className="text-xs text-secondary space-y-1.5 list-decimal list-inside">
                                    <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google Cloud Console</a></li>
                                    <li>Create a new project (or select existing)</li>
                                    <li>Enable the <strong>Cloud Vision API</strong></li>
                                    <li>Go to Credentials → Create API Key</li>
                                    <li>Restrict the key to Cloud Vision API (recommended)</li>
                                    <li>Paste the key below</li>
                                </ol>
                                <p className="text-[10px] text-secondary/70 mt-2">
                                    Free tier: 1,000 searches/month
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-2">
                                    API Key
                                </label>
                                <div className="relative">
                                    <input
                                        type={showApiKey ? 'text' : 'password'}
                                        value={visionApiKey}
                                        onChange={(e) => {
                                            setVisionApiKey(e.target.value);
                                            setConnectionStatus('idle');
                                        }}
                                        placeholder="Enter your Google Cloud Vision API Key"
                                        className="w-full px-3 py-2 pr-10 bg-background border border-border rounded-none text-sm text-primary focus:border-primary outline-none font-mono"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowApiKey(!showApiKey)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-secondary hover:text-primary p-1"
                                    >
                                        {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <Button
                                    onClick={handleSaveApiKey}
                                    size="sm"
                                    disabled={!visionApiKey}
                                >
                                    Save API Key
                                </Button>
                                <Button
                                    onClick={handleTestConnection}
                                    variant="secondary"
                                    size="sm"
                                    disabled={!visionApiKey || isTestingConnection}
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

                    <BentoCard title="Gemini AI (Chat Assistant)">
                        <div className="mt-4">
                            <p className="text-sm text-secondary mb-4">
                                The AI chat assistant uses Google Gemini. Configure your API key in the <code className="bg-surface px-1 py-0.5 rounded text-xs">.env.local</code> file.
                            </p>
                            <div className="flex items-center gap-2 text-xs text-secondary/70">
                                <code className="bg-surface px-2 py-1 rounded">GEMINI_API_KEY=your_key_here</code>
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
        </div>
      </div>
    </div>
  );
};

export default Settings;