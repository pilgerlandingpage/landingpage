
import React from 'react';
import { Instagram, Linkedin, Facebook, MessageCircle } from 'lucide-react';
import { WHATSAPP_LINK } from '../constants';

const Footer: React.FC = () => {
  return (
    <footer className="bg-black py-24 px-6 border-t border-white/5">
      <div className="max-w-7xl mx-auto text-center">
        <div className="mb-20">
          <h2 className="text-5xl md:text-7xl font-serif mb-10 leading-tight">
            Este é o seu momento. <br />
            <span className="italic gold-gradient">Garanta seu Legado.</span>
          </h2>
          <p className="text-white/50 text-lg mb-12 max-w-xl mx-auto">
            Restam apenas 3 unidades disponíveis para aquisição imediata. Antecipe-se ao lançamento oficial.
          </p>
          <a 
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-4 bg-yellow-500 text-black px-12 py-5 font-bold tracking-[0.2em] uppercase text-sm hover:bg-white transition-all transform hover:scale-105 active:scale-95 shadow-2xl"
          >
            <MessageCircle size={20} />
            <span>Falar com Consultor Agora</span>
          </a>
        </div>

        <div className="grid md:grid-cols-3 gap-12 text-left items-start pt-20 border-t border-white/10">
          <div className="space-y-6">
            <div className="flex flex-col">
              <span className="text-2xl font-serif tracking-[0.2em] font-bold">L'HÉRITAGE</span>
              <span className="text-[10px] tracking-[0.4em] text-white/40 uppercase">A Signature Luxury Project</span>
            </div>
            <p className="text-xs text-white/30 leading-relaxed max-w-xs uppercase tracking-widest">
              Avenida Atlântica, Edifício L'Héritage, <br />
              Penthouses Collection.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-4">
              <h4 className="text-[10px] uppercase tracking-[0.3em] font-bold text-yellow-500">Navegação</h4>
              <ul className="text-xs space-y-3 text-white/50 tracking-widest uppercase">
                <li><a href="#" className="hover:text-white transition-colors">Home</a></li>
                <li><a href="#galeria" className="hover:text-white transition-colors">Galeria</a></li>
                <li><a href="#experiencia" className="hover:text-white transition-colors">Lifestyle</a></li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="text-[10px] uppercase tracking-[0.3em] font-bold text-yellow-500">Legal</h4>
              <ul className="text-xs space-y-3 text-white/50 tracking-widest uppercase">
                <li><a href="#" className="hover:text-white transition-colors">Privacidade</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Termos</a></li>
                <li><a href="#" className="hover:text-white transition-colors">RI</a></li>
              </ul>
            </div>
          </div>

          <div className="space-y-6 md:text-right">
            <h4 className="text-[10px] uppercase tracking-[0.3em] font-bold text-yellow-500">Acompanhe o Luxo</h4>
            <div className="flex md:justify-end space-x-6">
              <a href="#" className="text-white/40 hover:text-white transition-colors"><Instagram size={20} /></a>
              <a href="#" className="text-white/40 hover:text-white transition-colors"><Linkedin size={20} /></a>
              <a href="#" className="text-white/40 hover:text-white transition-colors"><Facebook size={20} /></a>
            </div>
          </div>
        </div>

        <div className="mt-20 pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center text-[10px] tracking-[0.5em] text-white/20 uppercase">
          <span>&copy; 2024 L'Héritage Luxury Living.</span>
          <span className="mt-4 md:mt-0">Todos os direitos reservados.</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
