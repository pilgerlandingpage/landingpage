
import React from 'react';
import { Award, CheckCircle } from 'lucide-react';

const Consultant: React.FC = () => {
  return (
    <section className="py-24 px-6 bg-white text-black">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-16 items-center">
        <div className="w-full md:w-1/3">
          <div className="relative aspect-[4/5] overflow-hidden rounded-sm grayscale shadow-2xl">
            <img 
              src="https://picsum.photos/seed/consultant/600/800" 
              alt="High-end Real Estate Specialist" 
              className="w-full h-full object-cover"
            />
          </div>
        </div>
        
        <div className="flex-1 space-y-8">
          <div className="inline-flex items-center space-x-2 bg-black text-white px-4 py-1.5 text-[10px] tracking-[0.2em] uppercase font-bold">
            <Award size={14} className="text-yellow-500" />
            <span>Consultoria de Alto Patrimônio</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-serif leading-tight">
            Transparência, Sigilo e <br /> Curadoria de Ativos.
          </h2>
          
          <p className="text-lg text-black/70 font-light leading-relaxed">
            Nossa incorporadora é sinônimo de excelência imobiliária global. Com décadas de experiência atendendo famílias de alto poder aquisitivo, entendemos que seu investimento exige não apenas beleza, mas solidez e valorização garantida.
          </p>

          <div className="grid grid-cols-2 gap-8 pt-4">
            <div className="flex items-start space-x-3">
              <CheckCircle className="text-black shrink-0" size={20} />
              <div>
                <h4 className="font-bold text-xs uppercase tracking-widest mb-1">Aprovação Imediata</h4>
                <p className="text-xs text-black/60">Processos simplificados de aquisição.</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <CheckCircle className="text-black shrink-0" size={20} />
              <div>
                <h4 className="font-bold text-xs uppercase tracking-widest mb-1">Privacidade Total</h4>
                <p className="text-xs text-black/60">Atendimento individual e exclusivo.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Consultant;
