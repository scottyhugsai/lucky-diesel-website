'use client';

import { useState, useEffect } from 'react';

interface Service {
  id: string;
  icon: string;
  title: string;
  description: string;
  gridSpan: string;
}

interface Testimonial {
  name: string;
  company: string;
  quote: string;
}

const services: Service[] = [
  {
    id: '1',
    icon: '⚙️',
    title: 'Engine Rebuild',
    description: 'Complete diesel engine restoration with precision machining and OEM parts.',
    gridSpan: 'md:col-span-2 md:row-span-2',
  },
  {
    id: '2',
    icon: '🔧',
    title: 'Diagnostics',
    description: 'Advanced computer diagnostics for any diesel engine issue.',
    gridSpan: 'md:col-span-1',
  },
  {
    id: '3',
    icon: '🛠️',
    title: 'Transmission',
    description: 'Transmission repair and overhaul services.',
    gridSpan: 'md:col-span-1',
  },
  {
    id: '4',
    icon: '⛽',
    title: 'Fuel Systems',
    description: 'Fuel injection and system expertise.',
    gridSpan: 'md:col-span-1',
  },
  {
    id: '5',
    icon: '🏎️',
    title: 'Performance Tuning',
    description: 'Custom tuning and upgrades for maximum power.',
    gridSpan: 'md:col-span-2',
  },
  {
    id: '6',
    icon: '🧹',
    title: 'Maintenance',
    description: 'Preventative maintenance keeps your rig running strong.',
    gridSpan: 'md:col-span-1',
  },
];

const testimonials: Testimonial[] = [
  {
    name: 'John Martinez',
    company: 'Construction Fleet',
    quote: 'Lucky Diesel saved my fleet. Best service in the region.',
  },
  {
    name: 'Sarah Chen',
    company: 'Trucking Co.',
    quote: 'Professional, fast, and honest. Exactly what you need.',
  },
  {
    name: 'Mike Johnson',
    company: 'Independent Operator',
    quote: 'They stand behind their work. No shortcuts.',
  },
];

