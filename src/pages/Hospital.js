import React, { useCallback, useEffect, useMemo, useState } from 'react';
import useAppData from '../hooks/useAppData';
import { addDonation, addRequest, consumeDonation, findHospitalsByType, findMatches } from '../services/mockApi';

const bloodTypes = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];

const cityCoordinates = {
  pune: { lat: 18.5204, lng: 73.8567 },
  mumbai: { lat: 19.076, lng: 72.8777 },
  nagpur: { lat: 21.1458, lng: 79.0882 },
  delhi: { lat: 28.7041, lng: 77.1025 },
};

const getCoordsForCity = (city) => cityCoordinates[city?.toLowerCase()] || null;

const Hospital = () => {
  const { session, inventory, requests, hospitals, setInventory, setRequests } = useAppData();
  const [bloodFilter, setBloodFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [minUnits, setMinUnits] = useState(1);
  const [userPosition, setUserPosition] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [alertResult, setAlertResult] = useState(null);
  const [emergencyForm, setEmergencyForm] = useState({
    bloodType: 'O+',
    units: 2,
    city: '',
    clinicalReason: 'Emergency need',
    contact: '',
  });
  const [manualLocation, setManualLocation] = useState('');

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationError('');
      },
      () => setLocationError('Location blocked; sorting by city.'),
      { enableHighAccuracy: false, timeout: 5000 },
    );
  }, []);

  const basePosition = useMemo(() => {
    const manual = manualLocation ? getCoordsForCity(manualLocation) : null;
    return manual || userPosition;
  }, [manualLocation, userPosition]);

  const distanceKm = useCallback(
    (coords) => {
      if (!basePosition || !coords) return null;
      const toRad = (deg) => (deg * Math.PI) / 180;
      const R = 6371;
      const dLat = toRad(coords.lat - basePosition.lat);
      const dLng = toRad(coords.lng - basePosition.lng);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(basePosition.lat)) * Math.cos(toRad(coords.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return Math.round(R * c);
    },
    [basePosition],
  );

  const filteredInventory = useMemo(() => {
    let list = inventory;
    if (bloodFilter) list = list.filter((item) => item.bloodType === bloodFilter);
    if (cityFilter) list = list.filter((item) => item.city === cityFilter);
    if (minUnits) list = list.filter((item) => Number(item.units) >= Number(minUnits));
    return [...list].sort((a, b) => {
      const da = distanceKm(getCoordsForCity(a.city)) ?? Number.MAX_VALUE;
      const db = distanceKm(getCoordsForCity(b.city)) ?? Number.MAX_VALUE;
      return da - db;
    });
  }, [inventory, bloodFilter, cityFilter, minUnits, distanceKm]);

  const filteredHospitals = useMemo(() => {
    const matches = bloodFilter ? findHospitalsByType(bloodFilter) : hospitals;
    const byCity = cityFilter ? matches.filter((h) => h.city === cityFilter) : matches;
    const bySearch = searchTerm
      ? byCity.filter(
          (h) =>
            h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            h.bankPartner?.toLowerCase().includes(searchTerm.toLowerCase()),
        )
      : byCity;
    return [...bySearch].sort((a, b) => {
      const da = distanceKm(getCoordsForCity(a.city)) ?? Number.MAX_VALUE;
      const db = distanceKm(getCoordsForCity(b.city)) ?? Number.MAX_VALUE;
      return da - db;
    });
  }, [hospitals, bloodFilter, cityFilter, searchTerm, distanceKm]);

  const shortageGraph = useMemo(() => {
    const bloodTypesList = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];
    const availableByType = inventory.reduce((acc, item) => {
      acc[item.bloodType] = (acc[item.bloodType] || 0) + Number(item.units || 0);
      return acc;
    }, {});
    const requestedByType = requests.reduce((acc, item) => {
      acc[item.bloodType] = (acc[item.bloodType] || 0) + Number(item.units || 0);
      return acc;
    }, {});
    return bloodTypesList.map((type) => {
      const available = availableByType[type] || 0;
      const needed = requestedByType[type] || 0;
      const shortage = Math.max(0, needed - available);
      const severity = shortage === 0 ? 'ok' : shortage <= 2 ? 'watch' : 'critical';
      return { type, available, needed, shortage, severity };
    });
  }, [inventory, requests]);

  const cityOptions = useMemo(
    () => Array.from(new Set(inventory.map((item) => item.city))).sort(),
    [inventory],
  );

  const [transferForm, setTransferForm] = useState({
    bloodType: 'O+',
    units: 1,
    city: '',
    toHospital: '',
    contact: '',
  });

  const handleTakeDonation = (id) => {
    const updated = consumeDonation(id);
    setInventory(updated);
  };

  const handleTransferSubmit = (event) => {
    event.preventDefault();
    const { inventory: updatedInventory } = addDonation(
      {
        bloodType: transferForm.bloodType,
        units: transferForm.units,
        city: transferForm.city,
        hospital: transferForm.toHospital || session?.organization || session?.name || 'Hospital',
        contact: transferForm.contact,
        status: 'Ready',
      },
      session,
    );
    setInventory(updatedInventory);
    setTransferForm((prev) => ({ ...prev, city: '', toHospital: '', contact: '' }));
  };

  const handleEmergencyAlert = (event) => {
    event.preventDefault();
    const matches = findMatches(emergencyForm.bloodType).filter((m) =>
      emergencyForm.city ? m.city?.toLowerCase() === emergencyForm.city.toLowerCase() : true,
    );

    const { requests: updatedRequests } = addRequest(
      {
        bloodType: emergencyForm.bloodType,
        units: emergencyForm.units,
        city: emergencyForm.city || session?.organization || '',
        urgency: 'Critical',
        clinicalReason: emergencyForm.clinicalReason || 'Emergency alert',
        requestedBy: session?.organization || session?.name || 'Hospital',
        contact: emergencyForm.contact || session?.email || 'On file',
      },
      session,
    );
    setRequests(updatedRequests);

    setAlertResult({
      total: matches.length,
      preview: matches.slice(0, 3),
    });
  };

  const loggedIn = Boolean(session);
  const isHospital = session?.role === 'Hospital';

  if (!loggedIn || !isHospital) {
    return (
      <main className="page">
        <section className="hero">
          <div className="hero__content">
            <p className="eyebrow">Hospital console</p>
            <h1>Hospital access only</h1>
            <p className="lead">
              Please log in as a hospital to view available blood, filter, and transfer units.
            </p>
            <a className="btn btn--primary" href="/login">
              Go to login
            </a>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="grid">
        <div className="panel panel--accent">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Emergency alert</p>
              <h3>Page nearby donors now</h3>
              <p className="hint">
                Sends an urgent request, writes it to the system, and highlights compatible donors instantly.
              </p>
            </div>
            <div className="pill pill--ghost">Critical channel</div>
          </div>
          <form className="form" onSubmit={handleEmergencyAlert}>
            <div className="form__row">
              <label>
                Needed type
                <select
                  value={emergencyForm.bloodType}
                  onChange={(e) => setEmergencyForm({ ...emergencyForm, bloodType: e.target.value })}
                >
                  {bloodTypes.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label>
                Units needed
                <input
                  type="number"
                  min="1"
                  value={emergencyForm.units}
                  onChange={(e) =>
                    setEmergencyForm({ ...emergencyForm, units: Number(e.target.value || 0) })
                  }
                  required
                />
              </label>
            </div>
            <div className="form__row">
              <label>
                City (optional)
                <input
                  type="text"
                  placeholder="e.g., Pune"
                  value={emergencyForm.city}
                  onChange={(e) => setEmergencyForm({ ...emergencyForm, city: e.target.value })}
                />
              </label>
              <label>
                Contact for callbacks
                <input
                  type="text"
                  placeholder="Phone / email"
                  value={emergencyForm.contact}
                  onChange={(e) => setEmergencyForm({ ...emergencyForm, contact: e.target.value })}
                />
              </label>
            </div>
            <label>
              Note to donors
              <input
                type="text"
                placeholder="Reason / instructions"
                value={emergencyForm.clinicalReason}
                onChange={(e) => setEmergencyForm({ ...emergencyForm, clinicalReason: e.target.value })}
              />
            </label>
            <button type="submit" className="btn btn--primary">Send emergency alert</button>
          </form>
          {alertResult ? (
            <div className="inventory-list" style={{ marginTop: '0.6rem' }}>
              <p className="hint">
                Alert dispatched. Found {alertResult.total} compatible donor entr{alertResult.total === 1 ? 'y' : 'ies'}
                {alertResult.preview.length ? ' to notify:' : '.'}
              </p>
              {alertResult.preview.map((match) => (
                <div key={match.id} className="inventory-row">
                  <div className="pill pill--ghost">{match.bloodType}</div>
                  <div className="inventory-row__meta">
                    <h4>{match.hospital || 'Verified donor'}</h4>
                    <p className="hint">
                      {match.units} units · {match.city || 'No city'} · {match.status || 'Available'}
                    </p>
                  </div>
                  <div className="inventory-row__contact">
                    <p className="inventory-row__contact-label">Contact</p>
                    <p>{match.contact || 'On file'}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid" id="hospital-tools">
        <div className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Hospital tools</p>
              <h3>Search and filter blood availability</h3>
              <p className="hint">Filter by blood type, city, and minimum units. Location sorts nearest first.</p>
            </div>
            <div className="pill pill--ghost">
              {basePosition
                ? manualLocation
                  ? `Using ${manualLocation}`
                  : 'Using your location'
                : 'Location not set'}
            </div>
          </div>

          <div className="form">
            <div className="form__row">
              <label>
                Blood type
                <select value={bloodFilter} onChange={(e) => setBloodFilter(e.target.value)}>
                  <option value="">Any</option>
                  {bloodTypes.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label>
                City
                <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
                  <option value="">Any</option>
                  {cityOptions.map((city) => (
                    <option key={city}>{city}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Search hospitals / banks
              <input
                type="text"
                placeholder="Hospital or bank name"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </label>
            <div className="form__row">
              <label>
                Smart distance from (city)
                <input
                  type="text"
                  placeholder="e.g., Pune, Mumbai, Nagpur, Delhi"
                  value={manualLocation}
                  onChange={(e) => {
                    const value = e.target.value;
                    setManualLocation(value);
                    if (value && !getCoordsForCity(value)) {
                      setLocationError('Enter a supported city to sort by distance.');
                    } else {
                      setLocationError('');
                    }
                  }}
                />
              </label>
              <label>
                Min units
                <input
                  type="number"
                  min="1"
                  value={minUnits}
                  onChange={(e) => setMinUnits(Number(e.target.value || 0))}
                />
              </label>
            </div>
            {locationError && <p className="hint">{locationError}</p>}
          </div>

          <div className="inventory-list">
            {filteredInventory.map((item) => {
              const dist = distanceKm(getCoordsForCity(item.city));
              return (
                <div key={item.id} className="inventory-row">
                  <div className="pill pill--ghost">{item.bloodType}</div>
                  <div className="inventory-row__meta">
                    <h4>
                      {item.units} units · {item.hospital}
                    </h4>
                    <p className="hint">
                      {item.city} · {item.status}
                    </p>
                  </div>
                  <div className="inventory-row__contact">
                    <p className="inventory-row__contact-label">Contact</p>
                    <p>{item.contact}</p>
                    {dist ? <p className="hint">~{dist} km away</p> : null}
                  </div>
                  <button className="btn btn--ghost" onClick={() => handleTakeDonation(item.id)}>
                    Take units
                  </button>
                </div>
              );
            })}
            {!filteredInventory.length && <p className="hint">No inventory found.</p>}
          </div>
        </div>

        {/* <div className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Hospital directory</p>
              <h3>Access partner hospital data</h3>
              <p className="hint">View bank partners and reach verified hospital teams.</p>
            </div>
          </div>
          <div className="inventory-list">
            {filteredHospitals.map((hospital) => {
              const dist = distanceKm(getCoordsForCity(hospital.city));
              return (
                <div key={hospital.id} className="inventory-row">
                  <div className="pill pill--ghost">{hospital.city}</div>
                  <div className="inventory-row__meta">
                    <h4>{hospital.name}</h4>
                    <p className="hint">
                      Bank partner: {hospital.bankPartner} · Ready types: {hospital.readyTypes.join(', ')}
                    </p>
                  </div>
                  <div className="inventory-row__contact">
                    <p className="inventory-row__contact-label">Contact</p>
                    <p>{hospital.contact}</p>
                    <p className="hint">{hospital.email}</p>
                    {dist ? <p className="hint">~{dist} km away</p> : null}
                  </div>
                </div>
              );
            })}
            {!filteredHospitals.length && <p className="hint">No hospitals match these filters.</p>}
          </div>
        </div> */}

        <div className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Hospital transfer</p>
              <h3>Send units to another hospital</h3>
              <p className="hint">Publish available units for a specific hospital so they can claim.</p>
            </div>
          </div>
          <form className="form" onSubmit={handleTransferSubmit}>
            <div className="form__row">
              <label>
                Blood type
                <select
                  value={transferForm.bloodType}
                  onChange={(e) => setTransferForm({ ...transferForm, bloodType: e.target.value })}
                >
                  {bloodTypes.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label>
                Units
                <input
                  type="number"
                  min="1"
                  value={transferForm.units}
                  onChange={(e) =>
                    setTransferForm({ ...transferForm, units: Number(e.target.value || 0) })
                  }
                  required
                />
              </label>
            </div>
            <div className="form__row">
              <label>
                To hospital
                <input
                  type="text"
                  value={transferForm.toHospital}
                  onChange={(e) => setTransferForm({ ...transferForm, toHospital: e.target.value })}
                  placeholder="Receiving hospital name"
                  required
                />
              </label>
              <label>
                City
                <input
                  type="text"
                  value={transferForm.city}
                  onChange={(e) => setTransferForm({ ...transferForm, city: e.target.value })}
                  placeholder="City"
                  required
                />
              </label>
            </div>
            <label>
              Contact
              <input
                type="text"
                value={transferForm.contact}
                onChange={(e) => setTransferForm({ ...transferForm, contact: e.target.value })}
                placeholder="Hospital contact"
              />
            </label>
            <button type="submit" className="btn btn--primary">Publish transfer</button>
          </form>
        </div>
      </section>
    </main>
  );
};

export default Hospital;
