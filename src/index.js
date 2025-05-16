require('dotenv').config();
const express = require('express');
const { createClient } = require('redis');
const { Sequelize, DataTypes } = require('sequelize');
const shortid = require('shortid');

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

const redisClient = createClient({ url: process.env.REDIS_URL });
const sequelize = new Sequelize(process.env.DATABASE_URL);

redisClient.connect()
    .then(() => console.log('Connected to Redis'))
    .catch(err => console.error('Redis connection error: ', err));

sequelize.authenticate()
    .then(() => console.log('Connected to PostgreSQL'))
    .catch(err => console.error('PostgreSQL connection error: ', err));

const Urls = sequelize.define('Urls', {
    shortId: { type: DataTypes.STRING, primaryKey: true },
    originalUrl: { type: DataTypes.TEXT, allowNull: false },
}, {
    tableName: 'urls',
});

sequelize.sync();

app.post('/urls', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
          return res.status(400).json({ error: 'URL is required' });
        }
    
        const shortId = shortid.generate();
    
        await Urls.create({ shortId, originalUrl: url });
        await redisClient.set(shortId, url);
    
        const shortUrl = `${req.protocol}://${req.get('host')}/${shortId}`;
        res.status(201).json({ shortUrl });
      } catch (error) {
        console.error('Error creating URL:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    
});

app.get('/:shortId', async (req, res) => {
    try {
        const { shortId } = req.params;
    
        let originalUrl = await redisClient.get(shortId);
    
        if (originalUrl) {
          return res.redirect(originalUrl);
        }
    
        const record = await Urls.findByPk(shortId);
        if (record) {
          originalUrl = record.originalUrl;
          await redisClient.set(shortId, originalUrl);
          return res.redirect(originalUrl);
        }
    
        res.status(404).send('URL not found');
      } catch (error) {
        console.error('Error fetching URL:', error);
        res.status(500).send('Internal Server Error');
      }
});

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