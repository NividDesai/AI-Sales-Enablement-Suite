import React, { useEffect } from 'react'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { Link } from 'react-router-dom'
import { HorizonHeroSection } from '../components/ui/horizon-hero-section'
import ErrorBoundary from '../components/avatar/ErrorBoundary'
import { FloatingIconsHero, type FloatingIconsHeroProps } from '../components/ui/floating-icons-hero-section'
import { motion } from 'framer-motion'
import { Button } from '../components/ui/button'
import { 
  Mail, FileText, Video,
  Search, Shield, CheckCircle2,
  Users, Briefcase
} from 'lucide-react'

// Icon components for floating icons
const IconGoogle = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M21.9999 12.24C21.9999 11.4933 21.9333 10.76 21.8066 10.0533H12.3333V14.16H17.9533C17.7333 15.3467 17.0133 16.3733 15.9666 17.08V19.68H19.5266C21.1933 18.16 21.9999 15.4533 21.9999 12.24Z" fill="#4285F4"/>
    <path d="M12.3333 22C15.2333 22 17.6866 21.0533 19.5266 19.68L15.9666 17.08C15.0199 17.7333 13.7933 18.16 12.3333 18.16C9.52659 18.16 7.14659 16.28 6.27992 13.84H2.59326V16.5133C4.38659 20.0267 8.05992 22 12.3333 22Z" fill="#34A853"/>
    <path d="M6.2799 13.84C6.07324 13.2267 5.9599 12.58 5.9599 11.92C5.9599 11.26 6.07324 10.6133 6.2799 10L2.59326 7.32667C1.86659 8.78667 1.45326 10.32 1.45326 11.92C1.45326 13.52 1.86659 15.0533 2.59326 16.5133L6.2799 13.84Z" fill="#FBBC05"/>
    <path d="M12.3333 5.68C13.8933 5.68 15.3133 6.22667 16.3866 7.24L19.6 4.02667C17.68 2.29333 15.2266 1.33333 12.3333 1.33333C8.05992 1.33333 4.38659 3.97333 2.59326 7.32667L6.27992 10C7.14659 7.56 9.52659 5.68 12.3333 5.68Z" fill="#EA4335"/>
  </svg>
);

const IconApple = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="currentColor" className="text-foreground/80" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.482 15.334C16.274 16.146 15.238 17.554 15.238 19.138C15.238 21.694 17.062 22.846 19.33 22.99C21.682 23.122 23.53 21.73 23.53 19.138C23.53 16.57 21.742 15.334 19.438 15.334C18.23 15.334 17.482 15.334 17.482 15.334ZM19.438 1.018C17.074 1.018 15.238 2.41 15.238 4.982C15.238 7.554 17.062 8.702 19.33 8.842C21.682 8.974 23.53 7.582 23.53 4.982C23.518 2.41 21.742 1.018 19.438 1.018Z" />
  </svg>
);

const IconMicrosoft = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M11.4 2H2v9.4h9.4V2Z" fill="#F25022"/>
    <path d="M22 2h-9.4v9.4H22V2Z" fill="#7FBA00"/>
    <path d="M11.4 12.6H2V22h9.4V12.6Z" fill="#00A4EF"/>
    <path d="M22 12.6h-9.4V22H22V12.6Z" fill="#FFB900"/>
  </svg>
);

const IconFigma = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10A10 10 0 0 1 2 12 10 10 0 0 1 12 2z" fill="#2C2C2C"/>
    <path d="M12 7a5 5 0 0 1 5 5 5 5 0 0 1-5 5V7z" fill="#0ACF83"/>
    <path d="M12 12a5 5 0 0 1-5-5 5 5 0 0 1 5-5v10z" fill="#A259FF"/>
    <path d="M12 17a5 5 0 0 1-5-5h10a5 5 0 0 1-5 5z" fill="#F24E1E"/>
    <path d="M7 12a5 5 0 0 1 5 5v-5H7z" fill="#FF7262"/>
  </svg>
);

const IconGitHub = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="currentColor" className="text-foreground/80" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
  </svg>
);

const IconVercel = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="currentColor" className="text-foreground/90" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L2 22h20L12 2z"/>
  </svg>
);

