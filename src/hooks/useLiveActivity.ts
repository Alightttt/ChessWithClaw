import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function useLiveActivity() {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        if (observerRef.current && elementRef.current) {
          observerRef.current.unobserve(elementRef.current);
        }
      }
    });

    if (elementRef.current) {
      observerRef.current.observe(elementRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const fetchCount = async () => {
      const { count: c } = await supabase.from('games').select('*', { count: 'exact', head: true });
      if (c !== null) setCount(c);
    };
    fetchCount();

    let countAccumulator = 0;
    const channel = supabase.channel('public:games_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'games' }, () => {
        countAccumulator++;
        setTimeout(() => {
          if (countAccumulator > 0) {
            setCount(prev => prev + countAccumulator);
            countAccumulator = 0;
          }
        }, 80);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isVisible]);

  return { count, elementRef };
}
