import axios from 'axios';

const token = 'fc186709d0cf8bfa4bf5d8567c2456c3178abb51';
const headers = { 
    'Authorization': `Token ${token}`,
    'Content-Type': 'application/json'
};

async function debug500() {
    console.log('--- 1. Checking Nodes ---');
    try {
        const res = await axios.get('https://sm.iot-exp.kz/api/v1/node/', { headers });
        console.log('Nodes available:', res.data.results.map(n => ({id: n.id, name: n.name})));
    } catch (e) {
        console.log('Node check failed:', e.message);
    }

    // Mock data based on what the app sends
    const modemSerial = "TEST_MODEM_" + Math.floor(Math.random() * 10000);
    const node = 23; // Let's use a known valid node (23 from previous logs) to rule out FK error

    const devicePayload = {
        eui: modemSerial,
        type: 20, // KAZMETER type?
        node: node, 
        address_name: "Test Address Debug",
        lat: 0, 
        lng: 0
    };

    console.log('\n--- 2. Trying to Create Device ---');
    console.log('Payload:', JSON.stringify(devicePayload, null, 2));
    let deviceId = null;

    try {
        const res = await axios.post('https://sm.iot-exp.kz/api/v1/device/', devicePayload, { headers });
        console.log('Device Created! ID:', res.data.id);
        deviceId = res.data.id;
    } catch (e) {
        console.log('Device Creation Failed:', e.response ? e.response.status : e.message);
        if (e.response && e.response.data) console.log(JSON.stringify(e.response.data, null, 2));
    }

    if (!deviceId) return;

    console.log('\n--- 3. Fetching Meter Models ---');
    try {
        const res = await axios.get('https://sm.iot-exp.kz/api/v1/meter/model/?page_size=1000', { headers });
        const models = res.data.results || res.data;
        console.log('Total Models:', models.length);
        
        const m64 = models.find(m => m.id === 64);
        console.log('Model 64:', m64 ? m64.name : 'NOT FOUND');

        const m4 = models.find(m => m.id === 4);
        console.log('Model 4:', m4 ? m4.name : 'NOT FOUND');

        const kazmeters = models.filter(m => m.name.toUpperCase().includes('KAZMETER'));
        console.log('Kazmeters found:', kazmeters.map(m => `${m.id}: ${m.name}`));

    } catch (e) {
        console.log('Fetch Models Failed:', e.message);
    }
    
    return; // Stop here

    // Variation 1: Minimal Payload with Client Sector
    const meterPayloadMin = {
        node: node,
        resource_type: 1,
        type: 64, // KAZMETER
        serial_number: "METER_MIN_" + Math.floor(Math.random() * 10000),
        join_reading: 100,
        installation_place: 1,
        apartment: "101",
        consumer: "Debug User",
        phone: "+77001112233",
        account_id: "123456",
        join_date: "2026-02-16",
        object_type: 1,
        device: deviceId,
        port: 1,
        client_sector: "legal" // Added this
    };

    try {
        const res = await axios.post('https://sm.iot-exp.kz/api/v1/meter/', meterPayloadMin, { headers });
        console.log('Meter Created (Minimal)! ID:', res.data.id);
    } catch (e) {
        console.log('Meter Creation Failed (Minimal):', e.response ? e.response.status : e.message);
        if (e.response && e.response.status !== 500) console.log(JSON.stringify(e.response.data, null, 2));
    }

    // Variation 2: Try Device Type 31 (GSM) + Pulsar (4)
    console.log('\n--- 4. Trying Device Type 31 + Pulsar ---');
    try {
        const dev31Payload = { ...devicePayload, type: 31, eui: "GSM_" + Math.floor(Math.random() * 10000) };
        const dRes = await axios.post('https://sm.iot-exp.kz/api/v1/device/', dev31Payload, { headers });
        console.log('Device 31 Created:', dRes.data.id);
        
        const meterPayload31 = { ...meterPayloadMin, device: dRes.data.id, type: 4, port: 2 };
        const mRes = await axios.post('https://sm.iot-exp.kz/api/v1/meter/', meterPayload31, { headers });
        console.log('Meter Created (Type 31/Pulsar)! ID:', mRes.data.id);
    } catch (e) {
         console.log('Meter Creation Failed (Type 31):', e.response ? e.response.status : e.message);
         if (e.response && e.response.status !== 500) console.log(JSON.stringify(e.response.data, null, 2));
    }

    // Variation 3: Try No Port
    console.log('\n--- 5. Trying No Port ---');
    const meterPayloadNoPort = { ...meterPayloadMin, serial_number: "METER_NP_" + Math.floor(Math.random() * 10000) };
    delete meterPayloadNoPort.port;

    try {
        const res = await axios.post('https://sm.iot-exp.kz/api/v1/meter/', meterPayloadNoPort, { headers });
        console.log('Meter Created (No Port)! ID:', res.data.id);
    } catch (e) {
        console.log('Meter Creation Failed (No Port):', e.response ? e.response.status : e.message);
         if (e.response && e.response.status !== 500) console.log(JSON.stringify(e.response.data, null, 2));
    }
}

debug500();
