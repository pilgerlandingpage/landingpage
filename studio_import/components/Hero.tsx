
import React from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { WHATSAPP_LINK } from '../constants';

const Hero: React.FC = () => {
  return (
    <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">
      {/* Background Image / Placeholder for Cinematic Video */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://picsum.photos/seed/luxuryhero/1920/1080?grayscale" 
          alt="Luxury Real Estate" 
          className="w-full h-full object-cover scale-105 animate-[pulse_8s_infinite] opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/20" />
      </div>

      <div className="relative z-10 text-center max-w-4xl px-6">
        <div className="overflow-hidden mb-6">
          <p className="text-xs md:text-sm tracking-[0.5em] uppercase text-yellow-500/80 animate-fade-in-down">
            Exclusividade sem Precedentes
          </p>
        </div>
        
        <h1 className="text-5xl md:text-8xl font-serif mb-8 leading-tight tracking-tight animate-fade-in">
          O Ápice da <span className="italic">Existência</span> Humana
        </h1>
        
        <p className="text-lg md:text-xl text-white/70 mb-12 max-w-2xl mx-auto font-light leading-relaxed">
          Mais que uma residência, um manifesto de conquista. Onde a arquitetura de vanguarda encontra o horizonte infinito.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <a 
            href={WHATSAPP_LINK}
            className="group relative px-8 py-4 bg-white text-black font-bold tracking-widest uppercase text-sm w-full sm:w-auto transition-all duration-300 hover:bg-yellow-500"
          >
            Solicitar Apresentação Exclusiva
            <ArrowRight className="inline-block ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </a>
          <a 
            href="#experiencia"
            className="px-8 py-4 border border-white/20 hover:border-white text-white font-bold tracking-widest uppercase text-sm w-full sm:w-auto transition-all backdrop-blur-sm"
          >
            Explorar Legado
          </a>
        </div>
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce opacity-40">
        <ChevronDown size={32} />
      </div>
    </section>
  );
};

export default Hero;
