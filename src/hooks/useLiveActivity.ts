import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function useLiveActivity() {
  const [count, setCount] = useState(0);
  const [activeNow, setActiveNow] = useState(0);
  const [lastCheckmate, setLastCheckmate] = useState<any>(null);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [deltaHour, setDeltaHour] = useState(0);
  const [deltaMin, setDeltaMin] = useState(0);

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

    // 1. Hydrate count
    const fetchCount = async () => {
      const { count: c } = await supabase.from('games').select('*', { count: 'exact', head: true });
      if (c !== null) setCount(c);
      
      const { count: active } = await supabase.from('games').select('*', { count: 'exact', head: true }).eq('status', 'active');
      if (active !== null) setActiveNow(active);

      const { data: latestCheckmate } = await supabase.from('games').select('*').eq('status', 'finished').eq('result', 'checkmate').order('updated_at', { ascending: false }).limit(1).single();
      if (latestCheckmate) setLastCheckmate(latestCheckmate);

      const { data: recents } = await supabase.from('games').select('*').order('created_at', { ascending: false }).limit(5);
      if (recents) setRecentEvents(recents);
    };
    fetchCount();

    // 2. Window stats
    const fetchWindows = async () => {
      try {
        const hRes = await fetch('/api/stats-window?minutes=60');
        const hData = await hRes.json();
        setDeltaHour(hData.count || 0);

        const mRes = await fetch('/api/stats-window?minutes=1');
        const mData = await mRes.json();
        setDeltaMin(mData.count || 0);
      } catch (err) {
        console.error('Failed to fetch windows', err);
      }
    };
    fetchWindows();
    const intervalId = setInterval(fetchWindows, 30000);

    // 3. Realtime
    let countAccumulator = 0;
    const channel = supabase.channel('public:games_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'games' }, payload => {
        countAccumulator++;
        setTimeout(() => {
          if (countAccumulator > 0) {
            setCount(prev => prev + countAccumulator);
            countAccumulator = 0;
          }
        }, 80);

        setRecentEvents(prev => {
          const newEvents = [payload.new, ...prev].slice(0, 5);
          return newEvents;
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games' }, payload => {
        if (payload.new.status === 'finished' && payload.new.result === 'checkmate') {
          setLastCheckmate(payload.new);
        }
        if (payload.old.status === 'active' && payload.new.status !== 'active') {
          setActiveNow(prev => Math.max(0, prev - 1));
        } else if (payload.old.status !== 'active' && payload.new.status === 'active') {
          setActiveNow(prev => prev + 1);
        }
      })
      .subscribe();

    return () => {
      clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [isVisible]);

  return { count, activeNow, lastCheckmate, recentEvents, deltaHour, deltaMin, elementRef };
}
