
import React from 'react';
import { DIFFERENTIALS, ICON_MAP } from '../constants';

const Features: React.FC = () => {
  return (
    <section id="diferenciais" className="py-32 px-6 bg-black">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 mb-24 items-end">
          <div>
            <span className="text-xs tracking-[0.3em] uppercase text-yellow-500/80 block mb-4">Engenharia de Luxo</span>
            <h2 className="text-5xl md:text-7xl font-serif">Onde a Perfeição se torna Padrão.</h2>
          </div>
          <p className="text-white/50 text-lg font-light leading-relaxed max-w-md">
            Cada pilar, cada acabamento em mármore italiano e cada sistema tecnológico foi projetado para elevar sua experiência de habitação ao inalcançável.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-y-16 gap-x-12">
          {DIFFERENTIALS.map((feature) => (
            <div key={feature.id} className="group p-8 border border-white/5 hover:border-yellow-500/30 transition-all duration-500 glass">
              <div className="mb-6 transform group-hover:-translate-y-2 transition-transform duration-300">
                {ICON_MAP[feature.icon]}
              </div>
              <h3 className="text-xl font-serif mb-4 group-hover:text-yellow-500 transition-colors">{feature.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed font-light">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
