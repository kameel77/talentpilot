const axios = require('axios');

async function test() {
  try {
    const res = await axios.patch('http://localhost:8000/api/teams/1', {
      manager_id: 1
    }, {
      headers: {
        'Authorization': 'Bearer test' // I don't have a valid token right now, maybe I can just use a local test user token
      }
    });
    console.log(res.data);
  } catch (e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
test();