const IconStripe = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12Z" fill="#635BFF"/>
    <path d="M6 7H18V9H6V7Z" fill="white"/>
    <path d="M6 11H18V13H6V11Z" fill="white"/>
    <path d="M6 15H14V17H6V15Z" fill="white"/>
  </svg>
);

const IconDiscord = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20.317 4.482a1.88 1.88 0 0 0-1.635-.482C17.398 3.42 16.02 3 12 3s-5.398.42-6.682 1.001a1.88 1.88 0 0 0-1.635.483c-1.875 1.2-2.325 3.61-1.568 5.711 1.62 4.47 5.063 7.8 9.885 7.8s8.265-3.33 9.885-7.8c.757-2.1-.307-4.51-1.568-5.711ZM8.45 13.4c-.825 0-1.5-.75-1.5-1.65s.675-1.65 1.5-1.65c.825 0 1.5.75 1.5 1.65s-.675 1.65-1.5 1.65Zm7.1 0c-.825 0-1.5-.75-1.5-1.65s.675-1.65 1.5-1.65c.825 0 1.5.75 1.5 1.65s-.675 1.65-1.5 1.65Z" fill="#5865F2"/>
  </svg>
);

const IconX = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="currentColor" className="text-foreground/90" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231L18.244 2.25zM17.03 19.75h1.866L7.156 4.25H5.16l11.874 15.5z"/>
  </svg>
);

const IconSpotify = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm4.125 14.175c-.188.3-.563.413-.863.225-2.437-1.5-5.5-1.725-9.15-1.012-.338.088-.675-.15-.763-.488-.088-.337.15-.675.488-.762 3.937-.787 7.287-.525 9.975 1.125.3.187.412.562.225.862zm.9-2.7c-.225.363-.675.488-1.037.263-2.7-1.65-6.825-2.1-9.975-1.162-.413.113-.825-.15-1-.562-.15-.413.15-.825.563-1 .362-.112 3.487-.975 6.6 1.312.362.225.487.675.262 1.038v.112zm.113-2.887c-3.225-1.875-8.55-2.025-11.512-1.125-.487.15-.975-.15-1.125-.637-.15-.488.15-.975.638-1.125 3.337-.975 9.15-.787 12.825 1.312.45.263.6.825.337 1.275-.263.45-.825.6-1.275.337v-.038z" fill="#1DB954"/>
  </svg>
);

// Define icons for floating hero
const floatingIcons: FloatingIconsHeroProps['icons'] = [
  { id: 1, icon: IconGoogle, className: 'top-[10%] left-[10%]' },
  { id: 2, icon: IconApple, className: 'top-[20%] right-[8%]' },
  { id: 3, icon: IconMicrosoft, className: 'top-[80%] left-[10%]' },
  { id: 4, icon: IconFigma, className: 'bottom-[10%] right-[10%]' },
  { id: 5, icon: IconGitHub, className: 'top-[5%] left-[30%]' },
  { id: 6, icon: IconVercel, className: 'bottom-[8%] left-[25%]' },
  { id: 7, icon: IconStripe, className: 'top-[40%] left-[15%]' },
  { id: 8, icon: IconDiscord, className: 'top-[75%] right-[25%]' },
  { id: 9, icon: IconX, className: 'top-[90%] left-[70%]' },
  { id: 10, icon: IconSpotify, className: 'top-[55%] left-[5%]' },
  { id: 11, icon: IconSpotify, className: 'top-[5%] left-[55%]' },
  { id: 12, icon: IconVercel, className: 'bottom-[5%] right-[45%]' },
];

