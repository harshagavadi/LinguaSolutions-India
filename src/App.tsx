import { Globe2, Sparkles, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Translator } from './components/Translator';
import { PrivacyPolicy, TermsOfService, AboutUs, ContactUs } from './components/Legal';

const Logo = ({ onClick }: { onClick?: () => void }) => (
  <div className="flex items-center gap-3 cursor-pointer" onClick={onClick}>
    <div className="relative">
      <div className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl text-white shadow-lg shadow-blue-200 ring-4 ring-blue-50">
        <Globe2 className="w-6 h-6" />
      </div>
      <div className="absolute -top-1 -right-1 bg-yellow-400 p-1 rounded-lg border-2 border-white shadow-sm animate-pulse">
        <Sparkles className="w-2.5 h-2.5 text-white" />
      </div>
    </div>
    <div className="flex flex-col -gap-1">
      <h1 className="text-xl font-black tracking-tight text-gray-900 leading-tight">
        LINGUA<span className="text-blue-600">SOLUTIONS</span>
      </h1>
      <div className="flex items-center gap-1.5">
        <div className="h-0.5 w-4 bg-blue-600 rounded-full" />
        <span className="text-[10px] font-bold tracking-[0.2em] text-gray-400 uppercase">India Intelligence</span>
      </div>
    </div>
  </div>
);

