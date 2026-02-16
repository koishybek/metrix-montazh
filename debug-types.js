import axios from 'axios';

const token = 'fc186709d0cf8bfa4bf5d8567c2456c3178abb51';

async function fetchTypes() {
  const headers = { 'Authorization': `Token ${token}` };

  try {
    console.log('--- Device Types (try 2) ---');
    // Maybe it's just /api/v1/device-type/ or similar?
    // Or maybe we can get unique 'type' values from device list?
    const res = await axios.get('https://sm.iot-exp.kz/api/v1/device/?page_size=100', { headers });
    // Extract unique types from devices
    const devices = res.data.results || [];
    const types = [...new Set(devices.map(d => d.type))];
    console.log('Unique Type IDs found in Devices:', types);
    // Also check if 'type_name' is present
    const typeNames = [...new Set(devices.map(d => `${d.type}: ${d.type_name || '?'}`))];
    console.log('Unique Type Names:', typeNames);
  } catch (e) {
    console.log('Error fetching devices:', e.message);
  }

  try {
    console.log('\n--- Meter Models ---');
    const res = await axios.get('https://sm.iot-exp.kz/api/v1/meter/model/', { headers });
    // Just show first 5 to compare
    const data = res.data.results || res.data;
    console.log(JSON.stringify(data.slice(0, 5), null, 2));
  } catch (e) {
    console.log('Error fetching meter models:', e.message);
  }
}

fetchTypes();
