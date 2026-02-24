import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';

interface ImageCarouselProps {
  images: string[];
  alt?: string;
  className?: string;
}

const ImageCarousel: React.FC<ImageCarouselProps> = ({ images, alt = 'Image', className = '' }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());

  const validImages = images.filter((_, i) => !imageErrors.has(i));
  const totalImages = images.length;

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? totalImages - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === totalImages - 1 ? 0 : prev + 1));
  };

  const handleImageError = (index: number) => {
    setImageErrors((prev) => new Set(prev).add(index));
  };

  if (totalImages === 0) {
    return (
      <div className={`flex flex-col items-center justify-center bg-surface border border-border rounded-lg text-secondary ${className}`}>
        <ImageOff size={32} />
        <span className="text-xs mt-2">No images available</span>
      </div>
    );
  }

  return (
    <div className={`relative group ${className}`}>
      {/* Main Image */}
      <div className="aspect-square bg-surface border border-border rounded-lg overflow-hidden">
        {imageErrors.has(currentIndex) ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-secondary">
            <ImageOff size={32} />
            <span className="text-xs mt-2">Failed to load image</span>
          </div>
        ) : (
          <img
            src={images[currentIndex]}
            alt={`${alt} ${currentIndex + 1}`}
            className="w-full h-full object-contain"
            onError={() => handleImageError(currentIndex)}
          />
        )}
      </div>

      {/* Navigation Arrows - only show if multiple images */}
      {totalImages > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Previous image"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Next image"
          >
            <ChevronRight size={16} />
          </button>
        </>
      )}

      {/* Image Counter */}
      {totalImages > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/70 backdrop-blur-sm text-white text-xs font-mono rounded">
          {currentIndex + 1} of {totalImages} images
        </div>
      )}

      {/* Dot Indicators - only show if multiple images and less than 8 */}
      {totalImages > 1 && totalImages <= 7 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex
                  ? 'bg-primary w-4'
                  : 'bg-border hover:bg-secondary'
              }`}
              aria-label={`Go to image ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageCarousel;
