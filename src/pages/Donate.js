import React, { useEffect, useRef, useState } from 'react';
import useAppData from '../hooks/useAppData';
import { addDonation, hasDonated } from '../services/mockApi';

const bloodTypes = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];

const cityCoordinates = {
  pune: { lat: 18.5204, lng: 73.8567 },
  mumbai: { lat: 19.076, lng: 72.8777 },
  nagpur: { lat: 21.1458, lng: 79.0882 },
  delhi: { lat: 28.7041, lng: 77.1025 },
};

const cityNames = {
  pune: 'Pune',
  mumbai: 'Mumbai',
  nagpur: 'Nagpur',
  delhi: 'Delhi',
};

const getCoordsForCity = (city) => cityCoordinates[city?.toLowerCase()] || null;
const findNearestCity = (position) => {
  if (!position) return null;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  let nearestKey = null;
  let nearestDist = Number.MAX_VALUE;
  Object.entries(cityCoordinates).forEach(([key, coords]) => {
    const dLat = toRad(coords.lat - position.lat);
    const dLng = toRad(coords.lng - position.lng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(position.lat)) *
        Math.cos(toRad(coords.lat)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = Math.round(R * c);
    if (d < nearestDist) {
      nearestDist = d;
      nearestKey = key;
    }
  });
  return nearestKey ? cityNames[nearestKey] || nearestKey : null;
};

const Donate = () => {
  const { session, setInventory } = useAppData();
  const [donationForm, setDonationForm] = useState({
    bloodType: 'O+',
    city: '',
    contact: '',
  });
  const [alreadyDonated, setAlreadyDonated] = useState(() => hasDonated(session));
  const [submitError, setSubmitError] = useState('');
  const [userPosition, setUserPosition] = useState(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [leafletReady, setLeafletReady] = useState(false);
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (!window.L) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => setLeafletReady(true);
      document.body.appendChild(script);
    } else {
      setLeafletReady(true);
    }
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserPosition(coords);
        setLocationEnabled(true);
        setLocationError('');
        const nearest = findNearestCity(coords);
        setDonationForm((prev) => (prev.city ? prev : { ...prev, city: nearest || prev.city }));
      },
      () => setLocationError('Location blocked; showing all cities.'),
      { enableHighAccuracy: false, timeout: 5000 },
    );
  }, []);

  useEffect(() => {
    if (session?.contact) {
      setDonationForm((prev) => (prev.contact ? prev : { ...prev, contact: session.contact }));
    }
    setAlreadyDonated(hasDonated(session));
  }, [session]);

  useEffect(() => {
    const center = userPosition || getCoordsForCity(donationForm.city);
    if (!leafletReady || !mapRef.current || !center || !window.L) return;
    if (!mapInstance.current) {
      mapInstance.current = window.L.map(mapRef.current).setView([center.lat, center.lng], 13);
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(mapInstance.current);
    } else {
      mapInstance.current.setView([center.lat, center.lng], 13);
    }
    if (markerRef.current) {
      mapInstance.current.removeLayer(markerRef.current);
    }
    markerRef.current = window.L.marker([center.lat, center.lng]).addTo(mapInstance.current);
  }, [leafletReady, donationForm.city, userPosition]);

  const handleDonationSubmit = (event) => {
    event.preventDefault();
    setSubmitError('');
    if (alreadyDonated) {
      setSubmitError('You have already published a donation. Contact support to update details.');
      return;
    }
    try {
      const { inventory: updatedInventory } = addDonation({ ...donationForm, units: 1 }, session);
      setInventory(updatedInventory);
      setDonationForm((prev) => ({ ...prev, city: '', contact: '' }));
      setAlreadyDonated(true);
    } catch (err) {
      if (err?.code === 'already-donated' || err?.message === 'already-donated') {
        setAlreadyDonated(true);
        setSubmitError('You have already published a donation. Contact support to update details.');
      } else {
        setSubmitError('Could not publish right now. Try again in a moment.');
      }
    }
  };

  const loggedIn = Boolean(session);
  const isHospital = session?.role === 'Hospital';

  if (!loggedIn) {
    return (
      <main className="page">
        <section className="hero">
          <div className="hero__content">
            <p className="eyebrow">Identity check</p>
            <h1>Login required</h1>
            <p className="lead">Sign in as an individual donor to publish available units.</p>
            <a className="btn btn--primary" href="/login">
              Go to login
            </a>
          </div>
        </section>
      </main>
    );
  }

  if (isHospital) {
    return (
      <main className="page">
        <section className="hero">
          <div className="hero__content">
            <p className="eyebrow">Donate</p>
            <h1>Only individual donors can donate.</h1>
            <p className="lead">Switch to an individual account or use the hospital console to find blood.</p>
            <a className="btn btn--primary" href="/hospital">
              Go to hospital console
            </a>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="grid grid--two" id="donate">
        <div className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Donate</p>
              <h3>List available blood units</h3>
              <p className="hint">Add blood type, city, and contact. Units are auto-set.</p>
            </div>
            <div className="pill pill--ghost">Verified donors only</div>
          </div>
          <form className="form" onSubmit={handleDonationSubmit}>
            <label>
              Blood type
              <select
                value={donationForm.bloodType}
                onChange={(e) => setDonationForm({ ...donationForm, bloodType: e.target.value })}
              >
                {bloodTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <label>
              Address
              <input
                type="text"
                value={donationForm.city}
                onChange={(e) => setDonationForm({ ...donationForm, city: e.target.value })}
                placeholder="Auto-detected city or type manually"
                required
              />
            </label>
            <label>
              Contact
              <input
                type="text"
                value={donationForm.contact}
                onChange={(e) => setDonationForm({ ...donationForm, contact: e.target.value })}
                placeholder="+91 90000 00000"
              />
            </label>
            <input type="hidden" value="1" />
            <button type="submit" className="btn btn--primary" disabled={alreadyDonated}>
              {alreadyDonated ? 'Donation already published' : 'Publish to inventory'}
            </button>
            {submitError && <p className="hint">{submitError}</p>}
          </form>
        </div>

        <div className="panel panel--muted map-panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Location</p>
              <h3>Nearest city detected</h3>
              <p className="hint">
                We try to detect your city automatically. You can still adjust it above if needed.
              </p>
            </div>
            <div className="pill pill--ghost">
              {locationEnabled ? 'Using location' : 'Enter city manually'}
            </div>
          </div>
          <div className="map-card">
            <div id="map" ref={mapRef} style={{ height: '220px', width: '100%', borderRadius: '12px' }} />
            <p className="hint" style={{ marginTop: '0.5rem' }}>
              {donationForm.city || 'Detecting location...'}{' '}
              {userPosition ? `(Lat ${userPosition.lat.toFixed(3)}, Lng ${userPosition.lng.toFixed(3)})` : ''}
            </p>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      setUserPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                      setLocationEnabled(true);
                      setLocationError('');
                    },
                    () => setLocationError('Location blocked; enter city manually.'),
                    { enableHighAccuracy: true, timeout: 5000 },
                  );
                }
              }}
            >
              Use my location
            </button>
            {locationError && <p className="hint">{locationError}</p>}
          </div>
        </div>
      </section>
    </main>
  );
};

export default Donate;