export default function App() {
  const [view, setView] = useState<'home' | 'privacy' | 'terms' | 'about' | 'contact'>('home');
  const [showCookieConsent, setShowCookieConsent] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      setShowCookieConsent(true);
    }
  }, []);

  const acceptCookies = () => {
    localStorage.setItem('cookie-consent', 'true');
    setShowCookieConsent(false);
  };

  useEffect(() => {
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      // Ignore errors when ad wrapper is missing or blocked
    }
    window.scrollTo(0, 0);
  }, [view]);

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-900 font-sans font-medium selection:bg-blue-100 selection:text-blue-900 flex flex-col">
      <header className="py-4 px-6 sm:px-12 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center justify-between w-full sticky top-0 z-50">
        <Logo onClick={() => setView('home')} />
        
        <nav className="hidden lg:flex gap-8 text-xs font-bold uppercase tracking-widest text-gray-400">
          <button onClick={() => setView('home')} className={`hover:text-blue-600 transition-colors ${view === 'home' ? 'text-blue-600' : ''}`}>Translate</button>
          <button onClick={() => setView('about')} className={`hover:text-blue-600 transition-colors ${view === 'about' ? 'text-blue-600' : ''}`}>About</button>
          <button onClick={() => setView('contact')} className={`hover:text-blue-600 transition-colors ${view === 'contact' ? 'text-blue-600' : ''}`}>Contact</button>
          <button onClick={() => setView('privacy')} className={`hover:text-blue-600 transition-colors ${view === 'privacy' ? 'text-blue-600' : ''}`}>Privacy</button>
        </nav>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-8 md:py-10 flex-grow">
        {view === 'home' ? (
          <>
            {/* Top AdSense Banner */}
            <div className="w-full max-w-6xl mx-auto min-h-[90px] mb-8 flex flex-col items-center justify-center text-gray-400 text-xs hidden md:flex overflow-hidden relative group">
               {/* 
                 AdSense Auto Ads will automatically populate this space if enabled.
                 To manually place an ad here, use:
                 <ins className="adsbygoogle"
                      style={{ display: 'block' }}
                      data-ad-client="ca-pub-7727847793178884"
                      data-ad-slot="YOUR_SLOT_ID"
                      data-ad-format="auto"
                      data-full-width-responsive="true"></ins>
               */}
               <div className="w-full h-px bg-gray-200 absolute top-0"></div>
               <span className="py-2 opacity-30 italic">Advertisement</span>
               <div className="w-full h-px bg-gray-200 absolute bottom-0"></div>
            </div>

            <div className="mb-10 text-center max-w-3xl mx-auto space-y-4">
               <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-gray-900">
                  Translate text, docs & images <span className="text-blue-600 border-b-2 border-blue-200">instantly</span>
               </h2>
               <p className="text-gray-500 text-lg md:text-xl font-normal leading-relaxed">
                 Powered by Google Gemini to provide precise, culturally-aware translations for PDFs, photos, and text across 100+ global languages.
               </p>
            </div>
            
            <Translator />

            {/* Mid-Page Ad Placement */}
            <div className="w-full max-w-6xl mx-auto my-12 flex flex-col items-center justify-center text-gray-400 text-[10px] relative">
               {/* 
                 AdSense Unit: In-feed or Display 
                 Pub: ca-pub-7727847793178884
               */}
               <div className="w-24 h-px bg-gray-100 mb-2"></div>
               <span className="opacity-40 uppercase tracking-widest">Sponsored Content</span>
               <div className="w-24 h-px bg-gray-100 mt-2"></div>
            </div>

            {/* Detailed SEO Sections */}
            <section className="mt-16 w-full max-w-6xl mx-auto space-y-12 pb-12">
               <div className="grid md:grid-cols-3 gap-8 md:gap-12">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-3">Multimodal AI Engine</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">Leverage the power of Gemini 1.5 for a seamless translation experience. Our tool doesn't just read text; it understands visual context in images and nested data in complex PDFs.</p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-3">100+ Global Languages</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">From widely spoken languages like Spanish, Chinese, and Arabic to regional dialects, we ensure your message crosses borders without losing its original meaning or significance.</p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-3">Secure & Instant</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">Your privacy matters. Files are processed in real-time and converted to downloadable Word documents instantly. No accounts required, just upload and translate.</p>
                  </div>
               </div>

               <div className="bg-blue-900 text-white p-8 md:p-12 rounded-[2.5rem] shadow-xl overflow-hidden relative">
                  <div className="relative z-10 max-w-2xl">
                     <h3 className="text-2xl md:text-3xl font-bold mb-4">Why choose LinguaSolutions India?</h3>
                     <p className="text-blue-100 mb-6">Our mission is to break language barriers across India and the globe. Whether you are translating legal contracts, technical manuals, or family photos, our AI provides the highest accuracy in the industry today.</p>
                     <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm font-medium">
                        <li className="flex items-center gap-2">✓ No character limits for basic text</li>
                        <li className="flex items-center gap-2">✓ High-resolution OCR for images</li>
                        <li className="flex items-center gap-2">✓ One-click Word export</li>
                        <li className="flex items-center gap-2">✓ Auto-detect language support</li>
                     </ul>
                  </div>
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-800 rounded-full -mr-20 -mt-20 opacity-50 blur-3xl"></div>
               </div>
            </section>
          </>
        ) : view === 'privacy' ? (
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 mb-20 relative">
            <button onClick={() => setView('home')} className="absolute top-8 right-8 p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
              <X className="w-6 h-6" />
            </button>
            <PrivacyPolicy />
          </div>
        ) : view === 'terms' ? (
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 mb-20 relative">
            <button onClick={() => setView('home')} className="absolute top-8 right-8 p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
              <X className="w-6 h-6" />
            </button>
            <TermsOfService />
          </div>
        ) : view === 'about' ? (
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 mb-20 relative">
            <button onClick={() => setView('home')} className="absolute top-8 right-8 p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
              <X className="w-6 h-6" />
            </button>
            <AboutUs />
          </div>
        ) : (
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 mb-20 relative">
            <button onClick={() => setView('home')} className="absolute top-8 right-8 p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
              <X className="w-6 h-6" />
            </button>
            <ContactUs />
          </div>
        )}
      </main>
      
      <footer className="py-12 bg-white border-t border-gray-200">
        <div className="container mx-auto px-6 text-center">
          <div className="flex flex-wrap justify-center gap-6 mb-8 text-sm font-bold uppercase tracking-widest text-gray-400">
            <button onClick={() => setView('home')} className="hover:text-blue-600 transition-colors">Home</button>
            <button onClick={() => setView('about')} className="hover:text-blue-600 transition-colors">About Us</button>
            <button onClick={() => setView('contact')} className="hover:text-blue-600 transition-colors">Contact</button>
            <button onClick={() => setView('privacy')} className="hover:text-blue-600 transition-colors">Privacy Policy</button>
            <button onClick={() => setView('terms')} className="hover:text-blue-600 transition-colors">Terms of Service</button>
          </div>
          <p className="text-gray-400 text-sm font-medium">
            &copy; {new Date().getFullYear()} LinguaSolutions India. All rights reserved.
          </p>
        </div>
      </footer>

      {showCookieConsent && (
        <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 animate-in slide-in-from-bottom-full duration-500">
          <div className="max-w-4xl mx-auto bg-gray-900 text-white p-6 rounded-[2rem] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 border border-white/10 backdrop-blur-xl">
            <div className="flex-grow">
              <h4 className="font-bold mb-1">Cookie & Ad Preferences</h4>
              <p className="text-xs text-gray-400 leading-relaxed font-medium">
                We use cookies to serve personalized advertisements via Google AdSense and to analyze our traffic. By using our website, you consent to our use of cookies and our <button onClick={() => setView('privacy')} className="text-blue-400 hover:underline">Privacy Policy</button>.
              </p>
            </div>
            <div className="flex gap-4 shrink-0">
              <button 
                onClick={acceptCookies}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-900/40 transition-all active:scale-95"
              >
                Accept All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
