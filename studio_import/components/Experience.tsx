
import React from 'react';
import { WHATSAPP_LINK } from '../constants';

const Experience: React.FC = () => {
  return (
    <section id="experiencia" className="relative py-40 overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img 
          src="https://picsum.photos/seed/luxurynight/1920/1080?blur=10" 
          alt="Atmosphere" 
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-black/80" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto text-center px-6">
        <h2 className="text-4xl md:text-7xl font-serif mb-12 leading-tight">
          Sinta a Liberdade do <br />
          <span className="italic text-yellow-500/90">Silêncio Absoluto.</span>
        </h2>
        <p className="text-xl md:text-2xl text-white/70 font-light leading-relaxed mb-16 italic">
          "Acordar com o som suave das ondas, sentir a brisa do mar entrando por janelas de vidro do chão ao teto e saber que, naquele momento, o tempo parou apenas para você. Isso não é viver em um apartamento, é viver em um estado de espírito."
        </p>
        <div className="w-16 h-px bg-white/30 mx-auto mb-16" />
        <a 
          href={WHATSAPP_LINK}
          className="inline-block px-12 py-5 bg-transparent border-2 border-white/50 text-white font-bold tracking-[0.3em] uppercase text-xs hover:bg-white hover:text-black transition-all duration-500"
        >
          Solicitar Experiência Presencial
        </a>
      </div>
    </section>
  );
};

export default Experience;
