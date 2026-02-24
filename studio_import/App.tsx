
import React, { useEffect } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Positioning from './components/Positioning';
import Gallery from './components/Gallery';
import Features from './components/Features';
import Experience from './components/Experience';
import Consultant from './components/Consultant';
import Footer from './components/Footer';

function App() {
  useEffect(() => {
    // Reveal animation on scroll logic using Intersection Observer
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.1,
    };

    const handleIntersect = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-fade-in');
          entry.target.classList.remove('opacity-0');
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersect, observerOptions);
    const sections = document.querySelectorAll('section');
    sections.forEach((section) => {
      section.classList.add('opacity-0', 'transition-opacity', 'duration-1000');
      observer.observe(section);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative overflow-x-hidden selection:bg-yellow-500/30 selection:text-white">
      <Navbar />
      
      <main>
        <Hero />
        
        <div className="bg-black">
          <Positioning />
          
          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          
          <Features />
          
          <Gallery />
          
          <Experience />
          
          <Consultant />
        </div>
      </main>

      <Footer />
      
      {/* Floating Contact Widget */}
      <a 
        href="https://wa.me/5599999999999" 
        target="_blank" 
        rel="noopener noreferrer"
        className="fixed bottom-8 right-8 z-[100] bg-[#25D366] text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform flex items-center justify-center animate-bounce"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-message-circle"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
      </a>
    </div>
  );
}

export default App;
