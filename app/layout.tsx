import type React from "react"
import "@/app/globals.css"
import { Dancing_Script } from "next/font/google"
import { Comforter } from "next/font/google"
import { Noto_Sans, Lilita_One, Roboto_Flex } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { cn } from "@/lib/utils"

const notoSans = Noto_Sans({ 
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-sans" 
})
const dancingScript = Dancing_Script({ 
  subsets: ["latin"], 
  variable: "--font-dancing" 
})
const comforter = Comforter({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-comforter"
})
const lilitaOne = Lilita_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-lilita"
})
const robotoFlex = Roboto_Flex({
  subsets: ["latin"],
  variable: "--font-roboto-flex"
})

export const metadata = {
  title: "Event Agenda Manager",
  description: "Manage event agendas with ease",
  generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            // Script to prevent scroll jumps on button clicks
            (function() {
              // Disable browser scroll restoration
              if ('scrollRestoration' in history) {
                history.scrollRestoration = 'manual';
              }
              
              let lastScrollY = 0;
              let isScrollLocked = false;
              let scrollTimer;
              
              // Create a style element to control scroll locking
              const style = document.createElement('style');
              document.head.appendChild(style);
              
              // Store scroll position frequently
              setInterval(() => {
                if (!isScrollLocked) {
                  lastScrollY = window.scrollY;
                  sessionStorage.setItem('lastScrollY', lastScrollY.toString());
                }
              }, 100);
              
              // Restore scroll position on page load
              window.addEventListener('load', () => {
                const savedPosition = sessionStorage.getItem('lastScrollY');
                if (savedPosition) {
                  window.scrollTo(0, parseInt(savedPosition, 10));
                }
              });
              
              function lockScroll() {
                if (isScrollLocked) return;
                
                // Cancel any pending unlock
                clearTimeout(scrollTimer);
                
                // Save current scroll position in multiple ways
                lastScrollY = window.scrollY;
                sessionStorage.setItem('lastScrollY', lastScrollY.toString());
                
                // Add CSS that freezes the scroll position
                style.textContent = 
                  'html, body {' +
                  '  overflow: hidden !important;' +
                  '  position: fixed !important;' +
                  '  width: 100% !important;' +
                  '  height: 100% !important;' +
                  '  top: -' + lastScrollY + 'px !important;' +
                  '}';
                
                isScrollLocked = true;
              }
              
              function unlockScroll() {
                if (!isScrollLocked) return;
                
                // Remove the locking CSS
                style.textContent = '';
                
                // Restore scroll position
                window.scrollTo(0, lastScrollY);
                
                // Double check after a small delay
                setTimeout(() => {
                  window.scrollTo(0, lastScrollY);
                }, 50);
                
                isScrollLocked = false;
              }
              
              // Intercept all click events at capture phase (before they reach elements)
              document.addEventListener('click', function(e) {
                // Look for all relevant buttons
                if (e.target && (
                  e.target.closest('button[title="Split this item into two"]') ||
                  e.target.closest('button svg.lucide-copy-plus') ||
                  e.target.closest('.agenda-item-list .group.cursor-pointer')
                )) {
                  // Cancel any previous timer
                  clearTimeout(scrollTimer);
                  
                  // Lock scroll immediately
                  lockScroll();
                  
                  // Prevent default behavior for good measure
                  e.preventDefault();
                  
                  // Let the click event continue to bubble
                  setTimeout(() => {
                    // Unlock after operation completes
                    scrollTimer = setTimeout(() => {
                      unlockScroll();
                      // Extra check to make sure scroll position is maintained
                      setTimeout(() => window.scrollTo(0, lastScrollY), 100);
                    }, 300);
                  }, 0);
                }
              }, true);
              
              // Backup restore on any scroll attempt
              window.addEventListener('scroll', function() {
                if (isScrollLocked) {
                  requestAnimationFrame(() => window.scrollTo(0, lastScrollY));
                }
              }, { passive: false });
            })();
          `
        }} />
      </head>
      <body className={cn(
        "min-h-screen bg-background font-sans antialiased",
        notoSans.variable,
        dancingScript.variable,
        comforter.variable,
        lilitaOne.variable,
        robotoFlex.variable
      )}>
        {/* Glow effect removed
        <div className="absolute bottom-0 left-0 right-0 w-full h-[70vh] pointer-events-none overflow-hidden z-0">
          <div 
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[180%] aspect-[2.5/1] blur-[18px]"
            style={{
              background: 'radial-gradient(ellipse at center bottom, rgba(96, 165, 250, 0.5) 0%, rgba(147, 197, 253, 0.28) 20%, rgba(191, 219, 254, 0.1) 40%, rgba(191, 219, 254, 0.035) 60%, rgba(219, 234, 254, 0.007) 80%, transparent 100%)',
              maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.9) 20%, rgba(0,0,0,0.6) 40%, rgba(0,0,0,0.3) 60%, rgba(0,0,0,0.1) 80%, rgba(0,0,0,0) 95%), linear-gradient(to right, transparent, rgba(0,0,0,0.5) 5%, rgba(0,0,0,0.9) 15%, black 30%, black 70%, rgba(0,0,0,0.9) 85%, rgba(0,0,0,0.5) 95%, transparent)',
              WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.9) 20%, rgba(0,0,0,0.6) 40%, rgba(0,0,0,0.3) 60%, rgba(0,0,0,0.1) 80%, rgba(0,0,0,0) 95%), linear-gradient(to right, transparent, rgba(0,0,0,0.5) 5%, rgba(0,0,0,0.9) 15%, black 30%, black 70%, rgba(0,0,0,0.9) 85%, rgba(0,0,0,0.5) 95%, transparent)',
              WebkitMaskComposite: 'source-in',
              maskComposite: 'intersect',
            }}
          />
        </div>
        */}
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <div className="relative z-10">
          {children}
          </div>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}