export default function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 text-white">
      {/* Fixed Floating Nav */}
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50">
        <div
          className="mx-auto flex items-center justify-between px-6 py-3 rounded-full"
          style={{
            background: 'rgba(10, 10, 10, 0.8)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <span className="text-lg font-bold tracking-tight">LUCKY DIESEL</span>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="ml-8 w-6 h-6 flex flex-col justify-center items-center gap-1.5"
          >
            <div
              className={`w-5 h-0.5 bg-white transition-all duration-300 ${
                isMenuOpen ? 'rotate-45 translate-y-2' : ''
              }`}
            ></div>
            <div
              className={`w-5 h-0.5 bg-white transition-all duration-300 ${
                isMenuOpen ? 'opacity-0' : ''
              }`}
            ></div>
            <div
              className={`w-5 h-0.5 bg-white transition-all duration-300 ${
                isMenuOpen ? '-rotate-45 -translate-y-2' : ''
              }`}
            ></div>
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 z-40 backdrop-blur-xl bg-black/80 flex flex-col items-center justify-center gap-8 pt-20"
          onClick={() => setIsMenuOpen(false)}
        >
          <a href="#services" className="text-3xl font-bold hover:text-orange-500 transition-colors duration-300">
            Services
          </a>
          <a href="#testimonials" className="text-3xl font-bold hover:text-orange-500 transition-colors duration-300">
            Testimonials
          </a>
          <a href="#contact" className="text-3xl font-bold hover:text-orange-500 transition-colors duration-300">
            Contact
          </a>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-20 px-4 overflow-hidden">
        {/* Animated Background Orbs */}
        <div
          className="absolute top-20 -left-40 w-80 h-80 bg-orange-500/20 rounded-full blur-3xl"
          style={{
            transform: `translateY(${scrollY * 0.2}px)`,
            transition: 'transform 0.3s ease-out',
          }}
        ></div>
        <div
          className="absolute -bottom-40 right-0 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl"
          style={{
            transform: `translateY(${scrollY * -0.15}px)`,
          }}
        ></div>

        <div className="relative z-10 text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-block mb-8 px-4 py-2 rounded-full bg-white/5 border border-white/10">
            <span className="text-xs uppercase tracking-widest text-orange-400 font-semibold">
              Diesel Experts Since 1995
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Your Diesel Engine <span className="text-orange-500">Deserves Better</span>
          </h1>

          {/* Subheading */}
          <p className="text-lg md:text-xl text-neutral-300 mb-12 max-w-2xl mx-auto leading-relaxed">
            Professional diesel engine repair, rebuild, and performance tuning. We treat your truck like our own.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col md:flex-row gap-4 md:gap-6 justify-center">
            <button
              onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
              className="group px-8 py-4 rounded-full bg-orange-600 hover:bg-orange-700 font-bold text-lg transition-all duration-300 transform hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
            >
              Get a Quote
              <span className="w-8 h-8 rounded-full bg-orange-700/50 group-hover:bg-orange-800 flex items-center justify-center transition-all duration-300">
                →
              </span>
            </button>
            <button
              onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-8 py-4 rounded-full border border-white/20 hover:border-white/40 font-bold text-lg transition-all duration-300"
            >
              See Services
            </button>
          </div>
        </div>
      </section>

      {/* Services Grid - Asymmetrical Bento */}
      <section id="services" className="py-32 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-20 text-center">
            <span className="text-xs uppercase tracking-widest text-orange-400 font-semibold">What We Do</span>
            <h2 className="text-5xl md:text-6xl font-bold mt-4">Complete Diesel Solutions</h2>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {services.map((service, index) => (
              <div
                key={service.id}
                className={`${service.gridSpan} group`}
                style={{
                  animation: `fadeInUp 0.6s ease-out ${index * 0.1}s both`,
                }}
              >
                {/* Double-Bezel Card */}
                <div className="p-1.5 rounded-[2rem] bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10">
                  <div
                    className="p-8 md:p-12 rounded-[calc(2rem-0.375rem)] bg-neutral-900 border border-white/5 h-full flex flex-col justify-between transition-all duration-500 group-hover:border-orange-500/30 group-hover:bg-neutral-800/80"
                    style={{
                      boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.05)',
                    }}
                  >
                    <div>
                      <div className="text-4xl mb-4">{service.icon}</div>
                      <h3 className="text-2xl font-bold mb-3 text-white">{service.title}</h3>
                      <p className="text-neutral-400 leading-relaxed">{service.description}</p>
                    </div>
                    <div className="mt-6 w-8 h-8 rounded-full bg-orange-500/10 group-hover:bg-orange-500/20 flex items-center justify-center transition-colors duration-300">
                      <span className="text-orange-400">→</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-32 px-4 bg-neutral-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="mb-20 text-center">
            <span className="text-xs uppercase tracking-widest text-orange-400 font-semibold">Social Proof</span>
            <h2 className="text-5xl md:text-6xl font-bold mt-4">Trusted by Professionals</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="p-1.5 rounded-2xl bg-white/5 border border-white/10 hover:border-orange-500/30 transition-all duration-300"
              >
                <div className="p-8 rounded-[calc(1rem-0.375rem)] bg-neutral-900 h-full flex flex-col justify-between">
                  <p className="text-lg text-neutral-200 leading-relaxed mb-6">"{testimonial.quote}"</p>
                  <div>
                    <p className="font-bold text-white">{testimonial.name}</p>
                    <p className="text-sm text-orange-400">{testimonial.company}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section id="contact" className="py-32 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <span className="text-xs uppercase tracking-widest text-orange-400 font-semibold">Get Started</span>
          <h2 className="text-5xl md:text-6xl font-bold mt-4 mb-8">Ready to Get Your Diesel Running Strong?</h2>
          <p className="text-xl text-neutral-300 mb-12">Call us today for a free consultation and quote.</p>

          <div className="flex flex-col md:flex-row gap-4 justify-center items-center">
            <a
              href="tel:+15551234567"
              className="group px-8 py-4 rounded-full bg-orange-600 hover:bg-orange-700 font-bold text-lg transition-all duration-300 transform hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
            >
              Call Now
              <span className="w-8 h-8 rounded-full bg-orange-700/50 group-hover:bg-orange-800 flex items-center justify-center transition-all duration-300">
                📞
              </span>
            </a>
            <div className="text-neutral-300 font-medium">
              (555) 123-4567 | contact@luckydiesel.com
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 px-4 bg-neutral-950/50">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8 text-neutral-400">
          <div className="text-center md:text-left">
            <p className="font-bold text-white mb-2">LUCKY DIESEL</p>
            <p className="text-sm">Professional diesel engine solutions since 1995</p>
          </div>
          <div className="text-center">
            <p className="text-sm">© 2024 Lucky Diesel. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px) blur(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0) blur(0);
          }
        }
      `}</style>
    </div>
  );
}
