require('dotenv').config();
const express = require('express');
const { createClient } = require('redis');
const { Sequelize } = require('sequelize');

const app = express();
const PORT = process.env.PORT || 3000;

const client = createClient({ url: process.env.REDIS_URL });
const sequelize = new Sequelize(process.env.DATABASE_URL);

client.connect()
    .then(() => console.log('Connected to Redis'))
    .catch(err => console.error('Redis connection error: ', err));

sequelize.authenticate()
    .then(() => console.log('Connected to PostgreSQL'))
    .catch(err => console.error('PostgreSQL connection error: ', err));

app.get('/', (req, res) => {
    res.send('Welcome to Url Shortner');
});

app.get('/cache', async (req, res) => {
    await client.set('test_key', 'Redis is working!');
    const message = await client.get('test_key');
    res.send(message);
});

app.get('/db', (req, res) => {
    res.send('Connected to PostgreSQL successfully!');
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));