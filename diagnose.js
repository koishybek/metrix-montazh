import axios from 'axios';

const creds = {
    username: 'oljas_iot',
    password: 'oljas_iot_123'
};

async function diagnose() {
    try {
        console.log('1. Logging in...');
        const authRes = await axios.post('https://sm.iot-exp.kz/api-token-auth/', creds);
        const token = authRes.data.token;
        console.log('Token acquired:', token.substring(0, 10) + '...');
        
        const headers = { 
            'Authorization': `Token ${token}`,
            'Content-Type': 'application/json'
        };

        // 2. Fetch Meter Models
        console.log('\n2. Fetching Meter Models...');
        const modelsRes = await axios.get('https://sm.iot-exp.kz/api/v1/meter/model/?page_size=1000', { headers });
        const models = modelsRes.data.results || modelsRes.data;
        console.log(`Found ${models.length} models.`);
        
        // Find "Kazmeter" or similar
        const kazmeters = models.filter(m => m.name.toLowerCase().includes('kaz') || m.name.toLowerCase().includes('vodomer'));
        console.log('Kazmeter-like models:', kazmeters.map(m => `${m.id}: ${m.name}`));
        
        // Find "Pulsar"
        const pulsars = models.filter(m => m.name.toLowerCase().includes('pulsar') || m.name.toLowerCase().includes('impuls'));
        console.log('Pulsar-like models:', pulsars.map(m => `${m.id}: ${m.name}`));

        // 3. Create a Test Device
        console.log('\n3. Creating Test Device...');
        const modemSerial = "DIAG_" + Math.floor(Math.random() * 100000);
        const devicePayload = {
            eui: modemSerial,
            type: 20, // Common type
            node: 23, // Taldykorgan/Zhetysu (from previous logs)
            address_name: "Diagnosis Lab",
            lat: 0, 
            lng: 0
        };
        const devRes = await axios.post('https://sm.iot-exp.kz/api/v1/device/', devicePayload, { headers });
        const deviceId = devRes.data.id;
        console.log('Device created:', deviceId);

        // 4. Try to Create Meter - TEST A (Node 20)
        console.log('\n4. Attempting Meter Creation (Node 20)...');
        const node20Payload = {
            node: 20, // CHANGED FROM 23
            resource_type: 1,
            type: 4, 
            serial_number: "M_DIAG_N20_" + Math.floor(Math.random() * 100000),
            join_reading: 10,
            device: deviceId, // Created on Node 23, but maybe compatible?
            // Actually, device should probably be on Node 20 too if we are strict.
            // But let's try just changing meter node first.
            port: 2,
            join_date: "2026-02-16",
            additional_data: { almaty_su_street_id: "0", district: 2 }
        };
        
        try {
            const mRes = await axios.post('https://sm.iot-exp.kz/api/v1/meter/', node20Payload, { headers });
            console.log('SUCCESS! Node 20 Meter ID:', mRes.data.id);
        } catch (e) {
            console.log('FAILED (Node 20):', e.response?.status);
            if (e.response?.status !== 500 && e.response?.data) console.log(JSON.stringify(e.response.data));
        }

        // 5. Try Node 20 + New Device on Node 20
        console.log('\n5. Creating Device on Node 20...');
        const dev20Payload = {
            eui: "DIAG_N20_" + Math.floor(Math.random() * 100000),
            type: 20, 
            node: 20, 
            address_name: "Diagnosis Lab N20",
            lat: 0, lng: 0
        };
        let dev20Id = null;
        try {
            const dRes = await axios.post('https://sm.iot-exp.kz/api/v1/device/', dev20Payload, { headers });
            dev20Id = dRes.data.id;
            console.log('Device on Node 20 Created:', dev20Id);
        } catch(e) { console.log('Dev N20 Failed', e.response?.data); }

        if (dev20Id) {
            console.log('Attempting Meter Creation (Node 20 Full)...');
            const node20FullPayload = {
                ...node20Payload,
                device: dev20Id,
                serial_number: "M_DIAG_N20F_" + Math.floor(Math.random() * 100000),
            };
            try {
                const mRes2 = await axios.post('https://sm.iot-exp.kz/api/v1/meter/', node20FullPayload, { headers });
                console.log('SUCCESS! Node 20 Full Meter ID:', mRes2.data.id);
            } catch (e) {
                console.log('FAILED (Node 20 Full):', e.response?.status);
                if (e.response?.status !== 500 && e.response?.data) console.log(JSON.stringify(e.response.data));
            }
        }

        // 6. Try Reading as String
        console.log('\n6. Attempting Meter Creation (Reading String)...');
        const strReadPayload = {
            ...node20Payload,
            node: 23, // Back to 23
            device: deviceId, // Back to device on 23
            serial_number: "M_DIAG_STR_" + Math.floor(Math.random() * 100000),
            join_reading: "10"
        };
        try {
            const mRes3 = await axios.post('https://sm.iot-exp.kz/api/v1/meter/', strReadPayload, { headers });
            console.log('SUCCESS! StringRead Meter ID:', mRes3.data.id);
        } catch (e) {
            console.log('FAILED (Reading String):', e.response?.status);
            if (e.response?.status !== 500 && e.response?.data) console.log(JSON.stringify(e.response.data));
        }

    } catch (err) {
        console.error('Diagnosis Error:', err.message);
        if (err.response) {
            console.error('Status:', err.response.status);
            console.error('Data:', err.response.data);
        }
    }
}

diagnose();
