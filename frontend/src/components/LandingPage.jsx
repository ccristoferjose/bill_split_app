import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Receipt,
  ArrowRight,
  Globe,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const LandingPage = () => {
  const { t, i18n } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'en' ? 'es' : 'en');
  };

  const scrollTo = (id) => {
    setMobileMenu(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const features = [
    {
      img: '/images/feature-bills.png',
      title: t('landing.featureBills'),
      desc: t('landing.featureBillsDesc'),
    },
    {
      img: '/images/feature-splits.png',
      title: t('landing.featureSplit'),
      desc: t('landing.featureSplitDesc'),
    },
    {
      img: '/images/feature-calendar.png',
      title: t('landing.featureCalendar'),
      desc: t('landing.featureCalendarDesc'),
    },
    {
      img: '/images/feature-alerts.png',
      title: t('landing.featureNotify'),
      desc: t('landing.featureNotifyDesc'),
    },
  ];

  return (
    <div className="landing-page min-h-screen flex flex-col" style={{ background: '#0f172a' }}>

      {/* ═══════════ NAVBAR ═══════════ */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
        style={{
          background: scrolled ? 'rgba(15, 23, 42, 0.95)' : 'transparent',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          boxShadow: scrolled ? '0 4px 30px rgba(0, 0, 0, 0.3)' : 'none',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => scrollTo('hero')}>
              <div className="bg-gradient-to-br from-teal-400 to-teal-600 rounded-lg p-1.5">
                <Receipt className="h-5 w-5 text-white" />
              </div>
              <span className="text-white font-bold text-lg">SpendSync</span>
            </div>

            {/* Desktop Nav Links */}
            <div className="hidden md:flex items-center gap-8">
              <button
                onClick={() => scrollTo('features')}
                className="text-gray-400 hover:text-white text-sm font-medium transition-colors duration-300"
              >
                {t('landing.navFeatures')}
              </button>
              <button
                onClick={() => scrollTo('about')}
                className="text-gray-400 hover:text-white text-sm font-medium transition-colors duration-300"
              >
                {t('landing.navAbout')}
              </button>
              <button
                onClick={toggleLanguage}
                className="text-gray-400 hover:text-white text-sm flex items-center gap-1.5 transition-colors duration-300"
              >
                <Globe className="h-4 w-4" />
                {i18n.language === 'en' ? 'ES' : 'EN'}
              </button>
              <button
                onClick={() => navigate('/login')}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all duration-300 hover:scale-[1.03] active:scale-[0.97]"
                style={{
                  background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                  boxShadow: '0 2px 10px rgba(13, 148, 136, 0.3)',
                }}
              >
                {t('landing.navLogin')}
              </button>
            </div>

            {/* Mobile Hamburger */}
            <button
              className="md:hidden text-gray-400 hover:text-white transition-colors"
              onClick={() => setMobileMenu(!mobileMenu)}
            >
              {mobileMenu ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div
          className="md:hidden overflow-hidden transition-all duration-400"
          style={{
            maxHeight: mobileMenu ? '300px' : '0',
            opacity: mobileMenu ? 1 : 0,
            background: 'rgba(15, 23, 42, 0.98)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="px-4 py-4 flex flex-col gap-3"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
          >
            <button onClick={() => scrollTo('features')} className="text-gray-300 text-sm text-left py-2 hover:text-white transition-colors">
              {t('landing.navFeatures')}
            </button>
            <button onClick={() => scrollTo('about')} className="text-gray-300 text-sm text-left py-2 hover:text-white transition-colors">
              {t('landing.navAbout')}
            </button>
            <button onClick={toggleLanguage} className="text-gray-300 text-sm text-left py-2 flex items-center gap-1.5 hover:text-white transition-colors">
              <Globe className="h-4 w-4" />
              {i18n.language === 'en' ? 'Español' : 'English'}
            </button>
            <button
              onClick={() => { setMobileMenu(false); navigate('/login'); }}
              className="mt-1 w-full px-5 py-2.5 rounded-lg text-sm font-semibold text-white text-center"
              style={{ background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)' }}
            >
              {t('landing.navLogin')}
            </button>
          </div>
        </div>
      </nav>

      {/* ═══════════ HERO ═══════════ */}
      <section id="hero" className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0" style={{ background: '#0f172a' }}>
          <div
            className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full opacity-30"
            style={{
              background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)',
              filter: 'blur(80px)',
              animation: 'float 8s ease-in-out infinite',
            }}
          />
          <div
            className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-25"
            style={{
              background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)',
              filter: 'blur(80px)',
              animation: 'float 10s ease-in-out infinite reverse',
            }}
          />
          <div
            className="absolute top-[30%] left-[40%] w-[300px] h-[300px] rounded-full opacity-15"
            style={{
              background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)',
              filter: 'blur(60px)',
              animation: 'float 12s ease-in-out infinite',
            }}
          />
          {/* Subtle grid */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <div
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(30px)',
              transition: 'opacity 0.8s ease-out, transform 0.8s ease-out',
            }}
          >
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white leading-[1.08] mb-6 tracking-tight">
              {t('landing.heroTitle')}
            </h1>

            {/* Decorative line */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-teal-500/50" />
              <div className="h-1.5 w-1.5 rounded-full bg-teal-400" />
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-teal-500/50" />
            </div>

            <p className="text-lg sm:text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              {t('landing.heroSubtitle')}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <button
                onClick={() => navigate('/login')}
                className="px-8 py-3.5 rounded-xl text-white font-semibold text-base transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] flex items-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                  boxShadow: '0 4px 20px rgba(13, 148, 136, 0.35)',
                }}
              >
                {t('landing.getStarted')}
                <ArrowRight className="h-5 w-5" />
              </button>
              <button
                onClick={() => scrollTo('features')}
                className="px-8 py-3.5 rounded-xl text-gray-300 font-medium text-base transition-all duration-300 hover:text-white hover:bg-white/5"
                style={{
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
              >
                {t('landing.learnMore')}
              </button>
            </div>

          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-gray-500 text-xs animate-bounce">
          <ChevronDown className="h-5 w-5" />
        </div>
      </section>

      {/* ═══════════ FEATURES ═══════════ */}
      <section id="features" className="relative py-24 sm:py-32" style={{ background: '#0b1120' }}>
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(13,148,136,0.3), rgba(124,58,237,0.3), transparent)',
          }}
        />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-teal-400 text-sm font-semibold uppercase tracking-[0.2em] mb-3">
              {t('landing.featuresTag')}
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
              {t('landing.featuresTitle')}
            </h2>
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-teal-500/50" />
              <div className="h-1.5 w-1.5 rounded-full bg-teal-400" />
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-teal-500/50" />
            </div>
            <p className="text-gray-400 max-w-2xl mx-auto leading-relaxed">
              {t('landing.featuresSubtitle')}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, i) => (
              <div
                key={i}
                className="group rounded-xl p-6 transition-all duration-500 hover:-translate-y-1"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(13, 148, 136, 0.3)';
                  e.currentTarget.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div className="w-16 h-16 mb-4 transition-all duration-300 group-hover:scale-110">
                  <img src={feature.img} alt={feature.title} className="w-full h-full object-contain" />
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ ABOUT / ILLUSTRATION + CTA ═══════════ */}
      <section id="about" className="relative py-24 sm:py-32" style={{ background: '#0f172a' }}>
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.3), rgba(13,148,136,0.3), transparent)',
          }}
        />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Illustration */}
            <div className="flex justify-center">
              <div className="relative">
                <div
                  className="absolute inset-0 rounded-2xl"
                  style={{
                    background: 'radial-gradient(ellipse at center, rgba(13,148,136,0.15) 0%, transparent 70%)',
                    filter: 'blur(30px)',
                    transform: 'scale(1.2)',
                  }}
                />
                <img
                  src="/images/split-illustration.png"
                  alt="Friends splitting bills"
                  className="relative w-full max-w-sm h-auto"
                />
              </div>
            </div>

            {/* CTA text */}
            <div className="text-center lg:text-left">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
                {t('landing.ctaTitle')}
              </h2>
              <p className="text-lg text-gray-400 mb-8 max-w-lg mx-auto lg:mx-0 leading-relaxed">
                {t('landing.ctaSubtitle')}
              </p>
              <button
                onClick={() => navigate('/register')}
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-white font-semibold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, #0d9488 0%, #7c3aed 100%)',
                  boxShadow: '0 4px 20px rgba(13, 148, 136, 0.3)',
                }}
              >
                {t('landing.createAccount')}
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="relative py-8" style={{ background: '#080d19' }}>
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(13,148,136,0.4), rgba(124,58,237,0.4), transparent)',
          }}
        />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-gradient-to-br from-teal-400 to-teal-600 rounded-lg p-1.5">
              <Receipt className="h-4 w-4 text-white" />
            </div>
            <span className="text-white font-semibold text-sm">SpendSync</span>
          </div>
          <p className="text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} SpendSync. {t('landing.allRights')}
          </p>
        </div>
      </footer>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(20px, -20px); }
          66% { transform: translate(-10px, 15px); }
        }
        .landing-page *,
        .landing-page *::before,
        .landing-page *::after {
          border-color: transparent;
        }
      `}</style>
    </div>
  );
};

export default LandingPage;
