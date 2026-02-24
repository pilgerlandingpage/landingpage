
import React from 'react';
import { Shield, Waves, Crown, MapPin, Maximize, Sparkles } from 'lucide-react';
import { Differential, GalleryItem } from './types';

export const WHATSAPP_LINK = "https://wa.me/5599999999999?text=Ol%C3%A1%2C+gostaria+de+receber+a+apresenta%C3%A7%C3%A3o+exclusiva+do+L%27H%C3%A9ritage.";

export const DIFFERENTIALS: Differential[] = [
  {
    id: 1,
    title: "Pé na Areia Genuíno",
    description: "Acesso direto e privativo à área mais nobre da orla, onde o mar é sua extensão.",
    icon: "Waves"
  },
  {
    id: 2,
    title: "Sky Pool 360º",
    description: "A piscina com borda infinita mais alta da região, flutuando sobre o horizonte.",
    icon: "Crown"
  },
  {
    id: 3,
    title: "Segurança Inteligente",
    description: "Protocolos militares de segurança integrados à tecnologia de reconhecimento biométrico.",
    icon: "Shield"
  },
  {
    id: 4,
    title: "Localização Única",
    description: "No epicentro do luxo, cercado pelos endereços mais desejados do continente.",
    icon: "MapPin"
  },
  {
    id: 5,
    title: "Área Privativa Vasta",
    description: "Apartamentos com metragens que redefinem o conceito de liberdade e amplitude.",
    icon: "Maximize"
  },
  {
    id: 6,
    title: "Concierge 24h",
    description: "Atendimento personalizado para atender todos os seus desejos, sem exceções.",
    icon: "Sparkles"
  }
];

export const GALLERY_ITEMS: GalleryItem[] = [
  { id: 1, url: "https://picsum.photos/seed/luxury1/1200/800", title: "Living Room Concept" },
  { id: 2, url: "https://picsum.photos/seed/luxury2/1200/800", title: "Master Suite" },
  { id: 3, url: "https://picsum.photos/seed/luxury3/1200/800", title: "Infinity Pool View" },
  { id: 4, url: "https://picsum.photos/seed/luxury4/1200/800", title: "Private Gourmet Area" },
  { id: 5, url: "https://picsum.photos/seed/luxury5/1200/800", title: "Spa & Wellness" },
  { id: 6, url: "https://picsum.photos/seed/luxury6/1200/800", title: "Grand Entrance Hall" }
];

export const ICON_MAP: Record<string, React.ReactNode> = {
  Waves: <Waves className="w-8 h-8 text-yellow-500/80" />,
  Crown: <Crown className="w-8 h-8 text-yellow-500/80" />,
  Shield: <Shield className="w-8 h-8 text-yellow-500/80" />,
  MapPin: <MapPin className="w-8 h-8 text-yellow-500/80" />,
  Maximize: <Maximize className="w-8 h-8 text-yellow-500/80" />,
  Sparkles: <Sparkles className="w-8 h-8 text-yellow-500/80" />
};
