const axios = require('axios');

const forwardRequest = async (url, method, data, headers) => {
  try {
    const response = await axios({ url, method, data, headers });
    return response.data;
  } catch (error) {
    console.error('Error forwarding request:', error.message);
    throw error;
  }
};

module.exports = forwardRequest;