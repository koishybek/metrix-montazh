import axios from 'axios';

const token = 'fc186709d0cf8bfa4bf5d8567c2456c3178abb51';

async function fetchMeterModels() {
  try {
    const res = await axios.get('https://sm.iot-exp.kz/api/v1/meter/model/?page_size=100&perPage=100', {
      headers: {
        'Authorization': `Token ${token}`
      }
    });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error('Error fetching meter models:', err.message);
    if (err.response) {
      console.error(err.response.data);
    }
  }
}

fetchMeterModels();
