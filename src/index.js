require('dotenv').config();
const express = require('express');
const { createClient } = require('redis');

const app = express();
const PORT = process.env.PORT || 3000;

const client = createClient({ url: process.env.REDIS_URL });

client.connect()
    .then(() => console.log('COnnected to Redis'))
    .catch(err => console.error('Redis connection error: ', err));

app.get('/', async (req, res) => {
    await client.set('test_key', 'Redis is working!');
    const message = await client.get('test_key');
    res.send(message);
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));