export default function Landing() {
  const [, setLenisInstance] = React.useState<Lenis | null>(null)

  // Enhanced Lenis smooth scroll
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.0,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.8,
      touchMultiplier: 1.5,
    })

    let rafId: number | null = null
    function raf(time: number) {
      lenis.raf(time)
      rafId = requestAnimationFrame(raf)
    }
    rafId = requestAnimationFrame(raf)

    setLenisInstance(lenis)

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
      lenis.destroy()
    }
  }, [])

  return (
    <div className="relative text-white overflow-hidden">
      {/* Top Right Sign In/Sign Up Buttons */}
      <div className="fixed top-6 right-6 z-50 flex gap-3">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="bg-white/10 backdrop-blur-md border-white/20 text-white hover:bg-white/20 hover:text-white"
        >
          <Link to="/login">
            Sign In
          </Link>
        </Button>
        <Button
          asChild
          size="sm"
          className="bg-white text-black hover:bg-white/90"
        >
          <Link to="/login">
            Sign Up
          </Link>
        </Button>
      </div>
      
      <div className="relative z-10">
      {/* Section 1: Hero - Introduction */}
      <section className="relative min-h-screen flex items-center justify-center">
        <ErrorBoundary>
          <HorizonHeroSection 
            title="LEADFORGE"
            subtitle={{
              line1: "Where AI meets lead generation,",
              line2: "we transform prospects into customers"
            }}
          />
        </ErrorBoundary>
        {/* Scroll Indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 animate-bounce">
          <div className="w-6 h-10 border-2 border-white/30 rounded-full flex items-start justify-center p-2">
            <div className="w-1.5 h-1.5 bg-white/60 rounded-full animate-pulse"></div>
          </div>
        </div>
      </section>

      {/* Transition Element - Connecting sections */}
      <div className="h-24 bg-gradient-to-b from-pink-500/10 via-blue-500/10 to-cyan-500/10"></div>

      {/* Section 3: Detailed Features - Alternating Split Layout */}
      <section id="features" className="relative py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <div className="inline-block mb-6 px-4 py-2 rounded-full bg-blue-500/30 border border-blue-500/40 backdrop-blur-sm">
              <span className="text-sm text-blue-200 font-medium opacity-100">Complete Solution</span>
            </div>
            <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] opacity-100">
              Complete Sales Toolkit
            </h2>
            <p className="text-xl md:text-2xl text-white max-w-3xl mx-auto drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] opacity-100">
              Everything you need to find, connect with, and convert your ideal customers
            </p>
          </motion.div>
          
          {/* Alternating Split Layout */}
          <div className="space-y-24 mb-20">
            {/* Feature 1: Smart Lead Discovery */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8 }}
              className="grid lg:grid-cols-2 gap-12 items-center"
            >
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-3xl blur-2xl"></div>
                <div className="relative bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-3xl p-8 lg:p-12 border border-white/20 backdrop-blur-xl">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-4 rounded-2xl bg-blue-500/30 border border-blue-400/40">
                      <Search className="w-10 h-10 text-blue-300" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-blue-300 mb-1">01</div>
                      <h3 className="text-3xl lg:text-4xl font-bold text-white">Smart Lead Discovery</h3>
                    </div>
                  </div>
                  <p className="text-white/90 mb-8 text-lg leading-relaxed drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                    Use AI to discover high-quality leads based on industry, job title, company size, location, technologies used, and more. Our intelligent search engine scours millions of companies and contacts to find your ideal customers.
                  </p>
                  <ul className="space-y-4 text-white/90 text-base drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Search by industry, role, location, company size, and technologies</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>AI-powered domain suggestions based on your criteria</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Filter by startup status, sectors, and founding year</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Discover and enrich leads from URLs in bulk</span>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="relative h-[500px] lg:h-[600px] rounded-3xl overflow-hidden border border-white/20">
                <img 
                  src="https://images.unsplash.com/photo-1551434678-e076c223a692?w=1200&h=800&fit=crop&auto=format&q=80" 
                  alt="Lead discovery dashboard"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
                <div className="absolute bottom-0 left-0 right-0 p-8 space-y-4">
                  <div className="p-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/20">
                    <div className="text-sm text-white/80 mb-2">Industry</div>
                    <div className="text-white text-lg font-medium">Technology, SaaS, Healthcare</div>
                  </div>
                  <div className="p-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/20">
                    <div className="text-sm text-white/80 mb-2">Role/Title</div>
                    <div className="text-white text-lg font-medium">CTO, VP Engineering, Director</div>
                  </div>
                  <div className="p-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/20">
                    <div className="text-sm text-white/80 mb-2">Location</div>
                    <div className="text-white text-lg font-medium">San Francisco, New York, Remote</div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Feature 2: Lead Enrichment - Reversed */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8 }}
              className="grid lg:grid-cols-2 gap-12 items-center"
            >
              <div className="relative order-2 lg:order-1 h-[500px] lg:h-[600px] rounded-3xl overflow-hidden border border-white/20">
                <img 
                  src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=800&fit=crop&auto=format&q=80" 
                  alt="Data enrichment dashboard"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
                <div className="absolute bottom-0 left-0 right-0 p-8 space-y-4">
                  <div className="p-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/20">
                    <div className="text-sm text-white/80 mb-2">Email</div>
                    <div className="text-white text-lg font-medium flex items-center gap-2">
                      <span>john.doe@company.com</span>
                      <Shield className="w-5 h-5 text-green-400" />
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/20">
                    <div className="text-sm text-white/80 mb-2">Company Data</div>
                    <div className="text-white text-lg font-medium">Industry, Size, Founded, Website</div>
                  </div>
                  <div className="p-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/20">
                    <div className="text-sm text-white/80 mb-2">LinkedIn</div>
                    <div className="text-white text-lg font-medium">linkedin.com/in/johndoe</div>
                  </div>
                </div>
              </div>
              <div className="relative order-1 lg:order-2">
                <div className="absolute -inset-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-3xl blur-2xl"></div>
                <div className="relative bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-3xl p-8 lg:p-12 border border-white/20 backdrop-blur-xl">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-4 rounded-2xl bg-purple-500/30 border border-purple-400/40">
                      <Users className="w-10 h-10 text-purple-300" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-purple-300 mb-1">02</div>
                      <h3 className="text-3xl lg:text-4xl font-bold text-white">Lead Enrichment</h3>
                    </div>
                  </div>
                  <p className="text-white/90 mb-8 text-lg leading-relaxed drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                    Automatically enrich your leads with verified contact information, company data, and professional details. Cross-reference multiple data sources to ensure accuracy and completeness.
                  </p>
                  <ul className="space-y-4 text-white/90 text-base drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Verified email addresses with Hunter.io integration</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Company information: industry, size, revenue, location</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>LinkedIn profiles and social media links</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>AI-powered data structuring and validation</span>
                    </li>
                  </ul>
                </div>
            </div>
          </motion.div>

            {/* Feature 3: AI Email Outreach */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
              className="grid lg:grid-cols-2 gap-12 items-center"
            >
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-green-500/20 to-teal-500/20 rounded-3xl blur-2xl"></div>
                <div className="relative bg-gradient-to-br from-green-500/20 to-teal-500/20 rounded-3xl p-8 lg:p-12 border border-white/20 backdrop-blur-xl">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-4 rounded-2xl bg-green-500/30 border border-green-400/40">
                      <Mail className="w-10 h-10 text-green-300" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-green-300 mb-1">03</div>
                      <h3 className="text-3xl lg:text-4xl font-bold text-white">AI Email Outreach</h3>
                    </div>
                  </div>
                  <p className="text-white/90 mb-8 text-lg leading-relaxed drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                    Generate personalized cold emails for each lead using AI. Our system analyzes the lead's profile, company, and recent activity to create compelling, context-aware messages that convert.
                  </p>
                  <ul className="space-y-4 text-white/90 text-base drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Personalized emails tailored to each lead's profile</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Customizable tone: professional, casual, or friendly</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Value proposition and key benefits integration</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Bulk email generation for multiple leads</span>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="relative h-[500px] lg:h-[600px] rounded-3xl overflow-hidden border border-white/20">
                <img 
                  src="https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=800&fit=crop&auto=format&q=80" 
                  alt="Email outreach interface"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
                <div className="absolute bottom-0 left-0 right-0 p-8 space-y-4">
                  <div className="p-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/20">
                    <div className="text-sm text-white/80 mb-2">Email Preview</div>
                    <div className="text-white text-base leading-relaxed italic">
                      "Hi John, I noticed [Company] recently expanded into [Industry]. Our solution has helped similar companies achieve [Benefit]..."
                    </div>
                    <div className="flex gap-2 mt-3">
                      <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-300 text-sm">Professional</span>
                      <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-sm">Personalized</span>
                    </div>
                  </div>
          </div>
        </div>
            </motion.div>

            {/* Feature 4: AI CV Generator - Reversed */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
              className="grid lg:grid-cols-2 gap-12 items-center"
            >
              <div className="relative order-2 lg:order-1 h-[500px] lg:h-[600px] rounded-3xl overflow-hidden border border-white/20 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 p-8 flex flex-col justify-center">
                <div className="space-y-4">
                  <div className="p-5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20">
                    <div className="text-base font-semibold text-white mb-2">Upload CV</div>
                    <div className="text-white text-lg">PDF, DOCX, or HTML</div>
                  </div>
                  <div className="p-5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20">
                    <div className="text-base font-semibold text-white mb-2">Job Details</div>
                    <div className="text-white text-lg">Company, Position, Requirements</div>
                  </div>
                  <div className="p-5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20">
                    <div className="text-base font-semibold text-white mb-2">Output</div>
                    <div className="text-white text-lg">Tailored CV in PDF/HTML/DOCX</div>
                  </div>
                </div>
              </div>
              <div className="relative order-1 lg:order-2">
                <div className="absolute -inset-4 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-3xl blur-2xl"></div>
                <div className="relative bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-3xl p-8 lg:p-12 border border-white/20 backdrop-blur-xl">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-4 rounded-2xl bg-yellow-500/30 border border-yellow-400/40">
                      <FileText className="w-10 h-10 text-yellow-300" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-yellow-300 mb-1">04</div>
                      <h3 className="text-3xl lg:text-4xl font-bold text-white">AI CV Generator</h3>
                    </div>
                  </div>
                  <p className="text-white/90 mb-8 text-lg leading-relaxed drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                    Create professional, tailored CVs that match job postings perfectly. Upload your existing CV, provide job details, and let AI customize it to highlight relevant skills and experience.
                  </p>
                  <ul className="space-y-4 text-white/90 text-base drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Parse existing CVs from PDF, DOCX, or HTML formats</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Tailor CV content to match job requirements</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Multiple professional templates and designs</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Export in PDF, HTML, or DOCX formats</span>
                    </li>
                  </ul>
          </div>
        </div>
            </motion.div>

            {/* Feature 5: B2B Document Generator */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8 }}
              className="grid lg:grid-cols-2 gap-12 items-center relative z-20"
            >
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-pink-500/20 to-rose-500/20 rounded-3xl blur-2xl"></div>
                <div className="relative bg-gradient-to-br from-pink-500/50 to-rose-500/50 rounded-3xl p-8 lg:p-12 border border-white/40 backdrop-blur-xl shadow-2xl">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-4 rounded-2xl bg-pink-500/50 border border-pink-400/60">
                      <Briefcase className="w-10 h-10 text-pink-200" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-pink-200 mb-1">05</div>
                      <h3 className="text-3xl lg:text-4xl font-bold text-white drop-shadow-[0_4px_12px_rgba(0,0,0,1)]">B2B Document Generator</h3>
                    </div>
                  </div>
                  <p className="text-white mb-8 text-lg leading-relaxed drop-shadow-[0_4px_10px_rgba(0,0,0,1)] font-semibold">
                    Generate professional B2B documents including proposals, pitch decks, and outreach materials. Create highly personalized content that resonates with your target companies.
                  </p>
                  <ul className="space-y-4 text-white text-base drop-shadow-[0_4px_10px_rgba(0,0,0,1)] font-medium">
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Personalized proposals tailored to each lead company</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Multiple formats: PDF, HTML, PowerPoint (PPTX)</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Auto-fetch company logos and branding</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Value propositions, benefits, and proof points</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Multi-language support (EN, FR, ES, DE, HI)</span>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="relative h-[500px] lg:h-[600px] rounded-3xl overflow-hidden border border-white/40 bg-gradient-to-br from-pink-500/30 to-rose-500/30 p-8 flex flex-col justify-center shadow-2xl">
              <div className="space-y-4">
                  <div className="p-5 rounded-xl bg-white/30 backdrop-blur-md border border-white/40 shadow-lg">
                    <div className="text-base font-semibold text-white mb-3 drop-shadow-[0_4px_8px_rgba(0,0,0,1)]">Document Types</div>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-4 py-2 rounded-lg bg-pink-500/40 text-pink-50 text-sm font-semibold drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">Proposals</span>
                      <span className="px-4 py-2 rounded-lg bg-pink-500/40 text-pink-50 text-sm font-semibold drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">Pitch Decks</span>
                      <span className="px-4 py-2 rounded-lg bg-pink-500/40 text-pink-50 text-sm font-semibold drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">Outreach Docs</span>
                    </div>
                  </div>
                  <div className="p-5 rounded-xl bg-white/30 backdrop-blur-md border border-white/40 shadow-lg">
                    <div className="text-base font-semibold text-white mb-3 drop-shadow-[0_4px_8px_rgba(0,0,0,1)]">Formats</div>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-4 py-2 rounded-lg bg-blue-500/40 text-blue-50 text-sm font-semibold drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">PDF</span>
                      <span className="px-4 py-2 rounded-lg bg-blue-500/40 text-blue-50 text-sm font-semibold drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">HTML</span>
                      <span className="px-4 py-2 rounded-lg bg-blue-500/40 text-blue-50 text-sm font-semibold drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">PPTX</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Feature 6: AI Avatar Practice - Reversed */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8 }}
              className="grid lg:grid-cols-2 gap-12 items-center relative z-20"
            >
              <div className="relative order-2 lg:order-1 h-[500px] lg:h-[600px] rounded-3xl overflow-hidden border border-white/40 bg-gradient-to-br from-cyan-500/30 to-blue-500/30 p-8 flex flex-col justify-center shadow-2xl">
                <div className="space-y-4">
                  <div className="p-5 rounded-xl bg-white/30 backdrop-blur-md border border-white/40 shadow-lg">
                    <div className="text-base font-semibold text-white mb-2 drop-shadow-[0_4px_8px_rgba(0,0,0,1)]">3D Avatar</div>
                    <div className="text-white text-lg drop-shadow-[0_4px_8px_rgba(0,0,0,1)] font-medium">Interactive 3D representation</div>
                  </div>
                  <div className="p-5 rounded-xl bg-white/30 backdrop-blur-md border border-white/40 shadow-lg">
                    <div className="text-base font-semibold text-white mb-2 drop-shadow-[0_4px_8px_rgba(0,0,0,1)]">Voice Chat</div>
                    <div className="text-white text-lg drop-shadow-[0_4px_8px_rgba(0,0,0,1)] font-medium">Real-time conversation with AI</div>
                  </div>
                  <div className="p-5 rounded-xl bg-white/30 backdrop-blur-md border border-white/40 shadow-lg">
                    <div className="text-base font-semibold text-white mb-2 drop-shadow-[0_4px_8px_rgba(0,0,0,1)]">Practice Scenarios</div>
                    <div className="text-white text-lg drop-shadow-[0_4px_8px_rgba(0,0,0,1)] font-medium">Interviews, meetings, presentations</div>
                  </div>
                </div>
              </div>
              <div className="relative order-1 lg:order-2">
                <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-3xl blur-2xl"></div>
                <div className="relative bg-gradient-to-br from-cyan-500/50 to-blue-500/50 rounded-3xl p-8 lg:p-12 border border-white/40 backdrop-blur-xl shadow-2xl">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-4 rounded-2xl bg-cyan-500/50 border border-cyan-400/60">
                      <Video className="w-10 h-10 text-cyan-200" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-cyan-200 mb-1">06</div>
                      <h3 className="text-3xl lg:text-4xl font-bold text-white drop-shadow-[0_4px_12px_rgba(0,0,0,1)]">AI Avatar Practice</h3>
                    </div>
                  </div>
                  <p className="text-white mb-8 text-lg leading-relaxed drop-shadow-[0_4px_10px_rgba(0,0,0,1)] font-semibold">
                    Practice interviews, meetings, and presentations with AI-powered 3D avatars. Have realistic conversations to improve your communication skills and prepare for important interactions.
                  </p>
                  <ul className="space-y-4 text-white text-base drop-shadow-[0_4px_10px_rgba(0,0,0,1)] font-medium">
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Interactive 3D avatars with realistic animations</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Real-time voice conversation with speech recognition</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Multiple persona options for different scenarios</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Lip-sync and emotion-based avatar responses</span>
                    </li>
                  </ul>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Transition Element - Smooth flow to final CTA */}
      <div className="h-32 bg-gradient-to-b from-cyan-500/10 via-purple-500/10 to-pink-500/10"></div>

      {/* Section 4: Final CTA - AI-Powered Lead Generation */}
      <section className="relative min-h-screen bg-black">
        <FloatingIconsHero
          title="AI-Powered Lead Generation"
          subtitle="Discover, enrich, and connect with high-quality leads using advanced AI. Automate your entire sales pipeline from discovery to outreach."
          ctaText="Start Finding Leads"
          ctaHref="/login"
          icons={floatingIcons}
          className="bg-gradient-to-br from-black/50 via-purple-900/20 to-black/50"
        />
      </section>
      </div>

    </div>
  )
}
