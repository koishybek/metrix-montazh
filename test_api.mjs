import axios from 'axios';

const payload = {
    node: 20,
    resource_type: 1,
    type: 1,
    serial_number: "TEST-12345",
    join_reading: 0,
    installation_place: 1,
    apartment: "12",
    consumer: "Test User",
    phone: "123456789",
    account_id: "123",
    join_date: "2026-02-20",
    client_sector: "legal",
    object_type: 1,
    additional_data: {
        almaty_su_street_id: "0",
        district: 2
    },
    device: 1,
    port: 2
};

try {
    const res = await axios.post('https://sm.iot-exp.kz/api/v1/meter/', payload, {
        headers: {
            'Authorization': 'Token fc186709d0cf8bfa4bf5d8567c2456c3178abb51',
            'Content-Type': 'application/json'
        }
    });
    console.log("Success:", JSON.stringify(res.data, null, 2));
} catch (err) {
    if (err.response) {
        console.log("Status:", err.response.status);
        console.log("Error Data:", JSON.stringify(err.response.data, null, 2));
    } else {
        console.log("Error:", err.message);
    }
}
