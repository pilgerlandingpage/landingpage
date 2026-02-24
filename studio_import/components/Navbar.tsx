
import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { WHATSAPP_LINK } from '../constants';

const Navbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 px-6 py-4 ${isScrolled ? 'bg-black/80 backdrop-blur-md border-b border-white/10' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex flex-col">
          <span className="text-2xl font-serif tracking-[0.2em] font-bold">L'HÉRITAGE</span>
          <span className="text-[10px] tracking-[0.4em] text-white/50 uppercase">The Pinnacle of Living</span>
        </div>
        
        <div className="hidden md:flex space-x-8 text-xs tracking-widest uppercase font-medium">
          <a href="#experiencia" className="hover:text-yellow-500 transition-colors">Experiência</a>
          <a href="#galeria" className="hover:text-yellow-500 transition-colors">Galeria</a>
          <a href="#diferenciais" className="hover:text-yellow-500 transition-colors">Diferenciais</a>
        </div>

        <a 
          href={WHATSAPP_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden md:block bg-white text-black px-6 py-2.5 text-xs font-bold tracking-widest uppercase hover:bg-yellow-500 transition-all duration-300 transform active:scale-95"
        >
          Falar com Consultor
        </a>

        <button className="md:hidden text-white">
          <Menu size={24} />
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
