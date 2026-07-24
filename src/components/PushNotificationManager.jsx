import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushNotificationManager() {
  const [visitedGame, setVisitedGame] = useState(false);
  const [timePassed, setTimePassed] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (location.pathname.startsWith('/game/')) {
      setVisitedGame(true);
    }
  }, [location.pathname]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTimePassed(true);
    }, 30000);
    return () => clearTimeout(timer);
  }, []);

  const [swRegistration, setSwRegistration] = useState(null);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/sw.js').then((registration) => {
        setSwRegistration(registration);
        
        // If already granted, ensure we are subscribed immediately
        if (Notification.permission === 'granted') {
          registration.pushManager.getSubscription().then((subscription) => {
            if (!subscription) {
              subscribeUser(registration);
            }
          });
        }
      });
    }
  }, []);

  useEffect(() => {
    if (swRegistration && visitedGame && timePassed) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            subscribeUser(swRegistration);
          }
        });
      }
    }
  }, [swRegistration, visitedGame, timePassed]);

  const subscribeUser = async (registration) => {
    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_vapid_key' })
      });
      const data = await res.json();
      const vapidPublicKey = data.key;
      
      if (!vapidPublicKey) {
        console.error('VAPID public key not found from server');
        return;
      }

      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });
      
      await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_push_subscription', subscription })
      });
      console.log('User is subscribed to push notifications.');
    } catch (err) {
      console.error('Failed to subscribe the user: ', err);
    }
  };

  return null;
}
