import { useState, useEffect, useCallback, useRef } from 'react';

// Track tokens that recently gained a price (graduated from pending to active)
// We store the token address and the time it graduated
interface GraduatedToken {
  address: string;
  graduatedAt: number;
}

const GRADUATION_DISPLAY_DURATION = 60000; // Show "New Price" badge for 60 seconds

export function useGraduatedTokens() {
  const [graduatedTokens, setGraduatedTokens] = useState<Map<string, number>>(new Map());
  const previousPricesRef = useRef<Map<string, number>>(new Map());

  // Check if a token has recently graduated
  const isGraduated = useCallback((address: string): boolean => {
    const graduatedAt = graduatedTokens.get(address.toLowerCase());
    if (!graduatedAt) return false;
    
    // Still within display duration
    return Date.now() - graduatedAt < GRADUATION_DISPLAY_DURATION;
  }, [graduatedTokens]);

  // Mark a token as graduated
  const markGraduated = useCallback((address: string) => {
    setGraduatedTokens(prev => {
      const next = new Map(prev);
      next.set(address.toLowerCase(), Date.now());
      return next;
    });
  }, []);

  // Track price changes to detect graduations
  const trackPriceChange = useCallback((address: string, previousPrice: number, newPrice: number) => {
    const normalizedAddress = address.toLowerCase();
    
    // If price went from 0 to > 0, this is a graduation!
    if (previousPrice === 0 && newPrice > 0) {
      console.log(`🎓 Token graduated: ${address} now has price $${newPrice}`);
      markGraduated(normalizedAddress);
    }
    
    // Update previous price reference
    previousPricesRef.current.set(normalizedAddress, newPrice);
  }, [markGraduated]);

  // Cleanup expired graduations periodically
  useEffect(() => {
    const cleanup = setInterval(() => {
      setGraduatedTokens(prev => {
        const now = Date.now();
        const next = new Map<string, number>();
        
        prev.forEach((graduatedAt, address) => {
          if (now - graduatedAt < GRADUATION_DISPLAY_DURATION) {
            next.set(address, graduatedAt);
          }
        });
        
        return next;
      });
    }, 10000); // Clean up every 10 seconds

    return () => clearInterval(cleanup);
  }, []);

  return {
    isGraduated,
    markGraduated,
    trackPriceChange,
    graduatedCount: graduatedTokens.size,
  };
}
