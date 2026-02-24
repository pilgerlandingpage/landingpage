
import React from 'react';
import { GALLERY_ITEMS } from '../constants';

const Gallery: React.FC = () => {
  return (
    <section id="galeria" className="py-24 bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-6xl font-serif mb-6">Perspectiva Estética</h2>
          <div className="w-24 h-px bg-yellow-500 mx-auto opacity-50" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {GALLERY_ITEMS.map((item) => (
            <div 
              key={item.id} 
              className="relative aspect-square overflow-hidden group cursor-pointer"
            >
              <img 
                src={item.url} 
                alt={item.title} 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center p-8">
                <div className="text-center transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                  <p className="text-xs tracking-widest uppercase mb-2 text-yellow-500">Explorar Detalhe</p>
                  <h3 className="text-2xl font-serif">{item.title}</h3>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Gallery;
