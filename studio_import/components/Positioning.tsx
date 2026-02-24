
import React from 'react';

const Positioning: React.FC = () => {
  return (
    <section id="posicionamento" className="py-24 md:py-40 px-6 bg-black relative">
      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
        <div className="space-y-8">
          <span className="text-xs tracking-[0.3em] uppercase text-yellow-500/80">A Essência do Sucesso</span>
          <h2 className="text-4xl md:text-6xl font-serif leading-tight">
            Você não está comprando metros quadrados. <br />
            <span className="italic text-white/60 font-light">Você está reivindicando seu lugar no topo.</span>
          </h2>
          <p className="text-lg text-white/60 leading-relaxed font-light">
            O L’Héritage foi concebido para aqueles que já conquistaram tudo e agora buscam o raro. Cada detalhe foi desenhado para espelhar sua trajetória de sucesso e oferecer o conforto que apenas a exclusividade absoluta pode proporcionar.
          </p>
          <div className="pt-6">
            <div className="flex items-center space-x-4 border-l-2 border-yellow-500/50 pl-6 py-2">
              <span className="text-4xl font-serif">12</span>
              <span className="text-xs uppercase tracking-widest text-white/50">Unidades de <br /> Reserva Especial</span>
            </div>
          </div>
        </div>

        <div className="relative group overflow-hidden">
          <img 
            src="https://picsum.photos/seed/luxurylifestyle/800/1000" 
            alt="Luxury Lifestyle" 
            className="w-full grayscale hover:grayscale-0 transition-all duration-1000 transform group-hover:scale-110"
          />
          <div className="absolute inset-0 border border-white/10 m-4 pointer-events-none" />
        </div>
      </div>
    </section>
  );
};

export default Positioning;
