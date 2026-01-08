import React from 'react';
import { Instagram, Facebook, ShoppingBag, Video, Store, Globe } from 'lucide-react';
import { PlatformType } from '../../types';
import { PLATFORM_CONFIG } from '../../constants';

interface PlatformIconProps {
  platform: PlatformType | string;
  size?: number;
  showLabel?: boolean;
  className?: string;
}

const PlatformIcon: React.FC<PlatformIconProps> = ({ 
  platform, 
  size = 14, 
  showLabel = false,
  className = '' 
}) => {
  const getIcon = (p: string) => {
    switch(p) {
      case 'Instagram': return <Instagram size={size} className="text-pink-600" />;
      case 'Meta Ads': return <Facebook size={size} className="text-white" />;
      case 'Shopify': return <ShoppingBag size={size} className="text-green-600" />;
      case 'TikTok Shop': return <Video size={size} className="text-black" />;
      case 'Amazon': return <Store size={size} className="text-orange-500" />;
      case 'AliExpress': return <ShoppingBag size={size} className="text-red-600" />;
      default: return <Globe size={size} className="text-gray-500" />;
    }
  };

  const config = PLATFORM_CONFIG[platform as PlatformType];
  const label = config ? config.label : platform;

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {getIcon(platform)}
      {showLabel && <span className="font-medium">{label}</span>}
    </div>
  );
};

export default PlatformIcon;